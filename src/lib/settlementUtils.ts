import { Invoice, PendingInvoice, Payment } from '../store/appStore';
import { normalizeDate } from './dateUtils';

export interface SettlementAllocation {
  paymentId: string;
  paymentReference?: string;
  paymentDate?: string;
  settledAmount: number;
  cashAmount: number;
  whtAmount: number;
  discountAmount?: number;
  isAdvanceOrHistoricalFifo?: boolean;
}

export interface InvoiceSettlement {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  cashPaid: number;
  whtCredited: number;
  discountCredited: number;
  totalSettled: number;
  remainingBalance: number;
  isPaid: boolean;
  status: 'Paid' | 'Partially Paid' | 'Overdue' | 'Sent' | 'Draft';
  linkedPayments: Payment[];

  // Aliases for compatibility across views and dialogs
  totalBilled: number;
  whtDeducted: number;
  balanceRemaining: number;
  allocations: SettlementAllocation[];
}

export interface OpenInvoiceItem {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  totalAmount: number;
  totalSettled: number;
  remainingBalance: number;
  status: string;
  vatInc?: string;
}

/**
 * Normalizes client or site string for reliable comparisons
 */
const norm = (str?: string) => (str || '').trim().toLowerCase();

/**
 * Builds a global reconciliation map of all invoices and payments.
 * Handles both explicit allocations (invoiceId / allocations array)
 * and legacy/unallocated payments via deterministic FIFO waterfall.
 */
