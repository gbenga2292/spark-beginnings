import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import React, { useState, useMemo } from 'react';
import InvoiceLogo from '../../logo/logo-2.png';
import { useAppStore, PendingInvoice, Invoice } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, ArrowRightCircle, Upload, Download, Mail, ChevronUp, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/src/components/ui/dropdown-menu';
import { NumericFormat } from 'react-number-format';

export function Billing({ searchTerm = '' }: { searchTerm?: string }) {
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

  // ─── Permissions ───────────────────────────────────────────
  const priv = usePriv('billing');
  const { addReminder } = useAppData();
  const { user: currentUser } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quotations' | 'all' | 'active' | 'unpaid' | 'completed'>('all');
  const isViewingAll = activeTab === 'all';
  const isViewingActive = activeTab === 'active';
  const isViewingQuotations = activeTab === 'quotations';
  const isViewingUnpaid = activeTab === 'unpaid';
  const isViewingCompleted = activeTab === 'completed';
  const payments = useAppStore(state => state.payments);
  const ledgerBanks = useAppStore(state => state.ledgerBanks);
  const ledgerBeneficiaryBanks = useAppStore(state => state.ledgerBeneficiaryBanks);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printInvoiceTarget, setPrintInvoiceTarget] = useState<Invoice | PendingInvoice | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterFromMonth, setFilterFromMonth] = useState<string>('');
  const [filterToMonth, setFilterToMonth] = useState<string>('');
  const [showActions, setShowActions] = useState(false);

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
    techniciansDailyRate: '',
    dieselCostPerLtr: '',
    dailyUsage: '',
    mobDemob: '',
    installation: '',
    damages: '',
    createReminder: true,
    sendEmailNotification: true,
    vatInc: 'No' as 'Yes' | 'No' | 'Add',
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
    const techniciansDailyRate = parseFloat(form.techniciansDailyRate) || 0;
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

    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * maxDuration;
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

    return { totalCost, vat, totalCharge, vatInc, maxDuration };
  }, [form, machineConfigs, siteRegistry, vatRate]);

  const calculateFullInvoiceData = (input: any, configs?: { rate: string; duration: string }[]) => {
    const noOfMachine = parseInt(input.noOfMachine) || 0;
    const noOfTechnician = parseFloat(input.noOfTechnician) || 0;
    const techniciansDailyRate = parseFloat(input.techniciansDailyRate) || 0;
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

    let startDate = normalizeDate(input.startDate || input.date);
    let endDate = '';
    if (startDate && maxDuration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setDate(start.getDate() + maxDuration - 1);
        endDate = start.toISOString().split('T')[0];
      }
    } else if (input.endDate || input.dueDate) {
      endDate = normalizeDate(input.endDate || input.dueDate);
    }

    // Rental cost = sum of (rate × duration) per machine
    const rentalCost = activeCfgs
      ? activeCfgs.reduce((sum, row) => sum + (parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0), 0)
      : (parseInt(input.noOfMachine) || 0) * (parseFloat(input.dailyRentalCost) || 0) * maxDuration;

    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * maxDuration;
    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;
    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    const siteName = (input.site || input.siteName || '').trim();
    const clientName = (input.client || '').trim();

    let siteObj = siteRegistry.find(s => s.name === siteName && s.client === clientName);
    if (!siteObj) {
      siteObj = siteRegistry.find(s => s.name === clientName && s.client === siteName);
    }
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

    if (form.destination === 'Active') {
      const newInvoice: Invoice = {
        id: selectedId && !movingFromQuotationToActive ? selectedId : generateId(),
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
        totalExclusiveOfVat: data.totalExclusiveOfVat
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
      const pendingData = { ...data, id: selectedId && !movingFromActiveToQuotation ? selectedId : generateId() } as any;

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

    if (form.createReminder && currentUser && data.endDate) {
      const reminderDateObj = new Date(data.endDate);
      addReminder({
        title: `Next Invoice for ${form.client} - ${form.site}`,
        body: `Invoice ${form.invoiceNo} is pending payment. The duration has lapsed. Please notify the client to see if they want to extend or send a new invoice.`,
        remindAt: reminderDateObj.toISOString(),
        frequency: 'once',
        recipientIds: [currentUser.id],
        sendEmail: !!form.sendEmailNotification,
        isActive: true,
        createdBy: currentUser.id
      });
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
      techniciansDailyRate: 'techniciansDailyRate' in inv ? String(inv.techniciansDailyRate ?? 0) : '0',
      dieselCostPerLtr: 'dieselCostPerLtr' in inv ? String(inv.dieselCostPerLtr ?? 0) : '0',
      dailyUsage: 'dailyUsage' in inv ? String(inv.dailyUsage ?? 0) : '0',
      mobDemob: 'mobDemob' in inv ? String(inv.mobDemob ?? 0) : '0',
      installation: 'installation' in inv ? String(inv.installation ?? 0) : '0',
      damages: 'damages' in inv ? String(inv.damages ?? 0) : '0',
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
        totalExclusiveOfVat: inv.totalExclusiveOfVat
      });
      deletePendingInvoice(inv.id);
      if (selectedId === inv.id) handleClear();
      toast.success('Moved to Active Invoices');
      setActiveTab('all');
    }
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

  const sitesForClient = siteRegistry.filter(s => s.client === (form.client || '').trim());

  useSetPageTitle(
    activeTab === 'all' ? 'All Invoices' : activeTab === 'active' ? 'Active Invoices' : activeTab === 'quotations' ? 'Quotations' : activeTab === 'unpaid' ? 'Unpaid Site Records' : 'Completed Invoices',
    activeTab === 'all'
      ? 'View every historical invoice record'
      : activeTab === 'active'
      ? 'Invoices for sites currently in progress'
      : activeTab === 'unpaid'
      ? 'Sites with outstanding balances'
      : activeTab === 'quotations' 
      ? 'Review and process quotation drafts'
      : 'Review invoices for sites with consolidated payments',
    <div className="hidden sm:flex items-center gap-2">
      {priv.canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9 px-3 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
              <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export <ChevronDown className="h-3 w-3 text-slate-400" />
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
          <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
        </label>
      )}
          {priv.canCreate && activeTab !== 'completed' && (
        <Button
          size="sm"
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 font-bold text-[11px] uppercase tracking-tight shadow-md"
          onClick={() => { handleClear(); setIsModalOpen(true); }}
        >
          <Plus className="w-4 h-4" /> Add {activeTab === 'active' ? 'Invoice' : 'Quotation'}
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

        {/* Tab switcher + mobile actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('all')}
            >
              All Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'all' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{invoices.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'quotations' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('quotations')}
            >
              Quotations
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'quotations' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{pendingInvoices.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('active')}
            >
              Active Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'active' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{invoices.filter(i => { const s = sites.find(site => site.name === i.siteName && site.client === i.client); return s && s.status !== 'Ended'; }).length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'unpaid' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('unpaid')}
            >
              Unpaid Invoices
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'unpaid' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{unpaidSites.length}</Badge>
            </button>
            <button
              className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'completed' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed Invoice
              <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-mono border-slate-300 ${activeTab === 'completed' ? 'bg-indigo-100/50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{completedSites.length}</Badge>
            </button>
          </div>

          {/* Mobile-only action buttons */}
          <div className="flex sm:hidden items-center gap-2">
            {priv.canImport && (
              <label className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 shadow-sm border border-indigo-200 rounded-md h-9 px-3 text-sm font-medium cursor-pointer transition-colors">
                <Upload className="h-4 w-4" /> Import
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
              </label>
            )}
            {priv.canExport && (
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-[30px] text-[11px]" onClick={() => handleExportCSV('basic')}>
                  <Download className="h-3 w-3" /> Basic CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-[30px] text-[11px]" onClick={() => handleExportCSV('detailed')}>
                  <Download className="h-3 w-3" /> Detailed CSV
                </Button>
              </div>
            )}
            {priv.canCreate && (activeTab === 'all' || activeTab === 'quotations') && (
              <Button
                size="sm"
                className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-9 px-4"
                onClick={() => { handleClear(); setIsModalOpen(true); }}
              >
                <Plus className="w-4 h-4" /> Add {activeTab === 'all' ? 'Invoice' : 'Quotation'}
              </Button>
            )}
          </div>
        </div>

        {/* Main Table View */}
        <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0 min-h-[400px]">
          <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {activeTab === 'active' ? 'Active Invoices' : activeTab === 'quotations' ? 'Quotations' : 'Completed paid sites'}
              </h3>
              <Badge variant="secondary" className="ml-2 font-mono">{activeTab === 'completed' ? completedSites.length : currentList.length}</Badge>
            </div>
            
            <div className="flex items-center gap-6">
              {activeTab === 'quotations' && <p className="hidden md:block text-xs text-slate-500">Double click row to transition to Active.</p>}
              
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                {/* Filter input */}
                <div className="flex items-center gap-2 sm:border-r border-slate-200 sm:pr-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">From</span>
                    <Input 
                        type="month" 
                        value={filterFromMonth} 
                        onChange={(e) => setFilterFromMonth(e.target.value)} 
                        className="h-8 w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">To</span>
                    <Input 
                        type="month" 
                        value={filterToMonth} 
                        onChange={(e) => setFilterToMonth(e.target.value)} 
                        className="h-8 w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                    />
                    {(filterFromMonth || filterToMonth) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { setFilterFromMonth(''); setFilterToMonth(''); }} title="Clear filter">
                            <X className="h-3.5 w-3.5"/>
                        </Button>
                    )}
                </div>

                {/* Toggle for Actions Column */}
                <div className="flex items-center gap-3">
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
            <Table className="whitespace-nowrap min-w-full text-xs sm:text-sm">
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
                        {activeTab === 'completed' || activeTab === 'unpaid' ? 'Total Charge' : 'Gross Sum'}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">
                        ₦{formatSum(activeTab === 'completed' || activeTab === 'unpaid' ? tableSums.totalCharge : tableSums.totalCost)}
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        {activeTab === 'completed' || activeTab === 'unpaid' ? 'Amount Paid' : 'Total Charge'}
                      </div>
                      <div className="text-[12px] font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                        ₦{formatSum(activeTab === 'completed' || activeTab === 'unpaid' ? tableSums.amountPaid : tableSums.totalCharge)}
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
                          console.log('Billing: Toggling site expansion', { siteKey, current: expandedSiteKey });
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
                    <TableRow key={inv.id} onDoubleClick={() => { if (activeTab === 'quotations') handleMakeActive(inv) }} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <TableCell className="px-4 py-3 font-mono font-bold text-slate-700">{inv.invoiceNo || inv.invoiceNumber}</TableCell>
                      <TableCell className="px-4 py-3 text-slate-700">
                        <div className="font-semibold">{inv.client}</div>
                        <div className="text-slate-500 text-xs">{inv.site || inv.siteName} <span className="ml-1 px-1 rounded bg-slate-100 border text-[10px]">{inv.vatInc || 'No VAT'}</span></div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-slate-600">
                        <div><span className="text-slate-400">Mac:</span> {inv.noOfMachine || 0} x {priv?.canViewAmounts === false ? '***' : (inv.dailyRentalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div><span className="text-slate-400">Tech:</span> {inv.noOfTechnician || 0} x {priv?.canViewAmounts === false ? '***' : (inv.techniciansDailyRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div><span className="text-slate-400">DsLtr:</span> {priv?.canViewAmounts === false ? '***' : (inv.dieselCostPerLtr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(inv.dailyUsage || 0)}L)</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-slate-600">
                        <div className="font-medium text-slate-800">{inv.duration || 0} Days</div>
                        <div className="text-slate-500 text-xs">{formatDisplayDate(inv.startDate || inv.date)} - {formatDisplayDate(inv.endDate || inv.dueDate)}</div>
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
          </div>
        </div>

        {/* Modern Modal Overlay */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedId ? 'Edit' : 'Create'} {form.destination === 'Active' ? 'Invoice' : 'Quotation'}</h2>
                  <p className="text-xs text-slate-500">Auto-calculate totals by entering valid numbers.</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">

                <div className="space-y-1.5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg pb-5">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-800">Destination</label>
                  <select
                    value={form.destination}
                    onChange={e => handleChange('destination', e.target.value)}
                    className="flex h-11 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-semibold text-slate-700 shadow-sm"
                  >
                    <option value="Pending">Quotations</option>
                    <option value="Active">Active Invoices</option>
                  </select>
                  <p className="text-[11px] text-indigo-600 mt-1 pl-1">Select where you want this record to be inserted.</p>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                    <Input type="date" value={form.startDate} onChange={e => handleChange('startDate', e.target.value)} className="bg-slate-50 h-11" />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice No</label>
                  <Input type="text" value={form.invoiceNo} onChange={e => handleChange('invoiceNo', e.target.value)} placeholder="e.g. 144" className="bg-slate-50 font-semibold text-lg h-11" />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
                    <select
                      value={form.client}
                      onChange={e => {
                        const val = e.target.value;
                        const siteForClient = siteRegistry.find(s => s.client === val && s.name === form.site);
                        setForm(f => ({ 
                          ...f, 
                          client: val,
                          site: '', // Clear site when client changes to re-trigger selection
                          vatInc: siteForClient ? siteForClient.vat : f.vatInc
                        }));
                      }}
                      className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                    >
                      <option value="">Select Client...</option>
                      {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Site</label>
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
                      className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Site...</option>
                      {sitesBySelectedClient.map((s, i) => <option key={i} value={s.name}>{s.name} ({s.type})</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 space-y-4">
                  {/* ── Machines row count ─────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">No. of Machines</label>
                      <Input
                        type="number" min="0" value={form.noOfMachine}
                        onChange={e => handleNoOfMachineChange(e.target.value)}
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Technicians</label>
                      <Input type="number" min="0" value={form.noOfTechnician} onChange={e => handleChange('noOfTechnician', e.target.value)} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Tech Rate</label>
                      <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.techniciansDailyRate} onValueChange={(v) => handleChange('techniciansDailyRate', v.value || '')} className="bg-slate-50" />
                    </div>
                  </div>

                  {/* ── Per-machine rate / duration rows ──────────────── */}
                  {machineConfigs.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Machine Rate &amp; Duration</p>
                      {machineConfigs.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3">
                          {/* Label */}
                          <span className="text-xs font-semibold text-slate-600 w-20 shrink-0">
                            Machine {idx + 1}
                          </span>
                          <div className="space-y-0.5">
                            {idx === 0 ? (
                              <span className="text-[10px] text-slate-400 font-medium pb-1.5 inline-block">Daily Rate (₦)</span>
                            ) : (
                              <label className="flex items-center gap-2 text-[10px] text-slate-500 cursor-pointer pb-1 sm:mt-1">
                                <input
                                  type="checkbox"
                                  checked={row.sameRateAsFirst}
                                  onChange={e => handleMachineSameToggle(idx, 'rate', e.target.checked)}
                                  className="accent-indigo-600 w-3 h-3"
                                />
                                Same as M-1
                              </label>
                            )}
                            <NumericFormat
                              customInput={Input}
                              thousandSeparator decimalScale={2}
                              value={row.rate}
                              disabled={idx > 0 && row.sameRateAsFirst}
                              onValueChange={v => handleMachineRowChange(idx, 'rate', v.value || '')}
                              className={idx > 0 && row.sameRateAsFirst ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}
                            />
                          </div>
                          {/* Duration */}
                          <div className="space-y-0.5">
                            {idx === 0 ? (
                              <span className="text-[10px] text-slate-400 font-medium pb-1.5 inline-block">Duration (Days)</span>
                            ) : (
                              <label className="flex items-center gap-2 text-[10px] text-slate-500 cursor-pointer pb-1 sm:mt-1">
                                <input
                                  type="checkbox"
                                  checked={row.sameDurationAsFirst}
                                  onChange={e => handleMachineSameToggle(idx, 'duration', e.target.checked)}
                                  className="accent-indigo-600 w-3 h-3"
                                />
                                Same as M-1
                              </label>
                            )}
                            <Input
                              type="number" min="0"
                              value={row.duration}
                              disabled={idx > 0 && row.sameDurationAsFirst}
                              onChange={e => handleMachineRowChange(idx, 'duration', e.target.value)}
                              className={idx > 0 && row.sameDurationAsFirst ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Diesel ────────────────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Usage (L)</label>
                      <Input type="number" min="0" value={form.dailyUsage} onChange={e => handleChange('dailyUsage', e.target.value)} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diesel Cost / Ltr</label>
                      <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.dieselCostPerLtr} onValueChange={(v) => handleChange('dieselCostPerLtr', v.value || '')} className="bg-slate-50" />
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 block">Other Costs</label>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mob/Demob</label>
                      <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.mobDemob} onValueChange={(v) => handleChange('mobDemob', v.value || '')} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Install</label>
                      <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.installation} onValueChange={(v) => handleChange('installation', v.value || '')} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Damages</label>
                      <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.damages} onValueChange={(v) => handleChange('damages', v.value || '')} className="bg-slate-50" />
                    </div>
                  </div>
                </div>

                {/* Automatic Reminder Section */}
                <div className="pt-5 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 block">Follow-Up Reminders</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!form.createReminder} onChange={e => handleChange('createReminder', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">Auto-create reminder for next invoice date</span>
                    </label>
                    {form.createReminder && (
                      <label className="flex items-center gap-3 cursor-pointer pl-7">
                        <input type="checkbox" checked={!!form.sendEmailNotification} onChange={e => handleChange('sendEmailNotification', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm font-medium text-slate-600 flex items-center gap-2"><Mail className="w-4 h-4" /> Send email notification along with this reminder</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Live Preview of Calculation */}
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="bg-slate-900 rounded-xl p-5 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Live Auto-Calculation</span>
                      <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider rounded-sm px-2 py-0 border-slate-700 ${livePreview.vatInc === 'Yes' ? 'text-indigo-400 bg-indigo-950/50' : livePreview.vatInc === 'Add' ? 'text-amber-400 bg-amber-950/50' : 'text-slate-400 bg-slate-800'}`}>
                        VAT: {livePreview.vatInc}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Gross Total</span>
                        <span className="font-mono text-slate-200 font-medium text-sm">₦{priv?.canViewAmounts === false ? '***' : livePreview.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-700 pl-4">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Tax (VAT {livePreview.vatInc})</span>
                        <span className="font-mono text-indigo-400 font-medium text-sm">₦{priv?.canViewAmounts === false ? '***' : livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex flex-col border-l border-slate-700 pl-4">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Final Amount Due</span>
                        <span className="font-mono text-emerald-400 font-bold text-lg leading-none">₦{priv?.canViewAmounts === false ? '***' : livePreview.totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                <Button variant="outline" className="flex-1 border-slate-300 h-11 text-slate-600 hover:bg-slate-100" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 shadow-md">
                  <CheckCircle className="w-4 h-4" /> {selectedId ? 'Update Invoice' : 'Submit Invoice'}
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
                How would you like to process the {isViewingActive ? 'Active' : 'Pending'} Invoice records from this CSV file?
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

        {/* Print Invoice Modal Overlay */}
        {printInvoiceTarget && (
          <InvoicePrintModal 
            invoice={printInvoiceTarget as any} 
            onClose={() => setPrintInvoiceTarget(null)}
            ledgerBanks={ledgerBanks}
            ledgerBeneficiaryBanks={ledgerBeneficiaryBanks}
          />
        )}
      </div>
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

export function InvoicePrintModal({ invoice, onClose, ledgerBanks, ledgerBeneficiaryBanks }: { 
  invoice: any, 
  onClose: () => void,
  ledgerBanks: {id: string, name: string}[],
  ledgerBeneficiaryBanks: {id: string, name: string}[] 
}) {
  const printRef = React.useRef<HTMLDivElement>(null);
  
  // Combine both banks for selection dropdown logic if needed, but here we just take the first as default
  const defaultBank = ledgerBeneficiaryBanks[0]?.name || ledgerBanks[0]?.name || 'Stanbic IBTC Bank\n0000000000';
  
  const [billedToInput, setBilledToInput] = useState(invoice.client || 'Client Name\nCompany Address\nCity');
  const [paidToInput, setPaidToInput] = useState('Dewatering Construction Etc Limited\n' + defaultBank);
  const [projectText, setProjectText] = useState('DCEL- SED');
  const [termsText, setTermsText] = useState('For Immediate Payment');
  
  const [invoiceDate, setInvoiceDate] = useState(invoice.printLayout?.invoiceDate || invoice.date || invoice.startDate || '');
  const [invoiceNo, setInvoiceNo] = useState(invoice.printLayout?.invoiceNo || invoice.invoiceNumber || invoice.invoiceNo || '');
  const [paymentsCredits, setPaymentsCredits] = useState<number>(invoice.printLayout?.paymentsCredits || 0);
  
  const [items, setItems] = useState<any[]>(() => {
    if (invoice.printLayout?.items) return invoice.printLayout.items;
    const list = [];
    if (invoice.machineConfigs && invoice.machineConfigs.length > 0) {
      let isFirst = true;
      invoice.machineConfigs.forEach((m: any, i: number) => {
        const mRate = parseFloat(m.rate) || 0;
        const mDur = parseFloat(m.duration) || 0;
        const mCost = mRate * mDur;
        if (mCost > 0) {
          list.push({ id: generateId(), selected: true, desc: `${isFirst ? 'Phase 1\n' : ''}Lease of 1 Dewatering Pump @ N${mRate.toLocaleString()} per pump for ${mDur} days.`, qty: 1, unitRate: mCost, amount: mCost });
          isFirst = false;
        }
      });
    } else if (invoice.rentalCost && invoice.rentalCost > 0) {
      list.push({ id: generateId(), selected: true, desc: `Phase 1\nLease of ${invoice.noOfMachine || 0} Dewatering Pumps @ N${(invoice.dailyRentalCost || 0).toLocaleString()} per pump for ${invoice.duration || 0} days.`, qty: invoice.noOfMachine || 1, unitRate: invoice.rentalCost, amount: invoice.rentalCost });
    }
    if (invoice.techniciansCost && invoice.techniciansCost > 0) {
      list.push({ id: generateId(), selected: true, desc: `Technician Charge for ${invoice.noOfTechnician || 0} dewatering staff @ N${(invoice.techniciansDailyRate || 0).toLocaleString()} per technician per day for ${invoice.duration || 0} days.`, qty: invoice.noOfTechnician || 1, unitRate: invoice.techniciansCost, amount: invoice.techniciansCost });
    }
    if (invoice.dieselCost && invoice.dieselCost > 0) {
      list.push({ id: generateId(), selected: true, desc: `Diesel Supply (${invoice.dailyUsage || 0}L/day for ${invoice.duration || 0} Days @ ₦${(invoice.dieselCostPerLtr || 0).toLocaleString()}/L)`, qty: 1, unitRate: invoice.dieselCost, amount: invoice.dieselCost });
    }
    if (invoice.mobDemob && invoice.mobDemob > 0) {
      list.push({ id: generateId(), selected: true, desc: `Mobilization / Demobilization`, qty: 1, unitRate: invoice.mobDemob, amount: invoice.mobDemob });
    }
    if (invoice.installation && invoice.installation > 0) {
      list.push({ id: generateId(), selected: true, desc: `Installation`, qty: 1, unitRate: invoice.installation, amount: invoice.installation });
    }
    if (invoice.damages && invoice.damages > 0) {
      list.push({ id: generateId(), selected: true, desc: `Damages / Repairs`, qty: 1, unitRate: invoice.damages, amount: invoice.damages });
    }
    if (list.length === 0) {
       list.push({ id: generateId(), selected: true, desc: 'Description of service...', qty: 1, amount: 0 });
    }
    return list;
  });

  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  
  const vatIncSetting = invoice.vatInc;
  const vatRateStr = String(useAppStore.getState().payrollVariables?.vatRate || '7.5');
  const vatRate = parseFloat(vatRateStr) || 7.5;

  let totalCharge = subtotal;
  let vat = 0;
  if (vatIncSetting === 'Yes') {
    vat = (subtotal / (100 + vatRate)) * vatRate;
  } else if (vatIncSetting === 'Add') {
    vat = subtotal * (vatRate / 100);
    totalCharge = subtotal + vat;
  }
  
  const [customWords, setCustomWords] = useState<string | null>(invoice.printLayout?.customWords || null);
  
  React.useEffect(() => {
    // Determine auto-calculate if words have never been saved
    if (customWords === null && !invoice.printLayout?.customWords) {
      setCustomWords('TOTAL AMOUNT IN WORD: ' + toWords(totalCharge));
    }
  }, [totalCharge, invoice.printLayout?.customWords]);

  const wordsValue = customWords !== null ? customWords : ('TOTAL AMOUNT IN WORD: ' + toWords(totalCharge));
  const [footerText, setFooterText] = useState(invoice.printLayout?.footerText || 'We look forward to your swift response.');
  
  const [footerCompany, setFooterCompany] = useState(invoice.printLayout?.footerCompany || 'DEWATERING CONSTRUCTION ETC LIMITED');
  const [footerContact, setFooterContact] = useState(invoice.printLayout?.footerContact || '09030002182, 08028280712');
  const [footerEmail, setFooterEmail] = useState(invoice.printLayout?.footerEmail || 'info@dewaterconstruct.com');

  const calcBalanceDue = totalCharge - paymentsCredits;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Print Invoice ${invoiceNo}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; background-color: white;}
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13.5px; color: #111; background: white!important; line-height: 1.4; }
        .a4-page { width: 210mm; min-height: 297mm; padding: 15mm; margin: auto; break-after: auto; display: flex; flex-direction: column; }
        
        .top-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .logo-box { width: 60%; }
        /* Logo representation */
        .logo-box svg { height: 90px; width: auto; }
        .inv-header { text-align: right; width: 240px; }
        .inv-header h1 { font-family: 'Arial Black', Impact, sans-serif; font-size: 32px; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; color: #111; text-align: right; margin-top: 10px;}
        .date-table { width: 100%; border-collapse: collapse; border: 1.5px solid #385296; font-size: 13.5px; font-weight: bold; }
        .date-table th { border: 1.5px solid #385296; padding: 4px; text-align: center; }
        .date-table td { border: 1.5px solid #385296; padding: 4px; text-align: center; font-weight: normal; }

        .mid-section { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 20px; }
        .box { flex: 1; border: 1.5px solid #385296; }
        .box-title { font-weight: bold; padding: 5px 8px; font-size: 13.5px; border-bottom: 1.5px solid #385296; }
        .box-content { padding: 8px; white-space: pre-wrap; font-size: 13.5px; min-height: 80px; }

        .project-terms { display: flex; justify-content: flex-end; margin-bottom: -1.5px; }
        .pt-table { border-collapse: collapse; width: 340px; text-align: center; font-size: 12px; }
        .pt-table th, .pt-table td { border: 1.5px solid #385296; padding: 4px; }
        .pt-table th { font-weight: normal; }
        .pt-table td { font-weight: normal; }

        .main-table { width: 100%; border-collapse: collapse; border: 1.5px solid #385296; font-size: 13.5px; }
        .main-table th { border: 1.5px solid #385296; padding: 8px; text-align: center; font-weight: bold; }
        .main-table td { border-left: 1.5px solid #385296; border-right: 1.5px solid #385296; padding: 12px; vertical-align: top; }
        
        .desc-col { width: 65%; }
        .qty-col { width: 15%; text-align: center!important; }
        .amt-col { width: 20%; text-align: right!important; padding-right: 10px!important;}

        .footer { margin-top: auto; padding-top: 40px; font-size: 13.5px; line-height: 1.4; font-weight: bold;}
        
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .a4-page { width: 100%; padding: 10mm; margin: 0; box-shadow: none; break-after: auto; }
        }
        .hide-on-print { display: none !important; }
        .show-on-print { display: block !important; }
        span.show-on-print { display: inline !important; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const handleSaveLayout = () => {
    const layout = {
      items,
      invoiceDate,
      invoiceNo,
      customWords,
      paymentsCredits,
      footerCompany,
      footerContact,
      footerEmail,
      footerText
    };

    const actionLog = {
      date: new Date().toISOString(),
      action: 'Saved Print Layout',
      totalCharge: totalCharge
    };

    const isPending = 'invoiceNo' in invoice;
    const currentId = invoice.id;
    
    try {
      if (isPending) {
        useAppStore.getState().updatePendingInvoice(currentId, { 
          printLayout: layout, 
          historyLog: [...((invoice as any).historyLog || []), actionLog] 
        });
      } else {
        useAppStore.getState().updateInvoice(currentId, { 
          printLayout: layout, 
          historyLog: [...((invoice as any).historyLog || []), actionLog] 
        });
      }
      toast.success("Invoice layout successfully saved to history log");
    } catch (e) {
      toast.error("Failed to save layout");
    }
  };

  const handleUpdateItem = (index: number, k: string, val: string | number | boolean) => {
    const newItems = [...items];
    (newItems[index] as any)[k] = val;
    setItems(newItems);
  };
  
  const handleAddItem = () => {
    setItems([...items, { id: generateId(), selected: true, desc: 'New Line Item', qty: 1, amount: 0 }]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="bg-white max-w-[900px] w-full rounded-2xl shadow-2xl h-[96vh] flex flex-col pointer-events-auto overflow-hidden border border-slate-200">

        {/* ── Editor Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <Printer className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">Invoice Print Editor</p>
              <p className="text-[11px] text-slate-400 font-medium">#{invoiceNo} · {invoice.client}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status pill */}
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved Changes
            </span>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveLayout}
              className="h-9 gap-2 text-slate-700 border-slate-200 bg-white hover:bg-slate-50 font-semibold text-xs px-4"
            >
              Save State
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Print Document
            </Button>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Toolbar strip ────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-dashed border-slate-400 inline-block" />
            Dashed fields are editable
          </span>
          <span className="text-slate-300">·</span>
          <span>Click any field in the document to edit it</span>
          <span className="text-slate-300">·</span>
          <span>Fields are hidden when printing</span>
        </div>

        {/* ── A4 Canvas ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-[#e8eaed] p-8 flex justify-center [scrollbar-gutter:stable]">
          <div ref={printRef}>
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
              .invoice-canvas table.main-table { width: 100%; border-collapse: collapse !important; border: 1.5px solid #385296 !important; font-size: 13.5px; background: white; margin: 0 !important; }
              .invoice-canvas table.main-table th { border: 1.5px solid #385296 !important; padding: 8px !important; text-align: center; font-weight: bold; }
              .invoice-canvas table.main-table td { border-left: 1.5px solid #385296 !important; border-right: 1.5px solid #385296 !important; padding: 12px !important; vertical-align: top; }
              .invoice-canvas .desc-col { width: 65%; }
              .invoice-canvas .qty-col { width: 15%; text-align: center!important; }
              .invoice-canvas .amt-col { width: 20%; text-align: right!important; padding-right: 10px!important;}
              .invoice-canvas .footer { margin-top: auto; padding-top: 40px; font-size: 13.5px; line-height: 1.4; font-weight: bold;}
            `}</style>
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

              {/* Line Items Table */}
              <table className="main-table border-t-0" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th className="hide-on-print" style={{ width: '36px', borderRight: 'none', background: '#f8fafc' }}></th>
                    <th className="desc-col">Description</th>
                    <th className="qty-col">Quantity</th>
                    <th className="amt-col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', textAlign: 'center', background: '#fafafa' }}>
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          style={{ color: 'white', fontWeight: 'bold', fontSize: 12, background: '#ef4444', border: 'none', cursor: 'pointer', outline: 'none', borderRadius: '50%', width: 20, height: 20, lineHeight: '20px' }}
                        >&times;</button>
                      </td>
                      <td style={{ borderRight: '1.5px solid #385296' }}>
                        <textarea
                          className="hide-on-print"
                          value={item.desc}
                          onChange={e => handleUpdateItem(idx, 'desc', e.target.value)}
                          style={{ width: '100%', minHeight: '60px', border: '1px dashed #c7d2e0', padding: 4, borderRadius: 3, outline: 'none', resize: 'vertical', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                        />
                        <span className="show-on-print" style={{ display: 'none', whiteSpace: 'pre-wrap' }}>{item.desc}</span>
                      </td>
                      <td className="qty-col" style={{ borderRight: '1.5px solid #385296' }}>
                        <input
                          className="hide-on-print"
                          value={item.qty}
                          onChange={e => handleUpdateItem(idx, 'qty', e.target.value)}
                          style={{ width: '100%', textAlign: 'center', border: '1px dashed #c7d2e0', padding: 4, borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                        />
                        <span className="show-on-print" style={{ display: 'none' }}>{item.qty}</span>
                      </td>
                      <td className="amt-col" style={{ borderRight: 'none' }}>
                        <input
                          className="hide-on-print"
                          type="number"
                          value={item.amount}
                          onChange={e => handleUpdateItem(idx, 'amount', e.target.value)}
                          style={{ width: '100%', textAlign: 'right', border: '1px dashed #c7d2e0', padding: 4, borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 'inherit' }}
                        />
                        <span className="show-on-print" style={{ display: 'none' }}>{parseFloat(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                    </tr>
                  ))}

                  {/* Amount-in-words + Add item row */}
                  <tr>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td style={{ borderRight: '1.5px solid #385296', paddingTop: '24px', paddingBottom: '16px' }}>
                      <button
                        onClick={handleAddItem}
                        className="hide-on-print"
                        style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '12px', display: 'block' }}
                      >+ Add Another Item</button>
                      <textarea
                        className="hide-on-print"
                        value={wordsValue}
                        onChange={e => setCustomWords(e.target.value)}
                        style={{ width: '100%', minHeight: '50px', border: '1px dashed #c7d2e0', padding: 4, fontWeight: 'bold', borderRadius: 3, outline: 'none', background: '#f9fafb', fontFamily: 'inherit', fontSize: 13 }}
                      />
                      <span className="show-on-print" style={{ display: 'none', fontWeight: 'bold', fontSize: '13.5px' }}>{wordsValue}</span>
                    </td>
                    <td className="qty-col" style={{ borderRight: '1.5px solid #385296' }}></td>
                    <td className="amt-col" style={{ borderRight: 'none' }}></td>
                  </tr>

                  {/* Totals */}
                  {vat > 0 ? (
                  <>
                  <tr style={{ borderTop: '1.5px solid #385296' }}>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td rowSpan={5} style={{ borderRight: '1.5px solid #385296', padding: '12px', verticalAlign: 'bottom' }}>
                      <input className="hide-on-print" value={footerText} onChange={e => setFooterText(e.target.value)} style={{ width: '100%', border: '1px dashed #c7d2e0', padding: 4, borderRadius: 3, outline: 'none', background: '#f9fafb', fontSize: 13, fontFamily: 'inherit' }} />
                      <span className="show-on-print" style={{ display: 'none', fontSize: '13.5px' }}>{footerText}</span>
                    </td>
                    <td className="qty-col" style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1.5px solid #385296', textAlign: 'left', padding: '8px 12px' }}>Subtotal</td>
                    <td className="amt-col" style={{ borderBottom: '1px solid #e2e8f0', borderRight: 'none', padding: '8px 12px' }}>NGN {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td className="qty-col" style={{ borderBottom: '1.5px solid #385296', borderRight: '1.5px solid #385296', textAlign: 'left', padding: '8px 12px', color: '#dc2626' }}>VAT Charge {vatIncSetting === 'Yes' ? '(Incl.)' : ''}</td>
                    <td className="amt-col" style={{ borderBottom: '1.5px solid #385296', borderRight: 'none', padding: '8px 12px', color: '#dc2626' }}>NGN {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td className="qty-col" style={{ borderBottom: '1.5px solid #385296', borderRight: '1.5px solid #385296', textAlign: 'left', fontWeight: 'bold', padding: '8px 12px' }}>Total Due</td>
                    <td className="amt-col" style={{ borderBottom: '1.5px solid #385296', borderRight: 'none', fontWeight: 'bold', padding: '8px 12px' }}>NGN {totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  </>
                  ) : (
                  <tr style={{ borderTop: '1.5px solid #385296' }}>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td rowSpan={3} style={{ borderRight: '1.5px solid #385296', padding: '12px', verticalAlign: 'bottom' }}>
                      <input className="hide-on-print" value={footerText} onChange={e => setFooterText(e.target.value)} style={{ width: '100%', border: '1px dashed #c7d2e0', padding: 4, borderRadius: 3, outline: 'none', background: '#f9fafb', fontSize: 13, fontFamily: 'inherit' }} />
                      <span className="show-on-print" style={{ display: 'none', fontSize: '13.5px' }}>{footerText}</span>
                    </td>
                    <td className="qty-col" style={{ borderBottom: '1.5px solid #385296', borderRight: '1.5px solid #385296', textAlign: 'left', fontWeight: 'bold', padding: '10px 12px' }}>Total Due</td>
                    <td className="amt-col" style={{ borderBottom: '1.5px solid #385296', borderRight: 'none', fontWeight: 'bold', padding: '10px 12px' }}>NGN {totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  )}
                  <tr>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td className="qty-col" style={{ borderBottom: '1.5px solid #385296', borderRight: '1.5px solid #385296', textAlign: 'left', fontWeight: 'bold', padding: '10px 12px' }}>Payments/Credits</td>
                    <td className="amt-col" style={{ borderBottom: '1.5px solid #385296', borderRight: 'none', padding: '10px 12px' }}>
                      <span className="hide-on-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                        NGN
                        <input
                          type="number"
                          value={paymentsCredits}
                          onChange={e => setPaymentsCredits(Number(e.target.value))}
                          style={{ width: '80px', textAlign: 'right', border: '1px dashed #c7d2e0', borderRadius: 3, padding: '2px 4px', outline: 'none', background: '#f9fafb' }}
                        />
                      </span>
                      <span className="show-on-print" style={{ display: 'none' }}>NGN {paymentsCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="hide-on-print" style={{ borderLeft: 'none', borderRight: '1.5px solid #385296', background: '#fafafa' }}></td>
                    <td className="qty-col" style={{ borderRight: '1.5px solid #385296', borderBottom: 'none', textAlign: 'left', fontWeight: 'bold', padding: '10px 12px' }}>Balance Due</td>
                    <td className="amt-col" style={{ borderRight: 'none', borderBottom: 'none', fontWeight: 'bold', padding: '10px 12px' }}>NGN {calcBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

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
  );
}

