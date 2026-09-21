import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileText,
  Settings,
  UserPlus,
  MapPin,
  Landmark,
  ShieldCheck,
  ReceiptText,
  BarChart3,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  ListTodo,
  ClipboardCheck,
  BarChart2,
  Bell,
  History,
  Calculator,
  MessageSquare,
  Package,
  Fuel,
  Truck,
  ArrowRightLeft,
  ShoppingCart,
  Activity,
  FolderOpen,
  Sparkles,
  HardHat,
  PiggyBank,
} from 'lucide-react';
import { NairaSign } from '@/src/components/ui/naira-sign';
import { UserPrivileges } from '@/src/store/userStore';
import { IS_LIMITED_WEB_WEB } from '@/src/lib/utils';

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  privKey: keyof UserPrivileges | 'custom';
  privField: string;
  visible?: (user: any) => boolean;
  activeTab?: string;
  subItems?: NavItem[];
}

export interface NavCategory {
  name: string;
  subtitle: string;
  icon: any;
  color: string;
  bgLight: string;
  bgDark: string;
  iconColor: string;
  items: NavItem[];
  standalone?: boolean;
  standaloneHref?: string;
}

export const navigation: NavCategory[] = [
  // ── Standalone Direct Tools ──────────────────────────────────────────────
  {
    name: 'Dashboard',
    subtitle: 'DASHBOARD',
    icon: LayoutDashboard,
    color: 'from-blue-600 to-sky-600',
    bgLight: 'bg-blue-50 hover:bg-blue-100',
    bgDark: 'dark:bg-blue-950/40 dark:hover:bg-blue-900/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    standalone: true,
    standaloneHref: '/tasks/dashboard',
    items: [
      { name: 'Dashboard', href: '/tasks/dashboard', icon: LayoutDashboard, privKey: 'tasks', privField: 'canViewDashboard' },
    ],
  },

  // ── Multi-Module Categories ──────────────────────────────────────────────
  {
    name: 'Clients',
    subtitle: 'CLIENTS & RECON',
    icon: Sparkles,
    color: 'from-teal-500 to-cyan-600',
    bgLight: 'bg-teal-50 hover:bg-teal-100',
    bgDark: 'dark:bg-teal-950/40 dark:hover:bg-teal-900/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
    items: [
      {
        name: 'Client 360',
        href: '/client-360',
        icon: Sparkles,
        privKey: 'sites',
        privField: 'canView',
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
    subtitle: 'TASKS & COMMUNICATION',
    icon: MessageSquare,
    color: 'from-sky-600 to-blue-600',
    bgLight: 'bg-sky-50 hover:bg-sky-100',
    bgDark: 'dark:bg-sky-950/40 dark:hover:bg-sky-900/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    items: [
      { name: 'Task Register', href: '/tasks', icon: ClipboardCheck, privKey: 'tasks', privField: 'canViewMyTasks' },
      { name: 'Task Reminders', href: '/tasks/reminders', icon: Bell, privKey: 'tasks', privField: 'canViewReminders' },
      { name: 'External Comms', href: '/comm-log', icon: MessageSquare, privKey: 'commLog', privField: 'canView' },
      { name: 'Daily Journals', href: '/daily-journal', icon: BookOpen, privKey: 'dailyJournal', privField: 'canView' },
    ],
  },
  {
    name: 'Tools',
    subtitle: 'OPERATIONS TOOLS',
    icon: HardHat,
    color: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 hover:bg-amber-100',
    bgDark: 'dark:bg-amber-950/40 dark:hover:bg-amber-900/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    items: [
      { name: 'Simulator', href: '/operations/simulator', icon: HardHat, privKey: 'simulator', privField: 'canView' },
      { name: 'Dewatering Calculator', href: '/operations/dewatering-calculator', icon: Calculator, privKey: 'simulator', privField: 'canView' },
      { name: 'Logistics Estimator', href: '/operations/estimator', icon: Calculator, privKey: 'simulator', privField: 'canView' },
      { name: 'VAT Calculator', href: '/operations/vat-calculator', icon: Calculator, privKey: 'simulator', privField: 'canView' },
    ],
  },
  {
    name: 'HR',
    subtitle: 'HUMAN RESOURCES',
    icon: Users,
    color: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50 hover:bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    items: [
      { name: 'HR Dashboard', href: '/hr-dashboard', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView' },
      { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
      { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
      { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'onboarding', privField: 'canView' },
      { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
      { name: 'Salary & Loan Advance', href: '/salary-loans', icon: NairaSign, privKey: 'salaryLoans', privField: 'canView' },
      { name: 'HMO Management', href: '/hmo', icon: ShieldCheck, privKey: 'hmo', privField: 'canView' },
      { name: 'Evaluations', href: '/evaluations', icon: ClipboardList, privKey: 'evaluations', privField: 'canView' },
      { name: 'Interviews', href: '/interviews', icon: Users, privKey: 'interviews', privField: 'canView' },
      { name: 'Performance & Conduct', href: '/performance-conduct', icon: AlertTriangle, privKey: 'disciplinary', privField: 'canView' },
    ],
  },
  {
    name: 'Operations',
    subtitle: 'OPERATIONS & SITES',
    icon: Package,
    color: 'from-orange-500 to-amber-600',
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
    name: 'Accounts',
    subtitle: 'FINANCE & PAYROLL',
    icon: Landmark,
    color: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 hover:bg-amber-100',
    bgDark: 'dark:bg-amber-950/40 dark:hover:bg-amber-900/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
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
      { name: 'Bank AI Import', href: '/bank-import', icon: Sparkles, privKey: 'bankImport', privField: 'canView' },
      { name: 'Company Expenses', href: '/company-expenses', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
      { name: 'Budget', href: '/budget', icon: PiggyBank, privKey: 'budget', privField: 'canView' },
    ],
  },
  {
    name: 'Reports',
    subtitle: 'REPORTS & EXPORTS',
    icon: FolderOpen,
    color: 'from-rose-500 to-red-600',
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
    subtitle: 'ADMIN & SYSTEM',
    icon: Settings,
    color: 'from-slate-600 to-slate-700',
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

/**
 * Filter NavItems according to user privileges and limited web mode
 */
export function getVisibleNavItems(items: NavItem[], currentUser: any): NavItem[] {
  return items.filter((item) => {
    if (IS_LIMITED_WEB_WEB) {
      const isTaskPath = item.href.startsWith('/tasks') || item.href === '/comm-log';
      const isDashboardPath = item.href === '/';
      const isCompanyExpenses = item.href === '/company-expenses';
      const isDailyJournal = item.href === '/daily-journal';
      if (!isTaskPath && !isDashboardPath && !isCompanyExpenses && !isDailyJournal) return false;
    }

    if (!currentUser) return false;

    // Super admin override: users with canManage can view everything
    if (currentUser?.privileges?.users?.canManage === true) {
      if (item.visible) return item.visible(currentUser);
      return true;
    }

    if (item.visible) return item.visible(currentUser);
    if (item.privKey === 'custom') return false;

    const pagePriv = (currentUser.privileges as any)?.[item.privKey] as Record<string, boolean> | undefined;
    if (item.privField !== 'canView' && pagePriv?.['canView'] !== true) return false;
    return pagePriv?.[item.privField] === true;
  });
}

/**
 * Determine the first accessible destination route for a given category
 */
export function getFirstAccessibleHref(category: NavCategory, currentUser: any): string | null {
  if (category.standalone && category.standaloneHref) {
    const visible = getVisibleNavItems(category.items, currentUser);
    return visible.length > 0 ? category.standaloneHref : null;
  }
  const visible = getVisibleNavItems(category.items, currentUser);
  return visible.length > 0 ? visible[0].href : null;
}

/**
 * Find the active category for a given route pathname
 */
export function getActiveCategory(pathname: string, navList: NavCategory[] = navigation): NavCategory | null {
  if (!pathname || pathname === '/home' || pathname === '/') return null;

  // 1. Exact match on standaloneHref or item.href
  for (const cat of navList) {
    if (cat.standalone && cat.standaloneHref === pathname) {
      return cat;
    }
    for (const item of cat.items) {
      if (item.href === pathname) {
        return cat;
      }
      if (item.subItems?.some((sub) => sub.href === pathname)) {
        return cat;
      }
    }
  }

  // 2. Prefix match (e.g. /operations/vehicles/xyz or /attendance/...)
  // Sort items by href length descending so longer, more specific prefixes match first
  let bestMatch: { cat: NavCategory; hrefLength: number } | null = null;
  for (const cat of navList) {
    if (cat.standalone && cat.standaloneHref && cat.standaloneHref !== '/') {
      if (pathname.startsWith(cat.standaloneHref + '/') || pathname === cat.standaloneHref) {
        if (!bestMatch || cat.standaloneHref.length > bestMatch.hrefLength) {
          bestMatch = { cat, hrefLength: cat.standaloneHref.length };
        }
      }
    }
    for (const item of cat.items) {
      if (item.href !== '/') {
        if (pathname.startsWith(item.href + '/') || pathname.startsWith(item.href)) {
          if (!bestMatch || item.href.length > bestMatch.hrefLength) {
            bestMatch = { cat, hrefLength: item.href.length };
          }
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch.cat;
  }

  // 3. Fallback matching on root segment (e.g., /operations/* -> Operations, /tasks/* -> Tasks)
  const firstSegment = pathname.split('/')[1]?.toLowerCase();
  if (firstSegment) {
    const matchedBySegment = navList.find((c) => {
      if (c.name.toLowerCase() === firstSegment) return true;
      if (c.standaloneHref?.toLowerCase().includes(`/${firstSegment}`)) return true;
      return c.items.some((i) => i.href.toLowerCase().includes(`/${firstSegment}`));
    });
    if (matchedBySegment) return matchedBySegment;
  }

  return null;
}
