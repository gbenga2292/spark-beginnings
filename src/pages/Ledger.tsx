import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { TabsContent } from '@/src/components/ui/tabs';
import { Search, Download, Upload, FileText, ChevronLeft, ChevronRight, X, Eye, BookOpen, RotateCcw, Trash2, LayoutGrid, BarChart2, CheckCircle2, History, ChevronDown, ChevronUp, Filter, Plus, Users, Edit2, Receipt, Percent, Calendar, Building2, Calculator, Link, AlertCircle, Clock, ArrowUpRight, Layers } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/src/components/ui/dropdown-menu';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/src/components/ui/dialog';
import { useAppStore, LedgerEntry, ExpenseVatRemittance } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId, cn } from '@/src/lib/utils';
import { fetchLedgerData } from '@/src/lib/supabaseService';

export type VatMode = 'No' | 'Yes' | 'Add';

type EntryItem = {
  id?: string;
  transactionDate: string;
  description: string;
  category: string;
  amount: string;
  client: string;
  site: string;
  vendor: string;
  isVatable?: boolean;
  vatMode: VatMode;
  vatAmount?: number;
  amountForVat?: number;
};

const getEmptyItem = (): EntryItem => ({
  transactionDate: '', description: '', category: '', amount: '', client: 'none', site: 'none', vendor: 'none', isVatable: false, vatMode: 'No', vatAmount: 0, amountForVat: 0
});

export function calculateItemVat(amtNum: number, mode: VatMode, rate: number) {
  if (mode === 'No' || !amtNum || amtNum <= 0) {
    return { vatAmount: 0, amountForVat: 0, grossAmount: amtNum || 0 };
  }
  if (mode === 'Yes') {
    // Exclusive VAT: Net Amount entered. VAT added on top.
    const vatAmount = (amtNum * rate) / 100;
    return {
      vatAmount,
      amountForVat: amtNum,
      grossAmount: amtNum + vatAmount,
    };
  }
  if (mode === 'Add') {
    // Inclusive VAT (Add policy): Gross Amount entered.
    const vatAmount = (amtNum * rate) / (100 + rate);
    const amountForVat = amtNum - vatAmount;
    return {
      vatAmount,
      amountForVat,
      grossAmount: amtNum,
    };
  }
  return { vatAmount: 0, amountForVat: 0, grossAmount: amtNum || 0 };
}

