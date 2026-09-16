import React, { useState, useMemo } from 'react';
import { useAppStore, Invoice, PendingInvoice, Payment } from '@/src/store/appStore';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { RotateCcw, Copy, Check, FileSpreadsheet, Search, X, ArrowRight, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import {
  VatCalculatorParams,
  VatMode,
  VatScope,
  PartPaymentMethod,
  VatableSectionFlags,
  computeInvoiceVat,
  computePartPaymentVat,
} from '@/src/utils/vatCalculator';

const DEFAULT_PARAMS: VatCalculatorParams = {
  clientName: '',
  siteName: '',
  invoiceNumber: '',
  vatMode: 'Add',
  vatRate: 7.5,
  vatScope: 'per_section',
  vatableSections: {
    equipment: true,
    technicians: false,
    diesel: true,
    mobDemob: true,
    installation: true,
    damages: false,
  },
  applyWht: false,
  whtRate: 5,
  useDetailedBreakdown: true,
  manualGrossAmount: 0,
  noOfMachine: 0,
  dailyRentalCost: 0,
  equipmentDuration: 0,
  equipmentRental: 0,
  noOfTechnician: 0,
  technicianDailyRate: 0,
  technicianDuration: 0,
  techniciansCost: 0,
  dailyDieselUsage: 0,
  dieselCostPerLtr: 0,
  dieselDuration: 0,
  dieselCost: 0,
  auxiliaryCost: 0,
  mobDemob: 0,
  installation: 0,
  damages: 0,
  discount: 0,
  paymentAmount: 0,
  paymentMethod: 'prorated',
  paymentDamages: 0,
  paymentWhtDeducted: 0,
};

export default function VatCalculator() {
  const invoices = useAppStore((s) => s.invoices);
  const pendingInvoices = useAppStore((s) => s.pendingInvoices);
  const payments = useAppStore((s) => s.payments);
  const payrollVatRate = useAppStore((s) => s.payrollVariables?.vatRate ?? 7.5);

  const [params, setParams] = useState<VatCalculatorParams>(() => ({
    ...DEFAULT_PARAMS,
    vatRate: payrollVatRate,
  }));
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAdditionalSettings, setShowAdditionalSettings] = useState(false);

  const set = <K extends keyof VatCalculatorParams>(k: K, v: VatCalculatorParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const setSection = (k: keyof VatableSectionFlags, v: boolean) =>
    setParams((p) => ({ ...p, vatableSections: { ...p.vatableSections, [k]: v } }));

  // Equipment duration helpers
  const handleEquipmentChange = (field: 'noOfMachine' | 'dailyRentalCost' | 'equipmentDuration', val: number) => {
    setParams((p) => {
      const next = { ...p, [field]: val };
      next.equipmentRental = next.noOfMachine * next.dailyRentalCost * next.equipmentDuration;
      return next;
    });
  };

  // Technician duration helpers
  const handleTechnicianChange = (field: 'noOfTechnician' | 'technicianDailyRate' | 'technicianDuration', val: number) => {
    setParams((p) => {
      const next = { ...p, [field]: val };
      next.techniciansCost = next.noOfTechnician * next.technicianDailyRate * next.technicianDuration;
      return next;
    });
  };

  // Diesel helpers
  const handleDieselChange = (field: 'dailyDieselUsage' | 'dieselCostPerLtr' | 'dieselDuration', val: number) => {
    setParams((p) => {
      const next = { ...p, [field]: val };
      if (next.dailyDieselUsage > 0 && next.dieselCostPerLtr > 0 && next.dieselDuration > 0) {
        next.dieselCost = next.dailyDieselUsage * next.dieselCostPerLtr * next.dieselDuration;
      }
      return next;
    });
  };

  const inv = useMemo(() => computeInvoiceVat(params), [params]);
  const pmt = useMemo(
    () => computePartPaymentVat(inv, params.paymentAmount, params.paymentMethod, params.paymentDamages),
    [inv, params.paymentAmount, params.paymentMethod, params.paymentDamages]
  );

  type ImportRecordType = 'all' | 'invoice' | 'payment';
  const [recordTypeFilter, setRecordTypeFilter] = useState<ImportRecordType>('all');

  interface ImportRecordItem {
    id: string;
    type: 'invoice' | 'quotation' | 'payment';
    recordNumber: string;
    client: string;
    site: string;
    amount: number;
    date: string;
    invoiceNumber?: string;
    raw: Invoice | PendingInvoice | any;
  }

  const allRecords = useMemo<ImportRecordItem[]>(() => {
    const list: ImportRecordItem[] = [];

    // Invoices
    invoices.forEach((r) => {
      list.push({
        id: `inv-${r.id}`,
        type: 'invoice',
        recordNumber: r.invoiceNumber || '—',
        client: r.client || '—',
        site: r.siteName || r.project || '—',
        amount: r.totalCharge ?? r.amount ?? 0,
        date: r.date || '',
        invoiceNumber: r.invoiceNumber,
        raw: r,
      });
    });

    // Quotations / Pending Invoices
    pendingInvoices.forEach((r) => {
      list.push({
        id: `q-${r.id}`,
        type: 'quotation',
        recordNumber: r.invoiceNo || '—',
        client: r.client || '—',
        site: r.site || '—',
        amount: r.totalCharge ?? r.totalCost ?? 0,
        date: r.startDate || '',
        invoiceNumber: r.invoiceNo,
        raw: r,
      });
    });

    // Payments
    payments.forEach((p) => {
      const pRef = p.reference ? `Ref: ${p.reference}` : (p.invoiceNumber ? `Pmt (${p.invoiceNumber})` : `Pmt #${p.id.slice(-4)}`);
      list.push({
        id: `pmt-${p.id}`,
        type: 'payment',
        recordNumber: pRef,
        client: p.client || '—',
        site: p.site || '—',
        amount: p.amount || 0,
        date: p.date || '',
        invoiceNumber: p.invoiceNumber,
        raw: p,
      });
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [invoices, pendingInvoices, payments]);

  const filtered = useMemo(() => {
    return allRecords.filter((r) => {
      if (recordTypeFilter === 'invoice' && r.type === 'payment') return false;
      if (recordTypeFilter === 'payment' && r.type !== 'payment') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.recordNumber.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q) ||
        r.site.toLowerCase().includes(q) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(q))
      );
    });
  }, [allRecords, recordTypeFilter, searchQuery]);

  const handleImport = (item: ImportRecordItem) => {
    if (item.type === 'payment') {
      const p = item.raw;
      const matchingInvoice = p.invoiceNumber
        ? invoices.find((inv) => inv.invoiceNumber?.toLowerCase() === p.invoiceNumber?.toLowerCase()) ||
        pendingInvoices.find((q) => q.invoiceNo?.toLowerCase() === p.invoiceNumber?.toLowerCase())
        : (p.invoiceId ? invoices.find((inv) => inv.id === p.invoiceId) : null);

      if (matchingInvoice) {
        const r = matchingInvoice as any;
        const eqCount = Number(r.noOfMachine) || 1;
        const eqDays = Number(r.duration) || 1;
        const eqRate = Number(r.dailyRentalCost) || (r.rentalCost ? Math.round(r.rentalCost / (eqCount * eqDays)) : 0);
        const eqTotal = Number(r.rentalCost) || (eqCount * eqRate * eqDays);

        const techCount = Number(r.noOfTechnician) || 1;
        const techDays = Number(r.technicianDuration) || Number(r.duration) || 1;
        const techRate = Number(r.techniciansDailyRate) || (r.techniciansCost ? Math.round(r.techniciansCost / (techCount * techDays)) : 0);
        const techTotal = Number(r.techniciansCost) || (techCount * techRate * techDays);

        const dieselLtr = Number(r.dailyUsage) || 0;
        const dieselLtrCost = Number(r.dieselCostPerLtr) || 0;
        const dieselTotal = Number(r.dieselCost) || (dieselLtr * dieselLtrCost * eqDays);

        setParams((prev) => ({
          ...prev,
          clientName: matchingInvoice.client || p.client,
          siteName: (matchingInvoice as any).siteName || (matchingInvoice as any).site || p.site,
          invoiceNumber: (matchingInvoice as any).invoiceNumber || (matchingInvoice as any).invoiceNo || p.invoiceNumber || '',
          vatMode: 'Add',
          vatScope: (matchingInvoice.vatScope || 'per_section') as VatScope,
          vatableSections: {
            equipment: matchingInvoice.vatableSections?.equipment ?? true,
            technicians: matchingInvoice.vatableSections?.technicians ?? false,
            diesel: matchingInvoice.vatableSections?.diesel ?? true,
            mobDemob: matchingInvoice.vatableSections?.mobDemob ?? true,
            installation: matchingInvoice.vatableSections?.installation ?? true,
            damages: matchingInvoice.vatableSections?.damages ?? false,
          },
          useDetailedBreakdown: true,
          noOfMachine: eqCount,
          dailyRentalCost: eqRate,
          equipmentDuration: eqDays,
          equipmentRental: eqTotal,
          noOfTechnician: techCount,
          technicianDailyRate: techRate,
          technicianDuration: techDays,
          techniciansCost: techTotal,
          dailyDieselUsage: dieselLtr,
          dieselCostPerLtr: dieselLtrCost,
          dieselDuration: eqDays,
          dieselCost: dieselTotal,
          auxiliaryCost: Number(r.auxiliaryCost) || 0,
          mobDemob: Number(r.mobDemob) || 0,
          installation: Number(r.installation) || 0,
          damages: Number(r.damages) || 0,
          discount: Number(r.discount) || 0,
          paymentAmount: p.amount || 0,
          paymentDamages: p.damages || 0,
          paymentWhtDeducted: p.withholdingTax || 0,
          paymentMethod: 'prorated',
        }));
        toast.success(`Loaded Payment ₦${(p.amount || 0).toLocaleString()} linked to #${(matchingInvoice as any).invoiceNumber || (matchingInvoice as any).invoiceNo}`);
      } else {
        setParams((prev) => ({
          ...prev,
          clientName: p.client || '',
          siteName: p.site || '',
          invoiceNumber: p.invoiceNumber || (p.reference ? `Ref: ${p.reference}` : ''),
          vatMode: 'Add',
          useDetailedBreakdown: false,
          manualGrossAmount: p.amountForVat || p.amount || 0,
          paymentAmount: p.amount || 0,
          paymentDamages: p.damages || 0,
          paymentWhtDeducted: p.withholdingTax || 0,
          paymentMethod: 'prorated',
        }));
        toast.success(`Loaded Payment of ₦${(p.amount || 0).toLocaleString()}`);
      }
      setIsImportOpen(false);
      return;
    }

    // Invoice or Quotation import
    const r = item.raw as any;
    const eqCount = Number(r.noOfMachine) || 1;
    const eqDays = Number(r.duration) || 1;
    const eqRate = Number(r.dailyRentalCost) || (r.rentalCost ? Math.round(r.rentalCost / (eqCount * eqDays)) : 0);
    const eqTotal = Number(r.rentalCost) || (eqCount * eqRate * eqDays);

    const techCount = Number(r.noOfTechnician) || 1;
    const techDays = Number(r.technicianDuration) || Number(r.duration) || 1;
    const techRate = Number(r.techniciansDailyRate) || (r.techniciansCost ? Math.round(r.techniciansCost / (techCount * techDays)) : 0);
    const techTotal = Number(r.techniciansCost) || (techCount * techRate * techDays);

    const dieselLtr = Number(r.dailyUsage) || 0;
    const dieselLtrCost = Number(r.dieselCostPerLtr) || 0;
    const dieselTotal = Number(r.dieselCost) || (dieselLtr * dieselLtrCost * eqDays);

    // Look for any existing payment records for this invoice
    const relatedPayments = payments.filter((pm) =>
      (pm.invoiceNumber && pm.invoiceNumber.toLowerCase() === (item.recordNumber || '').toLowerCase()) ||
      (pm.invoiceId && pm.invoiceId === r.id)
    );
    const totalPaid = relatedPayments.reduce((sum, pm) => sum + (pm.amount || 0), 0);
    const totalDamages = relatedPayments.reduce((sum, pm) => sum + (pm.damages || 0), 0);
    const totalWht = relatedPayments.reduce((sum, pm) => sum + (pm.withholdingTax || 0), 0);

    const defaultPaymentAmt = totalPaid > 0
      ? totalPaid
      : Math.round((r.totalCharge ?? r.totalCost ?? r.amount ?? 0) * 0.5);

    setParams((p) => ({
      ...p,
      clientName: item.client,
      siteName: item.site,
      invoiceNumber: item.recordNumber,
      vatMode: 'Add',
      vatScope: (r.vatScope || 'per_section') as VatScope,
      vatableSections: {
        equipment: r.vatableSections?.equipment ?? true,
        technicians: r.vatableSections?.technicians ?? false,
        diesel: r.vatableSections?.diesel ?? true,
        mobDemob: r.vatableSections?.mobDemob ?? true,
        installation: r.vatableSections?.installation ?? true,
        damages: r.vatableSections?.damages ?? false,
      },
      useDetailedBreakdown: true,
      noOfMachine: eqCount,
      dailyRentalCost: eqRate,
      equipmentDuration: eqDays,
      equipmentRental: eqTotal,
      noOfTechnician: techCount,
      technicianDailyRate: techRate,
      technicianDuration: techDays,
      techniciansCost: techTotal,
      dailyDieselUsage: dieselLtr,
      dieselCostPerLtr: dieselLtrCost,
      dieselDuration: eqDays,
      dieselCost: dieselTotal,
      auxiliaryCost: Number(r.auxiliaryCost) || 0,
      mobDemob: Number(r.mobDemob) || 0,
      installation: Number(r.installation) || 0,
      damages: Number(r.damages) || 0,
      discount: Number(r.discount) || 0,
      paymentAmount: defaultPaymentAmt,
      paymentDamages: totalDamages,
      paymentWhtDeducted: totalWht,
      paymentMethod: 'prorated',
    }));
    setIsImportOpen(false);
    if (totalPaid > 0) {
      toast.success(`Loaded ${item.recordNumber} (₦${totalPaid.toLocaleString()} paid across ${relatedPayments.length} payment(s))`);
    } else {
      toast.success(`Loaded ${item.recordNumber}`);
    }
  };

  const handleCopy = () => {
    const lines = [
      `VAT Calculator — ${params.invoiceNumber || 'Manual Sandbox'} ${params.clientName ? `| ${params.clientName}` : ''}`,
      `Equipment: ${params.noOfMachine} machine(s) × ₦${params.dailyRentalCost.toLocaleString()} × ${params.equipmentDuration} day(s) = ₦${(params.noOfMachine * params.dailyRentalCost * params.equipmentDuration).toLocaleString()}`,
      `Technicians: ${params.noOfTechnician} tech(s) × ₦${params.technicianDailyRate.toLocaleString()} × ${params.technicianDuration} day(s) = ₦${(params.noOfTechnician * params.technicianDailyRate * params.technicianDuration).toLocaleString()}`,
      `Subtotal Cost: ₦${inv.subtotalCost.toLocaleString()}`,
      `Vatable Base: ₦${inv.netVatableAmount.toLocaleString()}`,
      `VAT (${params.vatRate}% - ${params.vatMode}): ₦${inv.vat.toLocaleString()}`,
      `Total Charge: ₦${inv.totalCharge.toLocaleString()}`,
      `--- Part-Payment ---`,
      `Amount Paid: ₦${pmt.paymentAmount.toLocaleString()} (${pmt.paymentPercentageOfInvoice}%) [${params.paymentMethod}]`,
      `VAT to Remit: ₦${pmt.paymentVat.toLocaleString()}`,
      `Balance Remaining: ₦${pmt.remainingInvoiceBalance.toLocaleString()}`,
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const MODES: { id: VatMode; label: string }[] = [
    { id: 'Add', label: '+Add' },
    { id: 'Yes', label: 'Incl.' },
    { id: 'No', label: 'Exempt' },
  ];

  const METHODS: { id: PartPaymentMethod; label: string }[] = [
    { id: 'prorated', label: 'Pro-rated' },
    { id: 'vat_first', label: 'VAT First' },
    { id: 'principal_first', label: 'Principal First' },
  ];

  const SECTIONS: { key: keyof VatableSectionFlags; label: string }[] = [
    { key: 'equipment', label: 'Equipment' },
    { key: 'technicians', label: 'Technicians' },
    { key: 'diesel', label: 'Diesel' },
    { key: 'mobDemob', label: 'Mob/Demob' },
    { key: 'installation', label: 'Installation' },
    { key: 'damages', label: 'Damages' },
  ];

  // Derived subtotals for clean inline display
  const eqSubtotal = params.noOfMachine * params.dailyRentalCost * params.equipmentDuration;
  const techSubtotal = params.noOfTechnician * params.technicianDailyRate * params.technicianDuration;
  const dieselSubtotal = params.dailyDieselUsage > 0 && params.dieselCostPerLtr > 0 && params.dieselDuration > 0
    ? params.dailyDieselUsage * params.dieselCostPerLtr * params.dieselDuration
    : params.dieselCost;

  // Header controls embedded directly into the Page Header (TitleBar)
  const headerButtons = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
      {/* VAT Mode: only +Add shows up in the header */}
      <button
        type="button"
        onClick={() => set('vatMode', 'Add')}
        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs"
        title="VAT Added to Subtotal"
      >
        +Add
      </button>

      {/* VAT Rate */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 font-medium">Rate</span>
        <Input
          type="number"
          value={params.vatRate}
          onChange={(e) => set('vatRate', parseFloat(e.target.value) || 0)}
          className="w-14 h-7 text-xs font-mono text-right px-1.5 bg-white dark:bg-slate-900"
        />
        <span className="text-xs text-slate-400">%</span>
      </div>

      {/* Scope: only Itemized shows up in the header */}
      <button
        type="button"
        onClick={() => set('vatScope', 'per_section')}
        className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs"
        title="Itemized Section Calculation"
      >
        Itemized
      </button>

      {/* WHT toggle */}
      <label className="flex items-center gap-1 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={params.applyWht}
          onChange={(e) => set('applyWht', e.target.checked)}
          className="rounded h-3.5 w-3.5 text-blue-600"
        />
        <span>WHT</span>
      </label>

      {/* Loaded Invoice Tag */}
      {params.invoiceNumber && (
        <Badge variant="outline" className="text-[11px] font-mono border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center gap-1 py-0.5">
          {params.invoiceNumber}
          <button onClick={() => set('invoiceNumber', '')} className="text-slate-400 hover:text-rose-500 ml-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      {/* Load Record Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsImportOpen(true)}
        className="h-7 text-xs gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Load Record</span>
      </Button>

      {/* Copy Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        title="Copy summary"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>

      {/* Reset Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setParams({ ...DEFAULT_PARAMS, vatRate: payrollVatRate })}
        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        title="Reset"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>
    </div>
  ), [params, payrollVatRate, copied]);

  // Set the top page title and header controls directly
  useSetPageTitle('VAT Calculator', '', headerButtons, [headerButtons]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm">

      {/* ─── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Charge', value: inv.totalCharge, color: 'text-slate-900 dark:text-white' },
            { label: 'Vatable Base', value: inv.netVatableAmount, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Invoice VAT', value: inv.vat, color: 'text-blue-700 dark:text-blue-300' },
            { label: 'Part-Pmt VAT', value: pmt.paymentVat, color: 'text-emerald-600 dark:text-emerald-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xs">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 font-medium">{kpi.label}</div>
              <div className={cn('font-mono font-bold text-base', kpi.color)}>₦{fmt(kpi.value)}</div>
            </div>
          ))}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* LEFT: Invoice Variables (Minimalist & Uncluttered) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                  Invoice Variables
                </div>
                {params.useDetailedBreakdown && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Subtotal: ₦{fmt(inv.subtotalCost)}
                  </span>
                )}
              </div>

              {!params.useDetailedBreakdown ? (
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Single Gross Amount (₦)</label>
                  <Input
                    type="number"
                    value={params.manualGrossAmount}
                    onChange={(e) => set('manualGrossAmount', parseFloat(e.target.value) || 0)}
                    className="font-mono text-right"
                  />
                </div>
              ) : (
                <div className="space-y-4">

                  {/* 1. Equipment Rental (Units x Rate x Duration) */}
                  <div className="p-3 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Equipment Rental</span>
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        ₦{fmt(eqSubtotal)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Machines</label>
                        <Input
                          type="number"
                          min="1"
                          value={params.noOfMachine}
                          onChange={(e) => handleEquipmentChange('noOfMachine', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Daily Rate (₦)</label>
                        <Input
                          type="number"
                          value={params.dailyRentalCost}
                          onChange={(e) => handleEquipmentChange('dailyRentalCost', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Duration (Days)</label>
                        <Input
                          type="number"
                          min="1"
                          value={params.equipmentDuration}
                          onChange={(e) => handleEquipmentChange('equipmentDuration', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Technicians Crew (Qty x Rate x Duration) */}
                  <div className="p-3 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Technicians Crew</span>
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        ₦{fmt(techSubtotal)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Technicians</label>
                        <Input
                          type="number"
                          min="0"
                          value={params.noOfTechnician}
                          onChange={(e) => handleTechnicianChange('noOfTechnician', Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Daily Rate (₦)</label>
                        <Input
                          type="number"
                          value={params.technicianDailyRate}
                          onChange={(e) => handleTechnicianChange('technicianDailyRate', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Duration (Days)</label>
                        <Input
                          type="number"
                          min="1"
                          value={params.technicianDuration}
                          onChange={(e) => handleTechnicianChange('technicianDuration', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Core Logistics (Mob/Demob & Discount) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Mob / Demob (₦)</label>
                      <Input
                        type="number"
                        value={params.mobDemob}
                        onChange={(e) => set('mobDemob', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Discount (₦)</label>
                      <Input
                        type="number"
                        value={params.discount}
                        onChange={(e) => set('discount', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs font-mono text-right text-rose-600"
                      />
                    </div>
                  </div>

                  {/* Collapsible Additional Settings */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdditionalSettings(!showAdditionalSettings)}
                      className="w-full flex items-center justify-between py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Additional Settings
                        {(params.dieselCost > 0 || params.auxiliaryCost > 0 || params.installation > 0 || params.damages > 0) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </span>
                      {showAdditionalSettings ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {showAdditionalSettings && (
                      <div className="space-y-3.5 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800/80 mt-1">

                        {/* Diesel Fuel */}
                        <div className="p-2.5 rounded-md border border-slate-150 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Diesel Fuel</span>
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              ₦{fmt(dieselSubtotal)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Ltrs/Day</label>
                              <Input
                                type="number"
                                value={params.dailyDieselUsage}
                                onChange={(e) => handleDieselChange('dailyDieselUsage', parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs font-mono text-right"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Price/Ltr (₦)</label>
                              <Input
                                type="number"
                                value={params.dieselCostPerLtr}
                                onChange={(e) => handleDieselChange('dieselCostPerLtr', parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs font-mono text-right"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Days</label>
                              <Input
                                type="number"
                                value={params.dieselDuration}
                                onChange={(e) => handleDieselChange('dieselDuration', Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-7 text-xs font-mono text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auxiliary, Installation, Damages */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Auxiliary (₦)</label>
                            <Input
                              type="number"
                              value={params.auxiliaryCost}
                              onChange={(e) => set('auxiliaryCost', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs font-mono text-right"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Installation (₦)</label>
                            <Input
                              type="number"
                              value={params.installation}
                              onChange={(e) => set('installation', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs font-mono text-right"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Damages (₦)</label>
                            <Input
                              type="number"
                              value={params.damages}
                              onChange={(e) => set('damages', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs font-mono text-right text-rose-600"
                            />
                          </div>
                        </div>

                        {/* WHT Rate if enabled */}
                        {params.applyWht && (
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-[11px] text-slate-500">Withholding Tax (WHT) Rate</span>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={params.whtRate}
                                onChange={(e) => set('whtRate', parseFloat(e.target.value) || 0)}
                                className="w-16 h-7 text-xs font-mono text-right"
                              />
                              <span className="text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                        )}

                        {/* Section VAT Toggles (when itemized) */}
                        {params.vatScope === 'per_section' && params.vatMode !== 'No' && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-[11px] text-slate-500 mb-1.5 font-medium">Vatable Sections Selection</div>
                            <div className="flex flex-wrap gap-1.5">
                              {SECTIONS.map(({ key, label }) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setSection(key, !params.vatableSections[key])}
                                  className={cn(
                                    'px-2 py-0.5 text-[11px] rounded border font-medium transition-all',
                                    params.vatableSections[key]
                                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-400'
                                  )}
                                >
                                  {label} {params.vatableSections[key] ? '✓' : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Flat gross mode toggle */}
                        <div className="pt-2 text-right">
                          <button
                            type="button"
                            onClick={() => set('useDetailedBreakdown', false)}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Switch to single total gross entry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!params.useDetailedBreakdown && (
                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={() => set('useDetailedBreakdown', true)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Switch to itemized breakdown mode
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Part-Payment & Results */}
          <div className="space-y-4">

            {/* Part-Payment Controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                Part-Payment Simulation
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Payment Received (₦)</label>
                <Input
                  type="number"
                  value={params.paymentAmount}
                  onChange={(e) => set('paymentAmount', parseFloat(e.target.value) || 0)}
                  className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-right h-9"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[0.25, 0.5, 0.75, 1].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => set('paymentAmount', Math.round(inv.totalCharge * f))}
                      className="px-2 py-0.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                    >
                      {f === 1 ? 'Full (100%)' : `${f * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 mb-1.5">Allocation Method</div>
                <div className="flex gap-1.5 flex-wrap">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set('paymentMethod', m.id)}
                      className={cn(
                        'px-2.5 py-1 text-[11px] rounded-md border font-medium transition-all',
                        params.paymentMethod === m.id
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results & Audit Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                Invoice Breakdown
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Subtotal Cost', value: inv.subtotalCost },
                  inv.discount > 0 && { label: 'Discount Applied', value: -inv.discount, negative: true },
                  { label: 'Net Subtotal', value: inv.netTotalCost, bold: true },
                  { label: 'Vatable Base', value: inv.netVatableAmount, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Non-Vatable Portion', value: inv.netNonVatableAmount, color: 'text-slate-400' },
                  { label: `Invoice VAT (${params.vatRate}%)`, value: inv.vat, color: 'text-blue-700 dark:text-blue-300', bold: true },
                  { label: 'Total Charge', value: inv.totalCharge, color: 'text-slate-900 dark:text-white', bold: true },
                  params.applyWht && { label: `WHT Deduction (${params.whtRate}%)`, value: -inv.whtAmount, negative: true },
                  params.applyWht && { label: 'Net Receivable After WHT', value: inv.netReceivableAfterWht, color: 'text-emerald-600', bold: true },
                ].filter(Boolean).map((row: any, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className={cn('text-slate-500', row.bold && 'font-semibold text-slate-700 dark:text-slate-300')}>{row.label}</span>
                    <span className={cn('font-mono', row.color || 'text-slate-800 dark:text-slate-200', row.bold && 'font-bold', row.negative && 'text-rose-500')}>
                      {row.negative ? '-' : ''}₦{fmt(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Part-Payment Allocation Breakdown */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Part-Payment Result — {pmt.paymentPercentageOfInvoice}% Allocated
                </div>
                {[
                  { label: 'VAT to Remit', value: pmt.paymentVat, color: 'text-emerald-600 dark:text-emerald-400', bold: true },
                  { label: 'Principal Allocated', value: pmt.paymentPrincipal },
                  { label: 'Vatable Base Represented', value: pmt.paymentVatableBase, color: 'text-blue-500' },
                  { label: 'Remaining Balance Due', value: pmt.remainingInvoiceBalance, color: 'text-rose-500', bold: true },
                  { label: 'Remaining VAT Liability', value: pmt.remainingVatLiability, color: 'text-slate-500' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className={cn('text-slate-500', row.bold && 'font-semibold text-slate-700 dark:text-slate-300')}>{row.label}</span>
                    <span className={cn('font-mono', row.color || 'text-slate-800 dark:text-slate-200', row.bold && 'font-bold')}>
                      ₦{fmt(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proportion Bar */}
            {inv.totalCharge > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <div className="flex justify-between text-[11px] text-slate-500 mb-2">
                  <span>Principal (₦{fmt(inv.totalCharge - inv.vat)})</span>
                  <span className="text-emerald-600 font-medium">VAT (₦{fmt(inv.vat)})</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${((inv.totalCharge - inv.vat) / inv.totalCharge) * 100}%` }}
                  />
                  <div
                    className="bg-emerald-400 transition-all"
                    style={{ width: `${(inv.vat / inv.totalCharge) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Import Modal ─────────────────────────────────────────────────────── */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search invoice number, payment ref, client, site…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                  autoFocus
                />
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-xs">
              <button
                type="button"
                onClick={() => setRecordTypeFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  recordTypeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                All ({allRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setRecordTypeFilter('invoice')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  recordTypeFilter === 'invoice'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                Invoices ({allRecords.filter((r) => r.type !== 'payment').length})
              </button>
              <button
                type="button"
                onClick={() => setRecordTypeFilter('payment')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  recordTypeFilter === 'payment'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                Payments ({allRecords.filter((r) => r.type === 'payment').length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No records found</p>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleImport(item)}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer group transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-mono text-xs font-bold',
                          item.type === 'payment' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'
                        )}>
                          {item.recordNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] py-0 px-1.5',
                            item.type === 'payment'
                              ? 'border-emerald-300 text-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : item.type === 'quotation'
                                ? 'border-amber-300 text-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                                : 'border-blue-300 text-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                          )}
                        >
                          {item.type === 'payment' ? 'Payment' : item.type === 'quotation' ? 'Quotation' : 'Invoice'}
                        </Badge>
                        {item.type === 'payment' && item.invoiceNumber && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Inv: #{item.invoiceNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.client} · {item.site} {item.date && `· ${item.date}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <span className={cn(
                          'font-mono text-xs font-bold block',
                          item.type === 'payment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                        )}>
                          ₦{item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        {item.type === 'payment' && (
                          <span className="text-[10px] text-slate-400 block">Payment Received</span>
                        )}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
