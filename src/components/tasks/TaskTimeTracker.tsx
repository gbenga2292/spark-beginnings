import React, { useState, useMemo } from 'react';
import { 
  Clock, Plus, Trash2, User, Calendar, FileText, CheckCircle2, ChevronDown, 
  ChevronUp, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useTheme } from '@/src/hooks/useTheme';
import { format } from 'date-fns';
import type { TaskTimeEntry, AppUser } from '@/src/types/tasks';

interface TaskTimeTrackerProps {
  taskId: string;            // subtaskId or mainTaskId
  isMainTask?: boolean;
  users: AppUser[];
  className?: string;
}

// Palette of distinct, harmonious colors for user progress segments
const USER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', pill: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', pill: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', pill: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800' },
  { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', pill: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800' },
  { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', pill: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', pill: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800' },
];

export function TaskTimeTracker({ taskId, isMainTask = false, users, className = '' }: TaskTimeTrackerProps) {
  const { user } = useAuth();
  const { timeEntries, addTimeEntry, deleteTimeEntry } = useAppData();
  const { isDark } = useTheme();

  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);

  // Filter entries for this specific task
  const relevantEntries = useMemo(() => {
    return timeEntries.filter(entry => 
      isMainTask ? entry.mainTaskId === taskId : (entry.subtaskId === taskId || entry.mainTaskId === taskId)
    );
  }, [timeEntries, taskId, isMainTask]);

  // O(1) user lookup map
  const usersMap = useMemo(() => {
    const map = new Map<string, AppUser>();
    if (users) {
      for (let i = 0; i < users.length; i++) {
        map.set(users[i].id, users[i]);
      }
    }
    return map;
  }, [users]);

  // Aggregate total hours and breakdown per user
  const { totalHours, userBreakdown } = useMemo(() => {
    let total = 0;
    const byUser: Record<string, { hours: number; userObj?: AppUser }> = {};

    for (let i = 0; i < relevantEntries.length; i++) {
      const entry = relevantEntries[i];
      const h = Number(entry.hours) || 0;
      total += h;
      if (!byUser[entry.userId]) {
        byUser[entry.userId] = { hours: 0, userObj: usersMap.get(entry.userId) };
      }
      byUser[entry.userId].hours += h;
    }

    // Array of user contributions with percentage
    const breakdown = Object.entries(byUser).map(([userId, data], index) => {
      const percentage = total > 0 ? (data.hours / total) * 100 : 0;
      const colorScheme = USER_COLORS[index % USER_COLORS.length];
      return {
        userId,
        userName: data.userObj?.name || 'Unknown Member',
        hours: data.hours,
        percentage,
        colorScheme,
      };
    }).sort((a, b) => b.hours - a.hours);

    return { totalHours: total, userBreakdown: breakdown };
  }, [relevantEntries, usersMap]);

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) return;
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      await addTimeEntry({
        subtaskId: isMainTask ? undefined : taskId,
        mainTaskId: isMainTask ? taskId : undefined,
        userId: user.id,
        hours: numHours,
        description: description.trim(),
        date: date || format(new Date(), 'yyyy-MM-dd'),
      });
      setHours('');
      setDescription('');
      setShowLogForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
    } ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Time Logged & Progression
            </h4>
            <p className="text-[11px] text-slate-500">
              User-by-user workload contribution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {totalHours.toFixed(1)} hrs total
          </span>
          <button
            type="button"
            onClick={() => setShowLogForm(!showLogForm)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {showLogForm ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showLogForm ? 'Hide Form' : 'Log Time'}
          </button>
        </div>
      </div>

      {/* Proportional Stacked Progress Bar */}
      <div className="space-y-2 mb-4">
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
          {totalHours === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 font-medium italic">
              No hours logged yet
            </div>
          ) : (
            userBreakdown.map(item => (
              <div
                key={item.userId}
                className={`${item.colorScheme.bg} h-full transition-all relative group`}
                style={{ width: `${item.percentage}%` }}
                title={`${item.userName}: ${item.hours.toFixed(1)} hrs (${item.percentage.toFixed(1)}%)`}
              />
            ))
          )}
        </div>

        {/* User Breakdown Legend Chips */}
        {userBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {userBreakdown.map(item => (
              <div
                key={item.userId}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md border font-medium ${item.colorScheme.pill}`}
              >
                <span className={`w-2 h-2 rounded-full ${item.colorScheme.bg}`} />
                <span className="text-slate-700 dark:text-slate-200 font-semibold">{item.userName}:</span>
                <span className={item.colorScheme.text}>
                  {item.hours.toFixed(1)}h ({item.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Time Form */}
      {showLogForm && (
        <form onSubmit={handleLogTime} className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 mb-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-indigo-500" /> Log Time on Task
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Hours Spent *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                placeholder="e.g. 1.5"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Activity Summary / Notes
            </label>
            <input
              type="text"
              placeholder="What did you work on? (e.g. Reviewing specs, testing build)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowLogForm(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hours}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving…' : 'Record Hours'}
            </button>
          </div>
        </form>
      )}

      {/* Logged Entries List */}
      {relevantEntries.length > 0 ? (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">
            Logged Entries ({relevantEntries.length})
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {relevantEntries.map(entry => {
              const author = users.find(u => u.id === entry.userId);
              const isAuthor = user?.id === entry.userId;
              const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'co-admin';

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 dark:bg-slate-800/30 border border-slate-150 dark:border-slate-800 text-xs"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {(author?.name || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                          {author?.name || 'Unknown'}
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                          +{Number(entry.hours).toFixed(1)} hrs
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {entry.date ? format(new Date(entry.date), 'MMM d') : ''}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {(isAuthor || isAdmin) && (
                    <button
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors ml-2"
                      title="Delete time entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2 italic">
          No individual hours recorded for this task yet.
        </p>
      )}
    </div>
  );
}
