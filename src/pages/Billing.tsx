import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import React, { useState, useMemo } from 'react';
import { useAppStore, PendingInvoice, Invoice } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, ArrowRightCircle, Upload, Download, Mail, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
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

export function Billing() {
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
    destination: 'Pending' as 'Pending' | 'Active',
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
    setSelectedId(null);
  };

  const livePreview = useMemo(() => {
    const duration = parseFloat(form.duration) || 0;
    const noOfMachine = parseFloat(form.noOfMachine) || 0;
    const dailyRentalCost = parseFloat(form.dailyRentalCost) || 0;
    const noOfTechnician = parseFloat(form.noOfTechnician) || 0;
    const techniciansDailyRate = parseFloat(form.techniciansDailyRate) || 0;
    const dieselCostPerLtr = parseFloat(form.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(form.dailyUsage) || 0;
    const mobDemob = parseFloat(form.mobDemob) || 0;
    const installation = parseFloat(form.installation) || 0;
    const damages = parseFloat(form.damages) || 0;

    const rentalCost = noOfMachine * dailyRentalCost * duration;
    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * duration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * duration;
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

    return { totalCost, vat, totalCharge, vatInc };
  }, [form, sites, vatRate]);

  const calculateFullInvoiceData = (input: any) => {
    const duration = parseFloat(input.duration) || 0;
    const noOfMachine = parseFloat(input.noOfMachine) || 0;
    const dailyRentalCost = parseFloat(input.dailyRentalCost) || 0;
    const noOfTechnician = parseFloat(input.noOfTechnician) || 0;
    const techniciansDailyRate = parseFloat(input.techniciansDailyRate) || 0;
    const dieselCostPerLtr = parseFloat(input.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(input.dailyUsage) || 0;
    const mobDemob = parseFloat(input.mobDemob) || 0;
    const installation = parseFloat(input.installation) || 0;
    const damages = parseFloat(input.damages) || 0;

    let startDate = normalizeDate(input.startDate || input.date);
    let endDate = '';
    if (startDate && duration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setDate(start.getDate() + duration - 1);
        endDate = start.toISOString().split('T')[0];
      }
    } else if (input.endDate || input.dueDate) {
      endDate = normalizeDate(input.endDate || input.dueDate);
    }

    const rentalCost = noOfMachine * dailyRentalCost * duration;
    const dieselCost = noOfMachine * dailyUsage * dieselCostPerLtr * duration;
    const techniciansCost = noOfTechnician * techniciansDailyRate * duration;
    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;

    const totalCost = rentalCost + dieselCost + techniciansCost + instMobDemob + otherCosts;

    const siteName = (input.site || input.siteName || '').trim();
    const clientName = (input.client || '').trim();
    
    let siteObj = siteRegistry.find(s => s.name === siteName && s.client === clientName);
    
    // Fallback: Check if the user accidentally swapped Client and Site
    if (!siteObj) {
      siteObj = siteRegistry.find(s => s.name === clientName && s.client === siteName);
    }
    
    // Site configuration is the ground truth for VAT
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

    return {
      duration, noOfMachine, dailyRentalCost, noOfTechnician, techniciansDailyRate,
      dieselCostPerLtr, dailyUsage, mobDemob, installation, damages,
      startDate, endDate, rentalCost, dieselCost, techniciansCost,
      totalCost, vat, totalCharge, vatInc, 
      totalExclusiveOfVat: totalCharge - vat,
      invoiceNo: input.invoiceNo || input.invoiceNumber || '',
      client: clientName, site: siteName
    };
  };

  const calculateInvoice = (): Omit<PendingInvoice, 'id'> | null => {
    if (!form.invoiceNo || !form.client || !form.site) {
      toast.error('Invoice Number, Client, and Site are required');
      return null;
    }
    const data = calculateFullInvoiceData(form);
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
    setForm({
      ...initialForm,
      vatInc: inv.vatInc || 'No',
      destination: 'totalCost' in inv ? 'Pending' : 'Active',
      startDate: 'startDate' in inv ? inv.startDate : inv.date,
      duration: 'duration' in inv ? String(inv.duration ?? 0) : '0',
      invoiceNo: 'invoiceNo' in inv ? inv.invoiceNo : inv.invoiceNumber,
      client: (inv.client || '').trim(),
      site: (('site' in inv ? inv.site : inv.siteName) || '').trim(),
      noOfMachine: 'noOfMachine' in inv ? String(inv.noOfMachine ?? 0) : '0',
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
      const extractCSV = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

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
  }, [activeTab, invoices, pendingInvoices, sortField, sortOrder, sites]);

  const tableSums = useMemo(() => {
    return (currentList || []).reduce((acc, inv: any) => ({
        rentalCost: acc.rentalCost + (inv.rentalCost || 0),
        dieselCost: acc.dieselCost + (inv.dieselCost || 0),
        otherCost: acc.otherCost + ((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0)),
        totalCost: acc.totalCost + (inv.totalCost || 0),
        vat: acc.vat + (inv.vat || 0),
        totalCharge: acc.totalCharge + (inv.totalCharge || inv.amount || 0),
    }), { rentalCost: 0, dieselCost: 0, otherCost: 0, totalCost: 0, vat: 0, totalCharge: 0 });
  }, [currentList]);

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

  const completedSites = useMemo(() => siteStats.filter(s => s.isCompleted), [siteStats]);
  const unpaidSites = useMemo(() => siteStats.filter(s => s.isUnpaid), [siteStats]);

  const [expandedSiteKey, setExpandedSiteKey] = useState<string | null>(null);

  const formatSum = (val: number) => {
    if (priv?.canViewAmounts === false) return '***';
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Gross Sum</div>
                      <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">
                        ₦{formatSum(tableSums.totalCost)}
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Total Charge</div>
                      <div className="text-[12px] font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                        ₦{formatSum(tableSums.totalCharge)}
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
                      Equipment <SortIcon field="equipment" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('startDate')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Dates & Dur <SortIcon field="startDate" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('costBkdn')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cost Bkdn <SortIcon field="costBkdn" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold px-4 py-3 text-right text-slate-500 uppercase text-[10px] tracking-wider select-none cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    onClick={() => handleSort('totals')}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Totals (₦) <SortIcon field="totals" />
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
                          {priv?.canViewAmounts === false ? '***' : `₦${site.totalInvoiceAmount.toLocaleString()}`}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-bold text-indigo-700 font-mono">
                          {priv?.canViewAmounts === false ? '***' : `₦${site.totalPaymentAmount.toLocaleString()}`}
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
                            {priv?.canViewAmounts === false ? '***' : `₦${(inv.totalCharge || inv.amount || 0).toLocaleString()}`}
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
                        <div><span className="text-slate-400">Mac:</span> {inv.noOfMachine || 0} x {priv?.canViewAmounts === false ? '***' : (inv.dailyRentalCost || 0).toLocaleString()}</div>
                        <div><span className="text-slate-400">Tech:</span> {inv.noOfTechnician || 0} x {priv?.canViewAmounts === false ? '***' : (inv.techniciansDailyRate || 0).toLocaleString()}</div>
                        <div><span className="text-slate-400">DsLtr:</span> {priv?.canViewAmounts === false ? '***' : (inv.dieselCostPerLtr || 0).toLocaleString()} ({(inv.dailyUsage || 0)}L)</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-slate-600">
                        <div className="font-medium text-slate-800">{inv.duration || 0} Days</div>
                        <div className="text-slate-500 text-xs">{formatDisplayDate(inv.startDate || inv.date)} - {formatDisplayDate(inv.endDate || inv.dueDate)}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-slate-600">
                        <div><span className="text-slate-400">Rent:</span> {priv?.canViewAmounts === false ? '***' : (inv.rentalCost || 0).toLocaleString()}</div>
                        <div><span className="text-slate-400">Fuel:</span> {priv?.canViewAmounts === false ? '***' : (inv.dieselCost || 0).toLocaleString()}</div>
                        <div><span className="text-slate-400">Other:</span> {priv?.canViewAmounts === false ? '***' : ((inv.techniciansCost || 0) + (inv.installation || 0) + (inv.mobDemob || 0) + (inv.damages || 0)).toLocaleString()}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="text-slate-500 text-xs">Gross: {priv?.canViewAmounts === false ? '***' : (inv.totalCost || 0).toLocaleString()}</div>
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

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                    <Input type="date" value={form.startDate} onChange={e => handleChange('startDate', e.target.value)} className="bg-slate-50 h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days)</label>
                    <Input type="number" min="0" value={form.duration} onChange={e => handleChange('duration', e.target.value)} className="bg-slate-50 h-11" />
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

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 pt-5 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Machines</label>
                    <Input type="number" min="0" value={form.noOfMachine} onChange={e => handleChange('noOfMachine', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily R. Cost</label>
                    <Input type="number" min="0" value={form.dailyRentalCost} onChange={e => handleChange('dailyRentalCost', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Technicians</label>
                    <Input type="number" min="0" value={form.noOfTechnician} onChange={e => handleChange('noOfTechnician', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Tech Rate</label>
                    <Input type="number" min="0" value={form.techniciansDailyRate} onChange={e => handleChange('techniciansDailyRate', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily Usage (L)</label>
                    <Input type="number" min="0" value={form.dailyUsage} onChange={e => handleChange('dailyUsage', e.target.value)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diesel Cost/ Ltr</label>
                    <Input type="number" min="0" value={form.dieselCostPerLtr} onChange={e => handleChange('dieselCostPerLtr', e.target.value)} className="bg-slate-50" />
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 block">Other Costs</label>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mob/Demob</label>
                      <Input type="number" min="0" value={form.mobDemob} onChange={e => handleChange('mobDemob', e.target.value)} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Install</label>
                      <Input type="number" min="0" value={form.installation} onChange={e => handleChange('installation', e.target.value)} className="bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Damages</label>
                      <Input type="number" min="0" value={form.damages} onChange={e => handleChange('damages', e.target.value)} className="bg-slate-50" />
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
      </div>
    </div>
  );
}

