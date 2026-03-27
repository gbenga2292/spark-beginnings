import { useState, useMemo } from 'react';
import {
  format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameMonth,
  isBefore, startOfDay
} from 'date-fns';
import {
  Bell, ChevronLeft, ChevronRight, ArrowLeft, CheckSquare,
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogFooter } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';

const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
    label: 'Not Started',
    icon: CheckSquare,
  },
  reminder: {
    bg: 'bg-purple-600',
    label: 'Reminders',
    icon: Bell,
  },
};

type ViewMode = 'month' | 'day';
type FilterMode = 'all' | 'mine';

interface CalendarEvent {
  id: string;
  title: string;
  time: Date;
  type: 'task' | 'reminder';
  status?: string;
  body?: string;
  colorClass: string;
  isMain?: boolean;
}

export default function CalendarPage({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { user: currentUser } = useAuth();
  const { reminders, mainTasks, subtasks } = useAppData();
  const navigate = useNavigate();

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const now = new Date();
    const today = startOfDay(now);

    // Subtasks
    const relevantSubtasks = filterMode === 'all'
      ? subtasks.filter(s => s.deadline)
      : subtasks.filter(s => s.deadline && s.assignedTo?.includes(currentUser?.id as string));

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
      });
    });

    // Main tasks
    const relevantMainTasks = filterMode === 'all'
      ? mainTasks.filter(m => m.deadline)
      : mainTasks.filter(m => m.deadline && (m.assignedTo?.includes(currentUser?.id as string) || m.createdBy === currentUser?.id));

    relevantMainTasks.forEach(m => {
      const deadline = new Date(m.deadline!);
      
      // Calculate main task status based on subtasks
      const taskSubs = subtasks.filter(s => s.main_task_id === m.id || s.mainTaskId === m.id);
      let mStatus = 'not_started';
      if (taskSubs.length > 0) {
        if (taskSubs.every(s => s.status === 'completed')) mStatus = 'completed';
        else if (taskSubs.some(s => s.status === 'in_progress' || s.status === 'completed' || s.status === 'pending_approval')) mStatus = 'in_progress';
      }

      const isOverdue = mStatus !== 'completed' && isBefore(deadline, today);
      const statusKey = mStatus === 'completed' ? 'completed' : (isOverdue ? 'overdue' : mStatus);
      
      const style = STATUS_STYLES[statusKey] || STATUS_STYLES.not_started;

      events.push({
        id: m.id, title: m.title, time: deadline,
        type: 'task', status: mStatus, colorClass: style.bg,
        isMain: true,
      });
    });

    // Reminders
    const relevantReminders = filterMode === 'all'
      ? reminders.filter(r => r.isActive)
      : reminders.filter(r => {
          if (!r.isActive) return false;
          return r.recipientIds?.includes(currentUser?.id ?? '') || r.createdBy === currentUser?.id;
        });

    relevantReminders.forEach(r => {
      events.push({
        id: r.id, title: r.title, time: parseISO(r.remindAt),
        type: 'reminder', body: r.body, colorClass: STATUS_STYLES.reminder.bg,
      });
    });

    return events;
  }, [reminders, subtasks, mainTasks, currentUser, filterMode]);


  const calDays = useMemo(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [calMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    allEvents.forEach(e => {
      const key = format(e.time, 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [allEvents]);

  const dayEvents = useMemo(() => {
    return allEvents.filter(e => isSameDay(e.time, selectedDate))
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
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="bg-white/10 text-white border border-white/20 text-xs sm:text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all" className="bg-[#0f111a] text-white">All Tasks & Reminders</option>
            <option value="mine" className="bg-[#0f111a] text-white">My Tasks & Reminders</option>
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
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-2 border-b border-white/10 flex-shrink-0 flex-wrap">
        {Object.entries(STATUS_STYLES).map(([key, style]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${style.bg}`} />
            <span className="text-[10px] sm:text-xs text-white/70 font-medium">{style.label}</span>
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
              const isCurrentMonth = isSameMonth(day, calMonth);
              const isTodayDay = isToday(day);
              const dateKey = format(day, 'yyyy-MM-dd');
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
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {events.slice(0, maxVisible).map(evt => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (evt.type === 'reminder') {
                            navigate(`/tasks/reminders?view=${evt.id}`);
                          } else if (evt.isMain) {
                            navigate(`/tasks?openTask=${evt.id}`);
                          } else {
                            navigate(`/tasks?open=${evt.id}`);
                          }
                          onNavigate?.();
                        }}
                        className={`${evt.colorClass} text-white text-[8px] sm:text-[10px] leading-tight font-medium px-1 sm:px-1.5 py-0.5 rounded truncate hover:brightness-110 transition-all`}
                      >
                        <span className="hidden sm:inline">{format(evt.time, 'h:mm ')} </span>
                        {evt.type === 'reminder' ? 'ðŸ”” ' : ''}
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
                {calDays.map(day => {
                  const isCurrentMonth = isSameMonth(day, calMonth);
                  const isTodayDay = isToday(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const hasEvents = eventsByDate.has(dateKey);
                  return (
                    <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                      className={`relative w-full aspect-square flex items-center justify-center text-[10px] font-medium rounded-full transition-all
                        ${!isCurrentMonth ? 'text-white/15' : 'text-white/70'}
                        ${isTodayDay && !isSelected ? 'text-indigo-400 font-bold' : ''}
                        ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'hover:bg-white/10'}
                      `}>
                      {format(day, 'd')}
                      {hasEvents && !isSelected && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  );
                })}
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
            </div>
          </div>

          {/* Hourly time slots */}
          <div className="flex-1 overflow-y-auto">
            <div className="relative">
              {HOURS.map(hour => {
                const hourEvents = eventsByHour.get(hour) || [];
                return (
                  <div key={hour} className="flex border-b border-white/5 min-h-[48px] sm:min-h-[60px]">
                    <div className="w-12 sm:w-16 flex-shrink-0 pr-2 pt-0 text-right">
                      <span className="text-[10px] sm:text-[11px] text-white/40 font-medium -mt-2 block">
                        {formatHour(hour)}
                      </span>
                    </div>

                    <div className="flex-1 border-l border-white/10 pl-2 py-1 relative">
                      {hourEvents.map(evt => (
                        <div
                          key={evt.id}
                          onClick={() => {
                            if (evt.type === 'reminder') {
                              navigate(`/tasks/reminders?view=${evt.id}`);
                            } else if (evt.isMain) {
                              navigate(`/tasks?openTask=${evt.id}`);
                            } else {
                              navigate(`/tasks?open=${evt.id}`);
                            }
                            onNavigate?.();
                          }}
                          className={`${evt.colorClass} text-white rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 mb-1 cursor-pointer hover:brightness-110 transition-all`}
                        >
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {evt.type === 'reminder' ? 'ðŸ”” ' : ''}{evt.title}
                          </p>
                          <p className="text-[10px] sm:text-[11px] opacity-80">
                            {format(evt.time, 'h:mm a')}
                            {evt.body && ` Â· ${evt.body}`}
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
      <Dialog 
        open={!!previewEvent} 
        onClose={() => setPreviewEvent(null)}
        title={previewEvent?.title || "Event Details"}
      >
        <div className="py-2">
           <div className="mb-4 text-sm text-slate-500 font-medium">
             {previewEvent && format(previewEvent.time, "EEEE, MMMM d, yyyy 'at' h:mm a")}
           </div>
           <p className="text-sm text-slate-700 dark:text-slate-300">
             {previewEvent?.body || (previewEvent?.type === 'task' ? 'This is a scheduled task that requires your attention.' : 'No description provided.')}
           </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPreviewEvent(null)}>Close</Button>
          <Button onClick={() => {
            if (!previewEvent) return;
            if (previewEvent.type === 'reminder') {
               navigate(`/tasks/reminders?view=${previewEvent.id}`);
            } else if (previewEvent.isMain) {
               navigate(`/tasks?openTask=${previewEvent.id}`);
            } else {
               navigate(`/tasks?open=${previewEvent.id}`);
            }
            setPreviewEvent(null);
            onNavigate?.();
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-0 font-medium ml-2">
            Go to {previewEvent?.type === 'reminder' ? 'Reminder' : 'Task'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

