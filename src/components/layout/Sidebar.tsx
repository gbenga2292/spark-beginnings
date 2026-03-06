import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileText,
  Settings,
  UserPlus,
  Briefcase,
  MapPin,
  Library,
  X,
  CreditCard
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Daily Register', href: '/attendance', icon: CalendarClock },
  { name: 'Employees', href: '/employees', icon: Users },
  { name: 'Leaves', href: '/leaves', icon: CalendarClock },
  { name: 'Sites & Clients', href: '/sites', icon: MapPin },
  { name: 'Onboarding', href: '/onboarding', icon: UserPlus },
  { name: 'Payroll', href: '/payroll', icon: Wallet },
  { name: 'Billing', href: '/billing', icon: Briefcase },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Variables', href: '/variables', icon: Library },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <img src="/logo/logo-2.png" alt="HR System" className="h-10 w-auto" />
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500',
                    'mr-3 h-5 w-5 flex-shrink-0'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
