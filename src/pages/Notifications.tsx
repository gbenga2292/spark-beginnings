import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertCircle, CalendarClock, Users, MapPin, Wallet, FileText, Landmark,
  UserPlus, ShieldCheck, Clock, AtSign, CheckCircle, ChevronRight, Trash2, Filter,
  BellOff, BellRing
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { format } from 'date-fns';

type Notif = {
  id: string; icon: any; text: string; time: string; color: string;
  bg: string; url?: string; priority: number; category: string; isRead?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
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
  const { updateReminder, reminders, subtasks } = useAppData();
  const {
    employees, attendanceRecords, leaves, pendingInvoices, invoices,
    salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs,
  } = useAppStore();

  const currentUser = useUserStore(s => s.getCurrentUser());
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const notifications = useMemo<Notif[]>(() => {
    const notifs: Notif[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const isWithinDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr);
      const diffHrs = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHrs >= 0 && diffHrs <= days * 24;
    };
    const isPastOrToday = (dateStr: string) => dateStr <= todayStr;

    // 1. Reminders (all active ones for current user — no 24-hr cap)
    reminders.filter(r => {
      if (!r.isActive) return false;
      if (currentUser && r.recipientIds && r.recipientIds.length > 0 && !r.recipientIds.includes(currentUser.id)) return false;
      return true;
    }).forEach(r => {
      const isMention = r.title?.startsWith('Mentioned');
      const isNewTask = r.title === 'New Task Created';
      const remDate = new Date(r.remindAt);
      const isPast = remDate < now;
      
      if (isMention) {
        notifs.push({
          id: `rem-${r.id}`, icon: AtSign, text: r.body || r.title,
          time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
          color: 'text-indigo-500', bg: 'bg-indigo-50',
          url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
          priority: 1, category: 'mention',
        });
      } else if (isNewTask) {
        notifs.push({
          id: `rem-${r.id}`, icon: FileText, text: `New Task: ${r.body || 'Task'}`,
          time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
          color: 'text-emerald-500', bg: 'bg-emerald-50',
          url: r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
          priority: 2, category: 'system',
        });
      } else {
        notifs.push({
          id: `rem-${r.id}`, icon: isPast ? AlertCircle : BellRing,
          text: `Reminder: ${r.title}`,
          time: isPast ? 'Overdue' : format(remDate, 'MMM d, h:mm a'),
          color: isPast ? 'text-rose-500' : 'text-indigo-500',
          bg: isPast ? 'bg-rose-50' : 'bg-indigo-50',
          url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : '/tasks/reminders',
          priority: isPast ? 0 : 2, category: 'reminder',
        });
      }
    });

    // 2. Leave Approvals
    leaves.filter(l => l.approvalStatus === 'Pending' && l.status !== 'Cancelled').forEach(l => {
      notifs.push({ id: `leave-${l.id}`, icon: CalendarClock, text: `Leave Request pending: ${l.employeeName}`, time: l.startDate, color: 'text-amber-600', bg: 'bg-amber-50', url: '/leaves', priority: 2, category: 'approval' });
    });
    salaryAdvances.filter(s => s.status === 'Pending').forEach(s => {
      notifs.push({ id: `adv-${s.id}`, icon: Wallet, text: `Salary Advance pending: ${s.employeeName}`, time: s.requestDate, color: 'text-amber-600', bg: 'bg-amber-50', url: '/salary-loans', priority: 2, category: 'approval' });
    });
    loans.filter(l => l.status === 'Pending').forEach(l => {
      notifs.push({ id: `loan-${l.id}`, icon: Landmark, text: `Loan Request pending: ${l.employeeName}`, time: l.startDate, color: 'text-amber-600', bg: 'bg-amber-50', url: '/salary-loans', priority: 2, category: 'approval' });
    });

    // 3. Finance
    invoices.filter(i => i.status === 'Overdue').forEach(i => {
      notifs.push({ id: `inv-ov-${i.id}`, icon: FileText, text: `Overdue Invoice: ${i.invoiceNumber}`, time: i.dueDate, color: 'text-rose-600', bg: 'bg-rose-50', url: '/client-accounts', priority: 0, category: 'finance' });
    });
    if (pendingInvoices.length > 0) {
      notifs.push({ id: 'pending-inv', icon: FileText, text: `${pendingInvoices.length} pending invoices to draft`, time: 'Now', color: 'text-blue-500', bg: 'bg-blue-50', url: '/client-accounts', priority: 3, category: 'finance' });
    }

    // 4. HR Alerts
    employees.filter(e => e.status === 'Active' && e.lashmaExpiryDate && isWithinDays(e.lashmaExpiryDate, 7)).forEach(e => {
      notifs.push({ id: `lashma-${e.id}`, icon: ShieldCheck, text: `LASHMA Expiring Soon: ${e.firstname} ${e.surname}`, time: e.lashmaExpiryDate!, color: 'text-amber-600', bg: 'bg-amber-50', url: '/tasks/reminders', priority: 1, category: 'hr' });
    });
    employees.filter(e => e.status === 'Active' && e.lashmaExpiryDate && isPastOrToday(e.lashmaExpiryDate)).forEach(e => {
      notifs.push({ id: `lashma-overdue-${e.id}`, icon: ShieldCheck, text: `LASHMA Expired: ${e.firstname} ${e.surname} — renew immediately`, time: e.lashmaExpiryDate!, color: 'text-rose-600', bg: 'bg-rose-50', url: '/tasks/reminders', priority: 0, category: 'hr' });
    });
    commLogs.filter(c => c.followUpDate && !c.followUpDone && isPastOrToday(c.followUpDate)).forEach(c => {
      notifs.push({ id: `comm-${c.id}`, icon: Clock, text: `Follow-up due: ${c.subject || 'Communication'}`, time: c.followUpDate!, color: 'text-indigo-400', bg: 'bg-indigo-50', url: '/sites', priority: 2, category: 'hr' });
    });
    sites.filter(s => s.status === 'Active' && s.endDate && isWithinDays(s.endDate, 7)).forEach(s => {
      notifs.push({ id: `site-end-${s.id}`, icon: MapPin, text: `Site ending soon: ${s.name}`, time: s.endDate!, color: 'text-rose-400', bg: 'bg-rose-50', url: '/sites', priority: 1, category: 'hr' });
    });
    evaluations.filter(e => e.status === 'Review').forEach(e => {
      const emp = employees.find(em => em.id === e.employeeId);
      notifs.push({ id: `eval-${e.id}`, icon: Users, text: `Eval review: ${emp ? emp.surname : 'Employee'}`, time: e.date, color: 'text-emerald-500', bg: 'bg-emerald-50', url: '/evaluations', priority: 3, category: 'hr' });
    });
    disciplinaryRecords.filter(d => d.workflowState === 'Reported' || d.workflowState === 'Query Issued').forEach(d => {
      const emp = employees.find(em => em.id === d.employeeId);
      notifs.push({ id: `disc-${d.id}`, icon: ShieldCheck, text: `Disciplinary action: ${emp ? emp.surname : 'Employee'}`, time: d.date, color: 'text-rose-500', bg: 'bg-rose-50', url: '/performance-conduct', priority: 0, category: 'hr' });
    });
    employees.filter(e => e.status === 'Active' && e.startDate && e.probationPeriod).forEach(e => {
      const start = new Date(e.startDate);
      const end = new Date(start.getTime() + e.probationPeriod! * 86400000);
      const endStr = end.toISOString().split('T')[0];
      if (isWithinDays(endStr, 14)) {
        notifs.push({ id: `prob-${e.id}`, icon: Users, text: `Probation ending: ${e.firstname} ${e.surname}`, time: endStr, color: 'text-indigo-400', bg: 'bg-indigo-50', url: '/employees', priority: 3, category: 'hr' });
      }
    });

    // 4b. Subtask deadline alerts (for tasks assigned to current user)
    const mySubtasks = subtasks.filter(s =>
      s.status !== 'completed' && s.deadline &&
      (currentUser && (s.assignedTo === currentUser.id || s.assigned_to === currentUser.id))
    );
    mySubtasks.forEach(s => {
      if (isPastOrToday(s.deadline.split('T')[0])) {
        notifs.push({ id: `sub-overdue-${s.id}`, icon: AlertCircle, text: `Overdue subtask: ${s.title}`, time: s.deadline, color: 'text-rose-600', bg: 'bg-rose-50', url: `/tasks?open=${s.id}`, priority: 0, category: 'reminder' });
      } else if (isWithinDays(s.deadline.split('T')[0], 1)) {
        notifs.push({ id: `sub-due-${s.id}`, icon: Clock, text: `Due tomorrow: ${s.title}`, time: s.deadline, color: 'text-amber-600', bg: 'bg-amber-50', url: `/tasks?open=${s.id}`, priority: 1, category: 'reminder' });
      }
    });

    // 5. System
    const onboardingEmps = employees.filter(e => e.status === 'Onboarding');
    if (onboardingEmps.length > 0) {
      notifs.push({ id: 'onboarding-counts', icon: UserPlus, text: `${onboardingEmps.length} staff currently onboarding`, time: 'Ongoing', color: 'text-emerald-500', bg: 'bg-emerald-50', url: '/onboarding', priority: 4, category: 'system' });
    }
    const dates = [...new Set(attendanceRecords.map(r => r.date))].sort().reverse();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const count = attendanceRecords.filter(r => r.date === latestDate).length;
      notifs.push({ id: `att-${latestDate}`, icon: CalendarClock, text: `${count} attendance records for ${latestDate}`, time: latestDate, color: 'text-slate-500', bg: 'bg-slate-50', priority: 5, category: 'system' });
    }

    return notifs.sort((a, b) => a.priority - b.priority);
  }, [employees, attendanceRecords, leaves, pendingInvoices, invoices, salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs, reminders, currentUser]);

  const filtered = notifications.filter(n =>
    !dismissed.has(n.id) && (activeCategory === 'all' || n.category === activeCategory)
  );

  const handleDismiss = (n: Notif, e: React.MouseEvent) => {
    e.stopPropagation();
    if (n.id.startsWith('rem-')) {
      updateReminder(n.id.replace('rem-', ''), { isActive: false });
    }
    setDismissed(prev => new Set(prev).add(n.id));
  };

  const handleAction = (n: Notif) => {
    if (n.id.startsWith('rem-')) {
      updateReminder(n.id.replace('rem-', ''), { isActive: false });
    }
    if (n.url) navigate(n.url);
  };

  const priorityLabel = (p: number) => {
    if (p === 0) return { label: 'Urgent', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (p === 1) return { label: 'High', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (p === 2) return { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    return { label: 'Info', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    notifications.filter(n => !dismissed.has(n.id)).forEach(n => {
      counts['all'] = (counts['all'] || 0) + 1;
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [notifications, dismissed]);

  return (
    <div className="flex flex-col gap-6 w-full pb-12 animate-in fade-in duration-300">
      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500">{filtered.length} active notification{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {dismissed.size < notifications.length && (
            <button
              onClick={() => {
                const active = notifications.filter(n => !dismissed.has(n.id));
                active.filter(n => n.id.startsWith('rem-')).forEach(n => {
                  updateReminder(n.id.replace('rem-', ''), { isActive: false });
                });
                setDismissed(new Set(notifications.map(n => n.id)));
              }}
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
                    ? 'bg-indigo-600 text-white shadow-sm'
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
                  className={`group flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${n.url ? 'cursor-pointer hover:border-indigo-200' : ''}`}
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
                          onClick={e => handleDismiss(n, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Dismiss"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1 leading-snug">{n.text}</p>
                    {n.url && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-indigo-500 font-bold group-hover:gap-2 transition-all">
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
