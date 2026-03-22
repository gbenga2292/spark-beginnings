import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  ArrowLeft, Save, Eye, EyeOff, Shield, ChevronDown, ChevronRight,
  CheckCircle2, X, BookmarkPlus,
  LayoutDashboard, Users as UsersIcon, Building2, Landmark, Settings,
} from 'lucide-react';
import { useUserStore, AppUser, UserPrivileges, FULL_ACCESS, NO_ACCESS, PrivilegePreset } from '@/src/store/userStore';
import { useAppStore } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Privilege tree definition (mirrors sidebar structure)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
interface PF { key: string; label: string; danger?: boolean; special?: boolean; }
interface PP { key: string; label: string; parentKey: keyof UserPrivileges; fields: PF[]; masterField?: string; }
interface PG { name: string; icon: any; color: string; pages: PP[]; }

const PRIV_GROUPS: PG[] = [
  {
    name: 'Dashboard', icon: LayoutDashboard, color: 'indigo',
    pages: [
      { key: 'dashboard', label: 'Main Dashboard', parentKey: 'dashboard', masterField: 'canView',
        fields: [{ key: 'canView', label: 'Can View' }] },
    ],
  },
  {
    name: 'Tasks', icon: BookmarkPlus, color: 'blue',
    pages: [
      { key: 'tasks', label: 'Task Management', parentKey: 'tasks', masterField: 'canView',
        fields: [
          { key: 'canView', label: 'Master View Tasks' },
          { key: 'canViewMyTasks', label: 'My Tasks Board' },
          { key: 'canViewDashboard', label: 'Task Dashboard' },
          { key: 'canViewReminders', label: 'Reminders' },
          { key: 'canViewReports', label: 'Task Reports' },
          { key: 'canCreateTasks', label: 'Create Tasks' },
          { key: 'canEditTasks', label: 'Edit Tasks' },
          { key: 'canDeleteTasks', label: 'Delete Tasks', danger: true },
        ] 
      },
    ],
  },
  {
    name: 'HR', icon: UsersIcon, color: 'teal',
    pages: [
      { key: 'employees', label: 'Employees', parentKey: 'employees', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }, { key: 'canViewSalary', label: 'View Salary', special: true }, { key: 'canExport', label: 'Export' }] },
      { key: 'disciplinary', label: 'Disciplinary', parentKey: 'disciplinary', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }] },
      { key: 'evaluations', label: 'Evaluations', parentKey: 'evaluations', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }] },
      { key: 'onboarding', label: 'Onboarding', parentKey: 'onboarding', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }] },
      { key: 'attendance', label: 'Daily Register', parentKey: 'attendance', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Submit' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }, { key: 'canImport', label: 'Import DB' }, { key: 'canExport', label: 'Export DB' }] },
      { key: 'leaves', label: 'Leaves', parentKey: 'leaves', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }, { key: 'canViewSummary', label: 'View Summary Page' }] },
      { key: 'salaryLoans', label: 'Salary Advances & Loans', parentKey: 'salaryLoans', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Approve / Delete', danger: true }, { key: 'canViewAmounts', label: 'View Amounts', special: true }] },
      { key: 'reports', label: 'Employee Reports', parentKey: 'reports', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canExport', label: 'Export' }] },
    ],
  },
  {
    name: 'Admin', icon: Building2, color: 'violet',
    pages: [
      { key: 'sites', label: 'Sites & Clients', parentKey: 'sites', masterField: 'canView',
        fields: [
          { key: 'canView', label: 'View' }, { key: 'canAddSite', label: 'Add Site' }, { key: 'canEditSite', label: 'Edit Site' }, { key: 'canDeleteSite', label: 'Delete Site', danger: true },
          { key: 'canAddClient', label: 'Add Client' }, { key: 'canEditClient', label: 'Edit Client' }, { key: 'canDeleteClient', label: 'Delete Client', danger: true },
          { key: 'canImport', label: 'Import' }, { key: 'canExport', label: 'Export' }
        ] },
    ],
  },
  {
    name: 'Account', icon: Landmark, color: 'amber',
    pages: [
      { key: 'clientSummary', label: 'Client Summary', parentKey: 'sites', masterField: 'canViewClientSummary',
        fields: [{ key: 'canViewClientSummary', label: 'View' }] },
      { key: 'billing', label: 'Invoices & Billing', parentKey: 'billing', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canCreate', label: 'Create' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }, { key: 'canViewAmounts', label: 'View Amounts', special: true }, { key: 'canImport', label: 'Import' }, { key: 'canExport', label: 'Export' }] },
      { key: 'payments', label: 'Payments', parentKey: 'payments', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Add' }, { key: 'canEdit', label: 'Edit' }, { key: 'canDelete', label: 'Delete', danger: true }, { key: 'canViewAmounts', label: 'View Amounts', special: true }, { key: 'canViewVat', label: 'View VAT Tab' }, { key: 'canManageVat', label: 'Manage VAT' }, { key: 'canImport', label: 'Import' }, { key: 'canExport', label: 'Export' }] },
      { key: 'payroll', label: 'Payroll', parentKey: 'payroll', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canGenerate', label: 'Generate / Edit' }, { key: 'canViewAmounts', label: 'View Amounts', special: true }, { key: 'canViewPayeSchedule', label: 'PAYE Schedule' }, { key: 'canViewPensionSchedule', label: 'Pension Schedule' }, { key: 'canViewNsitfSchedule', label: 'NSITF Schedule' }] },
      { key: 'financialReports', label: 'Financial Reports', parentKey: 'financialReports', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canExport', label: 'Export' }, { key: 'canViewAmounts', label: 'View Amounts', special: true }, { key: 'canViewPayrollSummary', label: 'Payroll Summary Tab' }, { key: 'canViewLoansAndAdvances', label: 'Loans & Advances Tab' }] },
      { key: 'ledger', label: 'Financial Ledger', parentKey: 'ledger', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canAdd', label: 'Record Entries' }, { key: 'canEdit', label: 'Edit Variables' }, { key: 'canDelete', label: 'Delete Entries', danger: true }, { key: 'canExport', label: 'Export' }] },
    ],
  },
  {
    name: 'Variables', icon: Settings, color: 'emerald',
    pages: [
      { key: 'variables', label: 'Variables', parentKey: 'variables', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View' }, { key: 'canEdit', label: 'Edit' }, { key: 'canImport', label: 'Import' }, { key: 'canExport', label: 'Export' }] },
    ],
  },
  {
    name: 'Settings', icon: Settings, color: 'slate',
    pages: [
      { key: 'users', label: 'User Management', parentKey: 'users', masterField: 'canView',
        fields: [{ key: 'canView', label: 'View Users' }, { key: 'canManage', label: 'Add / Edit Users', danger: true }] },
    ],
  },
];

const COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  teal:   { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700' },
  violet: { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  amber:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700' },
  blue:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-300',  badge: 'bg-slate-200 text-slate-700' },
};

function getPrivObj(privs: UserPrivileges, key: keyof UserPrivileges): Record<string, boolean> {
  return ((privs[key] ?? NO_ACCESS[key]) as unknown) as Record<string, boolean>;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Inline Toggle
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Sw({ on, set, disabled, size = 'md' }: { on: boolean; set: (v: boolean) => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9';
  const dot = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const t = size === 'sm' ? 'translate-x-3' : 'translate-x-4';
  return (
    <button type="button" onClick={() => !disabled && set(!on)}
      className={`relative inline-flex ${h} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${on ? 'bg-indigo-600' : 'bg-slate-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`pointer-events-none inline-block ${dot} rounded-full bg-white shadow transition ${on ? t : 'translate-x-0'}`} />
    </button>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Main Page Component
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { users, presets, addUser, updateUser, addPreset } = useUserStore();
  const { employees } = useAppStore();
  const editingUser = isEdit ? users.find((u) => u.id === id) ?? null : null;

  const [name, setName] = useState(editingUser?.name ?? '');
  const [email, setEmail] = useState(editingUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isActive, setIsActive] = useState(editingUser?.isActive ?? true);
  const [privileges, setPrivileges] = useState<UserPrivileges>(() => {
    if (!editingUser) return JSON.parse(JSON.stringify(NO_ACCESS));
    // Backfill: merge stored privileges on top of NO_ACCESS so any section
    // added after the user was created won't be undefined.
    const base = JSON.parse(JSON.stringify(NO_ACCESS)) as UserPrivileges;
    (Object.keys(base) as (keyof UserPrivileges)[]).forEach((k) => {
      base[k] = { ...base[k], ...(editingUser.privileges[k] ?? {}) } as any;
    });
    return base;
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Dashboard', 'HR']));
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  // toggle helpers
  const setField = (pk: keyof UserPrivileges, fk: string, v: boolean) =>
    setPrivileges((p) => ({ ...p, [pk]: { ...(p[pk] as any), [fk]: v } }));

  const toggleGroup = (n: string) => setExpandedGroups((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const togglePage  = (k: string) => setExpandedPages((p) => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s; });

  const toggleGroupAccess = (group: PG, enable: boolean) => {
    setPrivileges((prev) => {
      const next = { ...prev };
      group.pages.forEach((page) => {
        const cur = ((prev[page.parentKey] as unknown) as Record<string, boolean>) || {};
        if (enable) {
          const up: Record<string, boolean> = { ...cur };
          if (page.masterField) up[page.masterField] = true;
          (next as any)[page.parentKey] = up;
        } else {
          const w: Record<string, boolean> = {};
          Object.keys(cur).forEach((k) => { w[k] = false; });
          (next as any)[page.parentKey] = w;
        }
      });
      return next;
    });
    if (enable) setExpandedGroups((p) => new Set([...p, group.name]));
    else setExpandedPages((p) => { const s = new Set(p); group.pages.forEach((pg) => s.delete(pg.key)); return s; });
  };

  // group stats
  const groupStats = useMemo(() => {
    const m: Record<string, { g: number; t: number }> = {};
    PRIV_GROUPS.forEach((gr) => {
      let g = 0, t = 0;
      gr.pages.forEach((pg) => {
        const o = getPrivObj(privileges, pg.parentKey);
        pg.fields.forEach((f) => {
          t++;
          if (o[f.key]) g++;
        });
      });
      m[gr.name] = { g, t };
    });
    return m;
  }, [privileges]);

  const totalG = PRIV_GROUPS.reduce((a, g) => a + (groupStats[g.name]?.g ?? 0), 0);
  const totalT = PRIV_GROUPS.reduce((a, g) => a + (groupStats[g.name]?.t ?? 0), 0);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) return;
    setIsSaving(true);
    try {
      if (isEdit && editingUser) {
        const data: Partial<AppUser> = { name, email, privileges, isActive };
        if (password.trim()) data.password = password;
        updateUser(editingUser.id, data);
        navigate('/users');
      } else {
        if (!password.trim()) {
          setIsSaving(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: { email, password, name, privileges }
        });
        if (error) {
          throw new Error(error.message || 'Error executing edge function');
        }
        if (data?.error) {
           throw new Error(data.error);
        }
        if (data?.user) {
          addUser({ 
            id: data.user.id, 
            name, 
            email, 
            password: '', 
            privileges, 
            isActive, 
            createdAt: new Date().toISOString() 
          });
          navigate('/users');
        } else {
          throw new Error('User creation response was empty');
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while creating the user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    addPreset({ id: `preset-${Date.now()}`, name: presetName.trim(), privileges: JSON.parse(JSON.stringify(privileges)) });
    setPresetName(''); setShowPresetSave(false);
  };

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/users')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{isEdit ? `Edit User — ${editingUser?.name}` : 'Create New User'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{isEdit ? 'Modify user details and permissions' : 'Fill in details and assign permissions'}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/users')} className="h-9 text-sm">Cancel</Button>
        <Button disabled={isSaving} onClick={handleSave} className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          <Save className="h-3.5 w-3.5" /> {isEdit ? 'Save Changes' : (isSaving ? 'Creating...' : 'Create User')}
        </Button>
      </div>

      {/* ── User Details Card ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">User Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Full Name *</label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            >
              <option value="" disabled>Select Employee...</option>
              {employees.map(emp => {
                const fullName = `${emp.firstname} ${emp.surname}`.trim();
                return (
                  <option key={emp.id} value={fullName}>
                    {fullName} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                  </option>
                );
              })}
              {name && !employees.find(e => `${e.firstname} ${e.surname}`.trim() === name) && (
                <option value={name}>{name}</option>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Email Address *</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <div className="relative max-w-sm flex items-center gap-4">
              <div className="relative flex-1">
                <Input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-9 text-sm pr-9" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 min-w-max">
                <Sw on={isActive} set={setIsActive} size="sm" />
                <span className="text-xs font-semibold text-slate-700">{isActive ? 'Account Active' : 'Account Disabled'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Presets Strip ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-indigo-500" /> Quick Presets
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPresetSave(!showPresetSave)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <BookmarkPlus className="h-3.5 w-3.5" /> Save Current
            </button>
            <span className="text-slate-200">|</span>
            <button onClick={() => setPrivileges(JSON.parse(JSON.stringify(FULL_ACCESS)))} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Grant All
            </button>
            <button onClick={() => setPrivileges(JSON.parse(JSON.stringify(NO_ACCESS)))} className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Revoke All
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.id} onClick={() => setPrivileges(JSON.parse(JSON.stringify(p.privileges)))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all shadow-sm">
              {p.name}
            </button>
          ))}
        </div>
        {showPresetSave && (
          <div className="flex gap-2 mt-3 max-w-sm">
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name…" className="h-8 text-xs flex-1" />
            <Button onClick={handleSavePreset} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 gap-1">
              <Save className="h-3 w-3" /> Save
            </Button>
          </div>
        )}
      </div>

      {/* ── Permission Groups ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-slate-500" /> Page Permissions
          </h2>
          <span className="text-xs text-slate-500">
            <strong className="text-slate-700">{totalG}/{totalT}</strong> granted
          </span>
        </div>

        {PRIV_GROUPS.map((group) => {
          const C = COLORS[group.color];
          const open = expandedGroups.has(group.name);
          const { g, t } = groupStats[group.name] ?? { g: 0, t: 0 };
          const isOn = group.pages.some((p) => {
            const o = getPrivObj(privileges, p.parentKey);
            return p.masterField ? (o[p.masterField] ?? false) : false;
          });

          return (
            <div key={group.name} className={`rounded-xl border ${isOn ? C.border : 'border-slate-200'} bg-white shadow-sm overflow-hidden transition-colors`}>
              {/* Group header */}
              <div className={`flex items-center gap-3 px-4 py-3 ${isOn ? C.bg : 'bg-slate-50/80'} transition-colors`}>
                <Sw on={isOn} set={(v) => toggleGroupAccess(group, v)} />
                <button onClick={() => toggleGroup(group.name)} className="flex-1 flex items-center gap-2.5 text-left">
                  <group.icon className={`h-4 w-4 ${isOn ? C.text : 'text-slate-400'}`} />
                  <span className={`text-sm font-bold ${isOn ? C.text : 'text-slate-400'}`}>{group.name}</span>
                  {!isOn && <span className="text-[10px] text-slate-400 italic">disabled</span>}
                </button>
                {isOn && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${g === t ? 'bg-emerald-100 text-emerald-700' : g > 0 ? C.badge : 'bg-slate-100 text-slate-400'}`}>
                    {g}/{t}
                  </span>
                )}
                <button onClick={() => toggleGroup(group.name)} className="text-slate-400 hover:text-slate-600">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>

              {/* Pages */}
              {open && (
                <div className="divide-y divide-slate-100">
                  {group.pages.map((page) => {
                    const obj = getPrivObj(privileges, page.parentKey);
                    const master = page.masterField ? (obj[page.masterField] ?? false) : true;
                    const pOpen = expandedPages.has(page.key);
                    const pChecked = page.fields.filter((f) => obj[f.key]).length;
                    const pTotal   = page.fields.length;

                    return (
                      <div key={page.key}>
                        {/* Page row */}
                        <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors">
                          <button onClick={() => togglePage(page.key)} className="text-slate-400 hover:text-slate-600 shrink-0">
                            {pOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          {page.masterField && (
                            <Sw size="sm" on={master} set={(v) => {
                              if (v) {
                                setField(page.parentKey, page.masterField!, true);
                                setExpandedPages((p) => new Set([...p, page.key]));
                              } else {
                                setPrivileges((prev) => {
                                  const next = { ...prev };
                                  const w: Record<string, boolean> = {};
                                  Object.keys((prev[page.parentKey] as any)).forEach((k) => w[k] = false);
                                  (next as any)[page.parentKey] = w;
                                  return next;
                                });
                                setExpandedPages((p) => { const s = new Set(p); s.delete(page.key); return s; });
                              }
                            }} />
                          )}
                          <button onClick={() => togglePage(page.key)} className="flex-1 text-left">
                            <span className={`text-sm font-medium ${master ? 'text-slate-800' : 'text-slate-400'}`}>{page.label}</span>
                          </button>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pChecked === pTotal && pTotal > 0 ? 'bg-emerald-100 text-emerald-700' : pChecked > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                            {pChecked}/{pTotal}
                          </span>
                        </div>

                        {/* Field checkboxes */}
                        {pOpen && (
                          <div className="px-14 pb-3 pt-1 flex flex-wrap gap-x-5 gap-y-2 bg-slate-50/50 border-t border-slate-100">
                            {page.fields.filter((f) => f.key !== page.masterField).map((f) => {
                              const checked = obj[f.key] ?? false;
                              const dis = !master;
                              return (
                                <label key={f.key} className={`flex items-center gap-2 text-xs cursor-pointer select-none ${dis ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                  <input type="checkbox" checked={checked} disabled={dis}
                                    onChange={(e) => setField(page.parentKey, f.key, e.target.checked)}
                                    className={`h-3.5 w-3.5 rounded border-slate-300 focus:ring-indigo-500 ${f.danger ? 'accent-amber-600' : f.special ? 'accent-emerald-600' : 'accent-indigo-600'}`} />
                                  <span className={`font-medium ${f.danger ? 'text-amber-700' : f.special ? 'text-emerald-700' : 'text-slate-700'}`}>{f.label}</span>
                                </label>
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
      </div>

      {/* ── Sticky bottom bar ─────────────────────────────── */}
      <div className="sticky bottom-0 mt-6 -mx-2 px-2 py-4 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent flex items-center justify-between rounded-b-xl">
        <span className="text-xs text-slate-500">
          <strong className="text-slate-700">{totalG}/{totalT}</strong> permissions
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/users')} className="h-9 text-sm">Cancel</Button>
          <Button disabled={isSaving} onClick={handleSave} className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Save className="h-3.5 w-3.5" /> {isEdit ? 'Save Changes' : (isSaving ? 'Creating...' : 'Create User')}
          </Button>
        </div>
      </div>
    </div>
  );
}

