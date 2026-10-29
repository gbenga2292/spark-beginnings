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
} from 'lucide-react';
import { useAppStore, type Invoice, type LedgerEntry, type Payment } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate } from '@/src/lib/dateUtils';
import { useIncludeBroughtForward } from '@/src/hooks/useIncludeBroughtForward';
import { TransactionDrilldownDialog, type DrillEntry } from './TransactionDrilldownDialog';

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

    // DIRECT COSTS & OPEX (From Ledger)
    const expenseRows: [string, string, string, ReturnType<typeof getCat>, string][] = [
      ['5010', 'Direct Labor — Field Technicians & Staff Payroll', 'DIRECT_COST', directLabor, 'Payroll & staff salary disbursement'],
      ['5020', 'Site Materials & Direct Consumables Consumed', 'DIRECT_COST', siteMaterials, 'Direct site material & goods procurement'],
      ['5030', 'Site Diesel & Vehicle Fuel Consumed', 'DIRECT_COST', fuelExpense, 'Fuel & diesel purchase'],
      ['5040', 'Subcontractor & Project Reimbursable Expenses', 'DIRECT_COST', reimbursableExp, 'Re-embursable project expense'],
      ['5050', 'Equipment Mobilization & Local Transport Cost', 'DIRECT_COST', localTransport, 'Local transport & transit'],
      ['5060', 'Dewatering Equipment Running Maintenance & Repairs', 'DIRECT_COST', machineMaint, 'Dewatering pump maintenance & repair'],
      ['5120', 'Office Rent & Yard Maintenance', 'OPERATING_EXPENSE', premisesMaint, 'Office, yard & premises maintenance'],
      ['5130', 'Utilities & Communications', 'OPERATING_EXPENSE', utilitiesExp, 'Power, telecom & internet service'],
      ['5140', 'Motor Vehicles & Heavy Logistics Trucks Running', 'OPERATING_EXPENSE', logisticsExp, 'Truck & fleet logistics maintenance'],
      ['5150', 'Legal, Audit & Professional Fees', 'OPERATING_EXPENSE', professionalExp, 'Professional, legal & audit fee'],
      ['5160', 'Bank Charges & Financing Interest Expense', 'OPERATING_EXPENSE', financeExp, 'Interest expense & bank charge'],
      ['5170', 'General Administration & Operating Overhead', 'OPERATING_EXPENSE', overheadExp, 'Admin, CSR, medical & overhead'],
    ];
    expenseRows.forEach(([code, name, cat, data, desc]) =>
      addRow(code, name, 'EXPENSE', cat, data.sum, 0, `${data.count} ${desc} vouchers in Ledger`, data.entries, data.count));

    // REVENUE (From Billed Invoices)
    addRow('4000', 'Revenue — Dewatering Equipment Rental Fleet', 'INCOME', 'REVENUE',
      0, sumLine('rental'), `${inPeriodInvoices.length} Client invoices — Equipment rental billing line`, lineEntries('rental', 'Equipment rental'));
    addRow('4010', 'Revenue — Site Installation & Piping Setup', 'INCOME', 'REVENUE',
      0, sumLine('installation'), 'Client invoices — Site installation & ground setup billing line', lineEntries('installation', 'Installation'));
    addRow('4020', 'Revenue — Mobilization & Demobilization', 'INCOME', 'REVENUE',
      0, sumLine('mob'), 'Client invoices — Mobilization & demobilization billing line', lineEntries('mob', 'Mob / Demob'));
    addRow('4030', 'Revenue — Diesel Supply Billing', 'INCOME', 'REVENUE',
      0, sumLine('diesel'), 'Client invoices — Site diesel supply billing line', lineEntries('diesel', 'Diesel supply'));
    addRow('4040', 'Revenue — Field Operations & Technicians Fee', 'INCOME', 'REVENUE',
      0, sumLine('tech'), 'Client invoices — Technical operator supervision billing line', lineEntries('tech', 'Technicians fee'));

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
  }, [invoices, payments, ledgerEntries, vendorInvoices, vendorInvoicePayments, sites, filterYears, filterMonths, filterClient, includeBF]);

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
    <div className="space-y-6">
      {/* ── Formal Container ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-xs p-6 sm:p-8">
        
        {/* Header */}
        <div className="border-b border-slate-300 dark:border-slate-700 pb-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-mono text-slate-700 dark:text-slate-300 font-bold">
                  {companyInfo.name}
                </span>
                {companyInfo.regNumber && (
                  <span className="text-[10px] font-mono text-slate-400 font-medium">
                    · {companyInfo.regNumber}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mt-1">
                Trial Balance
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 font-mono mt-1">
                <span>
                  Period: {filterYears.length > 0 && !filterYears.includes('All') ? filterYears.join(', ') : 'All Time'} 
                  {filterMonths.length > 0 && !filterMonths.includes('All') ? ` · Months: ${filterMonths.join(', ')}` : ''} 
                  {filterClient && filterClient !== 'All' ? ` · Client: ${filterClient}` : ''}
                </span>
                {companyInfo.address && <span>· {companyInfo.address}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTrialBalance}
                className="h-8 text-xs font-semibold border-slate-300 dark:border-slate-700 gap-1.5 rounded-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Trial Balance</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Equilibrium Status Strip ── */}
        <div className="mb-6 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded shrink-0",
                isBalanced 
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
              )}>
                {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {isBalanced ? 'Trial Balance is in Perfect Equilibrium' : 'Trial Balance Variance Detected'}
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-mono",
                    isBalanced 
                      ? "border-emerald-300 text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-amber-300 text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
                  )}>
                    {isBalanced ? 'Debits = Credits' : `Variance: ₦${difference.toLocaleString()}`}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Total Debits of ₦{fmt(totalDebits)} reconcile against Total Credits. Click any account to see the vouchers, invoices and payments behind it.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Debits</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  ₦{fmt(totalDebits)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Credits</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  ₦{fmt(totalCredits)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters & Controls Bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-sm">
          {/* Account Classification Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 font-mono">Class:</span>
            {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(cls => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedType(cls)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors capitalize",
                  selectedType === cls
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {cls === 'ALL' ? 'All Accounts' : cls.toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Balance B/F toggle */}
            <label
              htmlFor="tb-include-bf"
              className={cn(
                "flex items-center gap-2 text-xs font-semibold cursor-pointer select-none px-2.5 py-1 rounded-sm border",
                includeBF
                  ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                  : "border-slate-300 dark:border-slate-700 text-slate-500"
              )}
              title={
                hasPriorLedger
                  ? (includeBF ? 'Prior-year balances brought forward included' : 'Click to include prior-year balances brought forward')
                  : 'Prior-year ledger vouchers are not yet in database. Kept off to maintain accurate in-period records.'
              }
            >
              <input
                id="tb-include-bf"
                type="checkbox"
                checked={includeBF}
                onChange={e => setIncludeBF(e.target.checked)}
                className="accent-slate-900"
              />
              <History className="w-3.5 h-3.5" />
              Include Balance B/F
            </label>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search code, title, or audit source..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Trial Balance Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-slate-900 dark:border-slate-100 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                <th className="py-2.5 px-3 w-16 font-mono">Code</th>
                <th className="py-2.5 px-3 w-56">Account Title & Classification</th>
                <th className="py-2.5 px-3">Audit Source & Ledger Justification</th>
                <th className="py-2.5 px-3 w-24 text-center">Type</th>
                <th className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 w-40">Debit Balance (₦)</th>
                <th className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 w-40">Credit Balance (₦)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No active accounts found for the selected classification.
                  </td>
                </tr>
              ) : (
                displayRows.map(row => (
                  <tr 
                    key={row.code}
                    id={`tb-row-${row.code}`}
                    onClick={() => setDrillRow(row)}
                    title="Click to view source vouchers"
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {row.code}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-700 dark:text-slate-300">{row.auditSource}</span>
                        {row.entries.length > 0 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-slate-300 dark:border-slate-700 font-mono text-slate-500 underline-offset-2 hover:underline">
                            {row.voucherCount ?? row.entries.length} records
                          </Badge>
                        )}
                        {row.notes && <AlertCircle className="w-3 h-3 text-amber-500" />}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-xs text-[10px] font-mono uppercase font-bold",
                        row.type === 'ASSET' && "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
                        row.type === 'LIABILITY' && "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                        row.type === 'EQUITY' && "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        row.type === 'INCOME' && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                        row.type === 'EXPENSE' && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                      )}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-semibold tabular-nums hover:underline">
                      {row.netDebit > 0 ? `₦${fmt(row.netDebit)}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-semibold tabular-nums hover:underline">
                      {row.netCredit > 0 ? `₦${fmt(row.netCredit)}` : '—'}
                    </td>
                  </tr>
                ))
              )}

              {/* Total Double-Underline Balancing Row */}
              <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-black bg-slate-100 dark:bg-slate-800 text-xs">
                <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  TRIAL BALANCE TOTALS
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                  ₦{fmt(totalDebits)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                  ₦{fmt(totalCredits)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
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
