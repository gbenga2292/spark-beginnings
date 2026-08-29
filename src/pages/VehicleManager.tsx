import { useState, useMemo } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { useAppStore } from '../store/appStore';
import { 
  Plus, Search, Truck, MapPin, Clock, Calendar, 
  Edit2, Trash2, History, AlertCircle, ChevronRight,
  MoreHorizontal, MoreVertical, PlusCircle, X, Check, ClipboardList,
  LayoutGrid, List, ChevronLeft, Download, Upload, FileSpreadsheet,
  Fuel, TrendingUp, BarChart3, Filter, Link as LinkIcon,
  Receipt, Sparkles, CheckCircle2, Zap, RotateCcw, FileText,
  ShieldAlert, ShieldCheck, CalendarPlus, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { Vehicle, VehicleTripLeg, VehicleDocumentType, VehicleFuelLog, VehicleDocumentRenewalRecord } from '../types/operations';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';

function parseLitresFromText(text?: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ltrs?|litres?|liters?|l)\b/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return undefined;
}
import { 
  isSameMonth, isBefore, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, addDays, isSameDay, 
  format, startOfDay, addMonths, subMonths 
} from 'date-fns';
import { usePriv } from '../hooks/usePriv';
import { fetchOperationsData } from '@/src/lib/supabaseService';
import { useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Label } from '@/src/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { useSetPageTitle, useHideLayout } from '@/src/contexts/PageContext';

const VEHICLE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1'  // indigo
];

