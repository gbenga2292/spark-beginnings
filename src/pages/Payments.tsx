import { useState, useMemo, useEffect } from 'react';
import { PaymentFormModal } from './PaymentFormModal';
import { normalizeDate, formatDisplayDate } from '@/src/lib/dateUtils';
import { useAppStore, Payment, Invoice, PendingInvoice, PaymentAllocation } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X, Upload, Download, ChevronUp, ChevronDown, FileText, MoreVertical, ArrowLeft, Save, CreditCard, Layers, AlertCircle, RefreshCw, Split, Check, Info } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { cn, generateId } from '@/src/lib/utils';
import { NumericFormat } from 'react-number-format';
import { getSiteOpenInvoices, OpenInvoiceItem, buildSettlementMap } from '@/src/lib/settlementUtils';
import { fetchInvoicesData } from '@/src/lib/supabaseService';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/src/components/ui/dropdown-menu';

const getVatDetails = (amount: number, payVat: string, vatRate: number, damages: number = 0) => {
    const baseAmount = amount - damages;
    const vat = payVat === 'Add' ? Math.round(((baseAmount * vatRate) / (100 + vatRate)) * 100) / 100 
              : payVat === 'Yes' ? Math.round(((baseAmount / (100 + vatRate)) * vatRate) * 100) / 100 
              : 0;
    const amountForVat = payVat !== 'No' && vat > 0 ? baseAmount - vat : 0;
    return { vat, amountForVat };
};

export interface VatComputation {
    vat: number;
    amountForVat: number;
    isItemized?: boolean;
    effectiveVatRate?: number;
}

export const computePaymentVatDetails = (
    amount: number,
    damages: number,
    payVat: string,
    vatRate: number,
    allocationMode: 'single' | 'multi',
    allocations: Record<string, { amount: string; withholdingTax: string; discount: string }>,
    selectedInvoice: any,
    availableInvoices: any[],
    allInvoicesList: any[]
): VatComputation => {
    const baseAmount = Math.max(0, amount - damages);
    if (baseAmount <= 0 || payVat === 'No') {
        return { vat: 0, amountForVat: 0, isItemized: false, effectiveVatRate: 0 };
    }

    if (allocationMode === 'single') {
        if (selectedInvoice && selectedInvoice.totalAmount > 0) {
            const invTotal = Number(selectedInvoice.totalAmount);
            const invVat = Number(selectedInvoice.vat || 0);

            if (invVat > 0) {
                const ratio = invVat / invTotal;
                const vat = Math.round((baseAmount * ratio) * 100) / 100;
                let amountForVat = 0;
                if (selectedInvoice.vatableAmount !== undefined && selectedInvoice.vatableAmount > 0) {
                    amountForVat = Math.round((baseAmount * (Number(selectedInvoice.vatableAmount) / invTotal)) * 100) / 100;
                } else {
                    amountForVat = Math.max(0, baseAmount - vat);
                }
                const effectiveVatRate = Math.round((invVat / invTotal) * 10000) / 100;
                return { vat, amountForVat, isItemized: selectedInvoice.vatScope === 'per_section' || selectedInvoice.vatInc === 'Add', effectiveVatRate };
            } else if (selectedInvoice.vatInc === 'No') {
                return { vat: 0, amountForVat: 0, isItemized: true, effectiveVatRate: 0 };
            }
        }
        const fallback = getVatDetails(amount, payVat, vatRate, damages);
        return { ...fallback, isItemized: false, effectiveVatRate: vatRate };
    }

    // Multi-invoice allocation mode
    let totalVat = 0;
    let totalVatable = 0;
    let hasItemized = false;
    let totalAllocatedCash = 0;

    Object.entries(allocations).forEach(([invId, data]) => {
        const allocCash = parseFloat(String(data.amount || '').replace(/,/g, '')) || 0;
        if (allocCash <= 0) return;
        totalAllocatedCash += allocCash;

        const inv = availableInvoices.find(i => i.id === invId) || allInvoicesList.find(i => i.id === invId);
        if (inv) {
            const invTotal = Number((inv as any).totalAmount || (inv as any).totalCharge || (inv as any).amount || 0);
            const invVat = Number((inv as any).vat || 0);
            const invVatable = (inv as any).vatableAmount !== undefined ? Number((inv as any).vatableAmount) : undefined;
            const invVatInc = (inv as any).vatInc || 'No';

            if (invTotal > 0 && invVat > 0) {
                hasItemized = true;
                const ratio = invVat / invTotal;
                const v = Math.round((allocCash * ratio) * 100) / 100;
                totalVat += v;
                if (invVatable !== undefined && invVatable > 0) {
                    totalVatable += Math.round((allocCash * (invVatable / invTotal)) * 100) / 100;
                } else {
                    totalVatable += Math.max(0, allocCash - v);
                }
            } else if (invVatInc === 'No') {
                // 0% VAT
            } else {
                const fb = getVatDetails(allocCash, invVatInc || payVat, vatRate, 0);
                totalVat += fb.vat;
                totalVatable += fb.amountForVat;
            }
        } else {
            const fb = getVatDetails(allocCash, payVat, vatRate, 0);
            totalVat += fb.vat;
            totalVatable += fb.amountForVat;
        }
    });

    totalVat = Math.round(totalVat * 100) / 100;
    totalVatable = Math.round(totalVatable * 100) / 100;

    return {
        vat: totalVat,
        amountForVat: totalVatable,
        isItemized: hasItemized,
        effectiveVatRate: totalAllocatedCash > 0 ? Math.round((totalVat / totalAllocatedCash) * 10000) / 100 : 0
    };
};

