import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
import { useTheme } from '@/src/hooks/useTheme';
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
  Receipt,
  DollarSign,
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
  Sparkles,
  ClipboardCheck,
  BarChart2,
  Bell
} from 'lucide-react';
import { useState } from 'react';

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
}

interface NavCategory {
  name: string;
  icon: any;
  items: NavItem[];
  isSpecial?: boolean;
}

const navigation: NavCategory[] = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView' },
    ],
  },
  {
    name: 'HR',
    icon: Users,
    items: [
      { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
      { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
      { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'onboarding', privField: 'canView' },
      { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
      { name: 'Salary & Loan Advance', href: '/salary-loans', icon: DollarSign, privKey: 'salaryLoans', privField: 'canView' },
      { name: 'Evaluations', href: '/evaluations', icon: ClipboardList, privKey: 'evaluations', privField: 'canView' },
      { name: 'Disciplinary', href: '/disciplinary', icon: AlertTriangle, privKey: 'disciplinary', privField: 'canView' },
      { name: 'HR Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
    ],
  },
  {
    name: 'Tasks',
    icon: ListTodo,
    isSpecial: true,
    items: [
      { name: 'My Tasks', href: '/tasks', icon: ClipboardCheck, privKey: 'custom', privField: '', visible: () => true },
      { name: 'Dashboard', href: '/tasks/dashboard', icon: BarChart2, privKey: 'custom', privField: '', visible: () => true },
      { name: 'Reminders', href: '/tasks/reminders', icon: Bell, privKey: 'custom', privField: '', visible: () => true },
    ],
  },
  {
    name: 'Admin',
    icon: Building2,
    items: [
      { name: 'Sites & Clients', href: '/sites', icon: MapPin, privKey: 'sites', privField: 'canView' },
    ],
  },
  {
    name: 'Account',
    icon: Landmark,
    items: [
      { name: 'Client Accounts', href: '/client-accounts', icon: Receipt, privKey: 'custom', privField: '', visible: (user: any) => user?.privileges?.billing?.canView || user?.privileges?.payments?.canView || user?.privileges?.payments?.canViewVat },
      { name: 'Payroll', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView' },
      { name: 'Ledger', href: '/ledger', icon: BookOpen, privKey: 'ledger', privField: 'canView' },
      { name: 'Account Reports', href: '/financial-reports', icon: BarChart3, privKey: 'financialReports', privField: 'canView' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    items: [
      { name: 'Settings', href: '/settings', icon: Settings, privKey: 'variables', privField: 'canView' },
      { name: 'Users', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView' },
    ],
  },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['HR', 'Settings', 'Account']);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getVisibleItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!currentUser) return true;
      if (item.visible) return item.visible(currentUser);
      if (item.privKey === 'custom') return false;
      const pagePriv = (currentUser.privileges[item.privKey] as unknown) as Record<string, boolean>;
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

  // ── Theme-dependent tokens ────────────────────────────────
  const sidebarBg = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-slate-50 border-slate-200';
  const catBtnBase = isDark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-100';
  const catBtnActive = isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-700';
  const itemBase = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  const itemActive = isDark
    ? 'bg-slate-800 text-indigo-400 border-l-2 border-indigo-500'
    : 'bg-white text-indigo-600 shadow-sm border-l-2 border-indigo-600';
  const iconBase = isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-500';
  const iconActive = isDark ? 'text-indigo-400' : 'text-indigo-600';

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
          "fixed lg:relative flex h-full flex-col border-r transition-all duration-300 z-50",
          sidebarBg,
          isCollapsed ? "w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Area */}
        <div className={cn("flex h-16 shrink-0 items-center border-b border-transparent transition-all", isCollapsed ? "px-0 justify-center" : "px-6 justify-between")}>
          <div className={cn("flex items-center gap-2 font-bold text-xl text-indigo-600 overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>
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
              className={cn("hidden lg:flex p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors", isDark && "hover:bg-slate-800 hover:text-slate-300")}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsOpen?.(false)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden no-scrollbar">
          <nav className={cn("flex-1 space-y-2 py-4", isCollapsed ? "px-2" : "px-3")}>
            {navigation.map((category) => {
              const visibleItems = getVisibleItems(category.items);
              if (visibleItems.length === 0) return null;

              const isAnyItemActive = visibleItems.some(
                (item) => location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))
              );

              const isExpanded = isCollapsed ? isAnyItemActive : expandedCategories.includes(category.name);

              /* ── Special "Tasks" category rendering ── */
              if (category.isSpecial && !isCollapsed) {
                return (
                  <div key={category.name} className="mb-4">
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className={cn(
                        'group/task relative flex w-full items-center justify-between rounded-xl py-2.5 px-3 text-sm font-semibold transition-all duration-200',
                        isAnyItemActive
                          ? isDark
                            ? 'bg-gradient-to-r from-indigo-950/60 via-indigo-900/40 to-slate-900/80 text-indigo-300 shadow-sm shadow-indigo-950/20 ring-1 ring-indigo-700/30'
                            : 'bg-gradient-to-r from-indigo-50 via-indigo-50/80 to-white text-indigo-700 shadow-sm shadow-indigo-100/50 ring-1 ring-indigo-200/60'
                          : isDark
                            ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200',
                          isAnyItemActive
                            ? isDark
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-indigo-100 text-indigo-600'
                            : isDark
                              ? 'bg-slate-800 text-slate-400 group-hover/task:bg-slate-700 group-hover/task:text-slate-300'
                              : 'bg-slate-100 text-slate-500 group-hover/task:bg-slate-200 group-hover/task:text-slate-600'
                        )}>
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span>{category.name}</span>
                      </div>
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform duration-200 opacity-50', isExpanded ? 'rotate-180' : '')}
                      />
                    </button>

                    {isExpanded && (
                      <div className={cn(
                        'mt-1.5 space-y-0.5 rounded-xl py-1.5 px-1.5 transition-all',
                        isDark
                          ? 'bg-slate-800/40'
                          : 'bg-slate-50/80'
                      )}>
                        {visibleItems.map((item) => {
                          const isActive =
                            location.pathname === item.href ||
                            (item.href !== '/' && location.pathname.startsWith(item.href));
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={cn(
                                'group flex items-center gap-2.5 rounded-lg py-2 px-2.5 text-[13px] font-medium transition-all duration-150',
                                isActive
                                  ? isDark
                                    ? 'bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-900/10'
                                    : 'bg-white text-indigo-700 shadow-sm shadow-indigo-100/60 ring-1 ring-indigo-100'
                                  : isDark
                                    ? 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                              )}
                            >
                              <div className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                                isActive
                                  ? isDark
                                    ? 'bg-indigo-500/20 text-indigo-400'
                                    : 'bg-indigo-100 text-indigo-600'
                                  : isDark
                                    ? 'bg-slate-700/60 text-slate-500 group-hover:text-slate-300'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200/80 group-hover:text-slate-500'
                              )}>
                                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </div>
                              <span className="truncate">{item.name}</span>
                              {isActive && (
                                <div className={cn(
                                  'ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0',
                                  isDark ? 'bg-indigo-400' : 'bg-indigo-600'
                                )} />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              /* ── Default category rendering ── */
              return (
                <div key={category.name} className="mb-4">
                  {/* Category Header */}
                  <button
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false);
                      } else {
                        toggleCategory(category.name);
                      }
                    }}
                    title={isCollapsed ? category.name : undefined}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md py-2 text-sm font-semibold transition-colors',
                      isCollapsed ? 'px-0 justify-center' : 'px-3',
                      isAnyItemActive ? catBtnActive : catBtnBase
                    )}
                  >
                    <div className={cn("flex items-center", isCollapsed && "justify-center w-full")}>
                      <category.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                      {!isCollapsed && category.name}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform opacity-60', isExpanded ? 'rotate-180' : '')}
                      />
                    )}
                  </button>

                  {/* Submenu Items */}
                  {isExpanded && (
                    <div className={cn("mt-1 space-y-1", isCollapsed ? "pl-0" : "pl-4")}>
                      {visibleItems.map((item) => {
                        const isActive =
                          location.pathname === item.href ||
                          (item.href !== '/' && location.pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
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

