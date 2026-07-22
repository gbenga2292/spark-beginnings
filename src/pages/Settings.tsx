import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Badge } from '@/src/components/ui/badge';
import {
  Save, Building, Link as LinkIcon, CloudDownload,
  RefreshCw, Library, Pencil, X, Mail, Phone, MapPin, Hash, CheckCircle2,
  DatabaseBackup, Upload, Download, Clock, ShieldCheck, AlertTriangle, FolderOpen,
  Bot, Key, Eye, EyeOff, Star, Trash2, ToggleLeft, ToggleRight, FlaskConical, Cpu,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Variables } from './Variables';
import { useAppStore } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useOperations } from '@/src/contexts/OperationsContext';
import { toast } from '@/src/components/ui/toast';
import { supabase } from '@/src/integrations/supabase/client';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { exportFullAppToExcel, restoreFullAppFromExcel } from '@/src/lib/excelBackup';
import { performSupabaseDatabaseBackup } from '@/src/lib/supabaseBackup';
import { usePriv } from '@/src/hooks/usePriv';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import packageJson from '../../../package.json';
import { APP_VERSION } from '@/src/constants/version';

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

// ─── AI Settings Types ────────────────────────────────────────────────
interface ApiKey {
  id: string;
  label: string;
  provider: string;
  keyValue: string;
  isDefault: boolean;
  defaultModel?: string;
}

const AI_PROVIDERS = ['gemini', 'groq', 'openai', 'xai', 'anthropic', 'cohere', 'mistral'];

