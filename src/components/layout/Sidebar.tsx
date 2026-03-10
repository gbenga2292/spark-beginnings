import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';
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
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

// Navigation structure with categories
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
      { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
      { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'employees', privField: 'canView' },
      { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
      { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
      { name: 'Salary & Loan Advance', href: '/salary-loans', icon: DollarSign, privKey: 'payroll', privField: 'canView' },
      { name: 'Employee Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
    ],
  },
  {
    name: 'Admin',
    icon: Building2,
    items: [
      { name: 'Add Client', href: '/sites?action=addClient', icon: MapPin, privKey: 'sites', privField: 'canView' },
      { name: 'Add Site', href: '/sites?action=add', icon: MapPin, privKey: 'sites', privField: 'canView' },
      { name: 'Client Summary', href: '/client-summary', icon: BarChart3, privKey: 'sites', privField: 'canView' },
      { name: 'Reports', href: '/reports', icon: BarChart3, privKey: 'reports', privField: 'canView' },
    ],
  },
  {
    name: 'Account',
    icon: Landmark,
    items: [
      { name: 'Invoices', href: '/invoices', icon: Receipt, privKey: 'financeDashboard', privField: 'canView' },
      { name: 'Payments', href: '/payments', icon: DollarSign, privKey: 'financeDashboard', privField: 'canView' },
      { name: 'Payrolls', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView' },
      { name: 'VAT & Tax Filing', href: '/vat', icon: Landmark, privKey: 'financeDashboard', privField: 'canView' },
      { name: 'Reports', href: '/financial-reports', icon: BarChart3, privKey: 'reports', privField: 'canView' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    items: [
      { name: 'Variables', href: '/variables', icon: Library, privKey: 'variables', privField: 'canView' },
      { name: 'Users', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView' },
    ],
  },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Dashboard', 'HR', 'Admin', 'Account', 'Settings']);

  // Filter nav items based on privileges
  const getVisibleItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!currentUser) return true;
      const pagePriv = currentUser.privileges[item.privKey] as Record<string, boolean>;
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

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <img src="/logo/logo-2.png" alt="HR System" className="h-10 w-auto" />
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
                    isAnyItemActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-center">
                    <category.icon className="mr-3 h-5 w-5" />
                    {category.name}
                  </div>
                  <svg
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded ? 'rotate-180' : ''
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Submenu Items */}
                {isExpanded && (
                  <div className="mt-1 space-y-1 pl-4">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={cn(
                            isActive
                              ? 'bg-white text-indigo-600 shadow-sm border-l-2 border-indigo-600'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                            'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
                          )}
                        >
                          <item.icon
                            className={cn(
                              isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500',
                              'mr-3 h-4 w-4 flex-shrink-0'
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