const CustomTooltip = ({ active, payload, label, valType }: any) => {
  if (active && payload && payload.length) {
    const filteredPayload = payload.filter((entry: any) => entry.name !== 'Total Litres' && entry.name !== 'Total Cost');
    const sortedPayload = [...filteredPayload].sort((a, b) => b.value - a.value);
    const total = filteredPayload.length > 0 
      ? filteredPayload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0)
      : payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
    const divisor = filteredPayload.length > 0 ? filteredPayload.length : payload.length;
    
    return (
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xl space-y-2 max-h-80 overflow-y-auto min-w-[220px]">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{label}</p>
        <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5 flex justify-between items-center font-extrabold text-xs">
          <span className="text-slate-800 dark:text-slate-200">Total</span>
          <span className="text-slate-900 dark:text-slate-100 font-extrabold">
            {valType === 'litres' ? `${total.toFixed(1)} L` : valType === 'cost' ? `₦${total.toLocaleString()}` : `₦${(total/divisor).toFixed(2)}/L`}
          </span>
        </div>
        <div className="space-y-1">
          {sortedPayload.map((entry: any, index: number) => {
            const cleanName = entry.name.replace(/_cost|_rate/, '');
            return (
              <div key={index} className="flex justify-between items-center gap-4 text-[11px] leading-normal">
                <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600 dark:text-slate-300 font-bold truncate">{cleanName}</span>
                </div>
                <span className="font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                  {valType === 'litres' ? `${Number(entry.value).toFixed(1)} L` : valType === 'cost' ? `₦${Number(entry.value).toLocaleString()}` : `₦${Number(entry.value).toFixed(2)}/L`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export function VehicleManager() {
  const { 
    vehicles, vehicleTrips, addVehicle, updateVehicle, deleteVehicle, addVehicleTripRecords,
    updateVehicleTripRecord, deleteVehicleTripRecord,
    vehicleDocumentTypes, updateVehicleDocument,
    insertVehicles, setVehicles, setVehicleTripRecords,
    vehicleFuelLogs, addVehicleFuelLog, updateVehicleFuelLog, deleteVehicleFuelLog,
    dieselRefills
  } = useOperations();
  const { sites, pendingSites, employees } = useAppStore();
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const priv = usePriv('opsVehicles');
  
  const [activeTab, setActiveTab] = useState<'fleet' | 'logs' | 'documents' | 'fuel'>('logs');
  const [activeChartTab, setActiveChartTab] = useState<'litres' | 'cost' | 'trend'>('litres');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importType, setImportType] = useState<'vehicles' | 'logs'>('vehicles');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchOperationsData()
      .then((data) => {
        useAppStore.setState(data);
      })
      .catch(console.error);
  }, []);

  // Ensure user is on a permitted tab
  useEffect(() => {
    const hasLogsAccess = priv.canViewLogs || priv.canViewFuel;
    if (activeTab === 'logs' && !hasLogsAccess) {
      if (priv.canViewFleet) setActiveTab('fleet');
      else if (priv.canViewDocuments) setActiveTab('documents');
      else if (priv.canViewFuelAnalytics) setActiveTab('fuel');
    } else if (activeTab === 'fleet' && !priv.canViewFleet) {
      if (hasLogsAccess) setActiveTab('logs');
      else if (priv.canViewDocuments) setActiveTab('documents');
      else if (priv.canViewFuelAnalytics) setActiveTab('fuel');
    } else if (activeTab === 'documents' && !priv.canViewDocuments) {
      if (hasLogsAccess) setActiveTab('logs');
      else if (priv.canViewFleet) setActiveTab('fleet');
      else if (priv.canViewFuelAnalytics) setActiveTab('fuel');
    } else if (activeTab === 'fuel' && !priv.canViewFuelAnalytics) {
      if (hasLogsAccess) setActiveTab('logs');
      else if (priv.canViewFleet) setActiveTab('fleet');
      else if (priv.canViewDocuments) setActiveTab('documents');
    }
  }, [priv, activeTab]);


  // Document Expiry Notifications
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;
    
    const today = new Date();
    const expired: string[] = [];
    const expiringThisMonth: string[] = [];

    vehicles.forEach(v => {
      vehicleDocumentTypes.forEach(type => {
        const date = v.documents?.[type.name];
        if (date) {
          const normalized = normalizeDate(date);
          if (normalized) {
            const dateValue = new Date(normalized);
            if (isBefore(dateValue, startOfDay(today))) {
              expired.push(`${v.registration_number} - ${type.name}`);
            } else if (isSameMonth(dateValue, today)) {
              expiringThisMonth.push(`${v.registration_number} - ${type.name}`);
            }
          }
        }
      });
    });

    if (expired.length > 0) {
      toast.error(`${expired.length} document(s) have EXPIRED`, {
        description: expired.slice(0, 3).join('\n') + (expired.length > 3 ? `\n...and ${expired.length - 3} more` : ''),
        duration: 10000,
      });
    }

    if (expiringThisMonth.length > 0) {
      toast.info(`${expiringThisMonth.length} document(s) expire this month`, {
        description: expiringThisMonth.slice(0, 3).join('\n') + (expiringThisMonth.length > 3 ? `\n...and ${expiringThisMonth.length - 3} more` : ''),
        duration: 8000,
      });
    }
  }, [vehicles]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<VehicleTripLeg | null>(null);
  const [editingDocVehicle, setEditingDocVehicle] = useState<Vehicle | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docModalTab, setDocModalTab] = useState<'update' | 'history'>('update');
  const [docFormValues, setDocFormValues] = useState<Record<string, string>>({});
  const [docFormNotes, setDocFormNotes] = useState<Record<string, string>>({});
  const [docModalSearch, setDocModalSearch] = useState('');

  const getDocStatusInfo = (dateStr?: string) => {
    if (!dateStr) return { status: 'not_set', label: 'Not Set', badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    const normalized = normalizeDate(dateStr);
    if (!normalized) return { status: 'not_set', label: 'Not Set', badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
    
    const dateValue = new Date(normalized);
    const today = new Date();
    const isExpired = isBefore(dateValue, startOfDay(today));
    const isExpiringThisMonth = isSameMonth(dateValue, today);
    
    if (isExpired) {
      return {
        status: 'expired',
        label: 'Expired',
        badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
      };
    }
    if (isExpiringThisMonth) {
      return {
        status: 'expiring_soon',
        label: 'Expires this month',
        badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
      };
    }
    return {
      status: 'valid',
      label: 'Valid',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
    };
  };

  const calculateRenewalDate = (currentValue: string, months: number): string => {
    let base: Date;
    const normalized = normalizeDate(currentValue);
    if (normalized) {
      const existing = new Date(normalized);
      if (!isNaN(existing.getTime()) && !isBefore(existing, startOfDay(new Date()))) {
        base = existing;
      } else {
        base = new Date();
      }
    } else {
      base = new Date();
    }
    return format(addMonths(base, months), 'yyyy-MM-dd');
  };

  const openDocModal = (v: Vehicle, tab: 'update' | 'history' = 'update') => {
    setEditingDocVehicle(v);
    setDocModalTab(tab);
    setDocModalSearch('');
    
    const initialValues: Record<string, string> = {};
    vehicleDocumentTypes.forEach(t => {
      initialValues[t.name] = normalizeDate(v.documents?.[t.name] || '');
    });
    setDocFormValues(initialValues);
    setDocFormNotes({});
    setShowDocModal(true);
  };

  const handleQuickRenew = (typeName: string, months: number) => {
    const currentVal = docFormValues[typeName] || '';
    const newDate = calculateRenewalDate(currentVal, months);
    setDocFormValues(prev => ({ ...prev, [typeName]: newDate }));
  };

  const handleClearDocDate = (typeName: string) => {
    setDocFormValues(prev => ({ ...prev, [typeName]: '' }));
  };

  const handleResetDocDate = (typeName: string) => {
    if (!editingDocVehicle) return;
    setDocFormValues(prev => ({ ...prev, [typeName]: normalizeDate(editingDocVehicle.documents?.[typeName] || '') }));
  };

  const handleRenewAllExpired = () => {
    if (!editingDocVehicle) return;
    let renewedCount = 0;
    const newValues = { ...docFormValues };

    vehicleDocumentTypes.forEach(type => {
      const val = docFormValues[type.name] || normalizeDate(editingDocVehicle.documents?.[type.name] || '');
      const statusInfo = getDocStatusInfo(val);
      if (statusInfo.status === 'expired' || statusInfo.status === 'expiring_soon' || statusInfo.status === 'not_set') {
        newValues[type.name] = calculateRenewalDate(val, 12);
        renewedCount++;
      }
    });

    setDocFormValues(newValues);
    if (renewedCount > 0) {
      toast.success(`Set 1-year renewal for ${renewedCount} document(s). Click "Save Changes" to confirm.`);
    } else {
      toast.info('All documents are already valid for more than 1 month.');
    }
  };

  const handleResetAllDocChanges = () => {
    if (!editingDocVehicle) return;
    const initialValues: Record<string, string> = {};
    vehicleDocumentTypes.forEach(t => {
      initialValues[t.name] = normalizeDate(editingDocVehicle.documents?.[t.name] || '');
    });
    setDocFormValues(initialValues);
    setDocFormNotes({});
  };

  const handleSaveAllDocs = () => {
    if (!editingDocVehicle) return;

    const previousHistory: VehicleDocumentRenewalRecord[] = (editingDocVehicle.documents?._history || []) as VehicleDocumentRenewalRecord[];
    const newHistoryEntries = [...previousHistory];
    let changesCount = 0;

    vehicleDocumentTypes.forEach(type => {
      const origVal = normalizeDate(editingDocVehicle.documents?.[type.name] || '');
      const newVal = docFormValues[type.name] || '';
      if (origVal !== newVal) {
        changesCount++;
        newHistoryEntries.unshift({
          id: crypto.randomUUID(),
          doc_type: type.name,
          previous_date: origVal || undefined,
          new_date: newVal,
          updated_at: new Date().toISOString(),
          note: docFormNotes[type.name]?.trim() || undefined
        });
      }
    });

    const updatedDocs: Record<string, any> = {
      ...(editingDocVehicle.documents || {}),
      ...docFormValues,
      _history: newHistoryEntries
    };

    updateVehicle(editingDocVehicle.id, { documents: updatedDocs });
    if (changesCount > 0) {
      toast.success(`Updated ${changesCount} document expiry date${changesCount > 1 ? 's' : ''} for ${editingDocVehicle.name}`);
    } else {
      toast.info('No changes made to document dates.');
    }
    setShowDocModal(false);
  };

  const docChangesCount = useMemo(() => {
    if (!editingDocVehicle) return 0;
    let count = 0;
    vehicleDocumentTypes.forEach(type => {
      const origVal = normalizeDate(editingDocVehicle.documents?.[type.name] || '');
      const newVal = docFormValues[type.name] || '';
      if (origVal !== newVal) {
        count++;
      }
    });
    return count;
  }, [editingDocVehicle, docFormValues, vehicleDocumentTypes]);

  const docStats = useMemo(() => {
    if (!editingDocVehicle) return { total: 0, expired: 0, expiringSoon: 0, valid: 0, notSet: 0 };
    let expired = 0;
    let expiringSoon = 0;
    let valid = 0;
    let notSet = 0;

    vehicleDocumentTypes.forEach(type => {
      const val = editingDocVehicle.documents?.[type.name];
      const s = getDocStatusInfo(val);
      if (s.status === 'expired') expired++;
      else if (s.status === 'expiring_soon') expiringSoon++;
      else if (s.status === 'valid') valid++;
      else notSet++;
    });

    return {
      total: vehicleDocumentTypes.length,
      expired,
      expiringSoon,
      valid,
      notSet
    };
  }, [editingDocVehicle, vehicleDocumentTypes]);

  const vehicleDocHistory = useMemo(() => {
    if (!editingDocVehicle?.documents?._history) return [];
    const list = editingDocVehicle.documents._history as VehicleDocumentRenewalRecord[];
    if (!docModalSearch) return list;
    const q = docModalSearch.toLowerCase();
    return list.filter(h => h.doc_type.toLowerCase().includes(q) || (h.note && h.note.toLowerCase().includes(q)));
  }, [editingDocVehicle, docModalSearch]);

  const filteredDocTypesForModal = useMemo(() => {
    if (!docModalSearch) return vehicleDocumentTypes;
    const q = docModalSearch.toLowerCase();
    return vehicleDocumentTypes.filter(t => t.name.toLowerCase().includes(q));
  }, [vehicleDocumentTypes, docModalSearch]);

  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // ── Unified Logs State ──
  const [logsSubTab, setLogsSubTab] = useState<'all' | 'movement' | 'fuel'>('all');
  const [logsSearch, setLogsSearch] = useState('');

  // Synchronize sub-tab selection with permissions
  useEffect(() => {
    if (logsSubTab === 'all' && (!priv.canViewLogs || !priv.canViewFuel)) {
      if (priv.canViewLogs) setLogsSubTab('movement');
      else if (priv.canViewFuel) setLogsSubTab('fuel');
    } else if (logsSubTab === 'movement' && !priv.canViewLogs) {
      if (priv.canViewFuel) setLogsSubTab('fuel');
    } else if (logsSubTab === 'fuel' && !priv.canViewFuel) {
      if (priv.canViewLogs) setLogsSubTab('movement');
    }
  }, [priv.canViewLogs, priv.canViewFuel, logsSubTab]);

  // ── Fuel Log State ──
  const fmtCurrency = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getVehicleName = (reg?: string) => {
    if (!reg) return '';
    const v = vehicles.find(x => x.registration_number === reg || x.id === reg);
    return v ? v.name : reg;
  };

  const [showFuelForm, setShowFuelForm] = useState(false);
  const [editingFuelLog, setEditingFuelLog] = useState<VehicleFuelLog | null>(null);
  const [fuelForm, setFuelForm] = useState({
    vehicle_id: '',
    vehicle_reg: '',
    date: new Date().toISOString().split('T')[0],
    rate_per_litre: '' as string | number,
    litres: '' as string | number,
    total_cost: '' as string | number,
    odometer: '' as string | number,
    filled_by: '',
    notes: '',
    linkedLedgerIds: [] as string[],
    lastComputed: '' as 'litres' | 'total_cost' | 'rate_per_litre' | ''
  });
  const [fuelValidationErrors, setFuelValidationErrors] = useState<Record<string, boolean>>({});

  // Standalone Link Ledger Dialog State
  const [selectedFuelLogForLedger, setSelectedFuelLogForLedger] = useState<VehicleFuelLog | null>(null);
  const [standaloneLedgerSearch, setStandaloneLedgerSearch] = useState('');
  const [standaloneLedgerMonth, setStandaloneLedgerMonth] = useState('');
  const [standaloneAllocations, setStandaloneAllocations] = useState<Record<string, number>>({});
  const [ledgerDateFilterType, setLedgerDateFilterType] = useState<'transaction' | 'voucher'>('transaction');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const getVoucherDate = (voucherNo?: string): string | null => {
    if (!voucherNo) return null;
    const match = voucherNo.match(/VN(\d{2})-(\d{2})-(\d{2})/i);
    if (match) {
      const [, yy, mm, dd] = match;
      return `20${yy}-${mm}-${dd}`;
    }
    return null;
  };

  const handleOpenStandaloneLedgerDialog = (log: VehicleFuelLog) => {
    setSelectedFuelLogForLedger(log);
    setStandaloneLedgerSearch('');
    // Auto-select log's month for instant fast filtering
    setStandaloneLedgerMonth(log.date ? log.date.substring(0, 7) : '');
    setLedgerStartDate('');
    setLedgerEndDate('');
    const initialAllocations: Record<string, number> = {};
    if (log.linkedLedgerIds && log.linkedLedgerIds.length > 0) {
      log.linkedLedgerIds.forEach(lid => {
        if (log.linkedLedgerAmounts && log.linkedLedgerAmounts[lid] !== undefined) {
          initialAllocations[lid] = log.linkedLedgerAmounts[lid];
        } else {
          const entry = ledgerEntries.find(e => e.id === lid);
          initialAllocations[lid] = entry ? Number(entry.amount) || 0 : log.total_cost;
        }
      });
    }
    setStandaloneAllocations(initialAllocations);
  };

  const handleSaveStandaloneLedger = async () => {
    if (!selectedFuelLogForLedger) return;
    const linkedIds = Object.keys(standaloneAllocations).filter(id => standaloneAllocations[id] > 0);
    const cleanedAmounts: Record<string, number> = {};
    linkedIds.forEach(id => {
      cleanedAmounts[id] = standaloneAllocations[id];
    });

    await updateVehicleFuelLog(selectedFuelLogForLedger.id, {
      linkedLedgerIds: linkedIds,
      linkedLedgerAmounts: cleanedAmounts
    });

    setSelectedFuelLogForLedger(null);
  };

  const ledgerRemainingAmounts = useMemo(() => {
    const remaining = new Map<string, number>();
    
    // Initialize with full amounts
    ledgerEntries.forEach(e => {
      remaining.set(e.id, Number(e.amount) || 0);
    });

    // Subtract used amounts from other diesel refills
    dieselRefills.forEach(refill => {
      if (!refill.linkedLedgerIds || refill.linkedLedgerIds.length === 0) return;
      if (!refill.totalCost) return;

      let costToCover = refill.totalCost;
      for (const lid of refill.linkedLedgerIds) {
        if (costToCover <= 0) break;
        const currentRemaining = remaining.get(lid) || 0;
        if (currentRemaining > 0) {
          const amountToUse = Math.min(costToCover, currentRemaining);
          remaining.set(lid, currentRemaining - amountToUse);
          costToCover -= amountToUse;
        }
      }
    });

    // Subtract used amounts from other vehicle fuel logs
    vehicleFuelLogs.forEach(log => {
      // Ignore log currently open in standalone dialog or being edited
      if (selectedFuelLogForLedger?.id && log.id === selectedFuelLogForLedger.id) return;
      if (editingFuelLog?.id && log.id === editingFuelLog.id) return;
      
      if (!log.linkedLedgerIds || log.linkedLedgerIds.length === 0) return;

      for (const lid of log.linkedLedgerIds) {
        const currentRemaining = remaining.get(lid) || 0;
        if (currentRemaining > 0) {
          const customAllocated = log.linkedLedgerAmounts?.[lid];
          const amountToUse = customAllocated !== undefined ? Math.min(customAllocated, currentRemaining) : Math.min(log.total_cost || 0, currentRemaining);
          remaining.set(lid, Math.max(0, currentRemaining - amountToUse));
        }
      }
    });

    return remaining;
  }, [ledgerEntries, dieselRefills, vehicleFuelLogs, editingFuelLog, selectedFuelLogForLedger]);

  // Find eligible ledger entries for vehicles: contains "diesel", "petrol", "pms", or "fuel"
  const eligibleLedgerEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      const desc = e.description?.toLowerCase() || '';
      return desc.includes('diesel') || desc.includes('petrol') || desc.includes('pms') || desc.includes('fuel');
    });
  }, [ledgerEntries]);

  // Filtered by search, month and date options inside the standalone dialog
  const filteredStandaloneLedgerEntries = useMemo(() => {
    const vReg = selectedFuelLogForLedger?.vehicle_reg?.toLowerCase() || '';
    const vName = selectedFuelLogForLedger ? getVehicleName(selectedFuelLogForLedger.vehicle_reg).toLowerCase() : '';
    const targetLogDate = selectedFuelLogForLedger?.date || '';

    // De-duplicate unique entries by id
    const seenIds = new Set<string>();
    const uniqueEligible = eligibleLedgerEntries.filter(e => {
      if (!e.id || seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });

    const filtered = uniqueEligible.filter(e => {
      const rem = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
      const isLinked = selectedFuelLogForLedger?.linkedLedgerIds?.includes(e.id) || (standaloneAllocations[e.id] !== undefined && standaloneAllocations[e.id] > 0);
      if (rem <= 0.01 && !isLinked) return false;

      // 1. Month Filter (allows showing linked vouchers even if from other months)
      if (standaloneLedgerMonth) {
        const entryMonth = e.date ? e.date.substring(0, 7) : '';
        if (entryMonth !== standaloneLedgerMonth && !isLinked) return false;
      }

      // 2. Text Search Filter
      if (standaloneLedgerSearch.trim()) {
        const query = standaloneLedgerSearch.toLowerCase().trim();
        const desc = e.description?.toLowerCase() || '';
        const siteName = e.site?.toLowerCase() || '';
        const clientName = e.client?.toLowerCase() || '';
        const voucher = e.voucherNo?.toLowerCase() || '';
        const amountStr = e.amount?.toString() || '';
        const txDate = e.date || '';
        const vDate = getVoucherDate(e.voucherNo) || '';

        const matchesSearch = desc.includes(query) ||
          siteName.includes(query) ||
          clientName.includes(query) ||
          voucher.includes(query) ||
          amountStr.includes(query) ||
          txDate.includes(query) ||
          vDate.includes(query);

        if (!matchesSearch) return false;
      }

      // 3. Date Filter (Transaction Date vs Voucher Date)
      const targetDate = ledgerDateFilterType === 'voucher'
        ? (getVoucherDate(e.voucherNo) || e.date)
        : e.date;

      if (ledgerStartDate && targetDate < ledgerStartDate) return false;
      if (ledgerEndDate && targetDate > ledgerEndDate) return false;

      return true;
    });

    // Intelligent Sorting:
    // 1. Linked items first
    // 2. Entries matching vehicle registration / name
    // 3. Entries matching fuel log date exactly
    // 4. Descending by date
    return filtered.sort((a, b) => {
      const aLinked = selectedFuelLogForLedger?.linkedLedgerIds?.includes(a.id) || (standaloneAllocations[a.id] !== undefined && standaloneAllocations[a.id] > 0);
      const bLinked = selectedFuelLogForLedger?.linkedLedgerIds?.includes(b.id) || (standaloneAllocations[b.id] !== undefined && standaloneAllocations[b.id] > 0);
      if (aLinked && !bLinked) return -1;
      if (!aLinked && bLinked) return 1;

      const aDesc = (a.description || '').toLowerCase();
      const bDesc = (b.description || '').toLowerCase();
      const aMatchesVehicle = (vReg && aDesc.includes(vReg)) || (vName && aDesc.includes(vName));
      const bMatchesVehicle = (vReg && bDesc.includes(vReg)) || (vName && bDesc.includes(vName));
      if (aMatchesVehicle && !bMatchesVehicle) return -1;
      if (!aMatchesVehicle && bMatchesVehicle) return 1;

      const aSameDate = targetLogDate && a.date === targetLogDate;
      const bSameDate = targetLogDate && b.date === targetLogDate;
      if (aSameDate && !bSameDate) return -1;
      if (!aSameDate && bSameDate) return 1;

      return (b.date || '').localeCompare(a.date || '');
    });
  }, [eligibleLedgerEntries, standaloneLedgerSearch, standaloneLedgerMonth, ledgerDateFilterType, ledgerStartDate, ledgerEndDate, ledgerRemainingAmounts, selectedFuelLogForLedger, standaloneAllocations]);

  const totalAllocatedInStandaloneDialog = useMemo(() => {
    return Object.values(standaloneAllocations).reduce((sum, amt) => sum + (Number(amt) || 0), 0);
  }, [standaloneAllocations]);

  // Fuel Analytics Filter State
  const [showFuelAnalytics, setShowFuelAnalytics] = useState(false);
  const [fuelFilterVehicle, setFuelFilterVehicle] = useState<string>('');
  const [fuelFilterYear, setFuelFilterYear] = useState(new Date().getFullYear());
  const [fuelFilterMonth, setFuelFilterMonth] = useState<number | null>(null);
  const [fuelFilterWeek, setFuelFilterWeek] = useState<number | null>(null);

  // Fuel Log Modal - Ledger Linking State & Handlers
  const [showFuelFormLedgerDialog, setShowFuelFormLedgerDialog] = useState(false);
  const [fuelFormLedgerSearch, setFuelFormLedgerSearch] = useState('');
  const [fuelFormLedgerMonth, setFuelFormLedgerMonth] = useState('');
  const [fuelFormLedgerDateType, setFuelFormLedgerDateType] = useState<'transaction' | 'voucher'>('transaction');
  const [fuelFormLedgerStartDate, setFuelFormLedgerStartDate] = useState('');
  const [fuelFormLedgerEndDate, setFuelFormLedgerEndDate] = useState('');

  const availableLedgerMonths = useMemo(() => {
    const months = new Set<string>();
    eligibleLedgerEntries.forEach(e => {
      const rem = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
      const isLinked = (fuelForm.linkedLedgerIds || []).includes(e.id);
      if ((rem > 0.01 || isLinked) && e.date) {
        months.add(e.date.substring(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [eligibleLedgerEntries, ledgerRemainingAmounts, fuelForm.linkedLedgerIds]);

  const filteredFuelFormLedgerEntries = useMemo(() => {
    return eligibleLedgerEntries.filter(e => {
      const rem = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
      const isLinked = (fuelForm.linkedLedgerIds || []).includes(e.id);
      if (rem <= 0.01 && !isLinked) return false;

      if (fuelFormLedgerSearch.trim()) {
        const query = fuelFormLedgerSearch.toLowerCase().trim();
        const desc = e.description?.toLowerCase() || '';
        const siteName = e.site?.toLowerCase() || '';
        const clientName = e.client?.toLowerCase() || '';
        const voucher = e.voucherNo?.toLowerCase() || '';
        const amountStr = e.amount?.toString() || '';
        const txDate = e.date || '';
        const vDate = getVoucherDate(e.voucherNo) || '';
        const matches = desc.includes(query) || siteName.includes(query) || clientName.includes(query) || voucher.includes(query) || amountStr.includes(query) || txDate.includes(query) || vDate.includes(query);
        if (!matches) return false;
      }
      if (fuelFormLedgerMonth) {
        const entryMonth = e.date ? e.date.substring(0, 7) : '';
        if (entryMonth !== fuelFormLedgerMonth) return false;
      }
      const targetDate = fuelFormLedgerDateType === 'voucher' ? (getVoucherDate(e.voucherNo) || e.date) : e.date;
      if (fuelFormLedgerStartDate && targetDate < fuelFormLedgerStartDate) return false;
      if (fuelFormLedgerEndDate && targetDate > fuelFormLedgerEndDate) return false;
      return true;
    });
  }, [eligibleLedgerEntries, fuelFormLedgerSearch, fuelFormLedgerMonth, fuelFormLedgerDateType, fuelFormLedgerStartDate, fuelFormLedgerEndDate, ledgerRemainingAmounts, fuelForm.linkedLedgerIds]);

  const linkedFuelEntries = useMemo(() => {
    return (ledgerEntries || []).filter(e => (fuelForm.linkedLedgerIds || []).includes(e.id));
  }, [ledgerEntries, fuelForm.linkedLedgerIds]);

  const totalLinkedFuelAmount = useMemo(() => {
    return (fuelForm.linkedLedgerIds || []).reduce((sum, id) => {
      return sum + (ledgerRemainingAmounts.get(id) || 0);
    }, 0);
  }, [fuelForm.linkedLedgerIds, ledgerRemainingAmounts]);

  const autoSyncFuelFromLinkedEntries = (customIds?: string[]) => {
    const ids = customIds || fuelForm.linkedLedgerIds || [];
    const activeEntries = (ledgerEntries || []).filter(e => ids.includes(e.id));
    if (activeEntries.length === 0) return;

    let sumLitres = 0;
    let sumCost = 0;
    const notesArr: string[] = [];
    let detectedPayer = '';
    let earliestDate = '';
    let matchedVehicle: Vehicle | undefined;

    activeEntries.forEach(entry => {
      const parsedL = parseLitresFromText(entry.description) || 0;
      const remCost = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount) ?? 0;
      sumLitres += parsedL;
      sumCost += remCost;

      if (entry.enteredBy && !detectedPayer) detectedPayer = entry.enteredBy;
      
      const vDate = getVoucherDate(entry.voucherNo);
      const entryDate = vDate || entry.date;
      if (entryDate && (!earliestDate || entryDate < earliestDate)) earliestDate = entryDate;

      if (!matchedVehicle && entry.description) {
        const descLower = entry.description.toLowerCase();
        matchedVehicle = vehicles.find(v => 
          (v.registration_number && descLower.includes(v.registration_number.toLowerCase())) ||
          (v.name && v.name.length > 2 && descLower.includes(v.name.toLowerCase()))
        );
      }

      const descTag = entry.voucherNo ? `[${entry.voucherNo}] ${entry.description}` : entry.description;
      if (descTag) notesArr.push(descTag);
    });

    setFuelForm(prev => {
      const next = { ...prev, linkedLedgerIds: ids };
      if (sumCost > 0) next.total_cost = sumCost.toString();
      if (sumLitres > 0) {
        next.litres = sumLitres.toString();
        if (sumCost > 0) {
          next.rate_per_litre = (sumCost / sumLitres).toFixed(2);
        }
      }
      if (earliestDate) next.date = earliestDate;
      if (matchedVehicle) {
        next.vehicle_id = matchedVehicle.id;
        next.vehicle_reg = matchedVehicle.registration_number;
      }
      if (detectedPayer && !prev.filled_by) {
        const matchedEmp = employees.find(emp => 
          `${emp.firstname} ${emp.surname}`.toLowerCase().includes(detectedPayer.toLowerCase()) ||
          detectedPayer.toLowerCase().includes(emp.firstname.toLowerCase())
        );
        next.filled_by = matchedEmp ? `${matchedEmp.firstname} ${matchedEmp.surname}` : detectedPayer;
      }
      if (notesArr.length > 0) {
        next.notes = notesArr.join(' • ');
      }
      return next;
    });

    if (fuelValidationErrors.vehicle_id || fuelValidationErrors.date || fuelValidationErrors.total_cost || fuelValidationErrors.litres) {
      setFuelValidationErrors({});
    }
  };

  const handleToggleFuelLedger = (id: string) => {
    setFuelForm(prev => {
      const updated = (prev.linkedLedgerIds || []).includes(id)
        ? (prev.linkedLedgerIds || []).filter(x => x !== id)
        : [...(prev.linkedLedgerIds || []), id];
      autoSyncFuelFromLinkedEntries(updated);
      return { ...prev, linkedLedgerIds: updated };
    });
  };

  const handleClearAllFuelLinked = () => {
    setFuelForm(prev => ({ ...prev, linkedLedgerIds: [] }));
  };

  // Bidirectional fuel calculator with smart two-way synchronization
  const handleFuelFormChange = (field: string, value: string) => {
    if (fuelValidationErrors[field]) {
      setFuelValidationErrors(prev => ({ ...prev, [field]: false }));
    }
    setFuelForm(prev => {
      const updated = { ...prev, [field]: value };
      
      const litresNum = Number(updated.litres);
      const rateNum = Number(updated.rate_per_litre);
      const costNum = Number(updated.total_cost);

      if (field === 'total_cost') {
        if (value !== '' && costNum > 0) {
          if (litresNum > 0) {
            updated.rate_per_litre = (costNum / litresNum).toFixed(2);
            updated.lastComputed = 'rate_per_litre';
          } else if (rateNum > 0) {
            updated.litres = (costNum / rateNum).toFixed(2);
            updated.lastComputed = 'litres';
          }
        }
      } else if (field === 'litres') {
        if (value !== '' && litresNum > 0) {
          if (costNum > 0) {
            updated.rate_per_litre = (costNum / litresNum).toFixed(2);
            updated.lastComputed = 'rate_per_litre';
          } else if (rateNum > 0) {
            updated.total_cost = (litresNum * rateNum).toFixed(2);
            updated.lastComputed = 'total_cost';
          }
        }
      } else if (field === 'rate_per_litre') {
        if (value !== '' && rateNum > 0) {
          if (litresNum > 0) {
            updated.total_cost = (litresNum * rateNum).toFixed(2);
            updated.lastComputed = 'total_cost';
          } else if (costNum > 0) {
            updated.litres = (costNum / rateNum).toFixed(2);
            updated.lastComputed = 'litres';
          }
        }
      }
      return updated;
    });
  };

  const handleFuelVehicleSelect = (vehicleId: string) => {
    if (fuelValidationErrors.vehicle_id) {
      setFuelValidationErrors(prev => ({ ...prev, vehicle_id: false }));
    }
    const v = vehicles.find(v => v.id === vehicleId);
    setFuelForm(prev => ({ ...prev, vehicle_id: vehicleId, vehicle_reg: v?.registration_number || '' }));
  };

  // Real-time Duplicate Fuel Log Detection
  const detectedDuplicateFuelLog = useMemo(() => {
    if (!fuelForm.vehicle_id || !fuelForm.date) return null;
    const formCost = Number(fuelForm.total_cost) || 0;
    const formLitres = Number(fuelForm.litres) || 0;

    return vehicleFuelLogs.find(log => {
      // Ignore record if currently editing it
      if (editingFuelLog && log.id === editingFuelLog.id) return false;

      const sameVehicle = log.vehicle_id === fuelForm.vehicle_id || 
        (Boolean(log.vehicle_reg && fuelForm.vehicle_reg) && log.vehicle_reg.toLowerCase() === fuelForm.vehicle_reg.toLowerCase());
      const sameDate = log.date === fuelForm.date;
      if (!sameVehicle || !sameDate) return false;

      // If cost or litres are entered, match when identical/close, or if same vehicle and date
      const logCost = Number(log.total_cost) || 0;
      const logLitres = Number(log.litres) || 0;
      
      const sameCost = formCost > 0 && Math.abs(logCost - formCost) < 5;
      const sameLitres = formLitres > 0 && Math.abs(logLitres - formLitres) < 1;
      
      return sameCost || sameLitres || (formCost === 0 && formLitres === 0);
    }) || null;
  }, [fuelForm.vehicle_id, fuelForm.vehicle_reg, fuelForm.date, fuelForm.total_cost, fuelForm.litres, vehicleFuelLogs, editingFuelLog]);

  const handleSaveFuelLog = async () => {
    const errs: Record<string, boolean> = {};
    if (!fuelForm.vehicle_id) errs.vehicle_id = true;
    if (!fuelForm.date) errs.date = true;

    let litres = Number(fuelForm.litres) || 0;
    let rate = Number(fuelForm.rate_per_litre) || 0;
    let cost = Number(fuelForm.total_cost) || 0;

    // Auto-resolve missing calculated fields if at least 2 of 3 are present
    if (cost > 0 && litres > 0 && rate <= 0) {
      rate = cost / litres;
    } else if (cost > 0 && rate > 0 && litres <= 0) {
      litres = cost / rate;
    } else if (litres > 0 && rate > 0 && cost <= 0) {
      cost = litres * rate;
    }

    if (litres <= 0) errs.litres = true;
    if (cost <= 0) errs.total_cost = true;

    if (Object.keys(errs).length > 0) {
      setFuelValidationErrors(errs);
      if (errs.vehicle_id) toast.error('Vehicle is required', { description: 'Please select a vehicle from the dropdown.' });
      else if (errs.date) toast.error('Date is required', { description: 'Please select a valid refill date.' });
      else if (errs.litres || errs.total_cost) toast.error('Fuel quantity and cost required', { description: 'Please enter Total Cost (₦) and Litres (L).' });
      return;
    }

    setFuelValidationErrors({});
    const payload = {
      vehicle_id: fuelForm.vehicle_id,
      vehicle_reg: fuelForm.vehicle_reg,
      date: fuelForm.date,
      rate_per_litre: Number(rate.toFixed(2)),
      litres: Number(litres.toFixed(2)),
      total_cost: Number(cost.toFixed(2)),
      odometer: fuelForm.odometer !== '' ? Number(fuelForm.odometer) : undefined,
      filled_by: fuelForm.filled_by || undefined,
      notes: fuelForm.notes || undefined,
      linkedLedgerIds: fuelForm.linkedLedgerIds
    };
    try {
      if (editingFuelLog) {
        await updateVehicleFuelLog(editingFuelLog.id, payload);
        toast.success('Fuel record updated');
      } else {
        await addVehicleFuelLog(payload);
        toast.success('Fuel refill logged');
      }
      setShowFuelForm(false);
      setEditingFuelLog(null);
      setFuelForm({ vehicle_id: '', vehicle_reg: '', date: new Date().toISOString().split('T')[0], rate_per_litre: '', litres: '', total_cost: '', odometer: '', filled_by: '', notes: '', linkedLedgerIds: [], lastComputed: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save fuel log');
    }
  };

  const handleEditFuelLog = (log: VehicleFuelLog) => {
    setEditingFuelLog(log);
    setFuelForm({
      vehicle_id: log.vehicle_id,
      vehicle_reg: log.vehicle_reg,
      date: log.date,
      rate_per_litre: log.rate_per_litre,
      litres: log.litres,
      total_cost: log.total_cost,
      odometer: log.odometer ?? '',
      filled_by: log.filled_by ?? '',
      notes: log.notes ?? '',
      linkedLedgerIds: log.linkedLedgerIds ?? [],
      lastComputed: ''
    });
    setShowFuelForm(true);
  };

  // Fuel Analytics Helpers
  const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getWeeksInMonth = (year: number, month: number) => {
    const weeks = new Set<number>();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      weeks.add(getISOWeek(new Date(year, month, d)));
    }
    return Array.from(weeks).sort((a, b) => a - b);
  };

  const filteredFuelLogs = vehicleFuelLogs.filter(f => {
    const d = new Date(f.date);
    if (d.getFullYear() !== fuelFilterYear) return false;
    if (fuelFilterMonth !== null && d.getMonth() !== fuelFilterMonth) return false;
    if (fuelFilterWeek !== null && getISOWeek(d) !== fuelFilterWeek) return false;
    if (fuelFilterVehicle !== '' && f.vehicle_id !== fuelFilterVehicle) return false;
    return true;
  });

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const monthlyData = MONTH_NAMES.map((name, i) => {
    const logs = vehicleFuelLogs.filter(f => {
      const d = new Date(f.date);
      if (d.getFullYear() !== fuelFilterYear || d.getMonth() !== i) return false;
      if (fuelFilterVehicle !== '' && f.vehicle_id !== fuelFilterVehicle) return false;
      return true;
    });

    const breakdown: Record<string, number> = {};
    const costBreakdown: Record<string, number> = {};
    const rateBreakdown: Record<string, number> = {};
    const vehicleStats: Record<string, { litres: number; cost: number }> = {};

    logs.forEach(f => {
      const vehicleName = getVehicleName(f.vehicle_reg);
      if (!vehicleStats[vehicleName]) vehicleStats[vehicleName] = { litres: 0, cost: 0 };
      vehicleStats[vehicleName].litres += f.litres;
      vehicleStats[vehicleName].cost += f.total_cost;
    });

    Object.entries(vehicleStats).forEach(([k, v]) => {
      breakdown[k] = v.litres;
      costBreakdown[`${k}_cost`] = v.cost;
      rateBreakdown[`${k}_rate`] = v.litres > 0 ? v.cost / v.litres : 0;
    });

    return {
      name,
      month: i,
      litres: logs.reduce((s, f) => s + f.litres, 0),
      cost: logs.reduce((s, f) => s + f.total_cost, 0),
      ...breakdown,
      ...costBreakdown,
      ...rateBreakdown
    };
  });

  const weeklyData = fuelFilterMonth !== null ? (() => {
    const weeks = getWeeksInMonth(fuelFilterYear, fuelFilterMonth);
    return weeks.map(w => {
      const logs = vehicleFuelLogs.filter(f => {
        const d = new Date(f.date);
        if (d.getFullYear() !== fuelFilterYear || d.getMonth() !== fuelFilterMonth || getISOWeek(d) !== w) return false;
        if (fuelFilterVehicle !== '' && f.vehicle_id !== fuelFilterVehicle) return false;
        return true;
      });

      const breakdown: Record<string, number> = {};
      const costBreakdown: Record<string, number> = {};
      const rateBreakdown: Record<string, number> = {};
      const vehicleStats: Record<string, { litres: number; cost: number }> = {};

      logs.forEach(f => {
        const vehicleName = getVehicleName(f.vehicle_reg);
        if (!vehicleStats[vehicleName]) vehicleStats[vehicleName] = { litres: 0, cost: 0 };
        vehicleStats[vehicleName].litres += f.litres;
        vehicleStats[vehicleName].cost += f.total_cost;
      });

      Object.entries(vehicleStats).forEach(([k, v]) => {
        breakdown[k] = v.litres;
        costBreakdown[`${k}_cost`] = v.cost;
        rateBreakdown[`${k}_rate`] = v.litres > 0 ? v.cost / v.litres : 0;
      });

      return {
        label: `Wk ${w}`,
        week: w,
        litres: logs.reduce((s, f) => s + f.litres, 0),
        cost: logs.reduce((s, f) => s + f.total_cost, 0),
        ...breakdown,
        ...costBreakdown,
        ...rateBreakdown
      };
    });
  })() : [];

  const chartData = fuelFilterMonth !== null
    ? weeklyData.map(w => ({ ...w, label: w.label, rate: w.litres > 0 ? w.cost / w.litres : 0 }))
    : monthlyData.map(m => ({ ...m, label: m.name, rate: m.litres > 0 ? m.cost / m.litres : 0 }));

  const maxLitres = Math.max(...chartData.map(d => d.litres), 1);
  const maxCost = Math.max(...chartData.map(d => d.cost), 1);
  const maxRate = Math.max(...chartData.map(d => d.rate), 1);

  const totalFuelLitres = filteredFuelLogs.reduce((s, f) => s + f.litres, 0);
  const totalFuelCost = filteredFuelLogs.reduce((s, f) => s + f.total_cost, 0);
  const avgRate = totalFuelLitres > 0 ? totalFuelCost / totalFuelLitres : 0;
  const vehicleFuelCount = filteredFuelLogs.reduce((acc, f) => { acc[f.vehicle_reg] = (acc[f.vehicle_reg] || 0) + f.litres; return acc; }, {} as Record<string, number>);
  const topVehicle = Object.entries(vehicleFuelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const topVehicleName = topVehicle !== '—' ? getVehicleName(topVehicle) : '—';
  const activeVehicleNames = Array.from(new Set(filteredFuelLogs.map(f => getVehicleName(f.vehicle_reg))));

  const topVehiclesData = Object.entries(vehicleFuelCount)
    .map(([reg, litres]) => {
      const cost = filteredFuelLogs.filter(f => f.vehicle_reg === reg).reduce((s, f) => s + f.total_cost, 0);
      return { reg, litres, cost };
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);
  const maxTopVehicleCost = Math.max(...topVehiclesData.map(v => v.cost), 1);

  const fuelYears = Array.from(new Set([new Date().getFullYear(), ...vehicleFuelLogs.map(f => new Date(f.date).getFullYear())])).sort((a, b) => b - a);
  const weeksInSelectedMonth = fuelFilterMonth !== null ? getWeeksInMonth(fuelFilterYear, fuelFilterMonth) : [];

  // Fuel Efficiency Helper
  const getFuelEfficiency = () => {
    if (fuelFilterVehicle === '') return null;
    const vehicleLogs = vehicleFuelLogs
      .filter(f => f.vehicle_id === fuelFilterVehicle && f.odometer !== undefined && f.odometer !== null && Number(f.odometer) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (vehicleLogs.length < 2) return null;
    
    const firstOdo = Number(vehicleLogs[0].odometer);
    const lastOdo = Number(vehicleLogs[vehicleLogs.length - 1].odometer);
    const distance = lastOdo - firstOdo;
    
    if (distance <= 0) return null;
    
    const litresConsumed = vehicleLogs.slice(1).reduce((sum, f) => sum + f.litres, 0);
    if (litresConsumed <= 0) return null;
    
    const kmPerLitre = distance / litresConsumed;
    const lPer100km = (litresConsumed / distance) * 100;
    
    return {
      distance,
      kmPerLitre,
      lPer100km
    };
  };
  const efficiency = getFuelEfficiency();

  const getFleetEfficiency = () => {
    let totalDistance = 0;
    let totalLitres = 0;

    const vehiclesWithLogs = new Set(vehicleFuelLogs.map(f => f.vehicle_id));
    vehiclesWithLogs.forEach(vid => {
      const vLogs = vehicleFuelLogs
        .filter(f => f.vehicle_id === vid && f.odometer !== undefined && f.odometer !== null && Number(f.odometer) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (vLogs.length >= 2) {
        const distance = Number(vLogs[vLogs.length - 1].odometer) - Number(vLogs[0].odometer);
        const litres = vLogs.slice(1).reduce((sum, f) => sum + f.litres, 0);
        if (distance > 0 && litres > 0) {
          totalDistance += distance;
          totalLitres += litres;
        }
      }
    });

    if (totalDistance <= 0 || totalLitres <= 0) return null;
    return {
      distance: totalDistance,
      kmPerLitre: totalDistance / totalLitres,
      lPer100km: (totalLitres / totalDistance) * 100
    };
  };
  const fleetEfficiency = getFleetEfficiency();

  // Combined activity log data
  const combinedLogs = [
    ...vehicleTrips.map(t => ({
      id: t.id,
      type: 'trip' as const,
      date: new Date(t.departure_time),
      rawDateStr: t.departure_time,
      vehicleReg: t.vehicle_reg,
      person: t.driver_name,
      details: t,
    })),
    ...vehicleFuelLogs.map(f => ({
      id: f.id,
      type: 'fuel' as const,
      date: new Date(f.date),
      rawDateStr: f.date,
      vehicleReg: f.vehicle_reg,
      person: f.filled_by || '—',
      details: f,
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filteredCombinedLogs = combinedLogs.filter(log => {
    // 1. Filter by user permission
    if (log.type === 'fuel' && !priv.canViewFuel) return false;
    if (log.type === 'trip' && !priv.canViewLogs) return false;

    // 2. Filter by sub-tab type
    if (logsSubTab === 'movement' && log.type !== 'trip') return false;
    if (logsSubTab === 'fuel' && log.type !== 'fuel') return false;

    // 2. Filter by search query
    if (logsSearch.trim() !== '') {
      const q = logsSearch.toLowerCase();
      const matchVehicle = log.vehicleReg.toLowerCase().includes(q);
      const matchPerson = log.person.toLowerCase().includes(q);
      
      if (log.type === 'trip') {
        const matchSite = log.details.site_name.toLowerCase().includes(q);
        const matchPurpose = log.details.purpose.toLowerCase().includes(q);
        const matchRemark = (log.details.remark || '').toLowerCase().includes(q);
        return matchVehicle || matchPerson || matchSite || matchPurpose || matchRemark;
      } else {
        const matchNotes = (log.details.notes || '').toLowerCase().includes(q);
        return matchVehicle || matchPerson || matchNotes;
      }
    }
    return true;
  });


  // 1. Vehicle Form State
  const [vForm, setVForm] = useState({
    name: '',
    registration_number: '',
    type: 'van' as string,
    status: 'active' as 'active' | 'inactive'
  });

  // 2. Trip Log Form State
  const [tForm, setTForm] = useState({
    vehicle_id: '',
    date: new Date().toISOString().split('T')[0],
    driver_name: '',
    legs: [
      { site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }
    ] as any[]
  });

  const allSites = [
    ...sites.map(s => ({ id: s.id, name: s.name, type: 'active' })),
    ...pendingSites.map(s => ({ id: s.id, name: s.siteName, type: 'pending' }))
  ];

  useSetPageTitle(
    activeTab === 'fuel' ? 'Fuel Analytics' : 'Vehicle Management',
    activeTab === 'fuel'
      ? 'Fuel consumption & cost trends across your fleet'
      : 'Manage company fleet and track daily movement logs',
    activeTab === 'fuel' ? (
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
          value={fuelFilterVehicle}
          onChange={e => setFuelFilterVehicle(e.target.value)}
        >
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
        </select>
        <select
          className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
          value={fuelFilterYear}
          onChange={e => { setFuelFilterYear(Number(e.target.value)); setFuelFilterMonth(null); setFuelFilterWeek(null); }}
        >
          {fuelYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
          value={fuelFilterMonth ?? ''}
          onChange={e => { setFuelFilterMonth(e.target.value === '' ? null : Number(e.target.value)); setFuelFilterWeek(null); }}
        >
          <option value="">All Months</option>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        {fuelFilterMonth !== null && (
          <select
            className="h-8 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 px-2 py-1 text-xs font-medium text-amber-700"
            value={fuelFilterWeek ?? ''}
            onChange={e => setFuelFilterWeek(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">All Weeks</option>
            {weeksInSelectedMonth.map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        )}
        {(fuelFilterMonth !== null || fuelFilterWeek !== null || fuelFilterVehicle !== '') && (
          <Button
            variant="ghost" size="sm"
            className="h-8 px-2 text-xs text-slate-400 hover:text-slate-600"
            onClick={() => { setFuelFilterMonth(null); setFuelFilterWeek(null); setFuelFilterVehicle(''); }}
          >
            Reset
          </Button>
        )}
        {priv.canAddFuel && (
          <Button
            size="sm"
            className="h-8 w-8 p-0 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => {
              setEditingFuelLog(null);
              setFuelForm({ vehicle_id: '', vehicle_reg: '', date: new Date().toISOString().split('T')[0], rate_per_litre: '', litres: '', total_cost: '', odometer: '', filled_by: '', notes: '', linkedLedgerIds: [], lastComputed: '' });
              setShowFuelForm(true);
            }}
            title="Log Fuel"
          >
            <Fuel className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    ) : (
      <div className="flex items-center gap-2 md:gap-3">
        {priv.canImport && (
          <Button
            variant="outline" size="sm"
            className="flex items-center gap-1.5 h-9 px-2 sm:px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm"
            onClick={() => {
              setImportType(activeTab === 'logs' ? 'logs' : 'vehicles');
              setShowImportDialog(true);
            }}
            title="Import"
          >
            <Download className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-medium">Import</span>
          </Button>
        )}
        {priv.canExport && (
          <Button
            variant="outline" size="sm"
            className="flex items-center gap-1.5 h-9 px-2 sm:px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm"
            onClick={() => handleExport()}
            title="Export"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium">Export</span>
          </Button>
        )}
        {activeTab === 'logs' && (
          <div className="flex items-center gap-2">
            {priv.canAddLogs && (
              <Button
                variant="outline" size="sm"
                className="flex items-center gap-1.5 h-9 px-2 sm:px-3 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setShowTripForm(true)}
                title="Record Trip"
              >
                <ClipboardList className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium hidden">Log Trip</span>
              </Button>
            )}
            {priv.canAddFuel && (
              <Button
                variant="outline" size="sm"
                className="flex items-center gap-1.5 h-9 px-2 sm:px-3 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => {
                  setEditingFuelLog(null);
                  setFuelForm({ vehicle_id: '', vehicle_reg: '', date: new Date().toISOString().split('T')[0], rate_per_litre: '', litres: '', total_cost: '', odometer: '', filled_by: '', notes: '', linkedLedgerIds: [], lastComputed: '' });
                  setShowFuelForm(true);
                }}
                title="Log Fuel"
              >
                <Fuel className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium hidden">Log Fuel</span>
              </Button>
            )}
            {priv.canViewFuelAnalytics && (
              <Button
                variant="outline" size="sm"
                className="flex items-center gap-1.5 h-9 px-2 sm:px-3 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 shadow-sm"
                onClick={() => setActiveTab('fuel')}
                title="Fuel Analytics"
              >
                <BarChart3 className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium hidden">Analytics</span>
              </Button>
            )}
          </div>
        )}
        {activeTab === 'fleet' && priv.canAddFleet && (
          <Button
            size="sm"
            className="flex items-center gap-1.5 h-9 px-2 sm:px-3 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              setEditingVehicle(null);
              setVForm({ name: '', registration_number: '', type: 'van', status: 'active' });
              setShowVehicleForm(true);
            }}
            title="Add Vehicle"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs font-medium">Add Vehicle</span>
          </Button>
        )}
      </div>
    ),
    [activeTab, fuelFilterVehicle, fuelFilterYear, fuelFilterMonth, fuelFilterWeek],
    activeTab === 'fuel' ? () => setActiveTab('logs') : false
  );

  const handleSaveVehicle = () => {
    if (!vForm.name || !vForm.registration_number) return;
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, vForm);
    } else {
      addVehicle(vForm);
    }
    setShowVehicleForm(false);
  };

  const handleSaveTrip = () => {
    const selectedVehicle = vehicles.find(v => v.id === tForm.vehicle_id);
    if (!selectedVehicle || !tForm.driver_name) return;

    if (editingTrip) {
      const leg = tForm.legs[0];
      const updatedLog = {
        ...leg,
        id: editingTrip.id,
        vehicle_id: selectedVehicle.id,
        vehicle_reg: selectedVehicle.registration_number,
        driver_name: tForm.driver_name,
        departure_time: `${tForm.date}T${leg.departure_time || '00:00'}:00Z`,
        arrival_time: leg.arrival_time ? `${tForm.date}T${leg.arrival_time}:00Z` : undefined,
      };
      updateVehicleTripRecord(editingTrip.id, updatedLog);
    } else {
      const logs = tForm.legs.map(leg => ({
        ...leg,
        vehicle_id: selectedVehicle.id,
        vehicle_reg: selectedVehicle.registration_number,
        driver_name: tForm.driver_name,
        departure_time: `${tForm.date}T${leg.departure_time || '00:00'}:00Z`,
        arrival_time: leg.arrival_time ? `${tForm.date}T${leg.arrival_time}:00Z` : undefined,
      }));
      addVehicleTripRecords(logs);
    }

    setShowTripForm(false);
    setEditingTrip(null);
    setTForm({
      vehicle_id: '',
      date: new Date().toISOString().split('T')[0],
      driver_name: '',
      legs: [{ site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }]
    });
  };

  const handleExport = () => {
    let data: any[] = [];
    let fileName = '';

    if (activeTab === 'logs') {
      fileName = 'Vehicle_Movement_Logs.xlsx';
      data = (vehicleTrips || []).map(t => ({
        'Date': new Date(t.departure_time).toLocaleDateString(),
        'Vehicle Reg': t.vehicle_reg,
        'Driver': t.driver_name,
        'Site': t.site_name,
        'Purpose': t.purpose,
        'Departure': new Date(t.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Arrival': t.arrival_time ? new Date(t.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        'Odometer Start': t.odometer_start || '',
        'Odometer End': t.odometer_end || '',
        'Remark': t.remark || ''
      }));

      if (data.length === 0) {
        data = [{
          'Date': '', 'Vehicle Reg': '', 'Driver': '', 'Site': '', 'Purpose': '',
          'Departure': '', 'Arrival': '', 'Odometer Start': '', 'Odometer End': '', 'Remark': ''
        }];
      }
    } else {
      fileName = 'Vehicle_Fleet_Inventory.xlsx';
      const docHeaders = vehicleDocumentTypes.map(d => d.name);
      data = (vehicles || []).map(v => {
        const row: any = {
          'Fleet': v.name,
          'Reg No': v.registration_number,
          'Type': v.type || 'van',
          'Status': v.status
        };
        docHeaders.forEach(h => {
          row[h] = v.documents?.[h] || '';
        });
        return row;
      });

      if (data.length === 0) {
        const emptyRow: any = { 'Fleet': '', 'Reg No': '', 'Type': '', 'Status': '' };
        docHeaders.forEach(h => { emptyRow[h] = ''; });
        data = [emptyRow];
      }
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, fileName);
    toast.success('Exported successfully');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });

        if (data.length === 0) {
          toast.error('The file is empty');
          return;
        }

        if (importType === 'vehicles') {
          const newVehicles: Vehicle[] = data.map((row: any) => {
            const docs: Record<string, string> = {};
            vehicleDocumentTypes.forEach(d => {
              if (row[d.name]) docs[d.name] = String(row[d.name]);
            });

            return {
              id: crypto.randomUUID(),
              name: row['Fleet'] || row['name'] || 'Unknown',
              registration_number: row['Reg No'] || row['registration_number'] || '',
              type: (row['Type'] || row['type'] || 'van').toLowerCase() as any,
              status: (row['Status'] || row['status'] || 'active').toLowerCase() as any,
              documents: docs,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
          }).filter(v => v.registration_number);

          if (importMode === 'replace') {
            await setVehicles(newVehicles);
          } else {
            const existingRegs = new Set(vehicles.map(v => v.registration_number.toLowerCase()));
            const uniqueNew = newVehicles.filter(v => !existingRegs.has(v.registration_number.toLowerCase()));
            await insertVehicles(uniqueNew);
          }
          toast.success(`Imported ${newVehicles.length} vehicles`);
        } else {
          const newLogs = data.map((row: any) => {
            const vehicle = vehicles.find(v => 
              v.registration_number.toLowerCase() === (row['Vehicle Reg'] || row['vehicle_reg'] || '').toLowerCase()
            );
            
            return {
              id: crypto.randomUUID(),
              vehicle_id: vehicle?.id || 'manual',
              vehicle_reg: row['Vehicle Reg'] || row['vehicle_reg'] || '',
              driver_name: row['Driver'] || row['driver_name'] || '',
              site_name: row['Site'] || row['site_name'] || '',
              purpose: row['Purpose'] || row['purpose'] || '',
              departure_time: row['Departure'] ? new Date(`${row['Date']} ${row['Departure']}`).toISOString() : new Date().toISOString(),
              arrival_time: row['Arrival'] ? new Date(`${row['Date']} ${row['Arrival']}`).toISOString() : undefined,
              odometer_start: Number(row['Odometer Start'] || row['odometer_start'] || 0),
              odometer_end: Number(row['Odometer End'] || row['odometer_end'] || 0),
              remark: row['Remark'] || row['remark'] || ''
            };
          });

          if (importMode === 'replace') {
            await setVehicleTripRecords(newLogs);
          } else {
            await addVehicleTripRecords(newLogs);
          }
          toast.success(`Imported ${newLogs.length} movement logs`);
        }
        setShowImportDialog(false);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse file. Check headers.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleEditTrip = (trip: VehicleTripLeg) => {
    setEditingTrip(trip);
    const datePart = trip.departure_time.split('T')[0];
    const depTimePart = trip.departure_time.split('T')[1].substring(0, 5);
    const arrTimePart = trip.arrival_time ? trip.arrival_time.split('T')[1].substring(0, 5) : '';

    setTForm({
      vehicle_id: trip.vehicle_id,
      date: datePart,
      driver_name: trip.driver_name,
      legs: [{
        site_name: trip.site_name,
        purpose: trip.purpose,
        departure_time: depTimePart,
        arrival_time: arrTimePart,
        remark: trip.remark,
        odometer_start: trip.odometer_start,
        odometer_end: trip.odometer_end
      }]
    });
    setShowTripForm(true);
  };

  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    v.registration_number.toLowerCase().includes(search.toLowerCase())
  );

  const sortedTrips = [...vehicleTrips].sort((a, b) => 
    new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime()
  );

  // Calendar Helper Functions
  const calendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  return (
    <>

      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowVehicleForm(false)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Vehicle Name</Label>
                <Input placeholder="e.g. Toyota Hilux" value={vForm.name} onChange={e => setVForm({...vForm, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input placeholder="e.g. LAG-123-XY" value={vForm.registration_number} onChange={e => setVForm({...vForm, registration_number: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950"
                  value={vForm.type} onChange={e => setVForm({...vForm, type: e.target.value})}>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="bike">Bike</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveVehicle}>Save Vehicle</Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowVehicleForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trip Log Modal */}
      {showTripForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl my-8 animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{editingTrip ? 'Edit Trip Record' : 'Daily Trip Movement Log'}</CardTitle>
                    <p className="text-xs text-slate-500">{editingTrip ? 'Modify the details of this site visit' : 'Record vehicle visits and mileage for today'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setShowTripForm(false); setEditingTrip(null); }}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                    value={tForm.vehicle_id} onChange={e => setTForm({...tForm, vehicle_id: e.target.value})}>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={tForm.date} onChange={e => setTForm({...tForm, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input list="driver-list" placeholder="Select or type driver" value={tForm.driver_name} onChange={e => setTForm({...tForm, driver_name: e.target.value})} />
                  <datalist id="driver-list">
                    {employees.map(emp => <option key={emp.id} value={`${emp.firstname} ${emp.surname}`} />)}
                  </datalist>
                </div>
              </div>

              <DropdownMenuSeparator className="my-6" />

              {/* Trip Legs */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {editingTrip ? 'Trip Details' : 'Trip Leg(s) / Site Visits'}
                  </h3>
                  {!editingTrip && (
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 gap-1"
                      onClick={() => setTForm({...tForm, legs: [...tForm.legs, { site_name: '', purpose: '', departure_time: '', arrival_time: '', remark: '', odometer_start: undefined, odometer_end: undefined }]})}>
                      <PlusCircle className="h-4 w-4" /> Add Leg
                    </Button>
                  )}
                </div>

                {tForm.legs.map((leg, idx) => (
                  <div key={idx} className="relative p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4 group">
                    {tForm.legs.length > 1 && (
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white dark:bg-slate-800 border shadow-sm text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newLegs = [...tForm.legs];
                          newLegs.splice(idx, 1);
                          setTForm({...tForm, legs: newLegs});
                        }}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Destination (Active/Pending/Manual)</Label>
                        <Input list={`site-list-${idx}`} placeholder="Select site or type location" value={leg.site_name} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].site_name = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                        <datalist id={`site-list-${idx}`}>
                          {Array.from(new Map(allSites.map(s => [s.name, s])).values()).map(s => <option key={s.id} value={s.name} />)}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Purpose of Movement</Label>
                        <Input placeholder="e.g. Delivery, Site Visit, Pickup" value={leg.purpose} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].purpose = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Dept Time</Label>
                        <Input type="time" className="h-9 px-2" value={leg.departure_time} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].departure_time = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Arr Time</Label>
                        <Input type="time" className="h-9 px-2" value={leg.arrival_time} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].arrival_time = e.target.value;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Odom. Start</Label>
                        <Input type="number" className="h-9 px-2" placeholder="Start" value={leg.odometer_start || ''} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].odometer_start = Number(e.target.value) || undefined;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Odom. End</Label>
                        <Input type="number" className="h-9 px-2" placeholder="End" value={leg.odometer_end || ''} 
                          onChange={e => {
                            const newLegs = [...tForm.legs];
                            newLegs[idx].odometer_end = Number(e.target.value) || undefined;
                            setTForm({...tForm, legs: newLegs});
                          }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Remark / Specific Notes</Label>
                      <Input placeholder="Any additional info..." value={leg.remark} 
                        onChange={e => {
                          const newLegs = [...tForm.legs];
                          newLegs[idx].remark = e.target.value;
                          setTForm({...tForm, legs: newLegs});
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-t flex flex-row gap-3 pt-4">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveTrip}>{editingTrip ? 'Update Entry' : 'Submit Entry'}</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowTripForm(false); setEditingTrip(null); }}>Discard</Button>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  Import Data
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowImportDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Configure how you want to import your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>What would you like to import?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    className={`p-3 rounded-lg border-2 text-left transition-all ${importType === 'vehicles' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}
                    onClick={() => setImportType('vehicles')}
                  >
                    <Truck className={`h-5 w-5 mb-1 ${importType === 'vehicles' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="text-sm font-bold">Vehicle Info</div>
                    <div className="text-[10px] text-slate-500">Fleet & Documents</div>
                  </button>
                  <button 
                    className={`p-3 rounded-lg border-2 text-left transition-all ${importType === 'logs' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}
                    onClick={() => setImportType('logs')}
                  >
                    <ClipboardList className={`h-5 w-5 mb-1 ${importType === 'logs' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="text-sm font-bold">Movement Log</div>
                    <div className="text-[10px] text-slate-500">Daily Trip Records</div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Import Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    className={`p-3 rounded-lg border-2 text-left transition-all ${importMode === 'append' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}
                    onClick={() => setImportMode('append')}
                  >
                    <div className="text-sm font-bold">Append</div>
                    <div className="text-[10px] text-slate-500">Add to existing data</div>
                  </button>
                  <button 
                    className={`p-3 rounded-lg border-2 text-left transition-all ${importMode === 'replace' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}
                    onClick={() => setImportMode('replace')}
                  >
                    <div className="text-sm font-bold text-red-600">Replace</div>
                    <div className="text-[10px] text-slate-500">Wipe & overwrite all</div>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportFile}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={isImporting}
                  />
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 gap-2" disabled={isImporting}>
                    {isImporting ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isImporting ? 'Processing File...' : 'Select Excel File'}
                  </Button>
                </div>
                <p className="text-[10px] text-center mt-2 text-slate-500 italic">
                  Note: Ensure headers match system expectations. Export first to get a template.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fuel Log Modal */}
      {showFuelForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <Card className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-lg shadow-2xl rounded-none sm:rounded-xl flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                    <Fuel className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{editingFuelLog ? 'Edit Fuel Record' : 'Log Fuel Refill'}</CardTitle>
                    <p className="text-xs text-slate-500">Record a vehicle fuel refill entry</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setShowFuelForm(false); setEditingFuelLog(null); }}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4 flex-1 overflow-y-auto sm:max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Vehicle *</Label>
                  <select
                    className={cn(
                      "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-950",
                      fuelValidationErrors.vehicle_id ? "border-red-500 ring-2 ring-red-500/50 bg-red-50/20" : "border-slate-200 dark:border-slate-800"
                    )}
                    value={fuelForm.vehicle_id}
                    onChange={e => handleFuelVehicleSelect(e.target.value)}
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
                  </select>
                  {fuelValidationErrors.vehicle_id && <p className="text-[11px] text-red-500 font-medium">Please select a vehicle</p>}
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input 
                    type="date" 
                    value={fuelForm.date} 
                    onChange={e => handleFuelFormChange('date', e.target.value)} 
                    className={cn(fuelValidationErrors.date && "border-red-500 ring-2 ring-red-500/50 bg-red-50/20")}
                  />
                  {fuelValidationErrors.date && <p className="text-[11px] text-red-500 font-medium">Date is required</p>}
                </div>
                <div className="space-y-2">
                  <Label>Filled By</Label>
                  <Input
                    list="fuel-driver-list"
                    placeholder="Person who filled"
                    value={fuelForm.filled_by}
                    onChange={e => handleFuelFormChange('filled_by', e.target.value)}
                  />
                  <datalist id="fuel-driver-list">
                    {employees.map(emp => <option key={emp.id} value={`${emp.firstname} ${emp.surname}`} />)}
                  </datalist>
                </div>

                {/* Duplicate / Existing Fuel Refill Warning Card */}
                {detectedDuplicateFuelLog && !editingFuelLog && (
                  <div className="md:col-span-2 p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 space-y-2 text-xs shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                            <span>Existing Fuel Refill Logged on this Date</span>
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 font-semibold text-amber-900 dark:text-amber-200">
                            {formatDisplayDate(detectedDuplicateFuelLog.date)}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800/95 dark:text-amber-300/90 mt-1 leading-relaxed">
                          A refill record for <strong>{getVehicleName(detectedDuplicateFuelLog.vehicle_reg)}</strong> ({detectedDuplicateFuelLog.vehicle_reg}) is already logged for <strong>{fmtCurrency(detectedDuplicateFuelLog.total_cost)}</strong> ({detectedDuplicateFuelLog.litres} L)
                          {detectedDuplicateFuelLog.linkedLedgerIds?.length 
                            ? ` · Linked to ${detectedDuplicateFuelLog.linkedLedgerIds.length} expense voucher(s)` 
                            : ' · Unlinked'}.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/60">
                      <button
                        type="button"
                        onClick={() => {
                          const mergedLinked = Array.from(new Set([...(detectedDuplicateFuelLog.linkedLedgerIds || []), ...(fuelForm.linkedLedgerIds || [])]));
                          setEditingFuelLog(detectedDuplicateFuelLog);
                          setFuelForm({
                            vehicle_id: detectedDuplicateFuelLog.vehicle_id,
                            vehicle_reg: detectedDuplicateFuelLog.vehicle_reg,
                            date: detectedDuplicateFuelLog.date,
                            rate_per_litre: detectedDuplicateFuelLog.rate_per_litre ? detectedDuplicateFuelLog.rate_per_litre.toString() : '',
                            litres: detectedDuplicateFuelLog.litres ? detectedDuplicateFuelLog.litres.toString() : '',
                            total_cost: detectedDuplicateFuelLog.total_cost ? detectedDuplicateFuelLog.total_cost.toString() : '',
                            odometer: detectedDuplicateFuelLog.odometer ? detectedDuplicateFuelLog.odometer.toString() : '',
                            filled_by: detectedDuplicateFuelLog.filled_by || '',
                            notes: detectedDuplicateFuelLog.notes || '',
                            linkedLedgerIds: mergedLinked,
                            lastComputed: ''
                          });
                          toast.info('Switched to update existing fuel log with linked voucher(s).');
                        }}
                        className="px-3 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Update Existing Log Instead
                      </button>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold">Reconcile Costs / Expense Voucher</Label>
                    {(fuelForm.linkedLedgerIds?.length || 0) > 0 && (
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {fuelForm.linkedLedgerIds.length} Linked ({fmtCurrency(totalLinkedFuelAmount)})
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFuelFormLedgerDialog(true)}
                    className={cn(
                      "w-full h-10 flex items-center justify-between px-3 text-xs font-semibold rounded-xl border transition-all shadow-xs",
                      (fuelForm.linkedLedgerIds?.length || 0) > 0
                        ? "bg-indigo-50/70 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-indigo-500" />
                      <span>{(fuelForm.linkedLedgerIds?.length || 0) > 0 ? 'Manage Linked Vouchers' : 'Link Expense Voucher & Auto-Fill'}</span>
                    </div>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Select from Ledger →</span>
                  </Button>
                </div>

                {/* Linked Vouchers Breakdown Card */}
                {(fuelForm.linkedLedgerIds?.length || 0) > 0 && (
                  <div className="md:col-span-2 p-3.5 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                          Linked Vouchers ({linkedFuelEntries.length}) — {fmtCurrency(totalLinkedFuelAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={handleClearAllFuelLinked}
                          className="text-[10px] font-semibold text-red-500 hover:text-red-700 hover:underline px-1.5 py-0.5 rounded transition-colors"
                          title="Remove all linked vouchers"
                        >
                          Deselect All
                        </button>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setShowFuelFormLedgerDialog(true)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-colors"
                        >
                          + Manage
                        </button>
                        <button
                          type="button"
                          onClick={() => autoSyncFuelFromLinkedEntries()}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          Re-AutoFill
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {linkedFuelEntries.map(e => {
                        const rem = ledgerRemainingAmounts.get(e.id) ?? Number(e.amount) ?? 0;
                        const parsedL = parseLitresFromText(e.description);
                        return (
                          <div key={e.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-indigo-100 dark:border-slate-700/80 text-xs flex flex-col justify-between gap-1 shadow-xs">
                            <div>
                              <div className="flex items-center justify-between gap-1 font-semibold text-slate-800 dark:text-slate-200">
                                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">{e.voucherNo || 'Voucher'}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(rem)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFuelLedger(e.id)}
                                    title="Deselect this voucher"
                                    className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">{e.description}</p>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-700/60 pt-1 mt-1">
                              <span>{new Date(e.date).toLocaleDateString('en-GB')}</span>
                              {parsedL && (
                                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded">
                                  ~{parsedL}L
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Fuel Calculator */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fuel Calculator</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Total Cost (₦) *
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 25000"
                      value={fuelForm.total_cost}
                      onChange={e => handleFuelFormChange('total_cost', e.target.value)}
                      onFocus={e => e.target.select()}
                      className={cn(
                        "caret-amber-500 font-semibold",
                        fuelValidationErrors.total_cost && "border-red-500 ring-2 ring-red-500/50 bg-red-50/20"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Litres (L) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 40"
                      value={fuelForm.litres}
                      onChange={e => handleFuelFormChange('litres', e.target.value)}
                      onFocus={e => e.target.select()}
                      className={cn(
                        "caret-amber-500",
                        fuelValidationErrors.litres && "border-red-500 ring-2 ring-red-500/50 bg-red-50/20"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rate (₦/L)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 625"
                      value={fuelForm.rate_per_litre}
                      onChange={e => handleFuelFormChange('rate_per_litre', e.target.value)}
                      onFocus={e => e.target.select()}
                      className="caret-amber-500"
                    />
                  </div>
                </div>
                {Number(fuelForm.litres) > 0 && Number(fuelForm.rate_per_litre) > 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {Number(fuelForm.litres).toFixed(2)} L × ₦{Number(fuelForm.rate_per_litre).toLocaleString()}/L = ₦{(Number(fuelForm.litres) * Number(fuelForm.rate_per_litre)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Odometer Reading (km)</Label>
                  <Input type="number" placeholder="Optional" value={fuelForm.odometer} onChange={e => handleFuelFormChange('odometer', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Optional notes..." value={fuelForm.notes} onChange={e => handleFuelFormChange('notes', e.target.value)} />
                </div>
              </div>

            </CardContent>
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-t flex flex-row gap-3 pt-4 shrink-0">
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSaveFuelLog}>
                {editingFuelLog ? 'Update Record' : 'Save Fuel Log'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowFuelForm(false); setEditingFuelLog(null); }}>Discard</Button>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Fuel Log Modal - Ledger Linking Dialog */}
      <Dialog open={showFuelFormLedgerDialog} onOpenChange={setShowFuelFormLedgerDialog}>
        <DialogContent className="max-w-2xl w-full max-h-[88vh] flex flex-col p-5 sm:p-6 rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LinkIcon className="w-4 h-4 text-indigo-500" />
              Link Vehicle Fuel Expenses (Ledger)
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select fuel/diesel/PMS vouchers to automatically fill Vehicle, Litres, Price/Litre, Total Cost, and Date.
            </p>
          </DialogHeader>
          
          <div className="flex flex-col flex-1 min-h-0 pt-3 space-y-3">
            {Number(fuelForm.total_cost) > 0 && (
              <div className="p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold shrink-0 bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200">
                <span>Fuel Cost: {fmtCurrency(Number(fuelForm.total_cost))}</span>
                <span>Linked: {fmtCurrency(totalLinkedFuelAmount)}</span>
              </div>
            )}

            {/* Filter Bar: Text Search + Month / Date Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={fuelFormLedgerSearch}
                  onChange={e => setFuelFormLedgerSearch(e.target.value)}
                  placeholder="Search voucher by description, vehicle, driver..."
                  className="w-full h-9 pl-8 pr-8 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                {fuelFormLedgerSearch && (
                  <button
                    type="button"
                    onClick={() => setFuelFormLedgerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={fuelFormLedgerMonth}
                  onChange={e => setFuelFormLedgerMonth(e.target.value)}
                  className="h-9 rounded-lg text-xs px-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-white outline-none font-medium appearance-none cursor-pointer pr-7"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="">All Months</option>
                  {availableLedgerMonths.map(m => {
                    const [y, mon] = m.split('-');
                    const d = new Date(Number(y), Number(mon) - 1, 1);
                    return (
                      <option key={m} value={m}>
                        {d.toLocaleString('en-GB', { month: 'short', year: 'numeric' })}
                      </option>
                    );
                  })}
                </select>

                {(fuelFormLedgerSearch || fuelFormLedgerMonth || fuelFormLedgerStartDate || fuelFormLedgerEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFuelFormLedgerSearch('');
                      setFuelFormLedgerMonth('');
                      setFuelFormLedgerStartDate('');
                      setFuelFormLedgerEndDate('');
                    }}
                    className="h-9 px-2.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition-colors flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {eligibleLedgerEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <Receipt className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm italic">No fuel/diesel/PMS expenses found in ledger.</p>
              </div>
            ) : filteredFuelFormLedgerEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <Search className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm italic">No matching ledger entries found for selected filter.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1.5 space-y-2.5 style-scroll max-h-[380px] my-1">
                {filteredFuelFormLedgerEntries.map(entry => {
                  const isLinked = (fuelForm.linkedLedgerIds || []).includes(entry.id);
                  const rem = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount) ?? 0;
                  const total = Number(entry.amount) || 0;
                  const isPartial = rem < total && rem > 0;
                  const parsedL = parseLitresFromText(entry.description);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleToggleFuelLedger(entry.id)}
                      className={cn(
                        "p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 shadow-xs cursor-pointer select-none",
                        isLinked
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 ring-1 ring-indigo-500/20"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={() => handleToggleFuelLedger(entry.id)}
                          onClick={e => e.stopPropagation()}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {entry.voucherNo || 'Voucher'}
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                                {fmtCurrency(rem)}
                              </span>
                              {isPartial && (
                                <span className="text-[10px] text-slate-400 block">
                                  of {fmtCurrency(total)}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                            {entry.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>📅 {new Date(entry.date).toLocaleDateString('en-GB')}</span>
                            {parsedL && (
                              <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                                ⛽ ~{parsedL} L
                              </span>
                            )}
                            {entry.enteredBy && (
                              <span>👤 {entry.enteredBy}</span>
                            )}
                            {entry.site && (
                              <span>📍 {entry.site}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {fuelForm.linkedLedgerIds?.length || 0} selected ({fmtCurrency(totalLinkedFuelAmount)})
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFuelFormLedgerDialog(false)}
                >
                  Done
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    autoSyncFuelFromLinkedEntries();
                    setShowFuelFormLedgerDialog(false);
                    toast.success('Form auto-filled from linked vouchers');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Fill & Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standalone Link Ledger Dialog — Vehicle Fuel */}
      <Dialog open={!!selectedFuelLogForLedger} onOpenChange={open => { if (!open) setSelectedFuelLogForLedger(null); }}>
        <DialogContent className="max-w-xl w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-slate-50/50 dark:bg-slate-900">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <LinkIcon className="h-4 w-4 text-amber-500" />
              Link Financial Ledger Entries
            </DialogTitle>
            {selectedFuelLogForLedger && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{getVehicleName(selectedFuelLogForLedger.vehicle_reg)} ({selectedFuelLogForLedger.vehicle_reg})</p>
                  <p className="text-[10px] text-slate-400">Date: {formatDisplayDate(selectedFuelLogForLedger.date)} {selectedFuelLogForLedger.filled_by ? `· By ${selectedFuelLogForLedger.filled_by}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Fuel Log Cost</p>
                  <p className="text-sm font-black text-amber-600 dark:text-amber-400">{fmtCurrency(selectedFuelLogForLedger.total_cost)}</p>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="px-5 py-3 border-b bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9 pr-8 h-9 text-sm"
                  placeholder="Search ledger entries by description, site, voucher, date..."
                  value={standaloneLedgerSearch}
                  onChange={e => setStandaloneLedgerSearch(e.target.value)}
                />
                {standaloneLedgerSearch && (
                  <button
                    type="button"
                    onClick={() => setStandaloneLedgerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={standaloneLedgerMonth}
                  onChange={e => setStandaloneLedgerMonth(e.target.value)}
                  className="h-9 rounded-lg text-xs px-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white outline-none font-medium appearance-none cursor-pointer pr-7"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="">All Months</option>
                  {availableLedgerMonths.map(m => {
                    const [y, mon] = m.split('-');
                    const d = new Date(Number(y), Number(mon) - 1, 1);
                    return (
                      <option key={m} value={m}>
                        {d.toLocaleString('en-GB', { month: 'short', year: 'numeric' })}
                      </option>
                    );
                  })}
                </select>

                {(standaloneLedgerSearch || standaloneLedgerMonth || ledgerStartDate || ledgerEndDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStandaloneLedgerSearch('');
                      setStandaloneLedgerMonth('');
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                    }}
                    className="h-9 px-2 text-xs text-rose-500 hover:text-rose-700 font-bold shrink-0"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Date Filtering Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Date Mode:</span>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setLedgerDateFilterType('transaction')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      ledgerDateFilterType === 'transaction'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Transaction Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerDateFilterType('voucher')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      ledgerDateFilterType === 'voucher'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Voucher Date
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[220px]">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-400 font-semibold">From:</span>
                  <Input
                    type="date"
                    value={ledgerStartDate}
                    onChange={e => setLedgerStartDate(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-slate-900 py-0 px-1.5 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-400 font-semibold">To:</span>
                  <Input
                    type="date"
                    value={ledgerEndDate}
                    onChange={e => setLedgerEndDate(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-slate-900 py-0 px-1.5 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
            {filteredStandaloneLedgerEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">
                {eligibleLedgerEntries.length === 0
                  ? 'No fuel/petrol/diesel entries found in the financial ledger.'
                  : 'No entries match your filter criteria.'}
              </p>
            ) : (
              filteredStandaloneLedgerEntries.map(entry => {
                const remainingAvailable = ledgerRemainingAmounts.get(entry.id) ?? Number(entry.amount);
                const isSelected = standaloneAllocations[entry.id] !== undefined;
                const allocatedAmount = standaloneAllocations[entry.id] ?? 0;
                const totalEntryAmount = Number(entry.amount) || 0;
                const isFullyUsed = remainingAvailable <= 0 && !isSelected;
                const vDate = getVoucherDate(entry.voucherNo);
                const vReg = selectedFuelLogForLedger?.vehicle_reg?.toLowerCase() || '';
                const vName = selectedFuelLogForLedger ? getVehicleName(selectedFuelLogForLedger.vehicle_reg).toLowerCase() : '';
                const descLower = (entry.description || '').toLowerCase();
                const matchesVehicle = Boolean((vReg && descLower.includes(vReg)) || (vName && descLower.includes(vName)));
                const parsedL = parseLitresFromText(entry.description);

                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-600 shadow-sm'
                        : isFullyUsed
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 opacity-50'
                        : matchesVehicle
                        ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          disabled={isFullyUsed}
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setStandaloneAllocations(prev => {
                                const copy = { ...prev };
                                delete copy[entry.id];
                                return copy;
                              });
                            } else {
                              const remainingUncovered = Math.max(0, (selectedFuelLogForLedger?.total_cost || 0) - totalAllocatedInStandaloneDialog);
                              const defaultAmt = remainingAvailable > 0
                                ? Math.min(remainingAvailable, remainingUncovered > 0 ? remainingUncovered : remainingAvailable)
                                : totalEntryAmount;
                              setStandaloneAllocations(prev => ({
                                ...prev,
                                [entry.id]: defaultAmt
                              }));
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{entry.description}</p>
                            {matchesVehicle && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ✨ Matches Vehicle
                              </span>
                            )}
                            {parsedL && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                                ⛽ ~{parsedL} L
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                            <span><strong className="text-slate-600 dark:text-slate-300">Tx:</strong> {entry.date}</span>
                            {vDate && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                · <strong>Voucher:</strong> {vDate}
                              </span>
                            )}
                            {entry.voucherNo ? ` · #${entry.voucherNo}` : ''}
                            {entry.site ? ` · 📍 ${entry.site}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{fmtCurrency(totalEntryAmount)}</p>
                        <p className="text-[10px] text-slate-400">
                          Available: <span className={remainingAvailable <= 0 ? 'text-rose-500 font-semibold' : 'text-slate-600 dark:text-slate-300 font-semibold'}>{fmtCurrency(remainingAvailable)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Allocated Amount Input when selected */}
                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Amount to Extract/Link for this vehicle log:</span>
                        <div className="flex items-center gap-1.5 w-36">
                          <span className="text-xs font-bold text-slate-400">₦</span>
                          <Input
                            type="number"
                            min="0"
                            max={totalEntryAmount}
                            className="h-8 text-xs font-bold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900"
                            value={allocatedAmount === 0 ? '' : allocatedAmount}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              setStandaloneAllocations(prev => ({
                                ...prev,
                                [entry.id]: isNaN(val) ? 0 : val
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Dialog Footer Summary & Actions */}
          {selectedFuelLogForLedger && (
            <div className="px-6 py-4 border-t bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Log Cost: {fmtCurrency(selectedFuelLogForLedger.total_cost)}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-emerald-600 font-bold">Allocated: {fmtCurrency(totalAllocatedInStandaloneDialog)}</span>
                </div>
                {totalAllocatedInStandaloneDialog >= selectedFuelLogForLedger.total_cost ? (
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Fully Covered
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-semibold mt-0.5">
                    Remaining Uncovered: {fmtCurrency(selectedFuelLogForLedger.total_cost - totalAllocatedInStandaloneDialog)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedFuelLogForLedger(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveStandaloneLedger} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4">
                  Save Ledger Links
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tabs — hidden when on Fuel Analytics */}
      {activeTab !== 'fuel' && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 px-2 mx-1">
          {(priv.canViewLogs || priv.canViewFuel) && (
            <button
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => setActiveTab('logs')}
            >
              Operations Logs
            </button>
          )}
          {priv.canViewFleet && (
            <button
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'fleet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => setActiveTab('fleet')}
            >
              Vehicle Fleet
            </button>
          )}
          {priv.canViewDocuments && (
            <button
              className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'documents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => setActiveTab('documents')}
            >
              Vehicle Documents
            </button>
          )}
        </div>
      )}

      {activeTab === 'fleet' ? (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-1">
            <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-900/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Fleet</p>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{vehicles.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-4 justify-between items-center border-b dark:border-slate-800">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" /> Fleet Overview
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Search fleet..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    <th className="px-6 py-3">Vehicle Details</th>
                    <th className="px-6 py-3">Registration</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm italic">No vehicles found</td>
                    </tr>
                  ) : (
                    filteredVehicles.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                              <Truck className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{v.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{v.registration_number}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize text-[10px] bg-slate-50 dark:bg-slate-800">{v.type}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          {v.status === 'active' ? (
                            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-emerald-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-rose-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inactive
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {priv.canEditFleet && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                setEditingVehicle(v);
                                setVForm({ name: v.name, registration_number: v.registration_number, type: v.type || 'van', status: v.status });
                                setShowVehicleForm(true);
                              }}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {priv.canDeleteFleet && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteVehicle(v.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Mobile View: Cards */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVehicles.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400 text-sm italic">No vehicles found</div>
              ) : (
                filteredVehicles.map(v => (
                  <div key={`mobile-${v.id}`} className="p-4 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Truck className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-700 dark:text-slate-200">{v.name}</span>
                           <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{v.registration_number}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="capitalize text-[10px] bg-slate-50 dark:bg-slate-800">{v.type}</Badge>
                        {v.status === 'active' ? (
                          <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-rose-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inactive
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-1 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {priv.canEditFleet && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingVehicle(v);
                            setVForm({ name: v.name, registration_number: v.registration_number, type: v.type || 'van', status: v.status });
                            setShowVehicleForm(true);
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {priv.canDeleteFleet && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => deleteVehicle(v.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : activeTab === 'documents' ? (
        <div className="space-y-6">
          {/* Document Legend */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
            <div className="flex flex-wrap gap-2">
              {vehicleDocumentTypes.map(type => (
                <Badge key={type.id} variant="secondary" className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none">
                  {type.name}
                </Badge>
              ))}
            </div>
          </div>


          {/* Flat UI & Minimalist Vehicle Document Update & History Modal */}
          <Dialog open={showDocModal} onOpenChange={open => { if (!open) setShowDocModal(false); }}>
            <DialogContent className="max-w-3xl w-full max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
              {/* Flat Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {editingDocVehicle?.name}
                      </h3>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {editingDocVehicle?.registration_number}
                      </span>
                      {editingDocVehicle?.type && (
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          · {editingDocVehicle.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flat Stats Chips */}
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {docStats.expired > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                      {docStats.expired} Expired
                    </span>
                  )}
                  {docStats.expiringSoon > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                      {docStats.expiringSoon} Expiring Soon
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                    {docStats.valid} Valid
                  </span>
                  {docStats.notSet > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                      {docStats.notSet} Not Set
                    </span>
                  )}
                </div>
              </div>

              {/* Flat Tabs & Action Bar */}
              <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDocModalTab('update')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-colors",
                      docModalTab === 'update'
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    Edit Expiry Dates
                    {docChangesCount > 0 && (
                      <span className="ml-1.5 px-1 py-0.2 rounded text-[10px] font-extrabold bg-blue-600 text-white">
                        {docChangesCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocModalTab('history')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1",
                      docModalTab === 'history'
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <span>History</span>
                    <span className="px-1 py-0.2 rounded text-[10px] text-slate-500 font-semibold">
                      ({editingDocVehicle?.documents?._history?.length || 0})
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-52">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter documents..."
                      value={docModalSearch}
                      onChange={e => setDocModalSearch(e.target.value)}
                      className="w-full h-7 pl-7 pr-6 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                    {docModalSearch && (
                      <button
                        type="button"
                        onClick={() => setDocModalSearch('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {docModalTab === 'update' && (docStats.expired > 0 || docStats.expiringSoon > 0 || docStats.notSet > 0) && (
                    <button
                      type="button"
                      onClick={handleRenewAllExpired}
                      className="h-7 px-2.5 text-xs font-bold rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 flex items-center gap-1 shrink-0 transition-colors"
                      title="Set +1 Year renewal for all expired or missing documents"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Renew Overdue (+1Y)
                    </button>
                  )}
                </div>
              </div>

              {/* Flat Table Body */}
              <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-slate-900 max-h-[58vh]">
                {docModalTab === 'update' ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-2">Document</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-slate-400">Current Expiry</th>
                        <th className="px-3 py-2 text-center">Presets</th>
                        <th className="px-3 py-2">New Expiry Date</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDocTypesForModal.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                            No document types match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredDocTypesForModal.map(type => {
                          const originalDate = normalizeDate(editingDocVehicle?.documents?.[type.name] || '');
                          const currentDateVal = docFormValues[type.name] || '';
                          const isModified = originalDate !== currentDateVal;
                          const originalStatus = getDocStatusInfo(originalDate);

                          return (
                            <tr
                              key={type.id}
                              className={cn(
                                "transition-colors group",
                                isModified
                                  ? "bg-blue-50/40 dark:bg-blue-950/20"
                                  : originalStatus.status === 'expired'
                                  ? "bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              )}
                            >
                              {/* Document Name */}
                              <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                <div className="flex items-center gap-1.5">
                                  <span>{type.name}</span>
                                  {isModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" title="Modified" />
                                  )}
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="px-3 py-2.5">
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold inline-block border", originalStatus.badgeClass)}>
                                  {originalStatus.label}
                                </span>
                              </td>

                              {/* Current Recorded Expiry */}
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-medium">
                                {originalDate ? (
                                  <span className={originalStatus.status === 'expired' ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                                    {formatDisplayDate(originalDate)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 italic">Not set</span>
                                )}
                              </td>

                              {/* Quick Presets */}
                              <td className="px-3 py-2.5 text-center">
                                <div className="inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickRenew(type.name, 12)}
                                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Renew +1 Year"
                                  >
                                    +1Y
                                  </button>
                                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickRenew(type.name, 6)}
                                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Renew +6 Months"
                                  >
                                    +6M
                                  </button>
                                </div>
                              </td>

                              {/* Date Input */}
                              <td className="px-3 py-2.5">
                                <input
                                  type="date"
                                  value={currentDateVal}
                                  onChange={e => setDocFormValues(prev => ({ ...prev, [type.name]: e.target.value }))}
                                  className={cn(
                                    "h-7 px-2 text-xs font-semibold rounded border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-colors focus:outline-none focus:bg-white dark:focus:bg-slate-900",
                                    isModified
                                      ? "border-blue-500 ring-1 ring-blue-500/20 font-bold"
                                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                  )}
                                />
                              </td>

                              {/* Row Actions */}
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {currentDateVal && (
                                    <button
                                      type="button"
                                      onClick={() => handleClearDocDate(type.name)}
                                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors"
                                      title="Clear date"
                                    >
                                      Clear
                                    </button>
                                  )}
                                  {isModified && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetDocDate(type.name)}
                                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                                      title="Reset to original date"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  /* Flat History List */
                  <div className="p-4 space-y-2">
                    {vehicleDocHistory.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        <History className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                        <p>No document renewals logged yet for this vehicle.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-1.5 px-2">Document</th>
                            <th className="py-1.5 px-2">Previous Expiry</th>
                            <th className="py-1.5 px-2">New Expiry</th>
                            <th className="py-1.5 px-2 text-right">Updated At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {vehicleDocHistory.map((h, idx) => (
                            <tr key={h.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-2 font-bold text-slate-800 dark:text-slate-200">
                                {h.doc_type}
                              </td>
                              <td className="py-2 px-2 text-slate-500">
                                {h.previous_date ? formatDisplayDate(h.previous_date) : 'Not set'}
                              </td>
                              <td className="py-2 px-2 font-bold text-emerald-600 dark:text-emerald-400">
                                {h.new_date ? formatDisplayDate(h.new_date) : 'Cleared'}
                              </td>
                              <td className="py-2 px-2 text-right text-slate-400 font-mono text-[11px]">
                                {format(new Date(h.updated_at), 'dd/MM/yyyy HH:mm')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Flat Footer */}
              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {docChangesCount > 0 ? (
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {docChangesCount} document date{docChangesCount > 1 ? 's' : ''} modified
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No unsaved changes</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDocModal(false)}
                    className="h-8 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveAllDocs}
                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 px-4 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {filteredVehicles.length === 0 ? (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 p-10 text-center text-slate-400 text-sm italic">
              No vehicles found
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVehicles.map(v => (
                <Card key={v.id} className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">{v.name}</h4>
                      <p className="text-xs font-mono font-bold text-blue-600">{v.registration_number}</p>
                    </div>
                    {priv.canEditDocuments && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2" 
                          onClick={() => openDocModal(v, 'history')}>
                          <History className="h-3 w-3 mr-1" /> History
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 px-2" 
                          onClick={() => openDocModal(v, 'update')}>
                          Update
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-0">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {vehicleDocumentTypes.map(type => {
                          const date = v.documents?.[type.name];
                          const normalized = date ? normalizeDate(date) : null;
                          const dateValue = normalized ? new Date(normalized) : null;
                          const today = new Date();
                          const isExpired = dateValue && isBefore(dateValue, startOfDay(today));
                          const isExpiringThisMonth = dateValue && isSameMonth(dateValue, today);
                          const isExpiringSoon = isExpired || isExpiringThisMonth;
                          return (
                            <tr key={type.id} className={cn(
                              "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", 
                              isExpiringSoon && "bg-rose-50/50 dark:bg-rose-900/10"
                            )}>
                              <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{type.name}</td>
                              <td className="px-4 py-3 text-right">
                                {date ? (
                                  <span className={cn(
                                    "font-bold flex items-center justify-end gap-1.5", 
                                    isExpiringSoon ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                                  )}>
                                    {formatDisplayDate(date)}
                                    {isExpiringSoon && <AlertCircle className="h-3 w-3 text-rose-500 animate-pulse" />}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Not set</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'fuel' ? null : (
        <div className="space-y-6">
          {/* Sub-tab selection row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1 pb-2 border-b border-slate-100 dark:border-slate-800">
            {priv.canViewLogs && priv.canViewFuel && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <Button
                  variant={logsSubTab === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 text-[11px] font-bold uppercase tracking-wider px-3"
                  onClick={() => setLogsSubTab('all')}
                >
                  <History className="h-3.5 w-3.5 mr-1" /> All Activity
                </Button>
                <Button
                  variant={logsSubTab === 'movement' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 text-[11px] font-bold uppercase tracking-wider px-3"
                  onClick={() => setLogsSubTab('movement')}
                >
                  <MapPin className="h-3.5 w-3.5 mr-1 text-blue-500" /> Movements
                </Button>
                <Button
                  variant={logsSubTab === 'fuel' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 text-[11px] font-bold uppercase tracking-wider px-3"
                  onClick={() => setLogsSubTab('fuel')}
                >
                  <Fuel className="h-3.5 w-3.5 mr-1 text-amber-500" /> Fuel Logs
                </Button>
              </div>
            )}

            {/* List/Calendar Toggle (only when movements/all is selected) */}
            {logsSubTab !== 'fuel' && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <Button 
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                  size="sm" className="h-8 px-3 gap-2 text-[10px] font-bold uppercase"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-3.5 w-3.5" /> List
                </Button>
                <Button 
                  variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                  size="sm" className="h-8 px-3 gap-2 text-[10px] font-bold uppercase"
                  onClick={() => setViewMode('calendar')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendar
                </Button>
              </div>
            )}
          </div>

          {/* Render Calendar View for Movement Logs */}
          {logsSubTab !== 'fuel' && viewMode === 'calendar' ? (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">{format(currentMonth, 'MMMM yyyy')}</h4>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold uppercase" onClick={() => setCurrentMonth(new Date())}>
                      Today
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                     <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Site Visit</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b dark:border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase border-r last:border-r-0 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-[120px]">
                {calendarDays().map((day, idx) => {
                  const dayTrips = vehicleTrips.filter(t => isSameDay(new Date(t.departure_time), day));
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div key={idx} className={cn(
                      "border-r border-b dark:border-slate-800 p-2 relative group",
                      !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50",
                      isToday && "bg-blue-50/30 dark:bg-blue-900/10"
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold",
                        isToday ? "text-blue-600" : isCurrentMonth ? "text-slate-500" : "text-slate-300"
                      )}>
                        {format(day, 'd')}
                      </span>
                      
                      <div className="mt-1 space-y-1 overflow-y-auto max-h-[85px] scrollbar-hide">
                        {dayTrips.map(trip => (
                          <div 
                            key={trip.id} 
                            className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 p-1 rounded-sm cursor-pointer hover:bg-blue-100 transition-colors group/item"
                            onClick={() => handleEditTrip(trip)}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-[8px] font-bold text-blue-700 dark:text-blue-400 truncate leading-tight uppercase" title={trip.site_name}>
                                {trip.site_name}
                              </span>
                              <span className="text-[7px] text-slate-400 font-mono shrink-0">
                                {format(new Date(trip.departure_time), 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-[7px] text-slate-500 truncate leading-tight font-semibold" title={`${getVehicleName(trip.vehicle_reg)} (${trip.vehicle_reg}) - ${trip.driver_name}`}>
                              {getVehicleName(trip.vehicle_reg)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* Unified Desktop and Mobile Activity Feed */
            <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-4 justify-between items-center border-b dark:border-slate-800">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-500" /> 
                  {logsSubTab === 'all' && 'All Activity Logs'}
                  {logsSubTab === 'movement' && 'Movement Logs'}
                  {logsSubTab === 'fuel' && 'Fuel Logs'}
                  <span className="ml-1 text-[10px] font-normal text-slate-400">({filteredCombinedLogs.length} entries)</span>
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search logs by vehicle, person, site..." 
                    className="pl-9 h-9 text-sm" 
                    value={logsSearch} 
                    onChange={e => setLogsSearch(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Vehicle & Operator</th>
                      <th className="px-6 py-3">Details / Route</th>
                      <th className="px-6 py-3">Metrics / Cost</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCombinedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm italic">No records found</td>
                      </tr>
                    ) : (
                      filteredCombinedLogs.map(log => {
                        if (log.type === 'trip') {
                          const trip = log.details;
                          return (
                            <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                              <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {formatDisplayDate(trip.departure_time)}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200">
                                  Trip
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{getVehicleName(trip.vehicle_reg)}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">{trip.driver_name} <span className="text-slate-300 dark:text-slate-600 font-normal">({trip.vehicle_reg})</span></span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {trip.site_name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 italic">{trip.purpose}</span>
                                  {trip.remark && <span className="text-[9px] text-slate-400 max-w-[200px] truncate mt-0.5 block" title={trip.remark}>{trip.remark}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">Dep:</span> {new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                  <div className="flex items-center gap-1"><span className="text-slate-400 uppercase text-[8px]">Arr:</span> {trip.arrival_time ? new Date(trip.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</div>
                                  {trip.odometer_start && trip.odometer_end && (
                                    <div className="text-[9px] text-blue-500 mt-0.5">Total: {trip.odometer_end - trip.odometer_start} km</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      {priv.canEditLogs && (
                                        <DropdownMenuItem
                                          onClick={() => handleEditTrip(trip)}
                                          className="cursor-pointer flex items-center gap-2 text-xs font-semibold"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                          Edit Trip
                                        </DropdownMenuItem>
                                      )}
                                      {priv.canDeleteLogs && (
                                        <>
                                          {priv.canEditLogs && <DropdownMenuSeparator />}
                                          <DropdownMenuItem
                                            onClick={() => deleteVehicleTripRecord(trip.id)}
                                            className="cursor-pointer flex items-center gap-2 text-xs text-rose-600 font-semibold focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete Trip
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const fuelLog = log.details;
                          return (
                            <tr key={fuelLog.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                              <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {formatDisplayDate(fuelLog.date)}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200">
                                  Fuel
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{getVehicleName(fuelLog.vehicle_reg)}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">{fuelLog.filled_by || '—'} <span className="text-slate-300 dark:text-slate-600 font-normal">({fuelLog.vehicle_reg})</span></span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-amber-600 dark:text-amber-500 text-xs flex items-center gap-1">
                                    <Fuel className="h-3 w-3" /> {fuelLog.litres.toFixed(2)} Litres
                                  </span>
                                  <span className="text-[10px] text-slate-500">Rate: ₦{fuelLog.rate_per_litre.toLocaleString()}/L</span>
                                  {fuelLog.notes && <span className="text-[9px] text-slate-400 max-w-[200px] truncate mt-0.5 block" title={fuelLog.notes}>{fuelLog.notes}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col text-[10px] font-bold">
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    ₦{fuelLog.total_cost.toLocaleString()}
                                  </span>
                                  {fuelLog.odometer && (
                                    <span className="text-[8px] text-slate-400 mt-0.5">Odo: {fuelLog.odometer.toLocaleString()} km</span>
                                  )}
                                  {fuelLog.linkedLedgerIds && fuelLog.linkedLedgerIds.length > 0 && (
                                    <Badge variant="outline" className="text-[8px] h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 mt-1 w-fit gap-1 font-semibold">
                                      <LinkIcon className="h-2.5 w-2.5" /> Linked ({fuelLog.linkedLedgerIds.length})
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem
                                        onClick={() => handleOpenStandaloneLedgerDialog(fuelLog)}
                                        className="cursor-pointer flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                                      >
                                        <LinkIcon className="h-3.5 w-3.5" />
                                        Link Ledger
                                      </DropdownMenuItem>
                                      {priv.canEditFuel && (
                                        <DropdownMenuItem
                                          onClick={() => handleEditFuelLog(fuelLog)}
                                          className="cursor-pointer flex items-center gap-2 text-xs font-semibold"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                          Edit Log
                                        </DropdownMenuItem>
                                      )}
                                      {priv.canDeleteFuel && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => deleteVehicleFuelLog(fuelLog.id)}
                                            className="cursor-pointer flex items-center gap-2 text-xs text-rose-600 font-semibold focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete Log
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Cards */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCombinedLogs.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400 text-sm italic">No records found</div>
                ) : (
                  filteredCombinedLogs.map(log => {
                    if (log.type === 'trip') {
                      const trip = log.details;
                      return (
                        <div key={`m-trip-${trip.id}`} className="p-4 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{getVehicleName(trip.vehicle_reg)}</span>
                                <Badge variant="outline" className="text-[8px] h-4 font-bold bg-blue-50 text-blue-600 border-blue-200">Trip</Badge>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400">{trip.driver_name} <span className="text-slate-300 dark:text-slate-600 font-normal">({trip.vehicle_reg})</span></span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-blue-600 text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {trip.site_name}
                              </span>
                              <span className="text-[10px] text-slate-500 italic">{trip.purpose}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-medium">
                            <div>Dep: {new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            <div>Arr: {trip.arrival_time ? new Date(trip.arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</div>
                          </div>
                          {trip.odometer_start && trip.odometer_end && (
                            <div className="text-[10px] text-blue-500 font-bold">Distance: {trip.odometer_end - trip.odometer_start} km</div>
                          )}
                          {trip.remark && <p className="text-[10px] text-slate-400 italic mt-1">{trip.remark}</p>}
                          <div className="flex items-center justify-end gap-1 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-slate-600 dark:text-slate-300">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                  Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {priv.canEditLogs && (
                                  <DropdownMenuItem
                                    onClick={() => handleEditTrip(trip)}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Edit Trip
                                  </DropdownMenuItem>
                                )}
                                {priv.canDeleteLogs && (
                                  <>
                                    {priv.canEditLogs && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                      onClick={() => deleteVehicleTripRecord(trip.id)}
                                      className="cursor-pointer flex items-center gap-2 text-xs text-rose-600 font-semibold focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete Trip
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    } else {
                      const fuelLog = log.details;
                      return (
                        <div key={`m-fuel-${fuelLog.id}`} className="p-4 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{getVehicleName(fuelLog.vehicle_reg)}</span>
                                <Badge variant="outline" className="text-[8px] h-4 font-bold bg-amber-50 text-amber-700 border-amber-200">Fuel</Badge>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400">{fuelLog.filled_by || '—'} <span className="text-slate-300 dark:text-slate-600 font-normal">({fuelLog.vehicle_reg})</span></span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-amber-600">{fuelLog.litres.toFixed(2)} L</span>
                              <span className="text-xs font-bold text-emerald-600">₦{fuelLog.total_cost.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>Rate: ₦{fuelLog.rate_per_litre.toLocaleString()}/L</span>
                            {fuelLog.odometer && <span>Odo: {fuelLog.odometer.toLocaleString()} km</span>}
                          </div>
                          {fuelLog.notes && <p className="text-[10px] text-slate-400 italic mt-1">{fuelLog.notes}</p>}
                          <div className="flex items-center justify-between mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                            {fuelLog.linkedLedgerIds && fuelLog.linkedLedgerIds.length > 0 ? (
                              <Badge variant="outline" className="text-[8px] h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 gap-1 font-semibold">
                                <LinkIcon className="h-2.5 w-2.5" /> Linked ({fuelLog.linkedLedgerIds.length})
                              </Badge>
                            ) : <div />}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-slate-600 dark:text-slate-300">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                  Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleOpenStandaloneLedgerDialog(fuelLog)}
                                  className="cursor-pointer flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                                >
                                  <LinkIcon className="h-3.5 w-3.5" />
                                  Link Ledger
                                </DropdownMenuItem>
                                {priv.canEditFuel && (
                                  <DropdownMenuItem
                                    onClick={() => handleEditFuelLog(fuelLog)}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-semibold"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    Edit Log
                                  </DropdownMenuItem>
                                )}
                                {priv.canDeleteFuel && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => deleteVehicleFuelLog(fuelLog.id)}
                                      className="cursor-pointer flex items-center gap-2 text-xs text-rose-600 font-semibold focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete Log
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Fuel Analytics ── */}
      {activeTab === 'fuel' && priv.canViewFuelAnalytics && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: 'Total Litres', value: `${totalFuelLitres.toFixed(1)} L`, icon: Fuel, color: 'amber' },
              { label: 'Total Cost', value: `₦${totalFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'emerald' },
              { label: 'Avg Rate', value: `₦${avgRate.toFixed(0)}/L`, icon: BarChart3, color: 'blue' },
              { label: fuelFilterVehicle === '' ? 'Top Vehicle' : 'Vehicle Odo Span', value: fuelFilterVehicle === '' ? topVehicleName : efficiency ? `${efficiency.distance.toLocaleString()} km` : '\u2014', icon: Truck, color: 'blue' }
            ] as const).map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Efficiency Banner */}
          {(fuelFilterVehicle !== '' ? efficiency : fleetEfficiency) && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><TrendingUp className="h-4 w-4" /></div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {fuelFilterVehicle !== '' ? 'Vehicle Fuel Efficiency' : 'Fleet-Wide Fuel Efficiency'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Based on {(fuelFilterVehicle !== '' ? efficiency : fleetEfficiency)?.distance.toLocaleString()} km of logged travel
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{(fuelFilterVehicle !== '' ? efficiency : fleetEfficiency)?.kmPerLitre.toFixed(2)} km/L</p>
                  <p className="text-[8px] uppercase font-bold text-slate-400">km per Litre</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{(fuelFilterVehicle !== '' ? efficiency : fleetEfficiency)?.lPer100km.toFixed(2)} L/100km</p>
                  <p className="text-[8px] uppercase font-bold text-slate-400">Litres per 100km</p>
                </div>
              </div>
            </div>
          )}


            {/* Tabbed Analytics Charts */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden rounded-xl">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/20">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" /> 
                    {activeChartTab === 'litres' ? 'Fuel Consumed (Litres)' : activeChartTab === 'cost' ? 'Total Expenditures (₦)' : 'Average Fuel Rate (₦/L)'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {activeChartTab === 'litres' ? 'Track fuel quantities consumed across the fleet' : activeChartTab === 'cost' ? 'Monitor costs of refueling records' : 'Price fluctuations and rate per litre over time'}
                  </CardDescription>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 self-start sm:self-center">
                  <Button
                    variant={activeChartTab === 'litres' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-[11px] font-bold uppercase tracking-wider px-3 rounded-lg"
                    onClick={() => setActiveChartTab('litres')}
                  >
                    <Fuel className="h-3.5 w-3.5 mr-1 text-amber-500" /> Litres
                  </Button>
                  <Button
                    variant={activeChartTab === 'cost' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-[11px] font-bold uppercase tracking-wider px-3 rounded-lg"
                    onClick={() => setActiveChartTab('cost')}
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Cost
                  </Button>
                  <Button
                    variant={activeChartTab === 'trend' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-[11px] font-bold uppercase tracking-wider px-3 rounded-lg"
                    onClick={() => setActiveChartTab('trend')}
                  >
                    <BarChart3 className="h-3.5 w-3.5 mr-1 text-blue-500" /> Price Trend
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {chartData.length === 0 || (activeChartTab === 'litres' && chartData.every(d => d.litres === 0)) || (activeChartTab === 'cost' && chartData.every(d => d.cost === 0)) || (activeChartTab === 'trend' && chartData.every(d => d.rate === 0)) ? (
                  <div className="h-64 flex items-center justify-center text-sm text-slate-400 italic border border-dashed rounded-lg">No data available for this period</div>
                ) : (
                  <div className="w-full h-80 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeChartTab === 'litres' ? (
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="0%" barGap={0}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                          <Tooltip content={<CustomTooltip valType="litres" />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                          {fuelFilterVehicle !== '' ? (
                            <Bar dataKey="litres" name={getVehicleName(fuelFilterVehicle)} fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          ) : (
                            <>
                              {activeVehicleNames.map((name, idx) => (
                                <Bar
                                  key={name}
                                  dataKey={name}
                                  name={name}
                                  fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                                  radius={[0, 0, 0, 0]}
                                />
                              ))}
                              <Line type="monotone" dataKey="litres" name="Total Litres" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 5 }} />
                            </>
                          )}
                        </ComposedChart>
                      ) : activeChartTab === 'cost' ? (
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="0%" barGap={0}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(value) => `₦${(value/1000)}k`} />
                          <Tooltip content={<CustomTooltip valType="cost" />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                          {fuelFilterVehicle !== '' ? (
                            <Bar dataKey="cost" name={getVehicleName(fuelFilterVehicle)} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          ) : (
                            <>
                              {activeVehicleNames.map((name, idx) => (
                                <Bar
                                  key={name}
                                  dataKey={`${name}_cost`}
                                  name={name}
                                  fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                                  radius={[0, 0, 0, 0]}
                                />
                              ))}
                              <Line type="monotone" dataKey="cost" name="Total Cost" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 5 }} />
                            </>
                          )}
                        </ComposedChart>
                      ) : (
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} />
                          <Tooltip content={<CustomTooltip valType="trend" />} />
                          {fuelFilterVehicle !== '' ? (
                            <Line type="monotone" dataKey="rate" name={getVehicleName(fuelFilterVehicle)} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          ) : (
                            activeVehicleNames.map((name, idx) => (
                              <Line 
                                key={name} 
                                type="monotone" 
                                dataKey={`${name}_rate`} 
                                name={name} 
                                stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]} 
                                strokeWidth={2} 
                                dot={{ r: 3, strokeWidth: 1.5 }} 
                                activeDot={{ r: 5 }} 
                              />
                            ))
                          )}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Consuming Vehicles */}
            <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-500" /> Top Consuming Vehicles
                  <span className="ml-1 text-[10px] font-normal text-slate-400">(By Total Cost)</span>
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {topVehiclesData.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm italic">No vehicle data for this period</div>
                ) : (
                  topVehiclesData.map((v, i) => (
                    <div key={v.reg} className="flex items-center gap-4">
                      <div className="w-6 text-right text-xs font-bold text-slate-400">#{i + 1}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {getVehicleName(v.reg)} <span className="text-[10px] font-normal text-slate-400">({v.reg})</span>
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-600">₦{v.cost.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${Math.max((v.cost / maxTopVehicleCost) * 100, 2)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 text-right">{v.litres.toFixed(1)} L total</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
        </div>
      )}
    </div>
  </>
  );
}