export function buildSettlementMap(
  allInvoices: (Invoice | PendingInvoice)[],
  allPayments: Payment[]
): Map<string, InvoiceSettlement> {
  const settlementMap = new Map<string, InvoiceSettlement>();

  // 1. Initialize settlement record for every invoice
  allInvoices.forEach(inv => {
    const totalAmount = Number(inv.totalCharge || (inv as any).amount || 0);
    const invoiceNumber = (inv as any).invoiceNumber || (inv as any).invoiceNo || inv.id;
    settlementMap.set(inv.id, {
      invoiceId: inv.id,
      invoiceNumber,
      totalAmount,
      cashPaid: 0,
      whtCredited: 0,
      discountCredited: 0,
      totalSettled: 0,
      remainingBalance: totalAmount,
      isPaid: false,
      status: ((inv as any).status as any) || 'Sent',
      linkedPayments: [],
      totalBilled: totalAmount,
      whtDeducted: 0,
      balanceRemaining: totalAmount,
      allocations: [],
    });
  });

  // Track remaining capacity needed per invoice for legacy FIFO pooling
  const remainingNeeded = new Map<string, number>();
  allInvoices.forEach(inv => {
    remainingNeeded.set(inv.id, settlementMap.get(inv.id)!.totalAmount);
  });

  // Keep track of which payments have unallocated funds
  const unallocatedPayments: Payment[] = [];

  // 2. Process Explicit Allocations First
  allPayments.forEach(pay => {
    let paymentConsumed = false;

    // Check if payment has explicit multi-invoice allocations
    if (pay.allocations && pay.allocations.length > 0) {
      pay.allocations.forEach(alloc => {
        const record = settlementMap.get(alloc.invoiceId);
        if (record) {
          const cash = Number(alloc.amount || 0);
          const wht = Number(alloc.withholdingTax || 0);
          const disc = Number(alloc.discount || 0);

          record.cashPaid += cash;
          record.whtCredited += wht;
          record.discountCredited += disc;
          record.totalSettled = record.cashPaid + record.whtCredited + record.discountCredited;
          record.remainingBalance = Math.max(0, record.totalAmount - record.totalSettled);
          record.balanceRemaining = record.remainingBalance;
          record.whtDeducted = record.whtCredited;
          remainingNeeded.set(alloc.invoiceId, record.remainingBalance);

          if (!record.linkedPayments.some(p => p.id === pay.id)) {
            record.linkedPayments.push(pay);
          }

          record.allocations.push({
            paymentId: pay.id,
            paymentReference: (pay as any).reference || (pay as any).paymentNumber || pay.invoiceNumber || undefined,
            paymentDate: pay.date,
            settledAmount: cash + wht + disc,
            cashAmount: cash,
            whtAmount: wht,
            discountAmount: disc,
            isAdvanceOrHistoricalFifo: false,
          });

          paymentConsumed = true;
        }
      });
    } else if (pay.invoiceId) {
      // Direct 1-to-1 invoice linkage
      const record = settlementMap.get(pay.invoiceId);
      if (record) {
        const cash = Number(pay.amount || 0);
        const wht = Number(pay.withholdingTax || 0);
        const disc = Number(pay.discount || 0);

        record.cashPaid += cash;
        record.whtCredited += wht;
        record.discountCredited += disc;
        record.totalSettled = record.cashPaid + record.whtCredited + record.discountCredited;
        record.remainingBalance = Math.max(0, record.totalAmount - record.totalSettled);
        record.balanceRemaining = record.remainingBalance;
        record.whtDeducted = record.whtCredited;
        remainingNeeded.set(pay.invoiceId, record.remainingBalance);

        if (!record.linkedPayments.some(p => p.id === pay.id)) {
          record.linkedPayments.push(pay);
        }

        record.allocations.push({
          paymentId: pay.id,
          paymentReference: (pay as any).reference || (pay as any).paymentNumber || pay.invoiceNumber || undefined,
          paymentDate: pay.date,
          settledAmount: cash + wht + disc,
          cashAmount: cash,
          whtAmount: wht,
          discountAmount: disc,
          isAdvanceOrHistoricalFifo: false,
        });

        paymentConsumed = true;
      }
    }

    if (!paymentConsumed) {
      unallocatedPayments.push(pay);
    }
  });

  // 3. Process Legacy / Unallocated Payments with FIFO Waterfall per (Client, Site)
  // Group unallocated payments by client + site, sorted chronologically
  const sitePaymentsGroup = new Map<string, Payment[]>();
  unallocatedPayments.forEach(p => {
    const key = `${norm(p.client)}__${norm(p.site)}`;
    if (!sitePaymentsGroup.has(key)) sitePaymentsGroup.set(key, []);
    sitePaymentsGroup.get(key)!.push(p);
  });

  sitePaymentsGroup.forEach(list => {
    list.sort((a, b) => {
      const dateA = a.date ? new Date(normalizeDate(a.date)).getTime() : 0;
      const dateB = b.date ? new Date(normalizeDate(b.date)).getTime() : 0;
      return dateA - dateB;
    });
  });

  // Group invoices by client + site, sorted chronologically
  const siteInvoicesGroup = new Map<string, (Invoice | PendingInvoice)[]>();
  allInvoices.forEach(i => {
    const siteName = (i as any).siteName || (i as any).site || (i as any).project || '';
    const key = `${norm(i.client)}__${norm(siteName)}`;
    if (!siteInvoicesGroup.has(key)) siteInvoicesGroup.set(key, []);
    siteInvoicesGroup.get(key)!.push(i);
  });

  siteInvoicesGroup.forEach(list => {
    list.sort((a, b) => {
      const dateA = (a as any).date || (a as any).startDate || '';
      const dateB = (b as any).date || (b as any).startDate || '';
      return new Date(normalizeDate(dateA)).getTime() - new Date(normalizeDate(dateB)).getTime();
    });
  });

  // Waterfall FIFO allocation for unallocated payments
  siteInvoicesGroup.forEach((invoices, key) => {
    const payments = sitePaymentsGroup.get(key) || [];
    if (payments.length === 0) return;

    let pIdx = 0;
    let availableCash = Number(payments[0]?.amount || 0);
    let availableWht = Number(payments[0]?.withholdingTax || 0);
    let availableDisc = Number(payments[0]?.discount || 0);

    for (const inv of invoices) {
      const record = settlementMap.get(inv.id);
      if (!record) continue;

      let needed = remainingNeeded.get(inv.id) || 0;
      if (needed <= 0.01) continue; // Already settled

      while (needed > 0.01 && pIdx < payments.length) {
        const curPay = payments[pIdx];
        const totalAvailInCurPay = availableCash + availableWht + availableDisc;

        if (totalAvailInCurPay <= 0.001) {
          pIdx++;
          if (pIdx < payments.length) {
            availableCash = Number(payments[pIdx]?.amount || 0);
            availableWht = Number(payments[pIdx]?.withholdingTax || 0);
            availableDisc = Number(payments[pIdx]?.discount || 0);
          }
          continue;
        }

        const allocTotal = Math.min(needed, totalAvailInCurPay);
        const cashRatio = totalAvailInCurPay > 0 ? availableCash / totalAvailInCurPay : 1;
        const whtRatio = totalAvailInCurPay > 0 ? availableWht / totalAvailInCurPay : 0;
        const discRatio = totalAvailInCurPay > 0 ? availableDisc / totalAvailInCurPay : 0;

        const allocCash = allocTotal * cashRatio;
        const allocWht = allocTotal * whtRatio;
        const allocDisc = allocTotal * discRatio;

        record.cashPaid += allocCash;
        record.whtCredited += allocWht;
        record.discountCredited += allocDisc;
        record.totalSettled = record.cashPaid + record.whtCredited + record.discountCredited;
        record.remainingBalance = Math.max(0, record.totalAmount - record.totalSettled);
        record.balanceRemaining = record.remainingBalance;
        record.whtDeducted = record.whtCredited;
        needed = record.remainingBalance;
        remainingNeeded.set(inv.id, needed);

        availableCash -= allocCash;
        availableWht -= allocWht;
        availableDisc -= allocDisc;

        if (!record.linkedPayments.some(p => p.id === curPay.id)) {
          record.linkedPayments.push(curPay);
        }

        record.allocations.push({
          paymentId: curPay.id,
          paymentReference: (curPay as any).reference || (curPay as any).paymentNumber || curPay.invoiceNumber || undefined,
          paymentDate: curPay.date,
          settledAmount: allocTotal,
          cashAmount: allocCash,
          whtAmount: allocWht,
          discountAmount: allocDisc,
          isAdvanceOrHistoricalFifo: true,
        });

        if (availableCash + availableWht + availableDisc <= 0.001) {
          pIdx++;
          if (pIdx < payments.length) {
            availableCash = Number(payments[pIdx]?.amount || 0);
            availableWht = Number(payments[pIdx]?.withholdingTax || 0);
            availableDisc = Number(payments[pIdx]?.discount || 0);
          }
        }
      }
    }
  });

  // 4. Finalize Status and Rounded Values
  const now = Date.now();
  settlementMap.forEach((record, invId) => {
    const inv = allInvoices.find(i => i.id === invId);
    record.isPaid = record.remainingBalance <= 0.01 && record.totalAmount > 0;
    record.totalBilled = record.totalAmount;
    record.whtDeducted = record.whtCredited;
    record.balanceRemaining = record.remainingBalance;

    if (record.isPaid) {
      record.status = 'Paid';
    } else if (record.totalSettled > 0) {
      record.status = 'Partially Paid';
    } else {
      const dueDateStr = (inv as any)?.dueDate || (inv as any)?.endDate || '';
      const isOverdue = dueDateStr && new Date(normalizeDate(dueDateStr)).getTime() < now;
      if (isOverdue) {
        record.status = 'Overdue';
      } else {
        record.status = ((inv as any)?.status as any) || 'Sent';
      }
    }
  });

  return settlementMap;
}

