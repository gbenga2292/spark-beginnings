import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Badge } from '@/src/components/ui/badge';
import {
  Save, Building, Link as LinkIcon, CloudDownload,
  RefreshCw, Library, Pencil, X, Mail, Phone, MapPin, Hash, CheckCircle2,
  DatabaseBackup, Upload, Download, Clock, ShieldCheck, AlertTriangle, FolderOpen,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Variables } from './Variables';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { toast } from '@/src/components/ui/toast';
import { supabase } from '@/src/integrations/supabase/client';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { exportFullAppToExcel, restoreFullAppFromExcel } from '@/src/lib/excelBackup';
import { usePriv } from '@/src/hooks/usePriv';

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
  autoBackupInterval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  autoBackupTime: string; // HH:MM
  autoBackupLocation: string | null; // Base directory
  autoBackupDayOfWeek: string; // '1'(Mon)-'7'(Sun)
  autoBackupDayOfMonth: string; // '1'-'31'
  autoBackupMonthOfYear: string; // '0'(Jan)-'11'(Dec)
  lastBackupAt: string | null;
}

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupInterval: 'daily',
  autoBackupTime: '08:00',
  autoBackupLocation: null,
  autoBackupDayOfWeek: '1',
  autoBackupDayOfMonth: '1',
  autoBackupMonthOfYear: '0',
  lastBackupAt: null,
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [isChecking, setIsChecking] = useState(false);
  const isElectron = ((window as any).electronAPI as any)?.isElectron as boolean | undefined;

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
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isRestoringExcel, setIsRestoringExcel] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const restoreExcelInputRef = useRef<HTMLInputElement>(null);
  const autoBackupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get all app data from store
  const state = useAppStore();
  const userState = useUserStore();
  const taskState = useAppData();
  const priv = usePriv('variables');

  useEffect(() => {
    if (isElectron && ((window as any).electronAPI as any)?.getVersion) {
      ((window as any).electronAPI as any).getVersion().then((v: string) => setAppVersion(v)).catch(console.error);
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
        commLogs: state.commLogs,
        clientContacts: state.clientContacts,
        dailyJournals: state.dailyJournals,
        siteJournalEntries: state.siteJournalEntries,
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
        staffMeritRecords: state.staffMeritRecords,
        vehicles: state.vehicles,
        vehicleTrips: state.vehicleTrips,
        vehicleDocumentTypes: state.vehicleDocumentTypes,
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
  const handleManualBackup = async (overrideBasePath?: string) => {
    if (!priv.canBackup) return;
    setIsBackingUp(true);
    try {
      const backup = createBackupData();
      const json = JSON.stringify(backup, null, 2);
      
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const fileName = `DCEL_Backup_${dateStr}_${timeStr}.json`;

      if (overrideBasePath && (window as any).electronAPI?.writeFile) {
        // Auto-save silently to defined location
        const pathSep = (window as any).electronAPI.platform === 'win32' ? '\\' : '/';
        const overridePath = `${overrideBasePath}${pathSep}json backups${pathSep}${fileName}`;
        await (window as any).electronAPI.writeFile(overridePath, json, 'utf8');
      } else {
        // Manual browser/electron download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }

      const updated = { ...backupSettings, lastBackupAt: new Date().toISOString() };
      saveBackupSettings(updated);
      toast.success('JSON Backup completed successfully!');
    } catch (err) {
      toast.error('Backup failed. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  /* ── Restore from file ───────────────────────────────────── */
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!priv.canRestore) return;
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
        if (d.commLogs)             useAppStore.setState({ commLogs: d.commLogs });
        if (d.clientContacts)       useAppStore.setState({ clientContacts: d.clientContacts });
        if (d.dailyJournals)        useAppStore.setState({ dailyJournals: d.dailyJournals });
        if (d.siteJournalEntries)   useAppStore.setState({ siteJournalEntries: d.siteJournalEntries });
        if (d.staffMeritRecords)    useAppStore.setState({ staffMeritRecords: d.staffMeritRecords });
        if (d.vehicles)             useAppStore.setState({ vehicles: d.vehicles });
        if (d.vehicleTrips)         useAppStore.setState({ vehicleTrips: d.vehicleTrips });
        if (d.vehicleDocumentTypes) useAppStore.setState({ vehicleDocumentTypes: d.vehicleDocumentTypes });

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

  /* ── Export full App state to Excel ──────────────────────── */
  const handleExportExcel = async (overrideBasePath?: string) => {
    if (!priv.canBackup) return;
    setIsExportingExcel(true);
    try {
      const backupData = createBackupData();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const fileName = `DCEL_Full_Backup_${dateStr}_${timeStr}.xlsx`;

      let overridePath: string | undefined;
      if (overrideBasePath && (window as any).electronAPI?.platform) {
        const pathSep = (window as any).electronAPI.platform === 'win32' ? '\\' : '/';
        overridePath = `${overrideBasePath}${pathSep}excel back ups${pathSep}${fileName}`;
      }

      await exportFullAppToExcel(backupData.data, backupData.appVersion, overridePath);
      toast.success('Excel export completed successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Excel Export failed. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  /* ── Restore full App state from Excel ───────────────────── */
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!priv.canRestore) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoringExcel(true);

    try {
      const d = await restoreFullAppFromExcel(file);
      
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
      if (d.disciplinaryRecords)  useAppStore.setState({ disciplinaryRecords: d.disciplinaryRecords });
      if (d.evaluations)          useAppStore.setState({ evaluations: d.evaluations });
      if (d.ledgerCategories)     useAppStore.setState({ ledgerCategories: d.ledgerCategories });
      if (d.ledgerVendors)        useAppStore.setState({ ledgerVendors: d.ledgerVendors });
      if (d.ledgerBanks)          useAppStore.setState({ ledgerBanks: d.ledgerBanks });
      if (d.ledgerBeneficiaryBanks) useAppStore.setState({ ledgerBeneficiaryBanks: d.ledgerBeneficiaryBanks });
      if (d.ledgerEntries)        useAppStore.setState({ ledgerEntries: d.ledgerEntries });
      if (d.companyExpenses)      useAppStore.setState({ companyExpenses: d.companyExpenses });
      if (d.hrVariables)          useAppStore.setState({ hrVariables: d.hrVariables });

      toast.success('Data restored from Excel successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore from Excel. File might be invalid.');
    } finally {
      setIsRestoringExcel(false);
      if (restoreExcelInputRef.current) restoreExcelInputRef.current.value = '';
    }
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

      const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun
      const currentDayOfMonth = now.getDate();
      const currentMonth = now.getMonth(); // 0=Jan

      // Check interval conditions
      if (backupSettings.autoBackupInterval === 'weekly') {
        if (currentDayOfWeek !== parseInt(backupSettings.autoBackupDayOfWeek, 10)) return;
      }
      if (backupSettings.autoBackupInterval === 'monthly') {
        if (currentDayOfMonth !== parseInt(backupSettings.autoBackupDayOfMonth, 10)) return;
      }
      if (backupSettings.autoBackupInterval === 'yearly') {
        if (currentMonth !== parseInt(backupSettings.autoBackupMonthOfYear, 10) || 
            currentDayOfMonth !== parseInt(backupSettings.autoBackupDayOfMonth, 10)) return;
      }

      const last = backupSettings.lastBackupAt ? new Date(backupSettings.lastBackupAt) : null;
      // If we already backed up today, don't run again
      if (last && last.getDate() === currentDayOfMonth && last.getMonth() === currentMonth && last.getFullYear() === now.getFullYear()) {
         return;
      }

      // Execute both JSON and EXCEL to the predetermined location
      const loc = backupSettings.autoBackupLocation;
      if (loc && isElectron) {
        handleManualBackup(loc);
        handleExportExcel(loc);
      } else {
        handleManualBackup(); // fallback if no location set (will prompt download in browser)
      }
    };

    autoBackupTimerRef.current = setInterval(checkAndBackup, 60000); // check every minute
    return () => { if (autoBackupTimerRef.current) clearInterval(autoBackupTimerRef.current); };
  }, [backupSettings]);

  const selectBackupLocation = async () => {
    if (!priv.canBackup && !priv.canEdit) return;
    if ((window as any).electronAPI?.openPathDialog) {
      const path = await (window as any).electronAPI.openPathDialog({ folder: true, title: 'Select Backup Folder' });
      if (path) {
        saveBackupSettings({ ...backupSettings, autoBackupLocation: path });
      }
    } else {
       toast.error('Directory selection is only supported in Desktop App mode.');
    }
  };

  const handleCheckForUpdates = () => {
    if (isElectron && ((window as any).electronAPI as any)?.checkForUpdates) {
      setIsChecking(true);
      ((window as any).electronAPI as any).checkForUpdates();
      setTimeout(() => setIsChecking(false), 3000);
    }
  };

  const handleEditStart = () => { if (!priv.canEdit) return; setDraft({ ...saved }); setIsEditing(true); };
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
          {priv.canBackup || priv.canRestore ? (
            <TabsTrigger active={activeTab === 'backup'}       onClick={() => setActiveTab('backup')}       className="w-40">
              <DatabaseBackup className="mr-2 h-4 w-4" /> Backup &amp; Restore
            </TabsTrigger>
          ) : null}
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
                    priv.canEdit && (
                      <Button variant="outline" size="sm" onClick={handleEditStart} className="gap-1.5 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 h-9">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    )
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
                      onClick={() => handleManualBackup()}
                      disabled={isBackingUp || !priv.canBackup}
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
                      disabled={isRestoring || !priv.canRestore}
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

            {/* Excel Manual Backup & Restore */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shadow-sm">
                    <DatabaseBackup className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Excel Data Sync</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Export all application data to a multi-tab Excel file, or restore from one.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Export section */}
                  <div className="flex flex-col gap-4 p-5 bg-teal-50/50 rounded-2xl border border-teal-100">
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-teal-600" />
                      <h3 className="font-bold text-slate-800">Export to Excel</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Downloads an <strong>.xlsx</strong> file mapping every major section (e.g., Employees, Attendance, Leaves, Salary) to separate tabs. Ideal for reporting and robust backups.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2 mt-auto">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>Generates snapshot of current database instantly.</span>
                    </div>
                    <Button
                      onClick={() => handleExportExcel()}
                      disabled={isExportingExcel || !priv.canBackup}
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-2 h-11 rounded-xl shadow-sm mt-2"
                    >
                      {isExportingExcel
                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Exporting…</>
                        : <><Download className="h-4 w-4" /> Download Excel File</>
                      }
                    </Button>
                  </div>

                  {/* Restore section */}
                  <div className="flex flex-col gap-4 p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-amber-600" />
                      <h3 className="font-bold text-slate-800">Restore from Excel</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Upload a previously exported <strong>.xlsx</strong> file. The system will read each tab and update your data accordingly. <strong className="text-amber-700">This will overwrite all current system data!</strong>
                    </p>
                    <div className="flex items-center gap-2 text-xs bg-amber-100 text-amber-800 rounded-lg px-3 py-2 border border-amber-200 mt-auto">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Ensure file structure hasn't been tampered with.</span>
                    </div>
                    <input
                      ref={restoreExcelInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImportExcel}
                      className="hidden"
                      id="restore-excel-file-input"
                    />
                    <Button
                      variant="outline"
                      disabled={isRestoringExcel || !priv.canRestore}
                      onClick={() => restoreExcelInputRef.current?.click()}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-2 h-11 rounded-xl mt-2"
                    >
                      {isRestoringExcel
                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing from Excel…</>
                        : <><Upload className="h-4 w-4" /> Select Excel File</>
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
                      disabled={!priv.canEdit}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        backupSettings.autoBackupEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                      } ${!priv.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        backupSettings.autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className={`grid md:grid-cols-2 lg:grid-cols-4 gap-5 transition-opacity ${backupSettings.autoBackupEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'} ${!priv.canEdit ? 'pointer-events-none opacity-80' : ''}`}>
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
                      <option value="yearly">Every Year</option>
                    </select>
                  </div>

                  {/* Dynamic Date Pickers Based On Interval */}
                  {backupSettings.autoBackupInterval === 'weekly' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Day of Week</label>
                      <select
                        value={backupSettings.autoBackupDayOfWeek}
                        onChange={e => saveBackupSettings({ ...backupSettings, autoBackupDayOfWeek: e.target.value })}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      >
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                        <option value="7">Sunday</option>
                      </select>
                    </div>
                  )}

                  {(backupSettings.autoBackupInterval === 'yearly') && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Month</label>
                      <select
                        value={backupSettings.autoBackupMonthOfYear}
                        onChange={e => saveBackupSettings({ ...backupSettings, autoBackupMonthOfYear: e.target.value })}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      >
                        <option value="0">January</option>
                        <option value="1">February</option>
                        <option value="2">March</option>
                        <option value="3">April</option>
                        <option value="4">May</option>
                        <option value="5">June</option>
                        <option value="6">July</option>
                        <option value="7">August</option>
                        <option value="8">September</option>
                        <option value="9">October</option>
                        <option value="10">November</option>
                        <option value="11">December</option>
                      </select>
                    </div>
                  )}

                  {(backupSettings.autoBackupInterval === 'monthly' || backupSettings.autoBackupInterval === 'yearly') && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Day of Month</label>
                      <select
                        value={backupSettings.autoBackupDayOfMonth}
                        onChange={e => saveBackupSettings({ ...backupSettings, autoBackupDayOfMonth: e.target.value })}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={String(day)}>{day}</option>
                        ))}
                      </select>
                    </div>
                  )}

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

                  {/* Location Picker */}
                  <div className="space-y-2 md:col-span-2 lg:col-span-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Backup Storage Folder</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        readOnly
                        onClick={selectBackupLocation}
                        value={backupSettings.autoBackupLocation || 'Not selected — defaults to browser downloads'}
                        className="h-10 bg-slate-50 border-slate-200 flex-1 text-slate-600 truncate cursor-pointer hover:bg-slate-100 transition-colors"
                      />
                      <Button variant="outline" onClick={selectBackupLocation} className="h-10 px-4 shrink-0 text-slate-700 bg-white">
                        <FolderOpen className="h-4 w-4 mr-2" /> Browse...
                      </Button>
                    </div>
                  </div>
                </div>

                {backupSettings.autoBackupEnabled && (
                  <div className="mt-6 text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 leading-relaxed">
                    <strong className="text-emerald-700">How it works:</strong> The app checks your schedule in the background. When the assigned time arrives, both a <strong>JSON file</strong> and an <strong>Excel file</strong> will be automatically generated and securely saved into structured folders in your selected Backup Storage Folder.
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

