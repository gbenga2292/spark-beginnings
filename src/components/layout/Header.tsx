import { formatDisplayDate } from '@/src/lib/dateUtils';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Search, LogOut, Menu, X, User, Settings, ChevronRight, CalendarClock, Users, MapPin, Wallet, FileText, Landmark, Library, UserPlus, ShieldCheck, LayoutDashboard, Clock, AlertCircle, AtSign } from 'lucide-react';
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
    salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs 
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
  })));
  const { reminders } = useAppData();

  return useMemo(() => {
    const notifs: { id: string; icon: any; text: string; time: string; color: string; url?: string; priority: number }[] = [];
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

    // 1. Reminders — show ALL active reminders for the current user (no time-window cap)
    const currentUser = useUserStore.getState().getCurrentUser();
    reminders.filter(r => {
      if (!r.isActive) return false;
      if (currentUser && r.recipientIds && r.recipientIds.length > 0 && !r.recipientIds.includes(currentUser.id)) return false;
      return true;
    }).forEach((r) => {
      const isMention = r.title && r.title.startsWith('Mentioned');
      const remDate = new Date(r.remindAt);
      const isPast = remDate < now;
      
      if (isMention) {
          notifs.push({
            id: `rem-${r.id}`,
            icon: AtSign,
            text: r.body || r.title,
            time: r.createdAt ? r.createdAt.slice(0, 10) : 'New',
            color: 'text-indigo-500',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: 1
          });
      } else {
          notifs.push({ 
            id: `rem-${r.id}`, 
            icon: isPast ? AlertCircle : Bell, 
            text: `Reminder: ${r.title}`, 
            time: isPast ? 'Overdue' : r.remindAt.slice(0, 10), 
            color: isPast ? 'text-rose-500' : 'text-indigo-500',
            url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined,
            priority: isPast ? 0 : 1
          });
      }
    });

    // 2. Pending Approvals (Priority: 2)
    const currentUserId = currentUser?.id || useAuthStore.getState().user?.id;
    
    leaves.filter(l => l.approvalStatus === 'Pending' && l.status !== 'Cancelled' && l.approvedById === currentUserId).forEach(l => {
      notifs.push({ id: `leave-${l.id}`, icon: CalendarClock, text: `Leave Request: ${l.employeeName}`, time: l.startDate, color: 'text-amber-500', url: '/leaves', priority: 2 });
    });
    salaryAdvances.filter(s => s.status === 'Pending' && s.approvedById === currentUserId).forEach(s => {
      notifs.push({ id: `adv-${s.id}`, icon: Wallet, text: `Salary Advance: ${s.employeeName}`, time: s.requestDate, color: 'text-amber-500', url: '/salary-loans', priority: 2 });
    });
    loans.filter(l => l.status === 'Pending' && l.approvedById === currentUserId).forEach(l => {
      notifs.push({ id: `loan-${l.id}`, icon: Landmark, text: `Loan Request: ${l.employeeName}`, time: l.startDate, color: 'text-amber-500', url: '/salary-loans', priority: 2 });
    });

    // 3. Overdue Invoices (Priority: 1)
    invoices.filter(i => i.status === 'Overdue').forEach(i => {
      notifs.push({ id: `inv-ov-${i.id}`, icon: FileText, text: `Overdue Invoice: ${i.invoiceNumber}`, time: i.dueDate, color: 'text-rose-600', url: '/client-accounts', priority: 1 });
    });

    // 4. Quotations (Priority: 3)
    if (pendingInvoices.length > 0) {
      notifs.push({ id: 'pending-inv', icon: FileText, text: `${pendingInvoices.length} Quotations to draft`, time: 'Now', color: 'text-blue-500', url: '/client-accounts', priority: 3 });
    }

    // 5. Expiring LASHMA (Priority: 2)
    employees.filter(e => e.status === 'Active' && e.lashmaExpiryDate && isWithinDays(e.lashmaExpiryDate, 7)).forEach(e => {
        notifs.push({ id: `lashma-${e.id}`, icon: ShieldCheck, text: `LASHMA Expiring: ${e.firstname} ${e.surname}`, time: e.lashmaExpiryDate!, color: 'text-amber-600', url: '/employees', priority: 2 });
    });

    // 6. Comm Follow-ups (Priority: 2)
    commLogs.filter(c => c.followUpDate && !c.followUpDone && isPastOrToday(c.followUpDate)).forEach(c => {
        notifs.push({ id: `comm-${c.id}`, icon: Clock, text: `Follow-up: ${c.subject || 'Communication'}`, time: c.followUpDate!, color: 'text-indigo-400', url: '/sites', priority: 2 });
    });

    // 7. Site Endings (Priority: 2)
    sites.filter(s => s.status === 'Active' && s.endDate && isWithinDays(s.endDate, 7)).forEach(s => {
        notifs.push({ id: `site-end-${s.id}`, icon: MapPin, text: `Site Ending Soon: ${s.name}`, time: s.endDate!, color: 'text-rose-400', url: '/sites', priority: 2 });
    });

    // 8. Pending Evaluations (Priority: 3)
    evaluations.filter(e => e.status === 'Review').forEach(e => {
        const emp = employees.find(emp => emp.id === e.employeeId);
        notifs.push({ id: `eval-${e.id}`, icon: Users, text: `Eval Review: ${emp ? emp.surname : 'Employee'}`, time: e.date, color: 'text-emerald-500', url: '/evaluations', priority: 3 });
    });

    // 9. Disciplinary Queries (Priority: 1)
    disciplinaryRecords.filter(d => d.workflowState === 'Reported' || d.workflowState === 'Query Issued').forEach(d => {
        const emp = employees.find(emp => emp.id === d.employeeId);
        notifs.push({ id: `disc-${d.id}`, icon: ShieldCheck, text: `Disciplinary Action: ${emp ? emp.surname : 'Employee'}`, time: d.date, color: 'text-rose-500', url: '/performance-conduct', priority: 1 });
    });

    // 10. Probation Ending (Priority: 3)
    employees.filter(e => e.status === 'Active' && e.startDate && e.probationPeriod).forEach(e => {
        const start = new Date(e.startDate);
        const end = new Date(start.getTime() + (e.probationPeriod! * 24 * 60 * 60 * 1000));
        const endStr = end.toISOString().split('T')[0];
        if (isWithinDays(endStr, 14)) { // Show 14 days before
            notifs.push({ id: `prob-${e.id}`, icon: Users, text: `Probation Ending: ${e.firstname} ${e.surname}`, time: endStr, color: 'text-indigo-400', url: '/employees', priority: 3 });
        }
    });

    // 11. Pending Onboarding (Priority: 4)
    const onboardingEmps = employees.filter(e => e.status === 'Onboarding');
    if (onboardingEmps.length > 0) {
        notifs.push({ id: 'onboarding-counts', icon: UserPlus, text: `${onboardingEmps.length} staff currently onboarding`, time: 'Ongoing', color: 'text-emerald-500', url: '/onboarding', priority: 4 });
    }

    // 12. Recent Attendance (Info - Priority: 5)
    const dates = [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const count = attendanceRecords.filter((r) => r.date === latestDate).length;
      notifs.push({ id: `att-${latestDate}`, icon: CalendarClock, text: `${count} attendance records for ${latestDate}`, time: latestDate, color: 'text-slate-400', priority: 5 });
    }

    // Sort by priority then time (roughly)
    return notifs.sort((a, b) => a.priority - b.priority).slice(0, 15);
  }, [employees, attendanceRecords, leaves, pendingInvoices, invoices, salaryAdvances, loans, sites, disciplinaryRecords, evaluations, commLogs, reminders]);
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { signOut } = useAuth();
  const { updateReminder } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useUserStore();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const notifications = useNotifications();
  const { isDark } = useTheme();
  const { title, subtitle, headerButtons } = usePage();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setSearchOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
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

  return (
    <header className={`flex h-14 items-center justify-between border-b px-4 md:px-6 gap-4 transition-colors duration-200 relative z-40 ${
      isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
    }`}>
      {/* Left: Menu + Page Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="text-slate-500 lg:hidden h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col min-w-0 transition-all duration-300">
          <h1 className={`text-base md:text-lg font-bold tracking-tight truncate ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            {title || 'Dashboard'}
          </h1>
          {subtitle && (
            <p className={`text-[10px] truncate font-medium mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center/Right Actions */}
      <div className="flex items-center gap-2">
        {/* Portal target for page-level header buttons */}
        <div id={HEADER_PORTAL_ID} className="flex items-center gap-2" />
        {headerButtons}
        
        <StatusIndicator />
        <div className={`h-6 w-px hidden sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mx-1`} />
        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className={`relative h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ${isDark ? 'ring-slate-900' : 'ring-white'} ${
                notifications.some(n => n.priority <= 1) ? 'bg-red-500 animate-pulse' : 'bg-red-400'
              }`} />
            )}
          </button>

          {notifOpen && (
            <div className={`absolute right-0 top-full mt-1 w-80 border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-2">
                  <h3 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Notifications</h3>
                  <span className="text-[10px] font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {notifications.length}
                  </span>
                </div>
                <button 
                  onClick={() => setNotifOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="px-4 py-12 text-center text-xs text-slate-400">
                    <div className="h-12 w-12 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="font-medium">All caught up!</p>
                    <p className="text-[10px] mt-1 opacity-60">No new notifications to show.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => { 
                          if (n.id.startsWith('rem-')) {
                              updateReminder(n.id.replace('rem-', ''), { isActive: false });
                          }
                          if (n.url) { navigate(n.url); setNotifOpen(false); } 
                        }} 
                        className={`flex items-start gap-3 px-4 py-3.5 transition-all relative group ${
                          n.url ? 'cursor-pointer' : ''
                        } ${
                          isDark ? 'hover:bg-slate-700/40' : 'hover:bg-blue-50/30'
                        }`}
                      >
                        {/* Priority Indicator */}
                        {n.priority <= 1 && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-500" />
                        )}
                        
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isDark ? 'bg-slate-700/50' : 'bg-slate-100/80 shadow-sm'
                        } ${n.color}`}>
                          <n.icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-[11px] font-bold uppercase tracking-wider opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {n.priority === 0 ? 'Urgent' : n.priority === 1 ? 'High Priority' : 'Attention'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                              {n.time.includes('-') ? formatDisplayDate(n.time) : n.time}
                            </p>
                          </div>
                          <p className={`text-[12px] leading-tight font-medium mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {n.text}
                          </p>
                          {n.url && (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-indigo-500 font-bold group-hover:translate-x-1 transition-transform">
                              Take Action <ChevronRight className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className={`px-4 py-2 text-center border-t ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <button 
                  onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`h-6 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
            }`}
          >
            <div className="hidden sm:flex flex-col items-end">
              <span className={`text-xs font-semibold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{currentUser?.name || user?.name}</span>
              <span className="text-[10px] text-slate-400 leading-tight">{currentUser?.email || user?.email}</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUser?.avatar || user?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-bold uppercase">
                {(currentUser?.name || user?.name || '?').charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>

          {profileOpen && (
            <div className={`absolute right-0 top-full mt-1 w-64 border rounded-lg shadow-xl z-50 overflow-hidden ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              {/* Profile Header */}
              <div className={`px-4 py-4 border-b ${
                isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentUser?.avatar || user?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-indigo-700 text-white font-bold uppercase">{(currentUser?.name || user?.name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{currentUser?.name || user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser?.email || user?.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="text-[10px] font-medium bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">
                    {privCount} permissions
                  </span>
                  <span className="text-[10px] font-medium bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                    isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  My Profile
                </button>
                {/* Settings — super-admin only */}
                {!currentUser && (
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                      isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    Settings
                  </button>
                )}
                {currentUser?.privileges?.users?.canView && (
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/users'); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                      isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    User Management
                  </button>
                )}
              </div>

              <div className={`border-t py-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-500 hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
