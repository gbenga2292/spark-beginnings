import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent } from '@/src/components/ui/card';
import { 
  Download, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Landmark, 
  ArrowUpDown,
  History
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { supabase } from '@/src/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { cn } from '@/src/lib/utils';
import { normalizeDate, formatDisplayDate } from '@/src/lib/dateUtils';
import { useIncludeBroughtForward } from '@/src/hooks/useIncludeBroughtForward';
import { TransactionDrilldownDialog, type DrillEntry } from './TransactionDrilldownDialog';

interface DrillState {
  key: string;
  title: string;
  subtitle?: string;
  entries: DrillEntry[];
}

interface CompanyAccountStatementProps {
  filterYears: string[];
  filterMonths: string[];
  filterClient?: string;
}

interface StatementTransaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  displayDate: string; // dd/mm/yyyy
  refNo: string;
  type: 'credit' | 'debit'; // Credit = Money In (Deposits/Collections), Debit = Money Out (Expenses/Payments)
  accountBank: string;
  description: string;
  category: string;
  party: string; // Client or Vendor
  siteName: string;
  amount: number;
  creditAmount: number; // Inflow
  debitAmount: number; // Outflow
  runningBalance: number;
  source: Record<string, unknown>;
}

export function CompanyAccountStatement({
  filterYears,
  filterMonths,
  filterClient
}: CompanyAccountStatementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBank, setSelectedBank] = useState<string>('All');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [includeBF, setIncludeBF] = useIncludeBroughtForward();
  const [drill, setDrill] = useState<DrillState | null>(null);

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
        console.error('Failed to load company info in CompanyAccountStatement:', err);
      }
    })();
  }, []);

  const payments = useAppStore(s => s.payments);
  const ledgerEntries = useAppStore(s => s.ledgerEntries);
  const sites = useAppStore(s => s.sites);
  const ledgerBanks = useAppStore(s => s.ledgerBanks);

  // Distinct banks list from transactions & ledger bank constants
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    ledgerBanks.forEach(b => {
      if (b.name && b.name.trim()) set.add(b.name.trim());
    });
    payments.forEach(p => {
      const b = p.paidTo || (p as any).paidFromBank || (p as any).bank || 'Stanbic IBTC (Main Acct)';
      if (b && typeof b === 'string' && b.trim()) set.add(b.trim());
    });
    ledgerEntries.forEach(e => {
      if (e.bank && e.bank.trim()) set.add(e.bank.trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [ledgerBanks, payments, ledgerEntries]);

  // Dynamically calculate Opening Balance Brought Forward (B/F) from prior periods (e.g. 2025 collections)
  const { openingBF, bfEntries } = useMemo(() => {
    if (filterYears.length > 0 && !filterYears.includes('All')) {
      const minSelectedYear = Math.min(...filterYears.map(y => parseInt(y, 10)).filter(y => !isNaN(y)));
      
      const priorPayments = payments.filter(p => {
        if (!p.date) return false;
        const norm = normalizeDate(p.date);
        if (!norm) return false;
        const yr = parseInt(norm.substring(0, 4), 10);
        if (yr >= minSelectedYear) return false;
        if (selectedBank !== 'All') {
          const bankName = (p.paidTo || (p as any).paidFromBank || (p as any).bank || 'Stanbic IBTC (Main Acct)').trim();
          if (bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
        }
        return true;
      });

      const priorLedger = ledgerEntries.filter(e => {
        if (!e.date) return false;
        const norm = normalizeDate(e.date);
        if (!norm) return false;
        const yr = parseInt(norm.substring(0, 4), 10);
        if (yr >= minSelectedYear) return false;
        if (selectedBank !== 'All') {
          const bankName = (e.bank || 'Stanbic IBTC (Main Acct)').trim();
          if (bankName.toLowerCase() !== selectedBank.toLowerCase()) return false;
        }
        return true;
      });

      const priorCollections = priorPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const priorExpenses = priorLedger.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const entries: DrillEntry[] = [
        ...priorPayments.map(p => ({
          id: `pay-${p.id}`,
          date: p.date,
          ref: (p as any).receiptNo || p.reference || `RCT-${p.id.substring(0, 6).toUpperCase()}`,
          description: (p as any).notes || `Client Payment Collection - ${p.client || 'General'}`,
          party: p.client,
          site: p.site,
          bank: p.paidTo || (p as any).paidFromBank,
          amount: Number(p.amount || 0),
          side: 'credit' as const,
          details: p as unknown as Record<string, unknown>,
        })),
        ...priorLedger.map(e => ({
          id: `led-${e.id}`,
          date: e.date,
          ref: e.voucherNo || `VCH-${e.id.substring(0, 6).toUpperCase()}`,
          description: e.description || e.category || 'Expense voucher',
          party: e.vendor || e.client,
          site: e.site,
          category: e.category,
          bank: e.bank,
          amount: Number(e.amount || 0),
          side: 'debit' as const,
          details: e as unknown as Record<string, unknown>,
        })),
      ];

      // If priorLedger has 0 entries, do NOT assume 2025 expenses were ₦0!
      const hasPriorLedger = priorLedger.length > 0;
      return { 
        openingBF: hasPriorLedger ? priorCollections - priorExpenses : 0, 
        bfEntries: hasPriorLedger ? entries : [] as DrillEntry[] 
      };
    }
    return { openingBF: 0, bfEntries: [] as DrillEntry[] };
  }, [payments, ledgerEntries, filterYears, selectedBank]);

  const calculatedOpeningBalance = includeBF ? openingBF : 0;

  // Combined, Chronological Statement of all credits (money in) and debits (money out)
  const statement = useMemo(() => {
    const rawTxns: Omit<StatementTransaction, 'runningBalance'>[] = [];

    // 1. Process Client Payment Collections (Credits / Money In)
    payments.forEach(p => {
      if (!p.date) return;
      const bankName = (p.paidTo || (p as any).paidFromBank || (p as any).bank || 'Stanbic IBTC (Main Acct)').trim();

      // Bank filter
      if (selectedBank !== 'All' && bankName.toLowerCase() !== selectedBank.toLowerCase()) {
        return;
      }

      // Year & Month filter using normalizeDate
      const normDate = normalizeDate(p.date);
      if (!normDate) return;
      const txYear = normDate.substring(0, 4);
      if (filterYears.length > 0 && !filterYears.includes('All') && !filterYears.includes(txYear)) {
        return;
      }
      const txMonth = String(parseInt(normDate.substring(5, 7), 10));
      if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(txMonth)) {
        return;
      }

      // Client filter
      if (filterClient && filterClient !== 'All') {
        const clientName = (p.client || '').trim();
        if (clientName.toLowerCase() !== filterClient.trim().toLowerCase()) {
          return;
        }
      }

      const amt = Number(p.amount || 0);
      if (amt <= 0) return;

      rawTxns.push({
        id: `pay-${p.id}`,
        date: normDate,
        displayDate: formatDisplayDate(normDate),
        refNo: (p as any).receiptNo || (p as any).reference || `RCT-${p.id.substring(0, 6).toUpperCase()}`,
        type: 'credit',
        accountBank: bankName,
        description: (p as any).notes || `Client Payment Collection - ${p.client || 'General'}`,
        category: 'Client Payment / Collection',
        party: p.client || 'Client Settlement',
        siteName: p.site || (p as any).siteName || '—',
        amount: amt,
        creditAmount: amt,
        debitAmount: 0,
        source: p as unknown as Record<string, unknown>,
      });
    });

    // 2. Process Ledger Expenses / Vouchers (Debits / Money Out)
    ledgerEntries.forEach(e => {
      if (!e.date) return;
      const bankName = (e.bank || 'Stanbic IBTC (Main Acct)').trim();

      // Bank filter
      if (selectedBank !== 'All' && bankName.toLowerCase() !== selectedBank.toLowerCase()) {
        return;
      }

      // Year & Month filter using normalizeDate
      const normDate = normalizeDate(e.date);
      if (!normDate) return;
      const txYear = normDate.substring(0, 4);
      if (filterYears.length > 0 && !filterYears.includes('All') && !filterYears.includes(txYear)) {
        return;
      }
      const txMonth = String(parseInt(normDate.substring(5, 7), 10));
      if (filterMonths.length > 0 && !filterMonths.includes('All') && !filterMonths.includes(txMonth)) {
        return;
      }

      // Client filter
      if (filterClient && filterClient !== 'All') {
        const entryClient = (e.client || sites.find(s => s.name?.toLowerCase() === e.site?.trim().toLowerCase())?.client || '').trim();
        if (entryClient.toLowerCase() !== filterClient.trim().toLowerCase()) {
          return;
        }
      }

      const amt = Number(e.amount || 0);
      if (amt <= 0) return;

      rawTxns.push({
        id: `led-${e.id}`,
        date: normDate,
        displayDate: formatDisplayDate(normDate),
        refNo: e.voucherNo || `VCH-${e.id.substring(0, 6).toUpperCase()}`,
        type: 'debit',
        accountBank: bankName,
        description: e.description || e.category || 'General Operating Expense',
        category: e.category || 'Direct Operational Expense',
        party: e.vendor || e.client || 'Expense Voucher',
        siteName: e.site || 'General Overhead',
        amount: amt,
        creditAmount: 0,
        debitAmount: amt,
        source: e as unknown as Record<string, unknown>,
      });
    });

    // 3. Sort Chronologically (oldest to newest for progressive bank statement running balance)
    rawTxns.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.refNo.localeCompare(b.refNo);
    });

    // 4. Calculate progressive Running Balance starting from opening balance
    let currentBalance = calculatedOpeningBalance;
    const computedTxns: StatementTransaction[] = rawTxns.map(tx => {
      currentBalance = currentBalance + tx.creditAmount - tx.debitAmount;
      return {
        ...tx,
        runningBalance: currentBalance,
      };
    });

    return computedTxns;
  }, [payments, ledgerEntries, sites, selectedBank, filterYears, filterMonths, filterClient, calculatedOpeningBalance]);

  // Filtered transactions for display (supports search & credit/debit filter)
  const displayTransactions = useMemo(() => {
    return statement.filter(tx => {
      if (transactionTypeFilter === 'credit' && tx.type !== 'credit') return false;
      if (transactionTypeFilter === 'debit' && tx.type !== 'debit') return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesRef = tx.refNo.toLowerCase().includes(q);
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesParty = tx.party.toLowerCase().includes(q);
        const matchesSite = tx.siteName.toLowerCase().includes(q);
        const matchesCat = tx.category.toLowerCase().includes(q);
        const matchesBank = tx.accountBank.toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc && !matchesParty && !matchesSite && !matchesCat && !matchesBank) {
          return false;
        }
      }
      return true;
    });
  }, [statement, transactionTypeFilter, searchTerm]);

  // Overall Statement Totals
  const summaryTotals = useMemo(() => {
    const totalCredits = statement.reduce((sum, tx) => sum + tx.creditAmount, 0);
    const totalDebits = statement.reduce((sum, tx) => sum + tx.debitAmount, 0);
    const netChange = totalCredits - totalDebits;
    const closingBalance = calculatedOpeningBalance + netChange;
    return {
      openingBalance: calculatedOpeningBalance,
      totalCredits,
      totalDebits,
      netChange,
      closingBalance,
      txCount: statement.length,
      creditCount: statement.filter(tx => tx.type === 'credit').length,
      debitCount: statement.filter(tx => tx.type === 'debit').length,
    };
  }, [statement, calculatedOpeningBalance]);

  // Excel Export
  const handleExportStatement = () => {
    const rows: any[] = [];
    rows.push({ [companyInfo.name]: 'COMPANY ACCOUNT STATEMENT (BANK STATEMENT FORMAT)' });
    if (companyInfo.regNumber) rows.push({ [companyInfo.name]: `Registration No: ${companyInfo.regNumber}` });
    if (companyInfo.address) rows.push({ [companyInfo.name]: companyInfo.address });
    rows.push({ 'Account / Bank': selectedBank === 'All' ? 'Consolidated (All Accounts)' : selectedBank });
    rows.push({ 'Period': `${filterYears.join(', ')} · Months: ${filterMonths.join(', ')}` });
    rows.push({});
    rows.push({
      'Date': 'DATE',
      'Ref / Voucher': 'REF / VOUCHER NO',
      'Bank Account': 'BANK ACCOUNT',
      'Narration / Description': 'DESCRIPTION / PARTICULARS',
      'Category': 'CATEGORY',
      'Party': 'CLIENT / VENDOR',
      'Site': 'SITE',
      'Deposits / Credit (NGN)': 'MONEY IN / DEPOSITS (CREDIT NGN)',
      'Withdrawals / Debit (NGN)': 'MONEY OUT / EXPENSES (DEBIT NGN)',
      'Running Balance (NGN)': 'RUNNING BALANCE (NGN)',
    });

    if (calculatedOpeningBalance !== 0) {
      rows.push({
        'Date': `01/01/${filterYears[0] || '2026'}`,
        'Ref / Voucher': 'B/F-0001',
        'Bank Account': selectedBank === 'All' ? 'Consolidated Bank Float' : selectedBank,
        'Narration / Description': 'Balance Brought Forward (Prior Year Collections)',
        'Category': 'Opening Balance B/F',
        'Party': 'Prior Period Surplus',
        'Site': '—',
        'Deposits / Credit (NGN)': calculatedOpeningBalance > 0 ? calculatedOpeningBalance : '',
        'Withdrawals / Debit (NGN)': calculatedOpeningBalance < 0 ? -calculatedOpeningBalance : '',
        'Running Balance (NGN)': calculatedOpeningBalance,
      });
    }

    statement.forEach(tx => {
      rows.push({
        'Date': tx.displayDate,
        'Ref / Voucher': tx.refNo,
        'Bank Account': tx.accountBank,
        'Narration / Description': tx.description,
        'Category': tx.category,
        'Party': tx.party,
        'Site': tx.siteName,
        'Deposits / Credit (NGN)': tx.creditAmount > 0 ? tx.creditAmount : '',
        'Withdrawals / Debit (NGN)': tx.debitAmount > 0 ? tx.debitAmount : '',
        'Running Balance (NGN)': tx.runningBalance,
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Account Statement');
    const safeName = (companyInfo.name || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_Account_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── Statement Container ── */}
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
                Company Account Statement
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 font-mono mt-1">
                <span>
                  Account: {selectedBank === 'All' ? 'Consolidated Bank Accounts' : selectedBank}
                </span>
                <span>· Period: {filterYears.length > 0 && !filterYears.includes('All') ? filterYears.join(', ') : 'All Time'}</span>
                {filterMonths.length > 0 && !filterMonths.includes('All') && <span>· Months: {filterMonths.join(', ')}</span>}
                {filterClient && filterClient !== 'All' && <span>· Client: {filterClient}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportStatement}
                className="h-8 text-xs font-semibold border-slate-300 dark:border-slate-700 gap-1.5 rounded-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Statement</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Top Financial Metric Cards (5-Card Comprehensive Bank Statement Style) ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {/* Opening Balance (B/F) */}
          <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-sm shadow-xs">
            <CardContent className="p-3.5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Opening Balance (B/F)</span>
                <div className="p-1 rounded-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <History className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                ₦{summaryTotals.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">{includeBF ? 'Prior Year Balance' : 'B/F excluded'}</span>
            </CardContent>
          </Card>

          {/* Total Money In (Credit) */}
          <Card className="border-slate-200 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200/60 rounded-sm shadow-xs">
            <CardContent className="p-3.5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">Money In (Collections)</span>
                <div className="p-1 rounded-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +₦{summaryTotals.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-emerald-600/80 font-mono mt-0.5">{summaryTotals.creditCount} Client Payments</span>
            </CardContent>
          </Card>

          {/* Total Money Out (Debit) */}
          <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-sm shadow-xs">
            <CardContent className="p-3.5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Money Out (Debits)</span>
                <div className="p-1 rounded-xs bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                -₦{summaryTotals.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">{summaryTotals.debitCount} Ledger Vouchers</span>
            </CardContent>
          </Card>

          {/* Net Flow */}
          <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-sm shadow-xs">
            <CardContent className="p-3.5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Net Period Movement</span>
                <div className="p-1 rounded-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={cn("font-mono text-base sm:text-lg font-bold tabular-nums", summaryTotals.netChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {summaryTotals.netChange >= 0 ? '+' : '-'}₦{Math.abs(summaryTotals.netChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">Collections less Vouchers</span>
            </CardContent>
          </Card>

          {/* Closing Running Balance */}
          <Card className="border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-800 text-white rounded-sm shadow-xs col-span-2 md:col-span-1">
            <CardContent className="p-3.5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-mono">Closing Cash Position</span>
                <div className="p-1 rounded-xs bg-white/10 text-white">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-base sm:text-lg font-bold text-white tabular-nums">
                ₦{summaryTotals.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5">Reconciled Corporate Bank Balance</span>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters & Controls Bar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-sm">
          {/* Bank Selector & Transaction Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Bank:</span>
              <select
                value={selectedBank}
                onChange={e => setSelectedBank(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm px-2.5 py-1 font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="All">All Bank Accounts (Consolidated)</option>
                {availableBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            <div className="flex border border-slate-200 dark:border-slate-700 rounded-sm overflow-hidden p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setTransactionTypeFilter('all')}
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold rounded-xs transition-colors",
                  transactionTypeFilter === 'all' ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-800"
                )}
              >
                All ({summaryTotals.txCount})
              </button>
              <button
                type="button"
                onClick={() => setTransactionTypeFilter('credit')}
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold rounded-xs transition-colors",
                  transactionTypeFilter === 'credit' ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-emerald-600"
                )}
              >
                Deposits / Money In ({summaryTotals.creditCount})
              </button>
              <button
                type="button"
                onClick={() => setTransactionTypeFilter('debit')}
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold rounded-xs transition-colors",
                  transactionTypeFilter === 'debit' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Expenses (Debits) ({summaryTotals.debitCount})
              </button>
            </div>

            <label
              htmlFor="stmt-include-bf"
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none px-2.5 py-1 rounded-sm border",
                includeBF
                  ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                  : "border-slate-300 dark:border-slate-700 text-slate-500"
              )}
            >
              <input
                id="stmt-include-bf"
                type="checkbox"
                checked={includeBF}
                onChange={e => setIncludeBF(e.target.checked)}
                className="accent-slate-900"
              />
              <History className="w-3.5 h-3.5" />
              Include Balance B/F
            </label>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search ref, client, payee, site, description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-sm"
            />
          </div>
        </div>

        {/* ── Transaction Ledger Table (Chronological Bank Statement) ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[950px]">
            <thead>
              <tr className="border-b-2 border-slate-900 dark:border-slate-100 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                <th className="py-2.5 px-3 w-24">Date</th>
                <th className="py-2.5 px-2 w-28 font-mono">Ref / Voucher</th>
                <th className="py-2.5 px-3">Narration & Particulars</th>
                <th className="py-2.5 px-2">Account / Bank</th>
                <th className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">Money Out (Debit ₦)</th>
                <th className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">Money In (Credit ₦)</th>
                <th className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100 w-36">Running Balance (₦)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {/* Prior Year Balance Brought Forward row if applicable */}
              {calculatedOpeningBalance !== 0 && transactionTypeFilter === 'all' && !searchTerm && (
                <tr
                  id="stmt-row-bf"
                  title="Click to view the prior-period records behind this balance"
                  onClick={() => setDrill({
                    key: 'bf',
                    title: 'Balance Brought Forward',
                    subtitle: `Prior-period collections less vouchers paid · ${selectedBank === 'All' ? 'All banks' : selectedBank} · Net ₦${calculatedOpeningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    entries: bfEntries,
                  })}
                  className="bg-slate-50/80 dark:bg-slate-800/60 font-semibold border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500">
                    01/01/{filterYears[0] || '2026'}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-500 underline decoration-dotted underline-offset-2">
                    B/F-0001
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Balance Brought Forward (Prior Year Collections)
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Net prior-period collections less vouchers paid · {bfEntries.length} records
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-slate-500 text-[11px]">
                    {selectedBank === 'All' ? 'Consolidated Bank Float' : selectedBank}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-100 font-bold">
                    {calculatedOpeningBalance < 0 ? `-₦${Math.abs(calculatedOpeningBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {calculatedOpeningBalance > 0 ? `+₦${calculatedOpeningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    ₦{calculatedOpeningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}

              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    No transactions match the selected account and filters.
                  </td>
                </tr>
              ) : (
                displayTransactions.map((tx) => (
                  <tr 
                    key={tx.id}
                    id={`stmt-row-${tx.id}`}
                    title="Click to view full voucher content"
                    onClick={() => setDrill({
                      key: tx.id,
                      title: `${tx.type === 'credit' ? 'Receipt' : 'Voucher'} ${tx.refNo}`,
                      subtitle: `${tx.displayDate} · ${tx.accountBank} · ${tx.category}`,
                      entries: [{
                        id: tx.id,
                        date: tx.date,
                        ref: tx.refNo,
                        description: tx.description,
                        party: tx.party,
                        site: tx.siteName,
                        category: tx.category,
                        bank: tx.accountBank,
                        amount: tx.amount,
                        side: tx.type,
                        details: tx.source,
                      }],
                    })}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {tx.displayDate}
                    </td>
                    <td className="py-2 px-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap underline decoration-dotted underline-offset-2">
                      {tx.refNo}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {tx.description}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-wrap gap-x-2">
                        <span>Party: {tx.party}</span>
                        <span>· Site: {tx.siteName}</span>
                        <span>· Category: {tx.category}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {tx.accountBank}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {tx.debitAmount > 0 ? (
                        <span className="text-slate-900 dark:text-slate-100 font-medium">
                          -₦{tx.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {tx.creditAmount > 0 ? (
                        <span>
                          +₦{tx.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      ₦{tx.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}

              {/* Final Statement Closing Row */}
              <tr className="border-t-2 border-b-4 border-double border-slate-900 dark:border-slate-100 font-black bg-slate-100 dark:bg-slate-800 text-xs">
                <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  CLOSING STATEMENT TOTALS & POSITION
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-900 dark:text-slate-100">
                  -₦{summaryTotals.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  +₦{summaryTotals.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                  ₦{summaryTotals.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
          <span>* Progressive transaction ledger reconciled against client collections and registered expense vouchers.</span>
          <span>{companyInfo.name} · Verified Cashflow & Account Statement</span>
        </div>
      </div>

      {drill && (
        <TransactionDrilldownDialog
          key={drill.key}
          open
          onClose={() => setDrill(null)}
          title={drill.title}
          subtitle={drill.subtitle}
          entries={drill.entries}
          debitLabel="Money Out (₦)"
          creditLabel="Money In (₦)"
        />
      )}
    </div>
  );
}
