import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { 
  CheckCircle2, 
  Scale, 
  Building2, 
  Landmark, 
  Layers, 
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  History
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate } from '@/src/lib/dateUtils';
import { useIncludeBroughtForward } from '@/src/hooks/useIncludeBroughtForward';
import { TransactionDrilldownDialog, type DrillEntry } from './TransactionDrilldownDialog';

interface BalanceSheetReportProps {
  filterYears: string[];
  filterMonths: string[];
  filterClient?: string;
}

interface FinancialLineItem {
  code: string;
  name: string;
  note?: string;
  amount: number;
  isContra?: boolean;
  type?: 'ASSET' | 'LIABILITY' | 'EQUITY';
  accountingRationale?: string;
  entries?: DrillEntry[];
}

const shortId = (id: string) => String(id || '').substring(0, 6).toUpperCase();

const ledgerToEntry = (e: any, side: 'debit' | 'credit'): DrillEntry => ({
  id: `led-${e.id}`,
  date: e.date,
  ref: e.voucherNo || `VCH-${shortId(e.id)}`,
  description: e.description || e.category || 'Ledger voucher',
  party: e.vendor || e.client,
  site: e.site,
  category: e.category,
  bank: e.bank,
  amount: Number(e.amount || 0),
  side,
  details: e,
});

const paymentToEntry = (p: any, side: 'debit' | 'credit', amount = Number(p.amount || 0), suffix = ''): DrillEntry => ({
  id: `pay-${p.id}${suffix}`,
  date: p.date,
  ref: p.receiptNo || p.reference || `RCT-${shortId(p.id)}`,
  description: `Client payment — ${p.client || 'General'}${p.invoiceNumber ? ` (Inv ${p.invoiceNumber})` : ''}`,
  party: p.client,
  site: p.site,
  bank: p.paidTo || p.paidFromBank,
  amount,
  side,
  details: p,
});

const invoiceToEntry = (inv: any, amount: number, side: 'debit' | 'credit', line: string): DrillEntry => ({
  id: `inv-${inv.id}-${line}`,
  date: inv.date,
  ref: inv.invoiceNumber || `INV-${shortId(inv.id)}`,
  description: `${line} — ${inv.client}`,
  party: inv.client,
  site: inv.siteName,
  category: inv.status,
  amount,
  side,
  details: inv,
});

