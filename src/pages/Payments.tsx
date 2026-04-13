import { useState, useMemo } from 'react';
import { normalizeDate, formatDisplayDate } from '@/src/lib/dateUtils';
import { useAppStore, Payment } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, Upload, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { generateId } from '@/src/lib/utils';
import { NumericFormat } from 'react-number-format';

const getVatDetails = (amount: number, payVat: string, vatRate: number) => {
    const vat = payVat === 'Add' ? Math.round(((amount * 7.5) / 107.5) * 100) / 100 
              : payVat === 'Yes' ? Math.round(((amount / (100 + vatRate)) * vatRate) * 100) / 100 
              : 0;
    const amountForVat = payVat !== 'No' ? amount - vat : amount;
    return { vat, amountForVat };
};

export function Payments({ setPreviewModal, searchTerm = '' }: { setPreviewModal?: (val: any) => void; searchTerm?: string }) {
    const sites = useAppStore((state) => state.sites);
    const payments = useAppStore((state) => state.payments);
    const clientProfiles = useAppStore((state) => state.clientProfiles);
    const addPayment = useAppStore((state) => state.addPayment);
    const updatePayment = useAppStore((state) => state.updatePayment);
    const deletePayment = useAppStore((state) => state.deletePayment);
    const vatRate = useAppStore((state) => state.payrollVariables.vatRate);

    // ─── Permissions ───────────────────────────────────────────
    const priv = usePriv('payments');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showActions, setShowActions] = useState(false);
    const [sortField, setSortField] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterFromMonth, setFilterFromMonth] = useState<string>('');
    const [filterToMonth, setFilterToMonth] = useState<string>('');

    const initialForm = {
        date: '',
        client: '',
        site: '',
        amount: '',
        withholdingTax: '',
        discount: '',
    };
    const [form, setForm] = useState(initialForm);

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleClear = () => {
        setForm(initialForm);
        setSelectedId(null);
    };

    const livePreview = useMemo(() => {
        const amount = parseFloat(form.amount) || 0;
        const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
        const payVat = siteObj ? siteObj.vat : 'No';

        const { vat, amountForVat } = getVatDetails(amount, payVat, vatRate);

        return { amount, vat, payVat, amountForVat };
    }, [form.amount, form.site, form.client, sites, vatRate]);

    const calculatePayment = (): Omit<Payment, 'id'> | null => {
        if (!form.date || !form.client || !form.site) {
            toast.error('Date, Client, and Site are required.');
            return null;
        }

        const amount = parseFloat(form.amount.replace(/,/g, '')) || 0;
        const withholdingTax = parseFloat(form.withholdingTax.replace(/,/g, '')) || 0;
        const discount = parseFloat(form.discount.replace(/,/g, '')) || 0;
        
        const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
        const payVat = siteObj ? siteObj.vat : 'No';

        return {
            client: form.client,
            site: form.site,
            date: formatDisplayDate(form.date),
            amount,
            withholdingTax,
            discount,
            payVat,
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
        setIsModalOpen(false);
        handleClear();
    };

    const handleEdit = (pay: Payment) => {
        setSelectedId(pay.id);
        setForm({
            date: normalizeDate(pay.date),
            client: pay.client,
            site: pay.site,
            amount: pay.amount.toString(),
            withholdingTax: pay.withholdingTax ? pay.withholdingTax.toString() : '',
            discount: pay.discount ? pay.discount.toString() : '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const ok = await showConfirm('Are you sure you want to delete this payment?', { variant: 'danger' });
        if (ok) {
            deletePayment(id);
            if (selectedId === id) handleClear();
            toast.success('Payment deleted');
        }
    };

    const parseCSVRow = (str: string) => {
        const vals: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '"') {
                inQuotes = !inQuotes;
            } else if (str[i] === ',' && !inQuotes) {
                vals.push(cur.trim());
                cur = '';
            } else {
                cur += str[i];
            }
        }
        vals.push(cur.trim());
        return vals;
    };

    const handleImportCSVSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setImportFile(file);
        e.target.value = '';
    };

    const processImport = (file: File, mode: 'update' | 'replace' | 'append') => {
        setImportFile(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim().length > 0);
                if (lines.length < 2) {
                    toast.error('Invalid or empty CSV file'); return;
                }

                let importedCount = 0;
                let updatedCount = 0;
                let deletedCount = 0;
                const csvProcessedIds = new Set<string>();

                for (let i = 1; i < lines.length; i++) {
                    const vals = parseCSVRow(lines[i]);
                    
                    if (vals.length >= 5) { // Minimum required columns: id, client, site, date, amount
                        const providedId = vals[0]?.trim() || '';
                        const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(providedId);
                        const idToUse = (mode !== 'append' && isValidUUID) ? providedId : generateId();
                        
                        if (idToUse) csvProcessedIds.add(idToUse);

                        const client = (vals[1] || '').trim();
                        const site = (vals[2] || '').trim();
                        const amount = parseFloat(vals[4]) || 0;

                        // Lookup VAT policy from master site registry
                        let siteObj = sites.find(s => s.name === site && s.client === client);
                        
                        // Fallback: Check if the user accidentally swapped Client and Site
                        if (!siteObj) {
                            siteObj = sites.find(s => s.name === client && s.client === site);
                        }
                        
                        const payVat = siteObj ? (siteObj.vat as any) : (vals[7] || 'No');

                        let vat = 0;
                        if (payVat === 'Yes') {
                            vat = (amount / (100 + vatRate)) * vatRate;
                        } else if (payVat === 'Add') {
                            vat = Math.round(((amount * 7.5) / 107.5) * 100) / 100;
                        }

                        let amountForVat = 0;
                        if (payVat !== 'No') {
                            amountForVat = amount - vat;
                        }

                        const parsedPayment: Payment = {
                            id: idToUse,
                            client: siteObj && siteObj.name === client ? site : client, // Restore correct client if swapped
                            site: siteObj && siteObj.name === client ? client : site, // Restore correct site if swapped
                            date: formatDisplayDate(normalizeDate(vals[3])), // store as dd/mm/yyyy
                            amount,
                            withholdingTax: parseFloat(vals[5]) || 0,
                            discount: parseFloat(vals[6]) || 0,
                            payVat,
                        };
                        const existing = payments.find(e => e.id === parsedPayment.id);
                        if (existing && mode !== 'append') { 
                            updatePayment(existing.id, parsedPayment); 
                            updatedCount++; 
                        } else { 
                            addPayment(parsedPayment); 
                            importedCount++; 
                        }
                    }
                }

                if (mode === 'replace') {
                    payments.forEach(pay => {
                        if (!csvProcessedIds.has(pay.id)) {
                            deletePayment(pay.id);
                            deletedCount++;
                        }
                    });
                }

                let message = `Import complete: ${importedCount} Added | ${updatedCount} Updated`;
                if (deletedCount > 0) message += ` | ${deletedCount} Removed`;
                toast.success(message);
            } catch (err) {
                toast.error('Failed to parse CSV file');
            }
        };
        reader.readAsText(file);
    };

    const handleExportCSV = () => {
        try {
            if (payments.length === 0) {
                toast.info('No payments to export');
                return;
            }
            const headers = ['id', 'client', 'tin', 'site', 'date', 'amount', 'withholdingTax', 'discount', 'payVat', 'vat', 'amountForVat'];
            const extractCSV = (val: any) => typeof val === 'number' ? String(val) : `"${String(val ?? '').replace(/"/g, '""')}"`;

            const rows = payments.map(pay => {
                const { vat, amountForVat: amtForVat } = getVatDetails(pay.amount || 0, pay.payVat, vatRate);
                const tin = clientProfiles.find(cp => cp.name === pay.client)?.tinNumber || '';
                
                const data = [
                    pay.id, pay.client, tin, pay.site, formatDisplayDate(pay.date), pay.amount, pay.withholdingTax, pay.discount, pay.payVat, vat, amtForVat
                ];
                return data.map(extractCSV).join(',');
            });

            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `payments_export_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Successfully exported ${payments.length} payments`);
        } catch (e) {
            toast.error('Export failed');
        }
    };

    const uniqueClients = useMemo(() => Array.from(new Set(sites.map(s => s.client))), [sites]);
    const sitesForClient = useMemo(() => form.client ? sites.filter(s => s.client === form.client) : sites, [sites, form.client]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
        return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
    };

    const sortedPayments = useMemo(() => {
        let filtered = payments;
        if (filterFromMonth || filterToMonth) {
            filtered = filtered.filter(p => {
                if (!p.date) return false;
                const parts = p.date.split('/');
                if (parts.length === 3) {
                    const dateYM = `${parts[2]}-${parts[1]}`;
                    if (filterFromMonth && dateYM < filterFromMonth) return false;
                    if (filterToMonth && dateYM > filterToMonth) return false;
                    return true;
                }
                return false;
            });
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = payments.filter(p => 
                (p.client && p.client.toLowerCase().includes(lowerSearch)) ||
                (p.site && p.site.toLowerCase().includes(lowerSearch)) ||
                (p.id && p.id.toLowerCase().includes(lowerSearch))
            );
        }

        return [...filtered].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            if (sortField === 'date') { 
                // Convert dd/mm/yyyy to yyyy-mm-dd for correct string comparison
                valA = a.date ? a.date.split('/').reverse().join('-') : ''; 
                valB = b.date ? b.date.split('/').reverse().join('-') : ''; 
            }
            else if (sortField === 'client') { valA = (a.client || '').toLowerCase(); valB = (b.client || '').toLowerCase(); }
            else if (sortField === 'site') { valA = (a.site || '').toLowerCase(); valB = (b.site || '').toLowerCase(); }
            else if (sortField === 'amount') { valA = a.amount || 0; valB = b.amount || 0; }
            else if (sortField === 'withholdingTax') { valA = a.withholdingTax || 0; valB = b.withholdingTax || 0; }
            else if (sortField === 'discount') { valA = a.discount || 0; valB = b.discount || 0; }
            else if (sortField === 'payVat') { valA = (a.payVat || '').toLowerCase(); valB = (b.payVat || '').toLowerCase(); }
            else if (sortField === 'vat') { valA = a.vat || 0; valB = b.vat || 0; }
            else if (sortField === 'amountForVat') { valA = a.amountForVat || 0; valB = b.amountForVat || 0; }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [payments, sortField, sortOrder, searchTerm, filterFromMonth, filterToMonth]);

    const tableSums = useMemo(() => {
        return sortedPayments.reduce((acc, p) => {
            // LIVE VAT CALCULATION
            const { vat, amountForVat: amtForVat } = getVatDetails(p.amount || 0, p.payVat, vatRate);

            return {
                amount: acc.amount + (p.amount || 0),
                wht: acc.wht + (p.withholdingTax || 0),
                discount: acc.discount + (p.discount || 0),
                vat: acc.vat + vat,
                amtForVat: acc.amtForVat + amtForVat,
            };
        }, { amount: 0, wht: 0, discount: 0, vat: 0, amtForVat: 0 });
    }, [sortedPayments, vatRate]);

    const formatSum = (val: number) => {
        if (priv?.canViewAmounts === false) return '***';
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    useSetPageTitle(
        'Payment Records',
        `Tracking ${payments.length} transactions with automated VAT and withholding tax calculations`,
        <div className="flex items-center gap-3">
            {priv.canExport && (
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm transition-all active:scale-95" 
                    onClick={handleExportCSV}
                >
                    <Upload className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline">Export</span>
                </Button>
            )}

            {priv.canImport && (
                <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                    <Download className="h-3.5 w-3.5 text-indigo-500" /> <span className="hidden sm:inline">Import</span>
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
                </label>
            )}

            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            {priv.canAdd && (
                <Button
                    size="sm"
                    className="h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95"
                    onClick={() => { handleClear(); setIsModalOpen(true); }}
                >
                    <Plus className="w-4 h-4" /> Add Payment
                </Button>
            )}
        </div>,
        [payments.length, priv.canImport, priv.canExport, priv.canAdd]
    );

    return (
        <div className="h-full flex flex-col min-h-0 py-6">
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6 px-6">

            <div className="flex flex-1 gap-6 items-start flex-col">

                <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0 min-h-[400px]">
                    <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                Payment Entries
                            </h3>
                            <Badge variant="secondary" className="ml-2 font-mono bg-emerald-100 text-emerald-800 border-emerald-200">{payments.length}</Badge>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                            {/* Filter input */}
                            <div className="flex items-center gap-2 sm:border-r border-slate-200 sm:pr-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">From</span>
                                <Input 
                                    type="month" 
                                    value={filterFromMonth} 
                                    onChange={(e) => setFilterFromMonth(e.target.value)} 
                                    className="h-8 w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                                />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">To</span>
                                <Input 
                                    type="month" 
                                    value={filterToMonth} 
                                    onChange={(e) => setFilterToMonth(e.target.value)} 
                                    className="h-8 w-36 text-xs border-slate-200 bg-white focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                                />
                                {(filterFromMonth || filterToMonth) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { setFilterFromMonth(''); setFilterToMonth(''); }} title="Clear filter">
                                        <X className="h-3.5 w-3.5"/>
                                    </Button>
                                )}
                            </div>

                            {/* Toggle for Actions Column */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show Actions</span>
                                <button
                                    onClick={() => setShowActions(!showActions)}
                                    className={`group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none`}
                                >
                                    <span className={`absolute h-4 w-9 rounded-full transition-colors duration-200 ease-in-out ${showActions ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                    <span
                                        className={`absolute left-0 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showActions ? 'translate-x-5' : 'translate-x-0.5'}`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto [scrollbar-gutter:stable] max-h-[calc(100vh-220px)] relative">
                        <style>{`
                            .overflow-x-auto {
                                scrollbar-width: thin;
                                scrollbar-color: #6366f1 #f1f5f9;
                            }
                            .overflow-x-auto::-webkit-scrollbar {
                                height: 10px;
                                display: block !important;
                            }
                            .overflow-x-auto::-webkit-scrollbar-track {
                                background: #f1f5f9;
                                border-radius: 10px;
                            }
                            .overflow-x-auto::-webkit-scrollbar-thumb {
                                background-color: #6366f1;
                                border-radius: 10px;
                                border: 2px solid #f1f5f9;
                            }
                            .overflow-x-auto::-webkit-scrollbar-thumb:hover {
                                background-color: #4f46e5;
                            }
                        `}</style>
                        <Table className="whitespace-nowrap min-w-full text-sm">
                            <TableHeader className="bg-slate-50 sticky top-0 z-20">
                                <TableRow className="bg-slate-100/80 border-b border-slate-200">
                                    <TableHead colSpan={3} className="px-6 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Total Sums</span>
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5" /> {/* TIN col — no sum */}
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-black text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm inline-block">
                                            ₦{formatSum(tableSums.amount)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm inline-block">
                                            ₦{formatSum(tableSums.wht)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm inline-block">
                                            ₦{formatSum(tableSums.discount)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-center"></TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-black text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-50 shadow-sm inline-block">
                                            ₦{formatSum(tableSums.vat)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-black text-emerald-600 bg-white px-2 py-1 rounded border border-emerald-50 shadow-sm inline-block">
                                            ₦{formatSum(tableSums.amtForVat)}
                                        </div>
                                    </TableHead>
                                    {showActions && <TableHead className="sticky right-0 bg-slate-100/80 p-0 w-20" />}
                                </TableRow>
                                <TableRow className="border-b-0">
                                    {([
                                        { field: 'date',           label: 'Date',        align: 'left'   },
                                        { field: 'client',         label: 'Client',      align: 'left'   },
                                        { field: 'tin',            label: 'TIN',         align: 'left'   },
                                        { field: 'site',           label: 'Site',        align: 'left'   },
                                        { field: 'amount',         label: 'Amount (₦)',  align: 'right'  },
                                        { field: 'withholdingTax', label: 'WHT',         align: 'right'  },
                                        { field: 'discount',       label: 'Discount',    align: 'right'  },
                                        { field: 'payVat',         label: 'VAT Policy',  align: 'center' },
                                        { field: 'vat',            label: 'VAT (₦)',     align: 'right'  },
                                        { field: 'amountForVat',   label: 'Amt For VAT', align: 'right'  },
                                    ] as const).map(({ field, label, align }) => (
                                        <TableHead
                                            key={field}
                                            className={`font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none text-${align} cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors`}
                                            onClick={() => handleSort(field)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                                {label} <SortIcon field={field} />
                                            </div>
                                        </TableHead>
                                    ))}
                                    {showActions && (
                                        <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-slate-50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider">Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPayments.map((p: Payment) => (
                                    <TableRow key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedId === p.id ? 'bg-indigo-50/50' : ''}`}>
                                        <TableCell className="px-4 py-3 text-slate-500">{formatDisplayDate(p.date)}</TableCell>
                                        <TableCell className="px-4 py-3 font-semibold text-slate-800">{p.client}</TableCell>
                                        <TableCell className="px-4 py-3 text-slate-500 font-mono text-xs">
                                            {clientProfiles.find(cp => cp.name === p.client)?.tinNumber || <span className="text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-slate-600">{p.site}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                            {priv?.canViewAmounts === false ? '***' : (p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 font-mono">
                                            {p.withholdingTax ? p.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 font-mono">
                                            {p.discount ? p.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center text-xs">
                                            <Badge variant={p.payVat === 'Yes' ? 'default' : p.payVat === 'Add' ? 'outline' : 'secondary'} className={`${p.payVat === 'Yes' ? 'bg-indigo-100 text-indigo-800' : ''}`}>
                                                {p.payVat || 'No'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-indigo-600 font-mono font-medium">
                                            {priv?.canViewAmounts === false ? '***' : (() => {
                                                const { vat } = getVatDetails(p.amount || 0, p.payVat, vatRate);
                                                return vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-emerald-600 font-mono font-medium">
                                            {priv?.canViewAmounts === false ? '***' : (() => {
                                                const { amountForVat } = getVatDetails(p.amount || 0, p.payVat, vatRate);
                                                return amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                        </TableCell>
                                        {showActions && (
                                            <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center justify-center gap-1">
                                                    {priv.canEdit && (
                                                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit record">
                                                          <Edit className="w-4 h-4" />
                                                      </Button>
                                                    )}
                                                    {priv.canDelete && (
                                                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete record">
                                                          <Trash2 className="w-4 h-4" />
                                                      </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                                {sortedPayments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showActions ? 11 : 10} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide border-b-0">
                                            No payment records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{selectedId ? 'Edit Payment' : 'Create Payment'}</h2>
                                <p className="text-xs text-slate-500">Record a new payment to auto-calculate VAT elements.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsModalOpen(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
                                    <Input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} className="bg-slate-50 h-11" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount (₦)</label>
                                    <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.amount} onValueChange={(v) => handleChange('amount', v.value || '')} className="bg-slate-50 font-mono font-semibold text-lg text-emerald-700 h-11" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
                                    <select
                                        value={form.client}
                                        onChange={e => { handleChange('client', e.target.value); handleChange('site', ''); }}
                                        className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    >
                                        <option value="">Select Client...</option>
                                        {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Site</label>
                                    <select
                                        value={form.site}
                                        onChange={e => handleChange('site', e.target.value)}
                                        disabled={!form.client}
                                        className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Site...</option>
                                        {sitesForClient.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Withholding Tax</label>
                                    <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.withholdingTax} onValueChange={(v) => handleChange('withholdingTax', v.value || '')} className="bg-slate-50 h-11" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount</label>
                                    <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.discount} onValueChange={(v) => handleChange('discount', v.value || '')} className="bg-slate-50 h-11" />
                                </div>
                            </div>

                            {/* Live Preview of Calculation */}
                            <div className="border-t border-slate-200 pt-5">
                                <div className="bg-slate-900 rounded-xl p-5 shadow-inner">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Calculated Details</span>
                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider rounded-sm px-2 py-0 border-slate-700 ${livePreview.payVat === 'Yes' ? 'text-indigo-400 bg-indigo-950/50' : livePreview.payVat === 'Add' ? 'text-amber-400 bg-amber-950/50' : 'text-slate-400 bg-slate-800'}`}>
                                            VAT: {livePreview.payVat}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Gross Payment</span>
                                            <span className="font-mono text-slate-200 font-medium text-sm">₦{priv?.canViewAmounts === false ? '***' : livePreview.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-700 pl-4">
                                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Tax Component (VAT {livePreview.payVat})</span>
                                            <span className="font-mono text-indigo-400 font-medium text-sm">₦{priv?.canViewAmounts === false ? '***' : livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <Button variant="outline" className="flex-1 border-slate-300 h-11 text-slate-600 hover:bg-slate-100" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 shadow-md">
                                <CheckCircle className="w-4 h-4" /> {selectedId ? 'Update Payment' : 'Submit Payment'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal Options */}
            {importFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
                    <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Import Policy</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">
                            How would you like to process the payment records from this CSV file?
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button onClick={() => processImport(importFile, 'update')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex-col items-center justify-center">
                                <span className="font-semibold block text-base">Update & Add (Recommended)</span>
                                <span className="block text-xs opacity-80 mt-1 font-normal text-center">Modifies matching IDs. Adds missing ones. Leaves others alone.</span>
                            </Button>
                            <Button onClick={() => processImport(importFile, 'append')} variant="outline" className="border-slate-200 h-auto py-3 text-slate-700 hover:bg-slate-50 flex-col items-center justify-center">
                                <span className="font-semibold block text-base">Append Only</span>
                                <span className="block text-xs text-slate-500 mt-1 font-normal text-center">Adds every row as a brand new record, completely ignoring current IDs.</span>
                            </Button>
                            <Button onClick={() => processImport(importFile, 'replace')} variant="outline" className="border-rose-200 h-auto py-3 text-rose-600 hover:bg-rose-50 flex-col items-center justify-center">
                                <span className="font-semibold block text-base">Replace Entire List</span>
                                <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes current records that are NOT in this CSV. Updates matches. Adds new ones.</span>
                            </Button>
                            <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 mt-2">
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

