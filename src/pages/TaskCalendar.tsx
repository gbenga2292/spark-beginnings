import { useState, useMemo } from 'react';
import {
  format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameMonth,
} from 'date-fns';
import {
  Bell, ChevronLeft, ChevronRight, ArrowLeft, CheckSquare,
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useNavigate } from 'react-router-dom';

const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EVENT_TYPE_STYLES = {
  reminder: {
    bg: 'bg-[hsl(270,50%,55%)]',
    label: 'Reminders',
    icon: Bell,
  },
  task: {
    bg: 'bg-[hsl(217,89%,51%)]',
    label: 'Tasks (Subtasks)',
    icon: CheckSquare,
  },
  main: {
    bg: 'bg-[hsl(148,72%,37%)]',
    label: 'Main Tasks',
    icon: CheckSquare,
  },
};

type ViewMode = 'month' | 'day';

interface CalendarEvent {
  id: string;
  title: string;
  time: Date;
  type: 'task' | 'reminder';
  status?: string;
  body?: string;
  colorKey: 'reminder' | 'task' | 'main';
}

export default function CalendarPage() {
  const { user: currentUser } = useAuth();
  const { reminders, mainTasks, subtasks } = useAppData();
  const navigate = useNavigate();

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const activeWsId = currentUser?.activeWorkspaceId;

    if (!activeWsId) return events;

    // Filter main tasks by active workspace
    const wsMainTasks = mainTasks.filter(m => m.workspaceId === activeWsId);
    // Filter subtasks by those belonging to active workspace's main tasks
    const wsSubtasks = subtasks.filter(s => wsMainTasks.some(m => m.id === s.mainTaskId));

    const myReminders = reminders.filter(r => {
      if (!r.isActive || (!r.recipientIds.includes(currentUser?.id ?? '') && r.createdBy !== currentUser?.id)) return false;
      // If reminder is attached to a task/subtask, ensure it belongs to the active workspace
      if (r.subtaskId) return wsSubtasks.some(s => s.id === r.subtaskId);
      if (r.mainTaskId) return wsMainTasks.some(m => m.id === r.mainTaskId);
      // If it's a floating reminder (no task attached), it's global/personal, we can show it or maybe filter it out?
      // For now, let's only show reminders tied to this workspace, or floating ones if personal workspace
      const currentWsType = currentUser?.workspaceIds.length === 1 ? 'personal' : 'team'; // Roughly, just allow if no task attached.
      return true;
    });

    myReminders.forEach(r => {
      events.push({
        id: r.id, title: r.title, time: parseISO(r.remindAt),
        type: 'reminder', body: r.body, colorKey: 'reminder',
      });
    });

    wsSubtasks.filter(s => s.deadline && s.assignedTo === currentUser?.id).forEach(s => {
      events.push({
        id: s.id, title: s.title, time: new Date(s.deadline!),
        type: 'task', status: s.status, colorKey: 'task',
      });
    });

    wsMainTasks.filter(m => m.deadline).forEach(m => {
      events.push({
        id: m.id, title: m.title, time: new Date(m.deadline!),
        type: 'task', status: 'main', colorKey: 'main',
      });
    });

    return events;
  }, [reminders, subtasks, mainTasks, currentUser]);

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
      {/* â”€â”€â”€ Top Bar â”€â”€â”€ */}
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

      {/* â”€â”€â”€ Legend â”€â”€â”€ */}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-2 border-b border-white/10 flex-shrink-0 flex-wrap">
        {Object.entries(EVENT_TYPE_STYLES).map(([key, style]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${style.bg}`} />
            <span className="text-[10px] sm:text-xs text-white/70 font-medium">{style.label}</span>
          </div>
        ))}
      </div>

      {/* â”€â”€â”€ Month View â”€â”€â”€ */}
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
                    <span className={`text-[10px] sm:text-base font-medium sm:font-bold w-5 h-5 sm:w-8 sm:h-8 flex items-center justify-center rounded-full
                      ${isTodayDay ? 'bg-primary text-primary-foreground' : 'text-white/80'}
                    `}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {events.slice(0, maxVisible).map(evt => (
                      <div
                        key={evt.id}
                        className={`${EVENT_TYPE_STYLES[evt.colorKey].bg} text-white text-[8px] sm:text-[10px] leading-tight font-medium px-1 sm:px-1.5 py-0.5 rounded truncate`}
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

      {/* â”€â”€â”€ Day View â”€â”€â”€ */}
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
                        ${isTodayDay && !isSelected ? 'text-primary font-bold' : ''}
                        ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10'}
                      `}>
                      {format(day, 'd')}
                      {hasEvents && !isSelected && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
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
                            if (evt.type === 'reminder') navigate('/reminders');
                            else navigate('/tasks');
                          }}
                          className={`${EVENT_TYPE_STYLES[evt.colorKey].bg} text-white rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 mb-1 cursor-pointer hover:brightness-110 transition-all`}
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
    </div>
  );
}

