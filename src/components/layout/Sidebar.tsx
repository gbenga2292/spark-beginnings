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
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

// Map nav items to privilege keys
const navigation: { name: string; href: string; icon: any; privKey: keyof UserPrivileges; privField: string }[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, privKey: 'dashboard', privField: 'canView' },
  { name: 'Daily Register', href: '/attendance', icon: CalendarClock, privKey: 'attendance', privField: 'canView' },
  { name: 'Employees', href: '/employees', icon: Users, privKey: 'employees', privField: 'canView' },
  { name: 'Leaves', href: '/leaves', icon: CalendarClock, privKey: 'leaves', privField: 'canView' },
  { name: 'Sites & Clients', href: '/sites', icon: MapPin, privKey: 'sites', privField: 'canView' },
  { name: 'Onboarding', href: '/onboarding', icon: UserPlus, privKey: 'employees', privField: 'canView' },
  { name: 'Payroll', href: '/payroll', icon: Wallet, privKey: 'payroll', privField: 'canView' },
  { name: 'Financial Hub', href: '/finance', icon: Landmark, privKey: 'financeDashboard', privField: 'canView' },
  { name: 'Reports', href: '/reports', icon: FileText, privKey: 'reports', privField: 'canView' },
  { name: 'Variables', href: '/variables', icon: Library, privKey: 'variables', privField: 'canView' },
  { name: 'Settings', href: '/settings', icon: Settings, privKey: 'variables', privField: 'canView' },
  { name: 'Users', href: '/users', icon: ShieldCheck, privKey: 'users', privField: 'canView' },
];

export function Sidebar({ isOpen = true, setIsOpen }: SidebarProps) {
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  // Filter nav items based on privileges
  const visibleNav = navigation.filter((item) => {
    if (!currentUser) return true; // Shouldn't happen since we're behind auth
    const pagePriv = currentUser.privileges[item.privKey] as Record<string, boolean>;
    return pagePriv?.[item.privField] === true;
  });

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <img src="/logo/logo-2.png" alt="HR System" className="h-10 w-auto" />
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-4 py-4">
          {visibleNav.map((item) => {
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
