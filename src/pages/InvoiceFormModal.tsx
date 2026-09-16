import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useAppStore, PendingInvoice, Invoice, InvoiceVatableSections, AuxiliaryEquipmentItem } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import {
  ArrowLeft, FileText, Layers, Users, Truck, Settings,
  CheckCircle, Plus, Trash2, Calendar, History, Info, Mail
} from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useAuth } from '@/src/hooks/useAuth';
import { generateId, cn } from '@/src/lib/utils';
import { NumericFormat } from 'react-number-format';
import { useOperations } from '@/src/contexts/OperationsContext';

export interface MachineRow {
  rate: string;
  duration: string;
  dailyUsage?: string;
  sameRateAsFirst: boolean;
  sameDurationAsFirst: boolean;
  sameUsageAsFirst?: boolean;
}

export interface InvoiceFormModalProps {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  initialInvoice?: Invoice | PendingInvoice | null;
  initialConfigs?: MachineRow[];
  activeTab?: string;
  defaultDestination?: 'Active' | 'Pending';
}

export const defaultVatableSectionsDefault: InvoiceVatableSections = {
  equipment: true,
  technicians: false,
  diesel: true,
  mobDemob: true,
  installation: true,
  damages: false,
};

export const initialInvoiceForm = {
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
  technicianNightFee: '',
  technicianAccommodation: '',
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
  discount: '',
  createReminder: true,
  sendEmailNotification: true,
  vatInc: 'No' as 'Yes' | 'No' | 'Add',
  countOffDays: true,
  vatScope: 'per_section' as 'overall' | 'per_section',
  auxiliaryEquipment: [] as AuxiliaryEquipmentItem[],
  vatableSections: defaultVatableSectionsDefault,
};

