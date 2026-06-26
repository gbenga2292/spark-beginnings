import { useState, useMemo, useEffect } from 'react';
import {
  format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameMonth,
  isBefore, startOfDay
} from 'date-fns';
import {
  Bell, ChevronLeft, ChevronRight, ArrowLeft, CheckSquare, BookOpen, Clock
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { fetchOperationsData, fetchJournalsByDateRange } from '@/src/lib/supabaseService';
import { CreateTaskDialog } from '@/src/pages/Tasks/CreateTaskDialog';
import { CreateReminderDialog } from '@/src/pages/Tasks/CreateReminderDialog';
import { CreateDailyJournalDialog } from '@/src/pages/DailyJournal/CreateDailyJournalDialog';

const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatDateKey = (d: Date): string => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};

const STATUS_STYLES: Record<string, { bg: string, label: string, icon: any }> = {
  completed: {
    bg: 'bg-emerald-600',
    label: 'Completed',
    icon: CheckSquare,
  },
  overdue: {
    bg: 'bg-rose-600',
    label: 'Overdue',
    icon: CheckSquare,
  },
  in_progress: {
    bg: 'bg-amber-500',
    label: 'Ongoing',
    icon: CheckSquare,
  },
  not_started: {
    bg: 'bg-indigo-500', // Blue
    label: 'To Start',
    icon: CheckSquare,
  },
  reminder: {
    bg: 'bg-purple-600',
    label: 'Reminders',
    icon: Bell,
  },
  journal: {
    bg: 'bg-gradient-to-r from-amber-400 to-orange-400',
    label: 'Daily Journal',
    icon: BookOpen,
  },
  holiday: {
    bg: 'bg-pink-600',
    label: 'Public Holiday',
    icon: Bell,
  },
};

type ViewMode = 'month' | 'day';
type FilterMode = 'all' | 'all_tasks' | 'all_reminders' | 'journal';

interface CalendarEvent {
  id: string;
  title: string;
  time: Date;
  type: 'task' | 'reminder' | 'journal';
  status?: string;
  body?: string;
  colorClass: string;
  isMain?: boolean;
}

