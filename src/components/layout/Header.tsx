import { formatDisplayDate } from '@/src/lib/dateUtils';
import { format } from 'date-fns';
import React, { isValidElement, Children } from 'react';

// Helper to determine if a React node tree is effectively empty (e.g. nested fragments or divs with falsy children)
const isNodeEmpty = (node: any): boolean => {
  if (node === null || node === undefined || node === false || node === true) return true;
  if (typeof node === 'string' || typeof node === 'number') return node.toString().trim() === '';
  
  if (Array.isArray(node)) {
    return node.every(isNodeEmpty);
  }
  
  if (isValidElement(node)) {
    if (typeof node.type === 'string' || node.type === React.Fragment) {
       const children = (node.props as any)?.children;
       return isNodeEmpty(children);
    }
    // It's a custom component, we can't easily tell if it will render empty.
    // So to be safe, assume it's NOT empty.
    return false;
  }
  
  return false;
};
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Bell, Search, LogOut, Menu, X, User, Settings, ChevronRight, CalendarClock, Users, MapPin, Wallet, FileText, Landmark, Library, UserPlus, ShieldCheck, LayoutDashboard, Clock, AlertCircle, AtSign, ArrowLeft, ArrowUpCircle, RefreshCw, MoreVertical, Sparkles, Home, CheckCheck, Check } from 'lucide-react';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { StatusIndicator } from '@/src/components/offline/StatusIndicator';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/src/store/auth';
import { useAuth } from '@/src/hooks/useAuth';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Button } from '@/src/components/ui/button';
import { useTheme } from '@/src/hooks/useTheme';
import { usePage } from '@/src/contexts/PageContext';
import { useShallow } from 'zustand/react/shallow';
import { HEADER_PORTAL_ID } from '@/src/hooks/useHeaderPortal';
import { APP_VERSION } from '@/src/constants/version';
import { cn } from '@/src/lib/utils';
import { OmniSearch } from '@/src/components/common/OmniSearch';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HeaderProps {
  onMenuClick?: () => void;
}

// Searchable items: pages + features, filtered by privilege
interface SearchItem {
  label: string;
  description: string;
  href: string;
  icon: any;
  privKey: keyof UserPrivileges | null; // null = super-admin only
  privField: string;
  keywords: string[];
}

