import { useState, useMemo, useEffect } from 'react';
import { useAppStore, PettyCashEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { generateId, cn } from '@/src/lib/utils';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/src/components/ui/dialog';
import {
  Plus,
  Settings2,
  Search,
  Download,
  Trash2,
  Edit2,
  ArrowUpDown,
  X,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PieChart,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface StatementRow {
  id: string;
  date: string;
  description: string;
  paidFrom: string;
  paidTo: string;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  sourceType: 'in' | 'out' | 'bf';
  voucherNo?: string;
  category?: string;
  site?: string;
  enteredBy?: string;
  createdAt?: string;
  rawInEntry?: PettyCashEntry;
  isBroughtForward?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function fmtAmount(n: number): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function PettyCash() {
  const priv = usePriv('ledger');
  const currentUser = useUserStore((s) => s.getCurrentUser());

  const ledgerEntries = useAppStore((s) => s.ledgerEntries);
  const deleteLedgerEntry = useAppStore((s) => s.deleteLedgerEntry);
  const payrollVariables = useAppStore((s) => s.payrollVariables);
  const vatRate = payrollVariables?.vatRate ?? 7.5;
  const ledgerBanks = useAppStore((s) => s.ledgerBanks);
  const ledgerBeneficiaryBanks = useAppStore((s) => s.ledgerBeneficiaryBanks);
  const pettyCashEntries = useAppStore((s) => s.pettyCashEntries);
  const pettyCashBanks = useAppStore((s) => s.pettyCashBanks);
  const addPettyCashEntry = useAppStore((s) => s.addPettyCashEntry);
  const updatePettyCashEntry = useAppStore((s) => s.updatePettyCashEntry);
  const deletePettyCashEntry = useAppStore((s) => s.deletePettyCashEntry);
  const setPettyCashBanks = useAppStore((s) => s.setPettyCashBanks);
  const fetchLedgerYearIfNeeded = useAppStore((s) => s.fetchLedgerYearIfNeeded);

  // Filter & view states (mounted in Header) — persist selectedPeriod across navigation
  const [search, setSearch] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dcel_petty_cash_selected_period');
      if (saved && (saved === 'ALL' || /^\d{4}-\d{2}$/.test(saved))) {
        return saved;
      }
    } catch {
      /* ignore */
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pickerYear, setPickerYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dcel_petty_cash_selected_period');
      if (saved && /^\d{4}-\d{2}$/.test(saved)) {
        const y = parseInt(saved.slice(0, 4), 10);
        if (!isNaN(y)) return y;
      }
    } catch {
      /* ignore */
    }
    return new Date().getFullYear();
  });
  const [periodModalOpen, setPeriodModalOpen] = useState(false);

  // Persist selectedPeriod whenever it changes so returning to Petty Cash keeps the chosen month
  useEffect(() => {
    try {
      localStorage.setItem('dcel_petty_cash_selected_period', selectedPeriod);
    } catch {
      /* ignore */
    }
  }, [selectedPeriod]);

  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Ensure current and selected year ledger entries are loaded
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    fetchLedgerYearIfNeeded(currentYear);
    fetchLedgerYearIfNeeded(currentYear - 1);
  }, [fetchLedgerYearIfNeeded]);

  useEffect(() => {
    if (selectedPeriod && selectedPeriod !== 'ALL') {
      const y = parseInt(selectedPeriod.slice(0, 4), 10);
      if (!isNaN(y) && y > 2000 && y < 2100) {
        fetchLedgerYearIfNeeded(y);
      }
    }
  }, [selectedPeriod, fetchLedgerYearIfNeeded]);

  // Modals state
  const [moneyInOpen, setMoneyInOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PettyCashEntry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftBanks, setDraftBanks] = useState<string[]>([]);
  const [dialogVoucher, setDialogVoucher] = useState<string | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const dialogTransactions = useMemo(() => {
    if (!dialogVoucher) return [];
    return ledgerEntries.filter((e) => e.voucherNo === dialogVoucher);
  }, [dialogVoucher, ledgerEntries]);

  const computeLineVat = (amt: number, mode?: string, rate: number = vatRate) => {
    if (!mode || mode === 'No' || !amt || amt <= 0) {
      return { vatAmount: 0, amountForVat: amt || 0, grossAmount: amt || 0 };
    }
    if (mode === 'Yes') {
      const vatAmount = (amt * rate) / 100;
      return { vatAmount, amountForVat: amt, grossAmount: amt + vatAmount };
    }
    if (mode === 'Add') {
      const vatAmount = (amt * rate) / (100 + rate);
      const amountForVat = amt - vatAmount;
      return { vatAmount, amountForVat, grossAmount: amt };
    }
    return { vatAmount: 0, amountForVat: amt || 0, grossAmount: amt || 0 };
  };

  const dialogNetTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      if (mode === 'No') return acc + amt;
      return acc + (curr.amountForVat ?? calc.amountForVat);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogVatTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      return acc + (curr.vatAmount ?? calc.vatAmount);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogGrossTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = computeLineVat(amt, mode, curr.vatRate || vatRate);
      return acc + calc.grossAmount;
    }, 0);
  }, [dialogTransactions, vatRate]);

  // Money In Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaidFromSelect, setFormPaidFromSelect] = useState('');
  const [formPaidFromCustom, setFormPaidFromCustom] = useState('');
  const [formPaidToSelect, setFormPaidToSelect] = useState('Petty Cash');
  const [formPaidToCustom, setFormPaidToCustom] = useState('');

  // Human-readable label for the selected month filter button
  const periodLabel = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'ALL') return 'All Time';
    const [yStr, mStr] = selectedPeriod.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    return `${SHORT_MONTHS[mIdx] || mStr} ${yStr}`;
  }, [selectedPeriod]);

  const fullPeriodLabel = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'ALL') return 'All Time';
    const [yStr, mStr] = selectedPeriod.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const lastDay = new Date(y, m, 0).getDate();
    return `${MONTH_NAMES[m - 1]} ${yStr} (01 - ${lastDay} ${SHORT_MONTHS[m - 1]})`;
  }, [selectedPeriod]);

  // All distinct Paid From (bank) options present in Ledger Banks + Ledger Entries
  const availableLedgerBanks = useMemo(() => {
    const stats = new Map<string, { count: number; total: number }>();
    ledgerBanks.forEach((b) => {
      if (b.name) stats.set(b.name.trim(), { count: 0, total: 0 });
    });
    ledgerEntries.forEach((e) => {
      const b = (e.bank || '').trim();
      if (!b) return;
      const cur = stats.get(b) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(e.amount) || 0;
      stats.set(b, cur);
    });
    return Array.from(stats.entries())
      .map(([name, info]) => ({ name, count: info.count, total: info.total }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgerBanks, ledgerEntries]);

  // Paid From variable options (from Ledger Banks + historical Paid Froms)
  const paidFromOptions = useMemo(() => {
    const set = new Set<string>();
    ledgerBanks.forEach((b) => {
      if (b.name?.trim()) set.add(b.name.trim());
    });
    availableLedgerBanks.forEach((b) => {
      if (b.name?.trim()) set.add(b.name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ledgerBanks, availableLedgerBanks]);

  // Paid To variable options (from Ledger Beneficiary Banks + Petty Cash Banks)
  const paidToOptions = useMemo(() => {
    const set = new Set<string>();
    (pettyCashBanks || []).forEach((b) => {
      if (b?.trim()) set.add(b.trim());
    });
    (ledgerBeneficiaryBanks || []).forEach((b) => {
      if (b.name?.trim()) set.add(b.name.trim());
    });
    if (set.size === 0) set.add('Petty Cash');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pettyCashBanks, ledgerBeneficiaryBanks]);

  const activePettyCashBankSet = useMemo(() => {
    return new Set((pettyCashBanks || []).map((b) => b.trim().toLowerCase()));
  }, [pettyCashBanks]);

  // Calculate previous and next month human-readable labels
  const { prevMonthLabel, nextMonthLabel } = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'ALL') {
      return { prevMonthLabel: '', nextMonthLabel: '' };
    }
    const [yStr, mStr] = selectedPeriod.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(y) || isNaN(m)) return { prevMonthLabel: '', nextMonthLabel: '' };

    let prevM = m - 1;
    let prevY = y;
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    const pLabel = `${MONTH_NAMES[prevM - 1]} ${prevY}`;

    let nextM = m + 1;
    let nextY = y;
    if (nextM === 13) {
      nextM = 1;
      nextY += 1;
    }
    const nLabel = `${MONTH_NAMES[nextM - 1]} ${nextY}`;

    return { prevMonthLabel: pLabel, nextMonthLabel: nLabel };
  }, [selectedPeriod]);

  // Cumulative Balance Brought Forward (b/f) from all prior periods before the 1st of selected month
  // Zero-deficit rule: if prior balance is negative (deficit), cap at 0.00
  const balanceBroughtForward = useMemo(() => {
    if (!selectedPeriod || selectedPeriod === 'ALL') return 0;
    const periodStart = `${selectedPeriod}-01`;

    let priorIn = 0;
    (pettyCashEntries || []).forEach((e) => {
      const d = (e.date || '').split('T')[0];
      if (d && d < periodStart) {
        priorIn += Number(e.amount) || 0;
      }
    });

    let priorOut = 0;
    (ledgerEntries || []).forEach((le) => {
      const d = (le.date || '').split('T')[0];
      if (!d || d >= periodStart) return;
      const bankNorm = (le.bank || '').trim().toLowerCase();
      if (!bankNorm || !activePettyCashBankSet.has(bankNorm)) return;
      priorOut += Number(le.amount) || 0;
    });

    const rawDiff = priorIn - priorOut;
    return Math.max(0, rawDiff);
  }, [selectedPeriod, pettyCashEntries, ledgerEntries, activePettyCashBankSet]);

  // Build monthly statement with Balance b/f row (Row 1) and continuous running balance
  const {
    displayRows,
    periodMoneyIn,
    periodMoneyOut,
    closingBalance,
    totalCount,
  } = useMemo(() => {
    const rawRows: Omit<StatementRow, 'balance'>[] = [];

    // 1. Money In rows (from pettyCashEntries)
    (pettyCashEntries || []).forEach((entry) => {
      const d = (entry.date || '').split('T')[0];
      if (!d) return;
      if (selectedPeriod !== 'ALL' && !d.startsWith(selectedPeriod)) return;

      rawRows.push({
        id: `in-${entry.id}`,
        date: d,
        description: entry.description || 'Petty Cash Top-up',
        paidFrom: entry.paidFrom || '—',
        paidTo: entry.paidTo || 'Petty Cash',
        moneyIn: Number(entry.amount) || 0,
        moneyOut: 0,
        sourceType: 'in',
        enteredBy: entry.enteredBy,
        createdAt: entry.createdAt,
        rawInEntry: entry,
      });
    });

    // 2. Money Out rows (automatically pulled from Ledger where bank matches pettyCashBanks)
    (ledgerEntries || []).forEach((le) => {
      const d = (le.date || '').split('T')[0];
      if (!d) return;
      if (selectedPeriod !== 'ALL' && !d.startsWith(selectedPeriod)) return;

      const bankNorm = (le.bank || '').trim().toLowerCase();
      if (!bankNorm || !activePettyCashBankSet.has(bankNorm)) return;

      const paidToParts = [
        le.vendor && le.vendor !== 'none' ? le.vendor : '',
        le.site && le.site !== 'none' ? le.site : '',
      ].filter(Boolean);

      rawRows.push({
        id: `out-${le.id}`,
        date: d,
        description: le.description || le.category || 'Ledger Expense',
        paidFrom: le.bank || '—',
        paidTo: paidToParts.length > 0 ? paidToParts.join(' · ') : le.category || 'Expense',
        moneyIn: 0,
        moneyOut: Number(le.amount) || 0,
        sourceType: 'out',
        voucherNo: le.voucherNo,
        category: le.category,
        site: le.site,
        enteredBy: le.enteredBy,
      });
    });

    // Sort strictly chronologically within the selected period (1st day -> last day).
    // On the same date, Money In comes before Money Out so replenishments cover same-day spend.
    rawRows.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.sourceType !== b.sourceType) return a.sourceType === 'in' ? -1 : 1;
      return (a.voucherNo || a.id).localeCompare(b.voucherNo || b.id);
    });

    const allWithBalance: StatementRow[] = [];
    let running = selectedPeriod !== 'ALL' ? balanceBroughtForward : 0;

    // When viewing a specific month, insert Row 1: Balance b/f from previous month
    if (selectedPeriod !== 'ALL') {
      allWithBalance.push({
        id: `bf-${selectedPeriod}`,
        date: `${selectedPeriod}-01`,
        description: `Balance b/f from ${prevMonthLabel || 'previous month'}`,
        paidFrom: '—',
        paidTo: 'Petty Cash',
        moneyIn: balanceBroughtForward,
        moneyOut: 0,
        balance: balanceBroughtForward,
        sourceType: 'bf',
        isBroughtForward: true,
      });
    }

    for (const r of rawRows) {
      running += r.moneyIn - r.moneyOut;
      allWithBalance.push({
        ...r,
        balance: running,
      });
    }

    const pIn = rawRows.filter((r) => r.sourceType === 'in').reduce((acc, r) => acc + r.moneyIn, 0);
    const pOut = rawRows.filter((r) => r.sourceType === 'out').reduce((acc, r) => acc + r.moneyOut, 0);
    const finalClosing = (selectedPeriod !== 'ALL' ? balanceBroughtForward : 0) + pIn - pOut;

    // Apply search and type filters for display
    const q = search.trim().toLowerCase();
    let filtered = allWithBalance.filter((r) => {
      if (typeFilter === 'out' && r.isBroughtForward) return false;
      if (typeFilter !== 'all' && !r.isBroughtForward && r.sourceType !== typeFilter) return false;
      if (q) {
        const match =
          r.description.toLowerCase().includes(q) ||
          r.paidFrom.toLowerCase().includes(q) ||
          r.paidTo.toLowerCase().includes(q) ||
          (r.voucherNo || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          String(r.moneyIn || r.moneyOut).includes(q);
        if (!match) return false;
      }
      return true;
    });

    if (sortOrder === 'desc') {
      filtered = [...filtered].reverse();
    }

    return {
      displayRows: filtered,
      periodMoneyIn: pIn,
      periodMoneyOut: pOut,
      closingBalance: finalClosing,
      totalCount: filtered.length,
    };
  }, [
    pettyCashEntries,
    ledgerEntries,
    activePettyCashBankSet,
    selectedPeriod,
    balanceBroughtForward,
    prevMonthLabel,
    search,
    typeFilter,
    sortOrder,
  ]);

  // Aggregated data for Monthly Summary Modal
  const summaryData = useMemo(() => {
    // 1. Period Money In entries
    const periodInEntries = (pettyCashEntries || []).filter((e) => {
      const d = (e.date || '').split('T')[0];
      if (!d) return false;
      return selectedPeriod === 'ALL' || d.startsWith(selectedPeriod);
    });

    // 2. Period Money Out entries
    const periodOutEntries = (ledgerEntries || []).filter((le) => {
      const d = (le.date || '').split('T')[0];
      if (!d) return false;
      if (selectedPeriod !== 'ALL' && !d.startsWith(selectedPeriod)) return false;
      const bankNorm = (le.bank || '').trim().toLowerCase();
      return bankNorm && activePettyCashBankSet.has(bankNorm);
    });

    // Expenses grouped by "Paid To"
    const payeeMap = new Map<string, { total: number; count: number; sampleCategory: string }>();
    periodOutEntries.forEach((le) => {
      const paidToParts = [
        le.vendor && le.vendor !== 'none' ? le.vendor : '',
        le.site && le.site !== 'none' ? le.site : '',
      ].filter(Boolean);
      const payee = (paidToParts.length > 0 ? paidToParts.join(' · ') : le.category || 'Expense').trim() || 'Unspecified';
      const amt = Number(le.amount) || 0;
      const cur = payeeMap.get(payee) || { total: 0, count: 0, sampleCategory: le.category || '' };
      cur.total += amt;
      cur.count += 1;
      payeeMap.set(payee, cur);
    });

    const payeeBreakdown = Array.from(payeeMap.entries())
      .map(([payee, data]) => ({
        payee,
        total: data.total,
        count: data.count,
        sampleCategory: data.sampleCategory,
        pct: periodMoneyOut > 0 ? (data.total / periodMoneyOut) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Money In grouped by "Paid From"
    const bankMap = new Map<string, { total: number; count: number }>();
    periodInEntries.forEach((e) => {
      const bank = (e.paidFrom || 'Bank Transfer').trim();
      const amt = Number(e.amount) || 0;
      const cur = bankMap.get(bank) || { total: 0, count: 0 };
      cur.total += amt;
      cur.count += 1;
      bankMap.set(bank, cur);
    });

    const fundingBreakdown = Array.from(bankMap.entries())
      .map(([bank, data]) => ({
        bank,
        total: data.total,
        count: data.count,
        pct: periodMoneyIn > 0 ? (data.total / periodMoneyIn) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const balanceCarriedForward = Math.max(0, closingBalance);

    return {
      periodInCount: periodInEntries.length,
      periodOutCount: periodOutEntries.length,
      payeeBreakdown,
      fundingBreakdown,
      balanceCarriedForward,
    };
  }, [
    pettyCashEntries,
    ledgerEntries,
    selectedPeriod,
    activePettyCashBankSet,
    periodMoneyIn,
    periodMoneyOut,
    closingBalance,
  ]);

  // Open Money In Modal (Create or Edit)
  const handleOpenAddMoneyIn = () => {
    setEditingEntry(null);
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDate =
      selectedPeriod !== 'ALL' && !todayStr.startsWith(selectedPeriod)
        ? `${selectedPeriod}-01`
        : todayStr;
    setFormDate(defaultDate);
    setFormDesc('');
    setFormAmount('');
    setFormPaidFromSelect('');
    setFormPaidFromCustom('');
    const defaultPaidTo = pettyCashBanks[0] || paidToOptions[0] || 'Petty Cash';
    setFormPaidToSelect(paidToOptions.includes(defaultPaidTo) ? defaultPaidTo : '__OTHER__');
    setFormPaidToCustom(paidToOptions.includes(defaultPaidTo) ? '' : defaultPaidTo);
    setMoneyInOpen(true);
  };

  const handleOpenEditMoneyIn = (entry: PettyCashEntry) => {
    setEditingEntry(entry);
    setFormDate((entry.date || '').split('T')[0]);
    setFormDesc(entry.description);
    setFormAmount(String(entry.amount));

    if (paidFromOptions.includes(entry.paidFrom)) {
      setFormPaidFromSelect(entry.paidFrom);
      setFormPaidFromCustom('');
    } else {
      setFormPaidFromSelect('__OTHER__');
      setFormPaidFromCustom(entry.paidFrom);
    }

    if (paidToOptions.includes(entry.paidTo)) {
      setFormPaidToSelect(entry.paidTo);
      setFormPaidToCustom('');
    } else {
      setFormPaidToSelect('__OTHER__');
      setFormPaidToCustom(entry.paidTo);
    }

    setMoneyInOpen(true);
  };

  const handleSaveMoneyIn = () => {
    const amt = parseFloat(formAmount);
    const finalPaidFrom =
      formPaidFromSelect === '__OTHER__' ? formPaidFromCustom.trim() : formPaidFromSelect.trim();
    const finalPaidTo =
      formPaidToSelect === '__OTHER__' ? formPaidToCustom.trim() : formPaidToSelect.trim();

    if (!formDate || !formDesc.trim() || isNaN(amt) || amt <= 0 || !finalPaidFrom || !finalPaidTo) {
      toast.error('Please fill Date, Description, valid Amount, Paid From, and Paid To.');
      return;
    }

    if (editingEntry) {
      updatePettyCashEntry(editingEntry.id, {
        date: formDate,
        description: formDesc.trim(),
        amount: amt,
        paidFrom: finalPaidFrom,
        paidTo: finalPaidTo,
      });
      toast.success('Money In record updated.');
    } else {
      addPettyCashEntry({
        id: generateId(),
        date: formDate,
        description: formDesc.trim(),
        amount: amt,
        paidFrom: finalPaidFrom,
        paidTo: finalPaidTo,
        enteredBy: currentUser?.name || 'Admin',
        createdAt: new Date().toISOString(),
      });
      toast.success('Money In recorded.');
    }
    setMoneyInOpen(false);
  };

  const handleDeleteMoneyIn = async (entry: PettyCashEntry) => {
    if (priv?.canDelete === false) {
      toast.error('You do not have permission to delete Petty Cash records.');
      return;
    }
    const ok = await showConfirm(
      `Are you sure you want to delete this Money In record?\n\n• Amount: ₦${fmtAmount(entry.amount)}\n• Description: ${entry.description || 'Petty Cash Top-up'}\n• Date: ${formatDisplayDate(entry.date)}\n• Paid From: ${entry.paidFrom || '—'}\n\nThis will permanently remove this funding top-up and update the period balance.`,
      {
        title: 'Are you sure you want to delete?',
        confirmLabel: 'Yes, Delete Record',
        cancelLabel: 'Cancel',
        variant: 'danger',
      }
    );
    if (!ok) return;
    deletePettyCashEntry(entry.id);
    toast.success('Money In record deleted.');
  };

  // Settings Dialog handlers
  const handleOpenSettings = () => {
    setDraftBanks([...(pettyCashBanks || [])]);
    setSettingsOpen(true);
  };

  const toggleDraftBank = (bankName: string) => {
    setDraftBanks((prev) =>
      prev.includes(bankName) ? prev.filter((b) => b !== bankName) : [...prev, bankName]
    );
  };

  const handleSaveSettings = () => {
    setPettyCashBanks(draftBanks);
    setSettingsOpen(false);
    toast.success('Petty Cash ledger sources updated.');
  };

  // Export Statement to Excel
  const handleExportExcel = () => {
    if (displayRows.length === 0) {
      toast.error('No records to export for this period.');
      return;
    }

    const exportRows: Record<string, any>[] = displayRows.map((r, idx) => ({
      '#': idx + 1,
      Date: formatDisplayDate(r.date),
      Description: r.voucherNo ? `${r.description} [${r.voucherNo}]` : r.description,
      'Money In (NGN)': r.moneyIn || '',
      'Money Out (NGN)': r.moneyOut || '',
      'Balance (NGN)': r.balance,
      'Paid From': r.paidFrom,
      'Paid To': r.paidTo,
    }));

    exportRows.push({
      '#': '',
      Date: '',
      Description: `TOTAL / CLOSING BALANCE (${periodLabel.toUpperCase()})`,
      'Money In (NGN)': periodMoneyIn,
      'Money Out (NGN)': periodMoneyOut,
      'Balance (NGN)': closingBalance,
      'Paid From': '',
      'Paid To': '',
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Petty Cash Statement');
    XLSX.writeFile(wb, `Petty_Cash_${selectedPeriod || 'All'}.xlsx`);
  };

  // Mount ultra-minimalist single-row controls into the top Header bar
  useSetPageTitle(
    'Petty Cash',
    `${periodLabel} · Bal: ₦${fmtAmount(closingBalance)} · In: ₦${fmtAmount(periodMoneyIn)} · Out: ₦${fmtAmount(periodMoneyOut)}`,
    <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
      {/* Compact Search Input */}
      <div className="relative">
        <Search className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-7 w-28 xl:w-36 pl-6 pr-5 text-[11px] rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Month Filter Modal Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (selectedPeriod !== 'ALL') {
            const y = parseInt(selectedPeriod.slice(0, 4), 10);
            if (!isNaN(y)) setPickerYear(y);
          }
          setPeriodModalOpen(true);
        }}
        title="Select Statement Month (1st to Last Day of Month)"
        className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>{periodLabel}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
      </button>

      {/* Compact Type Filter Pills */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-sm border border-slate-200 dark:border-slate-700 h-7 items-center">
        {(['all', 'in', 'out'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'px-1.5 h-5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-colors',
              typeFilter === t
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sort Order Icon Button */}
      <button
        type="button"
        onClick={() => setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'))}
        title={sortOrder === 'asc' ? 'Chronological (Oldest First)' : 'Reverse Chronological (Newest First)'}
        className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
      </button>

      {/* Excel Export Icon Button */}
      <button
        type="button"
        onClick={handleExportExcel}
        title="Export Statement to Excel"
        className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {/* Monthly Summary & Payee Breakdown Modal Trigger Button */}
      <button
        type="button"
        onClick={() => setSummaryModalOpen(true)}
        title={`View ${periodLabel} Summary & Payee Breakdown`}
        className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <PieChart className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>Summary</span>
      </button>

      {/* Petty Cash Source Settings Button */}
      <button
        type="button"
        onClick={handleOpenSettings}
        title={`Configure Ledger Paid-From accounts (${pettyCashBanks.length} active)`}
        className="h-7 px-1.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Settings2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1 rounded-xs">
          {pettyCashBanks.length}
        </span>
      </button>

      {/* Record Money In Button */}
      {priv?.canAdd !== false && (
        <Button
          size="sm"
          onClick={handleOpenAddMoneyIn}
          className="h-7 px-2 text-[11px] font-bold uppercase tracking-wider rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
        >
          <Plus className="h-3 w-3" />
          <span>Money In</span>
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-86px)] -mt-2 -mx-1 md:-mx-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-none overflow-hidden select-text">
      {/* Main Full-Bleed Excel-Style Statement Grid */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-left font-sans text-[12px]">
          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 shadow-2xs">
            <tr className="h-8 text-[11px] font-bold uppercase tracking-wider">
              <th className="w-10 px-2 py-1.5 text-center border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                #
              </th>
              <th className="w-24 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                Date
              </th>
              <th className="px-3 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                Description / Particulars
              </th>
              <th className="w-32 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                Money In (₦)
              </th>
              <th className="w-32 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 whitespace-nowrap">
                Money Out (₦)
              </th>
              <th className="w-36 px-2.5 py-1.5 text-right border-r border-slate-300 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-white whitespace-nowrap">
                Balance (₦)
              </th>
              <th className="w-36 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                Paid From
              </th>
              <th className="w-36 px-2.5 py-1.5 border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                Paid To
              </th>
              <th className="w-24 px-2 py-1.5 text-center bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
                Ref
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No Petty Cash transactions recorded for{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{fullPeriodLabel}</span>. Click{' '}
                  <span className="font-semibold text-emerald-600">+ Money In</span> to record funds or{' '}
                  <span className="font-semibold text-blue-600">{periodLabel}</span> to switch month.
                </td>
              </tr>
            ) : (
              displayRows.map((row, index) => {
                const isMoneyIn = row.sourceType === 'in';
                const isBf = Boolean(row.isBroughtForward);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'h-7 transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/60',
                      isBf
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 font-medium'
                        : isMoneyIn
                        ? 'bg-emerald-50/15 dark:bg-emerald-950/5'
                        : 'odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-900 dark:even:bg-slate-900/50'
                    )}
                  >
                    {/* # */}
                    <td className="px-2 py-1 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                      {index + 1}
                    </td>

                    {/* Date */}
                    <td className="px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap border-r border-slate-200 dark:border-slate-800 tabular-nums">
                      {formatDisplayDate(row.date)}
                    </td>

                    {/* Description */}
                    <td className="px-3 py-1 text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 max-w-xl truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        {isBf ? (
                          <span className="px-1.5 py-0.2 rounded-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[10px] shrink-0">
                            Balance b/f
                          </span>
                        ) : isMoneyIn ? (
                          <ArrowDownLeft className="h-3 w-3 text-emerald-600 shrink-0" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 text-rose-500 shrink-0" />
                        )}
                        <span className={cn('truncate', isBf && 'font-semibold text-blue-900 dark:text-blue-100')} title={row.description}>
                          {row.description}
                        </span>
                        {row.category && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            {row.category}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Money In */}
                    <td className="px-2.5 py-1 text-right font-mono text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800 tabular-nums whitespace-nowrap">
                      {row.moneyIn > 0 ? fmtAmount(row.moneyIn) : isBf ? fmtAmount(0) : ''}
                    </td>

                    {/* Money Out */}
                    <td className="px-2.5 py-1 text-right font-mono text-[12px] font-semibold text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800 tabular-nums whitespace-nowrap">
                      {row.moneyOut > 0 ? fmtAmount(row.moneyOut) : ''}
                    </td>

                    {/* Running Balance */}
                    <td
                      className={cn(
                        'px-2.5 py-1 text-right font-mono text-[12px] font-bold border-r border-slate-200 dark:border-slate-800 tabular-nums whitespace-nowrap bg-slate-50/60 dark:bg-slate-800/30',
                        row.balance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-slate-100'
                      )}
                    >
                      {fmtAmount(row.balance)}
                    </td>

                    {/* Paid From (Compact) */}
                    <td
                      className="px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[140px] truncate"
                      title={row.paidFrom}
                    >
                      {row.paidFrom}
                    </td>

                    {/* Paid To (Compact) */}
                    <td
                      className="px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[140px] truncate"
                      title={row.paidTo}
                    >
                      {row.paidTo}
                    </td>

                    {/* Actions / Clickable Source Ref (Last Column) */}
                    <td className="px-1.5 py-1 text-center whitespace-nowrap">
                      {isBf ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          B/F
                        </span>
                      ) : isMoneyIn && row.rawInEntry ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditMoneyIn(row.rawInEntry!);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                            title="Edit Money In"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMoneyIn(row.rawInEntry!);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Delete Money In"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => row.voucherNo && setDialogVoucher(row.voucherNo)}
                          className="inline-flex items-center gap-0.5 font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                          title={`Click to view Ledger Voucher ${row.voucherNo || 'Ledger'}`}
                        >
                          <Lock className="h-2.5 w-2.5 shrink-0" />
                          <span>{row.voucherNo ? row.voucherNo.replace(/^VN/, '') : 'LDG'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Sticky Statement Summary Footer */}
          <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 text-[11px] font-bold">
            <tr className="h-8">
              <td
                colSpan={3}
                className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span>
                    {fullPeriodLabel.toUpperCase()} — TOTALS ({totalCount} {totalCount === 1 ? 'entry' : 'entries'})
                  </span>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    Sources: {pettyCashBanks.join(', ') || 'None'}
                  </span>
                </div>
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono text-emerald-700 dark:text-emerald-400 border-r border-slate-300 dark:border-slate-700 tabular-nums whitespace-nowrap">
                {fmtAmount(periodMoneyIn)}
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono text-rose-600 dark:text-rose-400 border-r border-slate-300 dark:border-slate-700 tabular-nums whitespace-nowrap">
                {fmtAmount(periodMoneyOut)}
              </td>
              <td
                className={cn(
                  'px-2.5 py-1.5 text-right font-mono text-[12px] border-r border-slate-300 dark:border-slate-700 tabular-nums whitespace-nowrap',
                  closingBalance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                )}
              >
                ₦{fmtAmount(closingBalance)}
              </td>
              <td colSpan={3} className="px-2 py-1.5" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Month / Period Filter Modal ───────────────────────────────────────── */}
      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent className="sm:max-w-xs rounded-lg border border-slate-200 dark:border-slate-700">
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Select Statement Month
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Year Selector Row */}
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-md px-2.5 py-1.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {pickerYear}
              </span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {SHORT_MONTHS.map((mName, idx) => {
                const mCode = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
                const isSelected = selectedPeriod === mCode;
                return (
                  <button
                    key={mCode}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(mCode);
                      setPeriodModalOpen(false);
                    }}
                    className={cn(
                      'h-9 text-xs font-semibold rounded-md border transition-colors',
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>

            {/* Quick Presets */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  setPickerYear(now.getFullYear());
                  setSelectedPeriod(cur);
                  setPeriodModalOpen(false);
                }}
                className="flex-1 h-8 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriod('ALL');
                  setPeriodModalOpen(false);
                }}
                className={cn(
                  'flex-1 h-8 text-xs font-semibold rounded-md border transition-colors',
                  selectedPeriod === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                )}
              >
                All Time
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Record / Edit Money In Modal ──────────────────────────────────────── */}
      <Dialog open={moneyInOpen} onOpenChange={setMoneyInOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border border-slate-200 dark:border-slate-700">
          <DialogHeader className="px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
              <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              {editingEntry ? 'Edit Money In (Petty Cash)' : 'Record Money In (Petty Cash)'}
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          <div className="px-6 py-5 space-y-4 text-xs">
            {/* Row 1: Date & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-9 text-xs rounded-md border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Amount (₦) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none">
                    ₦
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="h-9 pl-7 text-xs font-mono font-semibold rounded-md border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Description / Narration */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Description / Narration <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Petty cash replenishment for office operations"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="h-9 text-xs rounded-md border-slate-300 dark:border-slate-700"
              />
            </div>

            {/* Row 3: Paid From & Paid To (Ledger Variables + Other manual input) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Paid From */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Paid From (Source) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPaidFromSelect}
                  onChange={(e) => setFormPaidFromSelect(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Paid From...</option>
                  {paidFromOptions.map((bankName) => (
                    <option key={bankName} value={bankName}>
                      {bankName}
                    </option>
                  ))}
                  <option value="__OTHER__">Other (Enter manually...)</option>
                </select>

                {formPaidFromSelect === '__OTHER__' && (
                  <Input
                    type="text"
                    placeholder="Enter custom Paid From source..."
                    value={formPaidFromCustom}
                    onChange={(e) => setFormPaidFromCustom(e.target.value)}
                    autoFocus
                    className="h-9 text-xs rounded-md border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-slate-800"
                  />
                )}
              </div>

              {/* Paid To */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Paid To (Recipient/Account) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPaidToSelect}
                  onChange={(e) => setFormPaidToSelect(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Paid To...</option>
                  {paidToOptions.map((targetName) => (
                    <option key={targetName} value={targetName}>
                      {targetName}
                    </option>
                  ))}
                  <option value="__OTHER__">Other (Enter manually...)</option>
                </select>

                {formPaidToSelect === '__OTHER__' && (
                  <Input
                    type="text"
                    placeholder="Enter custom Paid To account/recipient..."
                    value={formPaidToCustom}
                    onChange={(e) => setFormPaidToCustom(e.target.value)}
                    autoFocus
                    className="h-9 text-xs rounded-md border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-slate-800"
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 mt-0 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMoneyInOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-md border-slate-300 dark:border-slate-700"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMoneyIn}
              className="h-9 px-5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
            >
              {editingEntry ? 'Update Entry' : 'Save Money In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Petty Cash Classification Settings Dialog ─────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md rounded-xl border border-slate-200 dark:border-slate-700">
          <DialogHeader className="px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-amber-600" />
              Petty Cash Ledger Sources
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          <div className="px-6 py-5 text-xs space-y-3">
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Select which <span className="font-semibold text-slate-700 dark:text-slate-200">Paid From</span> accounts in the General Ledger should automatically flow into this statement as <span className="font-semibold text-rose-600">Money Out</span>.
            </p>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
              {availableLedgerBanks.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  No Paid From accounts found in Ledger yet.
                </div>
              ) : (
                availableLedgerBanks.map((bank) => {
                  const selected = draftBanks.includes(bank.name);
                  return (
                    <button
                      key={bank.name}
                      type="button"
                      onClick={() => toggleDraftBank(bank.name)}
                      className={cn(
                        'w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors',
                        selected
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 text-slate-900 dark:text-white font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'h-4 w-4 rounded-xs border flex items-center justify-center shrink-0 transition-colors',
                            selected
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{bank.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                        {bank.count} tx · ₦{fmtAmount(bank.total)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 mt-0 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-md"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSettings}
              className="h-9 px-5 text-xs rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-bold"
            >
              Save Classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Monthly Summary & Reconciliation Modal ───────────────────────── */}
      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                <PieChart className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Petty Cash Summary — {periodLabel}
                </DialogTitle>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {fullPeriodLabel} · Period statement reconciliation & payee expense breakdown
                </p>
              </div>
            </div>
            <DialogClose />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 4 Reconciliation KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Opening Balance b/f */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Opening Balance (b/f)
                </div>
                <div className="mt-1 text-base font-bold font-mono text-slate-900 dark:text-white">
                  ₦{fmtAmount(balanceBroughtForward)}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={prevMonthLabel ? `From ${prevMonthLabel}` : 'Initial'}>
                  {prevMonthLabel ? `From ${prevMonthLabel}` : 'Initial balance'}
                </div>
              </div>

              {/* 2. Total Money In */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Money In
                </div>
                <div className="mt-1 text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  ₦{fmtAmount(periodMoneyIn)}
                </div>
                <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  {summaryData.periodInCount} {summaryData.periodInCount === 1 ? 'top-up' : 'top-ups'}
                </div>
              </div>

              {/* 3. Total Expenses */}
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Total Expenses
                </div>
                <div className="mt-1 text-base font-bold font-mono text-rose-700 dark:text-rose-300">
                  ₦{fmtAmount(periodMoneyOut)}
                </div>
                <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                  {summaryData.periodOutCount} {summaryData.periodOutCount === 1 ? 'voucher' : 'vouchers'}
                </div>
              </div>

              {/* 4. Closing Balance / c/f */}
              <div className={cn(
                "p-3 rounded-lg border",
                closingBalance >= 0
                  ? "border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20"
              )}>
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  closingBalance >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"
                )}>
                  Closing Balance (c/f)
                </div>
                <div className={cn(
                  "mt-1 text-base font-bold font-mono",
                  closingBalance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"
                )}>
                  ₦{fmtAmount(closingBalance)}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={nextMonthLabel ? `Rolls to ${nextMonthLabel}` : 'Period end'}>
                  {nextMonthLabel ? `Rolls to ${nextMonthLabel}` : 'Period end'}
                </div>
              </div>
            </div>

            {/* Next Month Balance b/f Highlight Card */}
            <div className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">
                  Balance carried forward to <strong className="text-slate-900 dark:text-white">{nextMonthLabel || 'next month'}</strong> (Row 1):
                </span>
              </div>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                ₦{fmtAmount(summaryData.balanceCarriedForward)}
              </span>
            </div>

            {/* Paid To (Payee Summary) Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Expenses by "Paid To" Payee / Recipient ({summaryData.payeeBreakdown.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total: ₦{fmtAmount(periodMoneyOut)}
                </span>
              </div>

              {summaryData.payeeBreakdown.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                  No petty cash expenses recorded for this period.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-1.5 px-3">Payee / Recipient</th>
                        <th className="py-1.5 px-2 text-center w-16">Count</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₦)</th>
                        <th className="py-1.5 px-3 text-right w-20">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.payeeBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                            <div className="truncate max-w-[280px]" title={item.payee}>
                              {item.payee}
                            </div>
                            {item.sampleCategory && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {item.sampleCategory}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500">
                            {item.count}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {fmtAmount(item.total)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Funding Sources (Money In by Bank) */}
            {summaryData.fundingBreakdown.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Money In by Source Bank ({summaryData.fundingBreakdown.length})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total: ₦{fmtAmount(periodMoneyIn)}
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-1.5 px-3">Funding Bank</th>
                        <th className="py-1.5 px-2 text-center w-16">Transfers</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₦)</th>
                        <th className="py-1.5 px-3 text-right w-20">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.fundingBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                            {item.bank}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500">
                            {item.count}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {fmtAmount(item.total)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                            {item.pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ledger Voucher Transactions Modal Popup ───────────────────────────── */}
      {dialogVoucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={() => setDialogVoucher(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 sm:rounded-md shadow-2xl w-full h-full sm:h-auto sm:max-h-[85vh] max-w-4xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="bg-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">
                  Voucher Transactions
                </p>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-xl tracking-wide font-mono">
                    {dialogVoucher}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white border border-white/20">
                    Read-Only
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-blue-200 text-[10px] uppercase font-bold tracking-wider">
                      Subtotal
                    </p>
                    <p className="text-white font-bold text-sm tabular-nums">
                      ₦{fmtAmount(dialogNetTotal)}
                    </p>
                  </div>
                  {dialogVatTotal > 0 && (
                    <div>
                      <p className="text-emerald-200 text-[10px] uppercase font-bold tracking-wider">
                        VAT ({vatRate}%)
                      </p>
                      <p className="text-emerald-300 font-extrabold text-sm tabular-nums">
                        ₦{fmtAmount(dialogVatTotal)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-blue-200 text-[10px] uppercase font-bold tracking-wider">
                      Total Amount
                    </p>
                    <p className="text-white font-extrabold text-lg tabular-nums">
                      ₦{fmtAmount(dialogGrossTotal)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDialogVoucher(null)}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bank / Date meta row */}
            {dialogTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs shrink-0">
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Paid From (Bank): </span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {dialogTransactions[0].bank}
                  </strong>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Entered by: </span>
                  <strong className="text-slate-800 dark:text-slate-100">
                    {dialogTransactions[0].enteredBy}
                  </strong>
                </div>
                <div className="text-slate-500 sm:ml-auto font-semibold">
                  {dialogTransactions.length} transaction
                  {dialogTransactions.length !== 1 ? 's' : ''} in voucher
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="overflow-y-auto flex-1 bg-white dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold text-slate-600 dark:text-slate-300 w-8">
                      #
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Date
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Description
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-32">
                      Category
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Client
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Site
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Amount
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-300 w-20">
                      Vatable
                    </th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 w-28">
                      VAT
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 w-28">
                      Vendor
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold text-slate-400 dark:text-slate-500 w-16">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dialogTransactions.map((t, idx) => {
                    const lineVat = t.vatAmount ?? (t.amount * (t.vatRate ?? vatRate)) / 100;
                    return (
                      <tr
                        key={t.id || `t-${idx}`}
                        className={cn(
                          'border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors',
                          idx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/40 dark:bg-slate-900/50'
                        )}
                      >
                        <td className="py-2.5 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                          {t.date ? formatDisplayDate(t.date) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-100 font-medium">
                          {t.description || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{t.client || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{t.site || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          ₦{fmtAmount(t.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {t.isVatable || (t.vatMode && t.vatMode !== 'No') ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                              {t.vatMode || 'Yes'}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 tabular-nums bg-emerald-50/40 dark:bg-emerald-950/20">
                          {t.isVatable ? `₦${fmtAmount(lineVat)}` : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{t.vendor || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-7 w-7 p-0 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40 hover:bg-transparent"
                            title="Ledger transactions cannot be deleted from Petty Cash. Manage in General Ledger."
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand total row */}
                  <tr className="bg-blue-50/70 dark:bg-blue-950/40 border-t-2 border-blue-200 dark:border-blue-800">
                    <td colSpan={6} className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-200">
                      Totals
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      ₦{fmtAmount(dialogNetTotal)}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-slate-400">VAT</td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700 tabular-nums bg-emerald-50 dark:bg-emerald-950/30">
                      ₦{fmtAmount(dialogVatTotal)}
                    </td>
                    <td
                      colSpan={2}
                      className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100 tabular-nums bg-blue-100/50 dark:bg-blue-950/60"
                    >
                      Gross: ₦{fmtAmount(dialogGrossTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PettyCash;