export default function CalendarPage({ onNavigate, showCompleted: externalShowCompleted, hideHeaderToggle }: { onNavigate?: () => void; showCompleted?: boolean; hideHeaderToggle?: boolean } = {}) {
  const { user: currentUser } = useAuth();
  const { reminders, mainTasks: allMainTasks, subtasks: allSubtasks, users } = useAppData();

  const appUser = users.find(u => u.id === currentUser?.id);
  const isExternalHr = appUser?.privileges?.tasks?.isExternalHr;

  const mainTasks = useMemo(() => {
    if (isExternalHr) return allMainTasks.filter(m => {
      const isAssigned = (m.assignedTo || (m as any).assigned_to || '').includes(currentUser?.id || '');
      return !!m.is_hr_task || m.created_by === currentUser?.id || m.createdBy === currentUser?.id || isAssigned;
    });
    return allMainTasks;
  }, [allMainTasks, isExternalHr, currentUser?.id]);

  const subtasks = useMemo(() => {
    if (isExternalHr) {
      const hrIds = new Set(mainTasks.map(m => m.id));
      return allSubtasks.filter(s => hrIds.has(s.mainTaskId!) || hrIds.has((s as any).main_task_id));
    }
    return allSubtasks;
  }, [allSubtasks, mainTasks, isExternalHr]);
  const navigate = useNavigate();

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showCompleted, setShowCompleted] = useState(externalShowCompleted ?? true);
  const holidays = useAppStore(state => state.publicHolidays);
  const dailyJournals = useAppStore(state => state.dailyJournals);
  const siteJournalEntries = useAppStore(state => state.siteJournalEntries);
  const { dailyMachineLogs } = useOperations();

  useEffect(() => {
    fetchOperationsData()
      .then((data) => {
        useAppStore.setState(data);
      })
      .catch(console.error);
  }, []);

  // Load journals for the currently viewed month range (including adjacent months for calendar safety)
  // Removed partial data fetch effects to rely on full data loaded by fetchOperationsData
  
  // Update local state if external prop changes
  useMemo(() => {
    if (externalShowCompleted !== undefined) {
      setShowCompleted(externalShowCompleted);
    }
  }, [externalShowCompleted]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [selectedAddHour, setSelectedAddHour] = useState<number | null>(null);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateReminder, setShowCreateReminder] = useState(false);
  const [showCreateDailyJournal, setShowCreateDailyJournal] = useState(false);
  const [legendCycleState, setLegendCycleState] = useState<{ key: string, index: number }>({ key: '', index: 0 });

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const now = new Date();
    const today = startOfDay(now);

    const activeMainTaskIds = new Set(mainTasks.filter(m => !m.isDeleted).map(m => m.id));

    // Pre-compute maps for O(1) lookups to avoid O(N*M) loops
    const subtasksByMainId = new Map<string, typeof subtasks>();
    subtasks.forEach(s => {
      const mid = s.mainTaskId || (s as any).main_task_id;
      if (mid) {
        const arr = subtasksByMainId.get(mid) || [];
        arr.push(s);
        subtasksByMainId.set(mid, arr);
      }
    });

    const entriesByJournal = new Map<string, typeof siteJournalEntries>();
    siteJournalEntries.forEach(e => {
      if (e.journalId) {
        const arr = entriesByJournal.get(e.journalId) || [];
        arr.push(e);
        entriesByJournal.set(e.journalId, arr);
      }
    });

    // 1. Determine if we should show tasks
    const showTasks = ['all', 'all_tasks'].includes(filterMode);

    if (showTasks) {
      // Subtasks
      let relevantSubtasks = subtasks.filter(s => s.deadline && activeMainTaskIds.has((s as any).main_task_id || s.mainTaskId));

      if (!showCompleted) {
        relevantSubtasks = relevantSubtasks.filter(s => s.status !== 'completed');
      }

      relevantSubtasks.forEach(s => {
        const deadline = new Date(s.deadline!);
        const isOverdue = s.status !== 'completed' && isBefore(deadline, today);
        let statusKey = s.status === 'completed' ? 'completed' : (isOverdue ? 'overdue' : (s.status || 'not_started'));
        // Normalize 'pending_approval' to 'in_progress' (Ongoing)
        if (statusKey === 'pending_approval') statusKey = 'in_progress';
        
        const style = STATUS_STYLES[statusKey] || STATUS_STYLES.not_started;

        events.push({
          id: s.id || 'unknown', title: s.title, time: deadline,
          type: 'task', status: s.status, colorClass: style.bg,
          isMain: false,
          body: s.description || '',
        });
      });

      // Main tasks
      let relevantMainTasks = mainTasks.filter(m => m.deadline && !m.isDeleted);

      relevantMainTasks.forEach(m => {
        const deadline = new Date(m.deadline!);
        
        // Calculate main task status based on subtasks
        const taskSubs = subtasksByMainId.get(m.id) || [];
        
        // If the main task has subtasks, skip adding it to the calendar
        // to prevent duplicate visual clutter since the subtasks will be rendered.
        if (taskSubs.length > 0) {
          return;
        }
        
        let mStatus = 'not_started';

        const isOverdue = mStatus !== 'completed' && isBefore(deadline, today);
        const statusKey = mStatus === 'completed' ? 'completed' : (isOverdue ? 'overdue' : mStatus);
        
        const style = STATUS_STYLES[statusKey] || STATUS_STYLES.not_started;

        events.push({
          id: m.id, title: m.title, time: deadline,
          type: 'task', status: mStatus, colorClass: style.bg,
          isMain: true,
          body: m.description || '',
        });
      });
    }

    // 2. Determine if we should show reminders
    const showReminders = ['all', 'all_reminders'].includes(filterMode);

    if (showReminders) {
      let relevantReminders = reminders.filter(r => r.isActive);

      if (isExternalHr) {
        relevantReminders = relevantReminders.filter(r => {
          const mt = mainTasks.find(m => m.id === r.mainTaskId);
          const isAssigned = mt && (mt.assignedTo || (mt as any).assigned_to || '').includes(currentUser?.id || '');
          return mt && (!!mt.is_hr_task || mt.created_by === currentUser?.id || mt.createdBy === currentUser?.id || isAssigned);
        });
      }

      relevantReminders.forEach(r => {
        events.push({
          id: r.id, title: r.title, time: parseISO(r.remindAt),
          type: 'reminder', body: r.body, colorClass: STATUS_STYLES.reminder.bg,
        });
      });
    }

    // 3. Public Holidays (always shown in all filter modes)
    holidays.forEach(h => {
      events.push({
        id: `hol-${h.date}`, title: h.name, time: parseISO(h.date),
        type: 'reminder', body: 'Public Holiday', colorClass: STATUS_STYLES.holiday.bg,
      });
    });

    // 4. Daily Journals — one pill per entry, placed at actual creation time
    const showJournals = ['all', 'journal'].includes(filterMode);

    if (showJournals) {
      dailyJournals.forEach(j => {
        // Always use the journal's explicit `date` for calendar-day grouping to avoid UTC
        // timezone drift (createdAt is stored in UTC and could shift the day in local time).
        // Preserve createdAt's hour/minute only for day-view hour-slot placement.
        let entryTime: Date;
        if (j.createdAt) {
          const utcTime = parseISO(j.createdAt);
          // Reconstruct: correct local date from j.date, time-of-day from createdAt local
          entryTime = parseISO(
            `${j.date}T${String(utcTime.getHours()).padStart(2, '0')}:${String(utcTime.getMinutes()).padStart(2, '0')}:00`
          );
        } else {
          entryTime = parseISO(`${j.date}T08:00:00`);
        }
        const loggerName = j.loggedBy || 'Unknown';
        const entries = entriesByJournal.get(j.id) || [];
        const sites = entries.map(e => e.siteName).filter(Boolean);
        const sitesText = sites.length > 0 ? sites.join(', ') : null;

        let detailedBody = j.generalNotes ? `${j.generalNotes}\n\n` : '';
        if (entries.length > 0) {
          entries.forEach(e => {
            if (e.narration) {
              detailedBody += `[${e.siteName}]:\n${e.narration}\n\n`;
            }
          });
        }
        if (!detailedBody.trim()) {
          detailedBody = sitesText ? `${loggerName} · ${sitesText}` : `Logged by ${loggerName}`;
        }

        events.push({
          id: j.id,
          title: sitesText
            ? `Daily Log: ${sitesText.slice(0, 40)}`
            : `Daily Log · ${loggerName}`,
          time: entryTime,
          type: 'journal',
          body: detailedBody.trim(),
          colorClass: STATUS_STYLES.journal.bg,
        });
      });

      // Also add standalone machine-log-only days (no manual journal on that date) as Operational Log events
      const journalDates = new Set(dailyJournals.map(j => j.date));
      const machineOnlyDates = new Map<string, typeof dailyMachineLogs>();
      dailyMachineLogs.forEach(l => {
        if (!journalDates.has(l.date)) {
          const arr = machineOnlyDates.get(l.date) || [];
          arr.push(l);
          machineOnlyDates.set(l.date, arr);
        }
      });
      machineOnlyDates.forEach((logs, date) => {
        const siteNames = [...new Set(logs.map(l => l.siteName).filter(Boolean))];
        const sitesText = siteNames.join(', ');
        const machineNames = [...new Set(logs.map(l => l.assetName).filter(Boolean))];
        events.push({
          id: `machine-only-${date}`,
          title: sitesText ? `Ops Log: ${sitesText.slice(0, 40)}` : 'Operational Log',
          time: parseISO(`${date}T07:00:00`),
          type: 'journal',
          body: machineNames.length > 0 ? `Machines: ${machineNames.join(', ')}` : 'Machine activity recorded',
          colorClass: STATUS_STYLES.journal.bg,
        });
      });
    }

    return events;
  }, [reminders, subtasks, mainTasks, currentUser, filterMode, showCompleted, holidays, dailyJournals, siteJournalEntries, dailyMachineLogs, isExternalHr]);


  const visibleLegendKeys = useMemo(() => {
    const keys = new Set<string>(['holiday']); // holiday is always included
    allEvents.forEach(e => {
      if (e.type === 'journal') keys.add('journal');
      else if (e.type === 'reminder') {
        if (!e.id.startsWith('hol-')) keys.add('reminder');
      } else {
        // find matching status key
        const entry = Object.entries(STATUS_STYLES).find(([_, style]) => style.bg === e.colorClass);
        if (entry) keys.add(entry[0]);
      }
    });
    return keys;
  }, [allEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allEvents.forEach(e => {
      const key = formatDateKey(e.time);
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [allEvents]);

  const handleLegendClick = (key: string) => {
    if (viewMode !== 'day') return;
    
    const currentDayEvents = eventsByDate.get(formatDateKey(selectedDate)) || [];
    let matchedEvents = currentDayEvents.filter(e => {
      if (key === 'journal') return e.type === 'journal';
      if (key === 'holiday') return e.id.startsWith('hol-');
      if (key === 'reminder') return e.type === 'reminder' && !e.id.startsWith('hol-');
      return e.type === 'task' && e.colorClass === STATUS_STYLES[key]?.bg;
    });
    
    if (matchedEvents.length === 0) return;
    
    matchedEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

    let nextIndex = 0;
    if (legendCycleState.key === key) {
      nextIndex = (legendCycleState.index + 1) % matchedEvents.length;
    }
    
    setLegendCycleState({ key, index: nextIndex });
    
    const targetEvent = matchedEvents[nextIndex];
    const hour = targetEvent.time.getHours();
    
    const element = document.getElementById(`hour-row-${hour}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const calDays = useMemo(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [calMonth]);

  const dayEvents = useMemo(() => {
    const selectedKey = formatDateKey(selectedDate);
    return allEvents.filter(e => formatDateKey(e.time) === selectedKey)
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [allEvents, selectedDate]);

  const eventsByHour = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    dayEvents.forEach(e => {
      const hour = e.time.getHours();
      const arr = map.get(hour) || [];
      arr.push(e);
      map.set(hour, arr);
    });
    return map;
  }, [dayEvents]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setViewMode('day');
  };

  const goToToday = () => {
    const today = new Date();
    setCalMonth(today);
    setSelectedDate(today);
  };

  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  const calMonthYear = calMonth.getFullYear();
  const calMonthMonth = calMonth.getMonth();
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const numWeeks = calDays.length / 7;

  return (
    <div className="h-full flex flex-col">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-5 py-3 border-b border-white/10 flex-shrink-0 gap-2 sm:gap-0">
        <div className="flex items-center gap-2">
          {viewMode === 'day' && (
            <button onClick={() => setViewMode('month')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          <button onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h1 className="text-base sm:text-xl font-heading font-semibold text-white">
            {format(viewMode === 'day' ? selectedDate : calMonth, viewMode === 'day' ? 'EEE, MMM d, yyyy' : 'MMMM yyyy')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {!hideHeaderToggle && (
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
                showCompleted 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {showCompleted ? 'Showing Done' : 'Hidden Done'}
            </button>
          )}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="bg-white/10 text-white border border-white/20 text-xs sm:text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all" className="bg-[#0f111a] text-white">All Tasks, Reminders & Daily Journal</option>
            <option value="all_tasks" className="bg-[#0f111a] text-white">All Tasks</option>
            <option value="all_reminders" className="bg-[#0f111a] text-white">All Reminders</option>
            <option value="journal" className="bg-[#0f111a] text-white">All Daily Journal</option>
          </select>
          <button onClick={goToToday}
            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs sm:text-sm font-medium text-white hover:bg-white/10 transition-colors">
            Today
          </button>
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button onClick={() => setViewMode('month')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${viewMode === 'month' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}>
              Month
            </button>
            <button onClick={() => setViewMode('day')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${viewMode === 'day' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}>
              Day
            </button>
          </div>
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-2 border-b border-white/10 flex-shrink-0 flex-wrap min-h-[37px] transition-all duration-300">
        {Object.entries(STATUS_STYLES)
          .filter(([key]) => visibleLegendKeys.has(key))
          .map(([key, style]) => (
            <div 
              key={key} 
              onClick={() => handleLegendClick(key)}
              className={`flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200 rounded px-1.5 py-1 -ml-1.5 transition-colors ${viewMode === 'day' ? 'cursor-pointer hover:bg-white/10' : ''}`}
              title={viewMode === 'day' ? `Click to find the next ${style.label} event today` : ''}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${key === 'journal' ? 'bg-gradient-to-r from-amber-400 to-orange-400' : style.bg}`} />
              <span className="text-[10px] sm:text-xs text-white/70 font-medium select-none">{style.label}</span>
            </div>
          ))}
      </div>

      {/* ─── Month View ─── */}
      {viewMode === 'month' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 border-b border-white/10 flex-shrink-0">
            {WEEKDAYS_FULL.map(d => (
              <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-white/40 py-2 border-r border-white/5 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0">
            {calDays.map((day) => {
              const isCurrentMonth = day.getFullYear() === calMonthYear && day.getMonth() === calMonthMonth;
              const dateKey = formatDateKey(day);
              const isTodayDay = dateKey === todayKey;
              const events = eventsByDate.get(dateKey) || [];
              const maxVisible = numWeeks > 5 ? 1 : 2;
              const overflow = events.length - maxVisible;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={`border-r border-b border-white/5 p-0.5 sm:p-1 cursor-pointer transition-colors hover:bg-white/5 min-h-0 overflow-hidden
                    ${!isCurrentMonth ? 'opacity-30' : ''}
                  `}
                >
                  <div className="flex items-center justify-center mb-0.5 mt-1">
                    <span className={`text-[10px] sm:text-base font-medium sm:font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full
                      ${isTodayDay ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-white/80'}
                    `}>
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {events.slice(0, maxVisible).map(evt => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (evt.id.startsWith('hol-')) return;
                          setPreviewEvent(evt);
                        }}
                        className={`${evt.colorClass} ${evt.type === 'journal' ? 'text-slate-900 font-semibold' : 'text-white'} text-[8px] sm:text-[10px] leading-tight font-medium px-1 sm:px-1.5 py-0.5 rounded truncate hover:brightness-110 transition-all flex items-center gap-0.5`}
                      >
                        {evt.type === 'journal' && <BookOpen className="w-2 h-2 flex-shrink-0 hidden sm:inline-block" />}
                        {evt.type !== 'journal' && <span className="hidden sm:inline">{format(evt.time, 'h:mm ')} </span>}
                        {evt.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-[8px] sm:text-[10px] font-semibold text-white/60 px-1 sm:px-1.5">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state: journal filter active but no logs this month */}
      {viewMode === 'month' && filterMode === 'journal' && allEvents.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <BookOpen className="w-10 h-10 text-amber-400/40" />
          <p className="text-sm text-white/30 font-medium">No daily logs recorded this month</p>
          <p className="text-xs text-white/20">Navigate to another month or switch filters</p>
        </div>
      )}

      {/* ─── Day View ─── */}
      {viewMode === 'day' && (
        <div className="flex-1 flex min-h-0">
          {/* Mini calendar sidebar */}
          <div className="w-52 border-r border-white/10 p-3 flex-shrink-0 overflow-y-auto hidden lg:block">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading font-semibold text-white/90">{format(calMonth, 'MMMM yyyy')}</span>
                <div className="flex gap-0.5">
                  <button onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-0.5 rounded hover:bg-white/10 text-white/50"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-0.5 rounded hover:bg-white/10 text-white/50"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-semibold text-white/30 py-0.5">{d}</div>
                ))}
                {(() => {
                  const selectedKey = formatDateKey(selectedDate);
                  return calDays.map(day => {
                    const isCurrentMonth = day.getFullYear() === calMonthYear && day.getMonth() === calMonthMonth;
                    const dateKey = formatDateKey(day);
                    const isTodayDay = dateKey === todayKey;
                    const isSelected = dateKey === selectedKey;
                    const hasEvents = eventsByDate.has(dateKey);
                    return (
                      <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                        className={`relative w-full aspect-square flex items-center justify-center text-[10px] font-medium rounded-full transition-all
                          ${!isCurrentMonth ? 'text-white/15' : 'text-white/70'}
                          ${isTodayDay && !isSelected ? 'text-indigo-400 font-bold' : ''}
                          ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'hover:bg-white/10'}
                        `}>
                        {day.getDate()}
                        {hasEvents && !isSelected && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Day Summary</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Events</span>
                <span className="font-semibold text-white">{dayEvents.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Tasks</span>
                <span className="font-semibold text-white">{dayEvents.filter(e => e.type === 'task').length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Reminders</span>
                <span className="font-semibold text-white">{dayEvents.filter(e => e.type === 'reminder').length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Daily Journals</span>
                <span className="font-semibold text-white">{dayEvents.filter(e => e.type === 'journal').length}</span>
              </div>
            </div>
          </div>

          {/* Hourly time slots */}
          <div className="flex-1 overflow-y-auto">
            <div className="relative">
              {HOURS.map(hour => {
                const hourEvents = eventsByHour.get(hour) || [];
                return (
                  <div key={hour} id={`hour-row-${hour}`} className="flex border-b border-white/5 min-h-[48px] sm:min-h-[60px]">
                    <div className="w-12 sm:w-16 flex-shrink-0 pr-2 pt-0 text-right">
                      <span className="text-[10px] sm:text-[11px] text-white/40 font-medium -mt-2 block">
                        {formatHour(hour)}
                      </span>
                    </div>

                    <div 
                      className="flex-1 border-l border-white/10 pl-2 py-1 relative cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => {
                        setSelectedAddHour(hour);
                        setAddEventDialogOpen(true);
                      }}
                    >
                      {hourEvents.map(evt => (
                        <div
                          key={evt.id}
                           onClick={(e) => {
                             e.stopPropagation();
                             if (evt.id.startsWith('hol-')) return;
                             setPreviewEvent(evt);
                           }}
                          className={`${evt.colorClass} ${evt.type === 'journal' ? 'text-slate-900' : 'text-white'} rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 mb-1 cursor-pointer hover:brightness-110 transition-all`}
                        >
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {evt.title}
                          </p>
                          <p className="text-[10px] sm:text-[11px] opacity-80">
                            {format(evt.time, 'h:mm a')}
                            {evt.body && ` · ${evt.body}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Event Preview Dialog ─── */}
      <Dialog open={!!previewEvent} onOpenChange={(open: boolean) => !open && setPreviewEvent(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#0f111a] border-[#2a2e3d] rounded-2xl shadow-2xl text-white p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0f111a]">
            <DialogTitle className="text-white font-bold text-lg">{previewEvent?.title || "Event Details"}</DialogTitle>
            <DialogClose className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors" />
          </div>
          <div className="p-5 flex flex-col gap-4 overflow-y-auto min-h-0 custom-scrollbar max-h-[60vh]">
            <div className="text-sm text-white/50 font-medium flex items-center gap-2 shrink-0">
              <Clock className="w-4 h-4 text-indigo-400" />
              {previewEvent && format(previewEvent.time, "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 shrink-0">
              <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                {previewEvent?.body || (previewEvent?.type === 'task' ? 'This is a scheduled task that requires your attention.' : 'No description provided.')}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/5 bg-[#0f111a]">
            <Button 
              variant="outline" 
              onClick={() => setPreviewEvent(null)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              Close
            </Button>
            <Button onClick={() => {
              if (!previewEvent) return;
              if (previewEvent.type === 'reminder') {
                 navigate(`/tasks/reminders?view=${previewEvent.id}`);
              } else if (previewEvent.type === 'journal') {
                 navigate(`/daily-journal?date=${format(previewEvent.time, 'yyyy-MM-dd')}`);
              } else if (previewEvent.isMain) {
                 navigate(`/tasks?openTask=${previewEvent.id}`);
              } else {
                 navigate(`/tasks?open=${previewEvent.id}`);
              }
              setPreviewEvent(null);
              onNavigate?.();
            }} className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border-0 font-medium">
              Go to {previewEvent?.type === 'reminder' ? 'Reminder' : previewEvent?.type === 'journal' ? 'Journal' : 'Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Event Dialog ─── */}
      <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-[#0f111a] border-[#2a2e3d] rounded-2xl shadow-2xl text-white p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#0f111a]">
            <DialogTitle className="text-white font-bold text-lg">Add New</DialogTitle>
            <DialogClose className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors" />
          </div>
          <div className="p-5 flex flex-col gap-3">
            <p className="text-sm text-white/60 mb-3">
              What would you like to add for <span className="font-semibold text-white/90">{selectedAddHour !== null ? formatHour(selectedAddHour) : ''}</span> on <span className="font-semibold text-white/90">{format(selectedDate, 'MMM d, yyyy')}</span>?
            </p>
            <button
              onClick={() => {
                setAddEventDialogOpen(false);
                setShowCreateTask(true);
              }}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#1a1d27] hover:bg-[#232736] transition-colors border border-white/5 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2a2e3d] group-hover:bg-[#34394c] flex items-center justify-center shrink-0 transition-colors">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Task</p>
                <p className="text-xs text-white/50 mt-0.5">Create a new task or project</p>
              </div>
            </button>
            <button
              onClick={() => {
                setAddEventDialogOpen(false);
                setShowCreateReminder(true);
              }}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#1a1d27] hover:bg-[#232736] transition-colors border border-white/5 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2a2e3d] group-hover:bg-[#34394c] flex items-center justify-center shrink-0 transition-colors">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Reminder</p>
                <p className="text-xs text-white/50 mt-0.5">Set a timely notification</p>
              </div>
            </button>
            <button
              onClick={() => {
                setAddEventDialogOpen(false);
                setShowCreateDailyJournal(true);
              }}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#1a1d27] hover:bg-[#232736] transition-colors border border-white/5 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2a2e3d] group-hover:bg-[#34394c] flex items-center justify-center shrink-0 transition-colors">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Daily Journal</p>
                <p className="text-xs text-white/50 mt-0.5">Log an entry for this day</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Inline Create Task Dialog ─── */}
      {showCreateTask && (
        <CreateTaskDialog
          onClose={() => setShowCreateTask(false)}
          users={users}
          currentUserId={currentUser?.id ?? ''}
          teamId='dcel-team'
          workspaceId='dcel-team'
          initialDeadline={format(selectedDate, 'yyyy-MM-dd')}
          initialDeadlineTime={selectedAddHour !== null ? `${String(selectedAddHour).padStart(2, '0')}:00` : ''}
          isDarkTheme={true}
        />
      )}

      {/* ─── Inline Create Reminder Dialog ─── */}
      {showCreateReminder && (
        <CreateReminderDialog
          onClose={() => setShowCreateReminder(false)}
          initialDateTime={`${format(selectedDate, 'yyyy-MM-dd')}T${selectedAddHour !== null ? String(selectedAddHour).padStart(2, '0') : '12'}:00`}
        />
      )}

      {/* ─── Inline Create Daily Journal Dialog ─── */}
      {showCreateDailyJournal && (
        <CreateDailyJournalDialog
          onClose={() => setShowCreateDailyJournal(false)}
          initialDate={format(selectedDate, 'yyyy-MM-dd')}
        />
      )}
    </div>
  );
}

