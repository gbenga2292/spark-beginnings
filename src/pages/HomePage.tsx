import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore, NO_ACCESS, backfillPrivileges, AppUser } from '../store/userStore';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, Sparkles, BarChart3, HardHat, ArrowRightLeft,
  Calculator, ListTodo, MessageSquare, Users, Cpu, Landmark, FileText,
  Settings, Search, LogOut, ArrowUpRight, Layers, ShieldAlert,
  Bell, User as UserIcon,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { showConfirm } from '../components/ui/toast';
import { OmniSearch } from '@/src/components/common/OmniSearch';
import { getVisibleNavItems, NavItem } from '@/src/constants/navigation';
import companyLogo from '../../logo/logo-1.png';
import { StatusIndicator } from '@/src/components/offline/StatusIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { prefetchRoute } from '@/src/lib/routePrefetch';

interface SubModuleItem {
  name: string;
  href: string;
}

interface WorkspaceItem {
  name: string;
  icon: any;
  href: string;
  bg: string;
  glow: string;
  dotColor: string;
  badge: string | null;
  badgeStyle?: React.CSSProperties;
  subModules: SubModuleItem[];
}

interface WorkspaceDefinition {
  name: string;
  icon: any;
  defaultHref: string;
  bg: string;
  glow: string;
  dotColor: string;
  staticBadge?: string;
  badgeStyle?: React.CSSProperties;
  items: NavItem[];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export function HomePage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // Direct primitive unread count selector — matches Sidebar and CommLog schema
  const unreadCommCount = useAppStore((s) => {
    const user = useUserStore.getState().getCurrentUser();
    if (!user?.id || !s.commLogs?.length) return 0;
    const canViewCommLog = user?.privileges?.users?.canManage === true || user?.privileges?.commLog?.canView === true;
    if (!canViewCommLog) return 0;
    const reads = s.commLogReads;
    const readSet = new Set(
      reads ? reads.filter((r: any) => r.userId === user.id).map((r: any) => r.logId) : []
    );
    return s.commLogs.filter((log: any) => log.loggedBy !== user.name && !readSet.has(log.id)).length;
  });