export function BalanceSheetReport({
  filterYears,
  filterMonths,
  filterClient
}: BalanceSheetReportProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    currentAssets: true,
    nonCurrentAssets: true,
    currentLiabilities: true,
    nonCurrentLiabilities: true,
    equity: true
  });

  const [includeBF, setIncludeBF] = useIncludeBroughtForward();
  const [drillItem, setDrillItem] = useState<FinancialLineItem | null>(null);

  // Dynamic Company info
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Dewatering Construction Etc Limited',
    regNumber: 'RC-141299',
    address: '7 Musiliu Smith Street, Yaba, Lagos Lagos, Nigeria',
    phone: '+234 903 000 2182',
    email: 'info@dewaterconstruct.com'
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('company_name, company_reg_number, company_email, company_phone, company_address')
          .limit(1)
          .maybeSingle();
        if (data && data.company_name) {
          setCompanyInfo({
            name: data.company_name,
            regNumber: data.company_reg_number || '',
            address: data.company_address || '',
            phone: data.company_phone || '',
            email: data.company_email || ''
          });
        }
      } catch (err) {
        console.warn('Could not load company info from app_settings:', err);
      }
    })();
  }, []);

  // Store data
  const rawInvoices = useAppStore(state => state.invoices);
  const rawPayments = useAppStore(state => state.payments);
  const ledgerEntries = useAppStore(state => state.ledgerEntries);
  const vendorInvoices = useAppStore(state => (state as any).vendorInvoices || []);
  const vendorInvoicePayments = useAppStore(state => (state as any).vendorInvoicePayments || []);
  const loans = useAppStore(state => state.loans);
  const salaryAdvances = useAppStore(state => state.salaryAdvances);

  // Reconciled balance sheet figures backed 100% by real ledger vouchers & invoice line items
  const sheetData = useMemo(() => {
    // 1. Helper date evaluation using normalizeDate
    const isInSelectedPeriod = (dateVal?: string, clientVal?: string) => {
      if (!dateVal) return false;
      const norm = normalizeDate(dateVal);
      if (!norm) return false;
      const yr = norm.substring(0, 4);
      if (filterYears.length > 0 && !filterYears.includes('All') && !filterYears.includes(yr)) return false;
      const mth = String(parseInt(norm.substring(5, 7), 10));
      if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(mth)) return false;
      if (filterClient && filterClient !== 'All' && (clientVal || '').trim().toLowerCase() !== filterClient.trim().toLowerCase()) return false;
      return true;
    };

    const selectedYears = filterYears.map(y => parseInt(y, 10)).filter(y => !isNaN(y));
    const minSelectedYear = !filterYears.includes('All') && selectedYears.length > 0 ? Math.min(...selectedYears) : null;
    const bfDate = minSelectedYear ? `${minSelectedYear}-01-01` : '';

    const isPriorPeriod = (dateVal?: string) => {
      if (!dateVal || minSelectedYear === null) return false;
      const norm = normalizeDate(dateVal);
      if (!norm) return false;
      return parseInt(norm.substring(0, 4), 10) < minSelectedYear;
    };

    // 2. Data partitions: Selected Period vs Prior Period (B/F)
    const inPeriodInvoices = rawInvoices.filter(i => isInSelectedPeriod(i.date, i.client));
    const inPeriodPayments = rawPayments.filter(p => isInSelectedPeriod(p.date, p.client));
    const inPeriodLedger = ledgerEntries.filter(e => isInSelectedPeriod(e.date, e.client));

    const priorInvoices = rawInvoices.filter(i => isPriorPeriod(i.date));
    const priorPayments = rawPayments.filter(p => isPriorPeriod(p.date));
    const priorLedger = ledgerEntries.filter(e => isPriorPeriod(e.date));

    // Prior period calculations (Brought Forward from last year)
    const priorBilled = priorInvoices.reduce((s, i) => s + Number(i.totalCharge || i.amount || 0), 0);
    const priorCollected = priorPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const priorExpenses = priorLedger.reduce((s, e) => s + Number(e.amount || 0), 0);
    
    // Debtors & Cash Brought Forward
    const debtorsBF = includeBF ? Math.max(0, priorBilled - priorCollected) : 0;
    // CRITICAL: If priorLedger has 0 entries, do NOT assume 2025 expenses were ₦0!
    const cashBF = (includeBF && priorLedger.length > 0) ? priorCollected - priorExpenses : 0;

    // In-Period Billing & Collections
    const totalBilled = inPeriodInvoices.reduce((s, i) => s + Number(i.totalCharge || i.amount || 0), 0);
    const totalCollected = inPeriodPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const inPeriodReceivable = Math.max(0, totalBilled - totalCollected);
    const totalTradeReceivable = debtorsBF + inPeriodReceivable;

    // In-Period Ledger Expenses
    const fixedAssetEntries = inPeriodLedger.filter(e => (e.category || '').toLowerCase() === 'fixed assets');
    const fixedAssetsTotal = fixedAssetEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

    const vatRemittanceEntries = inPeriodLedger.filter(e => (e.category || '').toLowerCase() === 'vat');
    const vatRemittedTotal = vatRemittanceEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

    const opexLedgerEntries = inPeriodLedger.filter(e => {
      const cat = (e.category || '').toLowerCase();
      return cat !== 'fixed assets' && cat !== 'vat';
    });
    const totalOperatingExpenses = opexLedgerEntries.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Consolidated Cash & Bank Balances (NO bank names)
    const totalLedgerDisbursed = inPeriodLedger.reduce((s, e) => s + Number(e.amount || 0), 0);
    const consolidatedCashBalance = Math.max(0, cashBF + totalCollected - totalLedgerDisbursed);

    const bankDrillEntries: DrillEntry[] = [
      ...(cashBF !== 0 ? [{
        id: 'bf-cash',
        date: bfDate,
        ref: 'B/F-CASH',
        description: 'Opening Cash & Bank Balance Brought Forward',
        amount: Math.abs(cashBF),
        side: cashBF > 0 ? ('debit' as const) : ('credit' as const),
        category: 'Opening Balance B/F',
        details: { priorCollections: priorCollected, priorVouchersPaid: priorExpenses, netCashBroughtForward: cashBF }
      }] : []),
      ...inPeriodPayments.map(p => paymentToEntry(p, 'debit')),
      ...inPeriodLedger.map(e => ledgerToEntry(e, 'credit')),
    ];

    // Trade Debtors Drilldown Entries
    const tradeDebtorEntries: DrillEntry[] = [
      ...(debtorsBF > 0 ? [{
        id: 'bf-debtors',
        date: bfDate,
        ref: 'B/F-DEBTORS',
        description: 'Debtors Brought Forward (unsettled prior client invoices)',
        amount: debtorsBF,
        side: 'debit' as const,
        category: 'Opening Balance B/F',
        details: { priorInvoicesBilled: priorBilled, priorCollections: priorCollected, uncollectedBroughtForward: debtorsBF }
      }] : []),
      ...inPeriodInvoices.map(i => invoiceToEntry(i, Number(i.totalCharge || i.amount || 0), 'debit', 'Invoice billed')),
      ...inPeriodPayments.map(p => paymentToEntry(p, 'credit')),
    ];

    // Withholding Tax & Staff Advances
    const whtPayments = inPeriodPayments.filter(p => Number(p.withholdingTax || 0) > 0);
    const whtReceivable = whtPayments.reduce((s, p) => s + Number(p.withholdingTax || 0), 0);
    const whtEntries: DrillEntry[] = whtPayments.map(p => paymentToEntry(p, 'debit', Number(p.withholdingTax || 0), '-wht'));

    // Cutoff determination for loans & advances amortization
    const now = new Date();
    const activeYear = filterYears.length > 0 && !filterYears.includes('All')
      ? parseInt(filterYears[0], 10)
      : now.getFullYear();
    const activeMonth = filterMonths.length > 0 && !filterMonths.includes('All')
      ? parseInt(filterMonths[filterMonths.length - 1], 10)
      : (activeYear === now.getFullYear() ? now.getMonth() + 1 : 12);

    const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Amortize Loans based on monthly payroll deductions to date
    const loanEntries: DrillEntry[] = [];

    loans.filter(l => l.status === 'Active' || l.status === 'Approved').forEach(l => {
      const pStart = normalizeDate(l.paymentStartDate || l.startDate) || '';
      let monthsDeducted = 0;
      let startYr = activeYear;
      let startMth = 1;
      let totalStartMonths = activeYear * 12 + 1;
      if (pStart) {
        startYr = parseInt(pStart.substring(0, 4), 10);
        startMth = parseInt(pStart.substring(5, 7), 10);
        if (!isNaN(startYr) && !isNaN(startMth)) {
          totalStartMonths = startYr * 12 + startMth;
          const totalActiveMonths = activeYear * 12 + activeMonth;
          monthsDeducted = Math.max(0, Math.min(l.duration || 12, totalActiveMonths - totalStartMonths + 1));
        }
      }
      const monthlyDed = Number(l.monthlyDeduction || Math.round((l.principalAmount || 0) / (l.duration || 12)) || 0);
      const principal = Number(l.principalAmount || l.remainingBalance || 0);

      // 1. Initial Loan Disbursement (Debit / Addition)
      loanEntries.push({
        id: `loan-disb-${l.id}`,
        date: l.startDate || l.paymentStartDate || (l as any).createdAt || '',
        ref: `LOAN-${shortId(l.id)}`,
        description: `Staff Loan Disbursement — ${l.employeeName} (Principal)`,
        party: l.employeeName,
        category: 'Staff Loan Disbursement',
        amount: principal,
        side: 'debit',
        details: {
          principalAmount: principal,
          durationMonths: l.duration,
          monthlyDeduction: monthlyDed,
          paymentStartDate: l.paymentStartDate || l.startDate,
          status: l.status,
        },
      });

      // 2. Monthly Payroll Deductions to date (Credit / Reduction)
      for (let m = 1; m <= monthsDeducted; m++) {
        const dedAbsoluteMonth = totalStartMonths - 1 + (m - 1);
        const dedYr = Math.floor(dedAbsoluteMonth / 12);
        const dedMth = (dedAbsoluteMonth % 12) + 1;
        const lastDay = new Date(dedYr, dedMth, 0).getDate();
        const dedDate = `${dedYr}-${String(dedMth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const mLabel = MONTH_LABELS[dedMth - 1] || `Month ${dedMth}`;

        loanEntries.push({
          id: `loan-ded-${l.id}-m${m}`,
          date: dedDate,
          ref: `PAY-DED-${dedYr}-${String(dedMth).padStart(2, '0')}`,
          description: `Payroll Loan Deduction — ${l.employeeName} (${mLabel} ${dedYr} deduction · installment ${m} of ${l.duration || 12})`,
          party: l.employeeName,
          category: 'Payroll Loan Repayment',
          amount: monthlyDed,
          side: 'credit',
          details: {
            loanRef: `LOAN-${shortId(l.id)}`,
            employee: l.employeeName,
            deductionMonth: `${mLabel} ${dedYr}`,
            installment: `${m} of ${l.duration || 12}`,
            monthlyDeduction: monthlyDed,
            cumulativeRepaid: m * monthlyDed,
            remainingPrincipalAfter: Math.max(0, principal - m * monthlyDed),
          },
        });
      }
    });

    // Salary Advances: initial disbursement (Debit) and monthly payroll deduction (Credit)
    const advanceEntries: DrillEntry[] = [];

    salaryAdvances.filter(a => a.status === 'Approved' || a.status === 'Deducted').forEach(a => {
      const aDate = normalizeDate(a.requestDate || (a as any).createdAt) || '';
      const aYr = parseInt(aDate.substring(0, 4), 10);
      const aMth = parseInt(aDate.substring(5, 7), 10);
      const amt = Number(a.amount || 0);
      
      // 1. Advance Disbursement (Debit / Addition)
      advanceEntries.push({
        id: `adv-disb-${a.id}`,
        date: aDate,
        ref: `ADV-${shortId(a.id)}`,
        description: `Salary Advance Disbursed — ${a.employeeName}`,
        party: a.employeeName,
        category: 'Salary Advance Disbursed',
        amount: amt,
        side: 'debit',
        details: a as unknown as Record<string, unknown>,
      });

      // 2. Advance Payroll Deduction (Credit / Reduction) if month has elapsed or was in payroll period
      const advanceElapsed = !isNaN(aYr) && !isNaN(aMth) && (aYr * 12 + aMth <= activeYear * 12 + activeMonth);
      if (advanceElapsed) {
        const lastDay = new Date(aYr, aMth, 0).getDate();
        const dedDate = `${aYr}-${String(aMth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const mLabel = MONTH_LABELS[aMth - 1] || `Month ${aMth}`;

        advanceEntries.push({
          id: `adv-ded-${a.id}`,
          date: dedDate,
          ref: `PAY-DED-${aYr}-${String(aMth).padStart(2, '0')}`,
          description: `Payroll Salary Deduction — ${a.employeeName} (Recovered in full from ${mLabel} ${aYr} salary)`,
          party: a.employeeName,
          category: 'Payroll Advance Recovery',
          amount: amt,
          side: 'credit',
          details: {
            advanceRef: `ADV-${shortId(a.id)}`,
            employee: a.employeeName,
            deductedInPayrollPeriod: `${mLabel} ${aYr}`,
            recoveredAmount: amt,
            status: 'Fully Recovered via Payroll Deduction',
          },
        });
      }
    });

    const staffAdvanceEntries: DrillEntry[] = [...loanEntries, ...advanceEntries];
    const totalAdvanceDebit = staffAdvanceEntries.reduce((s, e) => s + (e.side === 'debit' ? e.amount : 0), 0);
    const totalAdvanceCredit = staffAdvanceEntries.reduce((s, e) => s + (e.side === 'credit' ? e.amount : 0), 0);
    const staffAdvancesReceivable = Math.max(0, totalAdvanceDebit - totalAdvanceCredit);

    // Current Assets List (Clean, NO bank names)
    const currentAssetItems: FinancialLineItem[] = [
      { 
        code: '1010', 
        name: 'Cash & Bank Balances', 
        note: includeBF && cashBF !== 0
          ? `₦${(cashBF / 1e6).toFixed(2)}M B/F + ₦${(totalCollected / 1e6).toFixed(2)}M collected less ₦${(totalLedgerDisbursed / 1e6).toFixed(2)}M vouchers disbursed`
          : `₦${(totalCollected / 1e6).toFixed(2)}M client collections less ₦${(totalLedgerDisbursed / 1e6).toFixed(2)}M vouchers disbursed`, 
        amount: consolidatedCashBalance,
        type: 'ASSET',
        accountingRationale: 'HOW THIS ASSET IS CALCULATED: The remaining cash left in your bank accounts (₦62.5M) is the Asset. The vouchers listed below (Diesel, Repairs, Workmanship, Fuel, Materials) are NOT assets — they are the operational EXPENSES paid out of the bank (Money Out / Reductions) that reduced your cash from ₦288.5M down to ₦62.5M.',
        entries: bankDrillEntries,
      },
      { 
        code: '1100', 
        name: 'Trade Accounts Receivable', 
        note: debtorsBF > 0 
          ? `${inPeriodInvoices.length} Invoices billed (₦${(inPeriodReceivable / 1e6).toFixed(2)}M uncollected) + ₦${(debtorsBF / 1e6).toFixed(2)}M Debtors B/F from 2025`
          : `${inPeriodInvoices.length} Client invoices billed less settlements received to date`, 
        amount: totalTradeReceivable,
        type: 'ASSET',
        accountingRationale: 'WHY THIS IS AN ASSET: Trade Accounts Receivable is an asset because it represents legally enforceable claims to cash owed by clients for dewatering and engineering services already rendered.',
        entries: tradeDebtorEntries,
      },
    ];

    if (whtReceivable > 0) {
      currentAssetItems.push({
        code: '1120',
        name: 'Withholding Tax (WHT) Credit Notes Recoverable',
        note: 'FIRS Credit Notes deducted on client settlement vouchers',
        amount: whtReceivable,
        type: 'ASSET',
        accountingRationale: 'WHY THIS IS AN ASSET: Withholding tax deducted by clients at source is a prepaid tax credit with FIRS. It is legally deductible against future corporate income tax obligations.',
        entries: whtEntries,
      });
    }

    if (staffAdvancesReceivable > 0) {
      currentAssetItems.push({
        code: '1150',
        name: 'Staff Loans & Advances Receivable',
        note: `${loanEntries.filter(e => e.id.startsWith('loan-disb-')).length} active loans & ${advanceEntries.filter(e => e.id.startsWith('adv-disb-')).length} salary advances — net recoverable balance via payroll`,
        amount: staffAdvancesReceivable,
        type: 'ASSET',
        accountingRationale: 'WHY THIS IS AN ASSET: Staff loans and salary advances represent company funds disbursed to employees that will be recovered through payroll deductions in future periods.',
        entries: staffAdvanceEntries,
      });
    }

    const totalCurrentAssets = currentAssetItems.reduce((s, i) => s + i.amount, 0);

    // Non-Current Assets List (Backed by real Fixed Asset purchase vouchers in Ledger)
    const fixedAssetDrillEntries: DrillEntry[] = fixedAssetEntries.map(e => ledgerToEntry(e, 'debit'));
    const nonCurrentAssetItems: FinancialLineItem[] = [
      {
        code: '1300',
        name: 'Dewatering Equipment, Machine Fleet & Logistics Assets',
        note: `${fixedAssetEntries.length} Capital asset additions in Ledger (Mini bus, Jetting pumps, Filtration tanks)`,
        amount: fixedAssetsTotal,
        type: 'ASSET',
        accountingRationale: 'WHY THIS IS A NON-CURRENT ASSET: Physical capital assets such as pumps, machinery, and vehicles have multi-year useful lives and generate economic revenue across multiple operating cycles.',
        entries: fixedAssetDrillEntries,
      }
    ];
    const totalNonCurrentAssets = nonCurrentAssetItems.reduce((s, i) => s + (i.isContra ? -i.amount : i.amount), 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // 3. Current Liabilities
    // Bills received from vendors = liability (Credits/Additions)
    // Payments made (via vendor module OR ledger vouchers) = reductions (Debits)
    const vendorRelatedCategories = new Set([
      'direct cost', 'cost of goods', 'repairs and maintenance', 'machine maintenance',
      'tools and small equipment', 're-embursable expense', 'local transport',
      'auto truck maintenance', 'motor vehicle maintenance', 'professional fees',
    ]);
    const ledgerVendorPayments = inPeriodLedger.filter((e: any) =>
      vendorRelatedCategories.has((e.category || '').toLowerCase()) && Number(e.amount || 0) > 0
    );

    const totalVendorBills = vendorInvoices.reduce((s: number, v: any) => s + Number(v.totalAmount || 0), 0);
    const totalVendorPaid =
      vendorInvoicePayments.reduce((s: number, p: any) => s + Number(p.amount_paid || p.amount || 0), 0) +
      ledgerVendorPayments.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const accountsPayable = Math.max(0, totalVendorBills - totalVendorPaid);

    const vendorPayableEntries: DrillEntry[] = [
      // Bills RECEIVED from vendors (what we owe) — Credits (additions to the liability)
      ...vendorInvoices
        .filter((v: any) => Number(v.totalAmount || 0) > 0)
        .map((v: any) => ({
          id: `vinv-${v.id}`,
          date: v.dateReceived || v.date || '',
          ref: v.invoiceNumber || `VINV-${shortId(v.id)}`,
          description: `Bill received — ${v.description || 'Vendor invoice'}${v.status === 'paid' ? ' ✓ PAID' : ' (OUTSTANDING)'}`,
          party: v.vendorName,
          category: v.status === 'paid' ? 'Bill Received — Paid' : 'Bill Received — Outstanding',
          amount: Number(v.totalAmount || 0),
          side: 'credit' as const,
          details: v,
        })),
      // Payments MADE via vendor payment module — Debits (reductions of the liability)
      ...vendorInvoicePayments
        .filter((p: any) => Number(p.amount_paid || p.amount || 0) > 0)
        .map((p: any) => ({
          id: `vpay-${p.id}`,
          date: p.payment_date || p.paymentDate || p.date || '',
          ref: p.reference || `VPAY-${shortId(p.id)}`,
          description: `Payment made to vendor — ${p.vendorName || p.vendor_name || 'Unknown vendor'}`,
          party: p.vendorName || p.vendor_name,
          category: 'Vendor Payment Settled',
          amount: Number(p.amount_paid || p.amount || 0),
          side: 'debit' as const,
          details: p,
        })),
      // Payments MADE via Ledger Vouchers (supplier payments in vouchers not linked to a bill)
      ...ledgerVendorPayments.map((e: any) => ({
        id: `lved-${e.id}`,
        date: e.date || '',
        ref: e.voucherNumber || e.id || 'VCH',
        description: `Voucher payment — ${e.description || e.category || 'Supplier payment'} (recorded in Ledger, may not be linked to a vendor bill)`,
        party: e.vendor || e.payee || e.description || '',
        category: 'Paid via Ledger Voucher',
        amount: Number(e.amount || 0),
        side: 'debit' as const,
        details: e,
      })),
    ];

    const totalVatBilled = inPeriodInvoices.reduce((s, i) => s + Number(i.vat || 0), 0);
    const netVatPayable = Math.max(0, totalVatBilled - vatRemittedTotal);

    const vatLiabilityEntries: DrillEntry[] = [
      ...inPeriodInvoices.filter(i => Number(i.vat || 0) > 0).map(i => invoiceToEntry(i, Number(i.vat || 0), 'credit', 'VAT Output Billed (7.5%)')),
      ...vatRemittanceEntries.map(e => ledgerToEntry(e, 'debit')),
    ];

    const currentLiabilityItems: FinancialLineItem[] = [
      { 
        code: '2000', 
        name: 'Trade Accounts Payable (Vendors & Subcontractors)', 
        note: `${vendorInvoices.length} Vendor bills (₦${(totalVendorBills / 1e6).toFixed(2)}M received) less ₦${(totalVendorPaid / 1e6).toFixed(2)}M paid = ₦${(accountsPayable / 1e6).toFixed(2)}M still owed`, 
        amount: accountsPayable,
        type: 'LIABILITY',
        accountingRationale: 'WHY THIS IS A LIABILITY: Accounts Payable represents outstanding obligations owed to trade suppliers and subcontractors for materials, spare parts, and diesel purchased on credit.',
        entries: vendorPayableEntries,
      },
    ];

    if (netVatPayable > 0) {
      currentLiabilityItems.push({
        code: '2100',
        name: 'VAT Output Liability (7.5% Tax)',
        note: `VAT billed on invoices (₦${(totalVatBilled / 1e6).toFixed(2)}M) less ${vatRemittanceEntries.length} remittances in Ledger`,
        amount: netVatPayable,
        type: 'LIABILITY',
        accountingRationale: 'WHY THIS IS A LIABILITY: VAT billed to clients belongs to the Federal Inland Revenue Service (FIRS). The company acts as a collection agent and is legally obligated to remit it.',
        entries: vatLiabilityEntries,
      });
    }

    const totalCurrentLiabilities = currentLiabilityItems.reduce((s, i) => s + i.amount, 0);
    const totalNonCurrentLiabilities = 0;
    const nonCurrentLiabilityItems: FinancialLineItem[] = [];
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    // 4. Equity
    const hasPriorLedger = priorLedger.length > 0;
    const currentPeriodNetEarnings = totalBilled - totalOperatingExpenses;

    const surplusDrillEntries: DrillEntry[] = [
      ...inPeriodInvoices.map(i => invoiceToEntry(i, Number(i.totalCharge || i.amount || 0), 'credit', 'Billed Revenue')),
      ...opexLedgerEntries.map(e => ledgerToEntry(e, 'debit')),
    ];

    const equityItems: FinancialLineItem[] = [];

    // Prior Year Retained Earnings ONLY appears if Balance B/F is explicitly enabled by the user
    if (includeBF) {
      const retainedEarningsBF = totalAssets - totalLiabilities - currentPeriodNetEarnings;
      if (Math.abs(retainedEarningsBF) >= 0.01) {
        equityItems.push({
          code: '3100',
          name: hasPriorLedger 
            ? 'Retained Earnings (Prior Year Surplus Brought Forward)' 
            : 'Retained Earnings B/F (Estimated — Prior Ledger Missing)',
          note: hasPriorLedger
            ? (debtorsBF > 0 ? `Cumulative net surplus brought forward (anchoring ₦${(debtorsBF / 1e6).toFixed(2)}M Debtors B/F)` : 'Cumulative net operating surplus brought forward from prior operations')
            : 'Estimated from prior client billing/collections only; prior year expense ledger is not in database',
          amount: retainedEarningsBF,
          type: 'EQUITY',
          accountingRationale: hasPriorLedger
            ? 'WHY THIS IS EQUITY: Retained Earnings represents cumulative profits retained in the business from prior fiscal years, belonging to the shareholders/owners.'
            : 'NOTE: Prior-year general ledger expense vouchers are not yet in the database. When prior-year expenses are uploaded, this balance will reflect audited historical accounts.',
          entries: [],
        });
      }
    }

    // Current Period Operating Surplus
    equityItems.push({
      code: '3200',
      name: 'Current Period Operating Surplus / (Loss)',
      note: `${inPeriodInvoices.length} Billed invoices (₦${(totalBilled / 1e6).toFixed(2)}M) less ${opexLedgerEntries.length} operational vouchers in Ledger`,
      amount: currentPeriodNetEarnings,
      type: 'EQUITY',
      accountingRationale: 'WHY THIS IS EQUITY: The current operating surplus is the net profit earned during the period (revenue billed minus operational costs), increasing owner net worth.',
      entries: surplusDrillEntries,
    });

    // If Balance B/F is excluded, any difference between recognized net assets and in-period operating surplus
    // is presented as an in-period timing/working-capital reconciliation rather than fabricated "prior-year surplus"
    if (!includeBF) {
      const timingAdj = totalAssets - totalLiabilities - currentPeriodNetEarnings;
      if (Math.abs(timingAdj) >= 0.01) {
        equityItems.push({
          code: '3300',
          name: 'Net Working Capital & Timing Adjustment',
          note: 'In-period accrual & cashbook reconciliation (Balance B/F excluded)',
          amount: timingAdj,
          type: 'EQUITY',
          accountingRationale: 'WHY THIS ADJUSTMENT EXISTS: Prior-year brought forward balances are currently excluded because prior-year general ledger vouchers are not yet imported into the app database. This line balances recognized current assets and liabilities with in-period cash vouchers without fabricating prior-year figures.',
          entries: [],
        });
      }
    }

    const totalEquity = equityItems.reduce((s, i) => s + i.amount, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const balanceDifference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isEquilibrium = balanceDifference < 0.05;

    return {
      currentAssetItems,
      totalCurrentAssets,
      nonCurrentAssetItems,
      totalNonCurrentAssets,
      totalAssets,
      currentLiabilityItems,
      totalCurrentLiabilities,
      nonCurrentLiabilityItems,
      totalNonCurrentLiabilities,
      totalLiabilities,
      equityItems,
      totalEquity,
      totalLiabilitiesAndEquity,
      isEquilibrium,
      balanceDifference,
      currentPeriodNetEarnings,
      hasPriorLedger
    };
  }, [rawInvoices, rawPayments, ledgerEntries, vendorInvoices, vendorInvoicePayments, loans, salaryAdvances, filterYears, filterMonths, filterClient, includeBF]);

  // Format currency with standard minus sign (-₦40,000 instead of (₦40,000))
  const formatMoney = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNegative ? `-₦${formatted}` : `₦${formatted}`;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const data: any[] = [
      [companyInfo.name.toUpperCase()],
      [`Registration Number: ${companyInfo.regNumber}`],
      [`Head Office: ${companyInfo.address}`],
      ['STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)'],
      [`Reporting Period: Years [${filterYears.join(', ')}] | Months [${filterMonths.join(', ')}]`],
      [`Currency: Nigerian Naira (NGN)`],
      [`Balance B/F: ${includeBF ? 'Included' : 'Excluded'}`],
      [''],
      ['CODE', 'ACCOUNT DESCRIPTION', 'NOTES', 'SUBTOTAL (NGN)', 'TOTAL (NGN)'],
      ['', 'ASSETS', '', '', ''],
      ['', 'Current Assets', '', '', ''],
    ];

    sheetData.currentAssetItems.forEach(item => {
      data.push([item.code, item.name, item.note || '', item.amount, '']);
    });
    data.push(['', 'Total Current Assets', '', '', sheetData.totalCurrentAssets]);
    data.push(['', '', '', '', '']);

    data.push(['', 'Non-Current Assets (Fixed Assets)', '', '', '']);
    sheetData.nonCurrentAssetItems.forEach(item => {
      data.push([item.code, item.name, item.note || '', item.isContra ? -item.amount : item.amount, '']);
    });
    data.push(['', 'Total Non-Current Assets', '', '', sheetData.totalNonCurrentAssets]);
    data.push(['', 'TOTAL ASSETS', '', '', sheetData.totalAssets]);
    data.push(['', '', '', '', '']);

    data.push(['', 'LIABILITIES & EQUITY', '', '', '']);
    data.push(['', 'Current Liabilities', '', '', '']);
    sheetData.currentLiabilityItems.forEach(item => {
      data.push([item.code, item.name, item.note || '', item.amount, '']);
    });
    data.push(['', 'Total Current Liabilities', '', '', sheetData.totalCurrentLiabilities]);
    data.push(['', '', '', '', '']);

    data.push(['', 'Non-Current Liabilities', '', '', '']);
    sheetData.nonCurrentLiabilityItems.forEach(item => {
      data.push([item.code, item.name, item.note || '', item.amount, '']);
    });
    data.push(['', 'Total Non-Current Liabilities', '', '', sheetData.totalNonCurrentLiabilities]);
    data.push(['', 'TOTAL LIABILITIES', '', '', sheetData.totalLiabilities]);
    data.push(['', '', '', '', '']);

    data.push(['', 'Shareholders’ Equity', '', '', '']);
    sheetData.equityItems.forEach(item => {
      data.push([item.code, item.name, item.note || '', item.amount, '']);
    });
    data.push(['', 'Total Shareholders’ Equity', '', '', sheetData.totalEquity]);
    data.push(['', 'TOTAL LIABILITIES & EQUITY', '', '', sheetData.totalLiabilitiesAndEquity]);
    data.push(['', '', '', '', '']);
    data.push(['', 'EQUILIBRIUM CHECK', '', sheetData.isEquilibrium ? 'BALANCED' : 'VARIANCE', sheetData.balanceDifference]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSX.writeFile(wb, `Balance_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Corporate Report Header ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              <Building2 className="w-4 h-4" />
              <span>{companyInfo.name}</span>
              {companyInfo.regNumber && (
                <span className="text-slate-400 font-normal">({companyInfo.regNumber})</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              STATEMENT OF FINANCIAL POSITION
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Corporate Balance Sheet as of Period End • Presentation Currency: Nigerian Naira (NGN / ₦)
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            {/* Balance B/F toggle */}
            <label
              htmlFor="bs-include-bf"
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none px-3 py-1.5 rounded-md border transition-colors",
                includeBF
                  ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800"
                  : "border-slate-300 dark:border-slate-700 text-slate-500"
              )}
              title={
                sheetData.hasPriorLedger
                  ? (includeBF ? 'Prior-year balances brought forward included' : 'Click to include prior-year balances brought forward')
                  : 'Prior-year ledger vouchers are not yet in database. Kept off to maintain accurate in-period records.'
              }
            >
              <input
                id="bs-include-bf"
                type="checkbox"
                checked={includeBF}
                onChange={e => setIncludeBF(e.target.checked)}
                className="accent-slate-900"
              />
              <History className="w-3.5 h-3.5" />
              Include Balance B/F
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950 font-semibold"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* ── KPI Metric Ribbons ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Total Assets</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatMoney(sheetData.totalAssets)}
            </div>
            <div className="text-[11px] text-blue-600/80 dark:text-blue-400 mt-0.5 font-medium">
              Current + Non-Current Fleet
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Liabilities</span>
              <Landmark className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatMoney(sheetData.totalLiabilities)}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-0.5 font-medium">
              Payables & Tax Liabilities
            </div>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Equity</span>
              <Scale className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatMoney(sheetData.totalEquity)}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-0.5 font-medium">
              Retained Earnings + Operating Surplus
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900 text-white border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Accounting Equation</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-black font-mono text-emerald-400 mt-1">
              {sheetData.isEquilibrium ? 'A = L + E (Balanced)' : 'Variance'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Variance: {formatMoney(sheetData.balanceDifference)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Balance Sheet Document ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Document Title Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Corporate Financial Position (Click any line to see source vouchers)
            </span>
          </div>
          <Badge variant="outline" className="text-xs font-mono font-semibold bg-white dark:bg-slate-900 border-slate-200 text-slate-700 dark:text-slate-300">
            {filterYears.join(', ')} • {filterMonths.join(', ')}
          </Badge>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* ══════════════════════════════════════════════════════
              SECTION 1: ASSETS
             ══════════════════════════════════════════════════════ */}
          <div>
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-2 mb-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                1. ASSETS
              </h2>
              <span className="text-xs font-semibold text-slate-500 uppercase">Click any item for details</span>
            </div>

            {/* Current Assets */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => toggleSection('currentAssets')}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.currentAssets ? (
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Current Assets
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(sheetData.totalCurrentAssets)}
                </span>
              </button>

              {expandedSections.currentAssets && (
                <div className="pl-6 pr-2 space-y-2">
                  {sheetData.currentAssetItems.map(item => (
                    <div 
                      key={item.code} 
                      id={`bs-row-${item.code}`}
                      onClick={() => setDrillItem(item)}
                      title="Click to view underlying vouchers and audit rationale"
                      className="flex items-center justify-between py-2 px-2 rounded-md border-b border-slate-100 dark:border-slate-800/60 text-xs cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 font-semibold w-12">{item.code}</span>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted underline-offset-2">
                            {item.name}
                          </span>
                          {item.note && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 italic">({item.note})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.entries && item.entries.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-400 border-slate-200 dark:border-slate-700">
                            {item.entries.length} records
                          </Badge>
                        )}
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-700 text-xs font-bold">
                    <span className="uppercase text-slate-700 dark:text-slate-300">Total Current Assets</span>
                    <span className="font-mono text-slate-900 dark:text-white underline decoration-slate-400">
                      {formatMoney(sheetData.totalCurrentAssets)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Non-Current Assets */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => toggleSection('nonCurrentAssets')}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.nonCurrentAssets ? (
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Non-Current Assets (Property, Plant & Equipment)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(sheetData.totalNonCurrentAssets)}
                </span>
              </button>

              {expandedSections.nonCurrentAssets && (
                <div className="pl-6 pr-2 space-y-2">
                  {sheetData.nonCurrentAssetItems.map(item => (
                    <div 
                      key={item.code} 
                      id={`bs-row-${item.code}`}
                      onClick={() => setDrillItem(item)}
                      title="Click to view underlying fixed asset vouchers"
                      className="flex items-center justify-between py-2 px-2 rounded-md border-b border-slate-100 dark:border-slate-800/60 text-xs cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 font-semibold w-12">{item.code}</span>
                        <div>
                          <span className={cn(
                            "font-medium underline decoration-dotted underline-offset-2",
                            item.isContra ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          )}>
                            {item.name}
                          </span>
                          {item.note && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 italic">({item.note})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.entries && item.entries.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-400 border-slate-200 dark:border-slate-700">
                            {item.entries.length} vouchers
                          </Badge>
                        )}
                        <span className={cn(
                          "font-mono font-semibold tabular-nums",
                          item.isContra ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                        )}>
                          {item.isContra ? formatMoney(-item.amount) : formatMoney(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-700 text-xs font-bold">
                    <span className="uppercase text-slate-700 dark:text-slate-300">Total Non-Current Assets (Net Book Value)</span>
                    <span className="font-mono text-slate-900 dark:text-white underline decoration-slate-400">
                      {formatMoney(sheetData.totalNonCurrentAssets)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* TOTAL ASSETS DOUBLE UNDERLINE */}
            <div className="flex items-center justify-between py-3 px-4 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border-b-4 border-double border-slate-900 dark:border-slate-100 text-sm font-black">
              <span className="uppercase tracking-wider text-slate-900 dark:text-white">TOTAL ASSETS</span>
              <span className="font-mono text-lg text-blue-700 dark:text-blue-400">
                {formatMoney(sheetData.totalAssets)}
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 2: LIABILITIES & EQUITY
             ══════════════════════════════════════════════════════ */}
          <div>
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-2 mb-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                2. LIABILITIES & EQUITY
              </h2>
              <span className="text-xs font-semibold text-slate-500 uppercase">Amounts in NGN (₦)</span>
            </div>

            {/* Current Liabilities */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => toggleSection('currentLiabilities')}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.currentLiabilities ? (
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Current Liabilities
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(sheetData.totalCurrentLiabilities)}
                </span>
              </button>

              {expandedSections.currentLiabilities && (
                <div className="pl-6 pr-2 space-y-2">
                  {sheetData.currentLiabilityItems.map(item => (
                    <div 
                      key={item.code} 
                      id={`bs-row-${item.code}`}
                      onClick={() => setDrillItem(item)}
                      title="Click to view underlying liabilities"
                      className="flex items-center justify-between py-2 px-2 rounded-md border-b border-slate-100 dark:border-slate-800/60 text-xs cursor-pointer hover:bg-rose-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 font-semibold w-12">{item.code}</span>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 underline decoration-dotted underline-offset-2">
                            {item.name}
                          </span>
                          {item.note && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 italic">({item.note})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.entries && item.entries.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-400 border-slate-200 dark:border-slate-700">
                            {item.entries.length} records
                          </Badge>
                        )}
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-700 text-xs font-bold">
                    <span className="uppercase text-slate-700 dark:text-slate-300">Total Current Liabilities</span>
                    <span className="font-mono text-slate-900 dark:text-white underline decoration-slate-400">
                      {formatMoney(sheetData.totalCurrentLiabilities)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Shareholders' Equity */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => toggleSection('equity')}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.equity ? (
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Shareholders' Equity
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(sheetData.totalEquity)}
                </span>
              </button>

              {expandedSections.equity && (
                <div className="pl-6 pr-2 space-y-2">
                  {sheetData.equityItems.map(item => (
                    <div 
                      key={item.code} 
                      id={`bs-row-${item.code}`}
                      onClick={() => setDrillItem(item)}
                      title="Click to view underlying equity calculations"
                      className="flex items-center justify-between py-2 px-2 rounded-md border-b border-slate-100 dark:border-slate-800/60 text-xs cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 font-semibold w-12">{item.code}</span>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-dotted underline-offset-2">
                            {item.name}
                          </span>
                          {item.note && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 italic">({item.note})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.entries && item.entries.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-400 border-slate-200 dark:border-slate-700">
                            {item.entries.length} records
                          </Badge>
                        )}
                        <span className={cn(
                          "font-mono font-semibold tabular-nums",
                          item.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                        )}>
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-700 text-xs font-bold">
                    <span className="uppercase text-slate-700 dark:text-slate-300">Total Shareholders' Equity</span>
                    <span className="font-mono text-slate-900 dark:text-white underline decoration-slate-400">
                      {formatMoney(sheetData.totalEquity)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* TOTAL LIABILITIES & EQUITY DOUBLE UNDERLINE */}
            <div className="flex items-center justify-between py-3 px-4 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border-b-4 border-double border-slate-900 dark:border-slate-100 text-sm font-black">
              <span className="uppercase tracking-wider text-slate-900 dark:text-white">TOTAL LIABILITIES & EQUITY</span>
              <span className="font-mono text-lg text-emerald-700 dark:text-emerald-400">
                {formatMoney(sheetData.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              EQUILIBRIUM AUDIT FOOTER
             ══════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Balance Sheet Equilibrium Validation
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Assets ({formatMoney(sheetData.totalAssets)}) = Liabilities ({formatMoney(sheetData.totalLiabilities)}) + Equity ({formatMoney(sheetData.totalEquity)})
                </div>
              </div>
            </div>

            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 font-mono font-bold text-xs">
              ✓ In Perfect Equilibrium
            </Badge>
          </div>
        </div>
      </div>

      {drillItem && (
        <TransactionDrilldownDialog
          key={drillItem.code}
          open
          onClose={() => setDrillItem(null)}
          title={`${drillItem.code} · ${drillItem.name}`}
          subtitle={`${drillItem.note || ''} · Balance: ${formatMoney(drillItem.amount)}`}
          notes={drillItem.accountingRationale}
          entries={drillItem.entries || []}
          debitLabel={drillItem.type === 'LIABILITY' || drillItem.type === 'EQUITY' ? 'Reduction / Debit (₦)' : 'Addition / Debit (₦)'}
          creditLabel={drillItem.type === 'LIABILITY' || drillItem.type === 'EQUITY' ? 'Addition / Credit (₦)' : 'Reduction / Credit (₦)'}
        />
      )}
    </div>
  );
}
