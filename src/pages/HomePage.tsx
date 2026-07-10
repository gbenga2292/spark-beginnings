import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../hooks/useTheme';
import { IS_LIMITED_WEB_WEB } from '../lib/utils';
import { cn } from '../lib/utils';
import logoSrc from '../../logo/logo-2.png';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileText,
  Settings,
  UserPlus,
  MapPin,
  Library,
  Landmark,
  ShieldCheck,
  Building2,
  ReceiptText,
  BarChart3,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  ListTodo,
  BellRing,
  ClipboardCheck,
  BarChart2,
  Bell,
  History,
  MessageSquare,
  Package,
  Fuel,
  Truck,
  ArrowRightLeft,
  ShoppingCart,
  Activity,
  FolderOpen,
  Sparkles,
  TrendingUp,
  ChevronRight,
  User,
  LogOut,
  Search,
  X,
  HardHat,
  PiggyBank,
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { NairaSign } from '../components/ui/naira-sign';
import { useNavigate } from 'react-router-dom';
import { toast, showConfirm } from '../components/ui/toast';

// ── Same NavItem types as Sidebar ────────────────────────────────────────────
interface NavItem {
  name: string;
  href: string;
  icon: any;
  privKey: string;
  privField: string;
  visible?: (user: any) => boolean;
}

interface NavCategory {
  name: string;
  icon: any;
  color: string;         // Tailwind gradient pair
  bgLight: string;
  bgDark: string;
  iconColor: string;
  items: NavItem[];
  standalone?: boolean;
  standaloneHref?: string;
}