  // Prefetch popular destinations during browser idle for instant click-throughs
  useEffect(() => {
    const scheduleIdle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1200));
    const handle = scheduleIdle(() => {
      ['/tasks/dashboard', '/hr-dashboard', '/operations', '/sites', '/attendance', '/client-360', '/reports'].forEach(prefetchRoute);
    });
    return () => {
      if ((window as any).cancelIdleCallback && typeof handle === 'number') {
        (window as any).cancelIdleCallback(handle);
      }
    };
  }, []);

  // Ensure active user profile is available without firing redundant network queries on every mount
  useEffect(() => {
    if (!authUser?.id) return;
    const state = useUserStore.getState();
    if (state.currentUserId !== authUser.id) {
      state.setCurrentUser(authUser.id);
    }
    const hasUser = state.users.some((u) => u.id === authUser.id);
    if (!hasUser) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            const freshPrivs = backfillPrivileges(NO_ACCESS, profile.privileges || {});
            const existing = useUserStore.getState().users;
            const userObj: AppUser = {
              id: profile.id,
              name: profile.name || authUser.email || '',
              email: profile.email || authUser.email || '',
              password: '',
              workspaceId: profile.workspace_id || 'dcel-team',
              privileges: freshPrivs,
              isActive: profile.is_active ?? true,
              createdAt: profile.created_at || new Date().toISOString(),
              avatar: profile.avatar,
            };
            if (existing.some((u) => u.id === profile.id)) {
              useUserStore.getState().updateUser(profile.id, userObj);
            } else {
              useUserStore.setState({ users: [...existing, userObj] });
            }
          }
        });
    }
  }, [authUser?.id]);

  const [omniOpen, setOmniOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOmniOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const profileRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsProfileOpen(false);
    const ok = await showConfirm('Are you sure you want to sign out?', {
      title: 'Sign Out', confirmLabel: 'Sign Out', cancelLabel: 'Stay', variant: 'danger',
    });
    if (!ok) return;
    try {
      await signOut();
    } catch (_) {}
    useUserStore.getState().setCurrentUser(null);
    navigate('/login');
  };

  // Workspaces definition with full permission requirements for every item
  const workspaces: WorkspaceItem[] = useMemo(() => {
    if (!currentUser) return [];

    const definitions: WorkspaceDefinition[] = [
      {
        name: 'Dashboard',
        icon: LayoutDashboard,
        defaultHref: '/tasks/dashboard',
        bg: 'linear-gradient(135deg, #1d6fdb 0%, #0ea5e9 100%)',
        glow: 'rgba(14, 165, 233, 0.35)',
        dotColor: '#38bdf8',
        staticBadge: 'Live',
        items: [
          { name: 'Dashboard', href: '/tasks/dashboard', icon: LayoutDashboard, privKey: 'tasks', privField: 'canViewDashboard' },
        ],
      },
      {
        name: 'Clients',
        icon: Sparkles,
        defaultHref: '/client-360',
        bg: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
        glow: 'rgba(6, 182, 212, 0.35)',
        dotColor: '#22d3ee',
        items: [
          {
            name: 'Client 360',
            href: '/client-360',
            icon: Sparkles,
            privKey: 'custom',
            privField: '',
            visible: (user: any) =>
              Boolean(
                user?.privileges?.users?.canManage ||
                user?.privileges?.sites?.canView ||
                user?.privileges?.clients?.canView
              ),
          },
          { name: 'Machine Recon', href: '/operations/machine-reconciliation', icon: ArrowRightLeft, privKey: 'opsMachineRecon', privField: 'canView' },
          { name: 'Site Analytics', href: '/operations/site-analytics', icon: BarChart3, privKey: 'operations', privField: 'canView' },
        ],
      },
      {
        name: 'Communication',
        icon: MessageSquare,
        defaultHref: '/tasks',
        bg: unreadCommCount > 0
          ? 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)'
          : 'linear-gradient(135deg, #0284c7 0%, #22d3ee 100%)',
        glow: unreadCommCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 211, 238, 0.30)',
        dotColor: '#38bdf8',
        staticBadge: unreadCommCount > 0 ? `${unreadCommCount} Unread` : undefined,
        items: [
          { name: 'Task Register', href: '/tasks', icon: ListTodo, privKey: 'tasks', privField: 'canViewMyTasks' },
          { name: 'Task Reminders', href: '/tasks/reminders', icon: Bell, privKey: 'tasks', privField: 'canViewReminders' },
          { name: 'External Comms', href: '/comm-log', icon: MessageSquare, privKey: 'commLog', privField: 'canView' },
          { name: 'Daily Journals', href: '/daily-journal', icon: MessageSquare, privKey: 'dailyJournal', privField: 'canView' },
        ],
      },
      {
        name: 'HR',
        icon: Users,
        defaultHref: '/hr-dashboard',
        bg: 'linear-gradient(135deg, #047857 0%, #34d399 100%)',
        glow: 'rgba(52, 211, 153, 0.30)',
        dotColor: '#10b981',
        items: [
          { name: 'HR Dashboard', href: '/hr-dashboard', icon: Users, privKey: 'dashboard', privField: 'canView' },
          { name: 'Daily Attendance', href: '/attendance', icon: Users, privKey: 'attendance', privField: 'canView' },
          { name: 'Employees Directory', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
          { name: 'Staff Onboarding', href: '/onboarding', icon: Users, privKey: 'onboarding', privField: 'canView' },
          { name: 'Leave Management', href: '/leaves', icon: Users, privKey: 'leaves', privField: 'canView' },
          { name: 'Salary & Loans', href: '/salary-loans', icon: Users, privKey: 'salaryLoans', privField: 'canView' },
          { name: 'HMO Management', href: '/hmo', icon: Users, privKey: 'hmo', privField: 'canView' },
          { name: 'Staff Evaluations', href: '/evaluations', icon: Users, privKey: 'evaluations', privField: 'canView' },
          { name: 'Candidate Interviews', href: '/interviews', icon: Users, privKey: 'interviews', privField: 'canView' },
          { name: 'Conduct & Disciplinary', href: '/performance-conduct', icon: Users, privKey: 'disciplinary', privField: 'canView' },
        ],
      },
      {
        name: 'Operations',
        icon: Cpu,
        defaultHref: '/operations',
        bg: 'linear-gradient(135deg, #c2410c 0%, #fb923c 100%)',
        glow: 'rgba(251, 146, 60, 0.35)',
        dotColor: '#f97316',
        items: [
          { name: 'Operations Overview', href: '/operations', icon: Cpu, privKey: 'operations', privField: 'canView' },
          { name: 'Site Inventory', href: '/operations/assets', icon: Cpu, privKey: 'opsInventory', privField: 'canView' },
          { name: 'Waybills Register', href: '/operations/waybills', icon: Cpu, privKey: 'opsWaybills', privField: 'canView' },
          { name: 'Quick Checkout', href: '/operations/checkout', icon: Cpu, privKey: 'opsCheckout', privField: 'canView' },
          { name: 'Asset Maintenance', href: '/operations/maintenance', icon: Cpu, privKey: 'opsMaintenance', privField: 'canView' },
          { name: 'Diesel Refills', href: '/operations/diesel', icon: Cpu, privKey: 'opsDiesel', privField: 'canView' },
          { name: 'Fleet Vehicles', href: '/operations/vehicles', icon: Cpu, privKey: 'opsVehicles', privField: 'canView' },
          { name: 'Active Sites', href: '/operations/sites', icon: Cpu, privKey: 'opsSites', privField: 'canView' },
        ],
      },
      {
        name: 'Accounts',
        icon: Landmark,
        defaultHref: '/ledger',
        bg: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)',
        glow: 'rgba(251, 191, 36, 0.35)',
        dotColor: '#f59e0b',
        items: [
          {
            name: 'Client Accounts',
            href: '/client-accounts',
            icon: Landmark,
            privKey: 'custom',
            privField: '',
            visible: (user: any) =>
              Boolean(
                user?.privileges?.billing?.canView ||
                user?.privileges?.payments?.canView ||
                user?.privileges?.payments?.canViewVat
              ),
          },
          { name: 'Payroll Engine', href: '/payroll', icon: Landmark, privKey: 'payroll', privField: 'canView' },
          { name: 'Beneficiaries Directory', href: '/beneficiaries', icon: Landmark, privKey: 'beneficiaries', privField: 'canView' },
          { name: 'Financial Ledger', href: '/ledger', icon: Landmark, privKey: 'ledger', privField: 'canView' },
          { name: 'Bank AI Import', href: '/bank-import', icon: Landmark, privKey: 'bankImport', privField: 'canView' },
          { name: 'Company Expenses', href: '/company-expenses', icon: Landmark, privKey: 'ledger', privField: 'canView' },
          { name: 'Budget Tracking', href: '/budget', icon: Landmark, privKey: 'budget', privField: 'canView' },
        ],
      },
      {
        name: 'Tools',
        icon: HardHat,
        defaultHref: '/operations/simulator',
        bg: 'linear-gradient(135deg, #ea580c 0%, #fde68a 100%)',
        glow: 'rgba(234, 88, 12, 0.30)',
        dotColor: '#f97316',
        items: [
          { name: 'Simulator', href: '/operations/simulator', icon: HardHat, privKey: 'simulator', privField: 'canView' },
          { name: 'Logistics Estimator', href: '/operations/estimator', icon: Calculator, privKey: 'simulator', privField: 'canView' },
        ],
      },
      {
        name: 'Reports',
        icon: FileText,
        defaultHref: '/reports',
        bg: 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)',
        glow: 'rgba(251, 113, 133, 0.30)',
        dotColor: '#f43f5e',
        items: [
          { name: 'HR Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
          { name: 'Financial Reports', href: '/financial-reports', icon: FileText, privKey: 'financialReports', privField: 'canView' },
          { name: 'Task Reports', href: '/tasks/reports', icon: FileText, privKey: 'tasks', privField: 'canViewReports' },
          { name: 'Weekly Executive Report', href: '/weekly-report', icon: FileText, privKey: 'weeklyReport', privField: 'canView' },
        ],
      },
      {
        name: 'System Settings',
        icon: Settings,
        defaultHref: '/settings',
        bg: 'linear-gradient(135deg, #334155 0%, #64748b 100%)',
        glow: 'rgba(100, 116, 139, 0.25)',
        dotColor: '#94a3b8',
        items: [
          { name: 'User Management', href: '/users', icon: Settings, privKey: 'users', privField: 'canView' },
          { name: 'System Settings', href: '/settings', icon: Settings, privKey: 'variables', privField: 'canView' },
          { name: 'Activity Audit Log', href: '/activity-log', icon: Settings, privKey: 'activityLog', privField: 'canView' },
        ],
      },
    ];

    // Filter strictly by the user's active permissions
    return definitions
      .map((def) => {
        const permitted = getVisibleNavItems(def.items, currentUser);
        // Completely exclude workspace if user has no permitted modules in it
        if (permitted.length === 0) return null;

        // Use defaultHref if permitted; otherwise fallback to the first permitted item
        const isDefaultPermitted = permitted.some((p) => p.href === def.defaultHref);
        const targetHref = isDefaultPermitted ? def.defaultHref : permitted[0].href;

        const hasMultiplePermitted = permitted.length > 1;
        // Dynamically compute badge: only show count if more than 1 module is accessible
        const badge = def.staticBadge || (hasMultiplePermitted ? `${permitted.length} Modules` : null);

        return {
          name: def.name,
          icon: def.icon,
          href: targetHref,
          bg: def.bg,
          glow: def.glow,
          dotColor: def.dotColor,
          badge,
          badgeStyle: def.badgeStyle,
          // Hover flyout is only needed when there are multiple accessible sub-modules
          subModules: hasMultiplePermitted ? permitted.map((p) => ({ name: p.name, href: p.href })) : [],
        };
      })
      .filter(Boolean) as WorkspaceItem[];
  }, [currentUser, unreadCommCount]);

  return (
    <div
      className="w-full h-full overflow-hidden flex flex-col select-none"
      style={{
        background: isDark ? '#070f1e' : '#f8fafc',
      }}
    >
      {/* ── App Themed Header ─────────────────────────────────────────────────── */}
      <header
        className={cn(
          "flex min-h-[56px] py-2 sm:py-0 h-auto items-center justify-between border-b px-3 md:px-6 gap-2 md:gap-4 transition-colors duration-200 relative z-40 shrink-0",
          isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'
        )}
      >
        {/* Left: Company Logo + Greeting */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={cn(
              "shrink-0 h-9 w-9 rounded-xl flex items-center justify-center p-1 shadow-xs border transition-colors",
              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            )}
          >
            <img
              src={companyLogo}
              alt="Company Logo"
              className="h-full w-full object-contain pointer-events-none"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className={cn("text-[14px] sm:text-base md:text-lg font-bold tracking-tight line-clamp-1 leading-tight", isDark ? "text-slate-100" : "text-slate-900")}>
              {getGreeting()}, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Director'}
            </h1>
            <div className={cn("hidden sm:block text-[10px] font-medium leading-tight mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
              Operational Command & Launchpad
            </div>
          </div>
        </div>

        {/* Center: OmniSearch styled with app theme */}
        <div className="flex-1 max-w-md mx-2 sm:mx-6 hidden sm:block">
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

        {/* Right: App Controls, Status, Notifications & Profile Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusIndicator />
          <div className={cn("h-6 w-px hidden sm:block mx-1", isDark ? "bg-slate-700" : "bg-slate-200")} />

          {/* Notifications button */}
          <button
            onClick={() => navigate('/notifications')}
            className={cn(
              "relative h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
            )}
            title="Notifications & Comms"
          >
            <Bell className="h-4 w-4" />
            {unreadCommCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCommCount}
              </span>
            )}
          </button>

          <div className={cn("h-6 w-px hidden sm:block", isDark ? "bg-slate-700" : "bg-slate-200")} />

          {/* Profile Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "flex items-center rounded-full p-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer",
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
              )}
              title={currentUser?.name || authUser?.email || 'User Profile'}
              aria-label="User Profile"
            >
              <Avatar className="h-8 w-8 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-sky-400 transition-all">
                <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-xs bg-sky-100 text-sky-700 font-bold uppercase dark:bg-sky-950 dark:text-sky-300">
                  {(currentUser?.name || authUser?.email || '?').charAt(0)}
                </AvatarFallback>
              </Avatar>
            </button>

            {isProfileOpen && (
              <div className={cn(
                "fixed right-3 top-[57px] w-64 max-w-[calc(100vw-1.5rem)] border rounded-xl shadow-2xl z-50 overflow-hidden",
                isDark ? "bg-slate-800 border-slate-700/80 shadow-black/60" : "bg-white border-slate-200 shadow-slate-300/60"
              )}>
                <div className={cn("px-4 py-4 border-b", isDark ? "bg-slate-900/60 border-slate-700" : "bg-slate-50 border-slate-100")}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-sky-600 text-white font-bold uppercase">
                        {(currentUser?.name || authUser?.email || '?').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className={cn("text-[12px] font-bold truncate leading-tight", isDark ? "text-slate-100" : "text-slate-900")}>
                        {currentUser?.name || authUser?.email}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{currentUser?.email || authUser?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                    className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer", isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-50")}
                  >
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { setIsProfileOpen(false); navigate('/settings'); }}
                    className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer", isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-50")}
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    Settings
                  </button>
                  {currentUser?.privileges?.users?.canView && (
                    <button
                      onClick={() => { setIsProfileOpen(false); navigate('/users'); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer", isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      User Management
                    </button>
                  )}

                  <div className={cn("my-1 border-t", isDark ? "border-slate-700" : "border-slate-100")} />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

      {/* ── Accessible Workspaces Grid ───────────────────────────────────────── */}
      <main
        className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto p-4 sm:p-6 pb-6 overflow-y-auto md:overflow-hidden [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Empty state if user has 0 permitted workspaces */}
        {workspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-28 text-center animate-in fade-in duration-300">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            >
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className={cn('text-lg font-bold tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
              No Accessible Modules
            </h2>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Your account does not currently have permissions assigned to access any operational modules. Please contact your system administrator to request access.
            </p>
            <Link
              to="/profile"
              className="mt-2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-transform hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1d6fdb, #0ea5e9)' }}
            >
              View Profile
            </Link>
          </div>
        )}

        {/* Dynamic Responsive Grid of Permitted Workspaces */}
        {workspaces.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {workspaces.map((item, index) => {
              const ItemIcon = item.icon;
              const hasSubModules = item.subModules.length > 0;

              return (
                <div
                  key={item.name}
                  className="relative group hover:z-50"
                >
                  {/* Main Action Card */}
                  <Link
                    to={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onTouchStart={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    className="relative flex flex-col justify-between overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0 w-full select-none"
                    style={{
                      background: item.bg,
                      boxShadow: isDark
                        ? '0 4px 14px rgba(0,0,0,0.45)'
                        : '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                      minHeight: '124px',
                      padding: '16px',
                      contain: 'layout style',
                    }}
                  >
                    {/* Sheen overlay on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }}
                    />

                    {/* Top row: icon + badge + arrow */}
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs"
                        style={{ background: 'rgba(255,255,255,0.22)' }}
                      >
                        <ItemIcon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs shrink-0"
                            style={item.badgeStyle || { background: 'rgba(255,255,255,0.25)', color: '#fff' }}
                          >
                            {item.badge}
                          </span>
                        )}
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0"
                          style={{ background: 'rgba(255,255,255,0.18)' }}
                        >
                          <ArrowUpRight className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Clean bold title & micro-cue */}
                    <div className="relative z-10 mt-auto pt-3">
                      <h3 className="text-sm sm:text-base font-bold text-white leading-snug tracking-tight truncate drop-shadow-xs">
                        {item.name}
                      </h3>
                      {hasSubModules ? (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium text-white/75 group-hover:text-white transition-colors">
                          <Layers className="h-3 w-3 shrink-0 text-white/80" />
                          <span className="truncate">Hover to explore</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium text-white/60">
                          <span className="truncate">Direct launch</span>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* ── Fancy Frosted Glass Sub-Modules Popover on Hover ──────── */}
                  {hasSubModules && (
                    <div
                      className={cn(
                        "absolute z-50 w-[340px] sm:w-[380px] rounded-2xl p-3.5 shadow-2xl transition-all duration-200 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto",
                        // Bottom row items bloom upward so they never get clipped by the viewport
                        index >= 10
                          ? "bottom-[calc(100%+8px)] mb-1"
                          : "top-[calc(100%+8px)] mt-1",
                        // Right columns align right so they never overflow window edge
                        index % 5 >= 3
                          ? "right-0 left-auto"
                          : "left-0 right-auto"
                      )}
                      style={{
                        background: isDark ? 'rgba(10, 20, 38, 0.94)' : 'rgba(255, 255, 255, 0.97)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(0,0,0,0.1)',
                        boxShadow: isDark
                          ? '0 20px 40px -10px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)'
                          : '0 20px 40px -10px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.05)',
                        willChange: 'opacity, transform',
                      }}
                    >
                      {/* Popover Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-5 w-5 rounded-md flex items-center justify-center text-white shrink-0"
                            style={{ background: item.bg }}
                          >
                            <ItemIcon className="h-3 w-3" />
                          </div>
                          <span className={cn("text-xs font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* Submodules Grid */}
                      <div className={cn(
                        item.subModules.length > 4 ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"
                      )}>
                        {item.subModules.map((sub) => (
                          <Link
                            key={sub.name}
                            to={sub.href}
                            onMouseEnter={() => prefetchRoute(sub.href)}
                            onTouchStart={() => prefetchRoute(sub.href)}
                            onFocus={() => prefetchRoute(sub.href)}
                            className={cn(
                              "group/sub flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150",
                              isDark
                                ? "text-slate-200 bg-white/5 hover:bg-white/15 hover:text-white"
                                : "text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-950"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ background: item.dotColor }}
                              />
                              <span className="truncate">{sub.name}</span>
                            </div>
                            <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {omniOpen && <OmniSearch isOpen={omniOpen} onClose={() => setOmniOpen(false)} isDark={isDark} />}
    </div>
  );
}
