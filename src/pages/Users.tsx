import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import {
  Users as UsersIcon, Plus, Pencil, Trash2, Save, X, Shield, Copy, Eye, EyeOff,
  CheckSquare, Square, ChevronDown, ChevronRight, Bookmark, BookmarkPlus
} from 'lucide-react';
import { useUserStore, AppUser, UserPrivileges, FULL_ACCESS, NO_ACCESS, PrivilegePreset } from '@/src/store/userStore';

// Privilege page definitions for the UI
const PRIVILEGE_PAGES = [
  { key: 'dashboard', label: 'Dashboard', fields: [{ key: 'canView', label: 'Can View' }] },
  { key: 'financeDashboard', label: 'Finance Dashboard', fields: [{ key: 'canView', label: 'Can View' }] },
  {
    key: 'attendance', label: 'Daily Register',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Submit' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'employees', label: 'Employees',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Add' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'sites', label: 'Sites & Clients',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Add' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'leaves', label: 'Leaves',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Add' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'billing', label: 'Billing & Invoices',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Create' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'payments', label: 'Payments & VAT',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Add' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete' },
    ],
  },
  {
    key: 'salaryLoans', label: 'Salary Advances & Loans',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canAdd', label: 'Can Add' },
      { key: 'canEdit', label: 'Can Edit' },
      { key: 'canDelete', label: 'Can Delete/Approve' },
    ],
  },
  {
    key: 'payroll', label: 'Payroll',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canGenerate', label: 'Can Generate/Edit' },
    ],
  },
  {
    key: 'reports', label: 'Reports',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canExport', label: 'Can Export' },
    ],
  },
  {
    key: 'variables', label: 'Variables & Settings',
    fields: [
      { key: 'canView', label: 'Can View' },
      { key: 'canEdit', label: 'Can Edit' },
    ],
  },
  {
    key: 'users', label: 'User Management',
    fields: [
      { key: 'canView', label: 'Can View Users' },
      { key: 'canManage', label: 'Can Add/Edit Users' },
    ],
  },
] as const;

type PrivKey = keyof UserPrivileges;

export function Users() {
  const { users, presets, addUser, updateUser, deleteUser, addPreset, deletePreset, superAdminSignupEnabled, setSuperAdminSignupEnabled } = useUserStore();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [privileges, setPrivileges] = useState<UserPrivileges>(NO_ACCESS);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [search, setSearch] = useState('');

  const toggleExpand = (key: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setPriv = (pageKey: PrivKey, fieldKey: string, value: boolean) => {
    setPrivileges((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [fieldKey]: value },
    }));
  };

  const applyPreset = (preset: PrivilegePreset) => {
    setPrivileges(JSON.parse(JSON.stringify(preset.privileges)));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', email: '', password: '' });
    setPrivileges(NO_ACCESS);
    setIsModalOpen(true);
    setExpandedPages(new Set());
  };

  const openEdit = (user: AppUser) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, password: '' });
    setPrivileges(JSON.parse(JSON.stringify(user.privileges)));
    setIsModalOpen(true);
    setExpandedPages(new Set());
  };

  const handleSave = () => {
    if (!form.name || !form.email) return;
    if (editingId) {
      const data: Partial<AppUser> = { name: form.name, email: form.email, privileges };
      if (form.password) data.password = form.password;
      updateUser(editingId, data);
    } else {
      if (!form.password) return;
      addUser({
        id: crypto.randomUUID(),
        name: form.name,
        email: form.email,
        password: form.password,
        privileges,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
    setIsModalOpen(false);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    addPreset({
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      privileges: JSON.parse(JSON.stringify(privileges)),
    });
    setPresetName('');
    setShowPresetSave(false);
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Count total checked privileges
  const countChecked = (p: UserPrivileges) => {
    let c = 0;
    Object.values(p).forEach((page: any) => {
      Object.values(page).forEach((v: any) => { if (v === true) c++; });
    });
    return c;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Create users, assign granular privileges, manage presets.</p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <input
              type="checkbox"
              checked={superAdminSignupEnabled}
              onChange={(e) => setSuperAdminSignupEnabled(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 h-3.5 w-3.5"
            />
            Super Admin Signup
          </label>
          <Button onClick={openCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
            <Plus className="h-4 w-4" /> New User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-indigo-600" /> All Users ({users.length})
            </CardTitle>
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left py-2.5 px-4 font-semibold">Name</th>
                <th className="text-left py-2.5 px-4 font-semibold">Email</th>
                <th className="text-center py-2.5 px-4 font-semibold">Privileges</th>
                <th className="text-center py-2.5 px-4 font-semibold">Status</th>
                <th className="text-right py-2.5 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">No users found. Create one to get started.</td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{u.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700">
                        {countChecked(u.privileges)} permissions
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant={u.isActive ? 'success' : 'outline'} className="text-[10px]">
                        {u.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-amber-600"
                          onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                        >
                          {u.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => deleteUser(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Presets Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-indigo-600" /> Privilege Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-xs group">
                <Shield className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-medium text-slate-700">{p.name}</span>
                <span className="text-slate-400">({countChecked(p.privileges)})</span>
                {!p.id.startsWith('preset-full') && (
                  <button onClick={() => deletePreset(p.id)} className="text-slate-300 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/40 backdrop-blur-sm overflow-y-auto pb-8">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit User' : 'Create New User'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-8 w-8 text-slate-400">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Full Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email *</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-600">{editingId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="••••••••"
                      className="h-9 text-sm pr-9"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-2 text-slate-400">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Presets Quick Apply */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-indigo-500" /> Quick Apply Preset
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowPresetSave(!showPresetSave)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" /> Save Current as Preset
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {showPresetSave && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name..."
                      className="h-8 text-xs flex-1"
                    />
                    <Button onClick={handleSavePreset} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3">
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>

              {/* Privilege Matrix */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">Page Privileges</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPrivileges(JSON.parse(JSON.stringify(FULL_ACCESS)))} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800">
                      Check All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setPrivileges(JSON.parse(JSON.stringify(NO_ACCESS)))} className="text-[10px] font-medium text-red-500 hover:text-red-700">
                      Uncheck All
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {PRIVILEGE_PAGES.map((page) => {
                    const pagePriv = privileges[page.key as PrivKey] as Record<string, boolean>;
                    const isExpanded = expandedPages.has(page.key);
                    const checkedCount = Object.values(pagePriv).filter(Boolean).length;
                    const totalCount = page.fields.length;

                    return (
                      <div key={page.key}>
                        <button
                          onClick={() => toggleExpand(page.key)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            <span className="font-semibold text-slate-800">{page.label}</span>
                          </div>
                          <Badge
                            variant={checkedCount === totalCount ? 'success' : checkedCount > 0 ? 'secondary' : 'outline'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {checkedCount}/{totalCount}
                          </Badge>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-2.5 pt-0.5 flex flex-wrap gap-x-6 gap-y-1 bg-slate-50/40">
                            {page.fields.map((field) => (
                              <label key={field.key} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={pagePriv[field.key] ?? false}
                                  onChange={(e) => setPriv(page.key as PrivKey, field.key, e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="text-sm h-9">Cancel</Button>
              <Button onClick={handleSave} className="text-sm h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Save className="h-3.5 w-3.5" /> {editingId ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