// ── Navigation definition (mirrors Sidebar exactly) ─────────────────────────
const navigation: NavCategory[] = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    color: 'from-indigo-500 to-indigo-600',
    bgLight: 'bg-indigo-50 hover:bg-indigo-100',
    bgDark: 'dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    standalone: true,
    standaloneHref: '/tasks/dashboard',
    items: [
      { name: 'Dashboard', href: '/tasks/dashboard', icon: LayoutDashboard, privKey: 'tasks', privField: 'canViewDashboard' },
    ],
  },
  {
    name: 'Client 360',
    icon: Sparkles,
    color: 'from-cyan-500 to-teal-500',
    bgLight: 'bg-cyan-50 hover:bg-cyan-100',
    bgDark: 'dark:bg-cyan-950/40 dark:hover:bg-cyan-900/60',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    standalone: true,
    standaloneHref: '/client-360',
    items: [
      { name: 'Client 360', href: '/client-360', icon: Sparkles, privKey: 'sites', privField: 'canView' },
    ],
  },
  {
    name: 'Simulator',
    icon: HardHat,
    color: 'from-blue-500 to-indigo-500',
    bgLight: 'bg-blue-50 hover:bg-blue-100',
    bgDark: 'dark:bg-blue-950/40 dark:hover:bg-blue-900/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    standalone: true,
    standaloneHref: '/operations/simulator',
    items: [
      { name: 'Simulator', href: '/operations/simulator', icon: HardHat, privKey: 'simulator', privField: 'canView' },
    ],
  },
  {
    name: 'Machine Recon',
    icon: ArrowRightLeft,
    color: 'from-teal-500 to-cyan-500',
    bgLight: 'bg-teal-50 hover:bg-teal-100',
    bgDark: 'dark:bg-teal-950/40 dark:hover:bg-teal-900/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
    standalone: true,
    standaloneHref: '/operations/machine-reconciliation',
    items: [
      { name: 'Machine Reconciliation', href: '/operations/machine-reconciliation', icon: ArrowRightLeft, privKey: 'opsMachineRecon', privField: 'canView' },
    ],
  },
  {
    name: 'Budget',
    icon: PiggyBank,
    color: 'from-emerald-500 to-green-600',
    bgLight: 'bg-emerald-50 hover:bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    standalone: true,
    standaloneHref: '/budget',
    items: [
      { name: 'Budget', href: '/budget', icon: PiggyBank, privKey: 'budget', privField: 'canView' },
    ],
  },
  {
    name: 'Tasks',
    icon: ListTodo,
    color: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50 hover:bg-violet-100',
    bgDark: 'dark:bg-violet-950/40 dark:hover:bg-violet-900/60',
    iconColor: 'text-violet-600 dark:text-violet-400',
    items: [
      { name: 'Task Register', href: '/tasks', icon: ClipboardCheck, privKey: 'tasks', privField: 'canViewMyTasks' },
      { name: 'Reminders', href: '/tasks/reminders', icon: Bell, privKey: 'tasks', privField: 'canViewReminders' },
      { name: 'Task Reports', href: '/tasks/reports', icon: ClipboardList, privKey: 'tasks', privField: 'canViewReports' },
    ],
  },
  {
    name: 'Comms & Journals',
    icon: MessageSquare,
    color: 'from-sky-500 to-blue-600',
    bgLight: 'bg-sky-50 hover:bg-sky-100',
    bgDark: 'dark:bg-sky-950/40 dark:hover:bg-sky-900/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    items: [
      { name: 'External Comms', href: '/comm-log', icon: MessageSquare, privKey: 'commLog', privField: 'canView' },
      { name: 'Daily Journal', href: '/daily-journal', icon: BookOpen, privKey: 'dailyJournal', privField: 'canView' },
    ],
  },
  {
    name: 'HR',
    icon: Users,
    color: 'from-emerald-500 to-green-600',
    bgLight: 'bg-emerald-50 hover:bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    items: [
      { name: 'HR Dashboard', href: '/hr-dashboard', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView' },
      { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
      { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
      { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'onboarding', privField: 'canView' },
      { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
      { name: 'Salary & Loan Advance', href: '/salary-loans', icon: Wallet, privKey: 'salaryLoans', privField: 'canView' },
      { name: 'HMO Management', href: '/hmo', icon: ShieldCheck, privKey: 'hmo', privField: 'canView' },
      { name: 'Evaluations', href: '/evaluations', icon: ClipboardList, privKey: 'evaluations', privField: 'canView' },
      { name: 'Interviews', href: '/interviews', icon: Users, privKey: 'interviews', privField: 'canView' },
      { name: 'Performance & Conduct', href: '/performance-conduct', icon: AlertTriangle, privKey: 'disciplinary', privField: 'canView' },
    ],
  },
  {
    name: 'Operations',
    icon: Package,
    color: 'from-orange-500 to-amber-500',
    bgLight: 'bg-orange-50 hover:bg-orange-100',
    bgDark: 'dark:bg-orange-950/40 dark:hover:bg-orange-900/60',
    iconColor: 'text-orange-600 dark:text-orange-400',
    items: [
      { name: 'Overview', href: '/operations', icon: LayoutDashboard, privKey: 'operations', privField: 'canView' },
      { name: 'Inventory', href: '/operations/assets', icon: Package, privKey: 'opsInventory', privField: 'canView' },
      { name: 'Waybills', href: '/operations/waybills', icon: FileText, privKey: 'opsWaybills', privField: 'canView' },
      { name: 'Quick Checkout', href: '/operations/checkout', icon: ShoppingCart, privKey: 'opsCheckout', privField: 'canView' },
      { name: 'Maintenance', href: '/operations/maintenance', icon: Activity, privKey: 'opsMaintenance', privField: 'canView' },
      { name: 'Diesel Refill', href: '/operations/diesel', icon: Fuel, privKey: 'opsDiesel', privField: 'canView' },
      { name: 'Vehicles', href: '/operations/vehicles', icon: Truck, privKey: 'opsVehicles', privField: 'canView' },
      { name: 'Sites', href: '/operations/sites', icon: MapPin, privKey: 'opsSites', privField: 'canView' },
    ],
  },
  {
    name: 'Account',
    icon: Landmark,
    color: 'from-yellow-500 to-amber-600',
    bgLight: 'bg-yellow-50 hover:bg-yellow-100',
    bgDark: 'dark:bg-yellow-950/40 dark:hover:bg-yellow-900/60',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    items: [
      {
        name: 'Client Accounts',
        href: '/client-accounts',
        icon: ReceiptText,
        privKey: 'custom',
        privField: '',
        visible: (user: any) =>
          user?.privileges?.billing?.canView ||
          user?.privileges?.payments?.canView ||
          user?.privileges?.payments?.canViewVat,
      },
      { name: 'Payroll', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView' },
      { name: 'Non-Employee Directory', href: '/beneficiaries', icon: Users, privKey: 'beneficiaries', privField: 'canView' },
      { name: 'Ledger', href: '/ledger', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
      { name: 'Company Expenses', href: '/company-expenses', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
    ],
  },
  {
    name: 'Reports',
    icon: FolderOpen,
    color: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50 hover:bg-rose-100',
    bgDark: 'dark:bg-rose-950/40 dark:hover:bg-rose-900/60',
    iconColor: 'text-rose-600 dark:text-rose-400',
    items: [
      { name: 'HR Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
      { name: 'Account Reports', href: '/financial-reports', icon: BarChart3, privKey: 'financialReports', privField: 'canView' },
      { name: 'Task Reports', href: '/tasks/reports', icon: ClipboardList, privKey: 'tasks', privField: 'canViewReports' },
      { name: 'Weekly Report', href: '/weekly-report', icon: BarChart2, privKey: 'weeklyReport', privField: 'canView' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    color: 'from-slate-500 to-slate-600',
    bgLight: 'bg-slate-100 hover:bg-slate-200',
    bgDark: 'dark:bg-slate-800/60 dark:hover:bg-slate-700/80',
    iconColor: 'text-slate-600 dark:text-slate-400',
    items: [
      { name: 'User Management', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView' },
      { name: 'Settings', href: '/settings', icon: Settings, privKey: 'variables', privField: 'canView' },
      { name: 'Activity Log', href: '/activity-log', icon: History, privKey: 'activityLog', privField: 'canView' },
    ],
  },
];

// ── Greeting helper ───────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Avatar initials helper ────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Main component ────────────────────────────────────────────────────────────
import { OmniSearch } from '@/src/components/common/OmniSearch';
export function HomePage() {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Exact same permission logic as Sidebar.getVisibleItems ───────────────
  const getVisibleItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (IS_LIMITED_WEB_WEB) {
        const isTaskPath = item.href.startsWith('/tasks') || item.href === '/comm-log';
        const isDashboardPath = item.href === '/';
        const isCompanyExpenses = item.href === '/company-expenses';
        const isDailyJournal = item.href === '/daily-journal';
        if (!isTaskPath && !isDashboardPath && !isCompanyExpenses && !isDailyJournal) return false;
      }

      if (!currentUser) return false;
      if (item.visible) return item.visible(currentUser);
      if (item.privKey === 'custom') return false;

      const pagePriv = (currentUser.privileges as any)[item.privKey] as Record<string, boolean>;
      if (item.privField !== 'canView' && pagePriv?.['canView'] !== true) return false;
      return pagePriv?.[item.privField] === true;
    });
  };

  const handleSignOut = async () => {
    const ok = await showConfirm('Are you sure you want to sign out?', {
      title: 'Sign Out',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Stay',
      variant: 'danger',
    });
    if (!ok) return;
    await supabase.auth.signOut();
    navigate('/login');
  };

  const totalAccessible = navigation.reduce((acc, cat) => {
    const v = getVisibleItems(cat.items);
    return acc + v.length;
  }, 0);

  // ── Home-page global search (OmniSearch) ────────────────────────────────────────────────
  const [omniOpen, setOmniOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'min-h-full w-full flex flex-col',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      )}
    >
      {/* ── Compact Hero Header ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'sticky top-0 z-50 px-4 py-2 md:px-6 md:py-3',
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800'
            : 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 shadow-sm'
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative flex flex-row items-center justify-between max-w-screen-xl mx-auto gap-2">
          {/* Left: Greeting */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
            <Link
              to="/profile"
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md ring-1 ring-white/20 hover:ring-white/40 transition-all"
              style={{
                background: currentUser?.avatarColor
                  ? currentUser.avatarColor
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              }}
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="h-full w-full rounded-xl object-cover" />
              ) : (
                getInitials(currentUser?.name || 'U')
              )}
            </Link>
            <div className="min-w-0 flex flex-col justify-center">
               <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                 <span className="hidden sm:inline">{getGreeting()}, </span>
                 {currentUser?.name?.split(' ')[0] || 'User'}
               </h1>
            </div>
          </div>

          {/* Center: Desktop search using OmniSearch */}
          <div className="relative hidden sm:block flex-1 max-w-xs mx-4">
            <button
              onClick={() => setOmniOpen(true)}
              className={cn(
                'flex items-center w-full gap-2 px-3 py-1.5 rounded-full border transition-all',
                'bg-white/15 border-white/25 hover:bg-white/25 hover:border-white/50 backdrop-blur-sm'
              )}
            >
              <Search className="w-3.5 h-3.5 text-white/60 shrink-0" />
              <span className="text-white/60 text-xs font-medium flex-1 text-left">Search anything...</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-white/60 bg-white/5 font-sans">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500/80 backdrop-blur-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Search Bar (triggers OmniSearch) ─────────────────────────────────────────── */}
      <div className="sm:hidden px-4 pt-3 pb-1 relative">
        <button
          onClick={() => setOmniOpen(true)}
          className={cn(
            'flex items-center w-full gap-2 px-3 py-2 rounded-xl border shadow-sm transition-all',
            isDark
              ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          )}
        >
          <Search className={cn('w-4 h-4 shrink-0', isDark ? 'text-slate-400' : 'text-slate-400')} />
          <span className={cn('text-sm font-medium flex-1 text-left', isDark ? 'text-slate-500' : 'text-slate-400')}>
            Search anything...
          </span>
        </button>
      </div>

      {/* ── Compact Grid ─────────────────────────────────────────────────────── */}
      <div className="w-full px-4 py-3 md:px-6 md:py-5 max-w-[1600px] mx-auto">
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3 md:gap-4">
          {navigation.map((category) => {
            // Web build filtering
            if (IS_LIMITED_WEB_WEB) {
              const allowed = ['Dashboard', 'Client 360', 'Simulator', 'Tasks', 'Account', 'Comms & Journals'];
              if (!allowed.includes(category.name)) return null;
            }

            const visibleItems = getVisibleItems(category.items);
            if (visibleItems.length === 0) return null;

            const CatIcon = category.icon;
            const isStandalone = category.standalone && visibleItems.length === 1;

            // Render standalone item (like Dashboard or Client 360) as a prominent action card
            if (isStandalone) {
              const item = visibleItems[0];
              return (
                <div key={category.name} className="w-full break-inside-avoid mb-3 md:mb-4">
                  <Link
                    to={item.href}
                    className={cn(
                      'group flex w-full items-center justify-between rounded-xl border p-3 sm:p-3.5 transition-all duration-200',
                      'hover:scale-[1.02] hover:shadow-md active:scale-[0.98]',
                      isDark
                        ? cn('border-slate-800 hover:border-slate-700', category.bgDark)
                        : cn('border-slate-200 bg-white shadow-sm hover:border-slate-300', category.bgLight)
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm', category.color)}>
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                         <h2 className={cn('text-sm font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>{item.name}</h2>
                         <p className={cn('text-[10px] uppercase tracking-wider font-semibold mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{category.name}</p>
                      </div>
                    </div>
                    <ChevronRight className={cn('h-4 w-4 transition-transform duration-200 group-hover:translate-x-1', category.iconColor)} />
                  </Link>
                </div>
              );
            }

            // Render standard category as a card containing a list of modules
            return (
              <div key={category.name} className="w-full break-inside-avoid mb-3 md:mb-4">
                <div className={cn(
                   'w-full rounded-xl border p-3 sm:p-3.5 shadow-sm',
                   isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'
                )}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <CatIcon className={cn('h-4 w-4', category.iconColor)} />
                    <h2 className={cn('text-xs font-bold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {category.name}
                    </h2>
                  </div>

                  {/* Module List */}
                  <div className="flex flex-col gap-1">
                    {visibleItems.map(item => {
                       const Icon = item.icon;
                       return (
                         <Link
                           key={item.href + item.name}
                           to={item.href}
                           className={cn(
                             'group flex w-full items-center justify-between rounded-lg px-2 py-1.5 sm:py-2 transition-colors',
                             isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                           )}
                         >
                           <div className="flex items-center gap-2.5">
                             <Icon className={cn('h-4 w-4 transition-colors', isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-600')} />
                             <span className={cn('text-sm font-medium', isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-900')}>
                               {item.name}
                             </span>
                           </div>
                           <ChevronRight className={cn('h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0', category.iconColor)} />
                         </Link>
                       )
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state — user has no modules */}
        {totalAccessible === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <ShieldCheck className="h-14 w-14 text-slate-300 dark:text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">
              No modules available
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
              You don't have permission to access any modules yet. Contact an administrator.
            </p>
            <Link
              to="/profile"
              className="mt-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              View Profile
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className={cn(
          'mt-4 border-t px-10 py-5 text-center text-xs',
          isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'
        )}
      >
        Select a module above to get started · {currentUser?.email}
      </div>
      <OmniSearch isOpen={omniOpen} onClose={() => setOmniOpen(false)} isDark={isDark} />
    </div>
  );
}
