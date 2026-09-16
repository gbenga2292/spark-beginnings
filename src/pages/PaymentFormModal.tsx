import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useAppStore, Payment, Invoice, PendingInvoice, PaymentAllocation } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import {
  ArrowLeft, FileText, CreditCard, Save, Split,
  RefreshCw, X, AlertCircle, CheckCircle
} from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { generateId, cn } from '@/src/lib/utils';
import { NumericFormat } from 'react-number-format';
import { buildSettlementMap } from '@/src/lib/settlementUtils';
import { computePaymentVatDetails } from './Payments';

export interface PaymentFormModalProps {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  initialPayment?: Payment | null;
  targetInvoice?: {
    invoiceId?: string;
    invoiceNumber?: string;
    client: string;
    site: string;
    amount?: number;
  } | null;
}

// ── Memoized Row for Multi-Invoice Allocation Table ──────────────────────────
// Prevents typing in one invoice row from re-rendering all other rows
interface InvoiceAllocationRowProps {
  inv: any;
  allocVal: string;
  onAllocChange: (id: string, val: string) => void;
  onPayFull: (id: string, balance: number) => void;
  onClear: (id: string) => void;
}

const InvoiceAllocationRow = React.memo(function InvoiceAllocationRow({
  inv,
  allocVal,
  onAllocChange,
  onPayFull,
  onClear,
}: InvoiceAllocationRowProps) {
  const allocNum = parseFloat(String(allocVal).replace(/,/g, '')) || 0;
  const balAfter = Math.max(0, inv.remainingBalance - allocNum);
  const isPaidInFull = allocNum >= inv.remainingBalance && inv.remainingBalance > 0;
  const isPartiallyPaid = allocNum > 0 && !isPaidInFull;

  return (
    <TableRow
      key={inv.id}
      className={cn(
        'hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors',
        allocNum > 0 ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
      )}
    >
      <TableCell className="py-2.5 px-3 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
        <div>{inv.invoiceNumber}</div>
        {inv.date && (
          <div className="text-[10px] text-slate-400 font-normal">{formatDisplayDate(inv.date)}</div>
        )}
      </TableCell>
      <TableCell className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">
        {inv.siteName || <span className="text-slate-300 dark:text-slate-600">—</span>}
      </TableCell>
      <TableCell className="py-2.5 px-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
        ₦{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
        ₦{inv.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="py-2.5 px-3 text-center">
        <NumericFormat
          customInput={Input}
          thousandSeparator
          decimalScale={2}
          placeholder="0.00"
          value={allocVal}
          onValueChange={(v) => onAllocChange(inv.id, v.value || '')}
          className={cn(
            'h-8 font-mono text-xs text-right bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
            allocNum > 0 ? 'border-blue-500 font-bold text-blue-700 dark:text-blue-300' : ''
          )}
        />
      </TableCell>
      <TableCell className="py-2.5 px-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPayFull(inv.id, inv.remainingBalance)}
            disabled={inv.remainingBalance <= 0}
            className="h-7 px-2 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-sm"
            title="Pay full remaining balance"
          >
            Pay Full
          </Button>
          {allocNum > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onClear(inv.id)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-sm"
              title="Clear allocation"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2.5 px-3 text-right">
        {isPaidInFull ? (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
            ✓ Cleared Full
          </Badge>
        ) : isPartiallyPaid ? (
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 font-mono">
            ₦{balAfter.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} rem
          </Badge>
        ) : inv.remainingBalance <= 0 ? (
          <span className="text-[11px] text-slate-400 italic">Settled</span>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </TableCell>
    </TableRow>
  );
});

export const initialPaymentForm = {
  date: '',
  client: '',
  site: '',
  amount: '',
  withholdingTax: '',
  discount: '',
  damages: '',
  paidTo: '',
  invoiceId: '',
  invoiceNumber: '',
  allocationMode: 'single' as 'single' | 'multi',
  allocations: {} as Record<string, { amount: string; withholdingTax: string; discount: string }>,
};

export function PaymentFormModal({
  open,
  onClose,
  selectedId,
  initialPayment,
  targetInvoice,
}: PaymentFormModalProps) {
  const sites = useAppStore((state) => state.sites);
  const payments = useAppStore((state) => state.payments);
  const invoices = useAppStore((state) => state.invoices);
  const pendingInvoices = useAppStore((state) => state.pendingInvoices);
  const clientProfiles = useAppStore((state) => state.clientProfiles);
  const pendingSites = useAppStore((state) => state.pendingSites);
  const ledgerBanks = useAppStore((state) => state.ledgerBanks);
  const addPayment = useAppStore((state) => state.addPayment);
  const updatePayment = useAppStore((state) => state.updatePayment);
  const vatRate = useAppStore((state) => state.payrollVariables.vatRate);

  const [form, setForm] = useState(initialPaymentForm);
  const [filterAllocBySite, setFilterAllocBySite] = useState(false);

  const sortedBanks = useMemo(
    () => [...ledgerBanks].sort((a, b) => a.name.localeCompare(b.name)),
    [ledgerBanks]
  );

  const normStr = (s?: string) => (s || '').trim().toLowerCase();

  const getInvoiceSite = useCallback((inv: any) => {
    return (
      inv.siteName ||
      inv.site ||
      inv.project ||
      sites.find((s) => s.id === inv.siteId)?.name ||
      ''
    ).trim();
  }, [sites]);

  const allInvoices = useMemo(
    () => [...invoices, ...pendingInvoices],
    [invoices, pendingInvoices]
  );

  // Settlement map excluding current payment when editing so its own allocation doesn't reduce remaining balance to 0
  const settlementPayments = useMemo(() => {
    if (!selectedId) return payments;
    return payments.filter((p) => p.id !== selectedId);
  }, [payments, selectedId]);

  const settlementMap = useMemo(() => {
    return buildSettlementMap(allInvoices, settlementPayments);
  }, [allInvoices, settlementPayments]);

  const formatInvoice = useCallback((inv: Invoice | PendingInvoice) => {
    const id = inv.id;
    const invoiceNumber = (inv as any).invoiceNumber || (inv as any).invoiceNo || inv.id;
    const totalAmount = Number((inv as any).totalCharge || (inv as any).amount || 0);
    const settlement = settlementMap.get(id);
    const totalSettled = settlement ? settlement.totalSettled : 0;
    const remainingBalance = settlement ? settlement.remainingBalance : totalAmount;
    const status = settlement ? settlement.status : ((inv as any).status || 'Sent');
    const siteName = getInvoiceSite(inv);
    const client = ((inv as any).client || '').trim();
    const date = (inv as any).date || (inv as any).startDate || '';
    const dueDate = (inv as any).dueDate || (inv as any).endDate || '';
    const vat = (inv as any).vat != null ? Number((inv as any).vat) : 0;
    const vatableAmount = (inv as any).vatableAmount != null ? Number((inv as any).vatableAmount) : undefined;
    const nonVatableAmount = (inv as any).nonVatableAmount != null ? Number((inv as any).nonVatableAmount) : undefined;
    const vatScope = (inv as any).vatScope;

    return {
      id,
      invoiceNumber,
      client,
      siteName,
      totalAmount,
      totalSettled,
      remainingBalance,
      status,
      date,
      dueDate,
      vatInc: (inv as any).vatInc,
      vat,
      vatableAmount,
      nonVatableAmount,
      vatScope,
    };
  }, [settlementMap, getInvoiceSite]);

  // Invoices matching the selected client and/or site
  const clientInvoices = useMemo(() => {
    if (!form.client && !form.site) return [];
    const normClient = normStr(form.client);
    const normSite = normStr(form.site);

    return allInvoices
      .filter((i) => {
        const iClient = normStr(i.client);
        const iSite = normStr(getInvoiceSite(i));

        const clientMatch =
          normClient &&
          (iClient === normClient ||
            (normClient.length >= 3 &&
              (iClient.startsWith(normClient) || normClient.startsWith(iClient))));
        const siteMatch =
          normSite &&
          (iSite === normSite ||
            (normSite.length >= 3 &&
              (iSite.startsWith(normSite) || normSite.startsWith(iSite))));

        if (normClient && normSite) return clientMatch || siteMatch;
        if (normClient) return clientMatch;
        if (normSite) return siteMatch;
        return false;
      })
      .map(formatInvoice);
  }, [allInvoices, form.client, form.site, formatInvoice, getInvoiceSite]);

  // Ensure currently selected invoice is always in the available list
  const allAvailableInvoices = useMemo(() => {
    const list = [...clientInvoices];
    if (form.invoiceId && !list.some((i) => i.id === form.invoiceId)) {
      const raw = allInvoices.find((i) => i.id === form.invoiceId);
      if (raw) {
        list.unshift(formatInvoice(raw));
      }
    }
    return list;
  }, [clientInvoices, form.invoiceId, allInvoices, formatInvoice]);

  // Invoices matching the selected site
  const siteInvoices = useMemo(() => {
    if (!form.site) return allAvailableInvoices;
    const normSite = normStr(form.site);
    return allAvailableInvoices.filter((i) => {
      const iSite = normStr(i.siteName);
      return (
        iSite === normSite ||
        (normSite.length >= 3 && (iSite.startsWith(normSite) || normSite.startsWith(iSite)))
      );
    });
  }, [allAvailableInvoices, form.site]);

  // Invoices for this client from other sites (or unassigned site)
  const otherInvoices = useMemo(() => {
    if (!form.site) return [];
    const siteSet = new Set(siteInvoices.map((i) => i.id));
    return allAvailableInvoices.filter((i) => !siteSet.has(i.id));
  }, [allAvailableInvoices, siteInvoices, form.site]);

  const selectedInvoiceDetails = useMemo(() => {
    if (!form.invoiceId) return null;
    return allAvailableInvoices.find((i) => i.id === form.invoiceId) || null;
  }, [form.invoiceId, allAvailableInvoices]);

  const allocInvoices = useMemo(() => {
    if (filterAllocBySite && form.site) {
      return siteInvoices;
    }
    return allAvailableInvoices;
  }, [filterAllocBySite, form.site, siteInvoices, allAvailableInvoices]);

  const allocationSummary = useMemo(() => {
    const paymentAmount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
    let totalCashAllocated = 0;
    let totalWhtAllocated = 0;
    let totalDiscountAllocated = 0;
    let allocatedInvoicesCount = 0;

    if (form.allocationMode === 'multi') {
      Object.values(form.allocations).forEach((item) => {
        const c = parseFloat(String(item.amount || '').replace(/,/g, '')) || 0;
        const w = parseFloat(String(item.withholdingTax || '').replace(/,/g, '')) || 0;
        const d = parseFloat(String(item.discount || '').replace(/,/g, '')) || 0;
        if (c > 0 || w > 0 || d > 0) {
          totalCashAllocated += c;
          totalWhtAllocated += w;
          totalDiscountAllocated += d;
          allocatedInvoicesCount++;
        }
      });
    } else if (form.invoiceId) {
      totalCashAllocated = paymentAmount;
      totalWhtAllocated = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
      totalDiscountAllocated = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
      allocatedInvoicesCount = 1;
    }

    const unappliedCash = Math.round((paymentAmount - totalCashAllocated) * 100) / 100;
    const isOverallocated = unappliedCash < -0.01;
    const isFullyAllocated = Math.abs(unappliedCash) <= 0.01 && paymentAmount > 0;
    const isPartiallyAllocated = unappliedCash > 0.01 && totalCashAllocated > 0;

    return {
      paymentAmount,
      totalCashAllocated,
      totalWhtAllocated,
      totalDiscountAllocated,
      unappliedCash,
      allocatedInvoicesCount,
      isOverallocated,
      isFullyAllocated,
      isPartiallyAllocated,
    };
  }, [form.amount, form.allocationMode, form.allocations, form.invoiceId, form.withholdingTax, form.discount]);

  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    sites.forEach((s) => s.client && set.add(s.client.trim()));
    pendingSites.forEach((ps) => ps.clientName && set.add(ps.clientName.trim()));
    clientProfiles.forEach((cp) => cp.name && set.add(cp.name.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sites, pendingSites, clientProfiles]);

  const sitesForClient = useMemo(() => {
    if (!form.client) return [];
    const normC = normStr(form.client);
    const list: { name: string; vat?: string }[] = [];
    sites.forEach((s) => {
      if (normStr(s.client) === normC && s.name) list.push({ name: s.name, vat: s.vat });
    });
    pendingSites.forEach((ps) => {
      if (normStr(ps.clientName) === normC && ps.siteName) {
        const v = ps.phase4?.clientTaxStatus?.includes('Add')
          ? 'Add'
          : ps.phase4?.clientTaxStatus?.includes('Yes')
          ? 'Yes'
          : 'No';
        if (!list.some((x) => normStr(x.name) === normStr(ps.siteName))) {
          list.push({ name: ps.siteName, vat: v });
        }
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, pendingSites, form.client]);

  // Synchronize form whenever modal opens or props change
  useEffect(() => {
    if (!open) return;

    if (initialPayment) {
      const pay = initialPayment;
      const isMulti = Boolean(pay.allocations && pay.allocations.length > 1);
      const allocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};

      if (pay.allocations && pay.allocations.length > 0) {
        pay.allocations.forEach((a) => {
          allocMap[a.invoiceId] = {
            amount: a.amount ? String(a.amount) : '',
            withholdingTax: a.withholdingTax ? String(a.withholdingTax) : '',
            discount: a.discount ? String(a.discount) : '',
          };
        });
      } else if (pay.invoiceId) {
        allocMap[pay.invoiceId] = {
          amount: pay.amount ? String(pay.amount) : '',
          withholdingTax: pay.withholdingTax ? String(pay.withholdingTax) : '',
          discount: pay.discount ? String(pay.discount) : '',
        };
      }

      setForm({
        date: normalizeDate(pay.date),
        client: pay.client,
        site: pay.site,
        amount: pay.amount.toString(),
        withholdingTax: pay.withholdingTax ? pay.withholdingTax.toString() : '',
        discount: pay.discount ? pay.discount.toString() : '',
        damages: pay.damages ? pay.damages.toString() : '',
        paidTo: pay.paidTo || '',
        invoiceId:
          pay.invoiceId ||
          (pay.allocations && pay.allocations.length === 1 ? pay.allocations[0].invoiceId : ''),
        invoiceNumber:
          pay.invoiceNumber ||
          (pay.allocations && pay.allocations.length === 1
            ? pay.allocations[0].invoiceNumber || ''
            : ''),
        allocationMode: isMulti ? 'multi' : 'single',
        allocations: allocMap,
      });
    } else if (targetInvoice) {
      const invId = targetInvoice.invoiceId || '';
      const invNum = targetInvoice.invoiceNumber || '';
      const amtStr = targetInvoice.amount ? String(targetInvoice.amount) : '';
      const allocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};
      if (invId) {
        allocMap[invId] = { amount: amtStr, withholdingTax: '', discount: '' };
      }
      setForm({
        date: new Date().toISOString().split('T')[0],
        client: targetInvoice.client,
        site: targetInvoice.site,
        amount: amtStr,
        withholdingTax: '',
        discount: '',
        damages: '',
        paidTo: '',
        invoiceId: invId,
        invoiceNumber: invNum,
        allocationMode: 'single',
        allocations: allocMap,
      });
    } else {
      setForm(initialPaymentForm);
    }
  }, [open, initialPayment, targetInvoice]);

  const handleInvoiceSelected = (invId: string) => {
    if (!invId) {
      setForm((prev) => ({
        ...prev,
        invoiceId: '',
        invoiceNumber: '',
        allocations: {},
      }));
      return;
    }
    const selectedInv = allAvailableInvoices.find((i) => i.id === invId);
    if (selectedInv) {
      if (selectedInv.remainingBalance <= 0.01) {
        toast.info(`Invoice ${selectedInv.invoiceNumber} is already fully paid (₦0.00 balance due).`);
      }
      setForm((prev) => {
        const nextSite = selectedInv.siteName || prev.site;
        const currentAmt = parseFloat(String(prev.amount).replace(/,/g, '')) || 0;
        const nextAmt =
          currentAmt === 0
            ? String(selectedInv.remainingBalance > 0 ? selectedInv.remainingBalance : '')
            : prev.amount;
        return {
          ...prev,
          invoiceId: selectedInv.id,
          invoiceNumber: selectedInv.invoiceNumber,
          site: nextSite,
          amount: nextAmt,
          allocations: {
            [selectedInv.id]: {
              amount: nextAmt,
              withholdingTax: prev.withholdingTax,
              discount: prev.discount,
            },
          },
        };
      });
    }
  };

  const handleAutoAllocateFIFO = () => {
    const grossCash = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
    if (grossCash <= 0) {
      toast.error('Please enter a total payment amount first.');
      return;
    }

    let remainingCash = grossCash;
    const newAllocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};
    let allocatedCount = 0;

    const openInvs = [...allocInvoices]
      .filter((i) => i.remainingBalance > 0.01)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    openInvs.forEach((inv) => {
      if (remainingCash <= 0) return;
      const take = Math.min(remainingCash, inv.remainingBalance);
      const roundedTake = Math.round(take * 100) / 100;
      if (roundedTake > 0) {
        newAllocMap[inv.id] = {
          amount: String(roundedTake),
          withholdingTax: '',
          discount: '',
        };
        remainingCash = Math.round((remainingCash - roundedTake) * 100) / 100;
        allocatedCount++;
      }
    });

    setForm((prev) => ({
      ...prev,
      allocations: newAllocMap,
    }));

    if (allocatedCount > 0) {
      toast.success(
        `Auto-allocated across ${allocatedCount} invoice(s). Remaining unapplied: ₦${Math.max(
          0,
          remainingCash
        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
    } else {
      toast.info('No open invoices with outstanding balance found to allocate.');
    }
  };

  const handleClearAllAllocations = () => {
    setForm((prev) => ({ ...prev, allocations: {} }));
    toast.info('All invoice allocations cleared.');
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Callbacks for memoized InvoiceAllocationRow
  const handleAllocChange = useCallback((id: string, val: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [id]: {
          ...(prev.allocations[id] || { withholdingTax: '', discount: '' }),
          amount: val,
        },
      },
    }));
  }, []);

  const handlePayFull = useCallback((id: string, balance: number) => {
    setForm((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [id]: {
          ...(prev.allocations[id] || { withholdingTax: '', discount: '' }),
          amount: String(balance),
        },
      },
    }));
  }, []);

  const handleClearRowAlloc = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [id]: {
          ...(prev.allocations[id] || { withholdingTax: '', discount: '' }),
          amount: '',
        },
      },
    }));
  }, []);

  const livePreview = useMemo(() => {
    const amount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
    const damages = parseFloat(String(form.damages).replace(/,/g, '')) || 0;
    const siteObj = sites.find((s) => s.name === form.site && s.client === form.client);
    const payVat = selectedInvoiceDetails?.vatInc || (siteObj ? siteObj.vat : 'No');

    const { vat, amountForVat, isItemized, effectiveVatRate } = computePaymentVatDetails(
      amount,
      damages,
      payVat,
      vatRate,
      form.allocationMode,
      form.allocations,
      selectedInvoiceDetails,
      allAvailableInvoices,
      allInvoices
    );

    return { amount, vat, payVat, amountForVat, damages, isItemized, effectiveVatRate };
  }, [
    form.amount,
    form.site,
    form.client,
    form.damages,
    form.allocationMode,
    form.allocations,
    sites,
    vatRate,
    selectedInvoiceDetails,
    allAvailableInvoices,
    allInvoices,
  ]);

  const calculatePayment = (): Omit<Payment, 'id'> | null => {
    if (!form.date || !form.client || !form.site) {
      toast.error('Date, Client, and Site are required.');
      return null;
    }

    const amount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
    const withholdingTax = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
    const discount = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
    const damages = parseFloat(String(form.damages).replace(/,/g, '')) || 0;

    const siteObj = sites.find((s) => s.name === form.site && s.client === form.client);
    const payVat = (selectedInvoiceDetails?.vatInc || (siteObj ? siteObj.vat : 'No')) as any;

    let allocations: PaymentAllocation[] = [];
    let invoiceId: string | undefined = undefined;
    let invoiceNumber: string | undefined = undefined;
    let unappliedAmount: number = 0;

    if (form.allocationMode === 'multi') {
      let totalAllocCash = 0;
      Object.entries(form.allocations).forEach(([invId, data]) => {
        const aAmt = parseFloat(String(data.amount || '').replace(/,/g, '')) || 0;
        const aWht = parseFloat(String(data.withholdingTax || '').replace(/,/g, '')) || 0;
        const aDisc = parseFloat(String(data.discount || '').replace(/,/g, '')) || 0;
        if (aAmt > 0 || aWht > 0 || aDisc > 0) {
          totalAllocCash += aAmt;
          const invObj =
            allAvailableInvoices.find((i) => i.id === invId) ||
            allInvoices.find((i) => i.id === invId);
          const invNum = invObj
            ? (invObj as any).invoiceNumber || (invObj as any).invoiceNo || invId
            : invId;
          allocations.push({
            invoiceId: invId,
            invoiceNumber: invNum,
            amount: aAmt,
            withholdingTax: aWht > 0 ? aWht : undefined,
            discount: aDisc > 0 ? aDisc : undefined,
          });
        }
      });

      if (allocations.length === 1) {
        invoiceId = allocations[0].invoiceId;
        invoiceNumber = allocations[0].invoiceNumber;
      } else if (allocations.length > 1) {
        invoiceNumber = `${allocations.length} Invoices`;
      }

      unappliedAmount = Math.max(0, Math.round((amount - totalAllocCash) * 100) / 100);
    } else {
      // Single invoice mode
      if (form.invoiceId) {
        invoiceId = form.invoiceId;
        invoiceNumber = form.invoiceNumber;
        allocations = [
          {
            invoiceId: form.invoiceId,
            invoiceNumber: form.invoiceNumber,
            amount: amount,
            withholdingTax: withholdingTax > 0 ? withholdingTax : undefined,
            discount: discount > 0 ? discount : undefined,
          },
        ];
        unappliedAmount = 0;
      } else {
        // General advance / unallocated
        unappliedAmount = amount;
      }
    }

    const { vat, amountForVat } = computePaymentVatDetails(
      amount,
      damages,
      payVat,
      vatRate,
      form.allocationMode,
      form.allocations,
      selectedInvoiceDetails,
      allAvailableInvoices,
      allInvoices
    );

    return {
      client: form.client,
      site: form.site,
      date: formatDisplayDate(form.date),
      amount,
      withholdingTax,
      discount,
      damages,
      payVat,
      vat,
      amountForVat,
      paidTo: form.paidTo || undefined,
      invoiceId,
      invoiceNumber,
      allocations,
      unappliedAmount,
    };
  };

  const handleSubmit = () => {
    const data = calculatePayment();
    if (!data) return;

    if (selectedId) {
      updatePayment(selectedId, data);
      toast.success('Payment updated successfully!');
    } else {
      addPayment({ ...data, id: generateId() });
      toast.success('Payment submitted successfully!');
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
                onClose();
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5 pointer-events-none" />
              <span className="pointer-events-none">Back to Payments</span>
            </Button>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-800" />
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none">
                {selectedId ? 'Edit Payment' : 'Record New Payment'}
              </h2>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                Record client remittance, allocate across single or multiple invoices, and sync settlement status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Allocation Mode Selector */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-sm border border-slate-300/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, allocationMode: 'single' }))}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer',
                  form.allocationMode === 'single'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <FileText className="w-3 h-3" />
                <span>Single Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, allocationMode: 'multi' }))}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-xs transition-all flex items-center gap-1.5 cursor-pointer',
                  form.allocationMode === 'multi'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Split className="w-3 h-3" />
                <span>Split Across Invoices</span>
                {allocationSummary.allocatedInvoicesCount > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                    {allocationSummary.allocatedInvoicesCount}
                  </span>
                )}
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{selectedId ? 'Update Payment' : 'Save Payment'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable body with 2 columns */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-5 flex flex-col gap-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Main Form Left Column */}
          <div className="space-y-6">
            {/* Card 1: Remittance Info */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-sm text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                    Remittance &amp; Account Details
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Payment date, client entity, site location, amount, and company bank account.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Payment Date
                    </label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => handleChange('date', e.target.value)}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 rounded-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Received Amount (₦)
                    </label>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      placeholder="0.00"
                      value={form.amount}
                      onValueChange={(v) => handleChange('amount', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums font-bold text-base text-emerald-600 dark:text-emerald-400 h-10 rounded-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Received Into (Company Account)
                    </label>
                    <select
                      value={form.paidTo}
                      onChange={(e) => handleChange('paidTo', e.target.value)}
                      className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select Receiving Account...</option>
                      {sortedBanks.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Client Account
                    </label>
                    <select
                      value={form.client}
                      onChange={(e) => {
                        const newClient = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          client: newClient,
                          site: '',
                          invoiceId: '',
                          invoiceNumber: '',
                          allocations: {},
                        }));
                      }}
                      className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-900 dark:text-slate-100"
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
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Site Location
                      </label>
                      {form.client && (
                        <span className="text-[11px] text-slate-400">
                          {sitesForClient.length} registered site(s)
                        </span>
                      )}
                    </div>
                    <select
                      value={form.site}
                      onChange={(e) => {
                        const newSite = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          site: newSite,
                        }));
                      }}
                      disabled={!form.client}
                      className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                    >
                      <option value="">
                        Select Site (or All Sites for {form.client || 'Client'})...
                      </option>
                      {sitesForClient.map((s, i) => (
                        <option key={i} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Invoice Allocation */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-sm text-blue-600 dark:text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      {form.allocationMode === 'multi'
                        ? 'Split Allocation Across Invoices'
                        : 'Apply to Single Invoice'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {form.allocationMode === 'multi'
                        ? 'Allocate payment amounts directly to specific open invoices with automatic balance reconciliation.'
                        : 'Choose an invoice to link this payment directly, or leave unallocated as an advance deposit.'}
                    </p>
                  </div>
                </div>

                {/* Batch Tools for Multi-allocation */}
                <div className="flex items-center gap-2">
                  {form.allocationMode === 'multi' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoAllocateFIFO}
                        className="h-8 text-xs font-semibold gap-1.5 border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
                        title="Automatically allocates payment to oldest open invoices first"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Auto-Allocate (FIFO)</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAllAllocations}
                        className="h-8 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Clear All
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6">
                {form.allocationMode === 'single' ? (
                  /* SINGLE INVOICE SELECTION */
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Selected Invoice
                        </label>
                        {(form.client || form.site) && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                            {form.site
                              ? `${siteInvoices.length} on site${
                                  otherInvoices.length > 0 ? ` (+${otherInvoices.length} other)` : ''
                                }`
                              : `${clientInvoices.length} invoice${
                                  clientInvoices.length !== 1 ? 's' : ''
                                } found`}
                          </span>
                        )}
                      </div>
                      <select
                        value={form.invoiceId}
                        onChange={(e) => handleInvoiceSelected(e.target.value)}
                        disabled={!form.client && !form.site}
                        className="flex h-11 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                      >
                        <option value="">General Deposit / Advance (Unallocated)</option>
                        {(() => {
                          const renderOpt = (inv: any) => {
                            const isSettled = inv.remainingBalance <= 0.01;
                            return (
                              <option key={inv.id} value={inv.id}>
                                {isSettled
                                  ? `${inv.invoiceNumber} — Billed: ₦${inv.totalAmount.toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 }
                                    )} [Paid - Fully Settled]${
                                      inv.siteName ? ` • [${inv.siteName}]` : ''
                                    }`
                                  : `${inv.invoiceNumber} — Balance Due: ₦${inv.remainingBalance.toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 }
                                    )} (Billed: ₦${inv.totalAmount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}) [${inv.status}]${inv.siteName ? ` • [${inv.siteName}]` : ''}`}
                              </option>
                            );
                          };

                          if (form.site) {
                            const siteOpen = siteInvoices.filter((i) => i.remainingBalance > 0.01);
                            const siteSettled = siteInvoices.filter((i) => i.remainingBalance <= 0.01);
                            const otherOpen = otherInvoices.filter((i) => i.remainingBalance > 0.01);
                            const otherSettled = otherInvoices.filter((i) => i.remainingBalance <= 0.01);

                            return (
                              <>
                                {siteOpen.length > 0 && (
                                  <optgroup label={`${form.site} — Open Invoices (${siteOpen.length})`}>
                                    {siteOpen.map(renderOpt)}
                                  </optgroup>
                                )}
                                {siteSettled.length > 0 && (
                                  <optgroup label={`${form.site} — Settled Invoices (${siteSettled.length})`}>
                                    {siteSettled.map(renderOpt)}
                                  </optgroup>
                                )}
                                {otherOpen.length > 0 && (
                                  <optgroup
                                    label={`Other Sites for ${form.client || 'Client'} — Open (${
                                      otherOpen.length
                                    })`}
                                  >
                                    {otherOpen.map(renderOpt)}
                                  </optgroup>
                                )}
                                {otherSettled.length > 0 && (
                                  <optgroup
                                    label={`Other Sites for ${form.client || 'Client'} — Settled (${
                                      otherSettled.length
                                    })`}
                                  >
                                    {otherSettled.map(renderOpt)}
                                  </optgroup>
                                )}
                              </>
                            );
                          }

                          const clientOpen = clientInvoices.filter((i) => i.remainingBalance > 0.01);
                          const clientSettled = clientInvoices.filter((i) => i.remainingBalance <= 0.01);

                          return (
                            <>
                              {clientOpen.length > 0 && (
                                <optgroup label={`Open Invoices (${clientOpen.length})`}>
                                  {clientOpen.map(renderOpt)}
                                </optgroup>
                              )}
                              {clientSettled.length > 0 && (
                                <optgroup label={`Settled Invoices (${clientSettled.length})`}>
                                  {clientSettled.map(renderOpt)}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
                      </select>
                    </div>

                    {selectedInvoiceDetails && (
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-sm space-y-2">
                        <div className="flex flex-wrap justify-between items-center text-sm gap-2">
                          <span className="text-slate-700 dark:text-slate-300">
                            Invoice:{' '}
                            <strong className="font-mono text-slate-900 dark:text-white">
                              {selectedInvoiceDetails.invoiceNumber}
                            </strong>
                            {selectedInvoiceDetails.siteName && (
                              <span className="text-xs text-slate-500 ml-2">
                                ({selectedInvoiceDetails.siteName})
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-4 text-xs">
                            <span>
                              Billed:{' '}
                              <strong className="font-mono">
                                ₦
                                {selectedInvoiceDetails.totalAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </strong>
                            </span>
                            <span>
                              Remaining:{' '}
                              <strong className="font-mono text-blue-600 dark:text-blue-400">
                                ₦
                                {selectedInvoiceDetails.remainingBalance.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const cash = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
                          const wht = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
                          const disc = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
                          const totalApplied = cash + wht + disc;
                          const remAfter = Math.max(0, selectedInvoiceDetails.remainingBalance - totalApplied);
                          return (
                            <div className="flex flex-wrap justify-between items-center pt-2 border-t border-blue-100 dark:border-blue-900/30 text-xs gap-2">
                              <span className="text-slate-600 dark:text-slate-400">
                                Total Applied:{' '}
                                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                  ₦
                                  {totalApplied.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })}
                                </strong>
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  remAfter <= 0.01
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                                }
                              >
                                {remAfter <= 0.01
                                  ? '✓ Clears in Full (Paid)'
                                  : `Remaining Balance: ₦${remAfter.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}`}
                              </Badge>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="text-center pt-2">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setForm((f) => ({ ...f, allocationMode: 'multi' }))}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline gap-1.5 cursor-pointer"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span>Need to split this payment across multiple invoices? Switch to Split Mode</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* MULTI-INVOICE ALLOCATION TABLE (Memoized rows) */
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                      <div className="text-xs text-slate-500">
                        Specify exact amounts to apply to each invoice. Any unallocated amount will be preserved as advance credit.
                      </div>
                      {form.site && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={filterAllocBySite}
                              onChange={(e) => setFilterAllocBySite(e.target.checked)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>Filter to {form.site} invoices only</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {allocInvoices.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                        <p className="text-sm font-medium">No invoices found for {form.client || 'the selected client'}.</p>
                        <p className="text-xs text-slate-400 mt-1">Select a client above to list and allocate open invoices.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                            <TableRow className="border-b border-slate-200 dark:border-slate-800">
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3">Invoice #</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3">Site</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Billed Amount</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Balance Due</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-center w-40">Allocated Cash (₦)</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-center">Quick Fill</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Status After</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allocInvoices.map((inv) => (
                              <InvoiceAllocationRow
                                key={inv.id}
                                inv={inv}
                                allocVal={form.allocations[inv.id]?.amount || ''}
                                onAllocChange={handleAllocChange}
                                onPayFull={handlePayFull}
                                onClear={handleClearRowAlloc}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Deductions & Taxes */}
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-sm text-amber-600 dark:text-amber-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                    Deductions &amp; VAT Components
                  </h3>
                  <p className="text-[10px] text-slate-400">Withholding tax, prompt-payment discount, and damages deductions.</p>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Withholding Tax (₦)
                    </label>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      placeholder="0.00"
                      value={form.withholdingTax}
                      onValueChange={(v) => handleChange('withholdingTax', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Discount (₦)
                    </label>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      placeholder="0.00"
                      value={form.discount}
                      onValueChange={(v) => handleChange('discount', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Damages (₦) <span className="text-[10px] font-normal text-slate-400">(Non-vatable)</span>
                    </label>
                    <NumericFormat
                      customInput={Input}
                      thousandSeparator
                      decimalScale={2}
                      placeholder="0.00"
                      value={form.damages}
                      onValueChange={(v) => handleChange('damages', v.value || '')}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sticky Sidebar: Real-Time Summary & Save */}
          <div className="xl:sticky xl:top-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="bg-slate-900 px-5 py-4 text-white border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Payment Breakdown</h4>
                  <p className="text-[10px] text-slate-400">Live reconciliation state</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border',
                    livePreview.payVat === 'Yes'
                      ? 'text-blue-400 bg-blue-950/50 border-blue-800'
                      : livePreview.payVat === 'Add'
                      ? 'text-amber-400 bg-amber-950/50 border-amber-800'
                      : 'text-slate-400 bg-slate-800 border-slate-700'
                  )}
                >
                  VAT: {livePreview.payVat}
                </Badge>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="flex justify-between items-baseline border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-500 font-medium">Gross Payment</span>
                  <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                    ₦{allocationSummary.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-baseline border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    Total Allocated ({allocationSummary.allocatedInvoicesCount} inv)
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    ₦{allocationSummary.totalCashAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Status Badge & Unapplied / Overallocated */}
                <div className="p-3 rounded-md border bg-slate-50/50 dark:bg-slate-800/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Unapplied Balance</span>
                    <span
                      className={cn(
                        'font-mono font-bold text-xs',
                        allocationSummary.isOverallocated
                          ? 'text-rose-600'
                          : allocationSummary.isFullyAllocated
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      )}
                    >
                      ₦{Math.abs(allocationSummary.unappliedCash).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {allocationSummary.isOverallocated && (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Allocations exceed total payment by ₦{Math.abs(allocationSummary.unappliedCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  )}

                  {allocationSummary.isFullyAllocated && (
                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      100% of payment allocated to invoices
                    </p>
                  )}

                  {allocationSummary.isPartiallyAllocated && (
                    <p className="text-[10.5px] text-slate-500 leading-tight mt-1">
                      ₦{allocationSummary.unappliedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} will remain on ledger as unapplied client deposit.
                    </p>
                  )}

                  {!allocationSummary.isOverallocated &&
                    !allocationSummary.isFullyAllocated &&
                    !allocationSummary.isPartiallyAllocated && (
                      <p className="text-[10.5px] text-slate-400 leading-tight">
                        Full amount unallocated (Advance payment / general deposit).
                      </p>
                    )}
                </div>

                {/* Tax components */}
                <div className="space-y-1.5 pt-1 text-[11px]">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>VAT Component:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                      ₦{livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Amount For VAT:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ₦{livePreview.amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {livePreview.isItemized && (
                    <div className="flex justify-between items-center text-[10.5px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-xs border border-amber-200 dark:border-amber-900/40">
                      <span>Itemized Effective Rate:</span>
                      <span className="font-mono font-bold">{livePreview.effectiveVatRate}%</span>
                    </div>
                  )}
                  {livePreview.damages > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Damages Deducted:</span>
                      <span className="font-mono font-semibold">
                        -₦{livePreview.damages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 font-bold rounded-sm shadow-xs cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{selectedId ? 'Update Payment' : 'Save Payment'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full border-slate-300 dark:border-slate-700 h-9 text-slate-700 dark:text-slate-300 rounded-sm cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
