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
  privKey: keyof UserPrivileges;
  privField: string;
}

interface NavCategory {
  name: string;
  icon: any;
  items: NavItem[];
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
      { name: 'Employees',              href: '/employees',    icon: Users,         privKey: 'employees',   privField: 'canView' },
      { name: 'Onboarding',             href: '/onboarding',   icon: UserPlus,      privKey: 'onboarding',  privField: 'canView' },
      { name: 'Daily Register',         href: '/attendance',   icon: CalendarClock, privKey: 'attendance',  privField: 'canView' },
      { name: 'Leaves',                 href: '/leaves',       icon: CalendarClock, privKey: 'leaves',      privField: 'canView' },
      { name: 'Salary & Loan Advance',  href: '/salary-loans', icon: DollarSign,    privKey: 'salaryLoans', privField: 'canView' },
      { name: 'Employee Reports',       href: '/reports',      icon: FileText,      privKey: 'reports',     privField: 'canView' },
    ],
  },
  {
    name: 'Admin',
    icon: Building2,
    items: [
      { name: 'Sites & Clients',  href: '/sites',          icon: MapPin,    privKey: 'sites', privField: 'canView' },
    ],
  },
  {
    name: 'Account',
    icon: Landmark,
    items: [
      { name: 'Invoice',          href: '/invoices',          icon: Receipt,    privKey: 'billing',          privField: 'canView' },
      { name: 'Payment',          href: '/payments',          icon: DollarSign, privKey: 'payments',         privField: 'canView' },
      { name: 'VAT',              href: '/vat',               icon: Landmark,   privKey: 'payments',         privField: 'canViewVat' },
      { name: 'Payroll',          href: '/payroll',           icon: Wallet,     privKey: 'payroll',          privField: 'canView' },
      { name: 'Account Reports',  href: '/financial-reports', icon: BarChart3,  privKey: 'financialReports', privField: 'canView' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    items: [
      { name: 'Settings', href: '/settings', icon: Settings,    privKey: 'variables', privField: 'canView' },
      { name: 'Users',    href: '/users',    icon: ShieldCheck, privKey: 'users',     privField: 'canView' },
    ],
  },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const { isDark } = useTheme();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const getVisibleItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!currentUser) return true;
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
  const sidebarBg    = isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-slate-50 border-slate-200';
  const catBtnBase   = isDark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-100';
  const catBtnActive = isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-700';
  const itemBase     = isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  const itemActive   = isDark
    ? 'bg-slate-800 text-indigo-400 border-l-2 border-indigo-500'
    : 'bg-white text-indigo-600 shadow-sm border-l-2 border-indigo-600';
  const iconBase     = isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-500';
  const iconActive   = isDark ? 'text-indigo-400' : 'text-indigo-600';

  return (
    <div className={`flex h-full w-64 flex-col border-r transition-colors duration-200 ${sidebarBg}`}>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <img
            src={logoSrc}
            alt="HR System"
            className="h-10 w-auto transition-all duration-300"
            style={isDark ? { filter: 'brightness(0) invert(1)', opacity: 0.9 } : {}}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((category) => {
            const visibleItems = getVisibleItems(category.items);
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedCategories.includes(category.name);
            const isAnyItemActive = visibleItems.some(
              (item) => location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))
            );

            return (
              <div key={category.name} className="mb-4">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.name)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                    isAnyItemActive ? catBtnActive : catBtnBase
                  )}
                >
                  <div className="flex items-center">
                    <category.icon className="mr-3 h-5 w-5" />
                    {category.name}
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform opacity-60', isExpanded ? 'rotate-180' : '')}
                  />
                </button>

                {/* Submenu Items */}
                {isExpanded && (
                  <div className="mt-1 space-y-0.5 pl-4">
                    {visibleItems.map((item) => {
                      const isActive =
                        location.pathname === item.href ||
                        (item.href !== '/' && location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={cn(
                            'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive ? itemActive : itemBase
                          )}
                        >
                          <item.icon
                            className={cn(
                              'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
                              isActive ? iconActive : iconBase
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
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
  );
}