const PROVIDER_MODELS: Record<string, string[]> = {
  gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-pro-exp-02-05'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'gpt-4-turbo'],
  xai: ['grok-2', 'grok-beta'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  cohere: ['command-r-plus', 'command-r'],
  mistral: ['mistral-large-latest', 'pixtral-large-latest', 'open-mixtral-8x22b'],
};

function detectProvider(key: string): string {
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('sk-ant')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (key.startsWith('xai-')) return 'xai';
  return 'unknown';
}

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const [isChecking, setIsChecking] = useState(false);
  const isElectron = ((window as any).electronAPI as any)?.isElectron as boolean | undefined;
  const isAndroidNative = Capacitor.getPlatform() === 'android';

  /* ── AI Settings state ───────────────────────────────────────── */
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [allocationMode, setAllocationMode] = useState<'analytic' | 'hybrid'>('analytic');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('');
  const [newKeyDefaultModel, setNewKeyDefaultModel] = useState('');
  const activeProvider = newKeyProvider || detectProvider(newKeyValue);
  const activeProviderModels = PROVIDER_MODELS[activeProvider] || [];
  const [showNewKey, setShowNewKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [editKeyId, setEditKeyId] = useState<string | null>(null);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Set<string>>(new Set());
  const [isSavingMode, setIsSavingMode] = useState(false);
  const workspaceId = useAppStore(s => (s as any).workspaceId || 'default');

  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Debounced live API model fetching when key is entered/edited
  useEffect(() => {
    if (!newKeyValue || newKeyValue.length < 10) {
      setFetchedModels([]);
      return;
    }
    
    const provider = newKeyProvider || detectProvider(newKeyValue);
    if (provider !== 'gemini' && provider !== 'groq' && provider !== 'openai') {
      setFetchedModels([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsFetchingModels(true);
      try {
        let models: string[] = [];
        if (provider === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${newKeyValue}`);
          if (res.ok) {
            const data = await res.json();
            models = (data.models || [])
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name.replace('models/', ''));
          }
        } else if (provider === 'groq') {
          const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${newKeyValue}` }
          });
          if (res.ok) {
            const data = await res.json();
            models = (data.data || []).map((m: any) => m.id);
          }
        } else if (provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${newKeyValue}` }
          });
          if (res.ok) {
            const data = await res.json();
            models = (data.data || [])
              .map((m: any) => m.id)
              .filter((id: string) => id.includes('gpt') || id.includes('o1') || id.startsWith('o3'));
          }
        }
        
        if (models.length > 0) {
          // Sort models alphabetically
          setFetchedModels(models.sort());
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
      } finally {
        setIsFetchingModels(false);
      }
    }, 1000);

    return () => clearTimeout(delayDebounce);
  }, [newKeyValue, newKeyProvider]);

  const modelsList = fetchedModels.length > 0 ? fetchedModels : activeProviderModels;

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
  const [isBackingUpSupabase, setIsBackingUpSupabase] = useState(false);
  const [supabaseDbConnString, setSupabaseDbConnString] = useState(() => localStorage.getItem('dcel-supabase-db-url') || '');
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const restoreExcelInputRef = useRef<HTMLInputElement>(null);
  const autoBackupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get all app data from store
  const state = useAppStore();
  const userState = useUserStore();
  const taskState = useAppData();
  const operationsState = useOperations();
  const priv = usePriv('variables');

  useEffect(() => {
    if (isElectron && ((window as any).electronAPI as any)?.getVersion) {
      ((window as any).electronAPI as any).getVersion().then((v: string) => setAppVersion(v)).catch(console.error);
    } else if (isAndroidNative) {
      setAppVersion(APP_VERSION);
    }
  }, [isElectron, isAndroidNative]);

  /* ── Load AI keys and mode from Supabase ─────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: keysData } = await supabase.from('api_keys').select('*').eq('workspace_id', workspaceId);
      if (keysData) {
        setApiKeys(keysData.map((k: any) => ({
          id: k.id,
          label: k.label || '',
          provider: k.provider,
          keyValue: k.key_value,
          isDefault: k.is_default,
          defaultModel: k.default_model || '',
        })));
      }
      const { data: settingsData } = await supabase
        .from('workspace_settings')
        .select('resource_allocation_mode')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (settingsData?.resource_allocation_mode) {
        setAllocationMode(settingsData.resource_allocation_mode as 'analytic' | 'hybrid');
      }
    })();
  }, [workspaceId]);

  /* ── AI key auto-detect provider ────────────────────────────── */
  useEffect(() => {
    const detected = detectProvider(newKeyValue);
    if (detected !== 'unknown') setNewKeyProvider(detected);
  }, [newKeyValue]);

  const handleSaveApiKey = async () => {
    if (!newKeyValue.trim()) { toast.error('API Key is required.'); return; }
    setIsSavingKey(true);
    try {
      const provider = newKeyProvider || detectProvider(newKeyValue);
      const payload = {
        label: newKeyLabel || provider,
        provider,
        key_value: newKeyValue,
        is_default: apiKeys.length === 0,
        workspace_id: workspaceId,
        default_model: newKeyDefaultModel,
      };
      if (editKeyId) {
        await supabase.from('api_keys').update(payload).eq('id', editKeyId);
        setApiKeys(prev => prev.map(k => k.id === editKeyId ? { ...k, label: payload.label, provider: payload.provider, keyValue: payload.key_value, defaultModel: payload.default_model } : k));
        setEditKeyId(null);
        toast.success('API Key updated.');
      } else {
        const { data } = await supabase.from('api_keys').insert(payload).select('id, default_model').single();
        if (data) {
          setApiKeys(prev => [...prev, { id: data.id, label: payload.label, provider: payload.provider, keyValue: payload.key_value, isDefault: payload.is_default, defaultModel: data.default_model || '' }]);
        }
        toast.success('API Key saved.');
      }
      setNewKeyLabel(''); setNewKeyValue(''); setNewKeyProvider(''); setNewKeyDefaultModel(''); setFetchedModels([]);
    } catch { toast.error('Failed to save key.'); }
    finally { setIsSavingKey(false); }
  };

  const handleDeleteKey = async (id: string) => {
    await supabase.from('api_keys').delete().eq('id', id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
    toast.success('Key deleted.');
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('api_keys').update({ is_default: false }).eq('workspace_id', workspaceId);
    await supabase.from('api_keys').update({ is_default: true }).eq('id', id);
    setApiKeys(prev => prev.map(k => ({ ...k, isDefault: k.id === id })));
    toast.success('Default key updated.');
  };

  const handleTestKey = async () => {
    if (!newKeyValue.trim()) { toast.error('Enter a key to test.'); return; }
    setIsTestingKey(true);
    const provider = newKeyProvider || detectProvider(newKeyValue);
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${newKeyValue}`);
        res.ok ? toast.success('Gemini key is valid! ✓') : toast.error('Gemini key rejected.');
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${newKeyValue}` } });
        res.ok ? toast.success('Groq key is valid! ✓') : toast.error('Groq key rejected.');
      } else {
        toast.info('Key format looks OK — live test not available for this provider yet.');
      }
    } catch { toast.error('Network error during test.'); }
    finally { setIsTestingKey(false); }
  };

  const handleSaveMode = async (mode: 'analytic' | 'hybrid') => {
    setIsSavingMode(true);
    setAllocationMode(mode);
    try {
      await supabase.from('workspace_settings').upsert({ workspace_id: workspaceId, resource_allocation_mode: mode }, { onConflict: 'workspace_id' });
      toast.success(`Mode switched to ${mode === 'hybrid' ? 'Hybrid (AI)' : 'Analytic'}.`);
    } catch { toast.error('Failed to save mode.'); }
    finally { setIsSavingMode(false); }
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const maskKey = (key: string) => key.slice(0, 6) + '•'.repeat(Math.min(key.length - 6, 12));

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
        ledgerBeneficiaryBanks: state.ledgerBeneficiaryBanks,
        companyExpenses: state.companyExpenses,
        // Operations Context
        vehicleFuelLogs: operationsState.vehicleFuelLogs,
        dieselRefills: operationsState.dieselRefills,
        dailyMachineLogs: operationsState.dailyMachineLogs,
        assets: operationsState.assets,
        waybills: operationsState.waybills,
        checkouts: operationsState.checkouts,
        maintenanceAssets: operationsState.maintenanceAssets,
        maintenanceSessions: operationsState.maintenanceSessions,
        maintenanceCertificates: operationsState.maintenanceCertificates,
        // User Store
        users: userState.users,
        presets: userState.presets,
        // Task Context & Budget
        mainTasks: taskState.mainTasks,
        subtasks: taskState.subtasks,
        comments: taskState.comments,
        projects: taskState.projects,
        reminders: taskState.reminders,
        budgetItems: state.budgetItems,
      },
    };
  }, [state, userState, taskState, operationsState, appVersion]);

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
        if (d.ledgerBeneficiaryBanks) useAppStore.setState({ ledgerBeneficiaryBanks: d.ledgerBeneficiaryBanks });
        if (d.companyExpenses)      useAppStore.setState({ companyExpenses: d.companyExpenses });
        if (d.budgetItems)          useAppStore.setState({ budgetItems: d.budgetItems });

        // Restore Operations & Tasks context states
        operationsState.importOperationsBackupData(d);
        taskState.importTaskBackupData(d);

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

  /* ── Export Supabase Database Backup (SQL / CLI) ────────── */
  const handleSupabaseBackup = async () => {
    if (!priv.canBackup) return;
    setIsBackingUpSupabase(true);
    try {
      const res = await performSupabaseDatabaseBackup(supabaseDbConnString || undefined);
      if (res.canceled) return;
      if (res.success) {
        toast.success(res.message || `Supabase database backup created successfully!`);
      } else {
        toast.error(res.message || 'Supabase backup failed. Please check your connection string or CLI.');
      }
    } catch (err: any) {
      console.error('Supabase database backup error:', err);
      toast.error('Supabase backup failed.');
    } finally {
      setIsBackingUpSupabase(false);
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
      if (d.vehicles)             useAppStore.setState({ vehicles: d.vehicles });
      if (d.vehicleTrips)         useAppStore.setState({ vehicleTrips: d.vehicleTrips });
      if (d.vehicleDocumentTypes) useAppStore.setState({ vehicleDocumentTypes: d.vehicleDocumentTypes });
      if (d.budgetItems)          useAppStore.setState({ budgetItems: d.budgetItems });

      // Restore Operations & Tasks context states
      operationsState.importOperationsBackupData(d);
      taskState.importTaskBackupData(d);

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

  const handleCheckForUpdates = async () => {
    if (isElectron && ((window as any).electronAPI as any)?.checkForUpdates) {
      setIsChecking(true);
      ((window as any).electronAPI as any).checkForUpdates();
      setTimeout(() => setIsChecking(false), 3000);
    } else if (isAndroidNative) {
      setIsChecking(true);
      try {
        const CURRENT_VERSION = APP_VERSION;
        const UPDATE_SERVER_URL = import.meta.env.VITE_UPDATE_SERVER_URL || 'https://dewaterconstruct.com/app-updates';
        const response = await CapacitorHttp.get({
          url: `${UPDATE_SERVER_URL}/version.json?t=${Date.now()}`,
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (response.status !== 200) throw new Error('Failed to fetch update info');
        const data = response.data;
        const normalizeVersion = (v: string) => v.replace(/^v/i, '').trim();
        const cParts = normalizeVersion(CURRENT_VERSION).split('.').map(Number);
        const rParts = normalizeVersion(data.version).split('.').map(Number);
        
        let isNewer = false;
        for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
          const c = cParts[i] || 0;
          const r = rParts[i] || 0;
          if (r > c) { isNewer = true; break; }
          if (r < c) { isNewer = false; break; }
        }

        if (data.version && isNewer) {
          toast.success(`Update v${data.version} is available! Please check the app sidebar to download and install the update.`);
        } else {
          toast.success('Your application is up to date.');
        }
      } catch (err) {
        console.error('Update check failed:', err);
        toast.error('Failed to check for updates.');
      } finally {
        setIsChecking(false);
      }
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

  const getTabTitle = () => {
    switch(activeTab) {
      case 'general': return 'General Settings';
      case 'backup': return 'Backup & Restore';
      case 'integrations': return 'Integrations';
      case 'updates': return 'System Updates';
      case 'ai': return 'AI & Resource Settings';
      case 'variables': return null;
      default: return 'Settings';
    }
  };

  useSetPageTitle(getTabTitle(), 'Manage company preferences, backup, integrations, and variables');

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
          <TabsTrigger active={activeTab === 'ai'}           onClick={() => setActiveTab('ai')}           className="w-36">
            <Bot            className="mr-2 h-4 w-4" /> AI Settings
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

            {/* Supabase SQL Database Backup */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                    <DatabaseBackup className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Supabase SQL Database Backup</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Export full PostgreSQL roles, schema DDL, and data copies via Supabase CLI or SQL table dumper.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className="flex flex-col gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800">Export Supabase Database (SQL / ZIP)</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Opens a native location picker to save a <strong>.zip</strong> archive containing <code>roles.sql</code>, <code>schema.sql</code>, and <code>data.sql</code> (or a single combined <code>.sql</code> file). Pick any destination folder on your system.
                  </p>

                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-xs font-semibold text-slate-700">Supabase DB Connection String (Optional for full CLI dumps):</label>
                    <Input
                      type="password"
                      placeholder="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
                      value={supabaseDbConnString}
                      onChange={(e) => {
                        setSupabaseDbConnString(e.target.value);
                        localStorage.setItem('dcel-supabase-db-url', e.target.value);
                      }}
                      className="bg-white text-xs text-slate-800 h-9"
                    />
                    <span className="text-[11px] text-slate-500">
                      Copy from Supabase Dashboard → Settings → Database → Connection pooling (Session pooler). If left blank, an instant table-data export is performed.
                    </span>
                  </div>

                  <Button
                    onClick={handleSupabaseBackup}
                    disabled={isBackingUpSupabase || !priv.canBackup}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 rounded-xl shadow-sm mt-2"
                  >
                    {isBackingUpSupabase
                      ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating Supabase Backup…</>
                      : <><Download className="h-4 w-4" /> Backup Supabase DB (Pick Location)</>
                    }
                  </Button>
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

        {/* ─────────── AI SETTINGS TAB ──────────────────────────────── */}
        <TabsContent active={activeTab === 'ai'}>
          <div className="flex flex-col gap-6">

            {/* Resource Allocation Mode */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Resource Allocation Mode</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Choose how the Machine Recon analysis is performed.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Analytic Mode */}
                  <button
                    onClick={() => handleSaveMode('analytic')}
                    className={`relative flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all ${
                      allocationMode === 'analytic'
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-md'
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    {allocationMode === 'analytic' && (
                      <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Analytic</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Uses rolling 5-day average velocity to mathematically estimate completion dates and machine availability. Fast, offline-capable.</p>
                    </div>
                  </button>

                  {/* Hybrid Mode */}
                  <button
                    onClick={() => handleSaveMode('hybrid')}
                    className={`relative flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all ${
                      allocationMode === 'hybrid'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                        : 'border-slate-200 hover:border-emerald-200 hover:bg-slate-50'
                    }`}
                  >
                    {allocationMode === 'hybrid' && (
                      <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Hybrid <Badge variant="success" className="ml-1 text-[10px]">AI</Badge></p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Combines the analytic calculation with an AI model for narrative insights, risk flagging, and smart machine re-allocation suggestions.</p>
                    </div>
                    {allocationMode !== 'hybrid' && apiKeys.filter(k => k.isDefault).length === 0 && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1">⚠️ Add a default API key below to use Hybrid mode.</p>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* API Key Management */}
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">API Keys</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">Manage AI provider keys. Keys are stored securely in your workspace.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-6 space-y-6">

                {/* Add New Key Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">Add New API Key</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Label (Optional)</label>
                      <Input
                        value={newKeyLabel}
                        onChange={e => setNewKeyLabel(e.target.value)}
                        placeholder="e.g. Personal Groq"
                        className="h-10 bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Provider</label>
                      <select
                        value={newKeyProvider}
                        onChange={e => setNewKeyProvider(e.target.value)}
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none capitalize"
                      >
                        <option value="">Auto-detected</option>
                        {AI_PROVIDERS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Default Model (Optional)
                        {isFetchingModels && <span className="text-[10px] text-slate-400 animate-pulse ml-2 font-normal">(loading live models…)</span>}
                      </label>
                      {modelsList.length > 0 ? (
                        <select
                          value={newKeyDefaultModel}
                          onChange={e => setNewKeyDefaultModel(e.target.value)}
                          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none capitalize shadow-sm"
                        >
                          <option value="">Default Model...</option>
                          {modelsList.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={newKeyDefaultModel}
                          onChange={e => setNewKeyDefaultModel(e.target.value)}
                          placeholder="e.g. gemini-2.0-flash"
                          className="h-10 bg-white border-slate-200"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">API Key</label>
                    <div className="relative">
                      <Input
                        type={showNewKey ? 'text' : 'password'}
                        value={newKeyValue}
                        onChange={e => setNewKeyValue(e.target.value)}
                        placeholder="Paste your API key here..."
                        className="h-10 bg-white border-slate-200 pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewKey(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newKeyValue && (
                      <p className="text-[10px] text-slate-400">
                        Detected provider: <strong className="text-indigo-600 capitalize">{newKeyProvider || detectProvider(newKeyValue)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      onClick={handleTestKey}
                      disabled={isTestingKey || !newKeyValue}
                      className="flex-1 h-10 border-slate-300 text-slate-700"
                    >
                      {isTestingKey ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Testing…</> : 'Test Key'}
                    </Button>
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={isSavingKey || !newKeyValue}
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {isSavingKey ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Key</>}
                    </Button>
                  </div>
                </div>

                {/* Saved Keys List */}
                {apiKeys.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700">Saved Keys ({apiKeys.length})</h3>
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-slate-800 text-sm">{k.label || k.provider}</p>
                            {k.isDefault && <Badge variant="success" className="text-[10px]">⭐ Default</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">
                              {visibleKeyIds.has(k.id) ? k.keyValue : maskKey(k.keyValue)}
                            </span>
                            <button onClick={() => toggleKeyVisibility(k.id)} className="text-slate-400 hover:text-slate-600">
                              {visibleKeyIds.has(k.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                            <Badge className="text-[9px] capitalize bg-slate-100 text-slate-650 border border-slate-200">{k.provider}</Badge>
                            {k.defaultModel && (
                              <Badge variant="outline" className="text-[9px] bg-slate-50 text-indigo-650 border border-indigo-200">
                                Model: {k.defaultModel}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!k.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => handleSetDefault(k.id)} className="text-xs h-8 px-2 text-slate-500 hover:text-indigo-650">
                              Set Default
                            </Button>
                          )}
                          <button
                            onClick={() => { setEditKeyId(k.id); setNewKeyLabel(k.label); setNewKeyValue(k.keyValue); setNewKeyProvider(k.provider); setNewKeyDefaultModel(k.defaultModel || ''); setActiveTab('ai'); }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteKey(k.id)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {apiKeys.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No API keys saved yet.</p>
                    <p className="text-xs mt-1">Add a key above to enable AI-powered analysis.</p>
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
                    disabled={(!isElectron && !isAndroidNative) || isChecking}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                  >
                    {isChecking
                      ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      : <CloudDownload className="mr-2 h-4 w-4" />
                    }
                    {isChecking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                  {!isElectron && !isAndroidNative && (
                    <p className="text-xs text-slate-400 text-center">Only available in Desktop & Android App</p>
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

