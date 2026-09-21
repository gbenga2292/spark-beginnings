import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, Trash2, Filter, BellOff, CheckCircle
} from 'lucide-react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useSystemAlerts, SystemAlert } from '@/src/hooks/useSystemAlerts';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  operations: 'Diesel & Ops',
  mention: 'Mentions',
  reminder: 'Reminders',
  approval: 'Approvals',
  finance: 'Finance',
  hr: 'HR',
  system: 'System',
};

export function NotificationsPage() {
  useSetPageTitle('Notifications', 'All notifications and alerts');
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const {
    alerts,
    activeAlerts,
    dismissedNotifications,
    handleDismiss,
    handleDismissAll
  } = useSystemAlerts();

  const filtered = useMemo(() => {
    return activeAlerts.filter(
      (n) => activeCategory === 'all' || n.category === activeCategory
    );
  }, [activeAlerts, activeCategory]);

  const onDismissClick = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    handleDismiss(id);
  };

  const handleAction = (n: SystemAlert) => {
    if (n.id.startsWith('rem-')) {
      handleDismiss(n.id);
    }
    if (n.url) navigate(n.url);
  };

  const priorityLabel = (p: number) => {
    if (p === 0) return { label: 'Urgent', cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40' };
    if (p === 1) return { label: 'High', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40' };
    if (p === 2) return { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40' };
    return { label: 'Info', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activeAlerts.length };
    activeAlerts.forEach((n) => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [activeAlerts]);

  return (
    <div className="flex flex-col gap-6 w-full pb-12 animate-in fade-in duration-300">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500">{filtered.length} active notification{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {activeAlerts.length > 0 && (
            <button
              onClick={handleDismissAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50"
            >
              <BellOff className="w-3.5 h-3.5" /> Dismiss All
            </button>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = categoryCounts[key] || 0;
            if (key !== 'all' && count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    activeCategory === key ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="w-full">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-slate-700">All clear!</p>
            <p className="text-sm text-slate-400 mt-1">No notifications in this category.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map(n => {
              const badge = priorityLabel(n.priority);
              return (
                <div
                  key={n.id}
                  onClick={() => handleAction(n)}
                  className={`group flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${n.url ? 'cursor-pointer hover:border-blue-200' : ''}`}
                >
                  {/* Priority bar */}
                  {n.priority <= 1 && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${n.priority === 0 ? 'bg-rose-500' : 'bg-amber-400'}`} />
                  )}

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${n.bg} ${n.color} shadow-sm`}>
                    <n.icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 capitalize">{CATEGORY_LABELS[n.category]}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {n.time.includes('-') ? formatDisplayDate(n.time) : n.time}
                        </span>
                        <button
                          onClick={e => onDismissClick(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Dismiss"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1 leading-snug">{n.text}</p>
                    {n.url && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 font-bold group-hover:gap-2 transition-all">
                        Take Action <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
