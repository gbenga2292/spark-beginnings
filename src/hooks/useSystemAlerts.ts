import { useMemo, useCallback } from 'react';
import { 
  Bell, AlertCircle, CalendarClock, Users, MapPin, Wallet, FileText, 
  Landmark, UserPlus, ShieldCheck, Clock, AtSign, CheckCircle2, BellRing,
  Fuel, Receipt
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore } from '@/src/store/userStore';
import { useAuthStore } from '@/src/store/auth';
import { useRefillForecast } from '@/src/hooks/useRefillForecast';
import { useActiveSiteInvoices } from '@/src/hooks/useActiveSiteInvoices';
import { format } from 'date-fns';

export type SystemAlertPriority = 0 | 1 | 2 | 3 | 4 | 5;

export type SystemAlertCategory = 
  | 'mention' 
  | 'reminder' 
  | 'approval' 
  | 'finance' 
  | 'hr' 
  | 'operations'
  | 'system';

export interface SystemAlert {
  id: string;
  icon: any;
  text: string;
  time: string;
  color: string;
  bg: string;
  url?: string;
  priority: SystemAlertPriority; // 0 = Urgent, 1 = High, 2 = Medium, 3-5 = Info/Low
  category: SystemAlertCategory;
  categoryLabel: string;
}

