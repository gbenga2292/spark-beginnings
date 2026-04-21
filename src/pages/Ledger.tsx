import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { TabsContent } from '@/src/components/ui/tabs';
import { Search, Download, Upload, FileText, ChevronLeft, ChevronRight, X, Eye, BookOpen, RotateCcw, Trash2, LayoutGrid, BarChart2, CheckCircle2, History, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/src/components/ui/dropdown-menu';
import { useAppStore, LedgerEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';

type EntryItem = {
  id?: string;
  transactionDate: string;
  description: string;
  category: string;
  amount: string;
  client: string;
  site: string;
  vendor: string;
};

const getEmptyItem = (): EntryItem => ({
  transactionDate: '', description: '', category: '', amount: '', client: 'none', site: 'none', vendor: 'none'
});

export function Ledger() {
  const priv = usePriv('ledger');
  const currentUser = useUserStore((s) => s.getCurrentUser());

  const ledgerEntries = useAppStore((state) => state.ledgerEntries);
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
  const addLedgerBank = useAppStore((state) => state.addLedgerBank);
  const addLedgerVendor = useAppStore((state) => state.addLedgerVendor);

  const [tab, setTab] = useState('entry');

  // VOUCHER FORM STATE
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeVoucherNo, setActiveVoucherNo] = useState<string>('');
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
    // Parse the date out of the voucher or use the first record's transaction date ideally
    const match = vNo.match(/^VN(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
      setVoucherDate(`20${match[1]}-${match[2]}-${match[3]}`);
    }
    setPaidFrom(records[0].bank || '');
    
    const loadedItems: EntryItem[] = Array(8).fill(null).map(() => getEmptyItem());
    records.forEach((r, idx) => {
      if (idx < 8) {
        loadedItems[idx] = {
          id: r.id,
          transactionDate: r.date,
          description: r.description,
          category: r.category,
          amount: String(r.amount),
          client: r.client || 'none',
          site: r.site || 'none',
          vendor: r.vendor || 'none',
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
    if (activeVoucherNo) {
      toast.info('Form cleared for a new voucher based on the selected date.');
      handleClear();
    }
    setVoucherDate(newDate);
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
    
    if (activeVoucherNo && existingRecords.length > 0) {
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
      
      const payload: LedgerEntry = {
        id: item.id || generateId(),
        voucherNo: targetVoucherNo,
        date: entryDate,
        description: item.description,
        category: item.category,
        amount: Number(item.amount),
        client: item.client === 'none' || !item.client ? '' : item.client,
        site: item.site === 'none' || !item.site ? '' : item.site,
        vendor: item.vendor === 'none' || !item.vendor ? '' : item.vendor,
        bank: paidFrom,
        enteredBy: currentUser?.name || 'Unknown',
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

    // Purge rows that were cleared from an existing voucher
    existingRecords.forEach(r => {
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

  const setItemField = (idx: number, field: keyof EntryItem, val: string) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setItems(newItems);
  };

  const formTotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [items]);

  // Dialog state: which voucher's transactions to show
  const [dialogVoucher, setDialogVoucher] = useState<string | null>(null);
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


  // Group filtered entries by voucher number (one row per voucher in the records view)
  const voucherSummaries = useMemo(() => {
    const map = new Map<string, { voucherNo: string; date: string; bank: string; total: number; count: number }>();
    filteredEntries.forEach(e => {
      const key = e.voucherNo || '';
      if (!map.has(key)) {
        map.set(key, { voucherNo: e.voucherNo || '', date: e.date || '', bank: e.bank || '', total: 0, count: 0 });
      }
      const v = map.get(key)!;
      // Coerce amount to number — DB may return it as a string
      v.total += Number(e.amount) || 0;
      v.count += 1;
      // Use earliest date for display
      if (e.date && (!v.date || e.date < v.date)) v.date = e.date;
    });
    return Array.from(map.values()).sort((a, b) => b.voucherNo.localeCompare(a.voucherNo));
  }, [filteredEntries]);

  // Transactions for the dialog (all lines — no cap)
  const dialogTransactions = useMemo(() =>
    dialogVoucher ? ledgerEntries.filter(e => e.voucherNo === dialogVoucher) : [],
    [dialogVoucher, ledgerEntries]
  );


  useSetPageTitle(
    tab === 'entry' ? 'Company Ledger' : 'Voucher Records',
    tab === 'entry'
      ? 'Record vouchers, manage expenses, and track financial outflows across banks and sites'
      : `Click any voucher to view its transactions. Showing ${voucherSummaries.length} voucher${voucherSummaries.length !== 1 ? 's' : ''}.`,
    <div className="flex items-center gap-2">
      {/* Tab Toggle */}
      <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shadow-sm backdrop-blur-sm">
         <button 
           onClick={() => setTab('entry')} 
           className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${
             tab === 'entry' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
           }`}
         >
           <FileText className="h-3 w-3" /> Entry
         </button>
         <button 
           onClick={() => setTab('records')} 
           className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all duration-200 flex items-center gap-1.5 ${
             tab === 'records' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
           }`}
         >
           <History className="h-3 w-3" /> History
         </button>
      </div>

      <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

      {tab === 'entry' ? (
        <div className="flex items-center gap-2">
          {activeVoucherNo && priv.canDelete && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-rose-100" 
              onClick={handleDeleteVoucher}
              title="Delete Voucher"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100 border border-slate-200" 
            onClick={handleReload}
            title="Reload Voucher"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className={`h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight ${hasUnsavedPending ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-50'}`} 
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button 
            size="sm" 
            className="h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95" 
            onClick={handleSubmit} 
            disabled={!priv.canAdd}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Submit Voucher
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
           {priv.canAdd && (
             <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight hover:bg-slate-50 shadow-sm">
               <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
             </Button>
           )}
           {priv.canExport && (
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight hover:bg-slate-50 shadow-sm">
                   <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export <ChevronDown className="h-3 w-3 text-slate-400" />
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
        </div>
      )}
    </div>,
    [tab, priv, hasUnsavedPending, activeVoucherNo, ledgerEntries, voucherDate, paidFrom, items, currentUser, voucherSummaries.length]
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
          <div className="bg-slate-50/80 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-200/60 backdrop-blur-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voucher No.</label>
              <div className="flex rounded-md shadow-sm">
                <Input readOnly value={activeVoucherNo || generatedVoucherNo} className="bg-white h-9 font-mono text-indigo-700 font-bold tracking-wide border-r-0 rounded-r-none border-slate-300 pointer-events-none" />
                <button onClick={handlePrevVoucher} className="h-9 w-9 shrink-0 bg-slate-50 border border-slate-300 border-l-0 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={handleNextVoucher} className="h-9 w-9 shrink-0 bg-slate-50 border border-slate-300 border-l-0 rounded-r-md text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <ChevronRight className="h-4 w-4" />
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
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-slate-800 w-10 text-[10px] uppercase tracking-widest opacity-70">NÂº</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-[140px] text-[10px] uppercase tracking-widest opacity-70">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-1/4 text-[10px] uppercase tracking-widest opacity-70">Description</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-48 text-[10px] uppercase tracking-widest opacity-70">Category</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-32 text-[10px] uppercase tracking-widest opacity-70">Amount</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-40 text-[10px] uppercase tracking-widest opacity-70">Client</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-40 text-[10px] uppercase tracking-widest opacity-70">Site</th>
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
                        <option value="" disabled></option>
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
                    Total
                  </td>
                  <td className="py-3 px-3 font-bold text-indigo-700 border border-slate-200 bg-indigo-50/50">
                    ₦{formTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3} className="bg-white border border-slate-200 text-slate-300 px-4 text-xs italic">
                    All amounts aggregated per voucher automatically.
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

      <TabsContent active={tab === 'records'} className="m-0 space-y-4">
        <Card>
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-end gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    className="h-9 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 font-medium" 
                    value={dateFilterType} 
                    onChange={e => setDateFilterType(e.target.value as any)}
                  >
                    <option value="transaction">Trans Date</option>
                    <option value="voucher">Voucher Date</option>
                  </select>
                  <Input type="date" className="h-9 w-32 text-xs" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span className="text-slate-400 text-xs px-1">to</span>
                  <Input type="date" className="h-9 w-32 text-xs" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    className="h-9 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 font-medium max-w-[120px]" 
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
                  <div className="relative w-full md:w-52">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search..." className="pl-8 h-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  {search.trim() && (
                    <button
                      onClick={() => setSearch('')}
                      className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {/* Search mode indicator */}
              {search.trim() && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                    <Search className="h-3 w-3" />
                    {filteredEntries.length} line{filteredEntries.length !== 1 ? 's' : ''} found
                  </span>
                  <span className="text-xs text-slate-400">— Showing individual entry lines for your search</span>
                </div>
              )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* ── FLAT SEARCH VIEW (active when search query is present) ── */}
              {search.trim() ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Voucher No.</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Date</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Category</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Client</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Site</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Bank</th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Amount</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Vendor</th>
                      <th className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 italic text-sm">
                          No entries match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, idx) => (
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
              ) : (
                /* ── GROUPED VOUCHER VIEW (default when no search) ── */
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-44">Voucher No.</TableHead>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead className="text-right w-40">Amount</TableHead>
                      <TableHead className="w-16 text-center">Lines</TableHead>
                      <TableHead className="w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voucherSummaries.map((v, i) => (
                      <TableRow
                        key={v.voucherNo || `v-${i}`}
                        className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                        onClick={() => setDialogVoucher(v.voucherNo)}
                      >
                        <TableCell className="font-mono font-bold text-indigo-600">
                          {v.voucherNo || '—'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                          {v.date ? formatDisplayDate(v.date) : '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">{v.bank || '—'}</TableCell>
                        <TableCell className="font-bold text-slate-900 text-right tabular-nums">
                          ₦{(isNaN(v.total) ? 0 : v.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                            {v.count}
                          </span>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 gap-1 h-8 px-2"
                              onClick={() => setDialogVoucher(v.voucherNo)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {priv?.canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0"
                                title="Delete Voucher"
                                onClick={async () => {
                                  const vno = v.voucherNo;
                                  const count = ledgerEntries.filter(e => e.voucherNo === vno).length;
                                  const ok = await showConfirm(
                                    `Delete voucher ${vno}?\n\nThis will permanently remove all ${count} transaction(s) in this voucher.`,
                                    { variant: 'danger', confirmLabel: 'Yes, Delete' }
                                  );
                                  if (ok) {
                                    ledgerEntries.filter(e => e.voucherNo === vno).forEach(r => deleteLedgerEntry(r.id));
                                    toast.success(`Deleted voucher ${vno}.`);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {voucherSummaries.length === 0 && (
                      <TableRow key="no-results">
                        <TableCell colSpan={6} className="text-center py-12 text-slate-500 bg-slate-50/30">
                          No vouchers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Voucher Dialog Popup */}
      {dialogVoucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDialogVoucher(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">Voucher Transactions</p>
                <h2 className="text-white font-bold text-xl tracking-wide font-mono">{dialogVoucher}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-indigo-200 text-xs">Total Amount</p>
                  <p className="text-white font-bold text-lg">
                    ₦{dialogTransactions.reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
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
              <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 border-b border-slate-100 text-sm shrink-0">
                <span className="text-slate-500">Bank: <strong className="text-slate-700">{dialogTransactions[0].bank}</strong></span>
                <span className="text-slate-500">Entered by: <strong className="text-slate-700">{dialogTransactions[0].enteredBy}</strong></span>
                <span className="text-slate-500">{dialogTransactions.length} transaction{dialogTransactions.length !== 1 ? 's' : ''}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setDialogVoucher(null); loadVoucher(dialogVoucher); setTab('entry'); }}>
                  <Eye className="h-4 w-4 mr-1.5" /> Edit in Form
                </Button>
              </div>
            )}

            {/* Transactions Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold text-slate-600 w-8">#</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Date</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600">Description</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-32">Category</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Client</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Site</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 w-32">Amount</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 w-28">Vendor</th>
                    {priv?.canDelete && <th className="py-2.5 px-3 text-center font-semibold text-slate-600 w-16">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {dialogTransactions.map((t, idx) => (
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
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                        ₦{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  ))}
                  {/* Grand total row */}
                  <tr key="voucher-total-row" className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td colSpan={6} className="py-3 px-4 text-right font-bold text-slate-700">Total</td>
                    <td className="py-3 px-3 text-right font-extrabold text-indigo-700 tabular-nums">
                      ₦{dialogTransactions.reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {priv?.canDelete && <td />}
                    <td />
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

      {/* Hidden Global File Input */}
      {priv?.canAdd && <input type="file" ref={fileInputRef} accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportSelected} />}
    </div>
  );
}