export function Payments({ setPreviewModal, searchTerm = '' }: { setPreviewModal?: (val: any) => void; searchTerm?: string }) {
    const sites = useAppStore((state) => state.sites);
    const payments = useAppStore((state) => state.payments);
    const invoices = useAppStore((state) => state.invoices);
    const pendingInvoices = useAppStore((state) => state.pendingInvoices);
    const activePaymentModalTarget = useAppStore((state) => state.activePaymentModalTarget);
    const closePaymentModalTarget = useAppStore((state) => state.closePaymentModalTarget);
    const clientProfiles = useAppStore((state) => state.clientProfiles);
    const pendingSites = useAppStore((state) => state.pendingSites);
    const ledgerBanks = useAppStore((state) => state.ledgerBanks);
    const addPayment = useAppStore((state) => state.addPayment);
    const updatePayment = useAppStore((state) => state.updatePayment);
    const deletePayment = useAppStore((state) => state.deletePayment);
    const vatRate = useAppStore((state) => state.payrollVariables.vatRate);

    const sortedBanks = useMemo(() => [...ledgerBanks].sort((a, b) => a.name.localeCompare(b.name)), [ledgerBanks]);

    // Memoized TIN lookup map for O(1) rendering lookups
    const tinMap = useMemo(() => {
        const map = new Map<string, string>();
        
        // Seed from pendingSites fallback
        pendingSites.forEach(s => {
            const key = s.clientName?.trim().toLowerCase();
            const tin = s.phase4?.clientTinNumber;
            if (key && tin) {
                map.set(key, tin);
            }
        });

        // Overlay clientProfiles (primary source of truth)
        clientProfiles.forEach(cp => {
            const key = cp.name?.trim().toLowerCase();
            const tin = cp.tinNumber;
            if (key && tin) {
                map.set(key, tin);
            }
        });

        return map;
    }, [clientProfiles, pendingSites]);

    // Case-insensitive TIN lookup with pendingSites fallback
    const getTinForClient = (clientName: string): string => {
        if (!clientName) return '';
        const key = clientName.trim().toLowerCase();
        return tinMap.get(key) || '';
    };

    // ─── Permissions ───────────────────────────────────────────
    const priv = usePriv('payments');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [modalPayment, setModalPayment] = useState<Payment | null>(null);
    const [modalTarget, setModalTarget] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showActions, setShowActions] = useState(false);
    const [sortField, setSortField] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterFromMonth, setFilterFromMonth] = useState<string>('');
    const [filterToMonth, setFilterToMonth] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);



    // Auto-open modal when triggered from an invoice row
    useEffect(() => {
        if (activePaymentModalTarget) {
            setSelectedId(null);
            setModalPayment(null);
            setModalTarget(activePaymentModalTarget);
            setIsModalOpen(true);
            closePaymentModalTarget();
        }
    }, [activePaymentModalTarget, closePaymentModalTarget]);

    // Fetch invoices on mount if not yet loaded in store
    useEffect(() => {
        if (invoices.length === 0 && pendingInvoices.length === 0) {
            fetchInvoicesData()
                .then((data) => {
                    useAppStore.setState(data);
                })
                .catch((err) => {
                    console.error('[Payments] Failed to load invoices:', err);
                });
        }
    }, [invoices.length, pendingInvoices.length]);

    const handleEdit = (pay: Payment) => {
        setSelectedId(pay.id);
        setModalPayment(pay);
        setModalTarget(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        const ok = await showConfirm('Are you sure you want to delete this payment?', { variant: 'danger' });
        if (ok) {
            deletePayment(id);
            if (selectedId === id) { setSelectedId(null); setModalPayment(null); setModalTarget(null); }
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
                            vat,
                            amountForVat,
                            paidTo: vals[8]?.trim() || undefined,
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
            const headers = ['id', 'client', 'tin', 'site', 'invoiceNumber', 'paidTo', 'date', 'amount', 'withholdingTax', 'discount', 'damages', 'payVat', 'vat', 'amountForVat'];
            const extractCSV = (val: any) => typeof val === 'number' ? String(val) : `"${String(val ?? '').replace(/"/g, '""')}"`;

            const rows = payments.map(pay => {
                const vat = pay.vat !== undefined && pay.vat !== null ? pay.vat : getVatDetails(pay.amount || 0, pay.payVat, vatRate, pay.damages || 0).vat;
                const amtForVat = pay.amountForVat !== undefined && pay.amountForVat !== null ? pay.amountForVat : getVatDetails(pay.amount || 0, pay.payVat, vatRate, pay.damages || 0).amountForVat;
                const tin = getTinForClient(pay.client);
                
                const data = [
                    pay.id, pay.client, tin, pay.site, pay.invoiceNumber || '', pay.paidTo || '', formatDisplayDate(pay.date), pay.amount, pay.withholdingTax, pay.discount, pay.damages || 0, pay.payVat, vat, amtForVat
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
            filtered = filtered.filter(p => 
                (p.client && p.client.toLowerCase().includes(lowerSearch)) ||
                (p.site && p.site.toLowerCase().includes(lowerSearch)) ||
                (p.paidTo && p.paidTo.toLowerCase().includes(lowerSearch)) ||
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
            else if (sortField === 'paidTo') { valA = (a.paidTo || '').toLowerCase(); valB = (b.paidTo || '').toLowerCase(); }
            else if (sortField === 'amount') { valA = a.amount || 0; valB = b.amount || 0; }
            else if (sortField === 'withholdingTax') { valA = a.withholdingTax || 0; valB = b.withholdingTax || 0; }
            else if (sortField === 'discount') { valA = a.discount || 0; valB = b.discount || 0; }
            else if (sortField === 'damages') { valA = a.damages || 0; valB = b.damages || 0; }
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
            // Prefer stored proportional VAT if available, fallback to site calculation
            const vat = p.vat !== undefined && p.vat !== null ? p.vat : getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0).vat;
            const amtForVat = p.amountForVat !== undefined && p.amountForVat !== null ? p.amountForVat : getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0).amountForVat;

            return {
                amount: acc.amount + (p.amount || 0),
                wht: acc.wht + (p.withholdingTax || 0),
                discount: acc.discount + (p.discount || 0),
                damages: acc.damages + (p.damages || 0),
                vat: acc.vat + vat,
                amtForVat: acc.amtForVat + amtForVat,
            };
        }, { amount: 0, wht: 0, discount: 0, damages: 0, vat: 0, amtForVat: 0 });
    }, [sortedPayments, vatRate]);

    const formatSum = (val: number) => {
        if (priv?.canViewAmounts === false) return '***';
        return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    useSetPageTitle(
        'Payment Records',
        `Tracking ${payments.length} transactions with automated VAT and withholding tax calculations`,
        <div className="flex items-center gap-2 md:gap-3">
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
                <label className="flex items-center gap-2 px-3 h-9 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-tight cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors mb-0">
                    <Download className="h-3.5 w-3.5 text-blue-600" /> <span className="hidden sm:inline">Import</span>
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSVSelected} />
                </label>
            )}

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            {priv.canAdd && (
                <Button
                    size="sm"
                    className="h-9 px-3 sm:px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-tight rounded-md transition-colors"
                    onClick={() => { setSelectedId(null); setModalPayment(null); setModalTarget(null); setIsModalOpen(true); }}
                >
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Payment</span>
                </Button>
            )}
        </div>,
        [payments.length, priv.canImport, priv.canExport, priv.canAdd]
    );

    return (
        <div className="h-full flex flex-col min-h-0 py-4 sm:py-6">
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

            <div className="flex flex-1 gap-6 items-start flex-col">

                <div className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden flex flex-col min-w-0 min-h-[400px]">
                    <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                Payment Entries
                            </h3>
                            <Badge variant="secondary" className="ml-2 font-mono rounded-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">{payments.length}</Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={cn(
                              "flex-col sm:flex-row items-end sm:items-center gap-4",
                              showFilters ? "flex" : "hidden sm:flex"
                          )}>
                              {/* Filter input */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:border-r border-slate-200 dark:border-slate-800 sm:pr-4 w-full sm:w-auto">
                                  <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[32px]">From</span>
                                    <Input 
                                        type="month" 
                                        value={filterFromMonth} 
                                        onChange={(e) => setFilterFromMonth(e.target.value)} 
                                        className="h-8 flex-1 sm:w-36 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded-sm" 
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[32px]">To</span>
                                    <Input 
                                        type="month" 
                                        value={filterToMonth} 
                                        onChange={(e) => setFilterToMonth(e.target.value)} 
                                        className="h-8 flex-1 sm:w-36 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded-sm" 
                                    />
                                  </div>
                                  {(filterFromMonth || filterToMonth) && (
                                      <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-red-500 gap-1 w-full sm:w-auto" onClick={() => { setFilterFromMonth(''); setFilterToMonth(''); }} title="Clear filter">
                                          <X className="h-3.5 w-3.5"/>
                                          <span className="sm:hidden">Clear Filters</span>
                                      </Button>
                                  )}
                              </div>

                              {/* Toggle for Actions Column */}
                              <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto py-2 sm:py-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Show Actions</span>
                                  <button
                                      onClick={() => setShowActions(!showActions)}
                                      className={`group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none`}
                                  >
                                      <span className={`absolute h-4 w-9 rounded-full transition-colors duration-200 ease-in-out ${showActions ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                      <span
                                          className={`absolute left-0 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showActions ? 'translate-x-5' : 'translate-x-0.5'}`}
                                      />
                                  </button>
                              </div>
                          </div>
                          <div className="sm:hidden">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setShowFilters(!showFilters)}
                              className={cn(
                                "h-9 w-9 rounded-md border transition-all",
                                showFilters ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                              )}
                            >
                              <Plus className={cn("h-4 w-4 transition-transform", showFilters && "rotate-45")} />
                            </Button>
                          </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto [scrollbar-gutter:stable] max-h-[calc(100vh-220px)] relative">
                        <style>{`
                            .overflow-x-auto {
                                scrollbar-width: thin;
                                scrollbar-color: #2563eb #f1f5f9;
                            }
                            .overflow-x-auto::-webkit-scrollbar {
                                height: 8px;
                                display: block !important;
                            }
                            .overflow-x-auto::-webkit-scrollbar-track {
                                background: #f1f5f9;
                                border-radius: 4px;
                            }
                            .overflow-x-auto::-webkit-scrollbar-thumb {
                                background-color: #2563eb;
                                border-radius: 4px;
                            }
                            .overflow-x-auto::-webkit-scrollbar-thumb:hover {
                                background-color: #1d4ed8;
                            }
                        `}</style>
                        
                        {/* MOBILE CARDS */}
                        <div className="md:hidden flex flex-col p-4 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Total Sums</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-700 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">Amount</p>
                                    <p className="text-[11px] sm:text-xs font-mono font-bold text-slate-800 dark:text-slate-200 break-all" title={'₦' + formatSum(tableSums.amount)}>₦{formatSum(tableSums.amount)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-700 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">VAT</p>
                                    <p className="text-[11px] sm:text-xs font-mono font-bold text-blue-600 break-all" title={'₦' + formatSum(tableSums.vat)}>₦{formatSum(tableSums.vat)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-700 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">Amt For VAT</p>
                                    <p className="text-[11px] sm:text-xs font-mono font-bold text-emerald-600 break-all" title={'₦' + formatSum(tableSums.amtForVat)}>₦{formatSum(tableSums.amtForVat)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-700 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">WHT</p>
                                    <p className="text-[11px] sm:text-xs font-mono font-bold text-slate-600 dark:text-slate-300 break-all" title={'₦' + formatSum(tableSums.wht)}>₦{formatSum(tableSums.wht)}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-sm border border-slate-200 dark:border-slate-700 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">Damages</p>
                                    <p className="text-[11px] sm:text-xs font-mono font-bold text-rose-600 break-all" title={'₦' + formatSum(tableSums.damages)}>₦{formatSum(tableSums.damages)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 px-4">
                            {sortedPayments.map((p: Payment) => {
                                const vat = p.vat !== undefined && p.vat !== null ? p.vat : getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0).vat;
                                const amountForVat = p.amountForVat !== undefined && p.amountForVat !== null ? p.amountForVat : getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0).amountForVat;
                                return (
                                <div key={p.id} className="py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{p.client}</h3>
                                            <p className="text-xs text-slate-500">
                                                {p.site} | {formatDisplayDate(p.date)}
                                                {p.paidTo ? <span className="text-blue-600 font-medium"> • Paid To: {p.paidTo}</span> : null}
                                            </p>
                                        </div>
                                        <div className="text-right ml-4 shrink-0">
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Amount</p>
                                            <p className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">₦{priv?.canViewAmounts === false ? '***' : (p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        <Badge variant={p.payVat === 'Yes' ? 'default' : p.payVat === 'Add' ? 'outline' : 'secondary'} className={`text-[10px] rounded-sm ${p.payVat === 'Yes' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' : ''}`}>
                                            VAT: {p.payVat || 'No'}
                                        </Badge>
                                        <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-sm px-1.5 py-0.5 text-blue-700 dark:text-blue-300 font-mono">VAT Amt: ₦{priv?.canViewAmounts === false ? '***' : vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-sm px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300 font-mono">Amt For VAT: ₦{priv?.canViewAmounts === false ? '***' : amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        {p.damages ? <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-sm px-1.5 py-0.5 text-rose-700 dark:text-rose-300 font-mono">Damages: ₦{priv?.canViewAmounts === false ? '***' : p.damages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : null}
                                    </div>
                                    {showActions && (
                                        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                                            {priv.canEdit && (
                                              <Button variant="outline" size="sm" onClick={() => handleEdit(p)} className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 text-xs rounded-sm border-slate-200 dark:border-slate-700">
                                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                              </Button>
                                            )}
                                            {priv.canDelete && (
                                              <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)} className="h-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 text-xs rounded-sm border-slate-200 dark:border-slate-700">
                                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                              </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )})}
                            {sortedPayments.length === 0 && (
                                <div className="py-8 text-center text-slate-500 text-sm">
                                    No payment records found.
                                </div>
                            )}
                        </div>

                        <Table className="hidden md:table whitespace-nowrap min-w-full text-sm">
                            <TableHeader className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-20">
                                <TableRow className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                    <TableHead colSpan={3} className="px-5 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-blue-600 rounded-sm"></div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">Total Sums</span>
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-700 inline-block">
                                            WHT: ₦{formatSum(tableSums.wht)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-blue-200 dark:border-blue-800 inline-block">
                                            VAT: ₦{formatSum(tableSums.vat)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[13px] font-mono font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-sm border border-slate-200 dark:border-slate-700 inline-block shadow-sm">
                                            ₦{formatSum(tableSums.amount)}
                                        </div>
                                    </TableHead>
                                    {showActions && <TableHead className="sticky right-0 bg-slate-100/80 dark:bg-slate-800/80 p-0 w-14" />}
                                </TableRow>
                                <TableRow className="border-b-0">
                                    {([
                                        { field: 'date',           label: 'Date / Inv #',    align: 'left'   },
                                        { field: 'client',         label: 'Client & Site',   align: 'left'   },
                                        { field: 'paidTo',         label: 'Paid To',         align: 'left'   },
                                        { field: 'withholdingTax', label: 'Deductions (₦)',  align: 'right'  },
                                        { field: 'vat',            label: 'VAT (₦)',         align: 'right'  },
                                        { field: 'amount',         label: 'Amount Paid (₦)', align: 'right'  },
                                    ] as const).map(({ field, label, align }) => (
                                        <TableHead
                                            key={field}
                                            className={`font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none text-${align} cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors`}
                                            onClick={() => handleSort(field)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                                {label} <SortIcon field={field} />
                                            </div>
                                        </TableHead>
                                    ))}
                                    {showActions && (
                                        <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-slate-50 dark:bg-slate-800 uppercase text-[10px] tracking-wider w-14">Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPayments.map((p: Payment) => {
                                    const vat = p.vat !== undefined && p.vat !== null ? p.vat : getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0).vat;
                                    const hasDeductions = Boolean((p.withholdingTax || 0) > 0 || (p.discount || 0) > 0 || (p.damages || 0) > 0);
                                    const grossAmount = (p.amount || 0) + (p.withholdingTax || 0) + (p.discount || 0);

                                    return (
                                        <TableRow key={p.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${selectedId === p.id ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                                            {/* Date & Invoice badge */}
                                            <TableCell className="px-4 py-3">
                                                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {formatDisplayDate(p.date)}
                                                </div>
                                                <div className="mt-1">
                                                    {p.allocations && p.allocations.length > 1 ? (
                                                        <span
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-help"
                                                            title={p.allocations.map(a => `${a.invoiceNumber || a.invoiceId}: ₦${(a.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`).join(', ')}
                                                        >
                                                            {p.allocations.length} Invoices
                                                        </span>
                                                    ) : ((p.allocations && p.allocations.length === 1 && p.allocations[0].invoiceNumber) || p.invoiceNumber) ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            #{(p.allocations && p.allocations[0]?.invoiceNumber) || p.invoiceNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[10px]">Unallocated</span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Client & Site */}
                                            <TableCell className="px-4 py-3">
                                                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                                                    {p.client}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {p.site}
                                                </div>
                                            </TableCell>

                                            {/* Paid To */}
                                            <TableCell className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {p.paidTo ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                        {p.paidTo}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </TableCell>

                                            {/* Deductions (WHT, Discount, Damages) */}
                                            <TableCell className="px-4 py-3 text-right font-mono text-xs">
                                                {hasDeductions ? (
                                                    <div className="space-y-0.5">
                                                        {Boolean(p.withholdingTax) && (
                                                            <div className="text-slate-600 dark:text-slate-300">
                                                                <span className="text-slate-400 text-[10px] font-sans">WHT:</span> ₦{p.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                        {Boolean(p.discount) && (
                                                            <div className="text-slate-600 dark:text-slate-300">
                                                                <span className="text-slate-400 text-[10px] font-sans">Disc:</span> ₦{p.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                        {Boolean(p.damages) && (
                                                            <div className="text-rose-600 dark:text-rose-400 font-medium">
                                                                <span className="text-rose-400 text-[10px] font-sans">Dam:</span> ₦{p.damages.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </TableCell>

                                            {/* VAT Details */}
                                            <TableCell className="px-4 py-3 text-right font-mono text-xs">
                                                {priv?.canViewAmounts === false ? '***' : (
                                                    <div>
                                                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                                                            {vat > 0 ? `₦${vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                                                            <span className="text-[9px] uppercase tracking-tight text-slate-400">Pol:</span>
                                                            <Badge variant={p.payVat === 'Yes' ? 'default' : p.payVat === 'Add' ? 'outline' : 'secondary'} className="text-[9px] px-1 py-0 rounded-sm">
                                                                {p.payVat || 'No'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Amount Paid (₦) */}
                                            <TableCell className="px-4 py-3 text-right font-mono">
                                                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    {priv?.canViewAmounts === false ? '***' : `₦${(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                                </div>
                                                {hasDeductions && priv?.canViewAmounts !== false && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Gross: ₦{grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Actions */}
                                            {showActions && (
                                                <TableCell className="px-3 py-2.5 text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur w-14">
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm"
                                                                    title="Actions"
                                                                >
                                                                    <MoreVertical className="w-4 h-4" />
                                                                    <span className="sr-only">Actions</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-md p-1 z-50">
                                                                {priv.canEdit && (
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEdit(p);
                                                                        }}
                                                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded-sm"
                                                                    >
                                                                        <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                                        <span>Edit Payment</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {priv.canDelete && (
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(p.id);
                                                                        }}
                                                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer rounded-sm"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                                                        <span>Delete Payment</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                                {sortedPayments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showActions ? 7 : 6} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide border-b-0">
                                            No payment records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <PaymentFormModal
                open={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedId(null); setModalPayment(null); setModalTarget(null); }}
                selectedId={selectedId}
                initialPayment={modalPayment}
                targetInvoice={modalTarget}
            />


            {/* Import Modal Options */}
            {importFile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportFile(null)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-md shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Import Policy</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">
                            How would you like to process the payment records from this CSV file?
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button onClick={() => processImport(importFile, 'update')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm h-auto py-3 flex-col items-center justify-center">
                                <span className="font-semibold block text-sm">Update & Add (Recommended)</span>
                                <span className="block text-xs opacity-80 mt-1 font-normal text-center">Modifies matching IDs. Adds missing ones. Leaves others alone.</span>
                            </Button>
                            <Button onClick={() => processImport(importFile, 'append')} variant="outline" className="border-slate-200 dark:border-slate-800 rounded-sm h-auto py-3 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex-col items-center justify-center">
                                <span className="font-semibold block text-sm">Append Only</span>
                                <span className="block text-xs text-slate-500 mt-1 font-normal text-center">Adds every row as a brand new record, completely ignoring current IDs.</span>
                            </Button>
                            <Button onClick={() => processImport(importFile, 'replace')} variant="outline" className="border-rose-200 dark:border-rose-900/40 rounded-sm h-auto py-3 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex-col items-center justify-center">
                                <span className="font-semibold block text-sm">Replace Entire List</span>
                                <span className="block text-xs text-rose-500/80 mt-1 font-normal text-center">Deletes current records that are NOT in this CSV. Updates matches. Adds new ones.</span>
                            </Button>
                            <Button onClick={() => setImportFile(null)} variant="ghost" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-sm mt-2">
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

