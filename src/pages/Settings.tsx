import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Badge } from '@/src/components/ui/badge';
import {
  Save, Building, Link as LinkIcon, CloudDownload,
  RefreshCw, Library, Pencil, X, Mail, Phone, MapPin, Hash, CheckCircle2,
  DatabaseBackup, Upload, Download, Clock, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Variables } from './Variables';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { toast } from '@/src/components/ui/toast';
import { supabase } from '@/src/integrations/supabase/client';
import { useSetPageTitle } from '@/src/contexts/PageContext';

interface CompanyInfo {
  name: string;
  regNumber: string;
  email: string;
  phone: string;
  address: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Dewatering Construction Etc Limited',
  regNumber: 'RC-1245678',
  email: 'hr@dcel.com',
  phone: '+234 801 234 5678',
  address: 'Victoria Island, Lagos, Nigeria',
};

const BACKUP_SETTINGS_KEY = 'dcel-backup-settings';

interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupInterval: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string; // HH:MM
  lastBackupAt: string | null;
}

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupInterval: 'daily',
  autoBackupTime: '08:00',
  lastBackupAt: null,
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [isChecking, setIsChecking] = useState(false);
  const isElectron = (window.electronAPI as any)?.isElectron as boolean | undefined;

  /* ── Company info state ─────────────────────────────────────── */
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [draft, setDraft] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [justSaved, setJustSaved] = useState(false);
  const [isSavingDB, setIsSavingDB] = useState(false);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);

  /* ── Backup state ───────────────────────────────────────────── */
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() => {
    try {
      const stored = localStorage.getItem(BACKUP_SETTINGS_KEY);
      return stored ? { ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(stored) } : DEFAULT_BACKUP_SETTINGS;
    } catch { return DEFAULT_BACKUP_SETTINGS; }
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const autoBackupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get all app data from store
  const state = useAppStore();
  const userState = useUserStore();
  const taskState = useAppData();

  useEffect(() => {
    if (isElectron && (window.electronAPI as any)?.getVersion) {
      (window.electronAPI as any).getVersion().then((v: string) => setAppVersion(v)).catch(console.error);
    }
  }, [isElectron]);

  /* ── Load company info from Supabase on mount ─────────────────── */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('id, company_name, company_reg_number, company_email, company_phone, company_address')
        .limit(1)
        .single();
      if (error || !data) return; // table empty or RLS — keep defaults
      setSettingsRowId(data.id);
      const loaded: CompanyInfo = {
        name:      data.company_name      ?? DEFAULT_COMPANY.name,
        regNumber: data.company_reg_number ?? DEFAULT_COMPANY.regNumber,
        email:     data.company_email      ?? DEFAULT_COMPANY.email,
        phone:     data.company_phone      ?? DEFAULT_COMPANY.phone,
        address:   data.company_address    ?? DEFAULT_COMPANY.address,
      };
      setSaved(loaded);
      setDraft(loaded);
    })();
  }, []);

  /* ── Save backup settings to localStorage ─────────────────── */
  const saveBackupSettings = (settings: BackupSettings) => {
    setBackupSettings(settings);
    localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
  };

  /* ── Create backup JSON ───────────────────────────────────── */
  const createBackupData = useCallback(() => {
    return {
      version: '1.0',
      backupDate: new Date().toISOString(),
      appVersion,
      data: {
        sites: state.sites,
        clients: state.clients,
        employees: state.employees,
        attendanceRecords: state.attendanceRecords,
        positions: state.positions,
        departments: state.departments,
        invoices: state.invoices,
        pendingInvoices: state.pendingInvoices,
        salaryAdvances: state.salaryAdvances,
        loans: state.loans,
        payments: state.payments,
        vatPayments: state.vatPayments,
        payrollVariables: state.payrollVariables,
        payeTaxVariables: state.payeTaxVariables,
        monthValues: state.monthValues,
        publicHolidays: state.publicHolidays,
        departmentTasksList: state.departmentTasksList,
        leaves: state.leaves,
        leaveTypes: state.leaveTypes,
        pendingSites: state.pendingSites,
        disciplinaryRecords: state.disciplinaryRecords,
        evaluations: state.evaluations,
        ledgerCategories: state.ledgerCategories,
        ledgerVendors: state.ledgerVendors,
        ledgerBanks: state.ledgerBanks,
        ledgerEntries: state.ledgerEntries,
        hrVariables: state.hrVariables,
        // User Store
        users: userState.users,
        presets: userState.presets,
        // Task Context
        mainTasks: taskState.mainTasks,
        subtasks: taskState.subtasks,
        comments: taskState.comments,
        projects: taskState.projects,
        reminders: taskState.reminders,
      },
    };
  }, [state, userState, taskState, appVersion]);

  /* ── Manual backup to file ───────────────────────────────── */
  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = createBackupData();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `DCEL_Backup_${dateStr}_${timeStr}.json`;
      link.click();
      URL.revokeObjectURL(url);

      const updated = { ...backupSettings, lastBackupAt: new Date().toISOString() };
      saveBackupSettings(updated);
      toast.success('Backup downloaded successfully!');
    } catch (err) {
      toast.error('Backup failed. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  /* ── Restore from file ───────────────────────────────────── */
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const backup = JSON.parse(json);

        if (!backup?.data || !backup?.version) {
          toast.error('Invalid backup file format.');
          setIsRestoring(false);
          return;
        }

        const d = backup.data;

        // Restore each slice of state
        if (d.sites)                useAppStore.setState({ sites: d.sites });
        if (d.clients)              useAppStore.setState({ clients: d.clients });
        if (d.employees)            useAppStore.setState({ employees: d.employees });
        if (d.attendanceRecords)    useAppStore.setState({ attendanceRecords: d.attendanceRecords });
        if (d.positions)            useAppStore.setState({ positions: d.positions });
        if (d.departments)          useAppStore.setState({ departments: d.departments });
        if (d.invoices)             useAppStore.setState({ invoices: d.invoices });
        if (d.pendingInvoices)      useAppStore.setState({ pendingInvoices: d.pendingInvoices });
        if (d.salaryAdvances)       useAppStore.setState({ salaryAdvances: d.salaryAdvances });
        if (d.loans)                useAppStore.setState({ loans: d.loans });
        if (d.payments)             useAppStore.setState({ payments: d.payments });
        if (d.vatPayments)          useAppStore.setState({ vatPayments: d.vatPayments });
        if (d.payrollVariables)     useAppStore.setState({ payrollVariables: d.payrollVariables });
        if (d.payeTaxVariables)     useAppStore.setState({ payeTaxVariables: d.payeTaxVariables });
        if (d.monthValues)          useAppStore.setState({ monthValues: d.monthValues });
        if (d.publicHolidays)       useAppStore.setState({ publicHolidays: d.publicHolidays });
        if (d.departmentTasksList)  useAppStore.setState({ departmentTasksList: d.departmentTasksList });
        if (d.leaves)               useAppStore.setState({ leaves: d.leaves });
        if (d.leaveTypes)           useAppStore.setState({ leaveTypes: d.leaveTypes });
        if (d.pendingSites)         useAppStore.setState({ pendingSites: d.pendingSites });
        if (d.disciplinaryRecords)  useAppStore.setState({ disciplinaryRecords: d.disciplinaryRecords });
        if (d.evaluations)          useAppStore.setState({ evaluations: d.evaluations });
        if (d.ledgerCategories)     useAppStore.setState({ ledgerCategories: d.ledgerCategories });
        if (d.ledgerVendors)        useAppStore.setState({ ledgerVendors: d.ledgerVendors });
        if (d.ledgerBanks)          useAppStore.setState({ ledgerBanks: d.ledgerBanks });
        if (d.ledgerEntries)        useAppStore.setState({ ledgerEntries: d.ledgerEntries });
        if (d.hrVariables)          useAppStore.setState({ hrVariables: d.hrVariables });

        const bDate = new Date(backup.backupDate).toLocaleString();
        toast.success(`Data restored from backup dated ${bDate}`);
      } catch (err) {
        toast.error('Restore failed. The file may be corrupted.');
      } finally {
        setIsRestoring(false);
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  /* ── Auto-backup scheduler ───────────────────────────────── */
  useEffect(() => {
    if (autoBackupTimerRef.current) clearInterval(autoBackupTimerRef.current);
    if (!backupSettings.autoBackupEnabled) return;

    const checkAndBackup = () => {
      const now = new Date();
      const [hh, mm] = backupSettings.autoBackupTime.split(':').map(Number);
      const isRightTime = now.getHours() === hh && now.getMinutes() === mm;
      if (!isRightTime) return;

      const last = backupSettings.lastBackupAt ? new Date(backupSettings.lastBackupAt) : null;
      const msInDay = 86400000;
      const intervals = { daily: msInDay, weekly: msInDay * 7, monthly: msInDay * 30 };
      const msRequired = intervals[backupSettings.autoBackupInterval];

      if (!last || (now.getTime() - last.getTime()) >= msRequired) {
        handleManualBackup();
      }
    };

    autoBackupTimerRef.current = setInterval(checkAndBackup, 60000); // check every minute
    return () => { if (autoBackupTimerRef.current) clearInterval(autoBackupTimerRef.current); };
  }, [backupSettings, handleManualBackup]);

  const handleCheckForUpdates = () => {
    if (isElectron && (window.electronAPI as any)?.checkForUpdates) {
      setIsChecking(true);
      (window.electronAPI as any).checkForUpdates();
      setTimeout(() => setIsChecking(false), 3000);
    }
  };

  const handleEditStart = () => { setDraft({ ...saved }); setIsEditing(true); };
  const handleCancel    = () => { setDraft({ ...saved }); setIsEditing(false); };
  const handleSave      = async () => {
    setIsSavingDB(true);
    try {
      const payload = {
        company_name:        draft.name,
        company_reg_number:  draft.regNumber,
        company_email:       draft.email,
        company_phone:       draft.phone,
        company_address:     draft.address,
        updated_at:          new Date().toISOString(),
      };
      if (settingsRowId) {
        await supabase.from('app_settings').update(payload).eq('id', settingsRowId);
      } else {
        const { data } = await supabase.from('app_settings').insert(payload).select('id').single();
        if (data) setSettingsRowId(data.id);
      }
      setSaved({ ...draft });
      setIsEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      toast.success('Company information saved to database.');
    } catch (err) {
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSavingDB(false);
    }
  };

  const fields: { key: keyof CompanyInfo; label: string; icon: any; type?: string; fullWidth?: boolean }[] = [
    { key: 'name',      label: 'Company Name',       icon: Building, fullWidth: true },
    { key: 'regNumber', label: 'Registration Number', icon: Hash },
    { key: 'email',     label: 'Primary Email',       icon: Mail,  type: 'email' },
    { key: 'phone',     label: 'Phone Number',        icon: Phone, type: 'tel' },
    { key: 'address',   label: 'Address',             icon: MapPin, fullWidth: true },
  ];

  const lastBackupFormatted = backupSettings.lastBackupAt
    ? new Date(backupSettings.lastBackupAt).toLocaleString()
    : 'Never';

  useSetPageTitle('Settings', 'Manage company preferences, backup, integrations, and variables');

  return (
    <div className="flex flex-col gap-8">

      <Tabs className="w-full">
        <TabsList className="mb-8 bg-slate-100 flex-wrap gap-y-1">
          <TabsTrigger active={activeTab === 'general'}      onClick={() => setActiveTab('general')}      className="w-32">
            <Building       className="mr-2 h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'backup'}       onClick={() => setActiveTab('backup')}       className="w-40">
            <DatabaseBackup className="mr-2 h-4 w-4" /> Backup &amp; Restore
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} className="w-36">
            <LinkIcon       className="mr-2 h-4 w-4" /> Integrations
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'updates'}      onClick={() => setActiveTab('updates')}      className="w-32">
            <CloudDownload  className="mr-2 h-4 w-4" /> Updates
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'variables'}    onClick={() => setActiveTab('variables')}    className="w-36">
            <Library        className="mr-2 h-4 w-4" /> Variables
          </TabsTrigger>
        </TabsList>

        {/* ─────────── GENERAL TAB ─────────────────────────────────── */}
        <TabsContent active={activeTab === 'general'}>
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Company Information</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isEditing ? 'Edit your company details below.' : 'View your registered company profile.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {justSaved && !isEditing && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-in fade-in duration-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-9">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={isSavingDB} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-4">
                        {isSavingDB ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSavingDB ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleEditStart} className="gap-1.5 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 h-9">
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 py-6">
              {isEditing ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {fields.map(({ key, label, icon: Icon, type, fullWidth }) => (
                    <div key={key} className={fullWidth ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </label>
                      <Input
                        type={type || 'text'}
                        value={draft[key]}
                        onChange={(e) => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5" /> Company Name
                      </p>
                      <p className="text-base font-semibold text-slate-800 leading-snug">{saved.name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Registration Number
                      </p>
                      <span className="text-sm font-mono font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block border border-slate-200">
                        {saved.regNumber}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Address
                      </p>
                      <p className="text-sm text-slate-700">{saved.address}</p>
                    </div>
                  </div>
                  <div className="space-y-6 md:border-l md:border-slate-100 md:pl-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Primary Email
                      </p>
                      <a href={`mailto:${saved.email}`} className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline font-medium">
                        {saved.email}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </p>
                      <p className="text-sm text-slate-700 font-medium">{saved.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── BACKUP & RESTORE TAB ─────────────────────────── */}
        <TabsContent active={activeTab === 'backup'}>
          <div className="flex flex-col gap-6">

            {/* Manual Backup & Restore */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    <DatabaseBackup className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Manual Backup &amp; Restore</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Export your full app data to a file or restore from a previous backup.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Backup section */}
                  <div className="flex flex-col gap-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-bold text-slate-800">Create Backup</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Downloads a <strong>.json</strong> file containing all your app data — employees, attendance, payroll, invoices, sites, and settings. Save this file to your PC for safekeeping.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Last backup: <strong>{lastBackupFormatted}</strong></span>
                    </div>
                    <Button
                      onClick={handleManualBackup}
                      disabled={isBackingUp}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 rounded-xl shadow-sm"
                    >
                      {isBackingUp
                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating backup…</>
                        : <><Download className="h-4 w-4" /> Download Backup File</>
                      }
                    </Button>
                  </div>

                  {/* Restore section */}
                  <div className="flex flex-col gap-4 p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-amber-600" />
                      <h3 className="font-bold text-slate-800">Restore from Backup</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Select a previously exported <strong>.json</strong> backup file to restore all your data. This will <strong className="text-amber-700">overwrite your current data</strong>.
                    </p>
                    <div className="flex items-center gap-2 text-xs bg-amber-100 text-amber-800 rounded-lg px-3 py-2 border border-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Create a backup of your current data before restoring.</span>
                    </div>
                    <input
                      ref={restoreInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFile}
                      className="hidden"
                      id="restore-file-input"
                    />
                    <Button
                      variant="outline"
                      disabled={isRestoring}
                      onClick={() => restoreInputRef.current?.click()}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-2 h-11 rounded-xl"
                    >
                      {isRestoring
                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Restoring…</>
                        : <><Upload className="h-4 w-4" /> Select Backup File</>
                      }
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Backup Settings */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">Automatic Backup</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Schedule automatic backups to run in the background.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600">
                      {backupSettings.autoBackupEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {/* Toggle switch */}
                    <button
                      onClick={() => saveBackupSettings({ ...backupSettings, autoBackupEnabled: !backupSettings.autoBackupEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        backupSettings.autoBackupEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        backupSettings.autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className={`grid md:grid-cols-3 gap-5 transition-opacity ${backupSettings.autoBackupEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {/* Interval */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Backup Frequency</label>
                    <select
                      value={backupSettings.autoBackupInterval}
                      onChange={e => saveBackupSettings({ ...backupSettings, autoBackupInterval: e.target.value as BackupSettings['autoBackupInterval'] })}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      <option value="daily">Every Day</option>
                      <option value="weekly">Every Week</option>
                      <option value="monthly">Every Month</option>
                    </select>
                  </div>

                  {/* Time */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Backup Time</label>
                    <Input
                      type="time"
                      value={backupSettings.autoBackupTime}
                      onChange={e => saveBackupSettings({ ...backupSettings, autoBackupTime: e.target.value })}
                      className="h-10 bg-slate-50 border-slate-200"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
                    <div className="h-10 flex items-center gap-2">
                      {backupSettings.autoBackupEnabled ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" /> Active — Auto-save on
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 gap-1.5">
                          <X className="h-3.5 w-3.5" /> Disabled
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {backupSettings.autoBackupEnabled && (
                  <div className="mt-4 text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                    <strong className="text-emerald-700">How it works:</strong> The app checks your schedule every minute while open. When the backup time arrives and the required interval has passed since the last backup, a file will automatically be downloaded to your browser's default download folder.
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ─────────── INTEGRATIONS TAB ────────────────────────────── */}
        <TabsContent active={activeTab === 'integrations'}>
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { letter: 'W', name: 'Microsoft Word',  desc: 'Document Generation', bg: 'bg-blue-100',    text: 'text-blue-600',    connected: true  },
                  { letter: 'X', name: 'Microsoft Excel', desc: 'Data Import/Export',  bg: 'bg-emerald-100', text: 'text-emerald-600', connected: true  },
                  { letter: 'Q', name: 'QuickBooks',      desc: 'Accounting Sync',     bg: 'bg-green-100',   text: 'text-green-600',   connected: false },
                ].map(({ letter, name, desc, bg, text, connected }) => (
                  <div key={name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 ${bg} ${text} flex items-center justify-center rounded-md font-bold text-xl`}>{letter}</div>
                      <div>
                        <p className="font-medium text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                    {connected
                      ? <Badge variant="success">Connected</Badge>
                      : <Button variant="outline" size="sm">Connect</Button>
                    }
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── UPDATES TAB ─────────────────────────────────── */}
        <TabsContent active={activeTab === 'updates'}>
          <Card>
            <CardHeader>
              <CardTitle>Application Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="h-12 w-12 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl shadow-sm">
                    <CloudDownload className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Current Version</h3>
                    <p className="text-sm text-slate-500">v{appVersion}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleCheckForUpdates}
                    disabled={!isElectron || isChecking}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                  >
                    {isChecking
                      ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      : <CloudDownload className="mr-2 h-4 w-4" />
                    }
                    {isChecking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                  {!isElectron && (
                    <p className="text-xs text-slate-400 text-center">Only available in Desktop App</p>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-600 space-y-2">
                <p><strong>Auto-Update:</strong> The app automatically checks for updates on startup.</p>
                <p><strong>Channel:</strong> Stable releases only.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── VARIABLES TAB ───────────────────────────────── */}
        <TabsContent active={activeTab === 'variables'}>
          <Variables />
        </TabsContent>
      </Tabs>
    </div>
  );
}

