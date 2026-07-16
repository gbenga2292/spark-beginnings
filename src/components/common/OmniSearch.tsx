import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  MapPin,
  CheckSquare,
  Circle,
  MessagesSquare,
  Receipt,
  Users,
  LayoutDashboard,
  CalendarClock,
  Wallet,
  FileText,
  Settings,
  Library,
  ShieldCheck,
  UserPlus,
  Landmark,
  X,
  Package,
  Truck,
  ShoppingCart,
  Activity,
  HardHat,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAppStore } from '@/src/store/appStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useUserStore, UserPrivileges } from '@/src/store/userStore';

interface SearchItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  secondaryInfo?: string;
  icon: any;
  href: string;
}

interface OmniSearchProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const OmniSearch: React.FC<OmniSearchProps> = ({ isOpen, onClose, isDark }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const clientProfiles = useAppStore((s) => s.clientProfiles);
  const sites = useAppStore((s) => s.sites);
  const clientContacts = useAppStore((s) => s.clientContacts);
  const commLogs = useAppStore((s) => s.commLogs);
  const vatPayments = useAppStore((s) => s.vatPayments);
  const employees = useAppStore((s) => s.employees);
  const { mainTasks, subtasks } = useAppData();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const hasPrivilege = (key: keyof UserPrivileges | null, field: string) => {
    // Super admin (no currentUser sub-profile) has access to everything
    if (!currentUser) return true;
    if (key === null) return false; // null key = super-admin only items
    const priv = (currentUser.privileges[key] as unknown) as Record<string, boolean>;
    return !!priv?.[field];
  };

  // Determine if this user is an External HR Consultant — always restrict to assigned-only tasks
  const isExternalHr = !!(currentUser?.privileges?.tasks as any)?.isExternalHr;

  const PAGES = useMemo(() => [
    { label: 'Dashboard', desc: 'Overview & analytics', href: '/', icon: LayoutDashboard, pK: 'dashboard', pF: 'canView' },
    { label: 'Daily Register', desc: 'Attendance & shifts', href: '/attendance', icon: CalendarClock, pK: 'attendance', pF: 'canView' },
    { label: 'Employees', desc: 'Staff management', href: '/employees', icon: Users, pK: 'employees', pF: 'canView' },
    { label: 'Leaves', desc: 'Leave management', href: '/leaves', icon: CalendarClock, pK: 'leaves', pF: 'canView' },
    { label: 'Sites & Clients', desc: 'Site assignments', href: '/sites', icon: MapPin, pK: 'sites', pF: 'canView' },
    { label: 'Onboarding', desc: 'New hire onboarding', href: '/onboarding', icon: UserPlus, pK: 'employees', pF: 'canView' },
    { label: 'Payroll', desc: 'Salary & compensation', href: '/payroll', icon: Wallet, pK: 'payroll', pF: 'canView' },
    { label: 'Client Accounts', desc: 'Invoices, payments & VAT', href: '/client-accounts', icon: Landmark, pK: 'billing', pF: 'canView' },
    { label: 'Reports', desc: 'Export & analysis', href: '/reports', icon: FileText, pK: 'reports', pF: 'canView' },
    { label: 'Variables', desc: 'Tax rates & config', href: '/variables', icon: Library, pK: 'variables', pF: 'canView' },
    { label: 'Settings', desc: 'App preferences', href: '/settings', icon: Settings, pK: null, pF: 'canView' },
    { label: 'User Management', desc: 'Users & privileges', href: '/users', icon: ShieldCheck, pK: 'users', pF: 'canView' },
    { label: 'Inventory', desc: 'Assets & tools', href: '/operations/assets', icon: Package, pK: 'opsInventory', pF: 'canView' },
    { label: 'Waybills', desc: 'Dispatch & returns', href: '/operations/waybills', icon: Truck, pK: 'opsWaybills', pF: 'canView' },
    { label: 'Layout Simulator', desc: 'Dewatering layout CAD & 3D simulator', href: '/operations/simulator', icon: HardHat, pK: 'simulator', pF: 'canView' },
    { label: 'Machine Reconciliation', desc: 'Equipment reconciliation & active days', href: '/operations/machine-reconciliation', icon: Activity, pK: 'opsMachineRecon', pF: 'canView' },
    { label: 'Bank AI Import', desc: 'Compare statements & reconcile ledger', href: '/bank-import', icon: Sparkles, pK: 'ledger', pF: 'canView' },
  ], []);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const results: SearchItem[] = [];

    // 1. Pages / Navigation
    PAGES.forEach((p) => {
      if (hasPrivilege(p.pK as any, p.pF)) {
        if (p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) {
          results.push({
            id: `page-${p.href}`,
            type: 'page',
            title: p.label,
            subtitle: `Module • ${p.desc}`,
            icon: p.icon,
            href: p.href,
          });
        }
      }
    });

    // 2. Clients
    if (hasPrivilege('clients', 'canView') || hasPrivilege('opsSites', 'canView')) {
      clientProfiles.forEach((c) => {
        if (c.name?.toLowerCase().includes(q) || c.tinNumber?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q)) {
          results.push({
            id: `client-${c.id}`,
            type: 'client',
            title: c.name,
            subtitle: c.address || 'Client',
            icon: Building2,
            href: `/client-360?client=${encodeURIComponent(c.name)}`,
          });
        }
      });
    }

    // 3. Sites
    if (hasPrivilege('sites', 'canView') || hasPrivilege('opsSites', 'canView')) {
      sites.forEach((s) => {
        if (s.name?.toLowerCase().includes(q) || s.client?.toLowerCase().includes(q)) {
          results.push({
            id: `site-${s.id}`,
            type: 'site',
            title: s.name,
            subtitle: `Site for ${s.client}`,
            icon: MapPin,
            href: `/client-360?siteId=${s.id}`,
          });
        }
      });
    }

    // 4. Tasks — enforce strict permission-level filtering
    const canViewAllTasks = hasPrivilege('tasks', 'canView');
    const canViewAssigned = hasPrivilege('tasks', 'canViewAssigned') || hasPrivilege('tasks', 'canViewMyTasks');

    // isExternalHr ALWAYS overrides canViewAllTasks — they can only ever see their own tasks
    const mustFilterByAssignment = isExternalHr || !canViewAllTasks;

    if (canViewAllTasks || canViewAssigned) {
      const myId = currentUser?.id || '';

      mainTasks.forEach((t: any) => {
        if (t.isDeleted) return;
        // Restrict to only tasks assigned to the current user when required
        if (mustFilterByAssignment) {
          const assignees = (t.assignedTo || '').split(',').map((id: string) => id.trim()).filter(Boolean);
          if (!assignees.includes(myId)) return;
        }
        if (t.title?.toLowerCase().includes(q)) {
          results.push({
            id: `task-${t.id}`,
            type: 'task',
            title: t.title,
            subtitle: 'Task',
            icon: CheckSquare,
            href: `/tasks?openTask=${t.id}`,
          });
        }
      });

      subtasks.forEach((s: any) => {
        if (s.isDeleted) return;
        // Same restriction for subtasks
        if (mustFilterByAssignment) {
          const assignees = (s.assignedTo || '').split(',').map((id: string) => id.trim()).filter(Boolean);
          if (!assignees.includes(myId)) return;
        }
        if (s.title?.toLowerCase().includes(q)) {
          results.push({
            id: `subtask-${s.id}`,
            type: 'subtask',
            title: s.title,
            subtitle: 'Subtask',
            icon: Circle,
            href: `/tasks?open=${s.id}`,
          });
        }
      });
    }


    // 5. Employees
    if (hasPrivilege('employees', 'canView')) {
      employees.forEach((e) => {
        const fullName = `${e.firstname} ${e.surname}`.toLowerCase();
        if (fullName.includes(q) || e.department?.toLowerCase().includes(q)) {
          results.push({
            id: `emp-${e.id}`,
            type: 'employee',
            title: `${e.firstname} ${e.surname}`,
            subtitle: `Employee • ${e.department || 'No Dept'}`,
            icon: Users,
            href: `/employees`, // In future, open specific employee modal
          });
        }
      });
    }

    return results.slice(0, 30);
  }, [query, PAGES, clientProfiles, sites, mainTasks, subtasks, employees]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          navigate(searchResults[selectedIndex].href);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 sm:px-0">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={cn(
        "relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200",
        isDark ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
      )}>
        {/* Search Input */}
        <div className={cn(
          "flex items-center px-4 py-3 border-b",
          isDark ? "border-slate-800" : "border-slate-100"
        )}>
          <Search className={cn("w-5 h-5 mr-3 shrink-0", isDark ? "text-slate-400" : "text-slate-500")} />
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "flex-1 bg-transparent border-0 outline-none p-0 text-base focus:ring-0",
              isDark ? "text-slate-100 placeholder-slate-500" : "text-slate-900 placeholder-slate-400"
            )}
            placeholder="Search for pages, clients, tasks, employees..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className={cn("p-1 rounded-md hover:bg-slate-500/20", isDark ? "text-slate-400" : "text-slate-500")}>
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className={cn("ml-2 text-xs font-medium px-2 py-1 rounded border", isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500")}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 style-scroll">
          {searchResults.length === 0 && query.trim() !== '' ? (
            <div className="py-14 text-center">
              <Search className={cn("w-10 h-10 mx-auto mb-3 opacity-20", isDark ? "text-slate-400" : "text-slate-600")} />
              <p className={cn("text-sm font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                No results found for "{query}"
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-10 text-center">
              <p className={cn("text-sm font-medium", isDark ? "text-slate-500" : "text-slate-400")}>
                Type to start searching...
              </p>
            </div>
          ) : (
            searchResults.map((result, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = result.icon;
              return (
                <div
                  key={result.id}
                  onClick={() => {
                    navigate(result.href);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors w-full",
                    isSelected
                      ? (isDark ? "bg-indigo-900/40 text-white" : "bg-indigo-50 text-indigo-900")
                      : (isDark ? "hover:bg-slate-800/50 text-slate-300" : "hover:bg-slate-50 text-slate-700")
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border",
                    isSelected
                      ? (isDark ? "bg-indigo-900/60 border-indigo-700 text-indigo-400" : "bg-indigo-100 border-indigo-200 text-indigo-600")
                      : (isDark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-500")
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm truncate", isSelected ? "" : (isDark ? "text-slate-200" : "text-slate-800"))}>
                      {result.title}
                    </p>
                    <p className={cn("text-xs truncate", isSelected ? "opacity-80" : (isDark ? "text-slate-400" : "text-slate-500"))}>
                      {result.subtitle}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
