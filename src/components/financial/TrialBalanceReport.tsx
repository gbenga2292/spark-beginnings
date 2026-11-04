import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  History,
  X,
  Scale,
} from 'lucide-react';
import { useAppStore, type Invoice, type LedgerEntry, type Payment } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate } from '@/src/lib/dateUtils';
import { useIncludeBroughtForward } from '@/src/hooks/useIncludeBroughtForward';
import { TransactionDrilldownDialog, type DrillEntry } from './TransactionDrilldownDialog';
import { DCEL_CHART_OF_ACCOUNTS, DEFAULT_CATEGORY_COA_MAP, resolveCategoryAccountCode } from '@/src/constants/chartOfAccounts';

interface TrialBalanceReportProps {
  filterYears: string[];
  filterMonths: string[];
  filterClient?: string;
}

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  category: string;
  debit: number;
  credit: number;
  netDebit: number;
  netCredit: number;
  auditSource: string;
  voucherCount?: number;
  entries: DrillEntry[];
  notes?: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortId = (id: string) => String(id).substring(0, 6).toUpperCase();

const ledgerToEntry = (e: LedgerEntry, side: DrillEntry['side']): DrillEntry => ({
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
  details: e as unknown as Record<string, unknown>,
});

const paymentToEntry = (p: Payment, side: DrillEntry['side'], amount = Number(p.amount || 0), suffix = ''): DrillEntry => ({
  id: `pay-${p.id}${suffix}`,
  date: p.date,
  ref: (p as any).receiptNo || p.reference || `RCT-${shortId(p.id)}`,
  description: `Client payment — ${p.client || 'General'}${p.invoiceNumber ? ` (Inv ${p.invoiceNumber})` : ''}`,
  party: p.client,
  site: p.site,
  bank: p.paidTo || (p as any).paidFromBank,
  amount,
  side,
  details: p as unknown as Record<string, unknown>,
});

const invoiceToEntry = (inv: Invoice, amount: number, side: DrillEntry['side'], line: string): DrillEntry => ({
  id: `inv-${inv.id}-${line}`,
  date: inv.date,
  ref: inv.invoiceNumber || `INV-${shortId(inv.id)}`,
  description: `${line} — ${inv.client}`,
  party: inv.client,
  site: inv.siteName,
  category: inv.status,
  amount,
  side,
  details: inv as unknown as Record<string, unknown>,
});

/** Splits an invoice into its billed line items; any non-itemized legacy portion is allocated to rental. */
const invoiceLines = (inv: Invoice) => {
  const raw = inv as any;
  const rental = Number(inv.rentalCost || raw.rental_cost || 0);
  const installation = Number(inv.installation || 0);
  const mob = Number(inv.mobDemob || raw.mob_demob || 0);
  const diesel = Number(inv.dieselCost || raw.diesel_cost || 0);
  const tech = Number(inv.techniciansCost || raw.technicians_cost || 0);
  const vat = Number(inv.vat || 0);
  const total = Number(inv.totalCharge || inv.amount || 0);
  const unitemized = Math.max(0, total - (rental + installation + mob + diesel + tech + vat));
  return { rental: rental + unitemized, installation, mob, diesel, tech, vat, total };
};

