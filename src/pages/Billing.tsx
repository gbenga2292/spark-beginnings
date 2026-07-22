import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import InvoiceLogo from '../../logo/logo-2.png';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/src/components/task_ui/alert-dialog';
import { useAppStore, PendingInvoice, Invoice } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, ArrowRightCircle, Upload, Download, Mail, ChevronUp, ChevronDown, ChevronRight, Printer, PlusCircle, ArrowLeft, Save, FileText, Layers, Users, Settings, Truck, Info, Calculator } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useSetPageTitle, useHideLayout } from '@/src/contexts/PageContext';
import { generateId, cn } from '@/src/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/src/components/ui/dropdown-menu';
import { NumericFormat } from 'react-number-format';
import { supabase } from '@/src/integrations/supabase/client';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { fetchInvoicesData } from '@/src/lib/supabaseService';
import { useOperations } from '@/src/contexts/OperationsContext';


export function Billing({ searchTerm = '', setFullPageContent }: { searchTerm?: string; setFullPageContent?: (content: React.ReactNode) => void }) {
  const sites = useAppStore((state) => state.sites);
  const pendingSites = useAppStore((state) => state.pendingSites);
  const pendingInvoices = useAppStore((state) => state.pendingInvoices);
  const invoices = useAppStore((state) => state.invoices);
  const addPendingInvoice = useAppStore(state => state.addPendingInvoice);
  const updatePendingInvoice = useAppStore(state => state.updatePendingInvoice);
  const deletePendingInvoice = useAppStore(state => state.deletePendingInvoice);
  const addInvoice = useAppStore(state => state.addInvoice);
  const updateInvoice = useAppStore(state => state.updateInvoice);
  const deleteInvoice = useAppStore(state => state.deleteInvoice);
  const vatRate = useAppStore(state => state.payrollVariables.vatRate);

  const handleSyncInvoiceDates = async (invoiceId: string, newEndDate: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    
    const updated = {
      ...inv,
      dueDate: newEndDate,
      endDate: newEndDate, 
    };
    
    updateInvoice(invoiceId, updated);
    toast.success(`Updated invoice ${inv.invoiceNumber} end date to ${formatDisplayDate(newEndDate)}`);
  };

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('billing');
  const { addReminder, updateReminder, reminders } = useAppData();
  const { user: currentUser } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quotations' | 'all' | 'active' | 'unpaid' | 'completed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const payments = useAppStore(state => state.payments);
  const ledgerBanks = useAppStore(state => state.ledgerBanks);
  const ledgerBeneficiaryBanks = useAppStore(state => state.ledgerBeneficiaryBanks);
  const { dailyMachineLogs } = useOperations();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printInvoiceTarget, setPrintInvoiceTarget] = useState<Invoice | PendingInvoice | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterFromMonth, setFilterFromMonth] = useState<string>('');
  const [filterToMonth, setFilterToMonth] = useState<string>('');
  const [showActions, setShowActions] = useState(false);
  const [nextInvoiceDialog, setNextInvoiceDialog] = useState(false);
  const [nextInvoiceSource, setNextInvoiceSource] = useState<Invoice | null>(null);
  const [selectedNextMachines, setSelectedNextMachines] = useState<number[]>([]);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  React.useEffect(() => {
    if (invoices.length === 0 && pendingInvoices.length === 0) {
      fetchInvoicesData()
        .then((data) => {
          useAppStore.setState(data);
        })
        .catch((err) => {
          console.error('[Billing] Failed to load invoices:', err);
        });
    }
  }, [invoices.length, pendingInvoices.length]);


  // ── Master Site Registry ────────────────────────────────────
  const siteRegistry = useMemo(() => {
    const list = [
      ...sites.map(s => ({ 
        type: 'Active', 
        name: (s.name || '').trim(), 
        client: (s.client || '').trim(), 
        vat: (s.vat || 'No') as 'Yes' | 'No' | 'Add'
      })),
      ...pendingSites.map(ps => ({ 
        type: 'Pending', 
        name: (ps.siteName || '').trim(), 
        client: (ps.clientName || '').trim(), 
        vat: (ps.phase4?.clientTaxStatus?.includes('Add') ? 'Add' : 
             ps.phase4?.clientTaxStatus?.includes('Yes') ? 'Yes' : 'No') as 'Yes'|'No'|'Add'
      }))
    ];
    return list.filter(item => item.name && item.client);
  }, [sites, pendingSites]);


  const initialForm = {
    destination: 'Active' as 'Pending' | 'Active',
    startDate: '',
    duration: '',
    invoiceNo: '',
    client: '',
    site: '',
    noOfMachine: '',
    dailyRentalCost: '',
    noOfTechnician: '',
    techniciansDailyRate: '', // = Day Rate (existing field, backwards compatible)
    technicianNightFee: '',   // UI-only until DB migration
    technicianAccommodation: '', // UI-only until DB migration
    technicianDuration: '',
    technicianDurationSameAsMachine: true,
    technicianNightDuration: '',
    technicianNightDurationSameAsMachine: true,
    noOfTechnicianNight: '',
    technicianNightCountSameAsDay: true,
    technicianAccommodationUseNightCount: false,
    dieselCostPerLtr: '',
    dailyUsage: '',
    mobDemob: '',
    installation: '',
    damages: '',
    createReminder: true,
    sendEmailNotification: true,
    vatInc: 'No' as 'Yes' | 'No' | 'Add',
    countOffDays: true,
  };
  const [form, setForm] = useState(initialForm);

  // ── Per-machine rate/duration configs ──────────────────────────
  type MachineRow = { rate: string; duration: string; sameRateAsFirst: boolean; sameDurationAsFirst: boolean };
  const [machineConfigs, setMachineConfigs] = useState<MachineRow[]>([]);

  // Keep machineConfigs in sync with noOfMachine changes
  const handleNoOfMachineChange = (val: string) => {
    handleChange('noOfMachine', val);
    const n = parseInt(val) || 0;
    setMachineConfigs(prev => {
      const next: MachineRow[] = [];
      for (let i = 0; i < n; i++) {
        if (prev[i]) {
          next.push(prev[i]);
        } else {
          // Default new rows to same as first if first exists
          next.push({ rate: prev[0]?.rate ?? '', duration: prev[0]?.duration ?? '', sameRateAsFirst: i > 0, sameDurationAsFirst: i > 0 });
        }
      }
      return next;
    });
  };

  const handleMachineRowChange = (idx: number, field: 'rate' | 'duration', val: string) => {
    setMachineConfigs(prev => {
      const next = prev.map((r, i) => {
        if (i === idx) return { ...r, [field]: val };
        // If a sibling row is same as first and we just changed row 0, mirror it
        if (idx === 0) {
          if (field === 'rate' && r.sameRateAsFirst) return { ...r, rate: val };
          if (field === 'duration' && r.sameDurationAsFirst) return { ...r, duration: val };
        }
        return r;
      });
      return next;
    });
  };

  const handleMachineSameToggle = (idx: number, field: 'rate' | 'duration', checked: boolean) => {
    setMachineConfigs(prev => {
      const first = prev[0];
      return prev.map((r, i) => {
        if (i !== idx) return r;
        if (field === 'rate') {
          return checked ? { ...r, sameRateAsFirst: true, rate: first?.rate ?? '' } : { ...r, sameRateAsFirst: false };
        } else {
          return checked ? { ...r, sameDurationAsFirst: true, duration: first?.duration ?? '' } : { ...r, sameDurationAsFirst: false };
        }
      });
    });
  };

  const uniqueClients = useMemo(() => {
    const clients = new Set(siteRegistry.map(s => s.client));
    if (form.client && !clients.has(form.client)) {
      clients.add(form.client);
    }
    return Array.from(clients).sort();
  }, [siteRegistry, form.client]);

  const sitesBySelectedClient = useMemo(() => {
    const matches = siteRegistry.filter(s => s.client === form.client).map(s => ({ name: s.name, type: s.type }));
    if (form.site && !matches.some(m => m.name === form.site)) {
      matches.push({ name: form.site, type: 'N/A' });
    }
    // De-duplicate by name
    const seen = new Set();
    return matches.filter(m => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [siteRegistry, form.client, form.site]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleClear = () => {
    setForm(initialForm);
    setMachineConfigs([]);
    setSelectedId(null);
  };

  const livePreview = useMemo(() => {
    const noOfMachine = parseInt(form.noOfMachine) || 0;
    const noOfTechnician = parseFloat(form.noOfTechnician) || 0;
    const techDayFee = parseFloat(form.techniciansDailyRate) || 0;
    const techNightFee = parseFloat(form.technicianNightFee) || 0;
    const techAccommodation = parseFloat(form.technicianAccommodation) || 0;
    // Effective daily rate = day fee + night fee + accommodation
    const effectiveTechDailyRate = techDayFee + techNightFee + techAccommodation;
    const dieselCostPerLtr = parseFloat(form.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(form.dailyUsage) || 0;
    const mobDemob = parseFloat(form.mobDemob) || 0;
    const installation = parseFloat(form.installation) || 0;
    const damages = parseFloat(form.damages) || 0;

    // Max duration across all machine rows — used for technicians, diesel, end-date
    const maxDuration = machineConfigs.length > 0
      ? Math.max(...machineConfigs.map(r => parseFloat(r.duration) || 0))
      : 0;

    // Rental cost = sum of (rate × duration) per machine
    const rentalCost = machineConfigs.reduce((sum, row) => {
      return sum + (parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0);
    }, 0);

    const actualTechDuration = form.technicianDurationSameAsMachine ? maxDuration : (parseFloat(form.technicianDuration) || 0);
    const actualNightDuration = form.technicianNightDurationSameAsMachine ? maxDuration : (parseFloat(form.technicianNightDuration) || 0);

    const dieselCost = machineConfigs.length > 0
      ? machineConfigs.reduce((sum, row) => sum + dailyUsage * dieselCostPerLtr * (parseFloat(row.duration) || 0), 0)
      : noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;

    // Separate night count logic (backwards compatible: undefined = same as day)
    const noOfTechnicianNight = form.technicianNightCountSameAsDay ? noOfTechnician : (parseFloat(form.noOfTechnicianNight) || 0);
    // Accommodation crew basis: use night crew if toggled, otherwise day crew
    const accomCrewCount = form.technicianAccommodationUseNightCount ? noOfTechnicianNight : noOfTechnician;

    // Calculate technicians cost separately for day, night, and accommodation
    const techDayCost = noOfTechnician * techDayFee * actualTechDuration;
    const techNightCost = noOfTechnicianNight * techNightFee * actualNightDuration;
    const techAccomCost = accomCrewCount * techAccommodation * actualTechDuration;
    const techniciansCost = techDayCost + techNightCost + techAccomCost;

    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;
    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    let siteRecord = siteRegistry.find(s => s.name === form.site && s.client === form.client);
    if (!siteRecord) {
      siteRecord = siteRegistry.find(s => s.name === form.client && s.client === form.site);
    }
    const vatInc = siteRecord ? siteRecord.vat : 'No';

    let vat = 0;
    if (vatInc === 'Yes') {
      vat = (totalCost / (100 + vatRate)) * vatRate;
    } else if (vatInc === 'Add') {
      vat = totalCost * (vatRate / 100);
    }

    let totalCharge = totalCost;
    if (vatInc === 'Add') {
      totalCharge = totalCost + vat;
    }

    return { totalCost, vat, totalCharge, vatInc, maxDuration, actualTechDuration, actualNightDuration, techniciansCost, effectiveTechDailyRate, noOfTechnicianNight, accomCrewCount, dieselCost, rentalCost, mobDemob, installation, damages };
  }, [form, machineConfigs, siteRegistry, vatRate]);

  const calculateFullInvoiceData = (input: any, configs?: { rate: string; duration: string }[]) => {
    const noOfMachine = parseInt(input.noOfMachine) || 0;
    const noOfTechnician = parseFloat(input.noOfTechnician) || 0;
    // Compute effective daily rate from day fee + night fee + accommodation
    const techDayFee = parseFloat(input.techniciansDailyRate) || 0;
    const techNightFee = parseFloat(input.technicianNightFee) || 0;
    const techAccommodation = parseFloat(input.technicianAccommodation) || 0;
    const techniciansDailyRate = techDayFee;
    const dieselCostPerLtr = parseFloat(input.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(input.dailyUsage) || 0;
    const mobDemob = parseFloat(input.mobDemob) || 0;
    const installation = parseFloat(input.installation) || 0;
    const damages = parseFloat(input.damages) || 0;

    const activeCfgs = configs && configs.length > 0 ? configs : null;

    // Max duration drives end-date, technicians, and diesel
    const maxDuration = activeCfgs
      ? Math.max(...activeCfgs.map(r => parseFloat(r.duration) || 0))
      : (parseFloat(input.duration) || 0);

    const isTechSame = input.technicianDurationSameAsMachine ?? true;
    const actualTechDuration = isTechSame ? maxDuration : (parseFloat(input.technicianDuration) || 0);

    const siteName = (input.site || input.siteName || '').trim();
    const clientName = (input.client || '').trim();

    let siteObj = siteRegistry.find(s => s.name === siteName && s.client === clientName);
    if (!siteObj) {
      siteObj = siteRegistry.find(s => s.name === clientName && s.client === siteName);
    }
    const realSite = sites.find(s => s.name === siteName && s.client === clientName) || sites.find(s => s.name === clientName && s.client === siteName);
    const siteId = realSite?.id;

    let startDate = normalizeDate(input.startDate || input.date);
    let endDate = '';
    if (startDate && maxDuration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        if (input.countOffDays === false && siteId) {
          // Pre-index dailyMachineLogs by date for O(1) loop retrieval
          const logsByDate = new Map<string, typeof dailyMachineLogs>();
          for (let i = 0; i < dailyMachineLogs.length; i++) {
            const log = dailyMachineLogs[i];
            if (log.siteId === siteId && log.date) {
              if (!logsByDate.has(log.date)) {
                logsByDate.set(log.date, []);
              }
              logsByDate.get(log.date)!.push(log);
            }
          }

          let daysCounted = 0;
          let currentDate = new Date(start);
          const linkedAssets = input.linkedAssetIds || [];

          while (daysCounted < maxDuration) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const logsForDate = logsByDate.get(dateStr) || [];
            
            let dayContribution = 1.0;
            if (logsForDate.length > 0) {
              const relevantLogs = linkedAssets && linkedAssets.length > 0 
                ? logsForDate.filter(l => linkedAssets.includes(l.assetId))
                : logsForDate;
              
              if (relevantLogs.length > 0) {
                const contributions = relevantLogs.map(l => {
                  const status = l.operationalDay ?? (l.isActive ? 'full' : 'none');
                  if (status === 'full') return 1.0;
                  if (status === 'half') return 0.5;
                  return 0.0;
                });
                dayContribution = Math.min(...contributions);
              }
            }

            daysCounted += dayContribution;
            if (daysCounted < maxDuration) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
          endDate = currentDate.toISOString().split('T')[0];
        } else {
          start.setDate(start.getDate() + maxDuration - 1);
          endDate = start.toISOString().split('T')[0];
        }
      }
    } else if (input.endDate || input.dueDate) {
      endDate = normalizeDate(input.endDate || input.dueDate);
    }

    // Rental cost = sum of (rate × duration) per machine
    const rentalCost = activeCfgs
      ? activeCfgs.reduce((sum, row) => sum + (parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0), 0)
      : (parseInt(input.noOfMachine) || 0) * (parseFloat(input.dailyRentalCost) || 0) * maxDuration;

    const isNightSame = input.technicianNightDurationSameAsMachine ?? true;
    const actualNightDuration = isNightSame ? maxDuration : (parseFloat(input.technicianNightDuration) || 0);

    const dieselCost = activeCfgs
      ? activeCfgs.reduce((sum, row) => sum + dailyUsage * dieselCostPerLtr * (parseFloat(row.duration) || 0), 0)
      : noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;

    // Separate night count logic (backwards compatible: undefined = same as day)
    const isNightCountSame = input.technicianNightCountSameAsDay ?? true;
    const noOfTechnicianNight = isNightCountSame ? noOfTechnician : (parseFloat(input.noOfTechnicianNight) || 0);
    // Accommodation crew basis: use night crew if toggled, otherwise day crew
    const useNightForAccom = input.technicianAccommodationUseNightCount ?? false;
    const accomCrewCount = useNightForAccom ? noOfTechnicianNight : noOfTechnician;

    // Calculate technicians cost separately for day, night, and accommodation
    const techDayCost = noOfTechnician * techDayFee * actualTechDuration;
    const techNightCost = noOfTechnicianNight * techNightFee * actualNightDuration;
    const techAccomCost = accomCrewCount * techAccommodation * actualTechDuration;
    const techniciansCost = techDayCost + techNightCost + techAccomCost;

    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;
    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    const vatInc = siteObj ? siteObj.vat : (input.vatInc || 'No');

    let vat = 0;
    if (vatInc === 'Yes') {
      vat = (totalCost / (100 + vatRate)) * vatRate;
    } else if (vatInc === 'Add') {
      vat = totalCost * (vatRate / 100);
    }

    let totalCharge = totalCost;
    if (vatInc === 'Add') {
      totalCharge = totalCost + vat;
    }

    const machineConfigsOut = activeCfgs
      ? activeCfgs.map(r => ({ qt: 1, rate: parseFloat(r.rate) || 0, duration: parseFloat(r.duration) || 0 }))
      : undefined;

    return {
      duration: maxDuration, noOfMachine,
      dailyRentalCost: parseFloat(input.dailyRentalCost) || 0,
      noOfTechnician, techniciansDailyRate,
      dieselCostPerLtr, dailyUsage, mobDemob, installation, damages,
      startDate, endDate, rentalCost, dieselCost, techniciansCost,
      totalCost, vat, totalCharge, vatInc,
      totalExclusiveOfVat: totalCharge - vat,
      invoiceNo: input.invoiceNo || input.invoiceNumber || '',
      client: clientName, site: siteName,
      machineConfigs: machineConfigsOut,
      countOffDays: input.countOffDays ?? true,
      technicianDuration: isTechSame ? undefined : (parseFloat(input.technicianDuration) || 0),
      technicianDurationSameAsMachine: isTechSame,
      technicianNightFee: techNightFee,
      technicianAccommodation: techAccommodation,
      technicianNightDuration: isNightSame ? undefined : (parseFloat(input.technicianNightDuration) || 0),
      technicianNightDurationSameAsMachine: isNightSame,
      noOfTechnicianNight: isNightCountSame ? undefined : noOfTechnicianNight,
      technicianNightCountSameAsDay: isNightCountSame,
      technicianAccommodationUseNightCount: useNightForAccom,
    };
  };

  const calculateInvoice = (): Omit<PendingInvoice, 'id'> | null => {
    if (!form.invoiceNo || !form.client || !form.site) {
      toast.error('Invoice Number, Client, and Site are required');
      return null;
    }
    const data = calculateFullInvoiceData(form, machineConfigs.length > 0 ? machineConfigs : undefined);
    return {
      id: '', // Placeholder
      ...data
    } as any;
  };

  const handleSubmit = () => {
    const data = calculateInvoice();
    if (!data) return;

    // Determine where the record currently lives (if editing)
    const existingInActive = selectedId ? invoices.find(i => i.id === selectedId) : null;
    const existingInPending = selectedId ? pendingInvoices.find(i => i.id === selectedId) : null;
    const movingFromActiveToQuotation = !!existingInActive && form.destination === 'Pending';
    const movingFromQuotationToActive = !!existingInPending && form.destination === 'Active';

    let invoiceIdToUse = '';

    if (form.destination === 'Active') {
      const newInvoiceId = selectedId && !movingFromQuotationToActive ? selectedId : generateId();
      invoiceIdToUse = newInvoiceId;
      const newInvoice: Invoice = {
        id: newInvoiceId,
        invoiceNumber: data.invoiceNo,
        client: data.client,
        project: 'Billed',
        siteId: sites.find(s => s.name === data.site)?.id || '',
        siteName: data.site,
        amount: data.totalCharge,
        date: data.startDate,
        dueDate: data.endDate || data.startDate,
        billingCycle: 'Custom',
        reminderDate: '',
        status: 'Sent',
        vatInc: data.vatInc,
        noOfMachine: data.noOfMachine,
        dailyRentalCost: data.dailyRentalCost,
        dieselCostPerLtr: data.dieselCostPerLtr,
        dailyUsage: data.dailyUsage,
        noOfTechnician: data.noOfTechnician,
        techniciansDailyRate: data.techniciansDailyRate,
        mobDemob: data.mobDemob,
        installation: data.installation,
        damages: data.damages,
        duration: data.duration,
        rentalCost: data.rentalCost,
        dieselCost: data.dieselCost,
        techniciansCost: data.techniciansCost,
        totalCost: data.totalCost,
        vat: data.vat,
        totalCharge: data.totalCharge,
        totalExclusiveOfVat: data.totalExclusiveOfVat,
        machineConfigs: data.machineConfigs,
        countOffDays: data.countOffDays,
        technicianDuration: data.technicianDuration,
        technicianDurationSameAsMachine: data.technicianDurationSameAsMachine,
        technicianNightFee: data.technicianNightFee,
        technicianAccommodation: data.technicianAccommodation,
        technicianNightDuration: data.technicianNightDuration,
        technicianNightDurationSameAsMachine: data.technicianNightDurationSameAsMachine,
        noOfTechnicianNight: data.noOfTechnicianNight,
        technicianNightCountSameAsDay: data.technicianNightCountSameAsDay,
        technicianAccommodationUseNightCount: data.technicianAccommodationUseNightCount,
      };

      if (movingFromQuotationToActive) {
        // Move: remove from pending, add to active
        deletePendingInvoice(selectedId!);
        addInvoice(newInvoice);
        toast.success('Moved to Active Invoices');
      } else if (selectedId && existingInActive) {
        // Edit in-place in active
        updateInvoice(selectedId, newInvoice);
        toast.success('Active Invoice updated successfully');
      } else {
        addInvoice(newInvoice);
        toast.success('Active Invoice created successfully');
      }

    } else {
      // Destination is Pending/Quotation
      const pendingId = selectedId && !movingFromActiveToQuotation ? selectedId : generateId();
      invoiceIdToUse = pendingId;
      const pendingData = { ...data, id: pendingId } as any;

      if (movingFromActiveToQuotation) {
        // Move: remove from active, add to pending
        deleteInvoice(selectedId!);
        addPendingInvoice({ ...pendingData, id: generateId() });
        toast.success('Moved to Quotations');
      } else if (selectedId && existingInPending) {
        // Edit in-place in pending
        updatePendingInvoice(selectedId, pendingData);
        toast.success('Quotation updated successfully');
      } else {
        addPendingInvoice({ ...data, id: generateId() });
        toast.success('Quotation created successfully');
      }
    }

    if (currentUser && data.endDate) {
      const existingReminder = reminders?.find(r => 
        (r.sourceRef === 'invoice_' + invoiceIdToUse) || 
        (selectedId && r.title.includes(`[Invoice]`) && r.body.includes(`Invoice ${form.invoiceNo} `))
      );

      if (form.createReminder || existingReminder) {
        // Actual end date (log-adjusted if countOffDays=false)
        const actualEndDate = new Date(data.endDate);

        const isCountingOffDays = data.countOffDays !== false;
        const endDateLabel = isCountingOffDays ? 'projected end date' : 'actual end date (off-days excluded)';

        const title = `[Invoice] ${form.client} – ${form.site} ending soon`;
        const body = `Invoice ${form.invoiceNo} reaches its ${endDateLabel} on ${actualEndDate.toLocaleDateString()}. Confirm with the client to extend or prepare the next invoice.`;

        if (existingReminder) {
          updateReminder(existingReminder.id, {
            title,
            body,
            remindAt: actualEndDate.toISOString(),
            endAt: actualEndDate.toISOString(),
            sourceRef: 'invoice_' + invoiceIdToUse
          });
        } else if (form.createReminder) {
          addReminder({
            title,
            body,
            remindAt: actualEndDate.toISOString(),
            endAt: actualEndDate.toISOString(),
            frequency: 'daily',
            recipientIds: [currentUser.id],
            sendEmail: !!form.sendEmailNotification,
            isActive: true,
            createdBy: currentUser.id,
            sourceRef: 'invoice_' + invoiceIdToUse
          });
        }
      }
    }

    setIsModalOpen(false);
    handleClear();
  };

  const handleEdit = (inv: PendingInvoice | Invoice) => {
    setSelectedId(inv.id);
    const noOfMachine = 'noOfMachine' in inv ? String(inv.noOfMachine ?? 0) : '0';
    setForm({
      ...initialForm,
      vatInc: inv.vatInc || 'No',
      destination: activeTab === 'quotations' ? 'Pending' : 'Active',
      startDate: 'startDate' in inv ? inv.startDate : inv.date,
      duration: 'duration' in inv ? String(inv.duration ?? 0) : '0',
      invoiceNo: 'invoiceNo' in inv ? inv.invoiceNo : inv.invoiceNumber,
      client: (inv.client || '').trim(),
      site: (('site' in inv ? inv.site : inv.siteName) || '').trim(),
      noOfMachine,
      dailyRentalCost: 'dailyRentalCost' in inv ? String(inv.dailyRentalCost ?? 0) : '0',
      noOfTechnician: 'noOfTechnician' in inv ? String(inv.noOfTechnician ?? 0) : '0',
      // Existing records: techniciansDailyRate = full rate (treated as Day Fee, night fee/accommodation = 0)
      techniciansDailyRate: 'techniciansDailyRate' in inv ? String(inv.techniciansDailyRate ?? 0) : '0',
      technicianNightFee: 'technicianNightFee' in inv ? String(inv.technicianNightFee ?? '') : '',
      technicianAccommodation: 'technicianAccommodation' in inv ? String(inv.technicianAccommodation ?? '') : '',
      technicianNightDuration: 'technicianNightDuration' in inv ? String(inv.technicianNightDuration ?? '') : '',
      technicianNightDurationSameAsMachine: 'technicianNightDurationSameAsMachine' in inv ? (inv.technicianNightDurationSameAsMachine ?? true) : true,
      noOfTechnicianNight: 'noOfTechnicianNight' in inv ? String(inv.noOfTechnicianNight ?? '') : '',
      technicianNightCountSameAsDay: 'technicianNightCountSameAsDay' in inv ? (inv.technicianNightCountSameAsDay ?? true) : true,
      technicianAccommodationUseNightCount: 'technicianAccommodationUseNightCount' in inv ? (inv.technicianAccommodationUseNightCount ?? false) : false,
      technicianDuration: 'technicianDuration' in inv ? String(inv.technicianDuration ?? 0) : '0',
      technicianDurationSameAsMachine: 'technicianDurationSameAsMachine' in inv ? (inv.technicianDurationSameAsMachine ?? true) : true,
      dieselCostPerLtr: 'dieselCostPerLtr' in inv ? String(inv.dieselCostPerLtr ?? 0) : '0',
      dailyUsage: 'dailyUsage' in inv ? String(inv.dailyUsage ?? 0) : '0',
      mobDemob: 'mobDemob' in inv ? String(inv.mobDemob ?? 0) : '0',
      installation: 'installation' in inv ? String(inv.installation ?? 0) : '0',
      damages: 'damages' in inv ? String(inv.damages ?? 0) : '0',
      countOffDays: 'countOffDays' in inv ? (inv.countOffDays ?? true) : true,
      createReminder: false,
      sendEmailNotification: true,
    });
    // Restore per-machine configs if saved, or generate defaults from flat fields
    if (inv.machineConfigs && inv.machineConfigs.length > 0) {
      setMachineConfigs(
        inv.machineConfigs.map((c, i) => ({
          rate: String(c.rate),
          duration: String(c.duration),
          sameRateAsFirst: i > 0 && c.rate === inv.machineConfigs![0].rate,
          sameDurationAsFirst: i > 0 && c.duration === inv.machineConfigs![0].duration,
        }))
      );
    } else {
      const n = parseInt(noOfMachine) || 0;
      const rate = 'dailyRentalCost' in inv ? String(inv.dailyRentalCost ?? '') : '';
      const dur = 'duration' in inv ? String(inv.duration ?? '') : '';
      setMachineConfigs(
        Array.from({ length: n }, (_, i) => ({ rate, duration: dur, sameRateAsFirst: i > 0, sameDurationAsFirst: i > 0 }))
      );
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, removeOnly: boolean = false) => {
    if (!removeOnly) {
      const ok = await showConfirm('Are you sure you want to delete this invoice?', { variant: 'danger' });
      if (!ok) return;
    }

    if (activeTab === 'all' || activeTab === 'active') {
      deleteInvoice(id);
    } else if (activeTab === 'quotations') {
      deletePendingInvoice(id);
    }
    if (selectedId === id) handleClear();
    if (!removeOnly) toast.success('Invoice deleted');
  };

  const handleMakeActive = async (inv: PendingInvoice) => {
    const ok = await showConfirm('Do you want to add this to the Active Invoices?', { confirmLabel: "Yes", cancelLabel: "No" });
    if (ok) {
      addInvoice({
        id: generateId(),
        invoiceNumber: inv.invoiceNo,
        client: inv.client,
        project: 'Billed',
        siteId: sites.find(s => s.name === inv.site)?.id || '',
        siteName: inv.site,
        amount: inv.totalCharge,
        date: inv.startDate,
        dueDate: inv.endDate || inv.startDate,
        billingCycle: 'Custom',
        reminderDate: '',
        status: 'Sent',
        vatInc: inv.vatInc,
        noOfMachine: inv.noOfMachine,
        dailyRentalCost: inv.dailyRentalCost,
        dieselCostPerLtr: inv.dieselCostPerLtr,
        dailyUsage: inv.dailyUsage,
        noOfTechnician: inv.noOfTechnician,
        techniciansDailyRate: inv.techniciansDailyRate,
        mobDemob: inv.mobDemob,
        installation: inv.installation,
        damages: inv.damages,
        duration: inv.duration,
        rentalCost: inv.rentalCost,
        dieselCost: inv.dieselCost,
        techniciansCost: inv.techniciansCost,
        totalCost: inv.totalCost,
        vat: inv.vat,
        totalCharge: inv.totalCharge,
        totalExclusiveOfVat: inv.totalExclusiveOfVat,
        technicianDuration: inv.technicianDuration,
        technicianDurationSameAsMachine: inv.technicianDurationSameAsMachine,
        technicianNightFee: inv.technicianNightFee,
        technicianAccommodation: inv.technicianAccommodation,
        technicianNightDuration: inv.technicianNightDuration,
        technicianNightDurationSameAsMachine: inv.technicianNightDurationSameAsMachine,
        noOfTechnicianNight: inv.noOfTechnicianNight,
        technicianNightCountSameAsDay: inv.technicianNightCountSameAsDay,
        technicianAccommodationUseNightCount: inv.technicianAccommodationUseNightCount,
      });
      deletePendingInvoice(inv.id);
      if (selectedId === inv.id) handleClear();
      toast.success('Moved to Active Invoices');
      setActiveTab('all');
    }
  };

  const handleGenerateNext = (inv: Invoice) => {
    const num = inv.noOfMachine || 0;
    if (num > 1) {
      setNextInvoiceSource(inv);
      setSelectedNextMachines(Array.from({ length: num }, (_, i) => i));
      setNextInvoiceDialog(true);
    } else {
      prepareNextInvoice(inv, [0]);
    }
  };

  const prepareNextInvoice = (inv: Invoice, machineIndices: number[]) => {
    handleClear();
    
    // Calculate start date: previous end date (dueDate) + 1 day
    let nextStart = '';
    const prevEnd = inv.dueDate || inv.date;
    if (prevEnd) {
      const d = new Date(prevEnd);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        nextStart = d.toISOString().split('T')[0];
      }
    }

    const client = (inv.client || '').trim();
    const site = (inv.siteName || '').trim();
    const siteObj = siteRegistry.find(s => s.name === site && s.client === client);

    setForm({
      ...initialForm,
      destination: 'Active',
      startDate: nextStart,
      client,
      site,
      vatInc: siteObj ? siteObj.vat : (inv.vatInc || 'No'),
      noOfMachine: String(machineIndices.length),
      noOfTechnician: String(inv.noOfTechnician || 0),
      techniciansDailyRate: String(inv.techniciansDailyRate || 0),
      technicianDuration: String(inv.technicianDuration || 0),
      technicianDurationSameAsMachine: inv.technicianDurationSameAsMachine ?? true,
      technicianNightFee: String(inv.technicianNightFee || 0),
      technicianAccommodation: String(inv.technicianAccommodation || 0),
      technicianNightDuration: String(inv.technicianNightDuration || 0),
      technicianNightDurationSameAsMachine: inv.technicianNightDurationSameAsMachine ?? true,
      noOfTechnicianNight: String(inv.noOfTechnicianNight || ''),
      technicianNightCountSameAsDay: inv.technicianNightCountSameAsDay ?? true,
      technicianAccommodationUseNightCount: inv.technicianAccommodationUseNightCount ?? false,
      dieselCostPerLtr: String(inv.dieselCostPerLtr || 0),
      dailyUsage: String(inv.dailyUsage || 0),
      mobDemob: '0', // Usually mob/demob is one-time, but user can re-input
      installation: '0',
      damages: '0',
      countOffDays: inv.countOffDays ?? true,
      createReminder: true,
      sendEmailNotification: true,
    });

    // Handle machine configs
    if (inv.machineConfigs && inv.machineConfigs.length > 0) {
      const firstRate = inv.machineConfigs[0].rate;
      const firstDur = inv.machineConfigs[0].duration;
      
      const newConfigs = machineIndices.map((idx, i) => {
        const source = inv.machineConfigs![idx];
        return {
          rate: String(source?.rate ?? firstRate ?? 0),
          duration: String(source?.duration ?? firstDur ?? 0),
          sameRateAsFirst: i > 0,
          sameDurationAsFirst: i > 0
        };
      });
      setMachineConfigs(newConfigs);
    } else {
      const rate = String(inv.dailyRentalCost || 0);
      const dur = String(inv.duration || 0);
      setMachineConfigs(
        Array.from({ length: machineIndices.length }, (_, i) => ({
          rate,
          duration: dur,
          sameRateAsFirst: i > 0,
          sameDurationAsFirst: i > 0
        }))
      );
    }

    setIsModalOpen(true);
    setNextInvoiceDialog(false);
  };


  const parseCSVRow = (str: string) => {
    const vals: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '"') {
        inQuotes = !inQuotes;
      } else if (str[i] === ',' && !inQuotes) {
        // Strip surrounding quotes if present
        let val = cur.trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
        vals.push(val.replace(/""/g, '"'));
        cur = '';
      } else {
        cur += str[i];
      }
    }
    let lastVal = cur.trim();
    if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.substring(1, lastVal.length - 1);
    vals.push(lastVal.replace(/""/g, '"'));
    return vals;
  };

  const handleImportCSVSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
    e.target.value = '';
  };

  const processImport = (file: File, mode: 'update' | 'replace' | 'append') => {
    setImportFile(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error('Invalid or empty CSV file'); return;
        }

        let importedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const csvProcessedIds = new Set<string>();

        const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        const getVal = (vals: string[], ...keys: string[]) => {
          for (const key of keys) {
            const idx = headers.indexOf(key.toLowerCase());
            if (idx >= 0) return vals[idx];
          }
          return undefined;
        };

        const parseNum = (s: string | undefined): number => {
          if (!s) return 0;
          const clean = s.replace(/[^0-9.-]/g, '');
          const val = parseFloat(clean);
          return isNaN(val) ? 0 : val;
        };

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVRow(lines[i]);
          if (vals.length < 3) continue;

          const providedId = getVal(vals, 'id')?.trim() || '';
          const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(providedId);
          const idToUse = (mode !== 'append' && isValidUUID) ? providedId : generateId();

          if (idToUse) csvProcessedIds.add(idToUse);

          const rawData = {
            invoiceNo: getVal(vals, 'invoiceNo', 'invoiceNumber'),
            client: getVal(vals, 'client'),
            site: getVal(vals, 'site', 'siteName'),
            startDate: getVal(vals, 'startDate', 'date'),
            duration: parseNum(getVal(vals, 'duration')),
            noOfMachine: parseNum(getVal(vals, 'noOfMachine')),
            dailyRentalCost: parseNum(getVal(vals, 'dailyRentalCost')),
            dieselCostPerLtr: parseNum(getVal(vals, 'dieselCostPerLtr')),
            dailyUsage: parseNum(getVal(vals, 'dailyUsage')),
            noOfTechnician: parseNum(getVal(vals, 'noOfTechnician')),
            techniciansDailyRate: parseNum(getVal(vals, 'techniciansDailyRate')),
            mobDemob: parseNum(getVal(vals, 'mobDemob')),
            installation: parseNum(getVal(vals, 'installation')),
            damages: parseNum(getVal(vals, 'damages')),
            vatInc: getVal(vals, 'vatInc', 'vatinc'),
            endDate: getVal(vals, 'endDate', 'dueDate'),
            amount: parseNum(getVal(vals, 'amount', 'totalCharge')),
            rentalCost: parseNum(getVal(vals, 'rentalCost')),
            dieselCost: parseNum(getVal(vals, 'dieselCost')),
            techniciansCost: parseNum(getVal(vals, 'techniciansCost')),
            totalCost: parseNum(getVal(vals, 'totalCost')),
            vat: parseNum(getVal(vals, 'vat')),
            totalCharge: parseNum(getVal(vals, 'totalCharge', 'amount')),
            totalExclusiveOfVat: parseNum(getVal(vals, 'totalExclusiveOfVat')),
          };

          // Recalculate to ensure VAT and totals are correct based on current master data
          const computed = calculateFullInvoiceData(rawData);
          rawData.vatInc = computed.vatInc;

          if (rawData.amount > 0 && rawData.totalCost > 0) {
            // If CSV provided values, keep them, but use computed for missing ones
            Object.keys(rawData).forEach(key => {
              if ((rawData as any)[key] === 0 && (computed as any)[key] !== 0) {
                (rawData as any)[key] = (computed as any)[key];
              }
            });
          } else {
            // Use full computed data
            Object.assign(rawData, computed);
          }

          if (activeTab === 'all' || activeTab === 'active') {
            const parsedInvoice: Invoice = {
              id: idToUse,
              invoiceNumber: rawData.invoiceNo || '',
              client: rawData.client || '',
              project: getVal(vals, 'project') || 'Billed',
              siteId: getVal(vals, 'siteId') || '',
              siteName: rawData.site || '',
              amount: rawData.totalCharge,
              date: rawData.startDate || '',
              dueDate: rawData.endDate || '',
              billingCycle: (getVal(vals, 'billingCycle') as any) || 'Custom',
              reminderDate: normalizeDate(getVal(vals, 'reminderDate')),
              status: (getVal(vals, 'status') as any) || 'Sent',
              vatInc: rawData.vatInc as any,
              noOfMachine: rawData.noOfMachine,
              dailyRentalCost: rawData.dailyRentalCost,
              dieselCostPerLtr: rawData.dieselCostPerLtr,
              dailyUsage: rawData.dailyUsage,
              noOfTechnician: rawData.noOfTechnician,
              techniciansDailyRate: rawData.techniciansDailyRate,
              mobDemob: rawData.mobDemob,
              installation: rawData.installation,
              damages: rawData.damages,
              duration: rawData.duration,
              rentalCost: rawData.rentalCost,
              dieselCost: rawData.dieselCost,
              techniciansCost: rawData.techniciansCost,
              totalCost: rawData.totalCost,
              vat: rawData.vat,
              totalCharge: rawData.totalCharge,
              totalExclusiveOfVat: rawData.totalExclusiveOfVat,
            };
            const existing = invoices.find(e => e.id === idToUse);
            if (existing && mode !== 'append') {
              updateInvoice(existing.id, parsedInvoice);
              updatedCount++;
            } else {
              addInvoice(parsedInvoice);
              importedCount++;
            }
          } else {
            const parsedPendingInvoice = {
              id: idToUse,
              ...rawData,
              vatInc: rawData.vatInc as any,
            } as any;
            const existing = pendingInvoices.find(e => e.id === idToUse);
            if (existing && mode !== 'append') {
              updatePendingInvoice(existing.id, parsedPendingInvoice);
              updatedCount++;
            } else {
              addPendingInvoice(parsedPendingInvoice);
              importedCount++;
            }
          }
        }

        if (mode === 'replace') {
          if (activeTab === 'all' || activeTab === 'active') {
            invoices.forEach(inv => {
              if (!csvProcessedIds.has(inv.id)) {
                deleteInvoice(inv.id);
                deletedCount++;
              }
            });
          } else {
            pendingInvoices.forEach(inv => {
              if (!csvProcessedIds.has(inv.id)) {
                deletePendingInvoice(inv.id);
                deletedCount++;
              }
            });
          }
        }

        let message = `Import complete: ${importedCount} Added | ${updatedCount} Updated`;
        if (deletedCount > 0) message += ` | ${deletedCount} Removed`;
        toast.success(message);
      } catch (err) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = async (format: 'basic' | 'detailed') => {
    try {
      let headers: string[] = [];
      let rows: string[] = [];
      const currentListForExport = (activeTab === 'all' || activeTab === 'active' || activeTab === 'unpaid') ? invoices : pendingInvoices;
      const extractCSV = (val: any) => typeof val === 'number' ? String(val) : `"${String(val ?? '').replace(/"/g, '""')}"`;

      if (activeTab !== 'quotations') {
        if (format === 'basic') {
          headers = ['id', 'invoiceNumber', 'client', 'siteName', 'date', 'amount', 'status'];
          rows = (currentListForExport as Invoice[]).map(inv => {
            const data = [
              inv.id, inv.invoiceNumber, inv.client, inv.siteName, formatDisplayDate(inv.date), inv.amount, inv.status
            ];
            return data.map(extractCSV).join(',');
          });
        } else {
          headers = ['id', 'invoiceNumber', 'client', 'siteName', 'project', 'amount', 'date', 'dueDate', 'billingCycle', 'vatInc', 'totalCharge', 'duration', 'noOfMachine', 'dailyRentalCost', 'dieselCostPerLtr', 'dailyUsage', 'noOfTechnician', 'techniciansDailyRate', 'mobDemob', 'installation', 'damages', 'rentalCost', 'dieselCost', 'techniciansCost', 'totalCost', 'vat', 'totalExclusiveOfVat'];
          rows = (currentListForExport as Invoice[]).map(inv => {
            const data = [
              inv.id, inv.invoiceNumber, inv.client, inv.siteName, inv.project, inv.amount, formatDisplayDate(inv.date), formatDisplayDate(inv.dueDate), inv.billingCycle, inv.vatInc, inv.totalCharge, inv.duration || 0, inv.noOfMachine || 0, inv.dailyRentalCost || 0, inv.dieselCostPerLtr || 0, inv.dailyUsage || 0, inv.noOfTechnician || 0, inv.techniciansDailyRate || 0, inv.mobDemob || 0, inv.installation || 0, inv.damages || 0, inv.rentalCost || 0, inv.dieselCost || 0, inv.techniciansCost || 0, inv.totalCost || 0, inv.vat || 0, inv.totalExclusiveOfVat || 0
            ];
            return data.map(extractCSV).join(',');
          });
        }
      } else {
        if (format === 'basic') {
          headers = ['id', 'invoiceNo', 'client', 'site', 'startDate', 'amount', 'totalCharge'];
          rows = (currentListForExport as PendingInvoice[]).map(inv => {
            const data = [
              inv.id, inv.invoiceNo, inv.client, inv.site, formatDisplayDate(inv.startDate), (inv as any).amount || 0, inv.totalCharge || 0
            ];
            return data.map(extractCSV).join(',');
          });
        } else {
          headers = ['id', 'invoiceNo', 'client', 'site', 'startDate', 'duration', 'noOfMachine', 'dailyRentalCost', 'dieselCostPerLtr', 'dailyUsage', 'noOfTechnician', 'techniciansDailyRate', 'mobDemob', 'installation', 'damages'];
          rows = (currentListForExport as PendingInvoice[]).map(inv => {
            const data = [
              inv.id, inv.invoiceNo, inv.client, inv.site, formatDisplayDate(inv.startDate), inv.duration || 0, inv.noOfMachine || 0, inv.dailyRentalCost || 0, inv.dieselCostPerLtr || 0, inv.dailyUsage || 0, inv.noOfTechnician || 0, inv.techniciansDailyRate || 0, inv.mobDemob || 0, inv.installation || 0, inv.damages || 0
            ];
            return data.map(extractCSV).join(',');
          });
        }
      }

      const csvContent = [headers.join(','), ...rows].join('\n');
      const fileName = `invoices_${activeTab}_${format}_export_${new Date().toISOString().slice(0, 10)}.csv`;

      if (window.electronAPI?.savePathDialog) {
        const filePath = await window.electronAPI.savePathDialog({
          title: `Export ${activeTab.toUpperCase()} Invoices (${format === 'basic' ? 'Basic' : 'Detailed'})`,
          defaultPath: fileName,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });
        if (filePath) {
          const success = await window.electronAPI.writeFile(filePath, csvContent, 'utf8');
          if (success) toast.success(`Exported to ${filePath}`);
          else toast.error('Failed to save file.');
        }
      } else {
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Successfully exported ${activeTab === 'quotations' ? pendingInvoices.length : invoices.length} ${activeTab !== 'quotations' ? 'invoices' : 'quotations'}`);
      }
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const currentList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'all') {
      list = [...invoices];
    } else if (activeTab === 'active') {
      list = invoices.filter(inv => {
        const s = sites.find(site => 
          (site.name || '').trim().toLowerCase() === (inv.siteName || '').trim().toLowerCase() && 
          (site.client || '').trim().toLowerCase() === (inv.client || '').trim().toLowerCase()
        );
        return s && s.status !== 'Ended';
      });
    } else if (activeTab === 'quotations') {
      list = [...pendingInvoices];
    }
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(item => {
        const clientMatch = item.client?.toLowerCase().includes(lowerSearch);
        const siteMatch = (item.siteName || item.site)?.toLowerCase().includes(lowerSearch);
        const invMatch = (item.invoiceNo || item.invoiceNumber)?.toString().toLowerCase().includes(lowerSearch);
        return clientMatch || siteMatch || invMatch;
      });
    }

    if (filterFromMonth || filterToMonth) {
      list = list.filter(item => {
        const d = ('startDate' in item ? item.startDate : item.date) || '';
        let dateYM = '';
        if (d.includes('-')) {
          dateYM = d.substring(0, 7);
        } else {
          const parts = d.split('/');
          if (parts.length === 3) {
            dateYM = `${parts[2]}-${parts[1]}`;
          }
        }
        if (!dateYM) return false;
        if (filterFromMonth && dateYM < filterFromMonth) return false;
        if (filterToMonth && dateYM > filterToMonth) return false;
        return true;
      });
    }

    if (activeTab === 'completed' || activeTab === 'unpaid') return []; // Handled separately
    return list.sort((a: any, b: any) => {
      let valA: any = '';
      let valB: any = '';

      const aSite = 'site' in a ? a.site : a.siteName;
      const bSite = 'site' in b ? b.site : b.siteName;
      const aDate = 'startDate' in a ? a.startDate : a.date;
      const bDate = 'startDate' in b ? b.startDate : b.date;
      const aInv = 'invoiceNo' in a ? a.invoiceNo : a.invoiceNumber;
      const bInv = 'invoiceNo' in b ? b.invoiceNo : b.invoiceNumber;

      switch (sortField) {
        case 'client':
            valA = (a.client || '').toLowerCase();
            valB = (b.client || '').toLowerCase();
            break;
        case 'site':
            valA = (aSite || '').toLowerCase();
            valB = (bSite || '').toLowerCase();
            break;
        case 'startDate':
            valA = aDate || '';
            valB = bDate || '';
            break;
        case 'invoiceNo':
            valA = String(aInv || '').toLowerCase();
            valB = String(bInv || '').toLowerCase();
            break;
        case 'equipment':
            valA = a.noOfMachine || 0;
            valB = b.noOfMachine || 0;
            break;
        case 'costBkdn':
            valA = a.totalCost || 0;
            valB = b.totalCost || 0;
            break;
        case 'totals':
            valA = a.totalCharge || a.amount || 0;
            valB = b.totalCharge || b.amount || 0;
            break;
        default:
            valA = aDate || '';
            valB = bDate || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeTab, invoices, pendingInvoices, sortField, sortOrder, sites, searchTerm, filterFromMonth, filterToMonth]);

  const siteStats = useMemo(() => {
    return sites.map(site => {
      const siteInvoices = invoices.filter(inv => 
        (inv.siteName || '').trim().toLowerCase() === (site.name || '').trim().toLowerCase() && 
        (inv.client || '').trim().toLowerCase() === (site.client || '').trim().toLowerCase()
      );
      const sitePayments = payments.filter(p => 
        (p.site || '').trim().toLowerCase() === (site.name || '').trim().toLowerCase() && 
        (p.client || '').trim().toLowerCase() === (site.client || '').trim().toLowerCase()
      );
      
      const totalInvoiceAmount = siteInvoices.reduce((sum, inv) => sum + (inv.totalCharge || inv.amount || 0), 0);
      const totalPaymentAmount = sitePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      return {
        ...site,
        invoices: siteInvoices,
        totalInvoiceAmount,
        totalPaymentAmount,
        isCompleted: site.status === 'Ended' && totalPaymentAmount >= totalInvoiceAmount && totalInvoiceAmount > 0,
        isUnpaid: totalPaymentAmount < totalInvoiceAmount && totalInvoiceAmount > 0
      };
    });
  }, [sites, invoices, payments]);

  const completedSites = useMemo(() => {
    let list = siteStats.filter(s => s.isCompleted);
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(s => 
        s.client.toLowerCase().includes(lowerSearch) || 
        s.name.toLowerCase().includes(lowerSearch)
      );
    }
    return list;
  }, [siteStats, searchTerm]);

  const unpaidSites = useMemo(() => {
    let list = siteStats.filter(s => s.isUnpaid);
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(s => 
        s.client.toLowerCase().includes(lowerSearch) || 
        s.name.toLowerCase().includes(lowerSearch)
      );
    }
    return list;
  }, [siteStats, searchTerm]);

  const tableSums = useMemo(() => {
    if (activeTab === 'completed' || activeTab === 'unpaid') {
      const list = activeTab === 'completed' ? completedSites : unpaidSites;
      return list.reduce((acc, site) => ({
        ...acc,
        totalCharge: acc.totalCharge + (site.totalInvoiceAmount || 0),
        amountPaid: acc.amountPaid + (site.totalPaymentAmount || 0)
      }), { rentalCost: 0, dieselCost: 0, otherCost: 0, totalCost: 0, vat: 0, totalCharge: 0, amountPaid: 0 });
    }

    return (currentList || []).reduce((acc, inv: any) => ({
        rentalCost: acc.rentalCost + (inv.rentalCost || 0),
        dieselCost: acc.dieselCost + (inv.dieselCost || 0),
        otherCost: acc.otherCost + ((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0)),
        totalCost: acc.totalCost + (inv.totalCost || 0),
        vat: acc.vat + (inv.vat || 0),
        totalCharge: acc.totalCharge + (inv.totalCharge || inv.amount || 0),
        amountPaid: 0
    }), { rentalCost: 0, dieselCost: 0, otherCost: 0, totalCost: 0, vat: 0, totalCharge: 0, amountPaid: 0 });
  }, [currentList, activeTab, completedSites, unpaidSites]);

  const [expandedSiteKey, setExpandedSiteKey] = useState<string | null>(null);

  const formatSum = (val: number) => {
    if (priv?.canViewAmounts === false) return '***';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  React.useEffect(() => {
    if (printInvoiceTarget && setFullPageContent) {
      setFullPageContent(
        <div className="flex flex-col w-full max-w-5xl mx-auto pb-10 pt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="w-full flex flex-col relative">
             <InvoicePrintModal
               invoice={printInvoiceTarget}
               ledgerBanks={ledgerBanks}
               ledgerBeneficiaryBanks={ledgerBeneficiaryBanks}
               onClose={() => setPrintInvoiceTarget(null)}
             />
           </div>
        </div>
      );
    } else if (setFullPageContent) {
      setFullPageContent(null);
    }
    
    return () => {
      if (setFullPageContent) setFullPageContent(null);
    };
  }, [printInvoiceTarget, setFullPageContent, ledgerBanks, ledgerBeneficiaryBanks]);

  useHideLayout(!!printInvoiceTarget);

  useSetPageTitle(
    (printInvoiceTarget) ? null : (activeTab === 'all' ? 'All Invoices' : activeTab === 'active' ? 'Active Invoices' : activeTab === 'quotations' ? 'Quotations' : activeTab === 'unpaid' ? 'Unpaid Site Records' : 'Completed Invoices'),
    (printInvoiceTarget) ? '' : (activeTab === 'all'
      ? 'View every historical invoice record'
      : activeTab === 'active'
      ? 'Invoices for sites currently in progress'
      : activeTab === 'unpaid'
      ? 'Sites with outstanding balances'
      : activeTab === 'quotations' 
      ? 'Review and process quotation drafts'
      : 'Review invoices for sites with consolidated payments'),
    (printInvoiceTarget) ? null : (
      <>
      {priv.canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9 px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
              <Upload className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline">Export</span> <ChevronDown className="h-3 w-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Choose Export Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportCSV('basic')} className="cursor-pointer">
              <div className="flex flex-col">
                <span className="font-medium">Basic CSV</span>
                <span className="text-[10px] text-slate-500">Essential fields only</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportCSV('detailed')} className="cursor-pointer">
              <div className="flex flex-col">
                <span className="font-medium">Detailed CSV</span>
                <span className="text-[10px] text-slate-500">Full billing data</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {priv.canImport && (
        <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
          <Download className="h-3.5 w-3.5 text-indigo-500" /> <span className="hidden sm:inline">Import</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
        </label>
      )}
      {priv.canCreate && (
        <Button 
          size="sm" 
          className="gap-2 h-9 px-3 sm:px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95"
          onClick={() => { handleClear(); setIsModalOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Create Invoice</span>
        </Button>
      )}
      </>),
    [activeTab, priv, siteRegistry, pendingInvoices, completedSites, unpaidSites, currentList, printInvoiceTarget]
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

        {/* ── Table / list view ── */}
        {/* Tab switcher + mobile actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-x-auto no-scrollbar w-full pb-1">
          <div className="flex bg-slate-200/50 p-1 rounded-lg shrink-0">
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('all')}
            >
              All Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'all' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{invoices.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'quotations' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('quotations')}
            >
              Quotations
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'quotations' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{pendingInvoices.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('active')}
            >
              Active Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'active' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{invoices.filter(i => { const s = sites.find(site => site.name === i.siteName && site.client === i.client); return s && s.status !== 'Ended'; }).length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'unpaid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('unpaid')}
            >
              Unpaid Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'unpaid' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{unpaidSites.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'completed' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed Invoice
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'completed' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{completedSites.length}</Badge>
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
          </div>
        </div>

        {/* Main Table View */}
        <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0 min-h-[400px]">
          <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {activeTab === 'active' ? 'Active Invoices' : 
                 activeTab === 'quotations' ? 'Quotations' : 
                 activeTab === 'all' ? 'All Invoices' : 
                 activeTab === 'unpaid' ? 'Unpaid Site Records' :
                 'Completed paid sites'}
              </h3>
              <Badge variant="secondary" className="ml-2 font-mono">
                {activeTab === 'completed' ? completedSites.length : 
                 activeTab === 'unpaid' ? unpaidSites.length :
                 currentList.length}
              </Badge>
            </div>
            
            <div className="flex items-center gap-6">
              {activeTab === 'quotations' && <p className="hidden md:block text-xs text-slate-500">Double click row to transition to Active.</p>}
              
                <div className={cn(
                  "flex-col sm:flex-row items-end sm:items-center gap-4",
                  showFilters ? "flex" : "hidden sm:flex"
                )}>
                    {/* Filter input */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:border-r border-slate-200 sm:pr-4 w-full sm:w-auto">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[32px]">From</span>
                          <Input 
                              type="month" 
                              value={filterFromMonth} 
                              onChange={(e) => setFilterFromMonth(e.target.value)} 
                              className="h-8 flex-1 sm:w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                          />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[32px]">To</span>
                          <Input 
                              type="month" 
                              value={filterToMonth} 
                              onChange={(e) => setFilterToMonth(e.target.value)} 
                              className="h-8 flex-1 sm:w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                          />
                        </div>
                        {(filterFromMonth || filterToMonth) && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-red-500 gap-1 w-full sm:w-auto" onClick={() => { setFilterFromMonth(''); setFilterToMonth(''); }} title="Clear filter">
                                <X className="h-3.5 w-3.5"/>
                                <span className="sm:hidden">Clear Filters</span>
                            </Button>
                        )}
                    </div>

                    {/* Toggle for Actions Column */}
                    <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto py-2 sm:py-0 border-t sm:border-t-0 border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show Actions</span>
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none"
                        >
                            <span className={`absolute h-4 w-9 rounded-full transition-colors duration-200 ease-in-out ${showActions ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                            <span
                                className={`absolute left-0 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                                style={{ transform: `translateX(${showActions ? '20px' : '2px'})` }}
                            />
                        </button>
                    </div>
                </div>
                <div className="sm:hidden">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "h-9 w-9 rounded-lg border transition-all",
                      showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-500"
                    )}
                  >
                    <Plus className={cn("h-4 w-4 transition-transform", showFilters && "rotate-45")} />
                  </Button>
                </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto [scrollbar-gutter:stable] max-h-[calc(100vh-320px)] relative">
            <style>{`
                .overflow-x-auto {
                    scrollbar-width: thin;
                    scrollbar-color: #6366f1 #f1f5f9;
                }
                .overflow-x-auto::-webkit-scrollbar {
                    height: 10px;
                    display: block !important;
                }
                .overflow-x-auto::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .overflow-x-auto::-webkit-scrollbar-thumb {
                    background-color: #6366f1;
                    border-radius: 10px;
                    border: 2px solid #f1f5f9;
                }
                .overflow-x-auto::-webkit-scrollbar-thumb:hover {
                    background-color: #4f46e5;
                }
            `}</style>
            <Table className="whitespace-nowrap min-w-full text-xs sm:text-sm hidden md:table">
              <TableHeader className="bg-slate-50 sticky top-0 z-20">
                <TableRow className="bg-slate-100/80 border-b border-slate-200">
                  <TableHead colSpan={2} className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Aggregate Totals</span>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right"></TableHead>
                  <TableHead className="px-4 py-2.5 text-right"></TableHead>
                  <TableHead className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        {activeTab === 'completed' || activeTab === 'unpaid' ? 'Gross Sum' : 'Total Charge'}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">
                        ₦{formatSum(activeTab === 'completed' || activeTab === 'unpaid' ? tableSums.totalCost : tableSums.totalCharge)}
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        {activeTab === 'completed' || activeTab === 'unpaid' ? 'Amount Paid' : 'Gross Sum'}
                      </div>
                      <div className="text-[12px] font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                        ₦{formatSum(activeTab === 'completed' || activeTab === 'unpaid' ? tableSums.amountPaid : tableSums.totalCost)}
                      </div>
                    </div>
                  </TableHead>
                  {showActions && (priv.canEdit || priv.canDelete) && <TableHead className="sticky right-0 bg-slate-100/80 p-0 w-20" />}
                </TableRow>
                <TableRow className="border-b-0">
                  <TableHead 
                    className="font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('invoiceNo')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      Inv # <SortIcon field="invoiceNo" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('client')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        Client <SortIcon field="client" />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        Site <SortIcon field="site" />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('equipment')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {activeTab === 'completed' || activeTab === 'unpaid' 
                        ? (expandedSiteKey ? 'Start Date' : 'No of Invoices') 
                        : 'Equipment'} <SortIcon field="equipment" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('startDate')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {activeTab === 'completed' || activeTab === 'unpaid' 
                        ? (expandedSiteKey ? 'Duration' : 'Status') 
                        : 'Dates & Dur'} <SortIcon field="startDate" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('costBkdn')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {activeTab === 'completed' || activeTab === 'unpaid' 
                        ? 'Total Charge' 
                        : 'Cost Bkdn'} <SortIcon field="costBkdn" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('totals')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {activeTab === 'completed' || activeTab === 'unpaid' 
                        ? (expandedSiteKey ? 'Status' : 'Amount Paid') 
                        : 'Totals (₦)'} <SortIcon field="totals" />
                    </div>
                  </TableHead>
                  {showActions && (priv.canEdit || priv.canDelete) && (
                    <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-slate-50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activeTab === 'completed' || activeTab === 'unpaid') ? (
                  (activeTab === 'completed' ? completedSites : unpaidSites).map((site) => {
                    const siteKey = `${site.client}_${site.id || site.name}_${activeTab}`;
                    const isExpanded = expandedSiteKey === siteKey;
                    return (
                    <React.Fragment key={siteKey}>
                      <TableRow
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => {
                          setExpandedSiteKey(prev => prev === siteKey ? null : siteKey);
                        }}
                      >
                        <TableCell className="px-4 py-3 font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-indigo-400 transition-colors" />}
                            <span className="font-mono">{site.client}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-700">
                          <div className="font-semibold">{site.name}</div>
                          <div className="text-slate-500 text-xs">
                            {site.status === 'Ended' ? `Ended on ${formatDisplayDate(site.endDate)}` : `Status: ${site.status}`}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600">
                          <div><span className="text-slate-400">Invoices:</span> {site.invoices.length}</div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600">
                          <Badge className={activeTab === 'completed' ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
                            {activeTab === 'completed' ? 'Fully Paid' : 'Outstanding Bal.'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600 font-mono">
                          {priv?.canViewAmounts === false ? '***' : `₦${site.totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-bold text-indigo-700 font-mono">
                          {priv?.canViewAmounts === false ? '***' : `₦${site.totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </TableCell>
                      </TableRow>
                      {isExpanded && site.invoices.length === 0 && (
                        <TableRow className="bg-slate-50/50">
                          <TableCell colSpan={6} className="px-10 py-3 text-xs text-slate-400 italic">
                            No invoices found for this site.
                          </TableCell>
                        </TableRow>
                      )}
                      {isExpanded && site.invoices.map((inv: any) => (
                        <TableRow key={inv.id} className="bg-indigo-50/30 border-l-4 border-l-indigo-400 hover:bg-indigo-50/60 transition-colors">
                          <TableCell className="px-10 py-2.5 font-mono text-xs font-bold text-indigo-700">
                            {inv.invoiceNumber || inv.invoiceNo || '—'}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-xs text-slate-600">
                            <span className="font-medium">{inv.client}</span>
                            <span className="mx-1 text-slate-300">·</span>
                            <span className="text-slate-400">{inv.siteName || inv.site}</span>
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right text-xs text-slate-500">
                            {formatDisplayDate(inv.date || inv.startDate)}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right text-xs text-slate-500">
                            {inv.duration || 0} Days
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right text-xs font-mono font-semibold text-slate-700">
                            {priv?.canViewAmounts === false ? '***' : `₦${(inv.totalCharge || inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right text-xs">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500">
                              {inv.status || 'Sent'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                    );
                  })
                ) : (
                  currentList.map((inv: any) => (
                    <React.Fragment key={inv.id}>
                      <TableRow 
                        onDoubleClick={() => { if (activeTab !== 'quotations') setDetailInvoice(inv); }}
                        className={cn(
                          "group hover:bg-indigo-50/20 transition-colors cursor-pointer border-b border-slate-100/80",
                          detailInvoice?.id === inv.id && "bg-indigo-50/40"
                        )}
                        onClick={() => {
                          if (activeTab === 'quotations') {
                            handleMakeActive(inv);
                          } else {
                            setDetailInvoice(inv);
                          }
                        }}
                      >
                        <TableCell className="px-4 py-3 font-mono font-bold text-slate-700">{inv.invoiceNo || inv.invoiceNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-700">
                          <div className="font-semibold">{inv.client}</div>
                          <div className="text-slate-500 text-xs">{inv.site || inv.siteName} <span className="ml-1 px-1 rounded bg-slate-100 border text-[10px]">{inv.vatInc || 'No VAT'}</span></div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600">
                          {/* ── Machine column: use machineConfigs when rates differ ── */}
                          {(() => {
                            const configs: any[] | undefined = inv.machineConfigs;
                            if (configs && configs.length > 0) {
                              // Resolve effective rates respecting "same as first" flags
                              const firstRate = parseFloat(configs[0]?.rate) || 0;
                              const firstDur  = parseFloat(configs[0]?.duration) || 0;
                              const resolved = configs.map((m: any) => ({
                                rate: m.sameRateAsFirst ? firstRate : (parseFloat(m.rate) || 0),
                                duration: m.sameDurationAsFirst ? firstDur : (parseFloat(m.duration) || 0),
                              }));
                              // Group by unique rate to build compact display
                              const groups = new Map<number, number>(); // rate → count
                              resolved.forEach(m => {
                                if (m.rate > 0) groups.set(m.rate, (groups.get(m.rate) || 0) + 1);
                              });
                              const entries = Array.from(groups.entries());
                              if (entries.length === 1) {
                                // All same rate — standard display
                                const [rate, count] = entries[0];
                                return <div><span className="text-slate-400">Mac:</span> {count} x {priv?.canViewAmounts === false ? '***' : rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>;
                              }
                              // Multiple different rates — show each group
                              return (
                                <div className="space-y-0.5">
                                  {entries.map(([rate, count], gi) => (
                                    <div key={gi} className="text-xs">
                                      <span className="text-slate-400">M{gi + 1}:</span>{' '}
                                      {count} x {priv?.canViewAmounts === false ? '***' : rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            // Fallback: flat field
                            return <div><span className="text-slate-400">Mac:</span> {inv.noOfMachine || 0} x {priv?.canViewAmounts === false ? '***' : (inv.dailyRentalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>;
                          })()}
                          <div><span className="text-slate-400">Tech:</span> {inv.noOfTechnician || 0} x {priv?.canViewAmounts === false ? '***' : (inv.techniciansDailyRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div><span className="text-slate-400">DsLtr:</span> {priv?.canViewAmounts === false ? '***' : (inv.dieselCostPerLtr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(inv.dailyUsage || 0)}L)</div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600">
                          <div className="font-medium text-slate-800">{inv.duration || 0} Days</div>
                          <div className="text-slate-500 text-xs">
                            {(() => {
                              const startDate = normalizeDate(inv.startDate || inv.date);
                              const maxDuration = inv.machineConfigs && inv.machineConfigs.length > 0 
                                ? Math.max(...inv.machineConfigs.map((r: any) => parseFloat(r.duration) || 0))
                                : (parseFloat(inv.duration) || 0);

                              let projectedEndDateStr = '';
                              if (startDate && maxDuration > 0) {
                                const start = new Date(startDate);
                                if (!isNaN(start.getTime())) {
                                  start.setDate(start.getDate() + maxDuration - 1);
                                  projectedEndDateStr = start.toISOString().split('T')[0];
                                }
                              } else {
                                projectedEndDateStr = normalizeDate(inv.endDate || inv.dueDate);
                              }

                              const liveDetails = calculateFullInvoiceData(inv, inv.machineConfigs);
                              const actualEndDateStr = liveDetails.endDate || inv.endDate || inv.dueDate;

                              return (
                                <div className="flex flex-col items-end gap-1 mt-0.5">
                                  <div>
                                    {formatDisplayDate(startDate)} - {formatDisplayDate(projectedEndDateStr)}
                                  </div>
                                  {inv.countOffDays === false && actualEndDateStr && (
                                    <div className="text-[10px] text-amber-600 font-semibold bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-100">
                                      Actual End: {formatDisplayDate(actualEndDateStr)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-slate-600">
                          <div><span className="text-slate-400">Rent:</span> {priv?.canViewAmounts === false ? '***' : (inv.rentalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div><span className="text-slate-400">Fuel:</span> {priv?.canViewAmounts === false ? '***' : (inv.dieselCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div><span className="text-slate-400">Other:</span> {priv?.canViewAmounts === false ? '***' : ((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="text-slate-500 text-xs">Gross: {priv?.canViewAmounts === false ? '***' : (inv.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-slate-500 text-xs">VAT: {priv?.canViewAmounts === false ? '***' : (inv.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="font-bold text-indigo-700 mt-1">{priv?.canViewAmounts === false ? '***' : (inv.totalCharge || inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </TableCell>
                        {showActions && (priv.canEdit || priv.canDelete) && (
                          <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center justify-center gap-1">
                              {activeTab === 'quotations' && priv.canEdit && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleMakeActive(inv); }} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Move to Active">
                                  <ArrowRightCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(inv); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit row">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {priv.canEdit && activeTab !== 'quotations' && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleGenerateNext(inv); }} className="h-8 w-8 text-orange-600 hover:bg-orange-50" title="Generate Next Invoice">
                                  <PlusCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {priv.canEdit && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setPrintInvoiceTarget(inv); }} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Print Invoice">
                                  <Printer className="w-4 h-4" />
                                </Button>
                              )}
                              {priv.canDelete && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete row">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
                {activeTab === 'quotations' && currentList.length > 0 && (
                  <TableRow className="bg-amber-50/30 border-t-2 border-amber-100/50 italic">
                    <TableCell colSpan={showActions ? 7 : 6} className="px-4 py-3 text-center text-amber-700 text-[11px] font-medium tracking-wide">
                      Double-click a quotation to transition it to Active.
                    </TableCell>
                  </TableRow>
                )}
                {activeTab !== 'completed' && activeTab !== 'unpaid' && currentList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showActions ? 7 : 6} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide">
                      No {activeTab} records found.
                    </TableCell>
                  </TableRow>
                )}
                {activeTab === 'completed' && completedSites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide">
                      No completely paid sites (Ended status) found.
                    </TableCell>
                  </TableRow>
                )}
                {activeTab === 'unpaid' && unpaidSites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide">
                      No sites with outstanding balances found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Mobile Summary Cards */}
            <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50 min-h-[400px]">
              {(activeTab === 'completed' || activeTab === 'unpaid') ? (
                (activeTab === 'completed' ? completedSites : unpaidSites).map((site) => {
                  const siteKey = `${site.client}_${site.id || site.name}_${activeTab}`;
                  return (
                    <div 
                      key={siteKey} 
                      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer transition-colors hover:bg-slate-50/50"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedSiteKey(prev => prev === siteKey ? null : siteKey)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedSiteKey(prev => prev === siteKey ? null : siteKey); }}
                    >
                      <div className="p-3 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          {expandedSiteKey === siteKey 
                            ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500" /> 
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <div>
                            <div className="font-bold text-slate-800 text-sm leading-tight">{site.client}</div>
                            <div className="text-slate-500 text-xs mt-0.5">{site.name}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold shrink-0 ml-2",
                          activeTab === 'completed' ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-amber-200 text-amber-700 bg-amber-50"
                        )}>
                          {activeTab === 'completed' ? 'Fully Paid' : 'Outstanding'}
                        </Badge>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Status</p>
                          <p className="font-medium text-slate-700 truncate">{site.status === 'Ended' ? 'Ended' : site.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total Charge</p>
                          <p className="font-mono font-semibold text-slate-700">₦{formatSum(site.totalInvoiceAmount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Invoices</p>
                          <p className="font-medium text-slate-700">{site.invoices.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Amount Paid</p>
                          <p className="font-mono font-bold text-indigo-700">₦{formatSum(site.totalPaymentAmount)}</p>
                        </div>
                      </div>

                      {/* Expanded Invoices for Site (Mobile) */}
                      {expandedSiteKey === siteKey && (
                        <div className="bg-slate-50 p-2 space-y-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                          {site.invoices.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic p-2">No invoices found.</p>
                          ) : (
                            site.invoices.map((inv: any) => (
                              <div 
                                key={inv.id} 
                                className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center active:bg-indigo-50 transition-colors cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailInvoice(inv);
                                }}
                              >
                                <div>
                                  <div className="text-[11px] font-bold text-indigo-700 font-mono">{inv.invoiceNumber || inv.invoiceNo}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{formatDisplayDate(inv.date || inv.startDate)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] font-bold text-slate-700 font-mono">₦{formatSum(inv.totalCharge || inv.amount || 0)}</div>
                                  <div className="text-[9px] text-slate-400 uppercase font-bold">{inv.status || 'Sent'}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                currentList.map((inv: any) => (
                  <div 
                    key={inv.id} 
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative cursor-pointer transition-colors hover:bg-slate-50/50" 
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDetailInvoice(inv);
                    }}
                  >
                    {/* Status accent bar */}
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      activeTab === 'quotations' ? "bg-amber-400" : "bg-indigo-500"
                    )} />
                    
                    <div className="p-3 pl-4 border-b border-slate-100 flex justify-between items-start">
                      <div className="pr-2">
                        <div className="font-bold text-slate-800 text-sm leading-tight line-clamp-1">{inv.client}</div>
                        <div className="text-slate-500 text-xs mt-0.5 line-clamp-1">{inv.site || inv.siteName}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-indigo-700 text-[13px]">₦{formatSum(inv.totalCharge || inv.amount || 0)}</div>
                        <Badge variant="outline" className="mt-1 text-[9px] px-1.5 py-0 font-mono text-slate-500 bg-slate-50">
                          {inv.invoiceNo || inv.invoiceNumber || 'DRAFT'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-3 pl-4 grid grid-cols-2 gap-y-2 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Dates</p>
                        <div className="font-medium text-slate-600 flex flex-col gap-1 mt-0.5">
                          {(() => {
                            const startDate = normalizeDate(inv.startDate || inv.date);
                            const maxDuration = inv.machineConfigs && inv.machineConfigs.length > 0 
                              ? Math.max(...inv.machineConfigs.map((r: any) => parseFloat(r.duration) || 0))
                              : (parseFloat(inv.duration) || 0);

                            let projectedEndDateStr = '';
                            if (startDate && maxDuration > 0) {
                              const start = new Date(startDate);
                              if (!isNaN(start.getTime())) {
                                start.setDate(start.getDate() + maxDuration - 1);
                                projectedEndDateStr = start.toISOString().split('T')[0];
                              }
                            } else {
                              projectedEndDateStr = normalizeDate(inv.endDate || inv.dueDate);
                            }

                            const liveDetails = calculateFullInvoiceData(inv, inv.machineConfigs);
                            const actualEndDateStr = liveDetails.endDate || inv.endDate || inv.dueDate;

                            return (
                              <>
                                <span className="truncate">{formatDisplayDate(startDate)} - {formatDisplayDate(projectedEndDateStr)}</span>
                                {inv.countOffDays === false && actualEndDateStr && (
                                  <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 inline-block w-fit">
                                    Actual End: {formatDisplayDate(actualEndDateStr)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Duration</p>
                        <p className="font-medium text-slate-600">{inv.duration || 0} Days</p>
                      </div>
                      
                      {/* Cost Breakdown */}
                      <div className="col-span-2 mt-2 pt-2 border-t border-slate-50 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="text-[10px] text-slate-500"><b className="text-slate-400 font-normal">Rent:</b> ₦{formatSum(inv.rentalCost || 0)}</span>
                        <span className="text-[10px] text-slate-500"><b className="text-slate-400 font-normal">Fuel:</b> ₦{formatSum(inv.dieselCost || 0)}</span>
                        <span className="text-[10px] text-slate-500"><b className="text-slate-400 font-normal">Other:</b> ₦{formatSum((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0))}</span>
                        <span className="text-[10px] text-slate-500"><b className="text-slate-400 font-normal">VAT:</b> ₦{formatSum(inv.vat || 0)}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {showActions && (priv.canEdit || priv.canDelete) && (
                      <div className="px-2 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-1">
                        {activeTab === 'quotations' && priv.canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => handleMakeActive(inv)} className="h-8 px-3 text-[11px] text-emerald-600 hover:bg-emerald-100 font-semibold rounded-md">
                            <ArrowRightCircle className="w-3.5 h-3.5 mr-1.5" /> Make Active
                          </Button>
                        )}
                        {priv.canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(inv)} className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-100 rounded-md">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                         {priv.canEdit && activeTab !== 'quotations' && (
                           <Button variant="ghost" size="sm" onClick={() => handleGenerateNext(inv)} className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-100 rounded-md">
                             <PlusCircle className="w-4 h-4" />
                           </Button>
                         )}
                        {priv.canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => setPrintInvoiceTarget(inv)} className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 rounded-md">
                            <Printer className="w-4 h-4" />
                          </Button>
                        )}
                        {priv.canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-100 rounded-md">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* Empty states for mobile */}
              {activeTab === 'quotations' && currentList.length > 0 && (
                <div className="text-center text-amber-700 text-[10px] font-medium italic mt-2">
                  Double-tap a quotation to transition it to Active.
                </div>
              )}
              {activeTab !== 'completed' && activeTab !== 'unpaid' && currentList.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-sm font-medium">
                  No {activeTab} records found.
                </div>
              )}
              {activeTab === 'completed' && completedSites.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-sm font-medium">
                  No completely paid sites (Ended status) found.
                </div>
              )}
              {activeTab === 'unpaid' && unpaidSites.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-sm font-medium">
                  No sites with outstanding balances found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Full-page Invoice Form (rendered as portal to cover layout header but keep sidebar) ── */}
        {isModalOpen && document.getElementById('layout-content-wrapper') && createPortal(
          <div className="absolute inset-0 z-50 bg-slate-100 dark:bg-slate-950 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col w-full">
            {/* Page header — sticky */}
            <div className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm px-6 md:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="gap-2 h-9 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 -ml-1 shrink-0 transition-colors" onClick={() => setIsModalOpen(false)}>
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Invoices</span>
                </Button>
                <div className="h-5 w-px bg-slate-300 dark:bg-slate-800" />
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    {selectedId ? 'Edit' : 'Create'} {form.destination === 'Active' ? 'Active Invoice' : 'Quotation'}
                  </h2>
                  <p className="text-[11px] text-slate-550 dark:text-slate-400">Manage billing rates, crew accommodation, machinery configs, and auto-reminders.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Destination:</span>
                <select
                  value={form.destination}
                  onChange={e => handleChange('destination', e.target.value)}
                  className="flex h-9 w-40 rounded-lg border border-slate-350 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs outline-none font-bold text-slate-800 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Pending">Quotation</option>
                  <option value="Active">Active Invoice</option>
                </select>
              </div>
            </div>
            </div>

            {/* Two-column layout: form left, live preview right */}
            <div className="p-6 md:p-8 pt-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
              {/* Main form column */}
              <div className="space-y-6">
                
                {/* Section 1: Client & Invoice Info */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-850 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-650 dark:text-indigo-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Client &amp; Document Details</h3>
                      <p className="text-[10px] text-slate-400">Client details, location and document identifiers.</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Client Account</label>
                        <select
                          value={form.client}
                          onChange={e => {
                            const val = e.target.value;
                            const siteForClient = siteRegistry.find(s => s.client === val && s.name === form.site);
                            setForm(f => ({ 
                              ...f, 
                              client: val,
                              site: '', 
                              vatInc: siteForClient ? siteForClient.vat : f.vatInc
                            }));
                          }}
                          className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm font-semibold text-slate-800 dark:text-white"
                        >
                          <option value="">Select Client...</option>
                          {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Site Location</label>
                        <select
                          value={form.site}
                          onChange={e => {
                            const val = e.target.value;
                            const siteObj = siteRegistry.find(s => s.name === val && s.client === form.client);
                            setForm(f => ({ 
                              ...f, 
                              site: val,
                              vatInc: siteObj ? siteObj.vat : f.vatInc
                            }));
                          }}
                          disabled={!form.client}
                          className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm font-semibold text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Site...</option>
                          {sitesBySelectedClient.map((s, i) => <option key={i} value={s.name}>{s.name} ({s.type})</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Document / Invoice Number</label>
                        <Input 
                          type="text" 
                          value={form.invoiceNo} 
                          onChange={e => handleChange('invoiceNo', e.target.value)} 
                          placeholder="e.g. 144" 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 font-mono font-bold h-11 text-slate-800 dark:text-white" 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Start Date</label>
                        <Input 
                          type="date" 
                          value={form.startDate} 
                          onChange={e => handleChange('startDate', e.target.value)} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-semibold text-slate-800 dark:text-white" 
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center">
                      <label className="flex items-start gap-3.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={!!form.countOffDays} 
                          onChange={e => handleChange('countOffDays', e.target.checked)} 
                          className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 accent-indigo-650" 
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-205 block">Count off-days as billed days</span>
                          <span className="text-[10px] text-slate-450 block">Billed duration will accrue continuously without pausing on client holidays or non-working days.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 2: Equipment & Machinery */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-850 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-650 dark:text-blue-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Equipment &amp; Machinery Lease</h3>
                      <p className="text-[10px] text-slate-400">Lease pump quantities, config rates and durations.</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Number of Dewatering Pumps</label>
                        <Input
                          type="number" 
                          min="0" 
                          value={form.noOfMachine}
                          onChange={e => handleNoOfMachineChange(e.target.value)}
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-bold text-slate-850 dark:text-white"
                          placeholder="0"
                        />
                      </div>

                      {machineConfigs.length === 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Daily Rental Rate (₦ / pump)</label>
                          <NumericFormat 
                            customInput={Input} 
                            thousandSeparator 
                            decimalScale={2} 
                            value={form.dailyRentalCost} 
                            onValueChange={(v) => handleChange('dailyRentalCost', v.value || '')} 
                            className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white" 
                            placeholder="0.00" 
                          />
                        </div>
                      )}
                    </div>

                    {/* Per-machine configs */}
                    {machineConfigs.length > 0 && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                          <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Machine Configuration Matrix</p>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">{machineConfigs.length} Pumps Active</span>
                        </div>
                        
                        <div className="space-y-3">
                          {machineConfigs.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr] gap-4 items-center p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                Pump #{idx + 1}
                              </span>
                              
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Daily Rental (₦)</span>
                                  {idx > 0 && (
                                    <label className="flex items-center gap-1 text-[10px] text-indigo-650 dark:text-indigo-455 cursor-pointer select-none font-bold">
                                      <input
                                        type="checkbox"
                                        checked={row.sameRateAsFirst}
                                        onChange={e => handleMachineSameToggle(idx, 'rate', e.target.checked)}
                                        className="accent-indigo-650 w-3 h-3 rounded border-slate-350"
                                      />
                                      Link to #1
                                    </label>
                                  )}
                                </div>
                                <NumericFormat
                                  customInput={Input}
                                  thousandSeparator 
                                  decimalScale={2}
                                  value={row.rate}
                                  disabled={idx > 0 && row.sameRateAsFirst}
                                  onValueChange={v => handleMachineRowChange(idx, 'rate', v.value || '')}
                                  className={idx > 0 && row.sameRateAsFirst ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-mono text-xs' : 'bg-white dark:bg-slate-900 h-10 font-mono text-xs text-slate-800 dark:text-white'}
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Lease Duration (Days)</span>
                                  {idx > 0 && (
                                    <label className="flex items-center gap-1 text-[10px] text-indigo-655 dark:text-indigo-455 cursor-pointer select-none font-bold">
                                      <input
                                        type="checkbox"
                                        checked={row.sameDurationAsFirst}
                                        onChange={e => handleMachineSameToggle(idx, 'duration', e.target.checked)}
                                        className="accent-indigo-650 w-3 h-3 rounded border-slate-350"
                                      />
                                      Link to #1
                                    </label>
                                  )}
                                </div>
                                <Input
                                  type="number" 
                                  min="0"
                                  value={row.duration}
                                  disabled={idx > 0 && row.sameDurationAsFirst}
                                  onChange={e => handleMachineRowChange(idx, 'duration', e.target.value)}
                                  className={idx > 0 && row.sameDurationAsFirst ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 text-xs font-semibold' : 'bg-white dark:bg-slate-900 h-10 text-xs font-semibold text-slate-800 dark:text-white'}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Crew / Dewatering Staff */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-850 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Dewatering Crew &amp; Personnel</h3>
                      <p className="text-[10px] text-slate-400">Manage technician count, day/night shift rates, and durations.</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Main technician count */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Number of Technicians On Site</label>
                        <Input 
                          type="number" 
                          min="0" 
                          value={form.noOfTechnician} 
                          onChange={e => handleChange('noOfTechnician', e.target.value)} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-bold text-slate-850 dark:text-white" 
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Day Shift details card */}
                      <div className="bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-450" />
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Day Shift Settings</p>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Day Rate (₦ / tech / day)</label>
                            <NumericFormat 
                              customInput={Input} 
                              thousandSeparator 
                              decimalScale={2} 
                              value={form.techniciansDailyRate} 
                              onValueChange={(v) => handleChange('techniciansDailyRate', v.value || '')} 
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 font-mono font-semibold text-slate-800 dark:text-white" 
                              placeholder="0.00" 
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Day Duration (Days)</label>
                              <label className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 cursor-pointer select-none font-bold">
                                <input
                                  type="checkbox"
                                  checked={form.technicianDurationSameAsMachine}
                                  onChange={e => handleChange('technicianDurationSameAsMachine', e.target.checked)}
                                  className="accent-indigo-650 w-3 h-3 rounded"
                                />
                                Link to M-1
                              </label>
                            </div>
                            <Input 
                              type="number" 
                              min="0" 
                              value={form.technicianDurationSameAsMachine ? (machineConfigs.length > 0 ? Math.max(...machineConfigs.map(r => parseFloat(r.duration) || 0)) : '') : form.technicianDuration} 
                              onChange={e => handleChange('technicianDuration', e.target.value)} 
                              disabled={form.technicianDurationSameAsMachine}
                              className={form.technicianDurationSameAsMachine ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold" : "bg-white dark:bg-slate-900 h-10 font-semibold text-slate-800 dark:text-white"} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Night Shift & Accommodation details card */}
                      <div className="bg-slate-50/70 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-slate-100" />
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Night Shift &amp; Special Rates</p>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Night Shift Technician Count */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Night Shift Technicians</label>
                              <label className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 cursor-pointer select-none font-bold">
                                <input
                                  type="checkbox"
                                  checked={form.technicianNightCountSameAsDay}
                                  onChange={e => handleChange('technicianNightCountSameAsDay', e.target.checked)}
                                  className="accent-indigo-650 w-3 h-3 rounded"
                                />
                                Same as Day Shift
                              </label>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={form.technicianNightCountSameAsDay ? (form.noOfTechnician || '') : form.noOfTechnicianNight}
                              onChange={e => handleChange('noOfTechnicianNight', e.target.value)}
                              disabled={form.technicianNightCountSameAsDay}
                              className={form.technicianNightCountSameAsDay ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold' : 'bg-white dark:bg-slate-900 h-10 font-bold text-slate-800 dark:text-white'}
                              placeholder={form.technicianNightCountSameAsDay ? `Same as Day (${form.noOfTechnician || 0})` : 'Night crew count'}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Night Rate (₦ / tech / night)</label>
                            <NumericFormat
                              customInput={Input}
                              thousandSeparator 
                              decimalScale={2}
                              value={form.technicianNightFee}
                              onValueChange={(v) => handleChange('technicianNightFee', v.value || '')}
                              placeholder="0.00"
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 font-mono font-semibold text-slate-800 dark:text-white"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Night Duration (Nights)</label>
                              <label className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 cursor-pointer select-none font-bold">
                                <input
                                  type="checkbox"
                                  checked={form.technicianNightDurationSameAsMachine}
                                  onChange={e => handleChange('technicianNightDurationSameAsMachine', e.target.checked)}
                                  className="accent-indigo-650 w-3 h-3 rounded"
                                />
                                Link to M-1
                              </label>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={form.technicianNightDurationSameAsMachine ? (machineConfigs.length > 0 ? Math.max(...machineConfigs.map(r => parseFloat(r.duration) || 0)) : '') : form.technicianNightDuration}
                              onChange={e => handleChange('technicianNightDuration', e.target.value)}
                              disabled={form.technicianNightDurationSameAsMachine}
                              className={form.technicianNightDurationSameAsMachine ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold' : 'bg-white dark:bg-slate-900 h-10 font-semibold text-slate-800 dark:text-white'}
                              placeholder="e.g. 8"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Accommodation (₦ / tech / day)</label>
                            </div>
                            <NumericFormat
                              customInput={Input}
                              thousandSeparator 
                              decimalScale={2}
                              value={form.technicianAccommodation}
                              onValueChange={(v) => handleChange('technicianAccommodation', v.value || '')}
                              placeholder="0.00"
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 font-mono font-semibold text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* Accommodation crew basis toggle — only shown when counts differ */}
                          {!form.technicianNightCountSameAsDay && parseFloat(form.technicianAccommodation) > 0 && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                              <div>
                                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Accommodation Crew Basis</p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                  {form.technicianAccommodationUseNightCount
                                    ? `Calculated on Night crew (${form.noOfTechnicianNight || 0} techs)`
                                    : `Calculated on Day crew (${form.noOfTechnician || 0} techs)`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleChange('technicianAccommodationUseNightCount', !form.technicianAccommodationUseNightCount)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.technicianAccommodationUseNightCount ? 'bg-slate-800 dark:bg-slate-200' : 'bg-amber-400'}`}
                                title="Toggle accommodation crew basis"
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${form.technicianAccommodationUseNightCount ? 'translate-x-4' : 'translate-x-1'}`} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Effective Rate Bar */}
                    <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Effective Daily Rate per Crew Member</span>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">Sum of Day Rate + Night Rate + Accommodation Rate per technician per day.</p>
                      </div>
                      <div className="h-10 px-4 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-955 flex items-center justify-center font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm shadow-sm shrink-0">
                        ₦{livePreview.effectiveTechDailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Fuel & Logistics Extra Services */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-850 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                    <div className="p-2 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-655 dark:text-orange-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Fuel &amp; Logistics Extra Costs</h3>
                      <p className="text-[10px] text-slate-400">Define fuel consumption rates, mobilization and repairs costs.</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Daily Fuel Usage (Liters / pump / day)</label>
                        <Input 
                          type="number" 
                          min="0" 
                          value={form.dailyUsage} 
                          onChange={e => handleChange('dailyUsage', e.target.value)} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-semibold text-slate-800 dark:text-white" 
                          placeholder="e.g. 150" 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Diesel Price (₦ / Liter)</label>
                        <NumericFormat 
                          customInput={Input} 
                          thousandSeparator 
                          decimalScale={2} 
                          value={form.dieselCostPerLtr} 
                          onValueChange={(v) => handleChange('dieselCostPerLtr', v.value || '')} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white" 
                          placeholder="0.00" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-850">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Mobilization / Demob (₦)</label>
                        <NumericFormat 
                          customInput={Input} 
                          thousandSeparator 
                          decimalScale={2} 
                          value={form.mobDemob} 
                          onValueChange={(v) => handleChange('mobDemob', v.value || '')} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white" 
                          placeholder="0.00" 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Installation Fee (₦)</label>
                        <NumericFormat 
                          customInput={Input} 
                          thousandSeparator 
                          decimalScale={2} 
                          value={form.installation} 
                          onValueChange={(v) => handleChange('installation', v.value || '')} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white" 
                          placeholder="0.00" 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Damages / Repairs (₦)</label>
                        <NumericFormat 
                          customInput={Input} 
                          thousandSeparator 
                          decimalScale={2} 
                          value={form.damages} 
                          onValueChange={(v) => handleChange('damages', v.value || '')} 
                          className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white" 
                          placeholder="0.00" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Reminders & Alerts */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-850 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-650 dark:text-slate-350">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Follow-up &amp; Reminders</h3>
                      <p className="text-[10px] text-slate-400">Toggle automated email notifications and task alerts.</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex flex-col gap-3">
                      <label className="flex items-start gap-3.5 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-150 dark:hover:border-slate-800 select-none">
                        <input 
                          type="checkbox" 
                          checked={!!form.createReminder} 
                          onChange={e => handleChange('createReminder', e.target.checked)} 
                          className="mt-1 h-5 w-5 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 accent-indigo-650" 
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">Create Automated Dashboard Reminder</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Generates a follow-up task on the projected end date to extend or rebill.</span>
                        </div>
                      </label>
                      {form.createReminder && (
                        <label className="flex items-center gap-3 cursor-pointer p-3 pl-12 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-150 dark:hover:border-slate-800 select-none">
                          <input 
                            type="checkbox" 
                            checked={!!form.sendEmailNotification} 
                            onChange={e => handleChange('sendEmailNotification', e.target.checked)} 
                            className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-indigo-650 focus:ring-indigo-500 accent-indigo-650" 
                          />
                          <span className="text-xs font-semibold text-slate-655 dark:text-slate-300 flex items-center gap-2">
                            <Mail className="w-4.5 h-4.5 text-indigo-550 dark:text-indigo-400 animate-bounce" /> 
                            Send email notification copy along with the dashboard reminder
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Footer Action Bar */}
                <div className="bg-slate-200/50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-4 rounded-2xl flex gap-4 shadow-sm">
                  <Button variant="outline" className="flex-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 h-12 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold" onClick={() => setIsModalOpen(false)}>
                    Discard
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white gap-2 h-12 shadow-md font-bold text-sm">
                    <CheckCircle className="w-5 h-5" /> {selectedId ? 'Update & Save Changes' : 'Publish Document'}
                  </Button>
                </div>
              </div>

              {/* Live Calculation Sidebar */}
              <div className="flex flex-col gap-4 sticky top-4">
                <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 shadow-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Live Auto-Calc</span>
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider rounded-sm px-2.5 py-0.5 border-slate-700 ${
                      livePreview.vatInc === 'Yes' ? 'text-indigo-400 bg-indigo-950/50 border-indigo-900' :
                      livePreview.vatInc === 'Add' ? 'text-amber-400 bg-amber-950/50 border-amber-900' :
                      'text-slate-450 bg-slate-800 border-slate-700'
                    }`}>
                      VAT: {livePreview.vatInc}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">Gross Total</span>
                      <span className="font-mono text-slate-200 font-bold text-xl">
                        ₦{priv?.canViewAmounts === false ? '***' : livePreview.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-px bg-slate-800" />
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">Tax (VAT {livePreview.vatInc})</span>
                      <span className="font-mono text-indigo-400 font-bold text-lg">
                        ₦{priv?.canViewAmounts === false ? '***' : livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-px bg-slate-800" />
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">Final Amount Due</span>
                      <span className="font-mono text-emerald-400 font-black text-2xl leading-none tracking-tight">
                        ₦{priv?.canViewAmounts === false ? '***' : livePreview.totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tech cost breakdown card */}
                {(parseFloat(form.noOfTechnician) > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-5 shadow-sm space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-650 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-2">Crew Cost Formula</p>
                    <div className="space-y-3.5 text-xs">
                      {/* Day shift line */}
                      <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                        <span className="flex flex-col">
                          <span className="font-bold text-slate-705 dark:text-slate-350">Day Shift Cost</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {parseFloat(form.noOfTechnician) || 0} tech{parseFloat(form.noOfTechnician) !== 1 ? 's' : ''} × ₦{(parseFloat(form.techniciansDailyRate) || 0).toLocaleString()}/d × {livePreview.actualTechDuration}d
                          </span>
                        </span>
                        <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                          ₦{((parseFloat(form.noOfTechnician) || 0) * (parseFloat(form.techniciansDailyRate) || 0) * livePreview.actualTechDuration).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Night shift line */}
                      {(parseFloat(form.technicianNightFee) > 0) && (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Night Shift Cost</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {livePreview.noOfTechnicianNight} tech{livePreview.noOfTechnicianNight !== 1 ? 's' : ''} × ₦{(parseFloat(form.technicianNightFee) || 0).toLocaleString()}/n × {livePreview.actualNightDuration}n
                            </span>
                          </span>
                          <span className="font-mono font-bold text-slate-855 dark:text-slate-205 shrink-0">
                            ₦{((livePreview.noOfTechnicianNight || 0) * (parseFloat(form.technicianNightFee) || 0) * livePreview.actualNightDuration).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Accommodation line */}
                      {(parseFloat(form.technicianAccommodation) > 0) && (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Crew Accommodation</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {livePreview.accomCrewCount} tech{livePreview.accomCrewCount !== 1 ? 's' : ''}{!form.technicianNightCountSameAsDay ? (form.technicianAccommodationUseNightCount ? ' (night basis)' : ' (day basis)') : ''} × ₦{(parseFloat(form.technicianAccommodation) || 0).toLocaleString()}/d × {livePreview.actualTechDuration}d
                            </span>
                          </span>
                          <span className="font-mono font-bold text-slate-855 dark:text-slate-205 shrink-0">
                            ₦{((livePreview.accomCrewCount || 0) * (parseFloat(form.technicianAccommodation) || 0) * livePreview.actualTechDuration).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {/* Total Tech line */}
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                      <div className="flex justify-between font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                        <span>Total Crew Cost</span>
                        <span className="font-mono">
                          ₦{livePreview.techniciansCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Diesel Calculation breakdown card */}
                {(livePreview.dieselCost > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-5 shadow-sm space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border-b border-slate-100 dark:border-slate-800 pb-2">Diesel Calculation</p>
                    <div className="space-y-3.5 text-xs">
                      {machineConfigs.length > 0 ? (
                        machineConfigs.map((row, idx) => (
                          (parseFloat(row.duration) > 0) && (
                            <div key={idx} className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                              <span className="flex flex-col">
                                <span className="font-bold text-slate-705 dark:text-slate-350">Machine {idx + 1} Diesel</span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {parseFloat(form.dailyUsage) || 0}L/d × ₦{(parseFloat(form.dieselCostPerLtr) || 0).toLocaleString()}/L × {parseFloat(row.duration) || 0}d
                                </span>
                              </span>
                              <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                                ₦{((parseFloat(form.dailyUsage) || 0) * (parseFloat(form.dieselCostPerLtr) || 0) * (parseFloat(row.duration) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )
                        ))
                      ) : (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Diesel Cost</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {parseInt(form.noOfMachine) || 0} machine{parseInt(form.noOfMachine) !== 1 ? 's' : ''} × {parseFloat(form.dailyUsage) || 0}L/d × ₦{(parseFloat(form.dieselCostPerLtr) || 0).toLocaleString()}/L × {livePreview.maxDuration}d
                            </span>
                          </span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                            ₦{livePreview.dieselCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                      <div className="flex justify-between font-bold text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/20 p-2.5 rounded-lg border border-orange-100 dark:border-orange-900">
                        <span>Total Diesel Cost</span>
                        <span className="font-mono">₦{livePreview.dieselCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Machine Rental breakdown card */}
                {(livePreview.rentalCost > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-5 shadow-sm space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-2">Machine Calculation</p>
                    <div className="space-y-3.5 text-xs">
                      {machineConfigs.length > 0 ? (
                        machineConfigs.map((row, idx) => (
                          (parseFloat(row.rate) > 0 || parseFloat(row.duration) > 0) && (
                            <div key={idx} className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                              <span className="flex flex-col">
                                <span className="font-bold text-slate-705 dark:text-slate-350">Machine {idx + 1}</span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ₦{(parseFloat(row.rate) || 0).toLocaleString()}/d × {parseFloat(row.duration) || 0}d
                                </span>
                              </span>
                              <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                                ₦{((parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )
                        ))
                      ) : (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Rental Cost</span>
                            <span className="text-[10px] text-slate-400 font-medium">No machine config set</span>
                          </span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                            ₦{livePreview.rentalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                      <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900">
                        <span>Total Machine Cost</span>
                        <span className="font-mono">₦{livePreview.rentalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Charges breakdown card (Mob/Demob, Installation, Damages) */}
                {(livePreview.mobDemob > 0 || livePreview.installation > 0 || livePreview.damages > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 p-5 shadow-sm space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border-b border-slate-100 dark:border-slate-800 pb-2">Other Charges</p>
                    <div className="space-y-3.5 text-xs">
                      {livePreview.mobDemob > 0 && (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Mob / Demob</span>
                            <span className="text-[10px] text-slate-400 font-medium">Mobilisation &amp; demobilisation fee</span>
                          </span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                            ₦{livePreview.mobDemob.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {livePreview.installation > 0 && (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Installation</span>
                            <span className="text-[10px] text-slate-400 font-medium">Installation &amp; setup charges</span>
                          </span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                            ₦{livePreview.installation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {livePreview.damages > 0 && (
                        <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                          <span className="flex flex-col">
                            <span className="font-bold text-slate-705 dark:text-slate-350">Damages</span>
                            <span className="text-[10px] text-slate-400 font-medium">Damage &amp; repair charges</span>
                          </span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                            ₦{livePreview.damages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                      <div className="flex justify-between font-bold text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900">
                        <span>Total Other Charges</span>
                        <span className="font-mono">₦{(livePreview.mobDemob + livePreview.installation + livePreview.damages).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>,
          document.getElementById('layout-content-wrapper')!
        )}

        {/* Next Invoice Machine Selection Dialog */}
         {nextInvoiceDialog && nextInvoiceSource && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-bold text-slate-800 uppercase tracking-tight text-sm flex items-center gap-2">
                   <PlusCircle className="w-4 h-4 text-orange-500" /> Select Machines
                 </h3>
                 <button onClick={() => setNextInvoiceDialog(false)} className="text-slate-400 hover:text-slate-600">
                   <X className="w-5 h-5" />
                 </button>
               </div>
               <div className="p-6 space-y-4">
                 <p className="text-xs text-slate-500 leading-relaxed">
                   Invoice <span className="font-bold text-slate-700">#{nextInvoiceSource.invoiceNumber}</span> contains multiple machines. Select which ones to include in the next billing cycle.
                 </p>
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                   <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group">
                     <input 
                       type="checkbox" 
                       className="w-4 h-4 accent-orange-500"
                       checked={selectedNextMachines.length === nextInvoiceSource.noOfMachine}
                       onChange={(e) => {
                         if (e.target.checked) {
                           setSelectedNextMachines(Array.from({ length: nextInvoiceSource.noOfMachine || 0 }, (_, i) => i));
                         } else {
                           setSelectedNextMachines([]);
                         }
                       }}
                     />
                     <span className="text-sm font-bold text-slate-700 group-hover:text-orange-600">Select All Machines</span>
                   </label>
                   <div className="h-px bg-slate-100 my-1" />
                   {Array.from({ length: nextInvoiceSource.noOfMachine || 0 }).map((_, idx) => (
                     <label key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-50 hover:border-orange-100 hover:bg-orange-50/30 cursor-pointer transition-colors group">
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 accent-orange-500"
                         checked={selectedNextMachines.includes(idx)}
                         onChange={(e) => {
                           if (e.target.checked) {
                             setSelectedNextMachines([...selectedNextMachines, idx]);
                           } else {
                             setSelectedNextMachines(selectedNextMachines.filter(i => i !== idx));
                           }
                         }}
                       />
                       <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">Machine {idx + 1}</span>
                     </label>
                   ))}
                 </div>
               </div>
               <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                 <Button variant="outline" className="flex-1 h-10 text-xs font-bold uppercase tracking-tight" onClick={() => setNextInvoiceDialog(false)}>Cancel</Button>
                 <Button 
                   className="flex-1 h-10 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-tight shadow-md disabled:opacity-50"
                   disabled={selectedNextMachines.length === 0}
                   onClick={() => prepareNextInvoice(nextInvoiceSource, selectedNextMachines)}
                 >
                   Continue <ArrowRightCircle className="ml-2 w-4 h-4" />
                 </Button>
               </div>
             </div>
           </div>
         )}

        {/* Import Modal Options */}
        {importFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Import Policy</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                How would you like to process the {activeTab === 'active' ? 'Active' : 'Pending'} Invoice records from this CSV file?
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => processImport(importFile, 'update')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex-col items-center justify-center">
                  <span className="font-semibold block text-base">Update & Add (Recommended)</span>
                  <span className="block text-xs opacity-80 mt-1 font-normal text-center">Modifies matching IDs. Adds missing ones. Leaves others alone.</span>
                </Button>
                <Button onClick={() => processImport(importFile, 'append')} variant="outline" className="border-slate-200 h-auto py-3 text-slate-700 hover:bg-slate-50 flex-col items-center justify-center">
                  <span className="font-semibold block text-base">Append Only</span>
                  <span className="block text-xs text-slate-500 mt-1 font-normal text-center">Adds every row as a brand new record, completely ignoring current IDs.</span>
                </Button>
                <Button onClick={() => processImport(importFile, 'replace')} variant="outline" className="border-rose-200 h-auto py-3 text-rose-600 hover:bg-rose-50 flex-col items-center justify-center">
                  <span className="font-semibold block text-base">Replace Entire List</span>
                  <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes current records that are NOT in this CSV. Updates matches. Adds new ones.</span>
                </Button>
                <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Invoice Detail Dialog */}
        <InvoiceDetailDialog
          invoice={detailInvoice}
          invoiceList={currentList ?? []}
          open={detailInvoice !== null}
          onClose={() => setDetailInvoice(null)}
          onNavigate={(inv) => setDetailInvoice(inv)}
          onEdit={(inv) => { setDetailInvoice(null); handleEdit(inv); }}
          onPrint={(inv) => { setDetailInvoice(null); setPrintInvoiceTarget(inv); }}
        />
      </div>
    );
}

// ── Invoice Print Component ──
function toWords(num: number): string {
  if (num === 0) return 'Zero Naira Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const convertHundreds = (n: number) => {
    let res = '';
    if (n > 99) { res += a[Math.floor(n / 100)] + ' Hundred '; n %= 100; if(n > 0) res += 'and '; }
    if (n > 19) { res += b[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) { res += a[n] + ' '; }
    return res.trim();
  };
  let str = '';
  let intPart = Math.floor(num);
  let decPart = Math.round((num - intPart) * 100);
  if (intPart === 0) str = 'Zero ';
  else {
    let scaleIdx = 0;
    while (intPart > 0) {
      let chunk = intPart % 1000;
      if (chunk > 0) {
        str = convertHundreds(chunk) + (scales[scaleIdx] ? ' ' + scales[scaleIdx] + ' ' : ' ') + str;
      }
      intPart = Math.floor(intPart / 1000);
      scaleIdx++;
    }
  }
  str = str.replace(/\s+/g, ' ').trim();
  if (decPart > 0) {
    str += ' Naira and ' + convertHundreds(decPart) + ' Kobo Only';
  } else {
    str += ' Naira Only';
  }
  return str;
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}

function formatDateRange(startDateStr: string, durationDays: number): string {
  if (!startDateStr || !durationDays) return '';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return '';
  
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays - 1);
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = start.getMonth();
  const eMonth = end.getMonth();
  const sYear = start.getFullYear();
  const eYear = end.getFullYear();
  
  const sDayStr = `${sDay}${getOrdinalSuffix(sDay)}`;
  const eDayStr = `${eDay}${getOrdinalSuffix(eDay)}`;
  
  if (sYear !== eYear) {
    return `(${sDayStr} ${months[sMonth]} ${sYear} - ${eDayStr} ${months[eMonth]} ${eYear})`;
  }
  if (sMonth !== eMonth) {
    return `(${sDayStr} ${months[sMonth]} - ${eDayStr} ${months[eMonth]} ${sYear})`;
  }
  return `(${sDayStr} - ${eDayStr} ${fullMonths[sMonth]} ${sYear})`;
}

function getAmtStyle(amountVal: number) {
  const str = `NGN ${amountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const len = str.length;
  const size = len > 18 ? '10px' : (len > 15 ? '11.5px' : '13px');
  return {
    whiteSpace: 'nowrap' as const,
    fontSize: size,
  };
}

function getLabelStyle(labelStr: string) {
  const len = labelStr.length;
  const size = len > 18 ? '10px' : (len > 15 ? '11.5px' : '13px');
  return {
    whiteSpace: 'nowrap' as const,
    fontSize: size,
  };
}

export function InvoicePrintModal({ invoice, onClose, ledgerBanks, ledgerBeneficiaryBanks }: { 
  invoice: any, 
  onClose: () => void,
  ledgerBanks: {id: string, name: string}[],
  ledgerBeneficiaryBanks: {id: string, name: string}[] 
}) {
  const printRef = React.useRef<HTMLDivElement>(null);
  
  const defaultBank = ledgerBeneficiaryBanks[0]?.name || ledgerBanks[0]?.name || 'Stanbic IBTC Bank\n0000000000';
  
  const getInitialBilledTo = () => {
    if (invoice.printLayout?.billedToInput) return invoice.printLayout.billedToInput;
    let defaultAddress = invoice.client || 'Client Name';
    const clientProfiles = useAppStore.getState().clientProfiles || [];
    const clientProfile = clientProfiles.find(c => c.name === invoice.client || c.id === invoice.clientId);
    if (clientProfile && clientProfile.address) {
      defaultAddress = `${clientProfile.name}\n${clientProfile.address}`;
    } else {
      defaultAddress = `${invoice.client || 'Client Name'}\nCompany Address\nCity`;
    }
    return defaultAddress;
  };

  const getInitialProjectText = () => {
    if (invoice.printLayout?.projectText) return invoice.printLayout.projectText;
    const clientName = invoice.client;
    if (!clientName) return 'DCEL- SED';
    
    const cleanName = clientName.replace(/[^a-zA-Z0-9\s]/g, '');
    let words = cleanName.trim().split(/\s+/).filter(Boolean);
    
    const suffixes = ['limited', 'ltd', 'plc', 'incorporated', 'inc', 'co', 'company', 'corp', 'corporation'];
    const filteredWords = words.filter(w => !suffixes.includes(w.toLowerCase()));
    if (filteredWords.length > 0) {
      words = filteredWords;
    }
    
    let abbreviation = '';
    if (words.length >= 3) {
      abbreviation = words.map(w => w[0]).join('').toUpperCase();
    } else if (words.length === 2) {
      const first = words[0];
      const second = words[1];
      const part1 = first.substring(0, Math.min(2, first.length));
      const part2 = second.substring(0, Math.max(1, 3 - part1.length));
      abbreviation = (part1 + part2).toUpperCase();
    } else if (words.length === 1) {
      const word = words[0];
      abbreviation = word.substring(0, Math.min(3, word.length)).toUpperCase().padEnd(3, 'X');
    } else {
      abbreviation = 'SED';
    }
    
    return `DCEL- ${abbreviation}`;
  };

  const getInitialPaymentsCredits = () => {
    if (invoice.printLayout?.paymentsCredits !== undefined) {
      return invoice.printLayout.paymentsCredits;
    }

    const allPayments = useAppStore.getState().payments || [];
    const invClient = (invoice.client || '').trim().toLowerCase();
    const invSite = ((invoice as any).siteName || (invoice as any).site || '').trim().toLowerCase();
    
    // Filter payments for this client and site
    const clientSitePayments = allPayments.filter(p => 
      p.client?.trim().toLowerCase() === invClient &&
      p.site?.trim().toLowerCase() === invSite
    );

    if (clientSitePayments.length === 0) return 0;

    // Filter all invoices for this client and site
    const allInvoices = [
      ...(useAppStore.getState().invoices || []),
      ...(useAppStore.getState().pendingInvoices || [])
    ];
    
    const clientSiteInvoices = allInvoices.filter(i => 
      i.client?.trim().toLowerCase() === invClient &&
      (((i as any).siteName || (i as any).site || '').trim().toLowerCase() === invSite)
    );

    // Sort chronologically by date
    const sortedInvs = [...clientSiteInvoices].sort((a, b) => {
      const dateAStr = (a as any).date || (a as any).startDate || '';
      const dateBStr = (b as any).date || (b as any).startDate || '';
      const dateA = dateAStr ? new Date(normalizeDate(dateAStr)).getTime() : 0;
      const dateB = dateBStr ? new Date(normalizeDate(dateBStr)).getTime() : 0;
      return dateA - dateB;
    });

    const curIndex = sortedInvs.findIndex(i => i.id === invoice.id);
    if (curIndex === -1) return 0;

    const curInvDateStr = (sortedInvs[curIndex] as any).date || (sortedInvs[curIndex] as any).startDate || '';
    const curInvDate = curInvDateStr ? new Date(normalizeDate(curInvDateStr)).getTime() : 0;
    
    // Window starts 5 days before this invoice date
    const windowStart = curInvDate - (5 * 24 * 60 * 60 * 1000);
    
    // Window ends 5 days before the next invoice date (if one exists)
    let windowEnd = Infinity;
    if (curIndex < sortedInvs.length - 1) {
      const nextInvDateStr = (sortedInvs[curIndex + 1] as any).date || (sortedInvs[curIndex + 1] as any).startDate || '';
      const nextInvDate = nextInvDateStr ? new Date(normalizeDate(nextInvDateStr)).getTime() : 0;
      windowEnd = nextInvDate - (5 * 24 * 60 * 60 * 1000);
    }

    // Filter payments in this window
    const matchedPayments = clientSitePayments.filter(p => {
      const pDate = p.date ? new Date(normalizeDate(p.date)).getTime() : 0;
      return pDate >= windowStart && pDate < windowEnd;
    });

    if (matchedPayments.length > 0) {
      return matchedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }

    return 0;
  };

  const [billedToInput, setBilledToInput] = useState(getInitialBilledTo());
  const [paidToInput, setPaidToInput] = useState(invoice.printLayout?.paidToInput || 'STANBIC IBTC BANK\n0021939731\nDewatering Construction etc Limited');
  const [projectText, setProjectText] = useState(getInitialProjectText());
  const [termsText, setTermsText] = useState(invoice.printLayout?.termsText || 'For Immediate Payment');
  
  const formatInitialDate = (d: string) => {
    if (!d) return '';
    const p = d.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return d;
  };

  const [invoiceDate, setInvoiceDate] = useState(invoice.printLayout?.invoiceDate || formatInitialDate(invoice.date || invoice.startDate || ''));
  const [invoiceNo, setInvoiceNo] = useState(invoice.printLayout?.invoiceNo || invoice.invoiceNumber || invoice.invoiceNo || '');
  const [paymentsCredits, setPaymentsCredits] = useState<string>(
    invoice.printLayout?.paymentsCredits !== undefined 
      ? String(invoice.printLayout.paymentsCredits) 
      : String(getInitialPaymentsCredits())
  );
  const [paymentsCreditsLabel, setPaymentsCreditsLabel] = useState(invoice.printLayout?.paymentsCreditsLabel || 'Payments/Credits');
  
  const [combineDiesel, setCombineDiesel] = useState(invoice.printLayout?.combineDiesel || false);
  const [combineIdenticalPumps, setCombineIdenticalPumps] = useState(invoice.printLayout?.combineIdenticalPumps || false);

  const generateDieselItems = (combine: boolean, maxMachineDuration: number) => {
    const list: any[] = [];
    if (!(invoice.dieselCost && invoice.dieselCost > 0)) return list;

    const dailyUsage = parseFloat(invoice.dailyUsage) || 0;
    const dieselCostPerLtr = parseFloat(invoice.dieselCostPerLtr) || 0;

    if (invoice.machineConfigs && invoice.machineConfigs.length > 0 && !combine) {
      const configs: any[] = invoice.machineConfigs;
      const firstDur  = parseFloat(configs[0]?.duration) || 0;
      const resolved = configs.map((m: any) => ({
        duration: m.sameDurationAsFirst ? firstDur : (parseFloat(m.duration) || 0),
      }));

      const dieselGroups = new Map<number, { duration: number; count: number }>();
      resolved.forEach((m) => {
        if (m.duration > 0) {
          const key = m.duration;
          if (!dieselGroups.has(key)) dieselGroups.set(key, { duration: m.duration, count: 0 });
          dieselGroups.get(key)!.count++;
        }
      });

      dieselGroups.forEach((g) => {
        const unitDieselCost = dailyUsage * dieselCostPerLtr * g.duration;
        const totalDieselCost = unitDieselCost * g.count;
        const pumpLabel = g.count > 1 ? `${g.count} Pumps` : '1 Pump';
        list.push({
          id: generateId(),
          selected: true,
          type: 'diesel',
          desc: `Diesel Supply for ${pumpLabel} (${dailyUsage}L/day per pump for ${g.duration} Days @ ₦${dieselCostPerLtr.toLocaleString()}/L)`,
          qty: g.count,
          unitRate: unitDieselCost,
          amount: totalDieselCost,
        });
      });
    } else {
      let totalLiters = 0;
      let totalCost = 0;
      let pumpCount = 0;

      if (invoice.machineConfigs && invoice.machineConfigs.length > 0) {
        const configs: any[] = invoice.machineConfigs;
        const firstDur  = parseFloat(configs[0]?.duration) || 0;
        const resolved = configs.map((m: any) => ({
          duration: m.sameDurationAsFirst ? firstDur : (parseFloat(m.duration) || 0),
        }));

        resolved.forEach((m) => {
          totalLiters += dailyUsage * m.duration;
          totalCost += dailyUsage * dieselCostPerLtr * m.duration;
          pumpCount++;
        });

        const pumpLabel = pumpCount > 1 ? `${pumpCount} Pumps` : '1 Pump';
        list.push({
          id: generateId(),
          selected: true,
          type: 'diesel',
          desc: `Diesel Supply (Estimated ${totalLiters.toLocaleString()} Liters total for ${pumpLabel} at varying durations @ ₦${dieselCostPerLtr.toLocaleString()}/L)`,
          qty: 1,
          unitRate: totalCost,
          amount: totalCost,
        });
      } else {
        list.push({ 
          id: generateId(), 
          selected: true, 
          type: 'diesel',
          desc: `Diesel Supply (${invoice.dailyUsage || 0}L/day for ${maxMachineDuration} Days @ ₦${(invoice.dieselCostPerLtr || 0).toLocaleString()}/L)`, 
          qty: 1, 
          unitRate: invoice.dieselCost, 
          amount: invoice.dieselCost 
        });
      }
    }
    return list;
  };

  const handleToggleCombineDiesel = (checked: boolean) => {
    setCombineDiesel(checked);
    setItems(prev => {
      const nonDieselItems = prev.filter(item => item.type !== 'diesel');
      let insertIndex = prev.findIndex(item => item.type === 'diesel');
      if (insertIndex === -1) {
        insertIndex = prev.findIndex(item => item.type === 'rental');
        if (insertIndex !== -1) {
          while (insertIndex < prev.length && prev[insertIndex].type === 'rental') {
            insertIndex++;
          }
        } else {
          insertIndex = 0;
        }
      }
      
      let maxMachineDuration = invoice.duration || 0;
      if (invoice.machineConfigs && invoice.machineConfigs.length > 0) {
        const configs: any[] = invoice.machineConfigs;
        const firstDur  = parseFloat(configs[0]?.duration) || 0;
        const resolved = configs.map((m: any) => ({
          duration: m.sameDurationAsFirst ? firstDur : (parseFloat(m.duration) || 0),
        }));
        maxMachineDuration = Math.max(...resolved.map(m => m.duration));
      }

      const newDiesels = generateDieselItems(checked, maxMachineDuration);
      const nextItems = [...nonDieselItems];
      nextItems.splice(insertIndex, 0, ...newDiesels);
      return nextItems;
    });
  };

  // Helper: merge rental items that share the same unitRate into qty>1 lines
  const applyIdenticalPumpMerge = (allItems: any[], combine: boolean): any[] => {
    if (!combine) return allItems;
    const rentals = allItems.filter(i => i.type === 'rental');
    const others  = allItems.filter(i => i.type !== 'rental');
    // Group rentals by unitRate (same rate+duration produces same unitRate)
    const groups = new Map<number, any[]>();
    rentals.forEach(r => {
      const key = r.unitRate;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    const merged: any[] = [];
    groups.forEach((group) => {
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        const base = group[0];
        const n = group.length;
        // Rewrite description: replace "Pump N: Lease of 1" with "Lease of N"
        const newDesc = base.desc
          .replace(/^Pump \d+: Lease of 1 /i, `Lease of ${n} `)
          .replace(/Pump \d+: /i, '');
        merged.push({
          ...base,
          desc: newDesc,
          qty: n,
          amount: base.unitRate * n,
        });
      }
    });
    // Rebuild: rentals first, then others
    return [...merged, ...others];
  };

  const handleToggleCombineIdenticalPumps = (checked: boolean) => {
    setCombineIdenticalPumps(checked);
    setItems(prev => {
      // First, fully expand any previously merged rental back to individual lines
      const expanded: any[] = [];
      prev.forEach(item => {
        if (item.type === 'rental' && item.qty > 1) {
          // re-expand into individual pump lines
          for (let i = 0; i < item.qty; i++) {
            expanded.push({
              ...item,
              id: generateId(),
              desc: item.desc
                .replace(/Lease of \d+ /i, 'Lease of 1 ')
                .replace(/^/, `Pump ${i + 1}: `),
              qty: 1,
              amount: item.unitRate,
            });
          }
        } else {
          expanded.push(item);
        }
      });
      if (!checked) return expanded;
      return applyIdenticalPumpMerge(expanded, true);
    });
  };

  const [items, setItems] = useState<any[]>(() => {
    if (invoice.printLayout?.items) return invoice.printLayout.items;
    const list = [];
    
    let maxMachineDuration = invoice.duration || 0;
    const sites = useAppStore.getState().sites || [];
    const siteName = (invoice.siteName || invoice.site || '').trim();
    const clientName = (invoice.client || '').trim();
    const realSite = sites.find(s => s.name === siteName && s.client === clientName) || sites.find(s => s.name === clientName && s.client === siteName);
    const siteLocation = realSite?.address ? ` at ${realSite.address}` : (invoice.siteName || invoice.site ? ` at ${invoice.siteName || invoice.site}` : '');

    if (invoice.machineConfigs && invoice.machineConfigs.length > 0) {
      const configs: any[] = invoice.machineConfigs;
      const firstRate = parseFloat(configs[0]?.rate) || 0;
      const firstDur  = parseFloat(configs[0]?.duration) || 0;

      const resolved = configs.map((m: any) => ({
        rate:     m.sameRateAsFirst     ? firstRate : (parseFloat(m.rate)     || 0),
        duration: m.sameDurationAsFirst ? firstDur  : (parseFloat(m.duration) || 0),
      }));

      maxMachineDuration = Math.max(...resolved.map(m => m.duration));

      let pumpNum = 1;
      resolved.forEach((m) => {
        const unitCost  = m.rate * m.duration;
        const dateRangeStr = formatDateRange(invoice.startDate || invoice.date, m.duration);
        const dateRangeSuffix = dateRangeStr ? ` ${dateRangeStr}` : '';
        list.push({
          id: generateId(),
          selected: true,
          type: 'rental',
          desc: `Pump ${pumpNum}: Lease of 1 Dewatering Pump @ ₦${m.rate.toLocaleString()} per pump for ${m.duration} days.${dateRangeSuffix}${siteLocation}.`,
          qty: 1,
          unitRate: unitCost,
          amount: unitCost,
        });
        pumpNum++;
      });

      const dieselItems = generateDieselItems(invoice.printLayout?.combineDiesel || false, maxMachineDuration);
      list.push(...dieselItems);
    } else if (invoice.rentalCost && invoice.rentalCost > 0) {
      const n = invoice.noOfMachine || 1;
      const pumpLabel = n > 1 ? `${n} Dewatering Pumps` : '1 Dewatering Pump';
      const dateRangeStr = formatDateRange(invoice.startDate || invoice.date, invoice.duration || 0);
      const dateRangeSuffix = dateRangeStr ? ` ${dateRangeStr}` : '';
      list.push({ 
        id: generateId(), 
        selected: true, 
        type: 'rental',
        desc: `Phase 1\nLease of ${pumpLabel} @ ₦${(invoice.dailyRentalCost || 0).toLocaleString()} per pump for ${invoice.duration || 0} days.${dateRangeSuffix}${siteLocation}.`, 
        qty: n, 
        unitRate: (invoice.dailyRentalCost || 0) * (invoice.duration || 0), 
        amount: invoice.rentalCost 
      });
    }
    
    if (invoice.techniciansCost && invoice.techniciansCost > 0) {
      const actualTechDuration = invoice.technicianDurationSameAsMachine !== false 
        ? maxMachineDuration 
        : (parseFloat(invoice.technicianDuration) || invoice.duration || 0);

      const actualNightDuration = invoice.technicianNightDurationSameAsMachine !== false
        ? maxMachineDuration
        : (parseFloat(invoice.technicianNightDuration) || 0);

      const dayRate   = parseFloat(String(invoice.techniciansDailyRate || 0)) || 0;
      const nightRate = parseFloat(String((invoice as any).technicianNightFee || 0)) || 0;
      const accomRate = parseFloat(String((invoice as any).technicianAccommodation || 0)) || 0;

      // Resolve crew counts (backwards compatible: null/undefined night count = same as day)
      const isNightCountSame = (invoice as any).technicianNightCountSameAsDay !== false;
      const noOfTechDay  = invoice.noOfTechnician || 0;
      const noOfTechNight = isNightCountSame ? noOfTechDay : ((invoice as any).noOfTechnicianNight || 0);
      const useNightForAccom = (invoice as any).technicianAccommodationUseNightCount ?? false;
      const accomCrewCount = useNightForAccom ? noOfTechNight : noOfTechDay;

      const hasMultiComponent = nightRate > 0 || accomRate > 0;

      if (hasMultiComponent) {
        // Option B: Separate line items for each component
        if (dayRate > 0 && noOfTechDay > 0) {
          const dayCost = noOfTechDay * dayRate * actualTechDuration;
          list.push({
            id: generateId(),
            selected: true,
            type: 'technician',
            desc: `Day Shift Technician Charge\n${noOfTechDay} dewatering staff @ ₦${dayRate.toLocaleString()}/tech/day for ${actualTechDuration} day${actualTechDuration !== 1 ? 's' : ''}.`,
            qty: noOfTechDay,
            unitRate: dayRate * actualTechDuration,
            amount: dayCost,
          });
        }
        if (nightRate > 0 && noOfTechNight > 0 && actualNightDuration > 0) {
          const nightCost = noOfTechNight * nightRate * actualNightDuration;
          list.push({
            id: generateId(),
            selected: true,
            type: 'technician',
            desc: `Night Shift Technician Charge\n${noOfTechNight} dewatering staff @ ₦${nightRate.toLocaleString()}/tech/night for ${actualNightDuration} night${actualNightDuration !== 1 ? 's' : ''}.`,
            qty: noOfTechNight,
            unitRate: nightRate * actualNightDuration,
            amount: nightCost,
          });
        }
        if (accomRate > 0 && accomCrewCount > 0) {
          const accomCost = accomCrewCount * accomRate * actualTechDuration;
          list.push({
            id: generateId(),
            selected: true,
            type: 'technician',
            desc: `Crew Accommodation Charge\n${accomCrewCount} staff @ ₦${accomRate.toLocaleString()}/tech/day for ${actualTechDuration} day${actualTechDuration !== 1 ? 's' : ''}.`,
            qty: accomCrewCount,
            unitRate: accomRate * actualTechDuration,
            amount: accomCost,
          });
        }
      } else {
        // Simple single day-rate line item
        const techDesc = `Technician Charge for ${noOfTechDay} dewatering staff @ ₦${dayRate.toLocaleString()} per technician per day for ${actualTechDuration} day${actualTechDuration !== 1 ? 's' : ''}.`;
        list.push({
          id: generateId(),
          selected: true,
          type: 'technician',
          desc: techDesc,
          qty: noOfTechDay,
          unitRate: dayRate * actualTechDuration,
          amount: invoice.techniciansCost,
        });
      }
    }
    
    if (!list.some(item => item.type === 'diesel') && invoice.dieselCost && invoice.dieselCost > 0) {
      const dieselItems = generateDieselItems(invoice.printLayout?.combineDiesel || false, maxMachineDuration);
      list.push(...dieselItems);
    }
    
    if (invoice.mobDemob && invoice.mobDemob > 0) {
      list.push({ id: generateId(), selected: true, type: 'mobDemob', desc: `Mobilization / Demobilization`, qty: 1, unitRate: invoice.mobDemob, amount: invoice.mobDemob });
    }
    if (invoice.installation && invoice.installation > 0) {
      list.push({ id: generateId(), selected: true, type: 'installation', desc: `Installation`, qty: 1, unitRate: invoice.installation, amount: invoice.installation });
    }
    if (invoice.damages && invoice.damages > 0) {
      list.push({ id: generateId(), selected: true, type: 'damages', desc: `Damages / Repairs`, qty: 1, unitRate: invoice.damages, amount: invoice.damages });
    }
    if (list.length === 0) {
       list.push({ id: generateId(), selected: true, type: 'custom', desc: 'Description of service...', qty: 1, amount: 0 });
    }
    return list;
  });

  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const vatRate = parseFloat(String(useAppStore.getState().payrollVariables?.vatRate || '7.5')) || 7.5;

  const discountAmount = parseFloat(String(paymentsCredits).replace(/,/g, '')) || 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const vatIncSetting = invoice.vatInc;
  let totalCharge = discountedSubtotal;
  let vat = 0;
  if (vatIncSetting === 'Yes') {
    vat = (discountedSubtotal / (100 + vatRate)) * vatRate;
  } else if (vatIncSetting === 'Add') {
    vat = discountedSubtotal * (vatRate / 100);
    totalCharge = discountedSubtotal + vat;
  }
  
  const calcBalanceDue = totalCharge;
  
  const [customWords, setCustomWords] = useState<string>('TOTAL AMOUNT IN WORD: ' + toWords(calcBalanceDue));
  
  React.useEffect(() => {
    setCustomWords('TOTAL AMOUNT IN WORD: ' + toWords(calcBalanceDue));
  }, [calcBalanceDue]);

  const wordsValue = customWords;
  const [extraNote, setExtraNote] = useState(invoice.printLayout?.extraNote || '');
  const [footerText, setFooterText] = useState(invoice.printLayout?.footerText || 'We look forward to your swift response.');
  
  const [footerCompany, setFooterCompany] = useState(invoice.printLayout?.footerCompany || 'DEWATERING CONSTRUCTION ETC LIMITED');
  const [footerContact, setFooterContact] = useState(invoice.printLayout?.footerContact || '09030002182, 08028280712');
  const [footerEmail, setFooterEmail] = useState(invoice.printLayout?.footerEmail || 'info@dewaterconstruct.com');

  const [isSaving, setIsSaving] = React.useState(false);

  // ── Dirty tracking ─────────────────────────────────────────────────
  const initialSnapshot = React.useRef(
    JSON.stringify({
      items: invoice.printLayout?.items || null,
      invoiceDate: invoice.printLayout?.invoiceDate || invoice.date || invoice.startDate || '',
      invoiceNo: invoice.printLayout?.invoiceNo || invoice.invoiceNumber || invoice.invoiceNo || '',
      customWords: invoice.printLayout?.customWords || null,
      paymentsCredits: getInitialPaymentsCredits(),
      paymentsCreditsLabel: invoice.printLayout?.paymentsCreditsLabel || 'Payments/Credits',
      footerCompany: invoice.printLayout?.footerCompany || 'DEWATERING CONSTRUCTION ETC LIMITED',
      footerContact: invoice.printLayout?.footerContact || '09030002182, 08028280712',
      footerEmail: invoice.printLayout?.footerEmail || 'info@dewaterconstruct.com',
      extraNote: invoice.printLayout?.extraNote || '',
      footerText: invoice.printLayout?.footerText || 'We look forward to your swift response.',
      billedToInput: getInitialBilledTo(),
      paidToInput: invoice.printLayout?.paidToInput || 'STANBIC IBTC BANK\n0021939731\nDewatering Construction etc Limited',
      projectText: getInitialProjectText(),
      termsText: invoice.printLayout?.termsText || 'For Immediate Payment',
      combineDiesel: invoice.printLayout?.combineDiesel || false,
      combineIdenticalPumps: invoice.printLayout?.combineIdenticalPumps || false,
    })
  );

  const currentSnapshot = JSON.stringify({
    items, invoiceDate, invoiceNo, customWords, paymentsCredits,
    footerCompany, footerContact, footerEmail, extraNote, footerText,
    billedToInput, paidToInput, projectText, termsText,
    combineDiesel, combineIdenticalPumps,
  });

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot.current;

  // After a successful save, update the snapshot so the badge disappears
  const updateSnapshot = () => {
    initialSnapshot.current = JSON.stringify({
      items, invoiceDate, invoiceNo, customWords, paymentsCredits,
      footerCompany, footerContact, footerEmail, extraNote, footerText,
      billedToInput, paidToInput, projectText, termsText,
    });
  };

  // ── Leave confirmation ─────────────────────────────────────────────
  const [showLeaveDialog, setShowLeaveDialog] = React.useState(false);

  const guardedClose = () => {
    if (hasUnsavedChanges) {
      setShowLeaveDialog(true);
    } else {
      onClose();
    }
  };

  // ── History viewer ─────────────────────────────────────────────────
  const historyLog: any[] = (invoice as any).historyLog || [];
  const savedLayout = invoice.printLayout;
  const [showHistory, setShowHistory] = React.useState(false);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    // Read live .value from React-controlled elements BEFORE cloning
    // (cloneNode copies HTML attributes, not the live .value property)
    const liveTextareas = Array.from(
      content.querySelectorAll<HTMLTextAreaElement>('textarea.hide-on-print')
    );
    const liveInputs = Array.from(
      content.querySelectorAll<HTMLInputElement>('input.hide-on-print')
    );
    const taValues  = liveTextareas.map(el => el.getAttribute('data-print-value') || el.value);
    const inpValues = liveInputs.map(el => el.getAttribute('data-print-value') || el.value);

    // Clone so mutations don't affect the live UI
    const clone = content.cloneNode(true) as HTMLElement;

    // Replace each textarea.hide-on-print with a value-bearing span
    Array.from(clone.querySelectorAll<HTMLTextAreaElement>('textarea.hide-on-print'))
      .forEach((ta, i) => {
        const span = document.createElement('span');
        span.style.whiteSpace = 'pre-wrap';
        span.textContent = taValues[i] ?? '';
        ta.parentNode?.replaceChild(span, ta);
      });

    // Replace each input.hide-on-print with a value-bearing span
    Array.from(clone.querySelectorAll<HTMLInputElement>('input.hide-on-print'))
      .forEach((inp, i) => {
        const span = document.createElement('span');
        span.textContent = inpValues[i] ?? '';
        inp.parentNode?.replaceChild(span, inp);
      });

    // Remove all remaining .hide-on-print elements (buttons, column TH/TD, etc.)
    Array.from(clone.querySelectorAll('.hide-on-print'))
      .forEach(el => el.parentNode?.removeChild(el));

    // Remove .show-on-print spans — no longer needed since inputs are replaced above
    Array.from(clone.querySelectorAll('.show-on-print'))
      .forEach(el => el.parentNode?.removeChild(el));

    // Use a hidden iframe so the browser's native print dialog opens
    // without spawning a new tab
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }

    iframeDoc.open();
    iframeDoc.write(`
      <html><head><title>Print Invoice ${invoiceNo}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; background-color: white; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13.5px; color: #111; background: white !important; line-height: 1.4; }

        /* No min-height, no flex-column — content determines page height naturally */
        .a4-page { width: 210mm; padding: 15mm; margin: auto; display: block; }

        .top-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px !important; }
        .logo-box { width: 60%; }
        .inv-header { text-align: right; width: 240px; }
        .inv-header h1 { font-family: 'Arial Black', Impact, sans-serif; font-size: 32px !important; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; color: #111; text-align: right; margin-top: 10px; }

        table.date-table { width: 100%; border-collapse: collapse !important; border: 1.5px solid #385296 !important; font-size: 13.5px; font-weight: bold; background: white; margin: 0 !important; }
        table.date-table th { border: 1.5px solid #385296 !important; padding: 4px !important; text-align: center; }
        table.date-table td { border: 1.5px solid #385296 !important; padding: 4px !important; text-align: center; font-weight: normal; vertical-align: middle; }

        .mid-section { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 20px !important; }
        .box { flex: 1; border: 1.5px solid #385296 !important; background: white; }
        .box-title { font-weight: bold; padding: 5px 8px !important; font-size: 13.5px; border-bottom: 1.5px solid #385296 !important; margin: 0 !important; }
        .box-content { padding: 8px !important; white-space: pre-wrap; font-size: 13.5px; min-height: 80px; }

        .project-terms { display: flex; justify-content: flex-end; margin-bottom: -1.5px !important; }
        table.pt-table { border-collapse: collapse !important; width: 340px; text-align: center; font-size: 12px; background: white; margin: 0 !important; }
        table.pt-table th, table.pt-table td { border: 1.5px solid #385296 !important; padding: 4px !important; }
        table.pt-table th { font-weight: normal; }
        table.pt-table td { font-weight: normal; }

        table.main-table { width: 100%; border-collapse: collapse !important; font-size: 12px; background: white; margin: 0 !important; }
        table.main-table th { border: 1.5px solid #385296 !important; padding: 6px 8px !important; text-align: center; font-weight: bold; background: white; }
        table.main-table td { border: 1.5px solid #385296 !important; padding: 5px 7px !important; vertical-align: middle; }
        table.main-table tr.category-header td { font-weight: bold; background: white !important; border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
        table.main-table tr.subtotal-row td { font-weight: bold; border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
        table.main-table tr.summary-row td { border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
        table.main-table tr.grand-total-row td { font-weight: bold; border: 1.5px solid #385296 !important; padding: 6px 8px !important; }
        .borderless-cell { border: none !important; background: transparent !important; }
        .sn-col { width: 6%; text-align: center !important; }
        .desc-col { width: 45%; }
        .unit-col { width: 9%; text-align: center !important; }
        .rate-col { width: 20%; text-align: right !important; padding-right: 8px !important; }
        .amt-col { width: 20%; text-align: right !important; padding-right: 8px !important; }

        /* padding-top only — no margin-top:auto so footer stays right after content */
        .footer { padding-top: 30px; font-size: 13.5px; line-height: 1.4; font-weight: bold; page-break-inside: avoid; }

        .hide-on-print { display: none !important; }
        .show-on-print { display: inline-block !important; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .a4-page { margin: 0 !important; padding: 10mm !important; box-shadow: none !important; }
        }
      </style></head><body>
      ${clone.innerHTML}
      </body></html>
    `);
    iframeDoc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Clean up iframe after print dialog closes
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  };

  const handleSaveLayout = async () => {
    const layout = {
      items,
      invoiceDate,
      invoiceNo,
      customWords,
      paymentsCredits,
      paymentsCreditsLabel,
      footerCompany,
      footerContact,
      footerEmail,
      extraNote,
      footerText,
      billedToInput,
      paidToInput,
      projectText,
      termsText,
      combineDiesel,
      combineIdenticalPumps,
    };

    const actionLog = {
      date: new Date().toISOString(),
      action: 'Saved Print Layout',
      totalCharge: totalCharge,
    };

    const isPending = 'invoiceNo' in invoice;
    const currentId = invoice.id;
    const newHistory = [...((invoice as any).historyLog || []), actionLog];
    const table = isPending ? 'pending_invoices' : 'invoices';

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ print_layout: layout, history_log: newHistory })
        .eq('id', currentId);

      if (error) throw error;

      if (isPending) {
        useAppStore.getState().updatePendingInvoice(currentId, { printLayout: layout, historyLog: newHistory });
      } else {
        useAppStore.getState().updateInvoice(currentId, { printLayout: layout, historyLog: newHistory });
      }

      toast.success('Invoice layout saved successfully');
      updateSnapshot();
    } catch (e: any) {
      console.error('Save layout error:', e);
      toast.error('Failed to save layout: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = (index: number, k: string, val: string | number | boolean) => {
    const newItems = [...items];
    (newItems[index] as any)[k] = val;
    setItems(newItems);
  };
  
  const handleAddItem = () => {
    setItems([...items, { id: generateId(), selected: true, type: 'custom', desc: 'New Line Item', qty: 1, unitRate: 0, amount: 0 }]);
  };

  const handleAddCapexItem = () => {
    // Insert after the last capex-typed item so it stays in Part A
    const capexSet = new Set(['mobDemob', 'installation', 'damages', 'capex']);
    const lastCapexIdx = items.reduce((acc, it, i) => capexSet.has(it.type) ? i : acc, -1);
    const insertAt = lastCapexIdx === -1 ? 0 : lastCapexIdx + 1;
    const next = [...items];
    next.splice(insertAt, 0, { id: generateId(), selected: true, type: 'capex', desc: 'New CAPEX Item', qty: 1, unitRate: 0, amount: 0 });
    setItems(next);
  };

  const handleAddOpexItem = () => {
    setItems([...items, { id: generateId(), selected: true, type: 'custom', desc: 'New Operational Item', qty: 1, unitRate: 0, amount: 0 }]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* ── Top Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200 hide-on-print gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={guardedClose} className="text-slate-500 hover:bg-slate-100 h-9 px-3 flex items-center">
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 leading-tight">PDF Preview</h2>
            <p className="text-[10px] text-slate-500 leading-tight">#{invoiceNo} · {invoice.client}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved Changes
            </span>
          )}
          {savedLayout && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="h-9 gap-2 text-slate-600 border-slate-200 bg-white hover:bg-slate-50 font-semibold text-[11px] uppercase tracking-tight shadow-sm px-4 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
              <span className="hidden sm:inline">History</span>
            </Button>
          )}
          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveLayout}
            disabled={isSaving}
            className="h-9 gap-2 text-slate-700 border-slate-200 bg-white hover:bg-slate-50 font-semibold text-[11px] uppercase tracking-tight shadow-sm px-4 transition-all"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save State'}</span>
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] uppercase tracking-tight px-4 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

    {/* ── Leave Confirmation Dialog ───────────────────────────────────── */}
    <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold text-slate-800">You have unsaved changes</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-500">
            You've made edits to this invoice layout that haven't been saved yet. Would you like to save before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="text-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { setShowLeaveDialog(false); onClose(); }}
            className="bg-red-600 hover:bg-red-700 text-white text-sm"
          >
            Discard Changes
          </AlertDialogAction>
          <AlertDialogAction
            onClick={async () => { await handleSaveLayout(); setShowLeaveDialog(false); onClose(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Save & Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ── History Panel ────────────────────────────────────────────────── */}
    {showHistory && (
      <div className="mb-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
            <span className="text-sm font-bold text-slate-700">Save History</span>
            <Badge className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">{historyLog.length} entries</Badge>
          </div>
          <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        {historyLog.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">No save history yet. Save the layout to create the first entry.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
            {[...historyLog].reverse().map((entry: any, idx: number) => (
              <div key={idx} className="px-5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                    {historyLog.length - idx}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{entry.action || 'Saved Print Layout'}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(entry.date).toLocaleString()} · ₦{(entry.totalCharge || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {savedLayout && idx === 0 && (
                  <Badge className="text-[9px] bg-green-50 text-green-600 border-green-200">Current</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    <div className="flex flex-col w-full mx-auto bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 rounded-t-xl hide-on-print">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={combineDiesel}
              onChange={(e) => handleToggleCombineDiesel(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            Combine Diesel Supply Items
          </label>
          <label className="flex items-center gap-2.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={combineIdenticalPumps}
              onChange={(e) => handleToggleCombineIdenticalPumps(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            Combine Identical Pump Items
          </label>
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          * Demarcates pump leases serially and lists diesel per pump duration.
        </div>
      </div>
      <div className="flex flex-col">
        {/* ── A4 Canvas ─────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-6 px-4 sm:px-6 lg:px-8 flex justify-center [scrollbar-gutter:stable] rounded-xl bg-slate-50/30">
          <style>{`
            .invoice-canvas {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 13.5px;
              color: #111;
              line-height: 1.4;
            }
            .invoice-canvas * {
              box-sizing: border-box;
            }
            .invoice-canvas .a4-page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm;
              margin: auto;
              background-color: white;
              box-shadow: 0 4px 24px 0 rgba(0,0,0,0.18), 0 1px 4px 0 rgba(0,0,0,0.10);
              border-radius: 2px;
              display: flex;
              flex-direction: column;
            }
            .invoice-canvas .top-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px !important; }
            .invoice-canvas .logo-box { width: 60%; }
            .invoice-canvas .inv-header { text-align: right; width: 240px; }
            .invoice-canvas .inv-header h1 { font-family: 'Arial Black', Impact, sans-serif; font-size: 32px !important; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; color: #111; text-align: right; margin-top: 10px;}
            .invoice-canvas table.date-table { width: 100%; border-collapse: collapse !important; border: 1.5px solid #385296 !important; font-size: 13.5px; font-weight: bold; background: white; margin: 0 !important; }
            .invoice-canvas table.date-table th { border: 1.5px solid #385296 !important; padding: 4px !important; text-align: center; }
            .invoice-canvas table.date-table td { border: 1.5px solid #385296 !important; padding: 4px !important; text-align: center; font-weight: normal; vertical-align: middle; }
            .invoice-canvas .mid-section { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 20px !important; }
            .invoice-canvas .box { flex: 1; border: 1.5px solid #385296 !important; background: white; }
            .invoice-canvas .box-title { font-weight: bold; padding: 5px 8px !important; font-size: 13.5px; border-bottom: 1.5px solid #385296 !important; margin: 0 !important; }
            .invoice-canvas .box-content { padding: 8px !important; white-space: pre-wrap; font-size: 13.5px; min-height: 80px; }
            .invoice-canvas .project-terms { display: flex; justify-content: flex-end; margin-bottom: -1.5px !important; }
            .invoice-canvas table.pt-table { border-collapse: collapse !important; width: 340px; text-align: center; font-size: 12px; background: white; margin: 0 !important; }
            .invoice-canvas table.pt-table th, .invoice-canvas table.pt-table td { border: 1.5px solid #385296 !important; padding: 4px !important; }
            .invoice-canvas table.pt-table th { font-weight: normal; }
            .invoice-canvas table.pt-table td { font-weight: normal; }
            .invoice-canvas table.main-table { width: 100%; border-collapse: collapse !important; font-size: 12px; background: white; margin: 0 !important; }
            .invoice-canvas table.main-table th { border: 1.5px solid #385296 !important; padding: 6px 8px !important; text-align: center; font-weight: bold; background: white; }
            .invoice-canvas table.main-table td { border: 1.5px solid #385296 !important; padding: 5px 7px !important; vertical-align: middle; }
            .invoice-canvas table.main-table tr.category-header td { font-weight: bold; background: white !important; border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
            .invoice-canvas table.main-table tr.subtotal-row td { font-weight: bold; border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
            .invoice-canvas table.main-table tr.summary-row td { border: 1.5px solid #385296 !important; padding: 5px 8px !important; }
            .invoice-canvas table.main-table tr.grand-total-row td { font-weight: bold; border: 1.5px solid #385296 !important; padding: 6px 8px !important; }
            .invoice-canvas .borderless-cell { border: none !important; background: transparent !important; }
            .invoice-canvas .sn-col { width: 6%; text-align: center !important; }
            .invoice-canvas .desc-col { width: 45%; }
            .invoice-canvas .unit-col { width: 9%; text-align: center !important; }
            .invoice-canvas .rate-col { width: 20%; text-align: right !important; padding-right: 8px !important; }
            .invoice-canvas .amt-col { width: 20%; text-align: right !important; padding-right: 8px !important; }
            .invoice-canvas .footer { margin-top: auto; padding-top: 40px; font-size: 13.5px; line-height: 1.4; font-weight: bold; }
            .invoice-canvas .show-on-print { display: none !important; }
          `}</style>
          <div ref={printRef}>
            <div className="invoice-canvas">
              <div className="a4-page">
                {/* Top: Logo + Invoice header */}
              <div className="top-section">
                <div className="logo-box">
                  <img src={InvoiceLogo} alt="Invoice Logo" style={{ maxHeight: '110px', width: 'auto' }} />
                </div>
                <div className="inv-header">
                  <h1>INVOICE</h1>
                  <table className="date-table">
                    <thead><tr><th>Date</th><th>Invoice #</th></tr></thead>
                    <tbody>
                      <tr>
                        <td>
                          <input
                            type="text"
                            className="hide-on-print"
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                            style={{ width: '90px', border: '1px solid #ddd', padding: '2px', textAlign: 'center', borderRadius: 3 }}
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>{formatDisplayDate(invoiceDate)}</span>
                        </td>
                        <td>
                          <div style={{ width: '90px', textAlign: 'center', padding: '2px', marginLeft: 'auto', marginRight: 'auto', fontWeight: 'normal' }}>{invoiceNo}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill To / Pay To */}
              <div className="mid-section">
                <div className="box">
                  <div className="box-title">Bill To</div>
                  <div className="box-content">
                    <textarea
                      className="hide-on-print"
                      value={billedToInput}
                      onChange={e => setBilledToInput(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', border: 'none', resize: 'vertical', outline: 'none', background: 'transparent' }}
                    />
                    <span className="show-on-print" style={{ display: 'none' }}>{billedToInput}</span>
                  </div>
                </div>
                <div className="box">
                  <div className="box-title">Pay To</div>
                  <div className="box-content">
                    <textarea
                      className="hide-on-print"
                      value={paidToInput}
                      onChange={e => setPaidToInput(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', border: 'none', resize: 'vertical', outline: 'none', background: 'transparent' }}
                    />
                    <span className="show-on-print" style={{ display: 'none' }}>{paidToInput}</span>
                  </div>
                </div>
              </div>

              {/* Project / Terms */}
              <div className="project-terms">
                <table className="pt-table">
                  <thead><tr><th>Project</th><th>Terms</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>
                        <input className="hide-on-print" value={projectText} onChange={e => setProjectText(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }} />
                        <span className="show-on-print" style={{ display: 'none' }}>{projectText}</span>
                      </td>
                      <td>
                        <input className="hide-on-print" value={termsText} onChange={e => setTermsText(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }} />
                        <span className="show-on-print" style={{ display: 'none' }}>{termsText}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Line Items Table — detailed S/N breakdown layout */}
              {(() => {
                // Categorise items
                const capexTypes = new Set(['mobDemob', 'installation', 'damages', 'capex']);
                const capexItems = items.filter(it => capexTypes.has(it.type));
                const opexItems  = items.filter(it => !capexTypes.has(it.type));
                const capexTotal = capexItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                const opexTotal  = opexItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // Build serial labelling: A, A1, A2… B, B1, B2…
                let capexCounter = 0;
                let opexCounter  = 0;

                const renderItem = (item: any, idx: number, sn: string, globalIdx: number) => (
                  <tr key={item.id} className="item-row">
                    <td className="hide-on-print" style={{ textAlign: 'center', background: '#fafafa' }}>
                      <button
                        onClick={() => handleDeleteItem(globalIdx)}
                        style={{ color: 'white', fontWeight: 'bold', fontSize: 11, background: '#ef4444', border: 'none', cursor: 'pointer', outline: 'none', borderRadius: '50%', width: 18, height: 18, lineHeight: '18px' }}
                      >&times;</button>
                    </td>
                    <td className="sn-col" style={{ textAlign: 'center' }}>{sn}</td>
                    <td className="desc-col">
                      <textarea
                        className="hide-on-print"
                        value={item.desc}
                        onChange={e => handleUpdateItem(globalIdx, 'desc', e.target.value)}
                        style={{ width: '100%', minHeight: '45px', border: '1px dashed #c7d2e0', padding: 3, borderRadius: 3, outline: 'none', resize: 'vertical', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                      />
                      <span className="show-on-print" style={{ display: 'none', whiteSpace: 'pre-wrap' }}>{item.desc}</span>
                    </td>
                    <td className="unit-col">
                      <input
                        className="hide-on-print"
                        value={item.qty ?? 1}
                        onChange={e => handleUpdateItem(globalIdx, 'qty', e.target.value)}
                        style={{ width: '100%', textAlign: 'center', border: '1px dashed #c7d2e0', padding: 3, borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                      />
                      <span className="show-on-print" style={{ display: 'none' }}>{item.qty ?? 1}</span>
                    </td>
                    <td className="rate-col">
                      <input
                        className="hide-on-print"
                        type="text"
                        value={item.unitRate ?? item.amount}
                        onChange={e => handleUpdateItem(globalIdx, 'unitRate', e.target.value)}
                        style={{ width: '100%', textAlign: 'right', border: '1px dashed #c7d2e0', padding: 3, borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                      />
                      <span className="show-on-print" style={{ display: 'none' }}>
                        {isNaN(Number(item.unitRate ?? item.amount)) 
                          ? String(item.unitRate ?? item.amount) 
                          : fmt(parseFloat(String(item.unitRate ?? item.amount)) || 0)}
                      </span>
                    </td>
                    <td className="amt-col">
                      <input
                        className="hide-on-print"
                        type="text"
                        value={item.amount}
                        onChange={e => handleUpdateItem(globalIdx, 'amount', e.target.value)}
                        style={{ width: '100%', textAlign: 'right', border: '1px dashed #c7d2e0', padding: 3, borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                      />
                      <span className="show-on-print" style={{ display: 'none' }}>
                        {isNaN(Number(item.amount)) 
                          ? String(item.amount) 
                          : fmt(parseFloat(String(item.amount)) || 0)}
                      </span>
                    </td>
                  </tr>
                );

                return (
                  <table className="main-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th className="hide-on-print" style={{ width: '32px', background: '#f8fafc' }}></th>
                        <th className="sn-col">S/N</th>
                        <th className="desc-col" style={{ textAlign: 'left' }}>Description</th>
                        <th className="unit-col">Unit</th>
                        <th className="rate-col">Unit Rate (₦)</th>
                        <th className="amt-col">Total Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody>

                      {/* ── CAPEX section — always visible so user can add to it ── */}
                      <tr className="category-header">
                        <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                        <td className="sn-col" style={{ textAlign: 'center' }}>A</td>
                        <td colSpan={4} style={{ textAlign: 'left' }}>Capital Expenditure (CAPEX)</td>
                      </tr>
                      {capexItems.map(item => {
                        const globalIdx = items.indexOf(item);
                        capexCounter++;
                        const sn = `A${capexCounter}`;
                        return renderItem(item, capexCounter - 1, sn, globalIdx);
                      })}
                      <tr>
                        <td className="hide-on-print" colSpan={6} style={{ border: 'none', padding: '3px 6px' }}>
                          <button
                            onClick={handleAddCapexItem}
                            style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >+ Add to Part A (CAPEX)</button>
                        </td>
                      </tr>
                      {capexItems.length > 0 && (
                        <tr className="subtotal-row">
                          <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>Subtotal (A)</td>
                          <td className="amt-col" style={{ fontWeight: 'bold' }}>{fmt(capexTotal)}</td>
                        </tr>
                      )}

                      {/* ── OPEX section — always visible so user can add to it ── */}
                      <tr className="category-header">
                        <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                        <td className="sn-col" style={{ textAlign: 'center' }}>B</td>
                        <td colSpan={4} style={{ textAlign: 'left' }}>Operational Expenditure</td>
                      </tr>
                      {opexItems.map(item => {
                        const globalIdx = items.indexOf(item);
                        opexCounter++;
                        const sn = `B${opexCounter}`;
                        return renderItem(item, opexCounter - 1, sn, globalIdx);
                      })}
                      <tr>
                        <td className="hide-on-print" colSpan={6} style={{ border: 'none', padding: '3px 6px' }}>
                          <button
                            onClick={handleAddOpexItem}
                            style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >+ Add to Part B (Operational)</button>
                        </td>
                      </tr>
                      {opexItems.length > 0 && (
                        <tr className="subtotal-row">
                          <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>Subtotal (B)</td>
                          <td className="amt-col" style={{ fontWeight: 'bold' }}>{fmt(opexTotal)}</td>
                        </tr>
                      )}

                      {/* ── Summary rows ── */}
                      <tr><td className="hide-on-print" style={{ background: '#f8fafc' }}></td><td colSpan={5} style={{ padding: '3px', border: '1.5px solid #385296' }}></td></tr>

                      {(capexItems.length > 0 && opexItems.length > 0) && (
                        <tr className="summary-row">
                          <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>Total (A+B)</td>
                          <td className="amt-col">{fmt(subtotal)}</td>
                        </tr>
                      )}

                      <tr className="summary-row">
                        <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                        <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8, ...getLabelStyle(paymentsCreditsLabel) }}>
                          <input
                            type="text"
                            className="hide-on-print"
                            value={paymentsCreditsLabel}
                            onChange={e => setPaymentsCreditsLabel(e.target.value)}
                            style={{ width: '110px', textAlign: 'right', fontWeight: 'inherit', border: 'none', background: 'transparent', outline: 'none', fontSize: 'inherit', color: 'inherit', fontFamily: 'inherit' }}
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>{paymentsCreditsLabel}</span>
                        </td>
                        <td className="amt-col">
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              className="hide-on-print"
                              data-print-value={isNaN(Number(paymentsCredits)) || paymentsCredits === '' ? paymentsCredits : Number(paymentsCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              value={paymentsCredits}
                              onChange={e => setPaymentsCredits(e.target.value)}
                              placeholder="Amount or text"
                              style={{ width: '100%', textAlign: 'right', border: '1px dashed #c7d2e0', borderRadius: 3, padding: '2px 4px', outline: 'none', background: '#f9fafb', fontSize: '11.5px' }}
                            />
                          </div>
                        </td>
                      </tr>

                      {vat > 0 && (
                        <tr className="summary-row">
                          <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8 }}>VAT {vatRate}%{vatIncSetting === 'Yes' ? ' (Incl.)' : ''}</td>
                          <td className="amt-col">{fmt(vat)}</td>
                        </tr>
                      )}

                      <tr className="grand-total-row">
                        <td className="hide-on-print" style={{ background: '#f8fafc' }}></td>
                        <td colSpan={4} style={{ textAlign: 'right', paddingRight: 8, fontWeight: 'bold' }}>GRAND TOTAL</td>
                        <td className="amt-col" style={{ fontWeight: 'bold' }}>{fmt(totalCharge)}</td>
                      </tr>

                    </tbody>
                  </table>
                );
              })()}

              {/* ── TOTAL AMOUNT IN WORD — standalone paragraph below table ── */}
              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 900, color: '#000' }}>
                <textarea
                  className="hide-on-print"
                  value={wordsValue}
                  onChange={e => setCustomWords(e.target.value)}
                  style={{ width: '100%', minHeight: '40px', border: '1px dashed #c7d2e0', padding: '5px 8px', fontWeight: 'inherit', borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 12, color: 'inherit' }}
                />
              </div>

              {/* ── Extra Note ── */}
              <div style={{ marginTop: 14 }} className={extraNote ? '' : 'hide-on-print'}>
                <textarea
                  className="hide-on-print"
                  value={extraNote}
                  onChange={e => setExtraNote(e.target.value)}
                  placeholder="Optional extra note... (Press Enter for new lines)"
                  style={{ width: '100%', minHeight: '40px', border: '1px dashed #c7d2e0', padding: '4px 6px', borderRadius: 3, outline: 'none', background: '#f9fafb', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* ── Footer note ── */}
              <div style={{ marginTop: 14 }}>
                <input
                  className="hide-on-print"
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  style={{ width: '100%', border: '1px dashed #c7d2e0', padding: '4px 6px', borderRadius: 3, outline: 'none', background: '#f9fafb', fontSize: 12, fontFamily: 'inherit' }}
                />
                <span className="show-on-print" style={{ display: 'none', fontSize: '12px' }}>{footerText}</span>
              </div>

              {/* Footer */}
              <div className="footer">
                <div style={{ fontWeight: 900, letterSpacing: '1px' }}>
                  <input
                    className="hide-on-print"
                    value={footerCompany}
                    onChange={e => setFooterCompany(e.target.value)}
                    style={{ width: '100%', border: '1px dashed #c7d2e0', fontWeight: 900, outline: 'none', background: '#f9fafb', borderRadius: 3, padding: '2px 4px' }}
                  />
                  <span className="show-on-print" style={{ display: 'none' }}>{footerCompany}</span>
                </div>
                <div>
                  <input
                    className="hide-on-print"
                    value={footerContact}
                    onChange={e => setFooterContact(e.target.value)}
                    style={{ width: '100%', border: '1px dashed #c7d2e0', outline: 'none', background: '#f9fafb', borderRadius: 3, padding: '2px 4px' }}
                  />
                  <span className="show-on-print" style={{ display: 'none' }}>{footerContact}</span>
                </div>
                <div>
                  <input
                    className="hide-on-print"
                    value={footerEmail}
                    onChange={e => setFooterEmail(e.target.value)}
                    style={{ width: '100%', border: '1px dashed #c7d2e0', outline: 'none', background: '#f9fafb', borderRadius: 3, padding: '2px 4px' }}
                  />
                  <span className="show-on-print" style={{ display: 'none' }}>{footerEmail}</span>
                </div>
              </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