const ALL_SEARCH_ITEMS: SearchItem[] = [
  { label: 'Dashboard', description: 'Overview & analytics', href: '/', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView', keywords: ['home', 'overview', 'analytics', 'summary', 'dashboard'] },
  { label: 'Daily Register', description: 'Attendance & shifts', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView', keywords: ['attendance', 'register', 'daily', 'shift', 'day', 'night', 'present', 'absent'] },
  { label: 'Employees', description: 'Staff management', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView', keywords: ['employee', 'staff', 'worker', 'personnel', 'team', 'hire'] },
  { label: 'Leaves', description: 'Leave management', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView', keywords: ['leave', 'vacation', 'time off', 'absence', 'holiday'] },
  { label: 'Sites & Clients', description: 'Site assignments', href: '/sites', icon: MapPin, privKey: 'sites', privField: 'canView', keywords: ['site', 'client', 'location', 'project', 'assignment'] },
  { label: 'Onboarding', description: 'New hire onboarding', href: '/onboarding', icon: UserPlus, privKey: 'employees', privField: 'canView', keywords: ['onboarding', 'new hire', 'orientation', 'induction'] },
  { label: 'Payroll', description: 'Salary & compensation', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView', keywords: ['payroll', 'salary', 'pay', 'wage', 'compensation', 'deduction', 'pension', 'tax'] },
  { label: 'Client Accounts', description: 'Invoices, payments & VAT', href: '/client-accounts', icon: Landmark, privKey: 'billing', privField: 'canView', keywords: ['finance', 'invoice', 'billing', 'payment', 'vat', 'receipt', 'money', 'revenue', 'loan', 'advance'] },
  { label: 'Reports', description: 'Export & analysis', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView', keywords: ['report', 'export', 'analysis', 'data', 'download', 'pdf', 'excel'] },
  { label: 'Variables', description: 'Tax rates & config', href: '/variables', icon: Library, privKey: 'variables', privField: 'canView', keywords: ['variable', 'tax', 'rate', 'config', 'paye', 'pension', 'allowance', 'holiday'] },
  { label: 'Settings', description: 'App preferences', href: '/settings', icon: Settings, privKey: null, privField: 'canView', keywords: ['settings', 'preference', 'company', 'notification', 'integration', 'security'] },
  { label: 'User Management', description: 'Users & privileges', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView', keywords: ['user', 'privilege', 'permission', 'role', 'access', 'admin'] },
];

// Generate notifications from app data
// Generate notifications from app data
function useNotifications() {
  const { 
    employees, attendanceRecords, leaves, pendingInvoices, invoices, 
    salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs,
    dismissedNotifications
  } = useAppStore(useShallow((s) => ({
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
  })));
  const { reminders } = useAppData();

  return useMemo(() => {
    const notifs: { 
      id: string; 
      icon: any; 
      text: string; 
      time: string; 
      color: string; 
      bg: string; 
      url?: string; 
      priority: number;
      category?: string;
    }[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Helper: Is date within X days
    const isWithinDays = (dateStr: string, days: number) => {
      const d = new Date(dateStr);
      const diffHrs = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHrs >= 0 && diffHrs <= (days * 24);
    };

    // Helper: Is date past or today
    const isPastOrToday = (dateStr: string) => {
      return dateStr <= todayStr;
    };

    // 1. Reminders
    const currentUser = useUserStore.getState().getCurrentUser();
    reminders.filter(r => {
      if (!r.isActive) return false;
      if (currentUser && r.recipientIds && r.recipientIds.length > 0 && !r.recipientIds.includes(currentUser.id)) return false;
      return true;
    }).forEach((r) => {
      const isMention = r.title && r.title.startsWith('Mentioned');
      const remDate = new Date(r.remindAt);
      const isPast = remDate < now;
      const isNewTask = r.title === 'New Task Created';
      
      if (isMention) {
          notifs.push({
            id: `rem-${r.id}`, icon: AtSign, text: r.body || r.title,
            time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
            color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: 1,
            category: 'Mention'
          });
      } else if (isNewTask) {
          notifs.push({
            id: `rem-${r.id}`, icon: FileText, text: `New Task: ${r.body || 'Task'}`,
            time: r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : 'New',
            color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            url: r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: 2,
            category: 'Task'
          });
      } else {
          notifs.push({ 
            id: `rem-${r.id}`, icon: isPast ? AlertCircle : Bell, 
            text: `Reminder: ${r.title}`, 
            time: isPast ? 'Overdue' : format(remDate, 'MMM d, h:mm a'), 
            color: isPast ? 'text-rose-600' : 'text-blue-600', bg: isPast ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-blue-50 dark:bg-blue-500/10',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: isPast ? 0 : 1,
            category: isPast ? 'Overdue' : 'Reminder'
          });
      }
    });

    // 2. Pending Approvals
    const currentUserId = currentUser?.id || useAuthStore.getState().user?.id;
    leaves.filter(l => l.approvalStatus === 'Pending' && l.status !== 'Cancelled' && l.approvedById === currentUserId).forEach(l => {
      notifs.push({ id: `leave-${l.id}`, icon: CalendarClock, text: `Leave Request: ${l.employeeName}`, time: l.startDate, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', url: '/leaves', priority: 2, category: 'Leave Request' });
    });
    salaryAdvances.filter(s => s.status === 'Pending' && s.approvedById === currentUserId).forEach(s => {
      notifs.push({ id: `adv-${s.id}`, icon: Wallet, text: `Salary Advance: ${s.employeeName}`, time: s.requestDate, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', url: '/salary-loans', priority: 2, category: 'Advance Request' });
    });
    loans.filter(l => l.status === 'Pending' && l.approvedById === currentUserId).forEach(l => {
      notifs.push({ id: `loan-${l.id}`, icon: Landmark, text: `Loan Request: ${l.employeeName}`, time: l.startDate, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', url: '/salary-loans', priority: 2, category: 'Loan Request' });
    });

    // 3. Finance
    invoices.filter(i => i.status === 'Overdue').forEach(i => {
      notifs.push({ id: `inv-ov-${i.id}`, icon: FileText, text: `Overdue Invoice: ${i.invoiceNumber}`, time: i.dueDate, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10', url: '/client-accounts', priority: 1, category: 'Overdue Invoice' });
    });
    if (pendingInvoices.length > 0) {
      notifs.push({ id: 'pending-inv', icon: FileText, text: `${pendingInvoices.length} Quotations to draft`, time: 'Now', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', url: '/client-accounts', priority: 3, category: 'Quotation' });
    }

    // 4. HR Alerts
    employees.filter(e => e.status === 'Active' && e.lashmaExpiryDate && isWithinDays(e.lashmaExpiryDate, 7)).forEach(e => {
        notifs.push({ id: `lashma-${e.id}`, icon: ShieldCheck, text: `LASHMA Expiring: ${e.firstname} ${e.surname}`, time: e.lashmaExpiryDate!, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', url: '/employees', priority: 2, category: 'Insurance' });
    });
    commLogs.filter(c => c.followUpDate && !c.followUpDone && isPastOrToday(c.followUpDate)).forEach(c => {
        notifs.push({ id: `comm-${c.id}`, icon: Clock, text: `Follow-up: ${c.subject || 'Communication'}`, time: c.followUpDate!, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', url: '/sites', priority: 2, category: 'Follow-up' });
    });
    sites.filter(s => s.status === 'Active' && s.endDate && isWithinDays(s.endDate, 7)).forEach(s => {
        notifs.push({ id: `site-end-${s.id}`, icon: MapPin, text: `Site Ending Soon: ${s.name}`, time: s.endDate!, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', url: '/sites', priority: 2, category: 'Site Notice' });
    });
    evaluations.filter(e => e.status === 'Review').forEach(e => {
        const emp = employees.find(emp => emp.id === e.employeeId);
        notifs.push({ id: `eval-${e.id}`, icon: Users, text: `Eval Review: ${emp ? emp.surname : 'Employee'}`, time: e.date, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', url: '/evaluations', priority: 3, category: 'Evaluation' });
    });
    disciplinaryRecords.filter(d => d.workflowState === 'Reported' || d.workflowState === 'Query Issued').forEach(d => {
        const emp = employees.find(emp => emp.id === d.employeeId);
        notifs.push({ id: `disc-${d.id}`, icon: ShieldCheck, text: `Disciplinary Action: ${emp ? emp.surname : 'Employee'}`, time: d.date, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', url: '/performance-conduct', priority: 1, category: 'Conduct' });
    });
    employees.filter(e => e.status === 'Active' && e.startDate && e.probationPeriod).forEach(e => {
        const start = new Date(e.startDate);
        const end = new Date(start.getTime() + (e.probationPeriod! * 24 * 60 * 60 * 1000));
        const endStr = end.toISOString().split('T')[0];
        if (isWithinDays(endStr, 14)) { // Show 14 days before
            notifs.push({ id: `prob-${e.id}`, icon: Users, text: `Probation Ending: ${e.firstname} ${e.surname}`, time: endStr, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', url: '/employees', priority: 3, category: 'Probation' });
        }
    });

    // 5. System
    const onboardingEmps = employees.filter(e => e.status === 'Onboarding');
    if (onboardingEmps.length > 0) {
        notifs.push({ id: 'onboarding-counts', icon: UserPlus, text: `${onboardingEmps.length} staff currently onboarding`, time: 'Ongoing', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', url: '/onboarding', priority: 4, category: 'Onboarding' });
    }
    const dates = [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const count = attendanceRecords.filter((r) => r.date === latestDate).length;
      const isLatestToday = latestDate === todayStr;
      notifs.push({ 
        id: `att-${latestDate}`, 
        icon: CalendarClock, 
        text: isLatestToday ? `${count} attendance records logged today` : `${count} attendance records logged for ${format(new Date(latestDate), 'MMM d, yyyy')}`, 
        time: latestDate, 
        color: 'text-slate-500', 
        bg: 'bg-slate-100 dark:bg-slate-800', 
        priority: 5,
        category: 'Activity'
      });
    }

    return notifs.sort((a, b) => a.priority - b.priority).filter(n => !dismissedNotifications.includes(n.id)).slice(0, 15);
  }, [employees, attendanceRecords, leaves, pendingInvoices, invoices, salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs, reminders, dismissedNotifications]);
}

function formatNotificationDate(timeStr: string): string {
  if (!timeStr) return '';
  if (['Now', 'New', 'Ongoing', 'Overdue'].includes(timeStr)) return timeStr;
  if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) return timeStr;
  
  try {
    const d = new Date(timeStr.length === 10 ? `${timeStr}T12:00:00` : timeStr);
    if (isNaN(d.getTime())) return timeStr;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)}d ago`;
    return format(d, 'MMM d, yyyy');
  } catch {
    return timeStr;
  }
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { signOut } = useAuth();
  const { updateReminder } = useAppData();
  const { isSimulatorDirty, setSimulatorDirty } = useAppStore();
  const location = useLocation();
  const isDashboard = location.pathname === '/tasks/dashboard' || location.pathname.startsWith('/tasks/dashboard/') || location.pathname === '/';
  const rawNavigate = useNavigate();
  const navigate = useCallback(async (to: any, options?: any) => {
    if (location.pathname === '/operations/simulator' && isSimulatorDirty) {
      if (to === '/operations/simulator') {
        rawNavigate(to, options);
        return;
      }
      const ok = await showConfirm('You have unsaved simulator changes. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger'
      });
      if (ok) {
        setSimulatorDirty(false);
        rawNavigate(to, options);
      }
    } else {
      rawNavigate(to, options);
    }
  }, [location.pathname, isSimulatorDirty, rawNavigate]);

  const { setCurrentUser } = useUserStore();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const notifications = useNotifications();
  const { isDark } = useTheme();
  const { 
    updateCommLog, 
    dismissedNotifications, 
    dismissNotification,
    dismissNotifications
  } = useAppStore();

  const handleMarkAllAsRead = () => {
    if (notifications.length === 0) return;
    notifications.forEach(n => {
      if (n.id.startsWith('rem-')) {
        updateReminder(n.id.replace('rem-', ''), { isActive: false });
      }
    });
    const allIds = notifications.map(n => n.id);
    dismissNotifications(allIds);
    toast.success('All notifications marked as read');
  };

  const handleDismissNotification = (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    if (n.id.startsWith('rem-')) {
      updateReminder(n.id.replace('rem-', ''), { isActive: false });
    }
    dismissNotification(n.id);
  };

  const { title, subtitle, headerButtons, showBackButton } = usePage();

  const [omniOpen, setOmniOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!isDashboard) return;
        e.preventDefault();
        setOmniOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDashboard]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const CURRENT_VERSION = APP_VERSION;
  const UPDATE_SERVER_URL = import.meta.env.VITE_UPDATE_SERVER_URL || 'https://dewaterconstruct.com/app-updates';

  // ── Platform Detection ─────────────────────────────────────────────────
  const isAndroidNative = Capacitor.getPlatform() === 'android';
  const isElectron = !!(window as any).electronAPI?.isElectron;

  const startDownload = (url: string) => {
    try {
      // Hand off to Android's native Download Manager via the '_system' target.
      // This bypasses the WebView's CORS restriction entirely — the native
      // downloader has no origin rules. Progress is visible in the notification bar.
      window.open(url, '_system');
      toast.success('Download started! Check your notification bar, then tap the file to install.');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed. Please try again.');
    }
  };

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    try {
      // CapacitorHttp makes a native HTTP request — bypasses WebView CORS restrictions.
      // Using fetch() here would fail: Capacitor WebView origin (https://localhost) is
      // cross-origin vs dewaterconstruct.com which lacks CORS headers.
      const response = await CapacitorHttp.get({
        url: `${UPDATE_SERVER_URL}/version.json?t=${Date.now()}`,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.status !== 200) throw new Error('Could not connect to update server');

      const data = response.data;
      if (data.version && data.version !== CURRENT_VERSION) {
        toast.success(
          <div className="flex flex-col gap-0.5">
            <div className="font-bold">New version v{data.version} available!</div>
            <div className="text-[11px] opacity-80 leading-tight">{data.notes || 'A new update is ready for download.'}</div>
          </div>,
          {
            label: 'Download Now',
            onClick: () => startDownload(data.url),
          }
        );
      } else {
        toast.info(
          <div className="flex flex-col gap-0.5">
            <div className="font-bold">App is up to date</div>
            <div className="text-[11px] opacity-80">You are currently on version {CURRENT_VERSION}</div>
          </div>
        );
      }
    } catch (err) {
      toast.error(
        <div className="flex flex-col gap-0.5">
          <div className="font-bold">Update check failed</div>
          <div className="text-[11px] opacity-80">Please check your internet connection and try again.</div>
        </div>
      );
    } finally {
      setCheckingUpdate(false);
      setIsProfileOpen(false);
    }
  };

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setMobileOverflowOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setSearchOpen(false);
    setNotifOpen(false);
    setIsProfileOpen(false);
    setMobileOverflowOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(); // clears the Supabase session from localStorage
    } catch (_) {/* ignore */}
    logout();          // reset legacy Zustand auth store
    setCurrentUser(null);
    navigate('/login');
  };

  // Filter search items by privilege and query
  const filteredSearch = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return ALL_SEARCH_ITEMS.filter((item) => {
      // Check privilege
      if (currentUser) {
        // null privKey = super-admin only — hide for sub-users
        if (item.privKey === null) return false;
        const pagePriv = (currentUser.privileges[item.privKey] as unknown) as Record<string, boolean>;
        if (!pagePriv?.[item.privField]) return false;
      }
      // Check query match
      return (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
      );
    });
  }, [searchQuery, currentUser]);

  // Count privileges
  const privCount = currentUser
    ? Object.values(currentUser.privileges).reduce((acc, page: any) => {
        return acc + Object.values(page).filter((v) => v === true).length;
      }, 0)
    : 0;

  const hasVisibleActions = headerButtons && !isNodeEmpty(headerButtons);
  const userName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Director';

  return (
    <header className={`flex min-h-[56px] py-2 sm:py-0 h-auto items-center justify-between border-b px-3 md:px-6 gap-2 md:gap-4 transition-colors duration-200 relative z-40 ${
      isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
    }`}>
      {/* Left: Menu + Page Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="text-slate-500 lg:hidden h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {showBackButton && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => typeof showBackButton === 'function' ? showBackButton() : navigate(-1)} 
            className={`h-9 w-9 rounded-xl shrink-0 transition-all ${
              isDark 
                ? 'text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white bg-slate-900' 
                : 'text-slate-700 border-slate-200 hover:bg-slate-50 bg-white'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col min-w-0 transition-all duration-300 justify-center">
          <h1 className={`text-[14px] sm:text-base md:text-lg font-bold tracking-tight line-clamp-2 sm:truncate leading-tight ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            {isDashboard ? `${getGreeting()}, ${userName}` : (title || 'Dashboard')}
          </h1>
          {(isDashboard ? 'Operational Command & Launchpad' : subtitle) && (
            <div className={`hidden sm:block text-[10px] sm:truncate leading-tight font-medium mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {isDashboard ? 'Operational Command & Launchpad' : subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Center: OmniSearch styled with app theme as on home page - only for dashboard */}
      {isDashboard && (
        <div className="flex-1 max-w-xs md:max-w-md mx-2 sm:mx-4 hidden sm:block">
          <button
            onClick={() => setOmniOpen(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-colors border shadow-2xs group cursor-pointer",
              isDark
                ? "bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 hover:border-slate-600"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-sky-500 group-hover:text-sky-400 transition-colors" />
            <span className="flex-1 text-left truncate">Search tasks, sites, fleet, finances...</span>
            <kbd className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-mono border",
              isDark ? "bg-slate-700/80 text-slate-300 border-slate-600" : "bg-white text-slate-500 border-slate-200"
            )}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Center/Right Actions */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Button - only for dashboard */}
        {isDashboard && (
          <button
            onClick={() => setOmniOpen(true)}
            className={`sm:hidden h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        {/* ── Mobile 3-dot overflow button (only when page has actions) ── */}
        {hasVisibleActions && (
          <div ref={overflowRef} className="relative sm:hidden">
            <button
              onClick={() => {
                setMobileOverflowOpen(v => !v);
                setNotifOpen(false);
                setIsProfileOpen(false);
              }}
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                mobileOverflowOpen
                  ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {mobileOverflowOpen && (
              <>
                {/* Transparent backdrop to catch outside taps */}
                <div
                  className="fixed inset-0 z-[58]"
                  onClick={() => setMobileOverflowOpen(false)}
                />

                {/* Dropdown panel — fixed below header, left-aligned to screen edge */}
                <div
                  className={`fixed left-2 right-2 top-[57px] z-[59] rounded-2xl border shadow-2xl ${
                    isDark
                      ? 'bg-slate-900 border-slate-700/80 shadow-black/70'
                      : 'bg-white border-slate-200 shadow-slate-300/60'
                  }`}
                >
                  {/* Panel header */}
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between rounded-t-2xl ${
                    isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>Page Actions</span>
                    <button
                      onClick={() => setMobileOverflowOpen(false)}
                      className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                        isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Actions area */}
                  <div className="mobile-action-menu px-4 py-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto rounded-b-2xl">
                    {headerButtons}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/*
          Portal div + headerButtons container.
          - Desktop (sm+): always visible as a flex row.
          - Mobile: `display:none` keeps it out of view BUT the DOM node still
            exists so React portals continue to mount into it correctly.
          The mobile overflow button above re-renders `headerButtons` inside
          its own dropdown — both copies are conditionally shown via CSS, never
          simultaneously visible to the user.
        */}
        <div className="hidden sm:flex items-center gap-2">
          <div id={HEADER_PORTAL_ID} className="flex items-center gap-2" />
          {headerButtons}
        </div>

        <StatusIndicator />
        <div className={`h-6 w-px hidden sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />

        {/* Home Button */}
        <button
          onClick={async () => {
            const { isDailyLogFormDirty, setDailyLogFormDirty } = useAppStore.getState();
            if (isDailyLogFormDirty) {
              const ok = await showConfirm('You have unsaved changes in this machine log. Do you want to discard them and leave?', {
                title: 'Unsaved Changes',
                confirmLabel: 'Discard & Leave',
                cancelLabel: 'Keep Editing',
                variant: 'danger'
              });
              if (!ok) return;
              setDailyLogFormDirty(false);
            }
            navigate('/home');
          }}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
            isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title="Home"
        >
          <Home className="h-4 w-4" />
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setIsProfileOpen(false); }}
            className={`relative h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
              notifOpen
                ? (isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900')
                : (isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700')
            }`}
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={notifOpen}
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ${isDark ? 'ring-slate-900' : 'ring-white'} ${
                notifications.some(n => n.priority <= 1) ? 'bg-rose-500 animate-pulse' : 'bg-sky-500'
              }`} />
            )}
          </button>

          {notifOpen && (
            <div className={`absolute right-0 top-full mt-2 w-[370px] max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-xl z-50 overflow-hidden flex flex-col origin-top-right transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${
              isDark ? 'bg-slate-900/95 backdrop-blur-md border-slate-700/80 shadow-black/50' : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-300/50'
            }`}>
              {/* Header */}
              <div className={`px-4 py-3 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center gap-2">
                  <h3 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Notifications</h3>
                  {notifications.length > 0 && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {notifications.length}
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className={`text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors px-2 py-1 rounded-md ${
                      isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-2.5 ${
                      isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Check className="h-5 w-5" />
                    </div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>All caught up</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">No unread notifications right now</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isActivity = n.category === 'Activity' || n.priority === 5;
                    const isUrgent = n.priority === 0;
                    const isHigh = n.priority === 1;

                    return (
                      <div 
                        key={n.id} 
                        onClick={() => { 
                          if (n.id.startsWith('rem-')) {
                            updateReminder(n.id.replace('rem-', ''), { isActive: false });
                          }
                          if (n.url) { navigate(n.url); setNotifOpen(false); } 
                        }} 
                        className={`flex items-start gap-3 px-4 py-3 transition-colors relative group ${
                          n.url ? 'cursor-pointer' : ''
                        } ${
                          isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Priority Indicator */}
                        {isUrgent && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-rose-500 rounded-r" />}
                        {isHigh && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-amber-400 rounded-r" />}
                        
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.bg} ${n.color}`}>
                          <n.icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                              isUrgent 
                                ? 'text-rose-600 dark:text-rose-400' 
                                : isHigh 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : isActivity 
                                    ? 'text-slate-400 dark:text-slate-500' 
                                    : 'text-sky-600 dark:text-sky-400'
                            }`}>
                              {n.category || (isUrgent ? 'Urgent' : isHigh ? 'High Priority' : 'Notice')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap tabular-nums">
                              {formatNotificationDate(n.time)}
                            </span>
                          </div>
                          <p className={`text-xs leading-snug mt-0.5 line-clamp-2 ${
                            isActivity 
                              ? (isDark ? 'text-slate-400 font-normal' : 'text-slate-600 font-normal')
                              : (isDark ? 'text-slate-200 font-medium' : 'text-slate-800 font-medium')
                          }`}>
                            {n.text}
                          </p>
                          {n.url && (
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-semibold group-hover:underline">
                              <span>Take Action</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        {/* Hover Dismiss Button */}
                        <button
                          onClick={(e) => handleDismissNotification(e, n)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="Dismiss notification"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Footer */}
              <div className={`px-4 py-2.5 text-center border-t ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <button 
                  onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                  className={`text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                    isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>View all notifications</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`h-6 w-px hidden sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setIsProfileOpen(!isProfileOpen); setNotifOpen(false); }}
            className={`flex items-center rounded-full p-0.5 transition-all focus:outline-none ${
              isProfileOpen
                ? 'ring-2 ring-blue-500/50 dark:ring-blue-400/50'
                : (isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100')
            }`}
            title={currentUser?.name || user?.name || 'User Profile'}
            aria-label="User Profile"
            aria-expanded={isProfileOpen}
          >
            <Avatar className="h-8 w-8 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-blue-400 transition-all">
              <AvatarImage src={currentUser?.avatar || user?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase">
                {(currentUser?.name || user?.name || '?').charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>

          {isProfileOpen && (
            <div className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-xl z-50 overflow-hidden origin-top-right transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${
              isDark 
                ? 'bg-slate-900/95 backdrop-blur-md border-slate-700/80 shadow-black/50' 
                : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-300/50'
            }`}>
              {/* Profile Header */}
              <div className={`px-4 py-3.5 border-b ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-1 ring-slate-200/80 dark:ring-slate-700 shrink-0">
                    <AvatarImage src={currentUser?.avatar || user?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold uppercase">
                      {(currentUser?.name || user?.name || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {currentUser?.name || user?.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {currentUser?.email || user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>My Profile</span>
                </button>

                {/* Settings — super-admin only */}
                {!currentUser && (
                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/settings'); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Settings</span>
                  </button>
                )}

                {currentUser?.privileges?.users?.canView && (
                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/users'); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>User Management</span>
                  </button>
                )}

                {isAndroidNative && !isElectron && (
                  <button
                    onClick={handleManualUpdateCheck}
                    disabled={checkingUpdate}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {checkingUpdate ? (
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{checkingUpdate ? 'Checking...' : 'Check for Update'}</span>
                  </button>
                )}
              </div>

              <div className={`border-t p-1.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {omniOpen && <OmniSearch isOpen={omniOpen} onClose={() => setOmniOpen(false)} isDark={isDark} />}
    </header>
  );
}
