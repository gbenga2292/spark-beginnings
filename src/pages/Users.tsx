import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
  Users as UsersIcon, Plus, Trash2, Eye, EyeOff, Shield, Search,
  LayoutDashboard, Building2, Landmark, Settings as SettingsIcon,
  UserPlus, ChevronRight, ListTodo
} from 'lucide-react';
import { useUserStore, AppUser, UserPrivileges } from '@/src/store/userStore';
import { supabase } from '@/src/integrations/supabase/client';

/* ── Color map for module badges ──────────────────────────────── */
const MODULE_COLORS: Record<string, string> = {
  Dashboard: 'bg-indigo-100 text-indigo-700',
  HR:        'bg-teal-100 text-teal-700',
  Admin:     'bg-violet-100 text-violet-700',
  Account:   'bg-amber-100 text-amber-700',
  Tasks:     'bg-blue-100 text-blue-700',
  Settings:  'bg-slate-200 text-slate-700',
};

const MODULE_ICONS: Record<string, any> = {
  Dashboard: LayoutDashboard,
  HR:        UsersIcon,
  Admin:     Building2,
  Account:   Landmark,
  Tasks:     ListTodo,
  Settings:  SettingsIcon,
};

/* Quick check which groups the user has access to */
const GROUP_CHECK: { name: string; keys: (keyof UserPrivileges)[]; field: string }[] = [
  { name: 'Dashboard', keys: ['dashboard', 'financeDashboard'], field: 'canView' },
  { name: 'HR',        keys: ['employees', 'onboarding', 'attendance', 'leaves', 'salaryLoans', 'reports'], field: 'canView' },
  { name: 'Admin',     keys: ['sites'], field: 'canView' },
  { name: 'Tasks',     keys: ['tasks'], field: 'canView' },
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteUser = async (u: AppUser, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to completely delete the user ${u.name}? This action cannot be reversed.`)) return;
    
    setIsDeleting(u.id);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: u.id }
      });
      if (error) throw new Error(error.message || 'Error communicating with server');
      if (data?.error) throw new Error(data.error);

      // Successfully completely severed from Supabase, now remove locally
      deleteUser(u.id);
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete user: ' + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* ── Header ────────────────────────────────────────── */}
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

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-sm" />
      </div>

      {/* ── User Grid ──────────────────────────────────────── */}
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 w-[30%]">User</th>
                  <th className="px-4 py-4 w-[10%]">Status</th>
                  <th className="px-4 py-4 w-[35%]">Module Access</th>
                  <th className="px-4 py-4 w-[10%]">Permissions</th>
                  <th className="px-6 py-4 w-[15%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const modules = getActiveModules(u.privileges);
                  const permCount = countPermissions(u.privileges);
                  return (
                    <tr key={u.id} onClick={() => navigate(`/users/${u.id}/edit`)} className="group hover:bg-slate-50/70 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                            {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{u.name}</p>
                            <p className="text-slate-500 text-xs truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {u.isActive ? (
                           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                        ) : (
                           <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">Disabled</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {modules.length > 0 ? modules.map((m) => {
                            const Icon = MODULE_ICONS[m];
                            return (
                              <span key={m} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${MODULE_COLORS[m]}`}>
                                <Icon className="h-2.5 w-2.5" /> {m}
                              </span>
                            );
                          }) : (
                            <span className="text-[10px] text-slate-400 italic">No access</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Shield className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-xs font-semibold">{permCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}/edit`); }}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
                            Edit
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); updateUser(u.id, { isActive: !u.isActive }); }}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-600 transition-colors" title={u.isActive ? 'Disable' : 'Enable'}>
                            {u.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button onClick={(e) => handleDeleteUser(u, e)} disabled={isDeleting === u.id}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50" title="Delete">
                            {isDeleting === u.id ? <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