export function InvoiceFormModal({
  open,
  onClose,
  selectedId,
  initialInvoice,
  initialConfigs,
  activeTab = 'all',
  defaultDestination = 'Active',
}: InvoiceFormModalProps) {
  const sites = useAppStore((state) => state.sites);
  const pendingSites = useAppStore((state) => state.pendingSites);
  const pendingInvoices = useAppStore((state) => state.pendingInvoices);
  const invoices = useAppStore((state) => state.invoices);
  const addPendingInvoice = useAppStore((state) => state.addPendingInvoice);
  const updatePendingInvoice = useAppStore((state) => state.updatePendingInvoice);
  const deletePendingInvoice = useAppStore((state) => state.deletePendingInvoice);
  const addInvoice = useAppStore((state) => state.addInvoice);
  const updateInvoice = useAppStore((state) => state.updateInvoice);
  const deleteInvoice = useAppStore((state) => state.deleteInvoice);
  const vatRate = useAppStore((state) => state.payrollVariables.vatRate);
  const defaultVatableSections = useAppStore((state) => state.payrollVariables?.defaultVatableSections);
  const { addReminder, updateReminder, reminders } = useAppData();
  const { user: currentUser } = useAuth();
  const { dailyMachineLogs } = useOperations();
  const priv = usePriv('billing');

  const [form, setForm] = useState(initialInvoiceForm);
  const [machineConfigs, setMachineConfigs] = useState<MachineRow[]>([]);

  // Master Site Registry
  const siteRegistry = useMemo(() => {
    const list = [
      ...sites.map((s) => ({
        type: s.status === 'Ended' || (s.endDate && s.endDate.trim() !== '') ? 'Ended' : s.status || 'Active',
        name: (s.name || '').trim(),
        client: (s.client || '').trim(),
        vat: (s.vat || 'No') as 'Yes' | 'No' | 'Add',
      })),
      ...pendingSites.map((ps) => ({
        type: 'Pending',
        name: (ps.siteName || '').trim(),
        client: (ps.clientName || '').trim(),
        vat: (ps.phase4?.clientTaxStatus?.includes('Add')
          ? 'Add'
          : ps.phase4?.clientTaxStatus?.includes('Yes')
          ? 'Yes'
          : 'No') as 'Yes' | 'No' | 'Add',
      })),
    ];
    return list.filter((item) => item.name && item.client);
  }, [sites, pendingSites]);

  // Sync state when modal opens or initialInvoice/initialConfigs change
  useEffect(() => {
    if (!open) return;

    if (initialInvoice) {
      const inv = initialInvoice;
      const noOfMachine = 'noOfMachine' in inv ? String(inv.noOfMachine ?? 0) : '0';
      setForm({
        destination: activeTab === 'quotations' ? 'Pending' : (inv as any).destination || defaultDestination,
        startDate: 'startDate' in inv ? inv.startDate : (inv as any).date || '',
        duration: 'duration' in inv ? String(inv.duration ?? 0) : '0',
        invoiceNo: 'invoiceNo' in inv ? inv.invoiceNo : (inv as any).invoiceNumber || '',
        client: (inv.client || '').trim(),
        site: (('site' in inv ? inv.site : (inv as any).siteName) || '').trim(),
        noOfMachine,
        dailyRentalCost: 'dailyRentalCost' in inv ? String(inv.dailyRentalCost ?? 0) : '0',
        noOfTechnician: 'noOfTechnician' in inv ? String(inv.noOfTechnician ?? 0) : '0',
        techniciansDailyRate: 'techniciansDailyRate' in inv ? String(inv.techniciansDailyRate ?? 0) : '0',
        technicianNightFee: 'technicianNightFee' in inv ? String(inv.technicianNightFee ?? '') : '',
        technicianAccommodation: 'technicianAccommodation' in inv ? String(inv.technicianAccommodation ?? '') : '',
        technicianDuration: 'technicianDuration' in inv ? String(inv.technicianDuration ?? 0) : '0',
        technicianDurationSameAsMachine: 'technicianDurationSameAsMachine' in inv ? (inv.technicianDurationSameAsMachine ?? true) : true,
        technicianNightDuration: 'technicianNightDuration' in inv ? String(inv.technicianNightDuration ?? '') : '',
        technicianNightDurationSameAsMachine: 'technicianNightDurationSameAsMachine' in inv ? (inv.technicianNightDurationSameAsMachine ?? true) : true,
        noOfTechnicianNight: 'noOfTechnicianNight' in inv ? String(inv.noOfTechnicianNight ?? '') : '',
        technicianNightCountSameAsDay: 'technicianNightCountSameAsDay' in inv ? (inv.technicianNightCountSameAsDay ?? true) : true,
        technicianAccommodationUseNightCount: 'technicianAccommodationUseNightCount' in inv ? (inv.technicianAccommodationUseNightCount ?? false) : false,
        dieselCostPerLtr: 'dieselCostPerLtr' in inv ? String(inv.dieselCostPerLtr ?? 0) : '0',
        dailyUsage: 'dailyUsage' in inv ? String(inv.dailyUsage ?? 0) : '0',
        mobDemob: 'mobDemob' in inv ? String(inv.mobDemob ?? 0) : '0',
        installation: 'installation' in inv ? String(inv.installation ?? 0) : '0',
        damages: 'damages' in inv ? String(inv.damages ?? 0) : '0',
        discount: 'discount' in inv ? String(inv.discount ?? 0) : '0',
        createReminder: false,
        sendEmailNotification: true,
        vatInc: inv.vatInc || 'No',
        countOffDays: 'countOffDays' in inv ? (inv.countOffDays ?? true) : true,
        vatScope: inv.vatScope || 'per_section',
        auxiliaryEquipment: inv.auxiliaryEquipment ? [...inv.auxiliaryEquipment] : [],
        vatableSections: inv.vatableSections || defaultVatableSections || defaultVatableSectionsDefault,
      });

      if (initialConfigs && initialConfigs.length > 0) {
        setMachineConfigs(initialConfigs);
      } else if (inv.machineConfigs && inv.machineConfigs.length > 0) {
        const firstUsage = 'dailyUsage' in inv.machineConfigs[0] ? (inv.machineConfigs[0] as any).dailyUsage : undefined;
        setMachineConfigs(
          inv.machineConfigs.map((c, i) => ({
            rate: String(c.rate),
            duration: String(c.duration),
            dailyUsage: 'dailyUsage' in c && (c as any).dailyUsage !== undefined ? String((c as any).dailyUsage) : ('dailyUsage' in inv ? String(inv.dailyUsage ?? '') : ''),
            sameRateAsFirst: i > 0 && c.rate === inv.machineConfigs![0].rate,
            sameDurationAsFirst: i > 0 && c.duration === inv.machineConfigs![0].duration,
            sameUsageAsFirst: i > 0 && (c as any).dailyUsage === firstUsage,
          }))
        );
      } else {
        const n = parseInt(noOfMachine) || 0;
        const rate = 'dailyRentalCost' in inv ? String(inv.dailyRentalCost ?? '') : '';
        const dur = 'duration' in inv ? String(inv.duration ?? '') : '';
        const usage = 'dailyUsage' in inv ? String(inv.dailyUsage ?? '') : '';
        setMachineConfigs(
          Array.from({ length: n }, (_, i) => ({
            rate,
            duration: dur,
            dailyUsage: usage,
            sameRateAsFirst: i > 0,
            sameDurationAsFirst: i > 0,
            sameUsageAsFirst: i > 0,
          }))
        );
      }
    } else {
      setForm({
        ...initialInvoiceForm,
        destination: activeTab === 'quotations' ? 'Pending' : defaultDestination,
        vatableSections: defaultVatableSections || defaultVatableSectionsDefault,
      });
      setMachineConfigs(initialConfigs || []);
    }
  }, [open, initialInvoice, initialConfigs, activeTab, defaultDestination, defaultVatableSections]);

  // Collapse sidebar when modal is active
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('sidebar:collapse'));
      return () => {
        window.dispatchEvent(new CustomEvent('sidebar:restore'));
      };
    }
  }, [open]);

  // Machine configs synchronization
  const handleNoOfMachineChange = (val: string) => {
    handleChange('noOfMachine', val);
    const n = parseInt(val) || 0;
    setMachineConfigs((prev) => {
      const next: MachineRow[] = [];
      for (let i = 0; i < n; i++) {
        if (prev[i]) {
          next.push(prev[i]);
        } else {
          next.push({
            rate: prev[0]?.rate ?? '',
            duration: prev[0]?.duration ?? '',
            dailyUsage: prev[0]?.dailyUsage ?? form.dailyUsage ?? '',
            sameRateAsFirst: i > 0,
            sameDurationAsFirst: i > 0,
            sameUsageAsFirst: i > 0,
          });
        }
      }
      return next;
    });
  };

  const handleMachineRowChange = (idx: number, field: 'rate' | 'duration' | 'dailyUsage', val: string) => {
    setMachineConfigs((prev) => {
      return prev.map((r, i) => {
        if (i === idx) return { ...r, [field]: val };
        if (idx === 0) {
          if (field === 'rate' && r.sameRateAsFirst) return { ...r, rate: val };
          if (field === 'duration' && r.sameDurationAsFirst) return { ...r, duration: val };
          if (field === 'dailyUsage' && r.sameUsageAsFirst) return { ...r, dailyUsage: val };
        }
        return r;
      });
    });
  };

  const handleMachineSameToggle = (idx: number, field: 'rate' | 'duration' | 'dailyUsage', checked: boolean) => {
    setMachineConfigs((prev) => {
      const first = prev[0];
      return prev.map((r, i) => {
        if (i !== idx) return r;
        if (field === 'rate') {
          return checked ? { ...r, sameRateAsFirst: true, rate: first?.rate ?? '' } : { ...r, sameRateAsFirst: false };
        } else if (field === 'duration') {
          return checked ? { ...r, sameDurationAsFirst: true, duration: first?.duration ?? '' } : { ...r, sameDurationAsFirst: false };
        } else {
          return checked ? { ...r, sameUsageAsFirst: true, dailyUsage: first?.dailyUsage ?? '' } : { ...r, sameUsageAsFirst: false };
        }
      });
    });
  };

  const uniqueClients = useMemo(() => {
    const clients = new Set(siteRegistry.map((s) => s.client));
    if (form.client && !clients.has(form.client)) {
      clients.add(form.client);
    }
    return Array.from(clients).sort();
  }, [siteRegistry, form.client]);

  const sitesBySelectedClient = useMemo(() => {
    const matches = siteRegistry.filter((s) => s.client === form.client).map((s) => ({ name: s.name, type: s.type }));
    if (form.site && !matches.some((m) => m.name === form.site)) {
      matches.push({ name: form.site, type: 'N/A' });
    }
    const seen = new Set();
    return matches.filter((m) => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [siteRegistry, form.client, form.site]);

  const lastInvoiceForSelectedSite = useMemo(() => {
    if (!form.client || !form.site) return null;

    const normClient = form.client.trim().toLowerCase();
    const normSite = form.site.trim().toLowerCase();

    const matchingActive = invoices.filter((inv) => {
      if (selectedId && inv.id === selectedId) return false;
      const c = (inv.client || '').trim().toLowerCase();
      const s = (inv.siteName || inv.project || '').trim().toLowerCase();
      return c === normClient && s === normSite;
    });

    const matchingPending = pendingInvoices.filter((inv) => {
      if (selectedId && inv.id === selectedId) return false;
      const c = (inv.client || '').trim().toLowerCase();
      const s = (inv.site || '').trim().toLowerCase();
      return c === normClient && s === normSite;
    });

    const candidates = [
      ...matchingActive.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalCharge ?? inv.amount ?? 0,
        startDate: inv.date || '',
        endDate: inv.dueDate || inv.date || '',
        isQuotation: false,
        duration: inv.duration,
      })),
      ...matchingPending.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNo,
        amount: inv.totalCharge ?? inv.totalCost ?? 0,
        startDate: inv.startDate || '',
        endDate: inv.endDate || inv.startDate || '',
        isQuotation: true,
        duration: inv.duration,
      })),
    ];

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const dateA = a.endDate || a.startDate || '';
      const dateB = b.endDate || b.startDate || '';
      if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '', undefined, { numeric: true });
    });

    const latest = candidates[0];

    let suggestedNextStartDate = '';
    if (latest.endDate) {
      const normalizedEnd = normalizeDate(latest.endDate);
      if (normalizedEnd) {
        const parts = normalizedEnd.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          d.setDate(d.getDate() + 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          suggestedNextStartDate = `${y}-${m}-${day}`;
        }
      }
    }

    return {
      ...latest,
      suggestedNextStartDate,
    };
  }, [form.client, form.site, invoices, pendingInvoices, selectedId]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => {
      let nextAux = prev.auxiliaryEquipment;
      if (field === 'duration') {
        const newDur = parseFloat(value) || 0;
        nextAux = (prev.auxiliaryEquipment || []).map((item) => {
          if (item.sameDurationAsInvoice) {
            const q = item.quantity || 1;
            const r = item.rate || 0;
            return {
              ...item,
              duration: newDur,
              totalCost: q * r * newDur,
            };
          }
          return item;
        });
      }
      return { ...prev, [field]: value, auxiliaryEquipment: nextAux };
    });
  };

  const handleAddAuxiliaryItem = () => {
    const defaultDur = parseFloat(form.duration) || 0;
    const newItem: AuxiliaryEquipmentItem = {
      id: generateId(),
      name: '',
      quantity: 1,
      rate: 0,
      duration: defaultDur,
      sameDurationAsInvoice: true,
      totalCost: 0,
      note: '',
    };
    setForm((prev) => ({
      ...prev,
      auxiliaryEquipment: [...(prev.auxiliaryEquipment || []), newItem],
    }));
  };

  const handleUpdateAuxiliaryItem = (id: string, updates: Partial<AuxiliaryEquipmentItem>) => {
    setForm((prev) => {
      const list = (prev.auxiliaryEquipment || []).map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        const q = updated.quantity !== undefined ? updated.quantity : 1;
        const r = updated.rate !== undefined ? updated.rate : 0;
        const d = updated.duration !== undefined ? updated.duration : 0;
        updated.totalCost = q * r * d;
        return updated;
      });
      return { ...prev, auxiliaryEquipment: list };
    });
  };

  const handleRemoveAuxiliaryItem = (id: string) => {
    setForm((prev) => ({
      ...prev,
      auxiliaryEquipment: (prev.auxiliaryEquipment || []).filter((item) => item.id !== id),
    }));
  };

  const isFormDirty = useMemo(() => {
    if (!open) return false;
    if (selectedId) return true;
    const hasClientOrSite = !!form.client || !!form.site;
    const hasPumps = (parseInt(form.noOfMachine) || 0) > 0;
    const hasAuxiliary = (form.auxiliaryEquipment?.length || 0) > 0;
    const hasTechnicians = (parseFloat(form.noOfTechnician) || 0) > 0;
    const hasDailyRental = (parseFloat(form.dailyRentalCost) || 0) > 0;
    const hasMobOrInst = (parseFloat(form.mobDemob) || 0) > 0 || (parseFloat(form.installation) || 0) > 0 || (parseFloat(form.damages) || 0) > 0;
    const hasMachineConfig = machineConfigs.some((m) => (parseFloat(m.rate) || 0) > 0);
    return hasClientOrSite || hasPumps || hasAuxiliary || hasTechnicians || hasDailyRental || hasMobOrInst || hasMachineConfig;
  }, [open, selectedId, form, machineConfigs]);

  const handleRequestCloseModal = async () => {
    if (isFormDirty) {
      const discard = await showConfirm(
        'You have unsaved changes on this invoice. Do you want to stay and save your invoice, or discard your changes and leave?',
        {
          title: 'Unsaved Invoice Changes',
          confirmLabel: 'Discard Changes',
          cancelLabel: 'Stay & Save',
          variant: 'danger',
        }
      );
      if (!discard) return;
    }
    onClose();
  };

  const livePreview = useMemo(() => {
    const noOfMachine = parseInt(form.noOfMachine) || 0;
    const noOfTechnician = parseFloat(form.noOfTechnician) || 0;
    const techDayFee = parseFloat(form.techniciansDailyRate) || 0;
    const techNightFee = parseFloat(form.technicianNightFee) || 0;
    const techAccommodation = parseFloat(form.technicianAccommodation) || 0;
    const effectiveTechDailyRate = techDayFee + techNightFee + techAccommodation;
    const dieselCostPerLtr = parseFloat(form.dieselCostPerLtr) || 0;
    const dailyUsage = parseFloat(form.dailyUsage) || 0;
    const mobDemob = parseFloat(form.mobDemob) || 0;
    const installation = parseFloat(form.installation) || 0;
    const damages = parseFloat(form.damages) || 0;
    const discount = parseFloat(form.discount) || 0;

    const auxiliaryEquipment = form.auxiliaryEquipment || [];
    const maxAuxDuration = auxiliaryEquipment.length > 0
      ? Math.max(...auxiliaryEquipment.map((a) => parseFloat(String(a.duration)) || 0))
      : 0;

    const pumpDuration = machineConfigs.length > 0
      ? Math.max(...machineConfigs.map((r) => parseFloat(r.duration) || 0))
      : (parseFloat(form.duration) || 0);

    const maxDuration = Math.max(pumpDuration, maxAuxDuration);

    const rentalCost = machineConfigs.reduce((sum, row) => {
      return sum + (parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0);
    }, 0);

    const auxiliaryCost = auxiliaryEquipment.reduce((sum, item) => {
      const q = parseFloat(String(item.quantity)) || 1;
      const r = parseFloat(String(item.rate)) || 0;
      const d = parseFloat(String(item.duration)) || 0;
      return sum + (q * r * d);
    }, 0);

    const actualTechDuration = form.technicianDurationSameAsMachine ? maxDuration : (parseFloat(form.technicianDuration) || 0);
    const actualNightDuration = form.technicianNightDurationSameAsMachine ? maxDuration : (parseFloat(form.technicianNightDuration) || 0);

    const dieselCost = machineConfigs.length > 0
      ? machineConfigs.reduce((sum, row) => {
          const usage = row.dailyUsage !== undefined && row.dailyUsage !== '' ? (parseFloat(row.dailyUsage) || 0) : dailyUsage;
          return sum + usage * dieselCostPerLtr * (parseFloat(row.duration) || 0);
        }, 0)
      : noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;

    const noOfTechnicianNight = form.technicianNightCountSameAsDay ? noOfTechnician : (parseFloat(form.noOfTechnicianNight) || 0);
    const accomCrewCount = form.technicianAccommodationUseNightCount ? noOfTechnicianNight : noOfTechnician;

    const techDayCost = noOfTechnician * techDayFee * actualTechDuration;
    const techNightCost = noOfTechnicianNight * techNightFee * actualNightDuration;
    const techAccomCost = accomCrewCount * techAccommodation * actualTechDuration;
    const techniciansCost = techDayCost + techNightCost + techAccomCost;

    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;
    const subtotalCost = rentalCost + auxiliaryCost + dieselCost + techniciansCost + instMobDemob + otherCosts;
    const totalCost = Math.max(0, subtotalCost - discount);

    let siteRecord = siteRegistry.find((s) => s.name === form.site && s.client === form.client);
    if (!siteRecord) {
      siteRecord = siteRegistry.find((s) => s.name === form.client && s.client === form.site);
    }
    const vatInc = siteRecord ? siteRecord.vat : 'No';

    const vatScope: 'overall' | 'per_section' = form.vatScope || 'per_section';
    const vatableSections = form.vatableSections || defaultVatableSectionsDefault;

    let vat = 0;
    let vatableAmount = 0;
    let nonVatableAmount = 0;
    let totalCharge = totalCost;

    if (vatScope === 'per_section') {
      const eqVal = (vatableSections.equipment ?? true) ? (rentalCost + auxiliaryCost) : 0;
      const techVal = (vatableSections.technicians ?? false) ? techniciansCost : 0;
      const dieselVal = (vatableSections.diesel ?? true) ? dieselCost : 0;
      const mobVal = (vatableSections.mobDemob ?? true) ? mobDemob : 0;
      const instVal = (vatableSections.installation ?? true) ? installation : 0;
      const damVal = (vatableSections.damages ?? false) ? damages : 0;

      const grossVatable = eqVal + techVal + dieselVal + mobVal + instVal + damVal;
      const grossNonVatable = Math.max(0, subtotalCost - grossVatable);

      let netVatable = grossVatable;
      let netNonVatable = grossNonVatable;

      if (discount > 0 && subtotalCost > 0) {
        const vatableRatio = grossVatable / subtotalCost;
        const vatableDiscount = discount * vatableRatio;
        const nonVatableDiscount = discount - vatableDiscount;
        netVatable = Math.max(0, grossVatable - vatableDiscount);
        netNonVatable = Math.max(0, grossNonVatable - nonVatableDiscount);
      }

      vatableAmount = netVatable;
      nonVatableAmount = netNonVatable;

      if (vatInc === 'Yes') {
        vat = (netVatable / (100 + vatRate)) * vatRate;
        totalCharge = totalCost;
      } else if (vatInc === 'Add') {
        vat = netVatable * (vatRate / 100);
        totalCharge = totalCost + vat;
      } else {
        vat = 0;
        totalCharge = totalCost;
      }
    } else {
      if (vatInc === 'Yes') {
        vat = (totalCost / (100 + vatRate)) * vatRate;
        vatableAmount = totalCost;
        nonVatableAmount = 0;
        totalCharge = totalCost;
      } else if (vatInc === 'Add') {
        vat = totalCost * (vatRate / 100);
        vatableAmount = totalCost;
        nonVatableAmount = 0;
        totalCharge = totalCost + vat;
      } else {
        vat = 0;
        vatableAmount = 0;
        nonVatableAmount = totalCost;
        totalCharge = totalCost;
      }
    }

    const calcSectionVat = (amount: number, isVatable: boolean) => {
      if (!isVatable || amount <= 0 || vatInc === 'No') return 0;
      let netAmt = amount;
      if (discount > 0 && subtotalCost > 0) {
        const secDiscount = discount * (amount / subtotalCost);
        netAmt = Math.max(0, amount - secDiscount);
      }
      if (vatInc === 'Yes') return (netAmt / (100 + vatRate)) * vatRate;
      if (vatInc === 'Add') return netAmt * (vatRate / 100);
      return 0;
    };

    const equipmentVat = calcSectionVat(rentalCost + auxiliaryCost, vatScope === 'overall' ? true : (vatableSections.equipment ?? true));
    const techniciansVat = calcSectionVat(techniciansCost, vatScope === 'overall' ? true : (vatableSections.technicians ?? false));
    const dieselVat = calcSectionVat(dieselCost, vatScope === 'overall' ? true : (vatableSections.diesel ?? true));
    const mobDemobVat = calcSectionVat(mobDemob, vatScope === 'overall' ? true : (vatableSections.mobDemob ?? true));
    const installationVat = calcSectionVat(installation, vatScope === 'overall' ? true : (vatableSections.installation ?? true));
    const damagesVat = calcSectionVat(damages, vatScope === 'overall' ? true : (vatableSections.damages ?? false));
    const otherChargesVat = mobDemobVat + installationVat + damagesVat;

    return {
      totalCost, subtotalCost, discount, vat, totalCharge, vatInc,
      vatScope, vatableSections, vatableAmount, nonVatableAmount,
      equipmentVat, techniciansVat, dieselVat, mobDemobVat, installationVat, damagesVat, otherChargesVat,
      maxDuration, actualTechDuration, actualNightDuration,
      techniciansCost, effectiveTechDailyRate, noOfTechnicianNight,
      accomCrewCount, dieselCost, rentalCost, auxiliaryCost, auxiliaryEquipment, mobDemob, installation, damages,
    };
  }, [form, machineConfigs, siteRegistry, vatRate]);

  const calculateFullInvoiceData = (input: any, configs?: { rate: string; duration: string }[]) => {
    const noOfMachine = parseInt(input.noOfMachine) || 0;
    const noOfTechnician = parseFloat(input.noOfTechnician) || 0;
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

    const auxiliaryEquipment = input.auxiliaryEquipment || [];
    const maxAuxDuration = auxiliaryEquipment.length > 0
      ? Math.max(...auxiliaryEquipment.map((a: any) => parseFloat(a.duration) || 0))
      : 0;

    const pumpDuration = activeCfgs
      ? Math.max(...activeCfgs.map((r) => parseFloat(r.duration) || 0))
      : (parseFloat(input.duration) || 0);

    const maxDuration = Math.max(pumpDuration, maxAuxDuration);
    const isTechSame = input.technicianDurationSameAsMachine ?? true;
    const actualTechDuration = isTechSame ? maxDuration : (parseFloat(input.technicianDuration) || 0);

    const siteName = (input.site || input.siteName || '').trim();
    const clientName = (input.client || '').trim();

    let siteObj = siteRegistry.find((s) => s.name === siteName && s.client === clientName) ||
      siteRegistry.find((s) => s.name === clientName && s.client === siteName);
    const realSite = sites.find((s) => s.name === siteName && s.client === clientName) ||
      sites.find((s) => s.name === clientName && s.client === siteName);
    const siteId = realSite?.id;

    let startDate = normalizeDate(input.startDate || input.date);
    let endDate = '';
    if (startDate && maxDuration > 0) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        if (input.countOffDays === false && siteId) {
          const logsByDate = new Map<string, typeof dailyMachineLogs>();
          for (let i = 0; i < dailyMachineLogs.length; i++) {
            const log = dailyMachineLogs[i];
            if (log.siteId === siteId && log.date) {
              if (!logsByDate.has(log.date)) logsByDate.set(log.date, []);
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
                ? logsForDate.filter((l) => linkedAssets.includes(l.assetId))
                : logsForDate;

              if (relevantLogs.length > 0) {
                const contributions = relevantLogs.map((l) => {
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

    const rentalCost = activeCfgs
      ? activeCfgs.reduce((sum, row) => sum + (parseFloat(row.rate) || 0) * (parseFloat(row.duration) || 0), 0)
      : (parseInt(input.noOfMachine) || 0) * (parseFloat(input.dailyRentalCost) || 0) * maxDuration;

    const isNightSame = input.technicianNightDurationSameAsMachine ?? true;
    const actualNightDuration = isNightSame ? maxDuration : (parseFloat(input.technicianNightDuration) || 0);

    const dieselCost = activeCfgs
      ? activeCfgs.reduce((sum, row) => {
          const usage = (row as any).dailyUsage !== undefined && (row as any).dailyUsage !== '' ? (parseFloat((row as any).dailyUsage) || 0) : dailyUsage;
          return sum + usage * dieselCostPerLtr * (parseFloat(row.duration) || 0);
        }, 0)
      : noOfMachine * dailyUsage * dieselCostPerLtr * maxDuration;

    const isNightCountSame = input.technicianNightCountSameAsDay ?? true;
    const noOfTechnicianNight = isNightCountSame ? noOfTechnician : (parseFloat(input.noOfTechnicianNight) || 0);
    const useNightForAccom = input.technicianAccommodationUseNightCount ?? false;
    const accomCrewCount = useNightForAccom ? noOfTechnicianNight : noOfTechnician;

    const techDayCost = noOfTechnician * techDayFee * actualTechDuration;
    const techNightCost = noOfTechnicianNight * techNightFee * actualNightDuration;
    const techAccomCost = accomCrewCount * techAccommodation * actualTechDuration;
    const techniciansCost = techDayCost + techNightCost + techAccomCost;

    const instMobDemob = mobDemob + installation;
    const otherCosts = damages;
    const discount = parseFloat(input.discount) || 0;

    const auxiliaryCost = auxiliaryEquipment.reduce((sum: number, item: any) => {
      const q = parseFloat(item.quantity) || 1;
      const r = parseFloat(item.rate) || 0;
      const d = parseFloat(item.duration) || 0;
      return sum + (q * r * d);
    }, 0);

    const subtotalCost = rentalCost + auxiliaryCost + dieselCost + techniciansCost + instMobDemob + otherCosts;
    const totalCost = Math.max(0, subtotalCost - discount);

    const vatInc = siteObj ? siteObj.vat : (input.vatInc || 'No');
    const vatScope: 'overall' | 'per_section' = input.vatScope || 'per_section';
    const vatableSections: InvoiceVatableSections = input.vatableSections || defaultVatableSectionsDefault;

    let vat = 0;
    let vatableAmount = 0;
    let nonVatableAmount = 0;
    let totalCharge = totalCost;

    if (vatScope === 'per_section') {
      const eqVal = (vatableSections.equipment ?? true) ? (rentalCost + auxiliaryCost) : 0;
      const techVal = (vatableSections.technicians ?? false) ? techniciansCost : 0;
      const dieselVal = (vatableSections.diesel ?? true) ? dieselCost : 0;
      const mobVal = (vatableSections.mobDemob ?? true) ? mobDemob : 0;
      const instVal = (vatableSections.installation ?? true) ? installation : 0;
      const damVal = (vatableSections.damages ?? false) ? damages : 0;

      const grossVatable = eqVal + techVal + dieselVal + mobVal + instVal + damVal;
      const grossNonVatable = Math.max(0, subtotalCost - grossVatable);

      let netVatable = grossVatable;
      let netNonVatable = grossNonVatable;

      if (discount > 0 && subtotalCost > 0) {
        const vatableRatio = grossVatable / subtotalCost;
        const vatableDiscount = discount * vatableRatio;
        const nonVatableDiscount = discount - vatableDiscount;
        netVatable = Math.max(0, grossVatable - vatableDiscount);
        netNonVatable = Math.max(0, grossNonVatable - nonVatableDiscount);
      }

      vatableAmount = netVatable;
      nonVatableAmount = netNonVatable;

      if (vatInc === 'Yes') {
        vat = (netVatable / (100 + vatRate)) * vatRate;
        totalCharge = totalCost;
      } else if (vatInc === 'Add') {
        vat = netVatable * (vatRate / 100);
        totalCharge = totalCost + vat;
      } else {
        vat = 0;
        totalCharge = totalCost;
      }
    } else {
      vatableAmount = totalCost;
      nonVatableAmount = 0;

      if (vatInc === 'Yes') {
        vat = (totalCost / (100 + vatRate)) * vatRate;
        totalCharge = totalCost;
      } else if (vatInc === 'Add') {
        vat = totalCost * (vatRate / 100);
        totalCharge = totalCost + vat;
      } else {
        vat = 0;
        totalCharge = totalCost;
      }
    }

    const machineConfigsOut = activeCfgs
      ? activeCfgs.map((r) => ({
          qt: 1,
          rate: parseFloat(r.rate) || 0,
          duration: parseFloat(r.duration) || 0,
          dailyUsage: (r as any).dailyUsage !== undefined && (r as any).dailyUsage !== '' ? (parseFloat((r as any).dailyUsage) || 0) : dailyUsage,
        }))
      : undefined;

    return {
      duration: maxDuration, noOfMachine,
      dailyRentalCost: parseFloat(input.dailyRentalCost) || 0,
      noOfTechnician, techniciansDailyRate,
      dieselCostPerLtr, dailyUsage, mobDemob, installation, damages, discount,
      startDate, endDate, rentalCost, auxiliaryCost, auxiliaryEquipment, dieselCost, techniciansCost,
      subtotalCost, totalCost, vat, totalCharge, vatInc,
      vatScope, vatableSections, vatableAmount, nonVatableAmount,
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
      id: '',
      ...data,
    } as any;
  };

  const handleSubmit = () => {
    const data = calculateInvoice();
    if (!data) return;

    const existingInActive = selectedId ? invoices.find((i) => i.id === selectedId) : null;
    const existingInPending = selectedId ? pendingInvoices.find((i) => i.id === selectedId) : null;
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
        siteId: sites.find((s) => s.name === data.site)?.id || '',
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
        discount: data.discount,
        duration: data.duration,
        rentalCost: data.rentalCost,
        auxiliaryCost: data.auxiliaryCost,
        auxiliaryEquipment: data.auxiliaryEquipment,
        dieselCost: data.dieselCost,
        techniciansCost: data.techniciansCost,
        totalCost: data.totalCost,
        vat: data.vat,
        totalCharge: data.totalCharge,
        totalExclusiveOfVat: data.totalExclusiveOfVat,
        vatScope: data.vatScope,
        vatableSections: data.vatableSections,
        vatableAmount: data.vatableAmount,
        nonVatableAmount: data.nonVatableAmount,
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
        deletePendingInvoice(selectedId!);
        addInvoice(newInvoice);
        toast.success('Moved to Active Invoices');
      } else if (selectedId && existingInActive) {
        updateInvoice(selectedId, newInvoice);
        toast.success('Active Invoice updated successfully');
      } else {
        addInvoice(newInvoice);
        toast.success('Active Invoice created successfully');
      }
    } else {
      const pendingId = selectedId && !movingFromActiveToQuotation ? selectedId : generateId();
      invoiceIdToUse = pendingId;
      const pendingData = { ...data, id: pendingId } as any;

      if (movingFromActiveToQuotation) {
        deleteInvoice(selectedId!);
        addPendingInvoice({ ...pendingData, id: generateId() });
        toast.success('Moved to Quotations');
      } else if (selectedId && existingInPending) {
        updatePendingInvoice(selectedId, pendingData);
        toast.success('Quotation updated successfully');
      } else {
        addPendingInvoice({ ...data, id: generateId() });
        toast.success('Quotation created successfully');
      }
    }

    if (currentUser && data.endDate) {
      const existingReminder = reminders?.find(
        (r) =>
          r.sourceRef === 'invoice_' + invoiceIdToUse ||
          (selectedId && r.title.includes(`[Invoice]`) && r.body.includes(`Invoice ${form.invoiceNo} `))
      );

      if (form.createReminder || existingReminder) {
        const actualEndDate = new Date(data.endDate);
        const isCountingOffDays = data.countOffDays !== false;
        const endDateLabel = isCountingOffDays ? 'projected end date' : 'actual end date (off-days excluded)';

        const auxList: string[] = [];
        const auxItems: AuxiliaryEquipmentItem[] = data.auxiliaryEquipment || [];
        const invoiceStartDate = normalizeDate(data.startDate || (data as any).date);

        auxItems.forEach((aux) => {
          const auxDur = parseFloat(String(aux.duration)) || 0;
          let auxEndStr = '';
          if (invoiceStartDate && auxDur > 0) {
            const aStart = new Date(invoiceStartDate);
            if (!isNaN(aStart.getTime())) {
              aStart.setDate(aStart.getDate() + auxDur - 1);
              auxEndStr = ` (Lease expires: ${formatDisplayDate(aStart.toISOString().split('T')[0])})`;
            }
          }
          auxList.push(`• ${aux.name || 'Auxiliary Asset'}: ${aux.quantity || 1} unit(s) for ${auxDur}d${auxEndStr}`);
        });

        const auxSectionText = auxList.length > 0 ? `\n\nLeased Auxiliary Assets:\n${auxList.join('\n')}` : '';
        const title = `[Invoice] ${form.client} – ${form.site} ending soon`;
        const body = `Invoice ${form.invoiceNo} reaches its ${endDateLabel} on ${actualEndDate.toLocaleDateString()}.${auxSectionText}\n\nConfirm with the client to extend lease or prepare return.`;

        if (existingReminder) {
          updateReminder(existingReminder.id, {
            title,
            body,
            remindAt: actualEndDate.toISOString(),
            endAt: actualEndDate.toISOString(),
            sourceRef: 'invoice_' + invoiceIdToUse,
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
            sourceRef: 'invoice_' + invoiceIdToUse,
          });
        }
      }
    }

    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99] bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col w-full h-full animate-in fade-in duration-200">
      {/* Page header — fixed top bar with WebkitAppRegion: 'no-drag' to guarantee click response in Electron */}
      <div
        className="shrink-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 md:px-8 py-2.5 shadow-2xs"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              className="gap-1.5 h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 -ml-1 shrink-0 transition-colors font-semibold cursor-pointer relative z-20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRequestCloseModal();
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Back to Invoices</span>
            </Button>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-800" />
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none">
                {selectedId ? 'Edit' : 'Create'} {form.destination === 'Active' ? 'Active Invoice' : 'Quotation'}
              </h2>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                Manage billing rates, crew accommodation, machinery configs, and auto-reminders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Destination:</span>
            <select
              value={form.destination}
              onChange={(e) => handleChange('destination', e.target.value)}
              className="flex h-8 w-36 rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs outline-none font-bold text-slate-800 dark:text-white shadow-xs focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Pending">Quotation</option>
              <option value="Active">Active Invoice</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable container starting immediately below the header */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-5 flex flex-col gap-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Main form column */}
          <div className="space-y-6">
            {/* Section 1: Client & Invoice Info */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-sm text-blue-600 dark:text-blue-400">
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
                      onChange={(e) => {
                        const val = e.target.value;
                        const siteForClient = siteRegistry.find((s) => s.client === val && s.name === form.site);
                        setForm((f) => ({
                          ...f,
                          client: val,
                          site: '',
                          vatInc: siteForClient ? siteForClient.vat : f.vatInc,
                        }));
                      }}
                      className="flex h-11 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-semibold text-slate-800 dark:text-white"
                    >
                      <option value="">Select Client...</option>
                      {uniqueClients.map((c, i) => (
                        <option key={i} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Site Location</label>
                    <select
                      value={form.site}
                      onChange={(e) => {
                        const val = e.target.value;
                        const siteObj = siteRegistry.find((s) => s.name === val && s.client === form.client);

                        let nextStart = form.startDate;
                        if (!nextStart && val) {
                          const normClient = form.client.trim().toLowerCase();
                          const normSite = val.trim().toLowerCase();
                          const prevMatches = invoices
                            .filter((i) => {
                              if (selectedId && i.id === selectedId) return false;
                              return (
                                (i.client || '').trim().toLowerCase() === normClient &&
                                (i.siteName || i.project || '').trim().toLowerCase() === normSite
                              );
                            })
                            .sort((a, b) => (b.dueDate || b.date || '').localeCompare(a.dueDate || a.date || ''));

                          if (prevMatches.length > 0 && (prevMatches[0].dueDate || prevMatches[0].date)) {
                            const normEnd = normalizeDate(prevMatches[0].dueDate || prevMatches[0].date);
                            if (normEnd) {
                              const parts = normEnd.split('-');
                              if (parts.length === 3) {
                                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                d.setDate(d.getDate() + 1);
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                nextStart = `${y}-${m}-${day}`;
                              }
                            }
                          }
                        }

                        setForm((f) => ({
                          ...f,
                          site: val,
                          startDate: nextStart,
                          vatInc: siteObj ? siteObj.vat : f.vatInc,
                        }));
                      }}
                      disabled={!form.client}
                      className="flex h-11 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-semibold text-slate-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Site...</option>
                      {sitesBySelectedClient.map((s, i) => (
                        <option key={i} value={s.name}>
                          {s.name} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Last Invoice Reference Banner */}
                {form.client && form.site && (
                  <div
                    className={cn(
                      'rounded-xl border p-3.5 transition-all',
                      lastInvoiceForSelectedSite
                        ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                        : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                    )}
                  >
                    {lastInvoiceForSelectedSite ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-sm bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <History className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                Last {lastInvoiceForSelectedSite.isQuotation ? 'Quotation' : 'Invoice'}:
                              </span>
                              <span className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 rounded-sm text-[11px] border border-blue-200 dark:border-blue-800">
                                #{lastInvoiceForSelectedSite.invoiceNumber || '—'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-350">
                              <span>
                                Last End Date:{' '}
                                <strong className="text-slate-900 dark:text-white font-bold">
                                  {formatDisplayDate(lastInvoiceForSelectedSite.endDate)}
                                </strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                              <span>
                                Last Invoice Amount:{' '}
                                <strong className="text-slate-900 dark:text-white font-bold">
                                  {priv?.canViewAmounts === false
                                    ? '***'
                                    : `₦${lastInvoiceForSelectedSite.amount.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                        {lastInvoiceForSelectedSite.suggestedNextStartDate && (
                          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleChange('startDate', lastInvoiceForSelectedSite.suggestedNextStartDate)}
                              className="h-8 px-2.5 text-[11px] font-semibold bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 rounded-sm gap-1.5 transition-all"
                              title={`Set Start Date to ${formatDisplayDate(lastInvoiceForSelectedSite.suggestedNextStartDate)}`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Use Next Day ({formatDisplayDate(lastInvoiceForSelectedSite.suggestedNextStartDate)})</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Info className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>No previous invoice found for this site (First billing cycle).</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Document / Invoice Number</label>
                    <Input
                      type="text"
                      value={form.invoiceNo}
                      onChange={(e) => handleChange('invoiceNo', e.target.value)}
                      placeholder="e.g. 144"
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 font-mono font-bold h-11 text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Start Date</label>
                      {lastInvoiceForSelectedSite?.endDate && (
                        <span className="text-[10px] text-slate-400">
                          Prev Ended:{' '}
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {formatDisplayDate(lastInvoiceForSelectedSite.endDate)}
                          </span>
                        </span>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => handleChange('startDate', e.target.value)}
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-semibold text-slate-800 dark:text-white"
                    />
                    {lastInvoiceForSelectedSite?.suggestedNextStartDate && form.startDate !== lastInvoiceForSelectedSite.suggestedNextStartDate && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                        <span>Suggested next cycle:</span>
                        <button
                          type="button"
                          onClick={() => handleChange('startDate', lastInvoiceForSelectedSite.suggestedNextStartDate)}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Set to {formatDisplayDate(lastInvoiceForSelectedSite.suggestedNextStartDate)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <label className="flex items-start gap-3.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!form.countOffDays}
                      onChange={(e) => handleChange('countOffDays', e.target.checked)}
                      className="mt-0.5 h-4.5 w-4.5 rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 accent-blue-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-205 block">Count off-days as billed days</span>
                      <span className="text-[10px] text-slate-450 block">
                        Billed duration will accrue continuously without pausing on client holidays or non-working days.
                      </span>
                    </div>
                  </label>

                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">VAT Scope</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-sm border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleChange('vatScope', 'overall')}
                        className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                          form.vatScope !== 'per_section'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        Full Invoice (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('vatScope', 'per_section')}
                        className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                          form.vatScope === 'per_section'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        Per-Section (Itemized)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Equipment & Machinery */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-650 dark:text-blue-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Equipment &amp; Machinery Lease</h3>
                    <p className="text-[10px] text-slate-400">Lease pump quantities, config rates and durations.</p>
                  </div>
                </div>
                {form.vatScope === 'per_section' && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold select-none border ${
                      (form.vatableSections?.equipment ?? true)
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                    title="Configured in Settings > Invoice & Tax Variables"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${(form.vatableSections?.equipment ?? true) ? 'bg-blue-500' : 'bg-slate-400'}`} />
                    {(form.vatableSections?.equipment ?? true) ? `VAT Applied (${vatRate}%)` : 'Tax Exempt'}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Number of Dewatering Pumps</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.noOfMachine}
                      onChange={(e) => handleNoOfMachineChange(e.target.value)}
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
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Machine Configuration Matrix</p>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-sm font-bold font-mono tabular-nums">
                        {machineConfigs.length} Pumps Active
                      </span>
                    </div>

                    <div className="space-y-3">
                      {machineConfigs.map((row, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 xl:grid-cols-[100px_1fr_1fr_1fr] gap-4 items-center p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
                        >
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                            Pump #{idx + 1}
                          </span>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Daily Rental (₦)</span>
                              {idx > 0 && (
                                <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                                  <input
                                    type="checkbox"
                                    checked={row.sameRateAsFirst}
                                    onChange={(e) => handleMachineSameToggle(idx, 'rate', e.target.checked)}
                                    className="accent-blue-600 w-3 h-3 rounded-sm border-slate-300"
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
                              onValueChange={(v) => handleMachineRowChange(idx, 'rate', v.value || '')}
                              className={
                                idx > 0 && row.sameRateAsFirst
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-mono text-xs'
                                  : 'bg-white dark:bg-slate-900 h-10 font-mono text-xs text-slate-800 dark:text-white'
                              }
                              placeholder="0.00"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Lease Duration (Days)</span>
                              {idx > 0 && (
                                <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                                  <input
                                    type="checkbox"
                                    checked={row.sameDurationAsFirst}
                                    onChange={(e) => handleMachineSameToggle(idx, 'duration', e.target.checked)}
                                    className="accent-blue-600 w-3 h-3 rounded-sm border-slate-300"
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
                              onChange={(e) => handleMachineRowChange(idx, 'duration', e.target.value)}
                              className={
                                idx > 0 && row.sameDurationAsFirst
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 text-xs font-semibold'
                                  : 'bg-white dark:bg-slate-900 h-10 text-xs font-semibold text-slate-800 dark:text-white'
                              }
                              placeholder="0"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Daily Fuel Usage (L/day)</span>
                              {idx > 0 && (
                                <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                                  <input
                                    type="checkbox"
                                    checked={!!row.sameUsageAsFirst}
                                    onChange={(e) => handleMachineSameToggle(idx, 'dailyUsage', e.target.checked)}
                                    className="accent-blue-600 w-3 h-3 rounded-sm border-slate-300"
                                  />
                                  Link to #1
                                </label>
                              )}
                            </div>
                            <Input
                              type="number"
                              min="0"
                              value={row.dailyUsage ?? ''}
                              disabled={idx > 0 && !!row.sameUsageAsFirst}
                              onChange={(e) => handleMachineRowChange(idx, 'dailyUsage', e.target.value)}
                              className={
                                idx > 0 && !!row.sameUsageAsFirst
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 text-xs font-semibold'
                                  : 'bg-white dark:bg-slate-900 h-10 text-xs font-semibold text-slate-800 dark:text-white'
                              }
                              placeholder={form.dailyUsage || 'e.g. 150'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auxiliary Equipment & Non-Fuel Assets */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Auxiliary Equipment &amp; Non-Fuel Assets
                        </span>
                        {(form.auxiliaryEquipment?.length || 0) > 0 && (
                          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-sm font-bold font-mono tabular-nums">
                            {form.auxiliaryEquipment.length} {form.auxiliaryEquipment.length === 1 ? 'Asset' : 'Assets'}
                          </span>
                        )}
                        {form.vatScope === 'per_section' && (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold select-none border ${
                              (form.vatableSections?.equipment ?? true)
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                            }`}
                            title="Auxiliary assets are leased equipment and inherit the Equipment & Machinery Lease VAT rule"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${(form.vatableSections?.equipment ?? true) ? 'bg-blue-500' : 'bg-slate-400'}`} />
                            {(form.vatableSections?.equipment ?? true) ? `Lease VAT (${vatRate}%)` : 'Lease Tax Exempt'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Add duration &amp; rate items that don&apos;t consume diesel (e.g. sedimentation tanks, booster pumps). Follows Equipment Lease VAT.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAuxiliaryItem}
                      className="h-8 px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border-dashed border-blue-300 dark:border-blue-800 rounded-sm flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Auxiliary Asset
                    </Button>
                  </div>

                  {(!form.auxiliaryEquipment || form.auxiliaryEquipment.length === 0) ? (
                    <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center bg-slate-50/50 dark:bg-slate-900/30">
                      <p className="text-xs text-slate-400">No auxiliary assets attached to this invoice.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Click &ldquo;Add Auxiliary Asset&rdquo; to include tanks, hoses, or other non-fuel machinery.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.auxiliaryEquipment.map((item, idx) => {
                        const lineTotal = (parseFloat(String(item.quantity)) || 1) * (parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.duration)) || 0);
                        return (
                          <div
                            key={item.id || idx}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-3.5 space-y-3 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Auxiliary Item #{idx + 1}</span>
                                {lineTotal > 0 && (
                                  <span className="text-[11px] font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-sm">
                                    Total: ₦{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAuxiliaryItem(item.id)}
                                className="h-7 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs"
                                title="Remove this auxiliary asset"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Remove
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Asset / Item Name</label>
                                <Input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateAuxiliaryItem(item.id, { name: e.target.value })}
                                  placeholder="e.g. Sedimentation Tank"
                                  className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-10 text-xs font-semibold text-slate-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quantity</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateAuxiliaryItem(item.id, { quantity: parseFloat(e.target.value) || 1 })}
                                  placeholder="1"
                                  className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-10 text-xs font-semibold text-slate-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daily Rate (₦ / unit)</label>
                                <NumericFormat
                                  customInput={Input}
                                  thousandSeparator
                                  decimalScale={2}
                                  value={item.rate || ''}
                                  onValueChange={(v) => handleUpdateAuxiliaryItem(item.id, { rate: parseFloat(v.value || '0') || 0 })}
                                  placeholder="0.00"
                                  className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-10 font-mono text-xs text-slate-800 dark:text-white"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration (Days)</label>
                                  <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                                    <input
                                      type="checkbox"
                                      checked={!!item.sameDurationAsInvoice}
                                      onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        const invoiceDur = parseFloat(form.duration) || 0;
                                        handleUpdateAuxiliaryItem(item.id, {
                                          sameDurationAsInvoice: isChecked,
                                          duration: isChecked ? invoiceDur : item.duration,
                                        });
                                      }}
                                      className="accent-blue-600 w-3 h-3 rounded-sm"
                                    />
                                    Same as Invoice
                                  </label>
                                </div>
                                <Input
                                  type="number"
                                  min="0"
                                  disabled={!!item.sameDurationAsInvoice}
                                  value={item.duration}
                                  onChange={(e) => handleUpdateAuxiliaryItem(item.id, { duration: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  className={
                                    item.sameDurationAsInvoice
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed h-10 text-xs font-semibold'
                                      : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-10 text-xs font-semibold text-slate-800 dark:text-white'
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Note / Specification (Displayed on Invoice Details &amp; PDF)
                              </label>
                              <Input
                                type="text"
                                value={item.note || ''}
                                onChange={(e) => handleUpdateAuxiliaryItem(item.id, { note: e.target.value })}
                                placeholder="e.g. 30m³ baffle sedimentation tank installed on site"
                                className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-9 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Crew / Dewatering Staff */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-155 dark:border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Dewatering Crew &amp; Personnel</h3>
                    <p className="text-[10px] text-slate-400">Manage technician count, day/night shift rates, and durations.</p>
                  </div>
                </div>
                {form.vatScope === 'per_section' && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold select-none border ${
                      (form.vatableSections?.technicians ?? false)
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                    title="Configured in Settings > Invoice & Tax Variables"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${(form.vatableSections?.technicians ?? false) ? 'bg-amber-500' : 'bg-slate-400'}`} />
                    {(form.vatableSections?.technicians ?? false) ? `VAT Applied (${vatRate}%)` : 'Tax Exempt'}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Number of Technicians On Site</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.noOfTechnician}
                      onChange={(e) => handleChange('noOfTechnician', e.target.value)}
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
                          <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                            <input
                              type="checkbox"
                              checked={form.technicianDurationSameAsMachine}
                              onChange={(e) => handleChange('technicianDurationSameAsMachine', e.target.checked)}
                              className="accent-blue-600 w-3 h-3 rounded-sm"
                            />
                            Link to M-1
                          </label>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          value={
                            form.technicianDurationSameAsMachine
                              ? machineConfigs.length > 0
                                ? Math.max(...machineConfigs.map((r) => parseFloat(r.duration) || 0))
                                : ''
                              : form.technicianDuration
                          }
                          onChange={(e) => handleChange('technicianDuration', e.target.value)}
                          disabled={form.technicianDurationSameAsMachine}
                          className={
                            form.technicianDurationSameAsMachine
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold'
                              : 'bg-white dark:bg-slate-900 h-10 font-semibold text-slate-800 dark:text-white'
                          }
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
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Night Shift Technicians</label>
                          <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                            <input
                              type="checkbox"
                              checked={form.technicianNightCountSameAsDay}
                              onChange={(e) => handleChange('technicianNightCountSameAsDay', e.target.checked)}
                              className="accent-blue-600 w-3 h-3 rounded-sm"
                            />
                            Same as Day Shift
                          </label>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          value={form.technicianNightCountSameAsDay ? form.noOfTechnician || '' : form.noOfTechnicianNight}
                          onChange={(e) => handleChange('noOfTechnicianNight', e.target.value)}
                          disabled={form.technicianNightCountSameAsDay}
                          className={
                            form.technicianNightCountSameAsDay
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold'
                              : 'bg-white dark:bg-slate-900 h-10 font-bold text-slate-800 dark:text-white'
                          }
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
                          <label className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer select-none font-bold">
                            <input
                              type="checkbox"
                              checked={form.technicianNightDurationSameAsMachine}
                              onChange={(e) => handleChange('technicianNightDurationSameAsMachine', e.target.checked)}
                              className="accent-blue-600 w-3 h-3 rounded-sm"
                            />
                            Link to M-1
                          </label>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          value={
                            form.technicianNightDurationSameAsMachine
                              ? machineConfigs.length > 0
                                ? Math.max(...machineConfigs.map((r) => parseFloat(r.duration) || 0))
                                : ''
                              : form.technicianNightDuration
                          }
                          onChange={(e) => handleChange('technicianNightDuration', e.target.value)}
                          disabled={form.technicianNightDurationSameAsMachine}
                          className={
                            form.technicianNightDurationSameAsMachine
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed h-10 font-semibold'
                              : 'bg-white dark:bg-slate-900 h-10 font-semibold text-slate-800 dark:text-white'
                          }
                          placeholder="e.g. 8"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Accommodation (₦ / tech / day)</label>
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
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                              form.technicianAccommodationUseNightCount ? 'bg-slate-800 dark:bg-slate-200' : 'bg-amber-400'
                            }`}
                            title="Toggle accommodation crew basis"
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${
                                form.technicianAccommodationUseNightCount ? 'translate-x-4' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-md bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Effective Daily Rate per Crew Member
                    </span>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Sum of Day Rate + Night Rate + Accommodation Rate per technician per day.
                    </p>
                  </div>
                  <div className="h-10 px-4 rounded-sm bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 flex items-center justify-center font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300 text-sm shrink-0">
                    ₦{livePreview.effectiveTechDailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Fuel & Logistics Extra Costs */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-6">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title="Diesel Price (₦/L)">
                        Diesel (₦/L)
                      </label>
                      {form.vatScope === 'per_section' && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 border ${
                            (form.vatableSections?.diesel ?? true)
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 rounded-sm font-mono tabular-nums'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Tax status configured in Settings"
                        >
                          {(form.vatableSections?.diesel ?? true) ? `VAT ${vatRate}%` : 'Exempt'}
                        </span>
                      )}
                    </div>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      value={form.dieselCostPerLtr}
                      onValueChange={(v) => handleChange('dieselCostPerLtr', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white w-full"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-6">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title="Mob / Demob (₦)">
                        Mob / Demob (₦)
                      </label>
                      {form.vatScope === 'per_section' && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 border ${
                            (form.vatableSections?.mobDemob ?? true)
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 rounded-sm font-mono tabular-nums'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Tax status configured in Settings"
                        >
                          {(form.vatableSections?.mobDemob ?? true) ? `VAT ${vatRate}%` : 'Exempt'}
                        </span>
                      )}
                    </div>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      value={form.mobDemob}
                      onValueChange={(v) => handleChange('mobDemob', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white w-full"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-6">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title="Installation (₦)">
                        Installation (₦)
                      </label>
                      {form.vatScope === 'per_section' && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 border ${
                            (form.vatableSections?.installation ?? true)
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 rounded-sm font-mono tabular-nums'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Tax status configured in Settings"
                        >
                          {(form.vatableSections?.installation ?? true) ? `VAT ${vatRate}%` : 'Exempt'}
                        </span>
                      )}
                    </div>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      value={form.installation}
                      onValueChange={(v) => handleChange('installation', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white w-full"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-6">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title="Damages (₦)">
                        Damages (₦)
                      </label>
                      {form.vatScope === 'per_section' && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1 border ${
                            (form.vatableSections?.damages ?? false)
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 rounded-sm font-mono tabular-nums'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Tax status configured in Settings"
                        >
                          {(form.vatableSections?.damages ?? false) ? `VAT ${vatRate}%` : 'Exempt'}
                        </span>
                      )}
                    </div>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      value={form.damages}
                      onValueChange={(v) => handleChange('damages', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 h-11 font-mono font-semibold text-slate-800 dark:text-white w-full"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-6">
                      <label className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate" title="Discount (₦)">
                        Discount (₦)
                      </label>
                    </div>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      value={form.discount}
                      onValueChange={(v) => handleChange('discount', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 focus:border-emerald-500 h-11 font-mono font-semibold text-emerald-600 dark:text-emerald-400 w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Reminders & Alerts */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                      onChange={(e) => handleChange('createReminder', e.target.checked)}
                      className="mt-1 h-5 w-5 rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 accent-blue-600"
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
                        onChange={(e) => handleChange('sendEmailNotification', e.target.checked)}
                        className="h-4.5 w-4.5 rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <span className="text-xs font-semibold text-slate-655 dark:text-slate-300 flex items-center gap-2">
                        <Mail className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        Send email notification copy along with the dashboard reminder
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Form Footer Action Bar */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-md flex gap-4">
              <Button
                variant="outline"
                className="flex-1 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 h-12 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold"
                onClick={handleRequestCloseModal}
              >
                Leave / Close
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white gap-2 h-12 rounded-sm font-bold text-sm"
              >
                <CheckCircle className="w-5 h-5" /> {selectedId ? 'Update & Save Changes' : 'Publish Document'}
              </Button>
            </div>
          </div>

          {/* Live Calculation Sidebar */}
          <div className="flex flex-col gap-4 sticky top-4">
            <div className="bg-slate-900 dark:bg-slate-950 rounded-md p-5 border border-slate-800">
              <div className="flex justify-between items-center mb-5">
                <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Live Auto-Calc</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold tracking-wider rounded-sm px-2.5 py-0.5 border-slate-700 ${
                    livePreview.vatInc === 'Yes'
                      ? 'text-blue-400 bg-blue-950/50 border-blue-900'
                      : livePreview.vatInc === 'Add'
                      ? 'text-amber-400 bg-amber-950/50 border-amber-900'
                      : 'text-slate-450 bg-slate-800 border-slate-700'
                  }`}
                >
                  VAT: {livePreview.vatInc}
                </Badge>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">
                    {livePreview.discount > 0 ? 'Gross Subtotal' : 'Gross Total'}
                  </span>
                  <span className="font-mono text-slate-200 font-bold text-xl">
                    ₦{priv?.canViewAmounts === false ? '***' : livePreview.subtotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {livePreview.vatScope === 'per_section' ? (
                  <>
                    <div className="h-px bg-slate-800" />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Vatable Base</span>
                        <span className="font-mono tabular-nums text-blue-300 font-bold text-base">
                          ₦{priv?.canViewAmounts === false ? '***' : (livePreview.vatableAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider">Non-Vatable Base</span>
                        <span className="font-mono text-slate-400 font-bold text-base">
                          ₦{priv?.canViewAmounts === false ? '***' : (livePreview.nonVatableAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Accumulated Section VAT Breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Accumulated Section VAT</span>
                        {livePreview.equipmentVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Machine Lease VAT:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              ₦{livePreview.equipmentVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.dieselVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Diesel Fuel VAT:</span>
                            <span className="font-mono font-bold text-orange-400">
                              ₦{livePreview.dieselVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.techniciansVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Crew Personnel VAT:</span>
                            <span className="font-mono font-bold text-amber-400">
                              ₦{livePreview.techniciansVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.mobDemobVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Mob / Demob VAT:</span>
                            <span className="font-mono tabular-nums font-bold text-blue-300">
                              ₦{livePreview.mobDemobVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.installationVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Installation VAT:</span>
                            <span className="font-mono tabular-nums font-bold text-blue-300">
                              ₦{livePreview.installationVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.damagesVat > 0 && (
                          <div className="flex justify-between text-xs text-slate-350">
                            <span>• Damages VAT:</span>
                            <span className="font-mono font-bold text-rose-400">
                              ₦{livePreview.damagesVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {livePreview.vat === 0 && (
                          <div className="text-xs text-slate-500 italic">No vatable sections active</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  livePreview.discount > 0 && (
                    <>
                      <div className="h-px bg-slate-800" />
                      <div className="flex flex-col">
                        <span className="text-emerald-400 text-[10px] uppercase font-black tracking-wider mb-1">Discount Subtraction</span>
                        <span className="font-mono text-emerald-400 font-bold text-lg">
                          -₦{priv?.canViewAmounts === false ? '***' : livePreview.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="h-px bg-slate-800" />
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider mb-1">Net Subtotal (Vatable)</span>
                        <span className="font-mono text-slate-100 font-bold text-lg">
                          ₦{priv?.canViewAmounts === false ? '***' : livePreview.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )
                )}

                <div className="h-px bg-slate-800" />
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-black tracking-wider mb-1">
                    Tax (VAT {livePreview.vatInc}{livePreview.vatScope === 'per_section' ? ' • Itemized' : ''})
                  </span>
                  <span className="font-mono tabular-nums text-blue-400 font-bold text-lg">
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
            {parseFloat(form.noOfTechnician) > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Crew Cost Formula</p>
                  {livePreview.vatScope === 'per_section' && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        (livePreview.vatableSections?.technicians ?? false)
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {(livePreview.vatableSections?.technicians ?? false) ? `VAT: ${vatRate}%` : 'Exempt'}
                    </span>
                  )}
                </div>
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                    <span className="flex flex-col">
                      <span className="font-bold text-slate-705 dark:text-slate-350">Day Shift Cost</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {parseFloat(form.noOfTechnician) || 0} tech{parseFloat(form.noOfTechnician) !== 1 ? 's' : ''} × ₦
                        {(parseFloat(form.techniciansDailyRate) || 0).toLocaleString()}/d × {livePreview.actualTechDuration}d
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                      ₦
                      {(
                        (parseFloat(form.noOfTechnician) || 0) *
                        (parseFloat(form.techniciansDailyRate) || 0) *
                        livePreview.actualTechDuration
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {parseFloat(form.technicianNightFee) > 0 && (
                    <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                      <span className="flex flex-col">
                        <span className="font-bold text-slate-705 dark:text-slate-350">Night Shift Cost</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {livePreview.noOfTechnicianNight} tech{livePreview.noOfTechnicianNight !== 1 ? 's' : ''} × ₦
                          {(parseFloat(form.technicianNightFee) || 0).toLocaleString()}/n × {livePreview.actualNightDuration}n
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-855 dark:text-slate-205 shrink-0">
                        ₦
                        {(
                          (livePreview.noOfTechnicianNight || 0) *
                          (parseFloat(form.technicianNightFee) || 0) *
                          livePreview.actualNightDuration
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {parseFloat(form.technicianAccommodation) > 0 && (
                    <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-850 gap-2">
                      <span className="flex flex-col">
                        <span className="font-bold text-slate-705 dark:text-slate-350">Crew Accommodation</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {livePreview.accomCrewCount} tech{livePreview.accomCrewCount !== 1 ? 's' : ''}
                          {!form.technicianNightCountSameAsDay
                            ? form.technicianAccommodationUseNightCount
                              ? ' (night basis)'
                              : ' (day basis)'
                            : ''}{' '}
                          × ₦{(parseFloat(form.technicianAccommodation) || 0).toLocaleString()}/d × {livePreview.actualTechDuration}d
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-855 dark:text-slate-205 shrink-0">
                        ₦
                        {(
                          (livePreview.accomCrewCount || 0) *
                          (parseFloat(form.technicianAccommodation) || 0) *
                          livePreview.actualTechDuration
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                  <div className="flex justify-between font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-sm border border-blue-100 dark:border-blue-900">
                    <span>Total Crew Cost</span>
                    <span className="font-mono">
                      ₦{livePreview.techniciansCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {livePreview.vatScope === 'per_section' && (
                    <div className="flex justify-between items-center text-[11px] px-1 text-slate-500 dark:text-slate-400">
                      <span>Crew Section VAT ({livePreview.vatInc}):</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {(livePreview.vatableSections?.technicians ?? false) && livePreview.vatInc !== 'No'
                          ? `+₦${livePreview.techniciansVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '₦0.00 (Exempt)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Diesel Calculation breakdown card */}
            {livePreview.dieselCost > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Diesel Calculation</p>
                  {livePreview.vatScope === 'per_section' && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        (livePreview.vatableSections?.diesel ?? true)
                          ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {(livePreview.vatableSections?.diesel ?? true) ? `VAT: ${vatRate}%` : 'Exempt'}
                    </span>
                  )}
                </div>
                <div className="space-y-3.5 text-xs">
                  {machineConfigs.length > 0 ? (
                    machineConfigs.map((row, idx) => {
                      const rowUsage =
                        row.dailyUsage !== undefined && row.dailyUsage !== ''
                          ? parseFloat(row.dailyUsage) || 0
                          : parseFloat(form.dailyUsage) || 0;
                      return (
                        parseFloat(row.duration) > 0 && (
                          <div key={idx} className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                            <span className="flex flex-col">
                              <span className="font-bold text-slate-705 dark:text-slate-350">Machine {idx + 1} Diesel</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {rowUsage}L/d × ₦{(parseFloat(form.dieselCostPerLtr) || 0).toLocaleString()}/L × {parseFloat(row.duration) || 0}d
                              </span>
                            </span>
                            <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                              ₦
                              {(
                                rowUsage *
                                (parseFloat(form.dieselCostPerLtr) || 0) *
                                (parseFloat(row.duration) || 0)
                              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )
                      );
                    })
                  ) : (
                    <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                      <span className="flex flex-col">
                        <span className="font-bold text-slate-705 dark:text-slate-350">Diesel Cost</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {parseInt(form.noOfMachine) || 0} machine{parseInt(form.noOfMachine) !== 1 ? 's' : ''} × {parseFloat(form.dailyUsage) || 0}L/d × ₦
                          {(parseFloat(form.dieselCostPerLtr) || 0).toLocaleString()}/L × {livePreview.maxDuration}d
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

                  {livePreview.vatScope === 'per_section' && (
                    <div className="flex justify-between items-center text-[11px] px-1 text-slate-500 dark:text-slate-400">
                      <span>Diesel Section VAT ({livePreview.vatInc}):</span>
                      <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                        {(livePreview.vatableSections?.diesel ?? true) && livePreview.vatInc !== 'No'
                          ? `+₦${livePreview.dieselVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '₦0.00 (Exempt)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Machine Rental breakdown card */}
            {livePreview.rentalCost > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Machine Calculation</p>
                  {livePreview.vatScope === 'per_section' && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        (livePreview.vatableSections?.equipment ?? true)
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {(livePreview.vatableSections?.equipment ?? true) ? `VAT: ${vatRate}%` : 'Exempt'}
                    </span>
                  )}
                </div>
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

                  {livePreview.vatScope === 'per_section' && (
                    <div className="flex justify-between items-center text-[11px] px-1 text-slate-500 dark:text-slate-400">
                      <span>Machine Section VAT ({livePreview.vatInc}):</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {(livePreview.vatableSections?.equipment ?? true) && livePreview.vatInc !== 'No'
                          ? `+₦${livePreview.equipmentVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '₦0.00 (Exempt)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Auxiliary Assets breakdown card */}
            {livePreview.auxiliaryCost > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Auxiliary Equipment Lease</p>
                  {livePreview.vatScope === 'per_section' && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-sm font-bold ${
                        (livePreview.vatableSections?.equipment ?? true)
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {(livePreview.vatableSections?.equipment ?? true) ? `VAT: ${vatRate}%` : 'Exempt'}
                    </span>
                  )}
                </div>
                <div className="space-y-3.5 text-xs">
                  {livePreview.auxiliaryEquipment.map((item, idx) => {
                    const q = parseFloat(String(item.quantity)) || 1;
                    const r = parseFloat(String(item.rate)) || 0;
                    const d = parseFloat(String(item.duration)) || 0;
                    const total = q * r * d;
                    if (total <= 0 && !item.name) return null;
                    return (
                      <div key={item.id || idx} className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                        <span className="flex flex-col">
                          <span className="font-bold text-slate-705 dark:text-slate-350">{item.name || `Auxiliary #${idx + 1}`}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {q > 1 ? `${q} units × ` : ''}₦{r.toLocaleString()}/d × {d}d
                          </span>
                          {item.note && <span className="text-[9px] text-slate-450 italic mt-0.5">{item.note}</span>}
                        </span>
                        <span className="font-mono font-bold text-slate-850 dark:text-slate-205 shrink-0">
                          ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                  <div className="flex justify-between font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-sm border border-blue-100 dark:border-blue-900">
                    <span>Total Auxiliary Cost</span>
                    <span className="font-mono">₦{livePreview.auxiliaryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Other Charges breakdown card */}
            {(livePreview.mobDemob > 0 || livePreview.installation > 0 || livePreview.damages > 0) && (
              <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Other Charges</p>
                  {livePreview.vatScope === 'per_section' && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        livePreview.otherChargesVat > 0
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {livePreview.otherChargesVat > 0 ? `VAT Active` : 'Exempt'}
                    </span>
                  )}
                </div>
                <div className="space-y-3.5 text-xs">
                  {livePreview.mobDemob > 0 && (
                    <div className="flex justify-between items-start text-slate-655 dark:text-slate-400 gap-2">
                      <span className="flex flex-col">
                        <span className="font-bold text-slate-705 dark:text-slate-350 flex items-center gap-1.5">
                          Mob / Demob
                          {livePreview.vatScope === 'per_section' && (
                            <span
                              className={`text-[9px] px-1 rounded-sm font-semibold ${
                                (livePreview.vatableSections?.mobDemob ?? true)
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                                  : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                              }`}
                            >
                              {(livePreview.vatableSections?.mobDemob ?? true) ? 'VAT' : 'Exempt'}
                            </span>
                          )}
                        </span>
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
                        <span className="font-bold text-slate-705 dark:text-slate-350 flex items-center gap-1.5">
                          Installation
                          {livePreview.vatScope === 'per_section' && (
                            <span
                              className={`text-[9px] px-1 rounded-sm font-semibold ${
                                (livePreview.vatableSections?.installation ?? true)
                                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                                  : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                              }`}
                            >
                              {(livePreview.vatableSections?.installation ?? true) ? 'VAT' : 'Exempt'}
                            </span>
                          )}
                        </span>
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
                        <span className="font-bold text-slate-705 dark:text-slate-350 flex items-center gap-1.5">
                          Damages
                          {livePreview.vatScope === 'per_section' && (
                            <span
                              className={`text-[9px] px-1 rounded-sm font-semibold ${
                                (livePreview.vatableSections?.damages ?? false)
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                            }`}
                            >
                              {(livePreview.vatableSections?.damages ?? false) ? 'VAT' : 'Exempt'}
                            </span>
                          )}
                        </span>
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
                    <span className="font-mono">
                      ₦{(livePreview.mobDemob + livePreview.installation + livePreview.damages).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {livePreview.vatScope === 'per_section' && (
                    <div className="flex justify-between items-center text-[11px] px-1 text-slate-500 dark:text-slate-400">
                      <span>Other Charges VAT ({livePreview.vatInc}):</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {livePreview.otherChargesVat > 0 && livePreview.vatInc !== 'No'
                          ? `+₦${livePreview.otherChargesVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '₦0.00 (Exempt)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
