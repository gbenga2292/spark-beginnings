import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Search, LogOut, Menu, X, User, Settings, ChevronRight, CalendarClock, Users, MapPin, Wallet, FileText, Landmark, Library, UserPlus, ShieldCheck, LayoutDashboard, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/src/store/auth';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Button } from '@/src/components/ui/button';
import { useTheme } from '@/src/hooks/useTheme';

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
function useNotifications() {
  const { employees, attendanceRecords, leaves, pendingInvoices } = useAppStore();
  const { reminders } = useAppData();

  return useMemo(() => {
    const notifs: { id: string; icon: any; text: string; time: string; color: string; url?: string }[] = [];

    // Pending leave requests
    const recentLeaves = leaves.slice(-3);
    recentLeaves.forEach((l) => {
      notifs.push({ id: `leave-${l.id}`, icon: CalendarClock, text: `${l.employeeName} requested leave (${l.duration} days)`, time: l.startDate, color: 'text-amber-500' });
    });

    // Recent attendance
    const dates = [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const count = attendanceRecords.filter((r) => r.date === latestDate).length;
      notifs.push({ id: `att-${latestDate}`, icon: CalendarClock, text: `${count} attendance records for ${latestDate}`, time: latestDate, color: 'text-indigo-500' });
    }

    // Pending invoices
    if (pendingInvoices.length > 0) {
      notifs.push({ id: 'pending-inv', icon: FileText, text: `${pendingInvoices.length} pending invoice(s) awaiting action`, time: 'Now', color: 'text-rose-500' });
    }

    // New employees
    const recentEmps = employees.filter((e) => e.status === 'Active').slice(-2);
    recentEmps.forEach((e) => {
      notifs.push({ id: `emp-${e.id}`, icon: Users, text: `${e.firstname} ${e.surname} is active`, time: e.startDate, color: 'text-emerald-500' });
    });

    // Active Reminders due in next 24h or overdue
    const now = new Date();
    const currentUser = useUserStore.getState().getCurrentUser();
    const activeRems = reminders.filter(r => {
      if (!r.isActive) return false;
      if (currentUser && r.recipientIds && r.recipientIds.length > 0 && !r.recipientIds.includes(currentUser.id)) return false;
      const remDate = new Date(r.remindAt);
      const diffHrs = (remDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Show if overdue or within 24 hours
      return diffHrs <= 24;
    });
    activeRems.forEach((r) => {
      const remDate = new Date(r.remindAt);
      const isPast = remDate < now;
      notifs.push({ 
        id: `rem-${r.id}`, 
        icon: Bell, 
        text: `${r.title}`, 
        time: isPast ? 'Overdue' : r.remindAt.slice(0, 10), 
        color: isPast ? 'text-red-500' : 'text-indigo-500',
        url: r.subtaskId ? `/tasks?open=${r.subtaskId}` : r.mainTaskId ? `/tasks?openTask=${r.mainTaskId}` : undefined
      });
    });

    // Sort by id to keep deterministic roughly, or just rely on current push order
    return notifs.slice(0, 8);
  }, [employees, attendanceRecords, leaves, pendingInvoices, reminders]);
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useUserStore();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const notifications = useNotifications();
  const { isDark } = useTheme();

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

  const handleLogout = () => {
    logout();
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
    <header className={`flex h-14 items-center justify-between border-b px-4 md:px-6 gap-4 transition-colors duration-200 relative z-[100] ${
      isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
    }`}>
      {/* Left: Menu + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="text-slate-500 lg:hidden h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Global Search */}
        <div ref={searchRef} className="relative w-full max-w-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search pages, features..."
              className={`w-full h-8 rounded-lg border pl-8 pr-8 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => searchQuery && setSearchOpen(true)}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              {filteredSearch.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  <Search className="h-5 w-5 mx-auto mb-2 opacity-30" />
                  No results for "{searchQuery}"
                </div>
              ) : (
                filteredSearch.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => { navigate(item.href); setSearchOpen(false); setSearchQuery(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-0 ${
                      isDark ? 'hover:bg-slate-700 border-slate-700/50 text-slate-200' : 'hover:bg-slate-50 border-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[10px] text-slate-400">{item.description}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-2">
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
              <span className={`absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ${isDark ? 'ring-slate-900' : 'ring-white'}`} />
            )}
          </button>

          {notifOpen && (
            <div className={`absolute right-0 top-full mt-1 w-80 border rounded-lg shadow-xl z-50 overflow-hidden ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${
                isDark ? 'border-slate-700' : 'border-slate-100'
              }`}>
                <h3 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Notifications</h3>
                <span className="text-[10px] font-medium text-indigo-400 bg-indigo-900/40 px-1.5 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    <Bell className="h-5 w-5 mx-auto mb-2 opacity-20" />
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} onClick={() => { if (n.url) { navigate(n.url); setNotifOpen(false); } }} 
                      className={`flex items-start gap-3 px-4 py-3 transition-colors border-b last:border-0 ${n.url ? 'cursor-pointer' : ''} ${
                      isDark ? 'hover:bg-slate-700/50 border-slate-700/50' : 'hover:bg-slate-50 border-slate-50'
                    }`}>
                      <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${n.color} ${
                        isDark ? 'bg-slate-700' : 'bg-slate-50'
                      }`}>
                        <n.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{n.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {n.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