export function Ledger() {
  const priv = usePriv('ledger');
  const currentUser = useUserStore((s) => s.getCurrentUser());

  const ledgerEntries = useAppStore((state) => state.ledgerEntries);
  const payrollVariables = useAppStore((state) => state.payrollVariables);
  const vatRate = payrollVariables?.vatRate ?? 7.5;
  const ledgerCategories = useAppStore((state) => state.ledgerCategories);
  const ledgerBanks = useAppStore((state) => state.ledgerBanks);
  const ledgerVendors = useAppStore((state) => state.ledgerVendors);
  const sites = useAppStore((state) => state.sites);
  const clients = useMemo(() => Array.from(new Set(sites.map(s => s.client))).sort(), [sites]);

  const sortedCategories = useMemo(() => [...ledgerCategories].sort((a, b) => a.name.localeCompare(b.name)), [ledgerCategories]);
  const sortedBanks = useMemo(() => [...ledgerBanks].sort((a, b) => a.name.localeCompare(b.name)), [ledgerBanks]);
  const sortedVendors = useMemo(() => [...ledgerVendors].sort((a, b) => a.name.localeCompare(b.name)), [ledgerVendors]);

  const addLedgerEntry = useAppStore((state) => state.addLedgerEntry);
  const updateLedgerEntry = useAppStore((state) => state.updateLedgerEntry);
  const deleteLedgerEntry = useAppStore((state) => state.deleteLedgerEntry);
  const addLedgerCategory = useAppStore((state) => state.addLedgerCategory);
  const updateLedgerCategory = useAppStore((state) => state.updateLedgerCategory);
  const removeLedgerCategory = useAppStore((state) => state.removeLedgerCategory);
  const addLedgerBank = useAppStore((state) => state.addLedgerBank);
  const addLedgerVendor = useAppStore((state) => state.addLedgerVendor);
  const updateLedgerVendor = useAppStore((state) => state.updateLedgerVendor);
  const removeLedgerVendor = useAppStore((state) => state.removeLedgerVendor);

  useEffect(() => {
    if (ledgerEntries.length === 0) {
      fetchLedgerData().then(data => {
        useAppStore.setState(data);
      }).catch(console.error);
    }
  }, [ledgerEntries.length]);

  const [tab, setTab] = useState<'entry' | 'records' | 'vat'>('entry');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedVatMonth, setSelectedVatMonth] = useState<string>('all');
  const [selectedVatCategory, setSelectedVatCategory] = useState<string>('all');

  const expenseVatRemittances = useAppStore((state) => state.expenseVatRemittances);
  const addExpenseVatRemittance = useAppStore((state) => state.addExpenseVatRemittance);
  const deleteExpenseVatRemittance = useAppStore((state) => state.deleteExpenseVatRemittance);

  // Reconciliation modal state
  const [reconcileMonthKey, setReconcileMonthKey] = useState<string | null>(null);
  const [reconcileSearchQuery, setReconcileSearchQuery] = useState('');
  const [reconcileTab, setReconcileTab] = useState<'link' | 'direct'>('link');
  const [directForm, setDirectForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    bank: '',
    voucherNo: '',
    notes: '',
  });

  const toggleMonthExpand = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const monthlyVatSummaries = useMemo(() => {
    const vatableEntries = ledgerEntries.filter(e => {
      const isVat = e.isVatable || (e.vatMode && e.vatMode !== 'No');
      if (!isVat) return false;
      if (selectedVatCategory !== 'all' && e.category !== selectedVatCategory) return false;
      return true;
    });

    const groups: Record<string, {
      monthKey: string;
      monthLabel: string;
      entries: LedgerEntry[];
      totalVatableAmount: number;
      totalVatAmount: number;
      totalVatPaid: number;
      vatBalance: number;
      status: 'Fully Paid' | 'Partially Paid' | 'Unpaid';
      remittances: ExpenseVatRemittance[];
    }> = {};

    vatableEntries.forEach(entry => {
      if (!entry.date) return;
      const monthKey = entry.date.slice(0, 7);
      const parts = monthKey.split('-');
      if (parts.length < 2) return;
      const yearStr = parts[0];
      const monthStr = parts[1];
      const monthIndex = parseInt(monthStr, 10) - 1;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[monthIndex] || monthStr} ${yearStr}`;

      if (!groups[monthKey]) {
        groups[monthKey] = {
          monthKey,
          monthLabel,
          entries: [],
          totalVatableAmount: 0,
          totalVatAmount: 0,
          totalVatPaid: 0,
          vatBalance: 0,
          status: 'Unpaid',
          remittances: [],
        };
      }
      const vMode: VatMode = entry.vatMode || (entry.isVatable ? 'Yes' : 'No');
      const rateToUse = entry.vatRate || vatRate;
      const numAmt = Number(entry.amount) || 0;
      const calculated = calculateItemVat(numAmt, vMode, rateToUse);

      const entryVat = entry.vatAmount ?? calculated.vatAmount;
      const entryAmtForVat = entry.amountForVat ?? calculated.amountForVat;

      groups[monthKey].entries.push(entry);
      groups[monthKey].totalVatableAmount += entryAmtForVat;
      groups[monthKey].totalVatAmount += entryVat;
    });

    // Compute remittances, paid total, balance, and status per month
    Object.values(groups).forEach(group => {
      const monthRemittances = (expenseVatRemittances || []).filter(r => {
        if (r.monthKey !== group.monthKey) return false;
        if (selectedVatCategory !== 'all' && r.category && r.category !== 'all' && r.category !== selectedVatCategory) return false;
        return true;
      });
      group.remittances = monthRemittances;
      group.totalVatPaid = monthRemittances.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      group.vatBalance = group.totalVatAmount - group.totalVatPaid;

      if (group.totalVatPaid >= group.totalVatAmount && group.totalVatAmount > 0) {
        group.status = 'Fully Paid';
      } else if (group.totalVatPaid > 0) {
        group.status = 'Partially Paid';
      } else {
        group.status = 'Unpaid';
      }
    });

    return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [ledgerEntries, vatRate, selectedVatCategory, expenseVatRemittances]);

  const availableVatMonths = useMemo(() => {
    return monthlyVatSummaries.map(g => ({
      key: g.monthKey,
      label: g.monthLabel,
    }));
  }, [monthlyVatSummaries]);

  const filteredVatSummaries = useMemo(() => {
    if (selectedVatMonth === 'all') return monthlyVatSummaries;
    return monthlyVatSummaries.filter(g => g.monthKey === selectedVatMonth);
  }, [monthlyVatSummaries, selectedVatMonth]);

  const overallVatStats = useMemo(() => {
    const totalVat = filteredVatSummaries.reduce((sum, g) => sum + g.totalVatAmount, 0);
    const totalVatPaid = filteredVatSummaries.reduce((sum, g) => sum + g.totalVatPaid, 0);
    const totalVatable = filteredVatSummaries.reduce((sum, g) => sum + g.totalVatableAmount, 0);
    const totalCount = filteredVatSummaries.reduce((sum, g) => sum + g.entries.length, 0);
    const vatBalance = totalVat - totalVatPaid;
    const amountForVat = totalVatable; // Total base amount subject to VAT
    return { totalVat, totalVatPaid, vatBalance, totalVatable, totalCount, amountForVat };
  }, [filteredVatSummaries]);

  // VOUCHER FORM STATE
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeVoucherNo, setActiveVoucherNo] = useState<string>('');
  const [loadedVoucherNo, setLoadedVoucherNo] = useState<string>('');
  const [paidFrom, setPaidFrom] = useState('');
  const [items, setItems] = useState<EntryItem[]>(Array(8).fill(null).map(() => getEmptyItem()));
  const [originalItemsJSON, setOriginalItemsJSON] = useState<string>(() => JSON.stringify(Array(8).fill(null).map(() => getEmptyItem())));

  // For navigating vouchers
  const distinctVouchers = useMemo(() => {
    const vSet = new Set(ledgerEntries.map(e => e.voucherNo));
    return Array.from(vSet).sort();
  }, [ledgerEntries]);

  const pendingLedgerEntries = useAppStore((state) => state.pendingLedgerEntries);
  const clearPendingLedgerEntries = useAppStore((state) => state.clearPendingLedgerEntries);
  const updateCompanyExpense = useAppStore((state) => state.updateCompanyExpense);
  const setLedgerDirty = useAppStore((state) => state.setLedgerDirty);

  const [hasUnsavedPending, setHasUnsavedPending] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [quickVendor, setQuickVendor] = useState('');
  const [quickTin, setQuickTin] = useState('');
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorRenameValue, setVendorRenameValue] = useState('');
  const [tinRenameValue, setTinRenameValue] = useState('');

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [quickCategory, setQuickCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryRenameValue, setCategoryRenameValue] = useState('');

  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);

  // Sorting state for History tab
  const [sortField, setSortField] = useState<keyof LedgerEntry>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: keyof LedgerEntry) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const [historyViewMode, setHistoryViewMode] = useState<'detailed' | 'grouped'>('detailed');
  const [voucherSortField, setVoucherSortField] = useState<string>('date');
  const [voucherSortOrder, setVoucherSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleAddVendor = () => {
    if (!quickVendor.trim()) return;
    const exists = ledgerVendors.some(v => v.name.toLowerCase() === quickVendor.trim().toLowerCase());
    if (exists) {
      toast.error('Vendor already exists');
      return;
    }
    addLedgerVendor({ id: generateId(), name: quickVendor.trim(), tinNumber: quickTin.trim() });
    setQuickVendor('');
    setQuickTin('');
    toast.success(`Vendor "${quickVendor.trim()}" added`);
  };

  const handleRenameVendor = (id: string) => {
    if (!vendorRenameValue.trim()) return;
    updateLedgerVendor(id, { 
      name: vendorRenameValue.trim(),
      tinNumber: tinRenameValue.trim()
    });
    setEditingVendorId(null);
    setVendorRenameValue('');
    setTinRenameValue('');
    toast.success('Vendor updated');
  };

  const handleRemoveVendor = async (id: string, name: string) => {
    const usage = ledgerEntries.filter(l => l.vendor === name).length;
    if (usage > 0) {
      toast.error(`Cannot delete: Vendor is used in ${usage} ledger entries.`);
      return;
    }
    const ok = await showConfirm(`Delete vendor "${name}"?`);
    if (ok) {
      removeLedgerVendor(id);
      toast.success('Vendor deleted');
    }
  };

  const handleAddCategory = () => {
    if (!quickCategory.trim()) return;
    const exists = ledgerCategories.some(c => c.name.toLowerCase() === quickCategory.trim().toLowerCase());
    if (exists) {
      toast.error('Category already exists');
      return;
    }
    addLedgerCategory({ id: generateId(), name: quickCategory.trim() });
    setQuickCategory('');
    toast.success(`Category "${quickCategory.trim()}" added`);
  };

  const handleRenameCategory = (id: string) => {
    if (!categoryRenameValue.trim()) return;
    updateLedgerCategory(id, { name: categoryRenameValue.trim() });
    setEditingCategoryId(null);
    setCategoryRenameValue('');
    toast.success('Category updated');
  };

  const handleRemoveCategory = async (id: string, name: string) => {
    const usage = ledgerEntries.filter(l => l.category === name).length;
    if (usage > 0) {
      toast.error(`Cannot delete: Category is used in ${usage} ledger entries.`);
      return;
    }
    const ok = await showConfirm(`Delete category "${name}"?`);
    if (ok) {
      removeLedgerCategory(id);
      toast.success('Category deleted');
    }
  };


  const isLedgerDirty = useMemo(() => {
    return JSON.stringify(items) !== originalItemsJSON || hasUnsavedPending;
  }, [items, originalItemsJSON, hasUnsavedPending]);

  useEffect(() => {
    setLedgerDirty(isLedgerDirty);
  }, [isLedgerDirty, setLedgerDirty]);

  // Derived Voucher No matching "VNYY-MM-DD-SEQ" if creating new
  const generatedVoucherNo = useMemo(() => {
    if (!voucherDate) return '';
    const dateObj = new Date(voucherDate);
    if (isNaN(dateObj.getTime())) return '';
    const yy = String(dateObj.getFullYear()).slice(-2);
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const prefix = `VN${yy}-${mm}-${dd}-`;
    
    let maxSeq = 0;
    ledgerEntries.forEach(e => {
      if (e.voucherNo && e.voucherNo.startsWith(prefix)) {
        const seqStr = e.voucherNo.replace(prefix, '');
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const newSeq = String(maxSeq + 1).padStart(2, '0');
    return `${prefix}${newSeq}`;
  }, [voucherDate, ledgerEntries]);

  // Handle pending entries from CompanyExpenses
  useEffect(() => {
    if (pendingLedgerEntries && pendingLedgerEntries.length > 0) {
      setHasUnsavedPending(true);
      setTab('entry');
      setActiveVoucherNo('');
      setVoucherDate(new Date().toISOString().split('T')[0]);
      
      const firstEntry = pendingLedgerEntries[0];
      if (firstEntry && firstEntry.paidFrom) {
        setPaidFrom(firstEntry.paidFrom);
      }

      const newItems = Array(8).fill(null).map(() => getEmptyItem());
      pendingLedgerEntries.slice(0, 8).forEach((exp, idx) => {
        newItems[idx] = {
          ...newItems[idx],
          transactionDate: exp.date,
          description: exp.description + (exp.paidToBankName ? ` (To: ${exp.paidToBankName} ${exp.paidToAccountNo})` : ''),
          amount: String(exp.amount),
        };
      });
      setItems(newItems);
      
      toast.info('Loaded pending expenses. Please assign categories and save.');
    }
  }, [pendingLedgerEntries]);

  // Warn on tab close/reload
  useEffect(() => {
    if (!isLedgerDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLedgerDirty]);

  // Load a voucher into the form
  const loadVoucher = (vNo: string) => {
    const records = ledgerEntries.filter(e => e.voucherNo === vNo);
    if (records.length === 0) return;
    
    setActiveVoucherNo(vNo);
    setLoadedVoucherNo(vNo);
    // Parse the date out of the voucher or use the first record's transaction date ideally
    const match = vNo.match(/^VN(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
      setVoucherDate(`20${match[1]}-${match[2]}-${match[3]}`);
    }
    setPaidFrom(records[0].bank || '');
    
    const loadedItems: EntryItem[] = Array(8).fill(null).map(() => getEmptyItem());
    records.forEach((r, idx) => {
      if (idx < 8) {
        const vMode: VatMode = r.vatMode || (r.isVatable ? 'Yes' : 'No');
        loadedItems[idx] = {
          id: r.id,
          transactionDate: r.date,
          description: r.description,
          category: r.category,
          amount: String(r.amount),
          client: r.client || 'none',
          site: r.site || 'none',
          vendor: r.vendor || 'none',
          isVatable: vMode !== 'No',
          vatMode: vMode,
          vatAmount: r.vatAmount || 0,
          amountForVat: r.amountForVat || 0,
        };
      }
    });
    setItems(loadedItems);
    setOriginalItemsJSON(JSON.stringify(loadedItems));
  };

  const getCurrentVoucherSeq = () => {
    const vno = activeVoucherNo || generatedVoucherNo;
    if (!vno) return null;
    const parts = vno.split('-');
    if (parts.length === 4) {
      return {
        prefix: `${parts[0]}-${parts[1]}-${parts[2]}-`,
        seq: parseInt(parts[3], 10)
      };
    }
    return null;
  };

  const navigateSequence = (direction: 'next' | 'prev') => {
    const cur = getCurrentVoucherSeq();
    if (!cur) return;
    
    let nextSeq = direction === 'next' ? cur.seq + 1 : cur.seq - 1;
    if (nextSeq < 1) nextSeq = 1;

    const nextVno = `${cur.prefix}${String(nextSeq).padStart(2, '0')}`;
    
    if (nextVno === (activeVoucherNo || generatedVoucherNo)) return;

    const exists = ledgerEntries.some(e => e.voucherNo === nextVno);
    if (exists) {
      loadVoucher(nextVno);
    } else {
      toast.info(`Notice: Voucher ${nextVno} has no entry.`);
      handleClear();
      setActiveVoucherNo(nextVno);
    }
  };

  const handleNextVoucher = () => navigateSequence('next');
  const handlePrevVoucher = () => navigateSequence('prev');

  const handleClear = () => {
    if (hasUnsavedPending) {
      toast.error('You cannot clear the form while you have unsaved pending expenses.');
      return;
    }
    setActiveVoucherNo('');
    setLoadedVoucherNo('');
    const newItems = Array(8).fill(null).map(() => getEmptyItem());
    setItems(newItems);
    setOriginalItemsJSON(JSON.stringify(newItems));
    setPaidFrom('');
  };

  const handleReload = () => {
    const vno = activeVoucherNo || generatedVoucherNo;
    if (vno && ledgerEntries.some(e => e.voucherNo === vno)) {
      loadVoucher(vno);
      toast.success(`Reloaded voucher ${vno}.`);
    } else {
      handleClear();
      toast.info('No saved voucher to reload — form cleared.');
    }
  };

  const handleDateChange = (newDate: string) => {
    setVoucherDate(newDate);
    if (activeVoucherNo) {
      const dateObj = new Date(newDate);
      if (!isNaN(dateObj.getTime())) {
        const yy = String(dateObj.getFullYear()).slice(-2);
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const prefix = `VN${yy}-${mm}-${dd}-`;
        
        let maxSeq = 0;
        ledgerEntries.forEach(e => {
          if (e.voucherNo && e.voucherNo.startsWith(prefix) && e.voucherNo !== loadedVoucherNo) {
            const seqStr = e.voucherNo.replace(prefix, '');
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        });
        const newSeq = String(maxSeq + 1).padStart(2, '0');
        setActiveVoucherNo(`${prefix}${newSeq}`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!voucherDate || !paidFrom) {
      toast.error('Voucher Date and Paid From (Bank) are required.');
      return;
    }

    // Validation: for all filled rows, ensure category, client, and site are selected
    const filledRows = items.filter(item => 
      item.amount.trim() !== '' || 
      item.category.trim() !== '' || 
      (item.description && item.description.trim() !== '')
    );

    if (filledRows.length === 0) {
      toast.error('No valid lines entered. Put an amount and category.');
      return;
    }

    const invalidRows: number[] = [];
    items.forEach((item, idx) => {
      const isFilled = item.amount.trim() !== '' || item.category.trim() !== '' || (item.description && item.description.trim() !== '');
      if (!isFilled) return;

      const hasCategory = item.category.trim() !== '';
      const hasClient = item.client && item.client !== 'none';
      const hasSite = item.site && item.site !== 'none';
      const hasAmount = item.amount.trim() !== '' && !isNaN(Number(item.amount));

      if (!hasCategory || !hasClient || !hasSite || !hasAmount) {
        invalidRows.push(idx + 1);
      }
    });

    if (invalidRows.length > 0) {
      toast.error(`Please complete rows: ${invalidRows.join(', ')}. Each must have a Category, Amount, Client, and Site.`);
      return;
    }

    const targetVoucherNo = activeVoucherNo || generatedVoucherNo;
    const existingRecords = ledgerEntries.filter(e => e.voucherNo === targetVoucherNo);
    
    if (loadedVoucherNo && loadedVoucherNo !== targetVoucherNo) {
      const confirmed = await showConfirm(
        `You have changed the voucher date. This will update the voucher number from ${loadedVoucherNo} to ${targetVoucherNo}.\n\nAre you sure you want to proceed?`,
        { variant: 'danger', confirmLabel: 'Yes, Change Date' }
      );
      if (!confirmed) return;
    } else if (activeVoucherNo && existingRecords.length > 0) {
      const confirmed = await showConfirm(
        `A change has been made to voucher ${targetVoucherNo}.\n\nAre you sure you want to overwrite the existing record?`,
        { variant: 'danger', confirmLabel: 'Yes, Overwrite' }
      );
      if (!confirmed) return;
    }
    
    // Track which records are actively updated/created
    const keptIds = new Set<string>();

    let savedCount = 0;

    items.forEach((item) => {
      const isFilled = item.amount.trim() !== '' || item.category.trim() !== '' || (item.description && item.description.trim() !== '');
      if (!isFilled) return;
      
      const entryDate = item.transactionDate && item.transactionDate.trim() !== ''
        ? item.transactionDate
        : voucherDate || new Date().toISOString().split('T')[0];
      
      const vMode: VatMode = item.vatMode || (item.isVatable ? 'Yes' : 'No');
      const isVatable = vMode !== 'No';
      const numAmt = Number(item.amount) || 0;
      const calculatedVat = calculateItemVat(numAmt, vMode, vatRate);

      const payload: LedgerEntry = {
        id: item.id || generateId(),
        voucherNo: targetVoucherNo,
        date: entryDate,
        description: item.description,
        category: item.category,
        amount: numAmt,
        client: item.client === 'none' || !item.client ? '' : item.client,
        site: item.site === 'none' || !item.site ? '' : item.site,
        vendor: item.vendor === 'none' || !item.vendor ? '' : item.vendor,
        bank: paidFrom,
        enteredBy: currentUser?.name || 'Unknown',
        isVatable,
        vatMode: vMode,
        vatAmount: calculatedVat.vatAmount,
        vatRate: isVatable ? vatRate : undefined,
        amountForVat: calculatedVat.amountForVat,
      };
      
      keptIds.add(payload.id);

      if (item.id && existingRecords.some(r => r.id === item.id)) {
        updateLedgerEntry(item.id, payload);
      } else {
        addLedgerEntry(payload);
      }
      savedCount++;
    });

    if (savedCount === 0) {
      toast.error('No valid lines entered. Put an amount and category.');
      return;
    }

    // Purge rows that were cleared from the loaded voucher (even if its name/number changed due to date change)
    const purgeVoucherNo = loadedVoucherNo || targetVoucherNo;
    const originalRecords = ledgerEntries.filter(e => e.voucherNo === purgeVoucherNo);
    originalRecords.forEach(r => {
      if (!keptIds.has(r.id)) {
        deleteLedgerEntry(r.id);
      }
    });

    if (hasUnsavedPending) {
      // Mark these items as saved in company expenses
      pendingLedgerEntries.forEach(exp => {
        updateCompanyExpense(exp.id, { status: 'Saved to Ledger' });
      });
      clearPendingLedgerEntries();
      setHasUnsavedPending(false);
      toast.success('Pending expenses moved to ledger and marked as saved in Company Expenses.');
    }

    toast.success(`Saved voucher ${targetVoucherNo}.`);
    // After submit, clear the form for the next voucher
    handleClear();
  };

  const handleDeleteVoucher = async () => {
    const vno = activeVoucherNo;
    if (!vno) return;
    const confirmed = await showConfirm(
      `Delete voucher ${vno}?\n\nThis will permanently remove all ${ledgerEntries.filter(e => e.voucherNo === vno).length} transaction(s) in this voucher.`,
      { variant: 'danger', confirmLabel: 'Yes, Delete Voucher' }
    );
    if (confirmed) {
      ledgerEntries.filter(e => e.voucherNo === vno).forEach(r => deleteLedgerEntry(r.id));
      toast.success(`Deleted voucher ${vno}.`);
      handleClear();
    }
  };

  const setItemField = (idx: number, field: keyof EntryItem, val: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setItems(newItems);
  };

  const formTotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [items]);

  const formNetTotal = useMemo(() => {
    return items.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = parseFloat(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, vatRate);
      if (mode === 'No') return acc + amt;
      return acc + calc.amountForVat;
    }, 0);
  }, [items, vatRate]);

  const formVatTotal = useMemo(() => {
    return items.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = parseFloat(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, vatRate);
      return acc + calc.vatAmount;
    }, 0);
  }, [items, vatRate]);

  const formGrossTotal = useMemo(() => {
    return items.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = parseFloat(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, vatRate);
      return acc + calc.grossAmount;
    }, 0);
  }, [items, vatRate]);

  // Dialog state: which voucher's transactions to show
  const [dialogVoucher, setDialogVoucher] = useState<string | null>(null);

  const dialogTransactions = useMemo(() => {
    if (!dialogVoucher) return [];
    return ledgerEntries.filter(e => e.voucherNo === dialogVoucher);
  }, [dialogVoucher, ledgerEntries]);

  const dialogNetTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, curr.vatRate || vatRate);
      if (mode === 'No') return acc + amt;
      return acc + (curr.amountForVat ?? calc.amountForVat);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogVatTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, curr.vatRate || vatRate);
      return acc + (curr.vatAmount ?? calc.vatAmount);
    }, 0);
  }, [dialogTransactions, vatRate]);

  const dialogGrossTotal = useMemo(() => {
    return dialogTransactions.reduce((acc, curr) => {
      const mode = curr.vatMode || (curr.isVatable ? 'Yes' : 'No');
      const amt = Number(curr.amount) || 0;
      const calc = calculateItemVat(amt, mode, curr.vatRate || vatRate);
      return acc + calc.grossAmount;
    }, 0);
  }, [dialogTransactions, vatRate]);

  // Description callout dialog: { idx, value } | null
  const [descDialog, setDescDialog] = useState<{ idx: number; value: string } | null>(null);

  // Record Search States
  const [search, setSearch] = useState('');
  const [searchKey, setSearchKey] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'transaction' | 'voucher'>('transaction');

  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      if (fromDate || toDate) {
        let targetDate = e.date;
        if (dateFilterType === 'voucher') {
          const match = e.voucherNo.match(/^VN(\d{2})-(\d{2})-(\d{2})/);
          if (match) targetDate = `20${match[1]}-${match[2]}-${match[3]}`;
        }
        if (fromDate && targetDate < fromDate) return false;
        if (toDate && targetDate > toDate) return false;
      }
      
      if (search) {
        const q = search.toLowerCase();
        switch (searchKey) {
          case 'voucherNo': return (e.voucherNo || '').toLowerCase().includes(q);
          case 'description': return (e.description || '').toLowerCase().includes(q);
          case 'category': return (e.category || '').toLowerCase().includes(q);
          case 'client': return (e.client || '').toLowerCase().includes(q);
          case 'site': return (e.site || '').toLowerCase().includes(q);
          case 'vendor': return (e.vendor || '').toLowerCase().includes(q);
          case 'bank': return (e.bank || '').toLowerCase().includes(q);
          case 'amount': return String(e.amount || '').includes(q);
          case 'all':
          default:
            return (
              (e.voucherNo || '').toLowerCase().includes(q) ||
              (e.description || '').toLowerCase().includes(q) ||
              (e.category || '').toLowerCase().includes(q) ||
              (e.client || '').toLowerCase().includes(q) ||
              (e.vendor || '').toLowerCase().includes(q) ||
              (e.bank || '').toLowerCase().includes(q) ||
              String(e.amount || '').includes(q) ||
              (e.site || '').toLowerCase().includes(q)
            );
        }
      }
      return true;
    });
  }, [ledgerEntries, search, searchKey, fromDate, toDate, dateFilterType]);

  const voucherSummaries = useMemo(() => {
    const groups: Record<string, { voucherNo: string; date: string; bank: string; total: number; count: number }> = {};
    filteredEntries.forEach(e => {
      const v = e.voucherNo || '—';
      if (!groups[v]) {
        groups[v] = { voucherNo: v, date: e.date, bank: e.bank || '—', total: 0, count: 0 };
      }
      groups[v].total += Number(e.amount) || 0;
      groups[v].count += 1;
    });
    
    const results = Object.values(groups);
    
    return results.sort((a, b) => {
      let valA: any = (a as any)[voucherSortField];
      let valB: any = (b as any)[voucherSortField];
      
      if (voucherSortField === 'date') {
        const d1 = new Date(valA || 0).getTime();
        const d2 = new Date(valB || 0).getTime();
        return voucherSortOrder === 'asc' ? d1 - d2 : d2 - d1;
      }
      
      if (voucherSortField === 'total' || voucherSortField === 'count') {
        return voucherSortOrder === 'asc' ? valA - valB : valB - valA;
      }
      
      const s1 = String(valA || '').toLowerCase();
      const s2 = String(valB || '').toLowerCase();
      if (s1 < s2) return voucherSortOrder === 'asc' ? -1 : 1;
      if (s1 > s2) return voucherSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, voucherSortField, voucherSortOrder]);

  const toggleVoucherSort = (field: string) => {
    if (voucherSortField === field) {
      setVoucherSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setVoucherSortField(field);
      setVoucherSortOrder('asc');
    }
  };

  const sortedEntries = useMemo(() => {
    const data = [...filteredEntries];
    data.sort((a, b) => {
      const field = sortField;
      let valA = a[field];
      let valB = b[field];

      if (field === 'amount') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();

      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [filteredEntries, sortField, sortOrder]);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setPage(1);
  }, [search, searchKey, fromDate, toDate, dateFilterType]);

  const paginatedEntries = useMemo(() => {
    return sortedEntries.slice((page - 1) * pageSize, page * pageSize);
  }, [sortedEntries, page, pageSize]);
  const totalPages = Math.ceil(sortedEntries.length / pageSize);

  const filteredTotal = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  }, [filteredEntries]);

  const handleExport = async (mode: 'bare' | 'detailed' = 'detailed') => {
    if (!priv?.canExport) return;
    let data: any[];
    if (mode === 'bare') {
      data = filteredEntries.map(e => ({
        'Voucher No': e.voucherNo,
        'Date': formatDisplayDate(e.date),
        'Description': e.description,
        'Category': e.category,
        'Amount': e.amount,
      }));
    } else {
      data = filteredEntries.map(e => ({
        'Voucher No': e.voucherNo, 'Date': formatDisplayDate(e.date), 'Description': e.description, 'Category': e.category,
        'Amount': e.amount, 'Client': e.client, 'Site': e.site, 'Vendor': e.vendor, 'Bank': e.bank, 'Entered By': e.enteredBy,
      }));
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Entries');
    
    const fileName = `Ledger_Entries_${mode === 'bare' ? 'Basic_' : 'Detailed_'}${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (window.electronAPI?.savePathDialog) {
      const filePath = await window.electronAPI.savePathDialog({
        title: `Export Ledger Entries (${mode === 'bare' ? 'Basic' : 'Detailed'})`,
        defaultPath: fileName,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });
      if (filePath) {
        const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const success = await window.electronAPI.writeFile(filePath, buf, 'binary');
        if (success) toast.success(`Exported to ${filePath}`);
        else toast.error('Failed to save file.');
      }
    } else {
      XLSX.writeFile(workbook, fileName);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleImportSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!priv?.canAdd) {
      toast.error('You do not have permission to add entries.');
      return;
    }
    setImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImport = (file: File, mode: 'append' | 'overwrite') => {
    setImportFile(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const existingCats = new Set((ledgerCategories || []).map(c => (c.name || '').toLowerCase()));
        const existingBanks = new Set((ledgerBanks || []).map(b => (b.name || '').toLowerCase()));
        const existingVendors = new Set((ledgerVendors || []).map(v => (v.name || '').toLowerCase()));

        let importedCount = 0;
        let skippedCount = 0;
        const toAdd: LedgerEntry[] = [];

        data.forEach((row: any) => {
          const voucherNo = row['Voucher No'] || row.voucher_no || row.voucherNo;
          const date = row['Transaction Date'] || row['Date'] || row.date || row['Voucher Date'];
          const description = row['Description'] || row.description || '';
          const category = row['Category'] || row.category;
          const amount = row['Amount'] || row.amount;
          const client = row['Client'] || row.client || '';
          const site = row['Site'] || row.site || '';
          const vendor = row['Vendor Name'] || row['Vendor'] || row.vendor || '';
          const bank = row['Paid From'] || row['Bank'] || row.bank;
          const enteredBy = row['Entered By'] || row.entered_by || row.enteredBy || currentUser?.name || 'Imported';

          if (!voucherNo || !date || !category || !amount || !bank) return;

          // Duplicate check
          const dupEntry = ledgerEntries.find(
            e => e.voucherNo === voucherNo && e.category === category && e.amount === Number(amount) && e.description === description
          );

          if (dupEntry) {
            if (mode === 'append') {
              skippedCount++;
              return; // skip duplicates in append mode
            } else {
              // overwrite: update the existing entry
              updateLedgerEntry(dupEntry.id, {
                date: normalizeDate(date),
                description: String(description),
                category: String(category),
                amount: Number(amount),
                client: String(client),
                site: String(site),
                vendor: String(vendor),
                bank: String(bank),
                enteredBy: String(enteredBy),
              });
              importedCount++;
              return;
            }
          }

          const catKey = String(category).toLowerCase();
          if (!existingCats.has(catKey)) {
            addLedgerCategory({ id: generateId(), name: String(category) });
            existingCats.add(catKey);
          }

          const bankKey = String(bank).toLowerCase();
          if (!existingBanks.has(bankKey)) {
            addLedgerBank({ id: generateId(), name: String(bank) });
            existingBanks.add(bankKey);
          }

          if (vendor && String(vendor).toLowerCase() !== 'none') {
            const vendorKey = String(vendor).toLowerCase();
            if (!existingVendors.has(vendorKey)) {
              addLedgerVendor({ id: generateId(), name: String(vendor) });
              existingVendors.add(vendorKey);
            }
          }

          toAdd.push({
            id: generateId(),
            voucherNo: String(voucherNo),
            date: normalizeDate(date),
            description: String(description),
            category: String(category),
            amount: Number(amount),
            client: String(client),
            site: String(site),
            vendor: String(vendor),
            bank: String(bank),
            enteredBy: String(enteredBy),
          });
          importedCount++;
        });

        if (toAdd.length > 0) {
          const state = useAppStore.getState() as any;
          if (state.bulkAddLedgerEntries) {
            state.bulkAddLedgerEntries(toAdd);
          } else {
            toAdd.forEach(entry => addLedgerEntry(entry));
          }
        }

        if (importedCount > 0) {
          const suffix = skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped)` : '';
          toast.success(`Successfully imported ${importedCount} ledger entr${importedCount !== 1 ? 'ies' : 'y'}.${suffix}`);
        } else if (skippedCount > 0) {
          toast.info(`No new entries imported — ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped.`);
        } else {
          toast.info('No valid entries found to import.');
        }
      } catch (err) {
        console.error('Import Error:', err);
        toast.error('Failed to parse file. Please ensure it is a valid Excel/CSV file matching the Ledger Export format.');
      }
    };
    reader.readAsBinaryString(file);
  };






  useSetPageTitle(
    tab === 'entry' ? 'Company Ledger' : tab === 'records' ? 'Voucher Records' : 'Expenses VAT',
    tab === 'entry'
      ? 'Record vouchers, manage expenses, and track financial outflows across banks and sites'
      : tab === 'records'
      ? `Click any voucher to view its transactions. Showing ${voucherSummaries.length} voucher${voucherSummaries.length !== 1 ? 's' : ''}.`
      : 'Monthly accumulated VAT on ledger expenses for tax remittance planning',
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shadow-sm backdrop-blur-sm">
          <button onClick={() => setTab('entry')} className={`px-2 sm:px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${tab === 'entry' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Entry</span>
          </button>
          <button onClick={() => setTab('records')} className={`px-2 sm:px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${tab === 'records' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
            <History className="h-3.5 w-3.5" /> <span className="hidden sm:inline">History</span>
          </button>
          <button onClick={() => setTab('vat')} className={`px-2 sm:px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${tab === 'vat' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}>
            <Receipt className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Expenses VAT</span>
          </button>
        </div>
        <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-1" />
        {tab === 'records' && (
          <>
            <button
              className={`sm:hidden h-9 w-9 flex items-center justify-center rounded-xl border ${showMobileFilters ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'} shadow-sm transition-all`}
              onClick={() => setShowMobileFilters(o => !o)}
              title="Toggle filters"
            >
              <Filter className="h-4 w-4" />
            </button>
            {priv.canAdd && (
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 px-2 sm:px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight hover:bg-slate-50 shadow-sm transition-all">
                <Download className="h-4 w-4 text-indigo-500" /> <span className="hidden sm:inline">Import</span>
              </Button>
            )}
            {priv.canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2 sm:px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight hover:bg-slate-50 shadow-sm transition-all">
                    <Upload className="h-4 w-4 text-emerald-500" /> <span className="hidden sm:inline">Export</span> <ChevronDown className="h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Choose Export Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport('bare')} className="cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">Basic</span>
                      <span className="text-[10px] text-slate-500">Voucher, date, description, category &amp; amount</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('detailed')} className="cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">Detailed</span>
                      <span className="text-[10px] text-slate-500">Full records with client, site, vendor &amp; bank</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    </div>,
    [tab, priv, hasUnsavedPending, activeVoucherNo, ledgerEntries, voucherDate, paidFrom, items, currentUser, voucherSummaries.length, showMobileFilters]
  );

  if (!priv?.canView) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center rounded-lg border bg-card p-8">
          <FileText className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        </div>
      </div>
    );
  }

  const tdClass = "p-0 text-xs border border-slate-200 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 focus-within:bg-indigo-50/10 transition-all relative";
  const inputClass = "w-full h-9 px-3 text-xs bg-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700";
  
  return (
    <div className="flex flex-col gap-6">
      <TabsContent active={tab === 'entry'} className="m-0 focus-visible:outline-none">
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          {/* Form Header */}
          <div className="bg-slate-50/80 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-200/60 backdrop-blur-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voucher No.</label>
              <div className="flex rounded-md shadow-sm">
                <select
                  value={activeVoucherNo || generatedVoucherNo}
                  onChange={async e => {
                    const vno = e.target.value;
                    if (vno === (activeVoucherNo || generatedVoucherNo)) return;
                    
                    if (isLedgerDirty) {
                      const ok = await showConfirm("You have unsaved changes. Discard them?", { variant: 'danger' });
                      if (!ok) return;
                    }
                    
                    if (vno === generatedVoucherNo) {
                      handleClear();
                    } else {
                      loadVoucher(vno);
                    }
                  }}
                  className="bg-white flex-1 min-w-0 h-9 text-xs font-mono text-indigo-700 font-bold border border-r-0 rounded-l-md border-slate-300 outline-none px-2 cursor-pointer truncate"
                >
                  <option value={generatedVoucherNo} className="font-sans italic text-slate-500">
                    New: {generatedVoucherNo}
                  </option>
                  {voucherSummaries.length > 0 && (
                    <optgroup label="Saved Vouchers">
                      {voucherSummaries.map(v => (
                        <option key={v.voucherNo} value={v.voucherNo} className="font-mono text-slate-700">
                          {v.voucherNo}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button onClick={handlePrevVoucher} className="h-9 w-8 shrink-0 bg-slate-50 border border-slate-300 border-l-0 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleNextVoucher} className="h-9 w-8 shrink-0 bg-slate-50 border border-slate-300 border-l-0 rounded-r-md text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voucher Date</label>
              <Input type="date" value={voucherDate} onChange={e => handleDateChange(e.target.value)} className="bg-white h-9 shadow-sm border-slate-300 font-bold text-slate-700 text-xs" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Paid From</label>
              <select className="bg-white h-9 px-3 rounded-md border border-slate-300 text-xs font-bold text-slate-700 shadow-sm outline-none" value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
                <option value="" disabled>Select Bank...</option>
                {sortedBanks.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entered By</label>
              <Input readOnly value={currentUser?.name || ''} className="bg-slate-100/50 h-9 text-xs font-bold text-slate-400 border-slate-200 pointer-events-none shadow-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Directory</label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="h-9 flex-1 sm:w-auto px-3 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-600 font-bold text-[11px] uppercase tracking-wider gap-2 shadow-sm transition-all active:scale-95 bg-white justify-start" 
                  onClick={() => setShowVendorDialog(true)}
                >
                  <Users className="h-3.5 w-3.5" /> Manage Vendors
                </Button>
                <Button 
                  variant="outline" 
                  className="h-9 flex-1 sm:w-auto px-3 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-600 font-bold text-[11px] uppercase tracking-wider gap-2 shadow-sm transition-all active:scale-95 bg-white justify-start" 
                  onClick={() => setShowCategoryDialog(true)}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Manage Categories
                </Button>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden sm:flex flex-col justify-end items-end sm:col-span-1 lg:col-span-3 mt-4 sm:mt-0">
              <div className="flex items-center gap-2">
                {activeVoucherNo && priv.canDelete && (
                  <Button 
                    variant="ghost" 
                    className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-100 bg-white" 
                    onClick={handleDeleteVoucher} 
                    title="Delete Voucher"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white" 
                  onClick={handleReload} 
                  title="Reload Voucher"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className={`h-9 px-4 gap-2 border-slate-300 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight ${hasUnsavedPending ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-50'}`} 
                  onClick={handleClear}
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
                <Button 
                  className="h-9 px-6 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95" 
                  onClick={handleSubmit} 
                  disabled={!priv.canAdd}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Submit Voucher
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Actions (Only visible on small screens) */}
          <div className="sm:hidden p-3 bg-white border-b border-slate-200/60 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex gap-2">
              {activeVoucherNo && priv.canDelete && (
                <Button size="sm" variant="outline" className="h-9 px-3 text-rose-500 hover:bg-rose-50 border-rose-100 font-bold gap-1.5" onClick={handleDeleteVoucher}>
                  <Trash2 className="h-3.5 w-3.5" /> <span className="text-[10px] uppercase tracking-wider">Delete</span>
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-9 px-3 text-slate-500 hover:bg-slate-100 border-slate-200 font-bold gap-1.5" onClick={handleReload}>
                <RotateCcw className="h-3.5 w-3.5" /> <span className="text-[10px] uppercase tracking-wider">Reload</span>
              </Button>
            </div>
            <Button size="sm" className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-md active:scale-95 transition-all" onClick={handleSubmit} disabled={!priv.canAdd}>
              <CheckCircle2 className="h-3.5 w-3.5" /> <span className="text-[10px] uppercase tracking-wider">Submit</span>
            </Button>
          </div>

          {/* Grid Table */}
          {/* Grid Table */}
          <div className="overflow-x-auto select-none">
            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-100 border-b border-slate-200">
              {items.map((item, idx) => (
                <div key={idx} className={`p-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-500 text-xs tracking-wider uppercase">Line {idx + 1}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                         <input type="date" className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white" value={item.transactionDate} onChange={e => setItemField(idx, 'transactionDate', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Amount</label>
                         <div className="relative">
                           <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-semibold">₦</span>
                           <input type="text" className="w-full h-9 pl-6 pr-2 rounded-md border border-slate-200 text-xs font-bold bg-white" value={
                             item.amount 
                               ? item.amount.split('.').length > 1
                                 ? Number(item.amount.split('.')[0]).toLocaleString() + '.' + item.amount.split('.')[1]
                                 : Number(item.amount).toLocaleString()
                               : ''
                           } onChange={e => {
                             const v = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                             const parts = v.split('.');
                             const cleanV = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                             setItemField(idx, 'amount', cleanV);
                           }} />
                         </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                      <input type="text" className="w-full h-9 px-3 rounded-md border border-slate-200 text-xs bg-white" value={item.description} onChange={e => setItemField(idx, 'description', e.target.value)} placeholder="Enter details..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                        <select className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white truncate" value={item.category} onChange={e => setItemField(idx, 'category', e.target.value)}>
                          <option value="">Select...</option>
                          {sortedCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
                        <select className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white truncate" value={item.vendor} onChange={e => setItemField(idx, 'vendor', e.target.value)}>
                          <option value="none">None</option>
                          {sortedVendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Client</label>
                        <select className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white truncate" value={item.client} onChange={e => {
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], client: e.target.value, site: 'none' };
                          setItems(newItems);
                        }}>
                          <option value="none">None</option>
                          {clients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Site</label>
                        <select className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white truncate" value={item.site} onChange={e => setItemField(idx, 'site', e.target.value)}>
                          <option value="none">None</option>
                          {sites
                            .filter(s => !item.client || item.client === 'none' || s.client === item.client)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                          }
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">VAT Policy</label>
                        <select
                          className="h-8 px-2 rounded border border-slate-200 text-xs bg-white font-bold text-indigo-700 outline-none cursor-pointer"
                          value={item.vatMode || (item.isVatable ? 'Yes' : 'No')}
                          onChange={e => {
                            const mode = e.target.value as VatMode;
                            const newItems = [...items];
                            newItems[idx] = {
                              ...newItems[idx],
                              vatMode: mode,
                              isVatable: mode !== 'No',
                            };
                            setItems(newItems);
                          }}
                        >
                          <option value="No">No VAT (No)</option>
                          <option value="Yes">Exclusive VAT (Yes)</option>
                          <option value="Add">Inclusive VAT (Add)</option>
                        </select>
                      </div>
                      {(() => {
                        const mode = item.vatMode || (item.isVatable ? 'Yes' : 'No');
                        if (mode === 'No') return null;
                        const amt = parseFloat(item.amount) || 0;
                        const calc = calculateItemVat(amt, mode, vatRate);
                        return (
                          <div className="text-right font-extrabold text-emerald-700 text-xs bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                            VAT ({mode}): ₦{calc.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-indigo-50 flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">Subtotal (Line Items)</span>
                  <span className="font-bold text-slate-800 text-sm tabular-nums">₦{formTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-indigo-700 font-semibold">
                  <span>Base Vatable Amount</span>
                  <span className="tabular-nums">₦{formNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {formVatTotal > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold text-xs">
                    <span>Total VAT ({vatRate}%)</span>
                    <span className="tabular-nums">₦{formVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-indigo-200/60 font-extrabold text-indigo-900 text-sm">
                  <span>Gross Total</span>
                  <span className="tabular-nums">₦{formGrossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Desktop View */}
            <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-slate-800 w-10 text-[10px] uppercase tracking-widest opacity-70">Nº</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-[140px] text-[10px] uppercase tracking-widest opacity-70">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-1/4 text-[10px] uppercase tracking-widest opacity-70">Description</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-44 text-[10px] uppercase tracking-widest opacity-70">Category</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-32 text-[10px] uppercase tracking-widest opacity-70">Amount</th>
                  <th className="py-2.5 px-2 border-r border-slate-800 w-24 text-center text-[10px] uppercase tracking-widest opacity-70">VAT Policy</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-32 text-right text-[10px] uppercase tracking-widest opacity-70">VAT ({vatRate}%)</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-36 text-[10px] uppercase tracking-widest opacity-70">Client</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-36 text-[10px] uppercase tracking-widest opacity-70">Site</th>
                  <th className="py-2.5 px-3 text-[10px] uppercase tracking-widest opacity-70">Vendor</th>
                </tr>
              </thead>
              <tbody className="bg-slate-50">
                {items.map((item, idx) => (
                  <tr key={idx} className="group hover:bg-white transition-colors even:bg-slate-100/50">
                    <td className="text-center font-semibold text-slate-400 border border-slate-200 bg-slate-100">{idx + 1}</td>
                    <td className={tdClass}>
                      <input type="date" className={inputClass} value={item.transactionDate} onChange={e => setItemField(idx, 'transactionDate', e.target.value)} />
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center w-full h-9">
                        <input
                          type="text"
                          className={inputClass + ' flex-1 min-w-0 pr-1'}
                          value={item.description}
                          onChange={e => setItemField(idx, 'description', e.target.value)}
                          placeholder="Description..."
                        />
                        {/* Book icon — click to open callout dialog */}
                        <button
                          type="button"
                          onClick={() => setDescDialog({ idx, value: item.description })}
                          className="shrink-0 px-2 text-slate-300 hover:text-indigo-500 transition-colors bg-transparent border-none outline-none"
                          title="View full description"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <select className={inputClass} value={item.category} onChange={e => setItemField(idx, 'category', e.target.value)}>
                        <option value=""></option>
                        {sortedCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center relative h-9 group-focus-within:text-indigo-600">
                        <span className="text-slate-400 absolute left-3 text-xs pointer-events-none">₦</span>
                        <input 
                          type="text" 
                          className={`w-full h-9 pl-7 pr-3 text-xs bg-transparent outline-none font-medium`} 
                          value={
                            item.amount 
                              ? item.amount.split('.').length > 1
                                ? Number(item.amount.split('.')[0]).toLocaleString() + '.' + item.amount.split('.')[1]
                                : Number(item.amount).toLocaleString()
                              : ''
                          } 
                          onChange={e => {
                            const v = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                            const parts = v.split('.');
                            const cleanV = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                            setItemField(idx, 'amount', cleanV);
                          }} 
                        />
                      </div>
                    </td>
                    <td className={tdClass + " text-center"}>
                      <select 
                        className="w-full h-8 px-1.5 rounded border border-slate-200 text-xs bg-white font-extrabold text-indigo-700 outline-none cursor-pointer text-center" 
                        value={item.vatMode || (item.isVatable ? 'Yes' : 'No')} 
                        onChange={e => {
                          const mode = e.target.value as VatMode;
                          const newItems = [...items];
                          newItems[idx] = {
                            ...newItems[idx],
                            vatMode: mode,
                            isVatable: mode !== 'No',
                          };
                          setItems(newItems);
                        }} 
                        title="VAT Policy: No (No VAT), Yes (Exclusive VAT added), Add (Inclusive VAT in amount)"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                        <option value="Add">Add</option>
                      </select>
                    </td>
                    <td className={tdClass + " bg-slate-50/60 text-right pr-3 font-mono"}>
                      {(() => {
                        const mode = item.vatMode || (item.isVatable ? 'Yes' : 'No');
                        if (mode === 'No') return <span className="text-slate-300 text-xs">—</span>;
                        const amt = parseFloat(item.amount) || 0;
                        const calc = calculateItemVat(amt, mode, vatRate);
                        return (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-700 font-extrabold text-xs">
                              ₦{calc.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              ({mode})
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className={tdClass}>
                      <select
                        className={inputClass}
                        value={item.client}
                        onChange={e => {
                          // Reset site when client changes
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], client: e.target.value, site: 'none' };
                          setItems(newItems);
                        }}
                      >
                        <option value="none"></option>
                        {clients.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className={tdClass}>
                      {/* Only show sites belonging to the selected client */}
                      <select className={inputClass} value={item.site} onChange={e => setItemField(idx, 'site', e.target.value)}>
                        <option value="none"></option>
                        {sites
                          .filter(s => !item.client || item.client === 'none' || s.client === item.client)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                        }
                      </select>
                    </td>
                    <td className={tdClass}>
                      <select className={inputClass} value={item.vendor} onChange={e => setItemField(idx, 'vendor', e.target.value)}>
                        <option value="none"></option>
                        {sortedVendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="text-right py-3 px-4 font-bold text-slate-700 bg-white border border-slate-200">
                    Totals
                  </td>
                  <td className="py-3 px-3 font-bold text-indigo-700 border border-slate-200 bg-indigo-50/50">
                    ₦{formTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="border border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-400">
                    VAT
                  </td>
                  <td className="py-3 px-3 font-extrabold text-emerald-700 border border-slate-200 bg-emerald-50/50 text-right">
                    ₦{formVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3} className="bg-white border border-slate-200 text-slate-500 px-4 text-xs italic">
                    Base Vatable Amount: ₦{formNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Total VAT ({vatRate}%): ₦{formVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Gross Total: ₦{formGrossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      {/* ── Description Callout Dialog ─────────────────────────────────────── */}
      {descDialog !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setDescDialog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-indigo-700 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-200" />
                <span className="text-white font-semibold text-sm uppercase tracking-wider">
                  Row {descDialog.idx + 1} — Description
                </span>
              </div>
              <button
                onClick={() => setDescDialog(null)}
                className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description content */}
            <div className="p-6">
              {items[descDialog.idx]?.description ? (
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {items[descDialog.idx].description}
                </p>
              ) : (
                <p className="text-slate-400 italic text-sm">No description entered for this row.</p>
              )}
            </div>

            {/* Inline edit area */}
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Edit Description</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                rows={3}
                value={items[descDialog.idx]?.description || ''}
                onChange={e => {
                  setItemField(descDialog.idx, 'description', e.target.value);
                  setDescDialog({ ...descDialog, value: e.target.value });
                }}
                placeholder="Type description here..."
                autoFocus
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setDescDialog(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TabsContent active={tab === 'records'} className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <History className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-800 tracking-tight">Records</h3>
              </div>
              
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setHistoryViewMode('detailed')}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${historyViewMode === 'detailed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Detailed View
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setHistoryViewMode('grouped')}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${historyViewMode === 'grouped' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> Voucher View
                </Button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                  <select 
                    className="h-8 px-2 rounded-md border-none bg-transparent text-xs text-slate-600 font-bold focus:ring-0" 
                    value={dateFilterType} 
                    onChange={e => setDateFilterType(e.target.value as any)}
                  >
                    <option value="transaction">Trans Date</option>
                    <option value="voucher">Voucher Date</option>
                  </select>
                  <div className="h-4 w-px bg-slate-200 mx-1" />
                  <Input type="date" className="h-8 w-32 text-xs border-none bg-transparent focus-visible:ring-0 p-0" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span className="text-slate-300 text-[10px] font-bold uppercase">to</span>
                  <Input type="date" className="h-8 w-32 text-xs border-none bg-transparent focus-visible:ring-0 p-0" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-50 p-1 rounded-lg border border-slate-100">
                  <select 
                    className="h-8 px-2 rounded-md border-none bg-transparent text-xs text-slate-600 font-bold focus:ring-0 max-w-[110px]" 
                    value={searchKey} 
                    onChange={e => setSearchKey(e.target.value)}
                  >
                    <option value="all">All Fields</option>
                    <option value="description">Description</option>
                    <option value="amount">Amount</option>
                    <option value="category">Category</option>
                    <option value="client">Client</option>
                    <option value="site">Site</option>
                    <option value="vendor">Vendor</option>
                    <option value="voucherNo">Voucher No.</option>
                  </select>
                  <div className="h-4 w-px bg-slate-200 mx-1" />
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      placeholder="Search records..." 
                      className="pl-7 h-8 w-40 md:w-56 text-xs border-none bg-transparent focus-visible:ring-0" 
                      value={search} 
                      onChange={(e) => setSearch(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
              <div>
                {search.trim() && (
                  <div className="flex items-center gap-2 py-1.5 px-3 bg-indigo-50/50 rounded-lg border border-indigo-100 w-fit">
                    <Search className="h-3 w-3 text-indigo-500" />
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                      Results for: <span className="text-slate-900">{search}</span>
                    </span>
                    <button onClick={() => setSearch('')} className="ml-1 text-indigo-400 hover:text-indigo-600 flex items-center justify-center p-0.5 rounded hover:bg-indigo-100/50 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 py-1.5 px-3 bg-indigo-50/80 rounded-lg border border-indigo-100 shadow-sm backdrop-blur-sm ml-auto">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  Filtered Total:
                </span>
                <span className="text-xs font-extrabold text-indigo-900 tabular-nums">
                  ₦{filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {historyViewMode === 'detailed' ? (
                <>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('voucherNo')}>
                        <div className="flex items-center gap-1.5">
                          Voucher No. {sortField === 'voucherNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('date')}>
                        <div className="flex items-center gap-1.5">
                          Date {sortField === 'date' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('description')}>
                        <div className="flex items-center gap-1.5">
                          Description {sortField === 'description' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('category')}>
                        <div className="flex items-center gap-1.5">
                          Category {sortField === 'category' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('client')}>
                        <div className="flex items-center gap-1.5">
                          Client {sortField === 'client' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('site')}>
                        <div className="flex items-center gap-1.5">
                          Site {sortField === 'site' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('bank')}>
                        <div className="flex items-center gap-1.5">
                          Bank {sortField === 'bank' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('amount')}>
                        <div className="flex items-center justify-end gap-1.5">
                          Amount {sortField === 'amount' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">VAT ({vatRate}%)</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleSort('vendor')}>
                        <div className="flex items-center gap-1.5">
                          Vendor {sortField === 'vendor' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 italic text-sm">
                          No entries found.
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((entry, idx) => (
                        <tr
                          key={entry.id || `flat-${idx}`}
                          className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="py-2.5 px-4">
                            <button
                              className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-xs transition-colors text-left"
                              onClick={() => setDialogVoucher(entry.voucherNo)}
                              title="View full voucher"
                            >
                              {entry.voucherNo || '—'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-xs font-mono whitespace-nowrap">
                            {entry.date ? formatDisplayDate(entry.date) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium text-xs max-w-[200px] truncate" title={entry.description}>
                            {entry.description || <span className="text-slate-300 italic">—</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 whitespace-nowrap">
                              {entry.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{entry.client || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{entry.site || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{entry.bank || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums text-xs">
                            ₦{Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-xs whitespace-nowrap">
                            {entry.isVatable ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                                ₦{(entry.vatAmount ?? (Number(entry.amount) * (vatRate / 100))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-xs">{entry.vendor || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                                title="View voucher"
                                onClick={() => setDialogVoucher(entry.voucherNo)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {priv?.canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete this line"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const voucherLines = ledgerEntries.filter(en => en.voucherNo === entry.voucherNo);
                                    const isLast = voucherLines.length === 1;
                                    const ok = await showConfirm(
                                      isLast
                                        ? `This is the only transaction in voucher ${entry.voucherNo}. Deleting it will remove the entire voucher. Continue?`
                                        : 'Delete this transaction line from the voucher?',
                                      { variant: 'danger', confirmLabel: 'Delete Line' }
                                    );
                                    if (ok) {
                                      deleteLedgerEntry(entry.id);
                                      toast.success('Transaction line removed.');
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <span className="text-sm text-slate-500">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedEntries.length)} of {sortedEntries.length} entries
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                      <span className="text-sm font-medium">Page {page} of {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                    </div>
                  </div>
                )}
                </>
              ) : (
                /* ── GROUPED VOUCHER VIEW ── */
                <>
                  {/* Mobile card list */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {voucherSummaries.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-sm italic">No vouchers found.</div>
                    ) : (
                      voucherSummaries.map((v, i) => (
                        <div
                          role="button"
                          tabIndex={0}
                          key={v.voucherNo || `v-${i}`}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-indigo-50/30 active:bg-indigo-100/40 cursor-pointer transition-colors"
                          onClick={() => setDialogVoucher(v.voucherNo)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono font-bold text-indigo-600 text-sm">{v.voucherNo || '—'}</span>
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold">{v.count}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              {v.date && <span>{formatDisplayDate(v.date)}</span>}
                              {v.bank && <><span>·</span><span>{v.bank}</span></>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-slate-900 text-sm tabular-nums">
                              ₦{(isNaN(v.total) ? 0 : v.total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-[10px] text-indigo-500 font-medium">Tap to view</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop table */}
                  <table className="w-full text-sm hidden md:table">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleVoucherSort('voucherNo')}>
                          <div className="flex items-center gap-1.5">
                            Voucher No. {voucherSortField === 'voucherNo' ? (voucherSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleVoucherSort('date')}>
                          <div className="flex items-center gap-1.5">
                            Date {voucherSortField === 'date' ? (voucherSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleVoucherSort('bank')}>
                          <div className="flex items-center gap-1.5">
                            Bank {voucherSortField === 'bank' ? (voucherSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-40 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleVoucherSort('total')}>
                          <div className="flex items-center justify-end gap-1.5">
                            Total Amount {voucherSortField === 'total' ? (voucherSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => toggleVoucherSort('count')}>
                          <div className="flex items-center justify-center gap-1.5">
                            Lines {voucherSortField === 'count' ? (voucherSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 italic text-sm">No vouchers found.</td>
                        </tr>
                      ) : (
                        voucherSummaries.map((v, i) => (
                          <tr key={v.voucherNo || `v-${i}`} className="border-b border-slate-100 hover:bg-indigo-50/30 cursor-pointer transition-colors" onClick={() => setDialogVoucher(v.voucherNo)}>
                            <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">{v.voucherNo || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">{v.date ? formatDisplayDate(v.date) : '—'}</td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs">{v.bank || '—'}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 text-right tabular-nums text-xs">₦{(isNaN(v.total) ? 0 : v.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-center"><span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">{v.count}</span></td>
                            <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 gap-1 h-8 px-2 text-xs font-bold" onClick={() => setDialogVoucher(v.voucherNo)}>
                                  <Eye className="h-3.5 w-3.5" /> View
                                </Button>
                                {priv?.canDelete && (
                                  <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0" title="Delete Voucher" onClick={async () => {
                                    const vno = v.voucherNo;
                                    const count = ledgerEntries.filter(e => e.voucherNo === vno).length;
                                    const ok = await showConfirm(`Delete voucher ${vno}?\n\nThis will permanently remove all ${count} transaction(s) in this voucher.`, { variant: 'danger', confirmLabel: 'Yes, Delete' });
                                    if (ok) {
                                      ledgerEntries.filter(e => e.voucherNo === vno).forEach(r => deleteLedgerEntry(r.id));
                                      toast.success(`Deleted voucher ${vno}.`);
                                    }
                                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Expenses VAT Tab */}
      <TabsContent active={tab === 'vat'} className="m-0 focus-visible:outline-none">
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-emerald-500/10 to-teal-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Accumulated VAT</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    ₦{overallVatStats.totalVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Total VAT to remit</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <Receipt className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-teal-500/10 to-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700">VAT Paid / Remitted</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    ₦{overallVatStats.totalVatPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Reconciled VAT payments</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className={cn(
              "border-slate-200 shadow-sm",
              overallVatStats.vatBalance <= 0 ? "bg-emerald-50/50" : overallVatStats.totalVatPaid > 0 ? "bg-amber-50/50" : "bg-rose-50/50"
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-[10px] font-extrabold uppercase tracking-widest",
                    overallVatStats.vatBalance <= 0 ? "text-emerald-700" : overallVatStats.totalVatPaid > 0 ? "text-amber-700" : "text-rose-700"
                  )}>
                    Outstanding Balance
                  </p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    ₦{Math.max(0, overallVatStats.vatBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {overallVatStats.vatBalance <= 0 ? 'Fully Reconciled' : 'VAT payment due'}
                  </p>
                </div>
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center font-bold shrink-0",
                  overallVatStats.vatBalance <= 0 ? "bg-emerald-100 text-emerald-700" : overallVatStats.totalVatPaid > 0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                )}>
                  {overallVatStats.vatBalance <= 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
              </CardContent>
            </Card>

            {/* Amount for VAT Card */}
            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-indigo-500/10 to-blue-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">Amount for VAT</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    ₦{overallVatStats.amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Base gross amount for VAT</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Calculator className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Current VAT Rate</p>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {vatRate}%
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Set in Variables Settings</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Percent className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Accumulated VAT Breakdown */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-600" /> Expenses VAT Reconciliation & Remittances
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Track monthly expenses VAT, filter by category, and reconcile linked ledger payment vouchers
                  </CardDescription>
                </div>

                {/* Filter Controls: Month Dropdown + Category Dropdown + Search Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <div className="relative min-w-[150px]">
                    <select
                      value={selectedVatMonth}
                      onChange={e => setSelectedVatMonth(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="all">📅 All Months</option>
                      {availableVatMonths.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative min-w-[170px]">
                    <select
                      value={selectedVatCategory}
                      onChange={e => setSelectedVatCategory(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="all">📁 All Categories</option>
                      {sortedCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search vatable records..." 
                      className="pl-9 h-9 border-slate-200 bg-white text-xs" 
                      value={search} 
                      onChange={e => setSearch(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {filteredVatSummaries.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Receipt className="h-10 w-10 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">
                    No vatable ledger transactions found
                    {selectedVatMonth !== 'all' ? ' for the selected month' : ''}
                    {selectedVatCategory !== 'all' ? ` in ${selectedVatCategory}` : ''}.
                  </p>
                  <p className="text-xs text-slate-400">When creating ledger vouchers in the Entry tab, set the VAT Policy to "Yes" or "Add" on transaction lines to accumulate VAT here.</p>
                </div>
              ) : (
                filteredVatSummaries.map((monthGroup) => {
                  const isExpanded = expandedMonths.has(monthGroup.monthKey);

                  const displayEntries = search.trim()
                    ? monthGroup.entries.filter(e => 
                        (e.voucherNo || '').toLowerCase().includes(search.toLowerCase()) ||
                        (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
                        (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
                        (e.vendor || '').toLowerCase().includes(search.toLowerCase()) ||
                        (e.client || '').toLowerCase().includes(search.toLowerCase())
                      )
                    : monthGroup.entries;

                  if (search.trim() && displayEntries.length === 0 && monthGroup.remittances.length === 0) return null;

                  const pctPaid = monthGroup.totalVatAmount > 0 
                    ? Math.min(100, Math.round((monthGroup.totalVatPaid / monthGroup.totalVatAmount) * 100))
                    : 100;

                  return (
                    <div key={monthGroup.monthKey} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      {/* Month Header Card Bar */}
                      <div className="p-4 bg-slate-50/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/60">
                        <div 
                          onClick={() => toggleMonthExpand(monthGroup.monthKey)}
                          className="flex items-center gap-3 cursor-pointer group flex-1"
                        >
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">{monthGroup.monthLabel}</h4>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1",
                                monthGroup.status === 'Fully Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                monthGroup.status === 'Partially Paid' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-rose-50 text-rose-700 border-rose-200"
                              )}>
                                {monthGroup.status === 'Fully Paid' && <CheckCircle2 className="h-3 w-3" />}
                                {monthGroup.status === 'Partially Paid' && <Clock className="h-3 w-3" />}
                                {monthGroup.status === 'Unpaid' && <AlertCircle className="h-3 w-3" />}
                                {monthGroup.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 font-medium">
                              <span>{monthGroup.entries.length} vatable transaction{monthGroup.entries.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>{monthGroup.remittances.length} remittance payment{monthGroup.remittances.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Totals & Actions */}
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accumulated VAT</div>
                            <div className="text-sm font-extrabold text-slate-900 tabular-nums">
                              ₦{monthGroup.totalVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">VAT Paid</div>
                            <div className="text-sm font-extrabold text-teal-700 tabular-nums">
                              ₦{monthGroup.totalVatPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance</div>
                            <div className={cn(
                              "text-sm font-extrabold tabular-nums",
                              monthGroup.vatBalance <= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              ₦{Math.max(0, monthGroup.vatBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Reconcile / Pay Action Button */}
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReconcileMonthKey(monthGroup.monthKey);
                              setReconcileSearchQuery('');
                            }}
                          >
                            <Link className="h-3.5 w-3.5" /> Reconcile / Pay VAT
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            onClick={() => toggleMonthExpand(monthGroup.monthKey)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Reconciliation Progress Bar */}
                      <div className="w-full bg-slate-100 h-1.5 relative overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            pctPaid >= 100 ? "bg-emerald-500" : pctPaid > 0 ? "bg-amber-500" : "bg-rose-400"
                          )} 
                          style={{ width: `${pctPaid}%` }}
                        />
                      </div>

                      {/* Expandable Table Content */}
                      {isExpanded && (
                        <div className="divide-y divide-slate-100">
                          {/* 1. Vatable Expense Transactions Table */}
                          <div className="p-4 space-y-2">
                            <h5 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Receipt className="h-3.5 w-3.5 text-indigo-600" /> Vatable Expenses ({displayEntries.length})
                            </h5>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-900 text-white font-semibold">
                                  <tr>
                                    <th className="py-2.5 px-3 border-r border-slate-800">Voucher No.</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800">Date</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800 w-1/3">Description</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800">Category</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800">Vendor</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800">Client / Site</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800 text-center">VAT Policy</th>
                                    <th className="py-2.5 px-3 border-r border-slate-800 text-right">Line Amount (₦)</th>
                                    <th className="py-2.5 px-3 text-right">VAT Amount ({vatRate}%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {displayEntries.map((entry) => {
                                    const vMode: VatMode = entry.vatMode || (entry.isVatable ? 'Yes' : 'No');
                                    const calculated = calculateItemVat(Number(entry.amount), vMode, vatRate);
                                    const entryVat = entry.vatAmount ?? calculated.vatAmount;
                                    return (
                                      <tr key={entry.id} className="hover:bg-indigo-50/20 transition-colors">
                                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                                          <button 
                                            className="hover:underline"
                                            onClick={(e) => { e.stopPropagation(); setDialogVoucher(entry.voucherNo); }}
                                          >
                                            {entry.voucherNo}
                                          </button>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-slate-600">{formatDisplayDate(entry.date)}</td>
                                        <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[250px] truncate" title={entry.description}>{entry.description || '—'}</td>
                                        <td className="py-2.5 px-3">
                                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{entry.category}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">{entry.vendor || '—'}</td>
                                        <td className="py-2.5 px-3 text-slate-500">{entry.client || '—'}{entry.site ? ` / ${entry.site}` : ''}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 border border-slate-200">
                                            {vMode}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800 tabular-nums">
                                          ₦{Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 bg-emerald-50/50 tabular-nums">
                                          ₦{entryVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* 2. Linked VAT Remittance Payments Table */}
                          <div className="p-4 bg-slate-50/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-extrabold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Reconciled VAT Remittances ({monthGroup.remittances.length})
                              </h5>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[11px] font-bold text-teal-700 border-teal-200 hover:bg-teal-50 gap-1"
                                onClick={() => {
                                  setReconcileMonthKey(monthGroup.monthKey);
                                  setReconcileSearchQuery('');
                                }}
                              >
                                <Plus className="h-3 w-3" /> Add Remittance
                              </Button>
                            </div>

                            {monthGroup.remittances.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                                No VAT payments linked for this month yet. Click <strong>"Reconcile / Pay VAT"</strong> to link a ledger payment voucher or record a direct remittance.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-teal-200 bg-white">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                  <thead className="bg-teal-950 text-teal-100 font-semibold">
                                    <tr>
                                      <th className="py-2.5 px-3">Date</th>
                                      <th className="py-2.5 px-3">Voucher / Ref No.</th>
                                      <th className="py-2.5 px-3">Bank</th>
                                      <th className="py-2.5 px-3 w-1/3">Notes / Description</th>
                                      <th className="py-2.5 px-3">Recorded By</th>
                                      <th className="py-2.5 px-3 text-right">Amount Remitted (₦)</th>
                                      <th className="py-2.5 px-3 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {monthGroup.remittances.map((rem) => (
                                      <tr key={rem.id} className="hover:bg-teal-50/30 transition-colors">
                                        <td className="py-2.5 px-3 font-mono text-slate-700">{formatDisplayDate(rem.date)}</td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                                          {rem.voucherNo ? (
                                            <button className="hover:underline" onClick={() => setDialogVoucher(rem.voucherNo!)}>
                                              {rem.voucherNo}
                                            </button>
                                          ) : 'Direct'}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-700 font-medium">{rem.bank || 'Bank Transfer'}</td>
                                        <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate" title={rem.notes}>{rem.notes || 'VAT Remittance'}</td>
                                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{rem.createdBy || 'User'}</td>
                                        <td className="py-2.5 px-3 text-right font-extrabold text-teal-700 tabular-nums">
                                          ₦{Number(rem.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                            title="Remove VAT remittance link"
                                            onClick={async () => {
                                              const ok = await showConfirm('Remove this VAT remittance link?', { variant: 'danger', confirmLabel: 'Unlink' });
                                              if (ok) {
                                                deleteExpenseVatRemittance(rem.id);
                                                toast.success('VAT remittance link removed.');
                                              }
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Expenses VAT Reconciliation Modal Dialog */}
      {reconcileMonthKey && (
        <Dialog open={reconcileMonthKey !== null} onOpenChange={() => setReconcileMonthKey(null)}>
          <DialogContent className="max-w-5xl w-[95vw] overflow-hidden p-0 rounded-2xl">
            <DialogHeader className="bg-indigo-700 px-6 py-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                    <Link className="h-5 w-5 text-indigo-200" /> Reconcile Expenses VAT — {monthlyVatSummaries.find(g => g.monthKey === reconcileMonthKey)?.monthLabel}
                  </DialogTitle>
                  <p className="text-indigo-200 text-xs mt-1">
                    Link existing ledger payment vouchers or record direct VAT remittance payments
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReconcileMonthKey(null)}
                  className="h-8 w-8 rounded-full bg-indigo-800/60 hover:bg-indigo-900 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Reconciliation Tabs Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center gap-3 text-xs font-bold">
              <button
                onClick={() => setReconcileTab('link')}
                className={cn(
                  "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                  reconcileTab === 'link' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Search className="h-3.5 w-3.5" /> Link Ledger Payment
              </button>
              <button
                onClick={() => setReconcileTab('direct')}
                className={cn(
                  "px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                  reconcileTab === 'direct' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Plus className="h-3.5 w-3.5" /> Record Direct VAT Payment
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              {reconcileTab === 'link' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search ledger entries by voucher no, category, vendor, or bank..."
                      className="pl-9 h-9 text-xs"
                      value={reconcileSearchQuery}
                      onChange={e => setReconcileSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[50vh] max-w-full">
                    <table className="w-full min-w-[700px] text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Voucher No.</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Bank</th>
                          <th className="py-2.5 px-3 w-1/3">Description</th>
                          <th className="py-2.5 px-3 text-right">Amount (₦)</th>
                          <th className="py-2.5 px-3 text-center sticky right-0 bg-slate-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {ledgerEntries
                          .filter(e => {
                            if (!reconcileSearchQuery.trim()) return true;
                            const q = reconcileSearchQuery.toLowerCase();
                            return (
                              (e.voucherNo || '').toLowerCase().includes(q) ||
                              (e.category || '').toLowerCase().includes(q) ||
                              (e.description || '').toLowerCase().includes(q) ||
                              (e.bank || '').toLowerCase().includes(q) ||
                              (e.vendor || '').toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 30)
                          .map((entry) => {
                            const isAlreadyLinked = (expenseVatRemittances || []).some(
                              r => r.ledgerEntryId === entry.id && r.monthKey === reconcileMonthKey
                            );
                            return (
                              <tr key={entry.id} className="hover:bg-indigo-50/20 transition-colors">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{entry.voucherNo}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{formatDisplayDate(entry.date)}</td>
                                <td className="py-2.5 px-3"><span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">{entry.category}</span></td>
                                <td className="py-2.5 px-3 text-slate-600">{entry.bank || '—'}</td>
                                <td className="py-2.5 px-3 text-slate-700 max-w-[200px] truncate" title={entry.description}>{entry.description || '—'}</td>
                                <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 tabular-nums">
                                  ₦{Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-center sticky right-0 bg-white shadow-[ -4px_0_6px_-2px_rgba(0,0,0,0.05) ]">
                                  {isAlreadyLinked ? (
                                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded">Linked</span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                      onClick={() => {
                                        addExpenseVatRemittance({
                                          id: generateId(),
                                          monthKey: reconcileMonthKey,
                                          category: selectedVatCategory !== 'all' ? selectedVatCategory : undefined,
                                          ledgerEntryId: entry.id,
                                          voucherNo: entry.voucherNo,
                                          date: entry.date,
                                          amount: Number(entry.amount),
                                          bank: entry.bank || 'Bank Transfer',
                                          notes: entry.description,
                                          createdAt: new Date().toISOString(),
                                          createdBy: currentUser?.name || 'User',
                                        });
                                        toast.success(`Linked voucher ${entry.voucherNo} to VAT remittance!`);
                                      }}
                                    >
                                      Link to VAT
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReconcileMonthKey(null)}
                      className="font-bold text-slate-700 hover:bg-slate-100 gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" /> Close
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!directForm.amount || parseFloat(directForm.amount) <= 0) {
                      toast.error('Please enter a valid VAT payment amount.');
                      return;
                    }
                    addExpenseVatRemittance({
                      id: generateId(),
                      monthKey: reconcileMonthKey,
                      category: selectedVatCategory !== 'all' ? selectedVatCategory : undefined,
                      voucherNo: directForm.voucherNo || undefined,
                      date: directForm.date,
                      amount: parseFloat(directForm.amount),
                      bank: directForm.bank || 'Bank Remittance',
                      notes: directForm.notes,
                      createdAt: new Date().toISOString(),
                      createdBy: currentUser?.name || 'User',
                    });
                    toast.success('Recorded VAT remittance payment!');
                    setDirectForm({
                      date: new Date().toISOString().split('T')[0],
                      amount: '',
                      bank: '',
                      voucherNo: '',
                      notes: '',
                    });
                    setReconcileMonthKey(null);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 uppercase">Payment Date</label>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={directForm.date}
                        onChange={e => setDirectForm(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 uppercase">Amount Paid (₦)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="h-9 text-xs"
                        value={directForm.amount}
                        onChange={e => setDirectForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 uppercase">Bank / Source</label>
                      <select
                        className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs bg-white"
                        value={directForm.bank}
                        onChange={e => setDirectForm(prev => ({ ...prev, bank: e.target.value }))}
                      >
                        <option value="">Select Bank...</option>
                        {sortedBanks.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-700 uppercase">Voucher / Ref No. (Optional)</label>
                      <Input
                        type="text"
                        placeholder="e.g. VAT-REM-001"
                        className="h-9 text-xs"
                        value={directForm.voucherNo}
                        onChange={e => setDirectForm(prev => ({ ...prev, voucherNo: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 uppercase">Notes / Description</label>
                    <Input
                      type="text"
                      placeholder="e.g. FIRS Monthly VAT Remittance Payment"
                      className="h-9 text-xs"
                      value={directForm.notes}
                      onChange={e => setDirectForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setReconcileMonthKey(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                      Save VAT Remittance
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Voucher Dialog Popup */}
      {dialogVoucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={() => setDialogVoucher(null)}
        >
          <div
            className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[85vh] max-w-4xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Voucher Transactions</p>
                <h2 className="text-white font-bold text-xl tracking-wide font-mono">{dialogVoucher}</h2>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-indigo-200 text-[10px] uppercase font-bold tracking-wider">Subtotal</p>
                    <p className="text-white font-bold text-sm tabular-nums">
                      ₦{dialogNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  {dialogVatTotal > 0 && (
                    <div>
                      <p className="text-emerald-200 text-[10px] uppercase font-bold tracking-wider">VAT ({vatRate}%)</p>
                      <p className="text-emerald-300 font-extrabold text-sm tabular-nums">
                        ₦{dialogVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-indigo-200 text-[10px] uppercase font-bold tracking-wider">Total Amount</p>
                    <p className="text-white font-extrabold text-lg tabular-nums">
                      ₦{dialogGrossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-6 py-4 bg-slate-50 border-b border-slate-100 text-sm shrink-0">
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Bank: </span>
                  <strong className="text-slate-700">{dialogTransactions[0].bank}</strong>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-slate-500">Entered by: </span>
                  <strong className="text-slate-700 truncate max-w-[150px] sm:max-w-none text-right">{dialogTransactions[0].enteredBy}</strong>
                </div>
                <div className="text-center sm:text-left text-slate-500 py-1 sm:py-0 border-y sm:border-0 border-slate-200/60">
                  {dialogTransactions.length} transaction{dialogTransactions.length !== 1 ? 's' : ''}
                </div>
                <Button size="sm" variant="outline" className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-auto" onClick={() => { setDialogVoucher(null); loadVoucher(dialogVoucher); setTab('entry'); }}>
                  <Eye className="h-4 w-4 mr-1.5" /> Edit in Form
                </Button>
              </div>
            )}

            {/* Transactions Table */}
            <div className="overflow-y-auto flex-1 bg-slate-50 sm:bg-white">
              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {dialogTransactions.map((t, idx) => {
                  const lineVat = t.vatAmount ?? ((t.amount * (t.vatRate ?? vatRate)) / 100);
                  return (
                    <div key={t.id || `t-${idx}`} className="p-4 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line {idx + 1}</span>
                        <span className="text-xs font-mono text-slate-500">{t.date ? formatDisplayDate(t.date) : '—'}</span>
                      </div>
                      <div className="mb-3">
                        <p className="text-sm font-medium text-slate-800 break-words">{t.description || <span className="text-slate-300 italic">No description</span>}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{t.category}</span>
                          {t.client && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{t.client}</span>}
                          {t.site && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{t.site}</span>}
                          {t.isVatable && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200/60">
                              VAT: ₦{lineVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500 truncate max-w-[120px]">{t.vendor || '—'}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 tabular-nums">₦{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {priv?.canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 shrink-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const isLast = dialogTransactions.length === 1;
                                const ok = await showConfirm(
                                  isLast
                                    ? `This is the only transaction in voucher ${dialogVoucher}. Deleting it will remove the entire voucher. Continue?`
                                    : 'Delete this transaction line from the voucher?',
                                  { variant: 'danger', confirmLabel: 'Delete Line' }
                                );
                                if (ok) {
                                  deleteLedgerEntry(t.id);
                                  toast.success('Transaction line removed.');
                                  if (isLast) setDialogVoucher(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View */}
              <table className="hidden md:table w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold text-slate-600 w-8">#</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Date</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600">Description</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-32">Category</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Client</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Site</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 w-28">Amount</th>
                    <th className="py-2.5 px-3 text-center font-semibold text-slate-600 w-20">Vatable</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 w-28">VAT</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Vendor</th>
                    {priv?.canDelete && <th className="py-2.5 px-3 text-center font-semibold text-slate-600 w-16">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {dialogTransactions.map((t, idx) => {
                    const lineVat = t.vatAmount ?? ((t.amount * (t.vatRate ?? vatRate)) / 100);
                    return (
                      <tr key={t.id || `t-${idx}`} className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="py-2.5 px-4 text-slate-400 text-xs font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs font-mono whitespace-nowrap">
                          {t.date ? formatDisplayDate(t.date) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{t.description || <span className="text-slate-300 italic">—</span>}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{t.category}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{t.client || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs">{t.site || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                          ₦{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {t.isVatable || (t.vatMode && t.vatMode !== 'No') ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                              {t.vatMode || 'Yes'}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 tabular-nums bg-emerald-50/40">
                          {t.isVatable ? (
                            `₦${lineVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-xs">{t.vendor || '—'}</td>
                        {priv?.canDelete && (
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const isLast = dialogTransactions.length === 1;
                                const ok = await showConfirm(
                                  isLast
                                    ? `This is the only transaction in voucher ${dialogVoucher}. Deleting it will remove the entire voucher. Continue?`
                                    : 'Delete this transaction line from the voucher?',
                                  { variant: 'danger', confirmLabel: 'Delete Line' }
                                );
                                if (ok) {
                                  deleteLedgerEntry(t.id);
                                  toast.success('Transaction line removed.');
                                  if (isLast) setDialogVoucher(null);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Grand total row */}
                  <tr key="voucher-total-row" className="bg-indigo-50/70 border-t-2 border-indigo-200">
                    <td colSpan={6} className="py-3 px-4 text-right font-bold text-slate-700">Totals</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                      ₦{dialogNetTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-2 text-center text-xs font-bold text-slate-400">VAT</td>
                    <td className="py-3 px-3 text-right font-extrabold text-emerald-700 tabular-nums bg-emerald-50">
                      ₦{dialogVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={priv?.canDelete ? 2 : 1} className="py-3 px-3 text-right font-extrabold text-indigo-900 tabular-nums bg-indigo-100/50">
                      Gross: ₦{dialogGrossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              {dialogTransactions.length === 0 && (
                <div className="py-12 text-center text-slate-400 italic">No transactions found for this voucher.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Policy Modal ──────────────────────────────────────────────── */}
      {importFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md mx-4 border border-slate-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Import Policy</h3>
                <p className="text-xs text-slate-500">How should existing duplicate entries be handled?</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              File: <span className="font-semibold text-slate-800">{importFile.name}</span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => processImport(importFile, 'append')}
                className="w-full text-left px-4 py-3.5 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all group"
              >
                <span className="font-semibold text-slate-800 block text-sm group-hover:text-indigo-700">
                  Append Only
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Adds new entries only. Skips rows that already exist (matched by voucher, category, amount &amp; description).
                </span>
              </button>
              <button
                onClick={() => processImport(importFile, 'overwrite')}
                className="w-full text-left px-4 py-3.5 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50/40 transition-all group"
              >
                <span className="font-semibold text-amber-700 block text-sm">
                  Overwrite Duplicates
                </span>
                <span className="text-xs text-amber-600/80 mt-0.5 block">
                  Replaces matching existing entries with data from the file. Adds entries that don't exist yet.
                </span>
              </button>
              <button
                onClick={() => setImportFile(null)}
                className="w-full text-center py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <TabsContent active={tab === 'records'} className="m-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {voucherSummaries.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-600 font-bold text-lg">No Voucher Records</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">Voucher records will appear here once you submit entries in the Entry tab.</p>
            </div>
          ) : (
            voucherSummaries.map((v) => (
              <Card 
                key={v.voucherNo} 
                className="group hover:border-indigo-400 transition-all cursor-pointer hover:shadow-lg overflow-hidden border-slate-200 relative bg-white"
                onClick={() => setDialogVoucher(v.voucherNo)}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voucher No</p>
                      <h4 className="text-lg font-black text-slate-900 font-mono tracking-tight group-hover:text-indigo-600 transition-colors">{v.voucherNo}</h4>
                    </div>
                    <div className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-600 font-bold text-[10px] uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      {v.count} Line{v.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                      <p className="text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100">{normalizeDate(v.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                      <p className="text-xs font-bold text-slate-700 truncate">{v.bank || 'Unspecified'}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                      <p className="text-xl font-black text-indigo-700 font-mono">₦{v.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </TabsContent>

      {/* ── Vendor Management Dialog ─────────────────────────────────────── */}
      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
          <DialogHeader className="p-6 pb-5 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100/50 rounded-xl">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black tracking-tight text-slate-800">Vendor Directory</DialogTitle>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">Manage global vendors for ledger entries</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddVendorForm(!showAddVendorForm)}
                className={`hidden sm:flex gap-2 h-9 border-slate-200 font-bold text-[10px] uppercase tracking-wider transition-all ${showAddVendorForm ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Plus className={`h-3.5 w-3.5 transition-transform duration-300 ${showAddVendorForm ? 'rotate-45' : ''}`} />
                {showAddVendorForm ? 'Close Form' : 'Add New Vendor'}
              </Button>
              {/* Mobile version of the toggle button */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setShowAddVendorForm(!showAddVendorForm)}
                className={`sm:hidden h-9 w-9 border-slate-200 transition-all ${showAddVendorForm ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500'}`}
              >
                <Plus className={`h-4 w-4 transition-transform duration-300 ${showAddVendorForm ? 'rotate-45' : ''}`} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
            {/* Add New Vendor Form (integrated with header toggle) */}
            {showAddVendorForm && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="h-3 w-3 text-indigo-500" /> Add New Vendor
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.5fr_auto] gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500">Vendor Name</label>
                    <Input 
                      placeholder="e.g. Amorsil..." 
                      value={quickVendor}
                      onChange={e => setQuickVendor(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddVendor()}
                      className="h-9 text-xs shadow-sm border-slate-200 focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500">TIN Number <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <Input 
                      placeholder="Enter TIN..." 
                      value={quickTin}
                      onChange={e => setQuickTin(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddVendor()}
                      className="h-9 text-xs shadow-sm border-slate-200 focus:border-indigo-500 font-mono transition-colors"
                    />
                  </div>
                  <Button onClick={handleAddVendor} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 px-6 w-full sm:w-auto">
                    Add Vendor
                  </Button>
                </div>
              </div>
            )}

            {/* Vendor List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Vendors ({ledgerVendors.length})</h4>
              </div>
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 h-10 px-4">Vendor Name</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 h-10 px-4">TIN Number</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 h-10 text-right px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-slate-400 text-xs italic">No vendors registered yet.</TableCell>
                      </TableRow>
                    ) : (
                      sortedVendors.map(v => (
                        <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                          <TableCell className="py-2 px-4">
                            {editingVendorId === v.id ? (
                              <Input 
                                value={vendorRenameValue} 
                                onChange={e => setVendorRenameValue(e.target.value)}
                                className="h-8 text-xs font-semibold focus:ring-indigo-500/20"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameVendor(v.id);
                                  if (e.key === 'Escape') setEditingVendorId(null);
                                }}
                              />
                            ) : (
                              <span className="font-semibold text-slate-700 text-sm">{v.name}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-4">
                            {editingVendorId === v.id ? (
                              <Input 
                                value={tinRenameValue} 
                                onChange={e => setTinRenameValue(e.target.value)}
                                className="h-8 text-xs font-mono focus:ring-indigo-500/20"
                                placeholder="TIN..."
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameVendor(v.id);
                                  if (e.key === 'Escape') setEditingVendorId(null);
                                }}
                              />
                            ) : (
                              <span className="text-xs font-mono text-slate-500">{v.tinNumber || '—'}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-4 text-right">
                            {editingVendorId === v.id ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => handleRenameVendor(v.id)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3">Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingVendorId(null)} className="h-8 text-slate-400 hover:text-slate-600">Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => {
                                    setEditingVendorId(v.id);
                                    setVendorRenameValue(v.name);
                                    setTinRenameValue(v.tinNumber || '');
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  onClick={() => handleRemoveVendor(v.id, v.name)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end">
            <DialogClose className="w-auto h-10 px-6 bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200 font-semibold border-none rounded-lg transition-colors">
              Close Directory
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Management Dialog ─────────────────────────────────────── */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
          <DialogHeader className="p-6 pb-5 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100/50 rounded-xl">
                  <LayoutGrid className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black tracking-tight text-slate-800">Category Directory</DialogTitle>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">Manage categories for ledger entries</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
                className={`hidden sm:flex gap-2 h-9 border-slate-200 font-bold text-[10px] uppercase tracking-wider transition-all ${showAddCategoryForm ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Plus className={`h-3.5 w-3.5 transition-transform duration-300 ${showAddCategoryForm ? 'rotate-45' : ''}`} />
                {showAddCategoryForm ? 'Close Form' : 'Add New Category'}
              </Button>
              {/* Mobile version of the toggle button */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
                className={`sm:hidden h-9 w-9 border-slate-200 transition-all ${showAddCategoryForm ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500'}`}
              >
                <Plus className={`h-4 w-4 transition-transform duration-300 ${showAddCategoryForm ? 'rotate-45' : ''}`} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
            {/* Add New Category Form (integrated with header toggle) */}
            {showAddCategoryForm && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="h-3 w-3 text-indigo-500" /> Add New Category
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500">Category Name</label>
                    <Input 
                      placeholder="e.g. Fuel, Transport..." 
                      value={quickCategory}
                      onChange={e => setQuickCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                      className="h-9 text-xs shadow-sm border-slate-200 focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <Button onClick={handleAddCategory} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 px-6 w-full sm:w-auto">
                    Add Category
                  </Button>
                </div>
              </div>
            )}

            {/* Category List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Categories ({ledgerCategories.length})</h4>
              </div>
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 h-10 px-4">Category Name</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 h-10 text-right px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center text-slate-400 text-xs italic">No categories registered yet.</TableCell>
                      </TableRow>
                    ) : (
                      sortedCategories.map(c => (
                        <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          <TableCell className="py-2 px-4">
                            {editingCategoryId === c.id ? (
                              <Input 
                                value={categoryRenameValue} 
                                onChange={e => setCategoryRenameValue(e.target.value)}
                                className="h-8 text-xs font-semibold focus:ring-indigo-500/20"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameCategory(c.id);
                                  if (e.key === 'Escape') setEditingCategoryId(null);
                                }}
                              />
                            ) : (
                              <span className="font-semibold text-slate-700 text-sm">{c.name}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-4 text-right">
                            {editingCategoryId === c.id ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => handleRenameCategory(c.id)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3">Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)} className="h-8 text-slate-400 hover:text-slate-600">Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => {
                                    setEditingCategoryId(c.id);
                                    setCategoryRenameValue(c.name);
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  onClick={() => handleRemoveCategory(c.id, c.name)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end">
            <DialogClose className="w-auto h-10 px-6 bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200 font-semibold border-none rounded-lg transition-colors">
              Close Directory
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Global File Input */}
      {priv?.canAdd && <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportSelected} />}
    </div>
  );
}

