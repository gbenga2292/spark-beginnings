import { formatDisplayDate, normalizeDate } from '@/src/lib/dateUtils';
import { useState, useMemo } from 'react';
import { generateId } from '@/src/lib/utils';
import { useAppStore, VatPayment } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, Upload, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { NumericFormat } from 'react-number-format';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

export function VatPayments({ setPreviewModal, searchTerm = '' }: { setPreviewModal?: (val: any) => void; searchTerm?: string }) {
    const sites = useAppStore((state) => state.sites);
    const payments = useAppStore((state) => state.payments);
    const vatPayments = useAppStore((state) => state.vatPayments);
    const addVatPayment = useAppStore((state) => state.addVatPayment);
    const updateVatPayment = useAppStore((state) => state.updateVatPayment);
    const deleteVatPayment = useAppStore((state) => state.deleteVatPayment);

    // ─── Permissions ───────────────────────────────────────────
    const priv = usePriv('payments');

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showActions, setShowActions] = useState(false);
    // Sorting state for Entries table
    const [entriesSortField, setEntriesSortField] = useState<string>('date');
    const [entriesSortOrder, setEntriesSortOrder] = useState<'asc' | 'desc'>('desc');
    // Sorting state for Totals table
    const [totalsSortField, setTotalsSortField] = useState<string>('client');
    const [totalsSortOrder, setTotalsSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterFromMonth, setFilterFromMonth] = useState<string>('');
    const [filterToMonth, setFilterToMonth] = useState<string>('');

    const initialForm = {
        client: '',
        date: '',
        month: '',
        year: new Date().getFullYear().toString(),
        amount: '',
    };
    const [form, setForm] = useState(initialForm);

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleClear = () => {
        setForm(initialForm);
        setSelectedId(null);
    };

    const handleSubmit = () => {
        if (!form.client) {
            toast.error('Please select a Client.');
            return;
        }
        if (!form.date) {
            toast.error('Date is required.');
            return;
        }
        const amount = parseFloat(form.amount) || 0;
        if (amount <= 0) {
            toast.error('Amount must be numeric and greater than 0.');
            return;
        }

        const data: Omit<VatPayment, 'id'> = {
            client: form.client,
            date: form.date,
            month: form.month,
            year: form.year,
            amount,
        };

        if (selectedId) {
            updateVatPayment(selectedId, data);
            toast.success('VAT payment updated successfully!');
        } else {
            addVatPayment({ ...data, id: generateId() });
            toast.success('VAT submitted successfully!');
        }
        setIsModalOpen(false);
        handleClear();
    };

    const handleEdit = (pay: VatPayment) => {
        setSelectedId(pay.id);
        setForm({
            client: pay.client,
            date: pay.date,
            month: pay.month || '',
            year: pay.year || new Date().getFullYear().toString(),
            amount: pay.amount.toString(),
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const ok = await showConfirm('Are you sure you want to delete this VAT payment?', { variant: 'danger' });
        if (ok) {
            deleteVatPayment(id);
            if (selectedId === id) handleClear();
            toast.success('VAT payment deleted');
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

                    if (vals.length >= 4) { // Minimum required columns
                        const providedId = vals[0]?.trim() || '';
                        const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(providedId);
                        const idToUse = (mode !== 'append' && isValidUUID) ? providedId : generateId();

                        if (idToUse) csvProcessedIds.add(idToUse);

                        const parsedVatPayment: VatPayment = {
                            id: idToUse,
                            client: vals[1],
                            date: normalizeDate(vals[2]),
                            month: vals[3] || '',
                            year: vals[4] || '',
                            amount: parseFloat(vals[5]) || 0,
                        };
                        const existing = vatPayments.find(e => e.id === parsedVatPayment.id);
                        if (existing && mode !== 'append') {
                            updateVatPayment(existing.id, parsedVatPayment);
                            updatedCount++;
                        } else {
                            addVatPayment(parsedVatPayment);
                            importedCount++;
                        }
                    }
                }

                if (mode === 'replace') {
                    vatPayments.forEach(pay => {
                        if (!csvProcessedIds.has(pay.id)) {
                            deleteVatPayment(pay.id);
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

    const handleExportCSV = async () => {
        try {
            if (vatPayments.length === 0) {
                toast.info('No VAT payments to export');
                return;
            }
            const headers = ['id', 'client', 'date', 'month', 'year', 'amount'];
            const extractCSV = (val: any) => typeof val === 'number' ? String(val) : `"${String(val ?? '').replace(/"/g, '""')}"`;

            const rows = vatPayments.map(pay => {
                const data = [
                    pay.id,
                    pay.client,
                    formatDisplayDate(pay.date),
                    pay.month || '',
                    pay.year || '',
                    pay.amount
                ];
                return data.map(extractCSV).join(',');
            });

            const csvContent = [headers.join(','), ...rows].join('\n');
            const fileName = `vat_payments_export_${new Date().toISOString().slice(0, 10)}.csv`;

            const onConfirm = async () => {
                if (window.electronAPI?.savePathDialog) {
                    const filePath = await window.electronAPI.savePathDialog({
                        title: 'Export VAT Remittances (CSV)',
                        defaultPath: fileName,
                        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
                    });

                    if (filePath) {
                        const success = await window.electronAPI.writeFile(filePath, csvContent, 'utf8');
                        if (success) {
                            toast.success(`Exported to ${filePath}`);
                        } else {
                            toast.error('Failed to save file.');
                        }
                    }
                } else {
                    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", fileName);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success(`Successfully exported ${vatPayments.length} VAT payments`);
                }
            };

            if (setPreviewModal) {
                setPreviewModal({
                    isOpen: true,
                    title: 'Preview VAT Remittance Export',
                    filename: fileName,
                    headers: headers.map(h => h.toUpperCase()),
                    data: vatPayments.map(pay => [
                        pay.id,
                        pay.client,
                        formatDisplayDate(pay.date),
                        pay.month || '',
                        pay.year || '',
                        `₦${(pay.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ]),
                    onConfirm
                });
            } else {
                onConfirm();
            }
        } catch (e) {
            toast.error('Export failed');
        }
    };

    const uniqueClients = useMemo(() => {
        return Array.from(new Set(sites.map(s => s.client))).sort();
    }, [sites]);

    const totalsData = useMemo(() => {
        let data = uniqueClients.map(client => {
            let clientPayments = payments.filter(p => p.client === client && p.vat > 0);
            let clientVatPayments = vatPayments.filter(vp => vp.client === client);

            if (filterFromMonth || filterToMonth) {
                const checkDate = (d: string) => {
                    if (!d) return false;
                    let dateYM = '';
                    if (d.includes('-')) {
                        dateYM = d.substring(0, 7);
                    } else {
                        const parts = d.split('/');
                        if (parts.length === 3) {
                            dateYM = `${parts[2]}-${parts[1]}`;
                        }
                    }
                    if (!dateYM) return false;
                    if (filterFromMonth && dateYM < filterFromMonth) return false;
                    if (filterToMonth && dateYM > filterToMonth) return false;
                    return true;
                };
                clientPayments = clientPayments.filter(p => checkDate(p.date));
                clientVatPayments = clientVatPayments.filter(vp => checkDate(vp.date));
            }

            const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
            const totalVat = clientPayments.reduce((sum, p) => sum + p.vat, 0);
            const vatPaid = clientVatPayments.reduce((sum, vp) => sum + vp.amount, 0);

            const vatBalanceToPay = totalVat - vatPaid;
            const principleOnVatDue = totalVat > 0 ? (vatBalanceToPay / totalVat) * totalPaid : 0;

            return {
                client,
                totalPaid,
                vat: totalVat,
                vatPaid,
                vatBalanceToPay,
                principleOnVatDue: Math.max(0, principleOnVatDue)
            };
        });

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            data = data.filter(d => d.client.toLowerCase().includes(lowerSearch));
        }

        return data.sort((a, b) => {
            let valA: any = (a as any)[totalsSortField];
            let valB: any = (b as any)[totalsSortField];
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            if (valA < valB) return totalsSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return totalsSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [uniqueClients, payments, vatPayments, totalsSortField, totalsSortOrder, filterFromMonth, filterToMonth]);

    const sortedVatPayments = useMemo(() => {
        let filtered = vatPayments;
        if (filterFromMonth || filterToMonth) {
            filtered = filtered.filter(p => {
                const d = p.date || '';
                let dateYM = '';
                if (d.includes('-')) {
                    dateYM = d.substring(0, 7);
                } else {
                    const parts = d.split('/');
                    if (parts.length === 3) {
                        dateYM = `${parts[2]}-${parts[1]}`;
                    }
                }
                if (!dateYM) return false;
                if (filterFromMonth && dateYM < filterFromMonth) return false;
                if (filterToMonth && dateYM > filterToMonth) return false;
                return true;
            });
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.client.toLowerCase().includes(lowerSearch) ||
                (p.month && p.month.toLowerCase().includes(lowerSearch)) ||
                (p.year && p.year.toLowerCase().includes(lowerSearch))
            );
        }

        return [...filtered].sort((a, b) => {
            let valA: any = (a as any)[entriesSortField];
            let valB: any = (b as any)[entriesSortField];
            if (entriesSortField === 'amount') {
                valA = valA || 0;
                valB = valB || 0;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            if (valA < valB) return entriesSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return entriesSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [vatPayments, entriesSortField, entriesSortOrder, searchTerm, filterFromMonth, filterToMonth]);

    const handleEntriesSort = (field: string) => {
        if (entriesSortField === field) {
            setEntriesSortOrder(entriesSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setEntriesSortField(field);
            setEntriesSortOrder('asc');
        }
    };

    const handleTotalsSort = (field: string) => {
        if (totalsSortField === field) {
            setTotalsSortOrder(totalsSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setTotalsSortField(field);
            setTotalsSortOrder('asc');
        }
    };

    const SortIcon = ({ field, currentField, currentOrder }: { field: string, currentField: string, currentOrder: 'asc' | 'desc' }) => {
        if (currentField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
        return currentOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
    };

    const overallTotals = useMemo(() => {
        return totalsData.reduce((acc, curr) => ({
            totalPaid: acc.totalPaid + curr.totalPaid,
            vat: acc.vat + curr.vat,
            vatPaid: acc.vatPaid + curr.vatPaid,
            vatBalanceToPay: acc.vatBalanceToPay + curr.vatBalanceToPay,
            principleOnVatDue: acc.principleOnVatDue + curr.principleOnVatDue,
        }), { totalPaid: 0, vat: 0, vatPaid: 0, vatBalanceToPay: 0, principleOnVatDue: 0 });
    }, [totalsData]);

    const vatPaymentsSum = useMemo(() => {
        return sortedVatPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }, [sortedVatPayments]);

    const formatSum = (val: number) => {
        if (priv?.canViewAmounts === false) return '***';
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    useSetPageTitle(
        'VAT Remittance',
        'Record and track VAT remittances to FIRS',
        <div className="hidden sm:flex items-center gap-3">
            {priv.canExport && (
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm transition-all" 
                    onClick={handleExportCSV}
                >
                    <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export
                </Button>
            )}
            {priv.canImport && (
                <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
                    <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
                </label>
            )}
            {priv.canManageVat && (
                <Button
                    size="sm"
                    className="h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-tight shadow-md transition-all active:scale-95"
                    onClick={() => { handleClear(); setIsModalOpen(true); }}
                >
                    <Plus className="w-4 h-4" /> Add VAT Payment
                </Button>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

                {/* Mobile-only actions */}
                <div className="flex sm:hidden justify-end gap-2">
                    {priv.canExport && (
                        <Button variant="outline" size="sm" className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-tight" onClick={handleExportCSV}>
                            <Upload className="h-3.5 w-3.5 text-emerald-500" /> Export
                        </Button>
                    )}
                    {priv.canImport && (
                        <label className="flex items-center gap-2 px-3 h-9 bg-white rounded-md border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-tight cursor-pointer">
                            <Download className="h-3.5 w-3.5 text-indigo-500" /> Import
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
                        </label>
                    )}
                    {priv.canManageVat && (
                        <Button size="sm" className="h-9 px-3 gap-2 bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-tight" onClick={() => { handleClear(); setIsModalOpen(true); }}>
                            <Plus className="w-4 h-4" /> Add
                        </Button>
                    )}
                </div>

                <div className="flex flex-1 gap-6 items-start flex-col">
                    <div className="flex-1 w-full flex flex-col gap-6 min-w-0">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
                            <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-sm bg-indigo-500"></span>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                        VAT Payment Entries
                                    </h3>
                                    <Badge variant="secondary" className="ml-2 font-mono bg-indigo-100 text-indigo-800 border-indigo-200">{vatPayments.length}</Badge>
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

                            <div className="flex-1 overflow-x-auto [scrollbar-gutter:stable] min-h-[250px] max-h-[350px] relative">
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
                                            <TableHead colSpan={4} className="px-6 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Total Remitted</span>
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[12px] font-mono font-black text-emerald-600 bg-white px-3 py-1 rounded border border-emerald-100 shadow-sm inline-block">
                                                    ₦{formatSum(vatPaymentsSum)}
                                                </div>
                                            </TableHead>
                                            {showActions && priv.canManageVat && <TableHead className="sticky right-0 bg-slate-100/80 p-0 w-20" />}
                                        </TableRow>
                                        <TableRow className="border-b-0">
                                            {[
                                                { field: 'date', label: 'Payment Date', align: 'left' },
                                                { field: 'client', label: 'Client', align: 'left' },
                                                { field: 'month', label: 'VAT Month', align: 'left' },
                                                { field: 'year', label: 'VAT Year', align: 'center' },
                                                { field: 'amount', label: 'Amount (₦)', align: 'right' },
                                            ].map((col) => (
                                                <TableHead
                                                    key={col.field}
                                                    className={`font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''} cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors`}
                                                    onClick={() => handleEntriesSort(col.field)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                                        {col.label}
                                                        <SortIcon field={col.field} currentField={entriesSortField} currentOrder={entriesSortOrder} />
                                                    </div>
                                                </TableHead>
                                            ))}
                                            {showActions && priv.canManageVat && (
                                                <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-slate-50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider">Actions</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedVatPayments.map((p: VatPayment) => (
                                            <TableRow key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedId === p.id ? 'bg-indigo-50/50' : ''}`}>
                                                <TableCell className="px-4 py-3 text-slate-500">{formatDisplayDate(p.date)}</TableCell>
                                                <TableCell className="px-4 py-3 font-semibold text-slate-800">{p.client}</TableCell>
                                                <TableCell className="px-4 py-3 text-slate-600">{p.month}</TableCell>
                                                <TableCell className="px-4 py-3 text-center text-slate-600">{p.year}</TableCell>
                                                <TableCell className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                                                    {priv?.canViewAmounts === false ? '***' : (p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                {showActions && priv.canManageVat && (
                                                    <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit">
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete record">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                        {sortedVatPayments.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={showActions ? 6 : 5} className="px-4 py-8 text-center text-slate-500 font-medium tracking-wide">
                                                    No VAT payment records.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
                            <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-sm bg-rose-500"></span>
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                        Client & Total Balances
                                    </h3>
                                </div>
                                <div className="flex gap-4 font-mono text-sm">
                                    <div className="flex flex-col items-end">
                                        <span className="text-slate-400 text-xs font-sans tracking-tight">Total VAT</span>
                                        <span className="text-slate-800 font-bold">₦{priv?.canViewAmounts === false ? '***' : overallTotals.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-8 w-px bg-slate-300 mx-2 hidden sm:block"></div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-slate-400 text-xs font-sans tracking-tight">Total Balance</span>
                                        <span className="text-rose-600 font-bold">₦{priv?.canViewAmounts === false ? '***' : overallTotals.vatBalanceToPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-x-auto [scrollbar-gutter:stable] min-h-[250px] max-h-[350px]">
                                <Table className="whitespace-nowrap min-w-full text-sm">
                                    <TableHeader className="bg-slate-50 sticky top-0 z-20">
                                        <TableRow className="bg-slate-100/80 border-b border-slate-200">
                                            <TableHead className="px-6 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-900">Aggregate Balances</span>
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm inline-block">
                                                    ₦{formatSum(overallTotals.totalPaid)}
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm inline-block">
                                                    ₦{formatSum(overallTotals.vat)}
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[11px] font-mono font-bold text-emerald-600 bg-white px-2 py-1 rounded border border-emerald-50 shadow-sm inline-block">
                                                    ₦{formatSum(overallTotals.vatPaid)}
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[11px] font-mono font-black text-rose-600 bg-white px-2 py-1 rounded border border-rose-100 shadow-sm inline-block">
                                                    ₦{formatSum(overallTotals.vatBalanceToPay)}
                                                </div>
                                            </TableHead>
                                            <TableHead className="px-4 py-2.5 text-right">
                                                <div className="text-[11px] font-mono font-bold text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-50 shadow-sm inline-block">
                                                    ₦{formatSum(overallTotals.principleOnVatDue)}
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                        <TableRow className="border-b-0">
                                            {[
                                                { field: 'client',            label: 'Client', align: 'left' },
                                                { field: 'totalPaid',         label: 'Total Paid', align: 'right' },
                                                { field: 'vat',               label: 'VAT Value', align: 'right' },
                                                { field: 'vatPaid',           label: 'VAT Remitted', align: 'right' },
                                                { field: 'vatBalanceToPay',   label: 'Balance to Pay', align: 'right', className: 'text-rose-600' },
                                                { field: 'principleOnVatDue', label: 'Principle on VAT Due', align: 'right', className: 'text-indigo-600' },
                                            ].map((col) => (
                                                <TableHead
                                                    key={col.field}
                                                    className={`font-semibold px-4 py-3 uppercase text-[10px] tracking-wider select-none ${col.className || 'text-slate-500'} ${col.align === 'right' ? 'text-right' : ''} cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors`}
                                                    onClick={() => handleTotalsSort(col.field)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                                        {col.label}
                                                        <SortIcon field={col.field} currentField={totalsSortField} currentOrder={totalsSortOrder} />
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {totalsData.map((t, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="px-4 py-3 font-semibold text-slate-800">{t.client}</TableCell>
                                                <TableCell className="px-4 py-3 text-right text-slate-600 font-mono">
                                                    {t.totalPaid ? t.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right text-slate-600 font-mono">
                                                    {t.vat ? t.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right text-emerald-600 font-mono">
                                                    {t.vatPaid ? t.vatPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right text-rose-600 font-mono font-bold">
                                                    {t.vatBalanceToPay ? t.vatBalanceToPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right text-indigo-600 font-mono font-medium">
                                                    {t.principleOnVatDue ? t.principleOnVatDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {totalsData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="px-4 py-8 text-center text-slate-500 font-medium tracking-wide">
                                                    No summarized data.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedId ? 'Edit VAT' : 'Create VAT Payment'}</h2>
                                    <p className="text-xs text-slate-500">Record VAT remittances to FIRS.</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsModalOpen(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
                                    <select
                                        value={form.client}
                                        onChange={e => handleChange('client', e.target.value)}
                                        className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    >
                                        <option value="">Select Client...</option>
                                        {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
                                    <Input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} className="bg-slate-50 h-11" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5 flex-1">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Month Coverage</label>
                                        <div className="relative">
                                            <select value={form.month} onChange={e => handleChange('month', e.target.value)} className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none font-semibold text-slate-700">
                                                <option value="" disabled>Select...</option>
                                                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 flex-1">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Year Coverage</label>
                                        <div className="relative">
                                            <select value={form.year} onChange={e => handleChange('year', e.target.value)} className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none font-semibold text-slate-700">
                                                <option value="" disabled>Select...</option>
                                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount Paid (₦)</label>
                                    <NumericFormat customInput={Input} thousandSeparator decimalScale={2} value={form.amount} onValueChange={(v) => handleChange('amount', v.value || '')} className="font-mono bg-slate-50 font-bold text-lg text-indigo-700 h-11" />
                                </div>
                            </div>

                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <Button variant="outline" className="flex-1 border-slate-300 h-11 text-slate-600 hover:bg-slate-100" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11 shadow-md">
                                    <CheckCircle className="w-4 h-4" /> {selectedId ? 'Update VAT' : 'Submit VAT'}
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
                                How would you like to process the VAT payment records from this CSV file?
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
