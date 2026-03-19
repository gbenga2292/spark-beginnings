import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { TabsContent } from '@/src/components/ui/tabs';
import { Search, Download, FileText, ChevronLeft, ChevronRight, X, Eye, BookOpen } from 'lucide-react';
import { useAppStore, LedgerEntry } from '@/src/store/appStore';
import { useUserStore } from '@/src/store/userStore';
import { usePriv } from '@/src/hooks/usePriv';
import * as XLSX from 'xlsx';
import { toast, showConfirm } from '@/src/components/ui/toast';

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
  const clients = useAppStore((state) => state.clients);
  const sites = useAppStore((state) => state.sites);

  const addLedgerEntry = useAppStore((state) => state.addLedgerEntry);
  const updateLedgerEntry = useAppStore((state) => state.updateLedgerEntry);
  const deleteLedgerEntry = useAppStore((state) => state.deleteLedgerEntry);

  const [tab, setTab] = useState('entry');

  // VOUCHER FORM STATE
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeVoucherNo, setActiveVoucherNo] = useState<string>('');
  const [paidFrom, setPaidFrom] = useState('');
  const [items, setItems] = useState<EntryItem[]>(Array(8).fill(null).map(() => getEmptyItem()));

  // For navigating vouchers
  const distinctVouchers = useMemo(() => {
    const vSet = new Set(ledgerEntries.map(e => e.voucherNo));
    return Array.from(vSet).sort();
  }, [ledgerEntries]);

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
      if (e.voucherNo.startsWith(prefix)) {
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
  };

  // Navigate forward through vouchers: 01 â†’ 02 â†’ 03 ...
  const handleNextVoucher = () => {
    if (distinctVouchers.length === 0) return;
    if (!activeVoucherNo) {
      // No voucher loaded â€” start from the first one
      loadVoucher(distinctVouchers[0]);
      return;
    }
    const idx = distinctVouchers.indexOf(activeVoucherNo);
    if (idx >= 0 && idx < distinctVouchers.length - 1) {
      loadVoucher(distinctVouchers[idx + 1]);
    }
    // Already at the last voucher â€” stay put
  };

  // Navigate backward through vouchers: 03 â†’ 02 â†’ 01 ...
  const handlePrevVoucher = () => {
    if (distinctVouchers.length === 0) return;
    if (!activeVoucherNo) {
      // No voucher loaded â€” start from the last one
      loadVoucher(distinctVouchers[distinctVouchers.length - 1]);
      return;
    }
    const idx = distinctVouchers.indexOf(activeVoucherNo);
    if (idx > 0) {
      loadVoucher(distinctVouchers[idx - 1]);
    }
    // Already at the first voucher â€” stay put
  };

  const handleClear = () => {
    setActiveVoucherNo('');
    setItems(Array(8).fill(null).map(() => getEmptyItem()));
    setPaidFrom('');
  };

  const handleReload = () => {
    const vno = activeVoucherNo || generatedVoucherNo;
    if (vno && ledgerEntries.some(e => e.voucherNo === vno)) {
      loadVoucher(vno);
      toast.success(`Reloaded voucher ${vno}.`);
    } else {
      handleClear();
      toast.info('No saved voucher to reload â€” form cleared.');
    }
  };

  const handleSubmit = () => {
    if (!voucherDate || !paidFrom) {
      toast.error('Voucher Date and Paid From (Bank) are required.');
      return;
    }

    const targetVoucherNo = activeVoucherNo || generatedVoucherNo;
    const existingRecords = ledgerEntries.filter(e => e.voucherNo === targetVoucherNo);
    
    // Track which records are actively updated/created
    const keptIds = new Set<string>();

    let savedCount = 0;

    items.forEach((item) => {
      if (!item.amount || !item.category) return; // Skip empty rows
      
      const entryDate = item.transactionDate && item.transactionDate.trim() !== ''
        ? item.transactionDate
        : voucherDate || new Date().toISOString().split('T')[0];
      
      const payload: LedgerEntry = {
        id: item.id || crypto.randomUUID(),
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

    toast.success(`Saved voucher ${targetVoucherNo}.`);
    // After submit, lock into viewing this voucher
    loadVoucher(targetVoucherNo);
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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter(e => {
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.voucherNo.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.client.toLowerCase().includes(q) ||
          e.vendor.toLowerCase().includes(q) ||
          e.bank.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledgerEntries, search, fromDate, toDate]);

  const handleExport = () => {
    if (!priv?.canExport) return;
    const data = filteredEntries.map(e => ({
      'Voucher No': e.voucherNo, 'Date': e.date, 'Description': e.description, 'Category': e.category,
      'Amount': e.amount, 'Client': e.client, 'Site': e.site, 'Vendor': e.vendor, 'Bank': e.bank, 'Entered By': e.enteredBy,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Entries');
    XLSX.writeFile(workbook, 'Ledger_Entries.xlsx');
  };

  // Summaries (kept for the hidden summary tab)
  const catSummary = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredEntries.forEach(e => { acc[e.category] = (acc[e.category] || 0) + e.amount; });
    return Object.entries(acc).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
  }, [filteredEntries]);
  const bankSummary = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredEntries.forEach(e => { acc[e.bank] = (acc[e.bank] || 0) + e.amount; });
    return Object.entries(acc).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
  }, [filteredEntries]);
  const clientSummary = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredEntries.forEach(e => { if(e.client) acc[e.client] = (acc[e.client] || 0) + e.amount; });
    return Object.entries(acc).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
  }, [filteredEntries]);
  const siteSummary = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredEntries.forEach(e => { if(e.site) acc[e.site] = (acc[e.site] || 0) + e.amount; });
    return Object.entries(acc).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);
  }, [filteredEntries]);

  // Group filtered entries by voucher number (one row per voucher in the records view)
  const voucherSummaries = useMemo(() => {
    const map = new Map<string, { voucherNo: string; date: string; bank: string; total: number; count: number }>();
    filteredEntries.forEach(e => {
      if (!map.has(e.voucherNo)) {
        map.set(e.voucherNo, { voucherNo: e.voucherNo, date: e.date, bank: e.bank, total: 0, count: 0 });
      }
      const v = map.get(e.voucherNo)!;
      v.total += e.amount;
      v.count += 1;
      // Use earliest date for display
      if (e.date < v.date) v.date = e.date;
    });
    return Array.from(map.values()).sort((a, b) => b.voucherNo.localeCompare(a.voucherNo));
  }, [filteredEntries]);

  // Transactions for the dialog
  const dialogTransactions = useMemo(() =>
    dialogVoucher ? ledgerEntries.filter(e => e.voucherNo === dialogVoucher).slice(0, 8) : [],
    [dialogVoucher, ledgerEntries]
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

  const tdClass = "p-1.5 border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-indigo-50/20";
  const inputClass = "w-full h-8 px-2 text-sm bg-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  return (
    <div className="space-y-6">
      {/* Header with simple button-based tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ledger</h1>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setTab('entry')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'entry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Voucher Entry
          </button>
          <button
            onClick={() => setTab('records')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Expense Record
          </button>
        </div>
      </div>

      <TabsContent active={tab === 'entry'} className="m-0">
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          {/* Header Bar */}
          <div className="bg-indigo-700 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-white font-bold text-lg tracking-wider flex items-center gap-2">
              <FileText className="h-5 w-5 opacity-80" />
              LEDGER ENTRY SYSTEM
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" className="font-semibold bg-white text-indigo-700 hover:bg-slate-100 shadow-sm" onClick={handleSubmit} disabled={!priv.canAdd}>SUBMIT</Button>
              <Button size="sm" variant="secondary" className="font-semibold bg-indigo-600/50 text-white hover:bg-indigo-600 border-indigo-500 shadow-none" onClick={handleReload}>RELOAD</Button>
              <Button size="sm" variant="secondary" className="font-semibold bg-indigo-600/50 text-white hover:bg-indigo-600 border-indigo-500 shadow-none" onClick={handleClear}>CLEAR</Button>
              <Button size="sm" variant="secondary" className="font-semibold bg-indigo-600/50 text-white hover:bg-indigo-600 border-indigo-500 shadow-none" onClick={() => setTab('records')}>SEARCH</Button>
              <Button size="sm" variant="destructive" className="font-semibold shadow-sm" onClick={handleDeleteVoucher} disabled={!priv.canDelete || !activeVoucherNo}>DELETE</Button>
            </div>
          </div>

          {/* Form Header */}
          <div className="bg-slate-100 p-6 flex flex-col md:flex-row gap-8 border-b border-slate-200">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest w-32 shrink-0">Voucher No.</label>
                <div className="flex items-center gap-2 max-w-sm w-full">
                  <Input readOnly value={activeVoucherNo || generatedVoucherNo} className="bg-white font-mono text-indigo-700 font-bold tracking-wide shadow-inner border-slate-300" />
                  <div className="flex shadow-sm rounded-md overflow-hidden shrink-0">
                    <button onClick={handlePrevVoucher} className="h-10 w-10 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button onClick={handleNextVoucher} className="h-10 w-10 bg-white border border-slate-300 border-l-0 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest w-32 shrink-0">Paid From</label>
                <div className="max-w-sm w-full">
                  <select className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm shadow-inner" value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
                    <option value="" disabled>Select Bank...</option>
                    {ledgerBanks.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest w-32 shrink-0">Voucher Date</label>
                <div className="max-w-[200px] w-full">
                  <Input type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} className="bg-white shadow-inner border-slate-300 font-medium text-slate-700" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest w-32 shrink-0">Entered By</label>
                <div className="max-w-sm w-full">
                  <Input readOnly value={currentUser?.name || ''} className="bg-slate-200/50 text-slate-500 font-medium border-slate-300 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto select-none">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-indigo-600 text-white font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-indigo-500 w-10">S/N</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-[140px]">Transaction Date</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-1/4">Description</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-48">Category</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-32">Amount</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-40">Client</th>
                  <th className="py-2.5 px-3 border-r border-indigo-500 w-40">Site</th>
                  <th className="py-2.5 px-3">Vendor</th>
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
                      <div className="flex items-center w-full">
                        <input
                          type="text"
                          className={inputClass + ' flex-1 min-w-0'}
                          value={item.description}
                          onChange={e => setItemField(idx, 'description', e.target.value)}
                          placeholder="Description..."
                        />
                        {/* Book icon â€” click to open callout dialog */}
                        <button
                          type="button"
                          onClick={() => setDescDialog({ idx, value: item.description })}
                          className="shrink-0 px-1.5 text-slate-300 hover:text-indigo-500 transition-colors"
                          title="View full description"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <select className={inputClass} value={item.category} onChange={e => setItemField(idx, 'category', e.target.value)}>
                        <option value="" disabled></option>
                        {ledgerCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center px-2 relative group-focus-within:text-indigo-600">
                        <span className="text-slate-400 absolute left-2 text-xs">â‚¦</span>
                        <input type="number" min="0" step="0.01" className={`w-full h-8 pl-4 pr-1 text-sm bg-transparent outline-none font-medium`} value={item.amount} onChange={e => setItemField(idx, 'amount', e.target.value)} />
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
                          .map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                        }
                      </select>
                    </td>
                    <td className={tdClass}>
                      <select className={inputClass} value={item.vendor} onChange={e => setItemField(idx, 'vendor', e.target.value)}>
                        <option value="none"></option>
                        {ledgerVendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="text-right py-3 px-4 font-bold text-slate-700 bg-white border border-slate-200">
                    Total
                  </td>
                  <td className="py-3 px-3 font-bold text-indigo-700 border border-slate-200 bg-indigo-50/50">
                    â‚¦{formTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

      {/* â”€â”€ Description Callout Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                  Row {descDialog.idx + 1} â€” Description
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Voucher Records</CardTitle>
                <CardDescription>
                  Click any voucher to view its transactions. Showing {voucherSummaries.length} voucher{voucherSummaries.length !== 1 ? 's' : ''}.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">From</span>
                  <Input type="date" className="h-9 w-36" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span className="text-sm text-slate-500">To</span>
                  <Input type="date" className="h-9 w-36" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search voucher, category..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {priv.canExport && (
                  <Button variant="outline" onClick={handleExport} className="h-9">
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-44">Voucher No.</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right w-40">Amount</TableHead>
                    <TableHead className="w-16 text-center">Lines</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucherSummaries.map((v) => (
                    <TableRow
                      key={v.voucherNo}
                      className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                      onClick={() => setDialogVoucher(v.voucherNo)}
                    >
                      <TableCell className="font-mono font-bold text-indigo-600">
                        {v.voucherNo}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        {v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'â€”'}
                      </TableCell>
                      <TableCell className="text-slate-600">{v.bank}</TableCell>
                      <TableCell className="font-bold text-slate-900 text-right tabular-nums">
                        â‚¦{v.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                          {v.count}
                        </span>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 gap-1"
                          onClick={() => setDialogVoucher(v.voucherNo)}
                        >
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {voucherSummaries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500 bg-slate-50/30">
                        No vouchers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
                    â‚¦{dialogTransactions.reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                <span className="text-slate-500">{dialogTransactions.length} transaction{dialogTransactions.length !== 1 ? 's' : ''} (max 8)</span>
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
                  </tr>
                </thead>
                <tbody>
                  {dialogTransactions.map((t, idx) => (
                    <tr key={t.id} className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="py-2.5 px-4 text-slate-400 text-xs font-semibold">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs font-mono whitespace-nowrap">
                        {t.date ? new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'â€”'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{t.description || <span className="text-slate-300 italic">â€”</span>}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{t.category}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{t.client || 'â€”'}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{t.site || 'â€”'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                        â‚¦{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs">{t.vendor || 'â€”'}</td>
                    </tr>
                  ))}
                  {/* Grand total row */}
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td colSpan={6} className="py-3 px-4 text-right font-bold text-slate-700">Total</td>
                    <td className="py-3 px-3 text-right font-extrabold text-indigo-700 tabular-nums">
                      â‚¦{dialogTransactions.reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
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

      {/* Summary tab removed â€” see Financial Reports > Ledger Summary */}
      <TabsContent active={tab === 'summary'} className="m-0 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="bg-slate-50/50"><CardTitle>Expenses by Category</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {catSummary.map(s => (
                    <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right font-semibold text-indigo-700">â‚¦{s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="bg-slate-50/50"><CardTitle>Expenses Paid From</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Bank</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bankSummary.map(s => (
                    <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right font-semibold text-indigo-700">â‚¦{s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="bg-slate-50/50"><CardTitle>Client Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {clientSummary.map(s => (
                    <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right font-semibold text-indigo-700">â‚¦{s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="bg-slate-50/50"><CardTitle>Site Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Site</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {siteSummary.map(s => (
                    <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right font-semibold text-indigo-700">â‚¦{s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>



    </div>
  );
}