export function useSystemAlerts() {
  const {
    employees,
    attendanceRecords,
    leaves,
    pendingInvoices,
    invoices,
    salaryAdvances,
    loans,
    sites,
    disciplinaryRecords,
    evaluations,
    commLogs,
    dismissedNotifications,
    dismissNotification,
    dismissNotifications
  } = useAppStore(
    useShallow((s) => ({
      employees: s.employees,
      attendanceRecords: s.attendanceRecords,
      leaves: s.leaves,
      pendingInvoices: s.pendingInvoices,
      invoices: s.invoices,
      salaryAdvances: s.salaryAdvances,
      loans: s.loans,
      sites: s.sites,
      disciplinaryRecords: s.disciplinaryRecords,
      evaluations: s.evaluations,
      commLogs: s.commLogs,
      dismissedNotifications: s.dismissedNotifications,
      dismissNotification: s.dismissNotification,
      dismissNotifications: s.dismissNotifications,
    }))
  );

  const { reminders, updateReminder, subtasks } = useAppData();
  const { fleetRefillForecast } = useRefillForecast();
  const { activeSiteInvoices } = useActiveSiteInvoices();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const authUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id || authUser?.id;

  const alerts = useMemo<SystemAlert[]>(() => {
    const list: SystemAlert[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const isWithinDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr);
      const diffHrs = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHrs >= 0 && diffHrs <= days * 24;
    };

    const isPastOrToday = (dateStr: string) => dateStr <= todayStr;

    // 1. Reminders & Mentions
    reminders
      .filter((r) => {
        if (!r.isActive) return false;
        if (currentUserId && r.recipientIds && r.recipientIds.length > 0 && !r.recipientIds.includes(currentUserId)) {
          return false;
        }
        return true;
      })
      .forEach((r) => {
        const isMention = r.title?.startsWith('Mentioned');
        const isNewTask = r.title === 'New Task Created';
        const remDate = new Date(r.remindAt);
        const isPast = remDate < now;

        if (isMention) {
          list.push({
            id: `rem-${r.id}`,
            icon: AtSign,
            text: r.body || r.title,
            time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: 1,
            category: 'mention',
            categoryLabel: 'Mention',
          });
        } else if (isNewTask) {
          list.push({
            id: `rem-${r.id}`,
            icon: FileText,
            text: `New Task: ${r.body || 'Task'}`,
            time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
            color: 'text-emerald-500 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            url: r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: 2,
            category: 'system',
            categoryLabel: 'Task',
          });
        } else {
          list.push({
            id: `rem-${r.id}`,
            icon: isPast ? AlertCircle : BellRing,
            text: `Reminder: ${r.title}`,
            time: isPast ? 'Overdue' : format(remDate, 'MMM d, h:mm a'),
            color: isPast ? 'text-rose-500 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400',
            bg: isPast ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-blue-50 dark:bg-blue-500/10',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : '/tasks/reminders',
            priority: isPast ? 0 : 2,
            category: 'reminder',
            categoryLabel: isPast ? 'Overdue' : 'Reminder',
          });
        }
      });

    // 2. Approvals (Targeted to the designated approver or visible to managers/admins)
    const canManageApprovals = 
      currentUser?.privileges?.users?.canManage || 
      currentUser?.privileges?.leaves?.canEdit ||
      currentUser?.privileges?.salaryLoans?.canEdit;

    leaves
      .filter((l) => l.approvalStatus === 'Pending' && l.status !== 'Cancelled')
      .filter((l) => !currentUserId || canManageApprovals || l.approvedById === currentUserId)
      .forEach((l) => {
        list.push({
          id: `leave-${l.id}`,
          icon: CalendarClock,
          text: `Leave Request: ${l.employeeName}`,
          time: l.startDate,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          url: '/leaves',
          priority: 2,
          category: 'approval',
          categoryLabel: 'Leave Request',
        });
      });

    salaryAdvances
      .filter((s) => s.status === 'Pending')
      .filter((s) => !currentUserId || canManageApprovals || s.approvedById === currentUserId)
      .forEach((s) => {
        list.push({
          id: `adv-${s.id}`,
          icon: Wallet,
          text: `Salary Advance: ${s.employeeName}`,
          time: s.requestDate,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          url: '/salary-loans',
          priority: 2,
          category: 'approval',
          categoryLabel: 'Advance Request',
        });
      });

    loans
      .filter((l) => l.status === 'Pending')
      .filter((l) => !currentUserId || canManageApprovals || l.approvedById === currentUserId)
      .forEach((l) => {
        list.push({
          id: `loan-${l.id}`,
          icon: Landmark,
          text: `Loan Request: ${l.employeeName}`,
          time: l.startDate,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          url: '/salary-loans',
          priority: 2,
          category: 'approval',
          categoryLabel: 'Loan Request',
        });
      });

    // 3. Finance
    invoices
      .filter((i) => i.status === 'Overdue')
      .forEach((i) => {
        list.push({
          id: `inv-ov-${i.id}`,
          icon: FileText,
          text: `Overdue Invoice: ${i.invoiceNumber}`,
          time: i.dueDate,
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/client-accounts',
          priority: 0,
          category: 'finance',
          categoryLabel: 'Overdue Invoice',
        });
      });

    if (pendingInvoices.length > 0) {
      list.push({
        id: 'pending-inv',
        icon: FileText,
        text: `${pendingInvoices.length} pending quotations/invoices to draft`,
        time: 'Now',
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        url: '/client-accounts',
        priority: 3,
        category: 'finance',
        categoryLabel: 'Quotation',
      });
    }

    // Active Dewatering Site Invoices (Overdue, Due Today, & 2-Day Heads Up)
    activeSiteInvoices.forEach((s) => {
      const isOverrunOrLapsed = s.isOverrun || s.hasLapsedInvoice || s.calendarRunwayDays < 0 || s.urgency === 'overdue';

      if (isOverrunOrLapsed) {
        const overrunText = s.overrunDays > 0
          ? `+${s.overrunDays % 1 === 0 ? s.overrunDays.toFixed(0) : s.overrunDays.toFixed(1)}d overrun`
          : s.calendarRunwayDays < 0
            ? `overdue by ${Math.abs(s.calendarRunwayDays)}d`
            : 'lapsed';

        list.push({
          id: `site-inv-overdue-${s.siteId}`,
          icon: Receipt,
          text: `Active Site Invoice Overdue: ${s.siteName} (${overrunText})`,
          time: s.latestLiveEndDate || 'Overdue',
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/tasks/dashboard',
          priority: 0,
          category: 'finance',
          categoryLabel: 'Site Overrun',
        });
      } else if (s.hasActiveInvoices && s.calendarRunwayDays <= 2 && s.calendarRunwayDays >= 0) {
        if (s.calendarRunwayDays === 0) {
          list.push({
            id: `site-inv-due-today-${s.siteId}`,
            icon: Receipt,
            text: `Active Site Invoice Due Today: ${s.siteName} (0 days remaining)`,
            time: 'Today',
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            url: '/tasks/dashboard',
            priority: 1,
            category: 'finance',
            categoryLabel: 'Due Today',
          });
        } else {
          const daysText = s.calendarRunwayDays === 1 ? '1 Day (Tomorrow)' : '2 Days';
          list.push({
            id: `site-inv-due-soon-${s.siteId}`,
            icon: Receipt,
            text: `Active Site Invoice Due in ${daysText}: ${s.siteName} (${s.calendarRunwayDays}d runway heads up)`,
            time: s.calendarRunwayDays === 1 ? 'Tomorrow' : 'In 2 days',
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
            url: '/tasks/dashboard',
            priority: 1,
            category: 'finance',
            categoryLabel: s.calendarRunwayDays === 1 ? 'Due Tomorrow' : 'Due in 2d',
          });
        }
      }
    });

    // 4. HR Alerts
    employees
      .filter((e) => e.status === 'Active' && e.lashmaExpiryDate && isWithinDays(e.lashmaExpiryDate, 7))
      .forEach((e) => {
        list.push({
          id: `lashma-${e.id}`,
          icon: ShieldCheck,
          text: `LASHMA Expiring Soon: ${e.firstname} ${e.surname}`,
          time: e.lashmaExpiryDate!,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          url: '/tasks/reminders',
          priority: 1,
          category: 'hr',
          categoryLabel: 'Insurance',
        });
      });

    employees
      .filter((e) => e.status === 'Active' && e.lashmaExpiryDate && isPastOrToday(e.lashmaExpiryDate))
      .forEach((e) => {
        list.push({
          id: `lashma-overdue-${e.id}`,
          icon: ShieldCheck,
          text: `LASHMA Expired: ${e.firstname} ${e.surname} — renew immediately`,
          time: e.lashmaExpiryDate!,
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/tasks/reminders',
          priority: 0,
          category: 'hr',
          categoryLabel: 'Insurance',
        });
      });

    commLogs
      .filter((c) => c.followUpDate && !c.followUpDone && isPastOrToday(c.followUpDate))
      .forEach((c) => {
        list.push({
          id: `comm-${c.id}`,
          icon: Clock,
          text: `Follow-up due: ${c.subject || 'Communication'}`,
          time: c.followUpDate!,
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-500/10',
          url: '/sites',
          priority: 2,
          category: 'hr',
          categoryLabel: 'Follow-up',
        });
      });

    sites
      .filter((s) => s.status === 'Active' && s.endDate && isWithinDays(s.endDate, 7))
      .forEach((s) => {
        list.push({
          id: `site-end-${s.id}`,
          icon: MapPin,
          text: `Site ending soon: ${s.name}`,
          time: s.endDate!,
          color: 'text-rose-400 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/sites',
          priority: 1,
          category: 'hr',
          categoryLabel: 'Site Notice',
        });
      });

    evaluations
      .filter((e) => e.status === 'Review')
      .forEach((e) => {
        const emp = employees.find((em) => em.id === e.employeeId);
        list.push({
          id: `eval-${e.id}`,
          icon: Users,
          text: `Eval review: ${emp ? emp.surname : 'Employee'}`,
          time: e.date,
          color: 'text-emerald-500 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          url: '/evaluations',
          priority: 3,
          category: 'hr',
          categoryLabel: 'Evaluation',
        });
      });

    disciplinaryRecords
      .filter((d) => d.workflowState === 'Reported' || d.workflowState === 'Query Issued')
      .forEach((d) => {
        const emp = employees.find((em) => em.id === d.employeeId);
        list.push({
          id: `disc-${d.id}`,
          icon: ShieldCheck,
          text: `Disciplinary action: ${emp ? emp.surname : 'Employee'}`,
          time: d.date,
          color: 'text-rose-500 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/performance-conduct',
          priority: 0,
          category: 'hr',
          categoryLabel: 'Conduct',
        });
      });

    employees
      .filter((e) => e.status === 'Active' && e.startDate && e.probationPeriod)
      .forEach((e) => {
        const start = new Date(e.startDate);
        const end = new Date(start.getTime() + e.probationPeriod! * 86400000);
        const endStr = end.toISOString().split('T')[0];
        if (isWithinDays(endStr, 14)) {
          list.push({
            id: `prob-${e.id}`,
            icon: Users,
            text: `Probation ending: ${e.firstname} ${e.surname}`,
            time: endStr,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            url: '/employees',
            priority: 3,
            category: 'hr',
            categoryLabel: 'Probation',
          });
        }
      });

    // 5. Assigned Subtask Deadlines
    if (subtasks && subtasks.length > 0) {
      const mySubtasks = subtasks.filter(
        (s) =>
          s.status !== 'completed' &&
          s.deadline &&
          currentUserId &&
          (s.assignedTo?.split(',').includes(currentUserId) || (s as any).assigned_to?.split(',').includes(currentUserId))
      );

      mySubtasks.forEach((s) => {
        const deadlineDate = s.deadline.split('T')[0];
        if (isPastOrToday(deadlineDate)) {
          list.push({
            id: `sub-overdue-${s.id}`,
            icon: AlertCircle,
            text: `Overdue subtask: ${s.title}`,
            time: s.deadline,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            url: `/tasks?open=${s.id}`,
            priority: 0,
            category: 'reminder',
            categoryLabel: 'Overdue Subtask',
          });
        } else if (isWithinDays(deadlineDate, 1)) {
          list.push({
            id: `sub-due-${s.id}`,
            icon: Clock,
            text: `Due tomorrow: ${s.title}`,
            time: s.deadline,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
            url: `/tasks?open=${s.id}`,
            priority: 1,
            category: 'reminder',
            categoryLabel: 'Upcoming Subtask',
          });
        }
      });
    }

    // 6. Diesel Fuel Refill Forecast (Today & Tomorrow)
    fleetRefillForecast.forEach((rf) => {
      if (rf.urgency === 'critical' || rf.urgency === 'today') {
        list.push({
          id: `refill-today-${rf.siteId}-${rf.machineId}`,
          icon: Fuel,
          text: `Diesel Refill Needed Today: ${rf.siteName} – ${rf.shortName} (${rf.fuelPercentage}% remaining)`,
          time: 'Today',
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          url: '/operations/diesel',
          priority: 0,
          category: 'operations',
          categoryLabel: 'Refill Today',
        });
      } else if (rf.urgency === 'tomorrow') {
        list.push({
          id: `refill-tom-${rf.siteId}-${rf.machineId}`,
          icon: Fuel,
          text: `Diesel Refill Tomorrow: ${rf.siteName} – ${rf.shortName} (${rf.fuelPercentage}% remaining)`,
          time: 'Tomorrow',
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          url: '/operations/diesel',
          priority: 1,
          category: 'operations',
          categoryLabel: 'Refill Tomorrow',
        });
      }
    });

    // 7. System & Daily Activity
    const onboardingEmps = employees.filter((e) => e.status === 'Onboarding');
    if (onboardingEmps.length > 0) {
      list.push({
        id: 'onboarding-counts',
        icon: UserPlus,
        text: `${onboardingEmps.length} staff currently onboarding`,
        time: 'Ongoing',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        url: '/onboarding',
        priority: 4,
        category: 'system',
        categoryLabel: 'Onboarding',
      });
    }

    const dates = [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const count = attendanceRecords.filter((r) => r.date === latestDate).length;
      const isLatestToday = latestDate === todayStr;
      list.push({
        id: `att-${latestDate}`,
        icon: CalendarClock,
        text: isLatestToday
          ? `${count} attendance records logged today`
          : `${count} attendance records logged for ${format(new Date(latestDate), 'MMM d, yyyy')}`,
        time: latestDate,
        color: 'text-slate-500 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-800',
        priority: 5,
        category: 'system',
        categoryLabel: 'Activity',
      });
    }

    return list.sort((a, b) => a.priority - b.priority);
  }, [
    employees,
    attendanceRecords,
    leaves,
    pendingInvoices,
    invoices,
    salaryAdvances,
    loans,
    sites,
    disciplinaryRecords,
    evaluations,
    commLogs,
    reminders,
    currentUserId,
    currentUser?.privileges,
    subtasks,
    fleetRefillForecast,
    activeSiteInvoices,
  ]);

  // Exclude dismissed notifications
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedNotifications.includes(a.id));
  }, [alerts, dismissedNotifications]);

  const handleDismiss = useCallback(
    (id: string) => {
      if (id.startsWith('rem-')) {
        updateReminder(id.replace('rem-', ''), { isActive: false });
      }
      dismissNotification(id);
    },
    [updateReminder, dismissNotification]
  );

  const handleDismissAll = useCallback(() => {
    if (activeAlerts.length === 0) return;
    activeAlerts.forEach((a) => {
      if (a.id.startsWith('rem-')) {
        updateReminder(a.id.replace('rem-', ''), { isActive: false });
      }
    });
    dismissNotifications(activeAlerts.map((a) => a.id));
  }, [activeAlerts, updateReminder, dismissNotifications]);

  return {
    alerts,
    activeAlerts,
    dismissedNotifications,
    handleDismiss,
    handleDismissAll,
  };
}