export function TrialBalanceReport({
  filterYears,
  filterMonths,
  filterClient
}: TrialBalanceReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [includeBF, setIncludeBF] = useIncludeBroughtForward();
  const [drillRow, setDrillRow] = useState<TrialBalanceRow | null>(null);

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
        console.error('Failed to load company info in TrialBalanceReport:', err);
      }
    })();
  }, []);

  const invoices = useAppStore(s => s.invoices);
  const payments = useAppStore(s => s.payments);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const payrollVariables = useAppStore(s => s.payrollVariables);
  const vendorInvoices = useAppStore(s => (s as any).vendorInvoices || []);
  const vendorInvoicePayments = useAppStore(s => (s as any).vendorInvoicePayments || []);
  const sites = useAppStore(s => s.sites);

  // Calculate Trial Balance Rows with 100% real ledger vouchers & invoice line items
  const { trialBalanceRows, totalDebits, totalCredits, isBalanced, difference, hasPriorData, hasPriorLedger } = useMemo(() => {
    // 1. Period helpers
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
    const inPeriodInvoices = invoices.filter(inv => isInSelectedPeriod(inv.date, inv.client));
    const inPeriodPayments = payments.filter(p => isInSelectedPeriod(p.date, p.client));
    const inPeriodLedger = ledgerEntries.filter(e => {
      const client = e.client || sites.find(s => s.name?.toLowerCase() === e.site?.trim().toLowerCase())?.client || '';
      return isInSelectedPeriod(e.date, client);
    });

    const priorInvoices = invoices.filter(inv => isPriorPeriod(inv.date));
    const priorPayments = payments.filter(p => isPriorPeriod(p.date));
    const priorLedger = ledgerEntries.filter(e => isPriorPeriod(e.date));
    const hasPriorLedger = priorLedger.length > 0;
    const hasPriorData = priorInvoices.length + priorPayments.length + priorLedger.length > 0;

    const bfEntry = (amount: number, side: DrillEntry['side'], description: string, details: Record<string, unknown>): DrillEntry => ({
      id: `bf-${description}`,
      date: bfDate,
      ref: 'B/F',
      description,
      category: 'Opening Balance B/F',
      amount: Math.abs(amount),
      side,
      details,
    });

    // 3. Debtors Brought Forward (unsettled prior client invoices)
    const priorBilled = priorInvoices.reduce((s, i) => s + Number(i.totalCharge || i.amount || 0), 0);
    const priorCollected = priorPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const debtorsBF = includeBF ? Math.max(0, priorBilled - priorCollected) : 0;

    // 4. Current in-period revenue, itemized from billed invoice line items
    const lines = inPeriodInvoices.map(inv => ({ inv, ...invoiceLines(inv) }));
    const sumLine = (key: 'rental' | 'installation' | 'mob' | 'diesel' | 'tech' | 'vat' | 'total') =>
      lines.reduce((s, l) => s + l[key], 0);
    const lineEntries = (key: 'rental' | 'installation' | 'mob' | 'diesel' | 'tech' | 'vat', label: string) =>
      lines.filter(l => l[key] > 0).map(l => invoiceToEntry(l.inv, l[key], 'credit', label));

    const totalBilled = sumLine('total');
    const vatBilled = sumLine('vat');
    const totalCollected = inPeriodPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

    // 5. Group ledger vouchers into chart categories
    const getCat = (names: string[], side: DrillEntry['side'] = 'debit') => {
      const lower = names.map(n => n.toLowerCase());
      const matching = inPeriodLedger.filter(e => lower.includes((e.category || '').toLowerCase()));
      return {
        sum: matching.reduce((s, e) => s + Number(e.amount || 0), 0),
        count: matching.length,
        entries: matching.map(e => ledgerToEntry(e, side)),
      };
    };

    // Direct Operational Costs
    const directLabor = getCat(['Payroll Expenses', 'Salary']);
    const siteMaterials = getCat(['Direct Cost', 'Cost of Goods']);
    const fuelExpense = getCat(['Petrol (Vehicle)', 'Office Consumables:Petrol', 'Office Consumables:Diesel']);
    const reimbursableExp = getCat(['Re-embursable Expense']);
    const localTransport = getCat(['Local Transport']);
    const machineMaint = getCat(['Machine Maintenance', 'Repairs and Maintenance', 'Tools and Small Equipment']);

    // Operating Expenses / OPEX
    const premisesMaint = getCat(['Premises Maintenance', 'Office Maintenance', 'Office Consumables', 'Office Supplies', 'Premises Service Charge']);
    const utilitiesExp = getCat(['Internet and Subs', 'Power and Electricity', 'Telephone Expense']);
    const logisticsExp = getCat(['Auto Truck Maintenance', 'Motor Vehicle Maintenance']);
    const professionalExp = getCat(['Professional Fees']);
    const financeExp = getCat(['Interest Expense', 'Bank Service Charges']);
    const overheadExp = getCat([
      'Medical', 'Directors Expense', 'Fines', 'Corporate Social Responsibility',
      'Meals and Entertainment', 'Furnitures and Fitting', 'Business Development',
      'Government/Business/Regulatory', 'Welfare', 'Client Rent'
    ]);

    // Capital Additions & Tax Settlements
    const fixedAssets = getCat(['Fixed Assets']);
    const vatRemitted = getCat(['VAT']);

    // 6. Vendor Trade Payables
    // Bills received = what we OWE (Credits / Additions to Payable)
    // Payments made  = what we've PAID (Debits / Reductions to Payable)
    // Also pick up ledger vouchers that represent supplier / vendor payments not linked to a vendor bill
    const vendorRelatedCategories = new Set([
      'direct cost', 'cost of goods', 'repairs and maintenance', 'machine maintenance',
      'tools and small equipment', 're-embursable expense', 'local transport',
      'auto truck maintenance', 'motor vehicle maintenance', 'professional fees',
    ]);
    const ledgerVendorPayments = inPeriodLedger.filter(e =>
      vendorRelatedCategories.has((e.category || '').toLowerCase()) && Number(e.amount || 0) > 0
    );

    const totalVendorBills = vendorInvoices.reduce((s: number, v: any) => s + Number(v.totalAmount || 0), 0);
    const totalVendorPaid =
      vendorInvoicePayments.reduce((s: number, p: any) => s + Number(p.amount_paid || p.amount || 0), 0) +
      ledgerVendorPayments.reduce((s, e) => s + Number(e.amount || 0), 0);

    const vendorEntries: DrillEntry[] = [
      // Bills RECEIVED from vendors (what we owe) — shown as Credits (additions to the liability)
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
      // Payments MADE via the vendor payment module (settlements) — shown as Debits (reductions)
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
      // Payments MADE via Ledger Vouchers (not always linked to a specific vendor bill)
      ...ledgerVendorPayments.map(e => ({
        ...ledgerToEntry(e, 'debit'),
        id: `lved-${e.id}`,
        description: `Voucher payment — ${e.description || e.category || 'Supplier payment'} (recorded in Ledger, may not be linked to a vendor bill)`,
        category: 'Paid via Ledger Voucher',
      })),
    ];

    // 7. Consolidated Cash & Bank Balances: B/F cash (if enabled AND prior ledger exists) + collections − vouchers paid
    const priorColl = priorPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const priorExp = priorLedger.reduce((s, e) => s + Number(e.amount || 0), 0);
    // CRITICAL: If priorLedger has 0 entries, do NOT assume 2025 expenses were ₦0!
    // Assuming 0 expenses fabricates an inaccurate ₦277M cash B/F.
    const cashBF = (includeBF && hasPriorLedger) ? priorColl - priorExp : 0;

    const inPeriodColl = inPeriodPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const inPeriodExp = inPeriodLedger.reduce((s, e) => s + Number(e.amount || 0), 0);

    const bankEntries: DrillEntry[] = [
      ...(cashBF !== 0 ? [bfEntry(cashBF, cashBF > 0 ? 'debit' : 'credit', 'Opening Cash & Bank Balance B/F', {
        priorCollections: priorColl,
        priorVouchersPaid: priorExp,
        netCashBroughtForward: cashBF,
      })] : []),
      ...inPeriodPayments.map(p => paymentToEntry(p, 'debit')),
      ...inPeriodLedger.map(e => ledgerToEntry(e, 'credit')),
    ];

    const bankDebit = Math.max(0, cashBF) + inPeriodColl;
    const bankCredit = Math.max(0, -cashBF) + inPeriodExp;
    const bankAuditSource = `${includeBF && cashBF !== 0 ? `₦${(cashBF / 1e6).toFixed(2)}M B/F + ` : ''}₦${(inPeriodColl / 1e6).toFixed(2)}M client collections less ₦${(inPeriodExp / 1e6).toFixed(2)}M vouchers disbursed`;

    // Withholding Tax credit notes recoverable
    const whtPayments = inPeriodPayments.filter(p => Number(p.withholdingTax || 0) > 0);
    const whtReceivable = whtPayments.reduce((s, p) => s + Number(p.withholdingTax || 0), 0);

    // 8. Build rows
    const rows: TrialBalanceRow[] = [];

    const addRow = (
      code: string,
      name: string,
      type: AccountType,
      category: string,
      debit: number,
      credit: number,
      auditSource: string,
      entries: DrillEntry[] = [],
      voucherCount?: number,
      notes?: string
    ) => {
      const isDebitNature = type === 'ASSET' || type === 'EXPENSE';
      const net = debit - credit;
      let netDebit = 0;
      let netCredit = 0;
      if (isDebitNature ? net >= 0 : net > 0) netDebit = net;
      else netCredit = -net;

      if (netDebit > 0 || netCredit > 0) {
        rows.push({ code, name, type, category, debit, credit, netDebit, netCredit, auditSource, voucherCount, entries, notes });
      }
    };

    // ASSETS
    addRow('1010', 'Cash & Bank Balances', 'ASSET', 'CURRENT_ASSET',
      bankDebit, bankCredit, bankAuditSource, bankEntries, inPeriodLedger.length + inPeriodPayments.length);

    addRow('1100', 'Accounts Receivable — Trade Clients', 'ASSET', 'CURRENT_ASSET',
      debtorsBF + totalBilled, totalCollected,
      debtorsBF > 0
        ? `${inPeriodInvoices.length} Invoices billed less ${inPeriodPayments.length} collections + ₦${(debtorsBF / 1e6).toFixed(2)}M Debtors B/F`
        : `${inPeriodInvoices.length} Client invoices billed less ${inPeriodPayments.length} collections received`,
      [
        ...(debtorsBF > 0 ? [bfEntry(debtorsBF, 'debit', 'Debtors Brought Forward (unsettled prior invoices)', {
          priorInvoicesBilled: priorBilled,
          priorCollections: priorCollected,
          priorInvoiceCount: priorInvoices.length,
          priorPaymentCount: priorPayments.length,
        })] : []),
        ...lines.map(l => invoiceToEntry(l.inv, l.total, 'debit', 'Invoice billed')),
        ...inPeriodPayments.map(p => paymentToEntry(p, 'credit')),
      ]);

    addRow('1120', 'Withholding Tax (WHT) Credit Notes Recoverable', 'ASSET', 'CURRENT_ASSET',
      whtReceivable, 0, 'FIRS WHT deductions deducted by clients on payment settlement vouchers',
      whtPayments.map(p => paymentToEntry(p, 'debit', Number(p.withholdingTax || 0), '-wht')), whtPayments.length);

    addRow('1300', 'Dewatering Equipment & Fixed Assets (Capital Additions)', 'ASSET', 'NON_CURRENT_ASSET',
      fixedAssets.sum, 0, `${fixedAssets.count} Capital asset purchase vouchers in Ledger`, fixedAssets.entries, fixedAssets.count);

    // LIABILITIES
    addRow('2000', 'Accounts Payable — Trade Vendors & Suppliers', 'LIABILITY', 'CURRENT_LIABILITY',
      totalVendorPaid, totalVendorBills,
      `${vendorInvoices.length} Vendor invoices (₦${(totalVendorBills / 1e6).toFixed(2)}M) less ₦${(totalVendorPaid / 1e6).toFixed(2)}M settled`,
      vendorEntries);

    addRow('2100', 'VAT Output Payable (7.5%)', 'LIABILITY', 'CURRENT_LIABILITY',
      vatRemitted.sum, vatBilled,
      `VAT billed on client invoices (₦${(vatBilled / 1e6).toFixed(2)}M) less ${vatRemitted.count} VAT remittances in Ledger`,
      [...lineEntries('vat', 'VAT billed'), ...vatRemitted.entries], vatRemitted.count);

    // DIRECT COSTS & OPEX (From Ledger — dynamically mapped via Chart of Accounts & Variables allocations)
    const activeCoaList = (payrollVariables?.chartOfAccounts && payrollVariables.chartOfAccounts.length > 0)
      ? payrollVariables.chartOfAccounts
      : DCEL_CHART_OF_ACCOUNTS;
    const activeCoaMap = { ...DEFAULT_CATEGORY_COA_MAP, ...(payrollVariables?.categoryCoaMap || {}) };
    const expenseCoaAccounts = activeCoaList.filter(a => a.type === 'EXPENSE');

    expenseCoaAccounts.forEach(acc => {
      const matching = inPeriodLedger.filter(e => resolveCategoryAccountCode(e.category || '', activeCoaMap) === acc.code);
      const sum = matching.reduce((s, e) => s + Number(e.amount || 0), 0);
      const entries = matching.map(e => ledgerToEntry(e, 'debit'));
      const mappedCatNames = Array.from(new Set(matching.map(e => e.category).filter(Boolean)));
      const desc = mappedCatNames.length > 0
        ? `${matching.length} voucher(s) across: ${mappedCatNames.join(', ')}`
        : `${matching.length} ${acc.name} vouchers in Ledger`;
      addRow(acc.code, acc.name, 'EXPENSE', acc.category, sum, 0, desc, entries, matching.length);
    });

    // Any unallocated expense categories not mapped to 1300/2100 or an existing EXPENSE CoA
    const knownCodes = new Set(activeCoaList.map(a => a.code));
    const unallocatedLedger = inPeriodLedger.filter(e => {
      const code = resolveCategoryAccountCode(e.category || '', activeCoaMap);
      return !code || !knownCodes.has(code);
    });
    if (unallocatedLedger.length > 0) {
      const unallocSum = unallocatedLedger.reduce((s, e) => s + Number(e.amount || 0), 0);
      const unallocCats = Array.from(new Set(unallocatedLedger.map(e => e.category || 'Uncategorized')));
      addRow(
        '5999',
        'Unallocated / Suspense Operating Expenses',
        'EXPENSE',
        'OPERATING_EXPENSE',
        unallocSum,
        0,
        `${unallocatedLedger.length} voucher(s) in unallocated categories (${unallocCats.join(', ')}) — allocate in Variables`,
        unallocatedLedger.map(e => ledgerToEntry(e, 'debit')),
        unallocatedLedger.length
      );
    }

    // REVENUE (From Billed Invoices — Classified by Service Stream in accordance with Statutory CoA)
    const pendingSites = (useAppStore.getState() as any).pendingSites || [];
    const resolveServiceCode = (party?: string, siteNameOrProject?: string, siteId?: string, description?: string): { code: string; name: string } => {
      const clientLow = (party || '').toLowerCase();
      const siteLow = (siteNameOrProject || '').toLowerCase();
      const descLow = (description || '').toLowerCase();

      const siteObj = sites.find(s => (siteId && s.id === siteId) || s.name.trim().toLowerCase() === siteLow);
      if (siteObj?.projectType && siteObj.projectType.trim().toUpperCase() !== 'DEWATERING') {
        const pt = siteObj.projectType.trim().toUpperCase();
        if (pt.includes('WATERPROOF')) return { code: '4010', name: 'Revenue — Waterproofing Services' };
        if (pt.includes('ALLIED') || pt.includes('TILING') || pt.includes('JETTING') || pt.includes('GROUND')) return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };
        if (pt.includes('SALES')) return { code: '4030', name: 'Revenue — Equipment Sales' };
        if (pt.includes('MAINTENANCE')) return { code: '4040', name: 'Revenue — Equipment Maintenance & Overhaul' };
      }

      const q = pendingSites.find((ps: any) =>
        (siteId && ps.siteId === siteId) ||
        (ps.siteName?.trim().toLowerCase() === siteLow && ps.clientName?.trim().toLowerCase() === clientLow) ||
        (ps.siteName?.trim().toLowerCase() === siteLow)
      );
      const qBuilt = (
        q?.phase1?.whatIsBeingBuilt ||
        q?.service ||
        q?.serviceName ||
        q?.data?.phase1?.whatIsBeingBuilt ||
        ''
      ).toLowerCase();
      if (qBuilt.includes('waterproof')) return { code: '4010', name: 'Revenue — Waterproofing Services' };
      if (qBuilt.includes('allied') || qBuilt.includes('tiling') || qBuilt.includes('jetting')) return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };

      if (clientLow.includes('first bank') || siteLow.includes('waterproof') || descLow.includes('waterproof')) {
        return { code: '4010', name: 'Revenue — Waterproofing Services' };
      }
      if (descLow.includes('allied') || descLow.includes('ground improvement') || descLow.includes('jetting') || descLow.includes('tiling')) {
        return { code: '4020', name: 'Revenue — Allied & Ground Improvement Services' };
      }
      if (descLow.includes('equipment sale') || descLow.includes('sale of equipment') || descLow.includes('pump sale')) {
        return { code: '4030', name: 'Revenue — Equipment Sales' };
      }
      if (descLow.includes('maintenance') || descLow.includes('overhaul') || descLow.includes('repair service')) {
        return { code: '4040', name: 'Revenue — Equipment Maintenance & Overhaul' };
      }
      if (descLow.includes('spare part') || descLow.includes('spares sale')) {
        return { code: '4050', name: 'Revenue — Spare Parts Sales' };
      }

      return { code: '4000', name: 'Revenue — Dewatering Services' };
    };

    interface RevAccAccumulator {
      code: string;
      name: string;
      credit: number;
      entries: DrillEntry[];
      count: number;
    }

    const revAccMap = new Map<string, RevAccAccumulator>();
    const getRevAcc = (code: string, fallbackName: string) => {
      if (!revAccMap.has(code)) {
        const coaItem = activeCoaList.find(a => a.code === code);
        revAccMap.set(code, {
          code,
          name: coaItem?.name || fallbackName,
          credit: 0,
          entries: [],
          count: 0
        });
      }
      return revAccMap.get(code)!;
    };

    // Ensure 4000 and 4010 are at least initialized if present in CoA
    getRevAcc('4000', 'Revenue — Dewatering Services');
    getRevAcc('4010', 'Revenue — Waterproofing Services');

    lines.forEach(l => {
      const { code, name } = resolveServiceCode(l.inv.client, l.inv.siteName, (l.inv as any).siteId, (l.inv as any).description);
      const acc = getRevAcc(code, name);
      acc.count += 1;

      if (code === '4010') {
        // Waterproofing project: itemize lines with waterproofing labels
        if (l.installation > 0) {
          acc.credit += l.installation;
          acc.entries.push(invoiceToEntry(l.inv, l.installation, 'credit', 'Waterproofing Installation & Application'));
        }
        if (l.rental > 0) {
          acc.credit += l.rental;
          acc.entries.push(invoiceToEntry(l.inv, l.rental, 'credit', 'Waterproofing Materials & Equipment Billing'));
        }
        if (l.mob > 0) {
          acc.credit += l.mob;
          acc.entries.push(invoiceToEntry(l.inv, l.mob, 'credit', 'Mobilisation & Logistics'));
        }
        if (l.diesel > 0) {
          acc.credit += l.diesel;
          acc.entries.push(invoiceToEntry(l.inv, l.diesel, 'credit', 'Site Diesel Supply'));
        }
        if (l.tech > 0) {
          acc.credit += l.tech;
          acc.entries.push(invoiceToEntry(l.inv, l.tech, 'credit', 'Technician & Application Labor'));
        }
        const itemized = l.installation + l.rental + l.mob + l.diesel + l.tech;
        const remainder = Math.max(0, (l.total - l.vat) - itemized);
        if (remainder > 0) {
          acc.credit += remainder;
          acc.entries.push(invoiceToEntry(l.inv, remainder, 'credit', 'Waterproofing Contract Billing'));
        }
      } else if (code === '4000') {
        // Dewatering project: dewatering installation stays strictly under 4000 Dewatering Services!
        if (l.rental > 0) {
          acc.credit += l.rental;
          acc.entries.push(invoiceToEntry(l.inv, l.rental, 'credit', 'Dewatering Equipment Rental Fleet'));
        }
        if (l.installation > 0) {
          acc.credit += l.installation;
          acc.entries.push(invoiceToEntry(l.inv, l.installation, 'credit', 'Dewatering Installation & Piping Setup'));
        }
        if (l.mob > 0) {
          acc.credit += l.mob;
          acc.entries.push(invoiceToEntry(l.inv, l.mob, 'credit', 'Mobilisation & Demobilisation'));
        }
        if (l.diesel > 0) {
          acc.credit += l.diesel;
          acc.entries.push(invoiceToEntry(l.inv, l.diesel, 'credit', 'Site Diesel Supply'));
        }
        if (l.tech > 0) {
          acc.credit += l.tech;
          acc.entries.push(invoiceToEntry(l.inv, l.tech, 'credit', 'Field Operations & Technicians Fee'));
        }
        const itemized = l.rental + l.installation + l.mob + l.diesel + l.tech;
        const remainder = Math.max(0, (l.total - l.vat) - itemized);
        if (remainder > 0) {
          acc.credit += remainder;
          acc.entries.push(invoiceToEntry(l.inv, remainder, 'credit', 'General Dewatering Operations Billing'));
        }
      } else {
        // Other services (Allied, Equipment Sales, Maintenance, Spare parts)
        const netBilled = Math.max(0, l.total - l.vat);
        acc.credit += netBilled;
        acc.entries.push(invoiceToEntry(l.inv, netBilled, 'credit', name));
      }
    });

    Array.from(revAccMap.values())
      .filter(acc => acc.credit > 0 || acc.count > 0 || acc.code === '4000' || acc.code === '4010')
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(acc => {
        addRow(
          acc.code,
          acc.name,
          'INCOME',
          'REVENUE',
          0,
          acc.credit,
          `${acc.count} Client invoice(s) — ${acc.name}`,
          acc.entries,
          acc.count
        );
      });

    // EQUITY: balancing figure — B/F surplus when enabled, otherwise a suspense difference
    const currentDebits = rows.reduce((s, r) => s + r.netDebit, 0);
    const currentCredits = rows.reduce((s, r) => s + r.netCredit, 0);
    const balancing = currentDebits - currentCredits;
    const plugNote = 'This figure is not posted from any voucher. It is the difference needed to make total debits equal total credits, so the trial balance always "balances". A large value means some transactions are not fully recorded (e.g. vendor bills without matching vouchers, payments without a bank).';

    if (Math.abs(balancing) >= 0.01) {
      const label = includeBF
        ? balancing > 0
          ? (hasPriorLedger ? 'Retained Earnings (Prior Year Surplus Brought Forward)' : 'Retained Earnings B/F (Estimated — Prior Ledger Missing)')
          : 'Retained Deficit / Prior Year Adjustment'
        : balancing > 0 ? 'Suspense — Unreconciled Credit Difference' : 'Suspense — Unreconciled Debit Difference';
      addRow('3100', label, 'EQUITY', 'EQUITY',
        balancing < 0 ? -balancing : 0, balancing > 0 ? balancing : 0,
        includeBF
          ? (hasPriorLedger
            ? `Computed balancing figure${debtorsBF > 0 ? ` (includes ₦${(debtorsBF / 1e6).toFixed(2)}M Debtors B/F)` : ''}`
            : 'Estimated figure from prior billing/collections only; prior year expense ledger is not in database')
          : 'Computed balancing figure — Balance B/F excluded',
        [], undefined, plugNote);
    }

    const totalDebits = rows.reduce((sum, r) => sum + r.netDebit, 0);
    const totalCredits = rows.reduce((sum, r) => sum + r.netCredit, 0);
    const diff = Math.abs(totalDebits - totalCredits);

    return {
      trialBalanceRows: rows,
      totalDebits,
      totalCredits,
      isBalanced: diff < 0.05,
      difference: diff,
      hasPriorData,
      hasPriorLedger,
    };
  }, [invoices, payments, ledgerEntries, vendorInvoices, vendorInvoicePayments, sites, filterYears, filterMonths, filterClient, includeBF, payrollVariables]);

  // Filtered rows by search term and account classification
  const displayRows = useMemo(() => {
    return trialBalanceRows.filter(r => {
      if (selectedType !== 'ALL' && r.type !== selectedType) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !r.code.includes(q) &&
          !r.name.toLowerCase().includes(q) &&
          !r.type.toLowerCase().includes(q) &&
          !r.auditSource.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [trialBalanceRows, selectedType, searchTerm]);

  // Excel Export
  const handleExportTrialBalance = () => {
    const exportRows: any[] = [];
    exportRows.push({ [companyInfo.name]: 'TRIAL BALANCE (CHART OF ACCOUNTS SUMMARY)' });
    if (companyInfo.regNumber) exportRows.push({ [companyInfo.name]: `Registration No: ${companyInfo.regNumber}` });
    if (companyInfo.address) exportRows.push({ [companyInfo.name]: companyInfo.address });
    exportRows.push({ 'Reporting Basis': 'Nigerian Standard 4-Digit Chart of Accounts · General Ledger Vouchers' });
    exportRows.push({ 'Period': `${filterYears.join(', ')} · Months: ${filterMonths.join(', ')}` });
    exportRows.push({ 'Balance B/F': includeBF ? 'Included' : 'Excluded' });
    exportRows.push({});
    exportRows.push({
      'Account Code': 'ACCOUNT CODE',
      'Account Title': 'ACCOUNT TITLE',
      'Audit Justification & Source': 'AUDIT SOURCE / LEDGER JUSTIFICATION',
      'Classification': 'TYPE',
      'Debit (NGN)': 'DEBIT BALANCE (NGN)',
      'Credit (NGN)': 'CREDIT BALANCE (NGN)',
    });

    trialBalanceRows.forEach(r => {
      exportRows.push({
        'Account Code': r.code,
        'Account Title': r.name,
        'Audit Justification & Source': r.auditSource,
        'Classification': r.type,
        'Debit (NGN)': r.netDebit > 0 ? r.netDebit : '',
        'Credit (NGN)': r.netCredit > 0 ? r.netCredit : '',
      });
    });

    exportRows.push({});
    exportRows.push({
      'Account Code': 'TOTAL',
      'Account Title': 'TRIAL BALANCE TOTALS',
      'Audit Justification & Source': isBalanced ? 'PERFECT EQUILIBRIUM (DEBITS = CREDITS)' : `VARIANCE: N${difference.toLocaleString()}`,
      'Classification': isBalanced ? 'BALANCED' : 'OUT OF BALANCE',
      'Debit (NGN)': totalDebits,
      'Credit (NGN)': totalCredits,
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial Balance');
    const safeName = (companyInfo.name || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_Trial_Balance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-150">
      {/* ── Top Mode & Action Bar (Minimalist Single-Row Strip) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-1.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 shadow-2xs">
        {/* Left: View Identifier & Account Classification Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Pill */}
          <div className="inline-flex rounded-sm bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 h-7 items-center">
            <span className="px-2 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs flex items-center gap-1.5">
              <Scale className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>Trial Balance</span>
            </span>
          </div>

          {/* Classification Filter Pills */}
          <div className="inline-flex rounded-sm bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 h-7 items-center">
            {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedType(cls)}
                className={cn(
                  'px-1.5 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors',
                  selectedType === cls
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                {cls === 'ALL' ? 'All' : cls.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Right Toolbar Controls (Search, Balance B/F, Equilibrium Pill, Excel) */}
        <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
          {/* Compact Search Input */}
          <div className="relative">
            <Search className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search accounts..."
              className="h-7 w-28 xl:w-40 pl-6 pr-5 text-[11px] rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          {/* Balance B/F Toggle */}
          <button
            type="button"
            onClick={() => setIncludeBF(!includeBF)}
            title={
              hasPriorLedger
                ? (includeBF ? 'Prior-year balances brought forward included' : 'Click to include prior-year balances brought forward')
                : 'Prior-year ledger vouchers are not yet in database.'
            }
            className={cn(
              'h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border transition-colors',
              includeBF
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <History className="h-3 w-3 text-slate-400" />
            <span>{includeBF ? 'B/F Included' : 'B/F Excluded'}</span>
          </button>

          {/* Equilibrium Status Pill */}
          <div
            className={cn(
              'h-7 px-2 inline-flex items-center gap-1.5 rounded-sm border text-[11px] font-semibold transition-colors',
              isBalanced
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            )}
            title={`Debits (₦${fmt(totalDebits)}) vs Credits (₦${fmt(totalCredits)})`}
          >
            {isBalanced ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : (
              <AlertCircle className="h-3 w-3 shrink-0" />
            )}
            <span>{isBalanced ? 'Balanced' : `Variance: ₦${difference.toLocaleString()}`}</span>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportTrialBalance}
            title="Export Trial Balance to Excel (.xlsx)"
            className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* ── Metadata Strip (Clean Excel Style) ── */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-sm px-3 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300 gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {companyInfo.name}
          </span>
          {companyInfo.regNumber && <span>· {companyInfo.regNumber}</span>}
          <span>· Reporting: Years [{filterYears.join(', ')}] | Months [{filterMonths.join(', ')}]</span>
          {filterClient && filterClient !== 'All' && <span>· Client: {filterClient}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Currency: NGN (₦)</span>
          <span className="font-bold text-slate-900 dark:text-white">
            Debits: ₦{fmt(totalDebits)}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            Credits: ₦{fmt(totalCredits)}
          </span>
        </div>
      </div>

      {/* ── Compact Minimalist Trial Balance Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px] min-w-[850px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-1.5 px-3 w-16 font-mono">Code</th>
                <th className="py-1.5 px-3 w-64">Account Title</th>
                <th className="py-1.5 px-3">Audit Source &amp; Ledger Justification</th>
                <th className="py-1.5 px-2 w-20 text-center">Type</th>
                <th className="py-1.5 px-3 text-right font-mono font-bold w-36 text-slate-900 dark:text-slate-100">
                  Debit (₦)
                </th>
                <th className="py-1.5 px-4 text-right font-mono font-bold w-36 text-slate-900 dark:text-slate-100">
                  Credit (₦)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic text-[11px]">
                    No active accounts found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => (
                  <tr
                    key={row.code}
                    id={`tb-row-${row.code}`}
                    onClick={() => setDrillRow(row)}
                    title="Click to view underlying source vouchers & audit rationale"
                    className={cn(
                      'hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer',
                      idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-900/40'
                    )}
                  >
                    <td className="py-1.5 px-3 font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">
                      {row.code}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted underline-offset-2">
                      {row.name}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-md">
                          {row.auditSource}
                        </span>
                        {row.entries.length > 0 && (
                          <span className="inline-block px-1 py-0.2 rounded-xs text-[9px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            {row.voucherCount ?? row.entries.length} records
                          </span>
                        )}
                        {row.notes && <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.2 rounded-xs text-[9px] font-mono uppercase font-bold',
                          row.type === 'ASSET' && 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
                          row.type === 'LIABILITY' && 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                          row.type === 'EQUITY' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                          row.type === 'INCOME' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                          row.type === 'EXPENSE' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                      {row.netDebit > 0 ? `₦${fmt(row.netDebit)}` : '—'}
                    </td>
                    <td className="py-1.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                      {row.netCredit > 0 ? `₦${fmt(row.netCredit)}` : '—'}
                    </td>
                  </tr>
                ))
              )}

              {/* Total Double-Underline Balancing Row */}
              <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-black bg-slate-100 dark:bg-slate-800 text-[12px]">
                <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  TRIAL BALANCE TOTALS
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                  ₦{fmt(totalDebits)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                  ₦{fmt(totalCredits)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-mono flex flex-wrap items-center justify-between gap-2">
          <span>* Standard 4-digit chart of accounts built from General Ledger vouchers, billed invoices and client payments. Balance B/F {includeBF ? 'included' : 'excluded'}.</span>
          <span>{companyInfo.name}</span>
        </div>
      </div>


      {drillRow && (
        <TransactionDrilldownDialog
          key={drillRow.code}
          open
          onClose={() => setDrillRow(null)}
          title={`${drillRow.code} · ${drillRow.name}`}
          subtitle={`${drillRow.netDebit > 0 ? `Debit balance ₦${fmt(drillRow.netDebit)}` : `Credit balance ₦${fmt(drillRow.netCredit)}`} · ${drillRow.auditSource}`}
          notes={drillRow.notes}
          entries={drillRow.entries}
        />
      )}
    </div>
  );
}
