import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { prefetchRoute } from '@/src/lib/routePrefetch';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { useTheme } from '@/src/hooks/useTheme';
import { toast, showConfirm } from '@/src/components/ui/toast';
import logoSrc from '../../../logo/logo-2.png';
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
  ChevronDown,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ListTodo,
  BellRing,
  ClipboardCheck,
  BarChart2,
  Bell,
  History,
  MessageSquare,
  Package,
  Truck,
  ArrowRightLeft,
  PieChart,
  Undo2,
  ShoppingCart,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { NairaSign } from '@/src/components/ui/naira-sign';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  privKey: keyof UserPrivileges | 'custom';
  privField: string;
  visible?: (user: any) => boolean;
  /** For tab-shell pages: auto-sets the initial tab via router state */
  activeTab?: string;
  subItems?: NavItem[];
}

interface NavCategory {
  name: string;
  icon: any;
  items: NavItem[];
  /** If true, renders as a direct link (no dropdown) */
  standalone?: boolean;
  standaloneHref?: string;
}

const navigation: NavCategory[] = [
  // ── Dashboard — standalone direct link ───────────────────────────────────
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    standalone: true,
    standaloneHref: '/',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView' },
    ],
  },
  // ── Tasks ────────────────────────────────────────────────────────
  {
    name: 'Tasks',
    icon: ListTodo,
    items: [
      { name: 'Task Dashboard', href: '/tasks/dashboard', icon: BarChart2, privKey: 'tasks', privField: 'canViewDashboard' },
      { name: 'Task', href: '/tasks', icon: ClipboardCheck, privKey: 'tasks', privField: 'canViewMyTasks' },
      { name: 'External Comms', href: '/comm-log', icon: MessageSquare, privKey: 'commLog', privField: 'canView' },
      { name: 'Reminders', href: '/tasks/reminders', icon: Bell, privKey: 'tasks', privField: 'canViewReminders' },
      { name: 'Reports', href: '/tasks/reports', icon: BarChart3, privKey: 'tasks', privField: 'canViewReports' },
    ],
  },
  // ── HR ───────────────────────────────────────────────────────────────────
  {
    name: 'HR',
    icon: Users,
    items: [
      { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
      { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
      { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'onboarding', privField: 'canView' },
      { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
      { name: 'Salary & Loan Advance', href: '/salary-loans', icon: NairaSign, privKey: 'salaryLoans', privField: 'canView' },
      { name: 'Evaluations', href: '/evaluations', icon: ClipboardList, privKey: 'evaluations', privField: 'canView' },
      { name: 'Performance & Conduct', href: '/performance-conduct', icon: AlertTriangle, privKey: 'disciplinary', privField: 'canView' },
      { name: 'HR Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
    ],
  },
  // ── Operations ───────────────────────────────────────────────────────────
  {
    name: 'Operations',
    icon: Package,
    items: [
      { name: 'Overview', href: '/operations', icon: LayoutDashboard, privKey: 'operations', privField: 'canView' },
      { name: 'Inventory', href: '/operations/assets', icon: Package, privKey: 'opsInventory', privField: 'canView' },
      { name: 'Waybills', href: '/operations/waybills', icon: FileText, privKey: 'opsWaybills', privField: 'canView' },
      { name: 'Quick Checkout', href: '/operations/checkout', icon: ShoppingCart, privKey: 'opsCheckout', privField: 'canView' },
      { name: 'Maintenance', href: '/operations/maintenance', icon: Activity, privKey: 'opsMaintenance', privField: 'canView' },
      { name: 'Vehicles', href: '/operations/vehicles', icon: Truck, privKey: 'opsVehicles', privField: 'canView' },
      { name: 'Sites', href: '/operations/sites', icon: MapPin, privKey: 'opsSites', privField: 'canView' },
    ],
  },
  // ── Clients ───────────────────────────────────────────────────────────────
  {
    name: 'Clients',
    icon: Building2,
    items: [
      { name: 'Sites & Clients', href: '/sites', icon: MapPin, privKey: 'sites', privField: 'canView' },
    ],
  },
  // ── Account ───────────────────────────────────────────────────────────────
  {
    name: 'Account',
    icon: Landmark,
    items: [
      { name: 'Client Accounts', href: '/client-accounts', icon: ReceiptText, privKey: 'custom', privField: '', visible: (user: any) => user?.privileges?.billing?.canView || user?.privileges?.payments?.canView || user?.privileges?.payments?.canViewVat },
      { name: 'Payroll', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView' },
      { name: 'Non-Employee Directory', href: '/beneficiaries', icon: Users, privKey: 'beneficiaries', privField: 'canView' },
      { name: 'Ledger', href: '/ledger', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
      { name: 'Company Expenses', href: '/company-expenses', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
      { name: 'Account Reports', href: '/financial-reports', icon: BarChart3, privKey: 'financialReports', privField: 'canView' },
    ],
  },
  {
    name: 'Setting',
    icon: Settings,
    items: [
      { name: 'User Management', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView' },
      { name: 'Settings', href: '/settings', icon: Settings, privKey: 'variables', privField: 'canView' },
      { name: 'Activity Log', href: '/activity-log', icon: History, privKey: 'activityLog', privField: 'canView' },
    ],
  },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const pendingLedgerEntries = useAppStore((s) => s.pendingLedgerEntries);
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLinkClick = async (e: React.MouseEvent, href: string) => {
    const { isVariablesDirty, setVariablesDirty, isLedgerDirty, setLedgerDirty } = useAppStore.getState();

    if (location.pathname === '/ledger' && (pendingLedgerEntries.length > 0 || isLedgerDirty) && href !== '/ledger') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved entries in the ledger. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger'
      });
      if (ok) {
        setLedgerDirty(false);
        setIsOpen?.(false);
        navigate(href);
      }
      return;
    }

    if (location.pathname === '/settings' && isVariablesDirty && href !== '/settings') {
      e.preventDefault();
      const ok = await showConfirm('You have unsaved variable changes. Do you want to discard them and leave?', {
        title: 'Unsaved Changes',
        confirmLabel: 'Discard & Leave',
        cancelLabel: 'Stay Here',
        variant: 'danger'
      });
      if (ok) {
        setVariablesDirty(false);
        setIsOpen?.(false);
        navigate(href);
      }
      return;
    }

    setIsOpen?.(false);
  };

  const getVisibleItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!currentUser) return false;
      if (item.visible) return item.visible(currentUser);
      if (item.privKey === 'custom') return false;
      
      let pagePriv = (currentUser.privileges[item.privKey] as unknown) as Record<string, boolean>;
      
      if (item.privField !== 'canView' && pagePriv?.['canView'] !== true) return false;
      return pagePriv?.[item.privField] === true;
    });
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((name) => name !== categoryName)
        : [...prev, categoryName]
    );
  };

  // ── Theme tokens (shared across all categories) ────────────────────────────
  const sidebarBg   = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200';
  const navBg       = isDark ? 'bg-slate-900' : 'bg-gradient-to-b from-blue-600 via-indigo-600 to-violet-700';
  const catBtnBase  = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-white hover:bg-white hover:text-blue-600';
  const catBtnActive = isDark ? 'bg-blue-700 text-white shadow-md' : 'bg-white text-blue-600 shadow-md';
  const itemBase    = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-white/95 hover:bg-white hover:text-blue-600';
  const itemActive  = isDark ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-blue-600 shadow-md';
  const iconBase    = isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-white/70 group-hover:text-inherit';
  const iconActive  = isDark ? 'text-white' : 'text-blue-600';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen?.(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          'fixed lg:relative flex h-full flex-col border-r transition-all duration-300 z-40',
          sidebarBg,
          isCollapsed ? 'w-20' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Area */}
        <div className={cn('flex h-16 shrink-0 items-center border-b border-transparent transition-all', isCollapsed ? 'px-0 justify-center' : 'px-6 justify-between')}>
          <div className={cn('flex items-center gap-2 font-bold text-xl text-blue-600 overflow-hidden transition-all duration-300', isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100')}>
            <img
              src={logoSrc}
              alt="HR System"
              className="h-10 w-auto min-w-max"
              style={isDark ? { filter: 'brightness(0) invert(1)', opacity: 0.9 } : {}}
            />
          </div>
          <div className="flex items-center">
            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn('hidden lg:flex p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors', isDark && 'hover:bg-slate-800 hover:text-slate-300')}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            {/* Mobile Close Button */}
            <button onClick={() => setIsOpen?.(false)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col overflow-y-auto overflow-x-hidden", navBg)}>
          <nav className={cn('flex-1 space-y-2 py-4', isCollapsed ? 'px-2' : 'px-3')}>
            {navigation.map((category) => {
              const visibleItems = getVisibleItems(category.items);
              if (visibleItems.length === 0) return null;

              const isAnyItemActive = visibleItems.some(
                (item) => location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href + '/'))
              );
              const isDashboardActive = category.standalone && (location.pathname === category.standaloneHref);

              // ── STANDALONE: Dashboard — single link, no dropdown ───────────
              if (category.standalone) {
                return (
                  <div key={category.name} className="mb-1">
                    <Link
                      to={category.standaloneHref!}
                      onClick={(e) => handleLinkClick(e, category.standaloneHref!)}
                      onMouseEnter={() => prefetchRoute(category.standaloneHref!)}
                      title={isCollapsed ? category.name : undefined}
                      className={cn(
                        'flex w-full items-center rounded-md py-2 text-sm font-semibold transition-colors',
                        isCollapsed ? 'px-0 justify-center' : 'px-3',
                        isDashboardActive ? catBtnActive : catBtnBase
                      )}
                    >
                      <div className={cn('flex items-center', isCollapsed && 'justify-center w-full')}>
                        <category.icon className={cn('h-5 w-5', !isCollapsed && 'mr-3')} />
                        {!isCollapsed && category.name}
                      </div>
                    </Link>
                  </div>
                );
              }

              // ── STANDARD: Collapsible category — all categories identical ──
              const isExpanded = isCollapsed ? isAnyItemActive : expandedCategories.includes(category.name);

              return (
                <div key={category.name} className="mb-4">
                  {/* Category Header */}
                  <button
                    onClick={() => {
                      if (isCollapsed) setIsCollapsed(false);
                      else toggleCategory(category.name);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                      isDark ? 'text-slate-500 hover:text-slate-700' : 'text-white/80 hover:text-white',
                      isCollapsed && 'justify-center cursor-default'
                    )}
                  >
                    <span>{isCollapsed ? '•••' : category.name}</span>
                    {!isCollapsed && (
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isExpanded ? 'rotate-180' : '')} />
                    )}
                  </button>

                  {/* Sub-items */}
                  {isExpanded && (
                    <div className={cn('mt-1 space-y-1', isCollapsed ? 'pl-0' : 'pl-4')}>
                      {visibleItems.map((item) => {
                        const visibleSubItems = item.subItems ? getVisibleItems(item.subItems) : [];
                        const isActive = location.pathname === item.href || visibleSubItems.some(sub => location.pathname === sub.href);
                        
                        return (
                          <div key={item.name} className="flex flex-col gap-0.5">
                            <Link
                              to={item.href}
                              onClick={(e) => handleLinkClick(e, item.href)}
                              onMouseEnter={() => prefetchRoute(item.href)}
                              title={isCollapsed ? item.name : undefined}
                              className={cn(
                                'group flex items-center rounded-md py-2.5 text-sm font-medium transition-colors',
                                isCollapsed ? 'px-0 justify-center' : 'px-3',
                                isActive ? itemActive : itemBase
                              )}
                            >
                              <item.icon
                                className={cn(
                                  'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                                  !isCollapsed && 'mr-3',
                                  isActive ? iconActive : iconBase
                                )}
                                aria-hidden="true"
                              />
                              {!isCollapsed && <span className="truncate">{item.name}</span>}
                            </Link>

                            {/* Rendering sub-items if not collapsed */}
                            {!isCollapsed && visibleSubItems.length > 0 && (
                              <div className={cn("ml-7 flex flex-col gap-0.5 border-l pl-2 mt-0.5", isDark ? "border-slate-800/50" : "border-white/10")}>
                                {visibleSubItems.map((subItem) => {
                                  const isSubActive = location.pathname === subItem.href;
                                  return (
                                    <Link
                                      key={subItem.name}
                                      to={subItem.href}
                                      onClick={(e) => handleLinkClick(e, subItem.href)}
                                      onMouseEnter={() => prefetchRoute(subItem.href)}
                                      className={cn(
                                        'group flex items-center rounded-md py-2 px-3 text-xs font-medium transition-colors',
                                        isSubActive ? itemActive : itemBase
                                      )}
                                    >
                                      <subItem.icon
                                        className={cn(
                                          'h-4 w-4 mr-2.5 transition-colors',
                                          isSubActive ? iconActive : iconBase
                                        )}
                                      />
                                      <span className="truncate">{subItem.name}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