/**
 * Fast helper to get settlement details for a single invoice.
 */
export function getInvoiceSettlement(
  invoice: Invoice | PendingInvoice,
  allInvoices: (Invoice | PendingInvoice)[],
  allPayments: Payment[]
): InvoiceSettlement {
  const map = buildSettlementMap(allInvoices, allPayments);
  const totalAmt = Number(invoice.totalCharge || (invoice as any).amount || 0);
  return map.get(invoice.id) || {
    invoiceId: invoice.id,
    invoiceNumber: (invoice as any).invoiceNumber || (invoice as any).invoiceNo || invoice.id,
    totalAmount: totalAmt,
    cashPaid: 0,
    whtCredited: 0,
    discountCredited: 0,
    totalSettled: 0,
    remainingBalance: totalAmt,
    isPaid: false,
    status: ((invoice as any).status as any) || 'Sent',
    linkedPayments: [],
    totalBilled: totalAmt,
    whtDeducted: 0,
    balanceRemaining: totalAmt,
    allocations: [],
  };
}

/**
 * Returns all open/unsettled invoices for a specific client & site.
 * Sorted chronologically (oldest first) so users can allocate payments sequentially.
 */
export function getSiteOpenInvoices(
  siteName: string,
  clientName: string,
  allInvoices: (Invoice | PendingInvoice)[],
  allPayments: Payment[]
): OpenInvoiceItem[] {
  const targetClient = norm(clientName);
  const targetSite = norm(siteName);

  const siteInvoices = allInvoices.filter(i => {
    const c = norm(i.client);
    const s = norm((i as any).siteName || (i as any).site || (i as any).project || '');
    return c === targetClient && s === targetSite;
  });

  const settlementMap = buildSettlementMap(allInvoices, allPayments);

  return siteInvoices
    .map(inv => {
      const settlement = settlementMap.get(inv.id);
      const totalAmount = settlement ? settlement.totalAmount : Number(inv.totalCharge || (inv as any).amount || 0);
      const totalSettled = settlement ? settlement.totalSettled : 0;
      const remainingBalance = settlement ? settlement.remainingBalance : totalAmount;
      const status = settlement ? settlement.status : 'Sent';

      return {
        id: inv.id,
        invoiceNumber: (inv as any).invoiceNumber || (inv as any).invoiceNo || inv.id,
        date: (inv as any).date || (inv as any).startDate || '',
        dueDate: (inv as any).dueDate || (inv as any).endDate || '',
        totalAmount,
        totalSettled,
        remainingBalance,
        status,
        vatInc: (inv as any).vatInc,
      };
    })
    .filter(item => item.remainingBalance > 0.01)
    .sort((a, b) => {
      const dateA = a.date ? new Date(normalizeDate(a.date)).getTime() : 0;
      const dateB = b.date ? new Date(normalizeDate(b.date)).getTime() : 0;
      return dateA - dateB;
    });
}
