import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
  Users as UsersIcon, Plus, Trash2, Eye, EyeOff, Shield, Search,
  LayoutDashboard, Building2, Landmark, Settings as SettingsIcon,
  UserPlus, ChevronRight,
} from 'lucide-react';
import { useUserStore, AppUser, UserPrivileges } from '@/src/store/userStore';

/* â”€â”€ Color map for module badges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const MODULE_COLORS: Record<string, string> = {
  Dashboard: 'bg-indigo-100 text-indigo-700',
  HR:        'bg-teal-100 text-teal-700',
  Admin:     'bg-violet-100 text-violet-700',
  Account:   'bg-amber-100 text-amber-700',
  Settings:  'bg-slate-200 text-slate-700',
};

const MODULE_ICONS: Record<string, any> = {
  Dashboard: LayoutDashboard,
  HR:        UsersIcon,
  Admin:     Building2,
  Account:   Landmark,
  Settings:  SettingsIcon,
};

/* Quick check which groups the user has access to */
const GROUP_CHECK: { name: string; keys: (keyof UserPrivileges)[]; field: string }[] = [
  { name: 'Dashboard', keys: ['dashboard', 'financeDashboard'], field: 'canView' },
  { name: 'HR',        keys: ['employees', 'onboarding', 'attendance', 'leaves', 'salaryLoans', 'reports'], field: 'canView' },
  { name: 'Admin',     keys: ['sites'], field: 'canView' },
  { name: 'Account',   keys: ['billing', 'payments', 'payroll', 'financialReports'], field: 'canView' },
  { name: 'Settings',  keys: ['variables', 'users'], field: 'canView' },
];

function getActiveModules(p: UserPrivileges): string[] {
  return GROUP_CHECK.filter((g) =>
    g.keys.some((k) => {
      const obj = (p[k] as unknown) as Record<string, boolean>;
      return obj?.[g.field] === true;
    })
  ).map((g) => g.name);
}

function countPermissions(p: UserPrivileges): number {
  let c = 0;
  Object.values(p).forEach((page: any) => {
    Object.values(page).forEach((v) => { if (v === true) c++; });
  });
  return c;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Users List Page
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export function Users() {
  const navigate = useNavigate();
  const { users, updateUser, deleteUser, superAdminSignupEnabled, setSuperAdminSignupEnabled } = useUserStore();
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create users and assign granular privileges per page.</p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm cursor-pointer select-none">
            <button type="button" onClick={() => setSuperAdminSignupEnabled(!superAdminSignupEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${superAdminSignupEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition ${superAdminSignupEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            Super Admin Signup
          </label>
          <Button onClick={() => navigate('/users/new')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4" /> New User
          </Button>
        </div>
      </div>

      {/* â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search usersâ€¦"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-sm" />
      </div>

      {/* â”€â”€ User Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200 py-20">
          <UsersIcon className="h-10 w-10 text-slate-300 mb-4" />
          <p className="text-sm text-slate-400 mb-4">{users.length === 0 ? 'No users yet. Create your first user.' : 'No users match your search.'}</p>
          {users.length === 0 && (
            <Button onClick={() => navigate('/users/new')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <UserPlus className="h-4 w-4" /> Create First User
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const modules = getActiveModules(u.privileges);
            const permCount = countPermissions(u.privileges);
            return (
              <div key={u.id} onClick={() => navigate(`/users/${u.id}/edit`)}
                className="group bg-white rounded-xl border border-slate-200 p-5 cursor-pointer transition-all duration-150 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5">

                {/* Top Row */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                    {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{u.name}</span>
                      {!u.isActive && <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 py-0">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0 mt-1" />
                </div>

                {/* Permission Summary */}
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-600">{permCount} permissions</span>
                </div>

                {/* Module Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {modules.length > 0 ? modules.map((m) => {
                    const Icon = MODULE_ICONS[m];
                    return (
                      <span key={m} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${MODULE_COLORS[m]}`}>
                        <Icon className="h-2.5 w-2.5" /> {m}
                      </span>
                    );
                  }) : (
                    <span className="text-[10px] text-slate-400 italic">No access granted</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}/edit`); }}
                    className="flex-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1.5 rounded-md hover:bg-indigo-50 transition-colors text-center">
                    Edit Permissions
                  </button>
                  <div className="w-px h-5 bg-slate-200" />
                  <button onClick={(e) => { e.stopPropagation(); updateUser(u.id, { isActive: !u.isActive }); }}
                    className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-600 transition-colors" title={u.isActive ? 'Disable' : 'Enable'}>
                    {u.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteUser(u.id); }}
                    className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

