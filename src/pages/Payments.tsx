import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showActions, setShowActions] = useState(false);
    const [sortField, setSortField] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterFromMonth, setFilterFromMonth] = useState<string>('');
    const [filterToMonth, setFilterToMonth] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterAllocBySite, setFilterAllocBySite] = useState(false);

    const initialForm = {
        date: '',
        client: '',
        site: '',
        amount: '',
        withholdingTax: '',
        discount: '',
        damages: '',
        paidTo: '',
        invoiceId: '',
        invoiceNumber: '',
        allocationMode: 'single' as 'single' | 'multi',
        allocations: {} as Record<string, { amount: string; withholdingTax: string; discount: string }>,
    };
    const [form, setForm] = useState(initialForm);

    // Auto-open modal when triggered from an invoice row
    useEffect(() => {
        if (activePaymentModalTarget) {
            setSelectedId(null);
            const invId = activePaymentModalTarget.invoiceId || '';
            const invNum = activePaymentModalTarget.invoiceNumber || '';
            const amtStr = activePaymentModalTarget.amount ? String(activePaymentModalTarget.amount) : '';
            const allocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};
            if (invId) {
                allocMap[invId] = { amount: amtStr, withholdingTax: '', discount: '' };
            }
            setForm({
                date: new Date().toISOString().split('T')[0],
                client: activePaymentModalTarget.client,
                site: activePaymentModalTarget.site,
                amount: amtStr,
                withholdingTax: '',
                discount: '',
                damages: '',
                paidTo: '',
                invoiceId: invId,
                invoiceNumber: invNum,
                allocationMode: 'single',
                allocations: allocMap,
            });
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

    const normStr = (s?: string) => (s || '').trim().toLowerCase();

    const getInvoiceSite = (inv: any) => {
        return (
            inv.siteName ||
            inv.site ||
            inv.project ||
            sites.find(s => s.id === inv.siteId)?.name ||
            ''
        ).trim();
    };

    const allInvoices = useMemo(() => [...invoices, ...pendingInvoices], [invoices, pendingInvoices]);

    // Settlement map excluding current payment when editing so its own allocation doesn't reduce remaining balance to 0
    const settlementPayments = useMemo(() => {
        if (!selectedId) return payments;
        return payments.filter(p => p.id !== selectedId);
    }, [payments, selectedId]);

    const settlementMap = useMemo(() => {
        return buildSettlementMap(allInvoices, settlementPayments);
    }, [allInvoices, settlementPayments]);

    const formatInvoice = (inv: Invoice | PendingInvoice) => {
        const id = inv.id;
        const invoiceNumber = (inv as any).invoiceNumber || (inv as any).invoiceNo || inv.id;
        const totalAmount = Number((inv as any).totalCharge || (inv as any).amount || 0);
        const settlement = settlementMap.get(id);
        const totalSettled = settlement ? settlement.totalSettled : 0;
        const remainingBalance = settlement ? settlement.remainingBalance : totalAmount;
        const status = settlement ? settlement.status : ((inv as any).status || 'Sent');
        const siteName = getInvoiceSite(inv);
        const client = ((inv as any).client || '').trim();
        const date = (inv as any).date || (inv as any).startDate || '';
        const dueDate = (inv as any).dueDate || (inv as any).endDate || '';

        return {
            id,
            invoiceNumber,
            client,
            siteName,
            totalAmount,
            totalSettled,
            remainingBalance,
            status,
            date,
            dueDate,
            vatInc: (inv as any).vatInc,
        };
    };

    // Invoices matching the selected client and/or site
    const clientInvoices = useMemo(() => {
        if (!form.client && !form.site) return [];
        const normClient = normStr(form.client);
        const normSite = normStr(form.site);

        return allInvoices
            .filter(i => {
                const iClient = normStr(i.client);
                const iSite = normStr(getInvoiceSite(i));

                const clientMatch = normClient && (
                    iClient === normClient ||
                    (normClient.length >= 3 && (iClient.startsWith(normClient) || normClient.startsWith(iClient)))
                );
                const siteMatch = normSite && (
                    iSite === normSite ||
                    (normSite.length >= 3 && (iSite.startsWith(normSite) || normSite.startsWith(iSite)))
                );

                if (normClient && normSite) return clientMatch || siteMatch;
                if (normClient) return clientMatch;
                if (normSite) return siteMatch;
                return false;
            })
            .map(formatInvoice);
    }, [allInvoices, form.client, form.site, settlementMap, sites]);

    // Ensure currently selected invoice is always in the available list
    const allAvailableInvoices = useMemo(() => {
        const list = [...clientInvoices];
        if (form.invoiceId && !list.some(i => i.id === form.invoiceId)) {
            const raw = allInvoices.find(i => i.id === form.invoiceId);
            if (raw) {
                list.unshift(formatInvoice(raw));
            }
        }
        return list;
    }, [clientInvoices, form.invoiceId, allInvoices, settlementMap, sites]);

    // Invoices matching the selected site
    const siteInvoices = useMemo(() => {
        if (!form.site) return allAvailableInvoices;
        const normSite = normStr(form.site);
        return allAvailableInvoices.filter(i => {
            const iSite = normStr(i.siteName);
            return iSite === normSite || (normSite.length >= 3 && (iSite.startsWith(normSite) || normSite.startsWith(iSite)));
        });
    }, [allAvailableInvoices, form.site]);

    // Invoices for this client from other sites (or unassigned site)
    const otherInvoices = useMemo(() => {
        if (!form.site) return [];
        const siteSet = new Set(siteInvoices.map(i => i.id));
        return allAvailableInvoices.filter(i => !siteSet.has(i.id));
    }, [allAvailableInvoices, siteInvoices, form.site]);

    // For backwards compatibility and detail rendering
    const availableInvoices = allAvailableInvoices;

    const selectedInvoiceDetails = useMemo(() => {
        if (!form.invoiceId) return null;
        return allAvailableInvoices.find(i => i.id === form.invoiceId) || null;
    }, [form.invoiceId, allAvailableInvoices]);

    const allocInvoices = useMemo(() => {
        if (filterAllocBySite && form.site) {
            return siteInvoices;
        }
        return allAvailableInvoices;
    }, [filterAllocBySite, form.site, siteInvoices, allAvailableInvoices]);

    const allocationSummary = useMemo(() => {
        const paymentAmount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
        let totalCashAllocated = 0;
        let totalWhtAllocated = 0;
        let totalDiscountAllocated = 0;
        let allocatedInvoicesCount = 0;

        if (form.allocationMode === 'multi') {
            Object.values(form.allocations).forEach(item => {
                const c = parseFloat(String(item.amount || '').replace(/,/g, '')) || 0;
                const w = parseFloat(String(item.withholdingTax || '').replace(/,/g, '')) || 0;
                const d = parseFloat(String(item.discount || '').replace(/,/g, '')) || 0;
                if (c > 0 || w > 0 || d > 0) {
                    totalCashAllocated += c;
                    totalWhtAllocated += w;
                    totalDiscountAllocated += d;
                    allocatedInvoicesCount++;
                }
            });
        } else if (form.invoiceId) {
            totalCashAllocated = paymentAmount;
            totalWhtAllocated = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
            totalDiscountAllocated = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
            allocatedInvoicesCount = 1;
        }

        const unappliedCash = Math.round((paymentAmount - totalCashAllocated) * 100) / 100;
        const isOverallocated = unappliedCash < -0.01;
        const isFullyAllocated = Math.abs(unappliedCash) <= 0.01 && paymentAmount > 0;
        const isPartiallyAllocated = unappliedCash > 0.01 && totalCashAllocated > 0;

        return {
            paymentAmount,
            totalCashAllocated,
            totalWhtAllocated,
            totalDiscountAllocated,
            unappliedCash,
            allocatedInvoicesCount,
            isOverallocated,
            isFullyAllocated,
            isPartiallyAllocated,
        };
    }, [form.amount, form.allocationMode, form.allocations, form.invoiceId, form.withholdingTax, form.discount]);

    const handleInvoiceSelected = (invId: string) => {
        if (!invId) {
            setForm(prev => ({
                ...prev,
                invoiceId: '',
                invoiceNumber: '',
                allocations: {},
            }));
            return;
        }
        const selectedInv = allAvailableInvoices.find(i => i.id === invId);
        if (selectedInv) {
            setForm(prev => {
                const nextSite = selectedInv.siteName || prev.site;
                const currentAmt = parseFloat(String(prev.amount).replace(/,/g, '')) || 0;
                const nextAmt = currentAmt === 0
                    ? String(selectedInv.remainingBalance > 0 ? selectedInv.remainingBalance : selectedInv.totalAmount)
                    : prev.amount;
                return {
                    ...prev,
                    invoiceId: selectedInv.id,
                    invoiceNumber: selectedInv.invoiceNumber,
                    site: nextSite,
                    amount: nextAmt,
                    allocations: {
                        [selectedInv.id]: {
                            amount: nextAmt,
                            withholdingTax: prev.withholdingTax,
                            discount: prev.discount,
                        }
                    }
                };
            });
        }
    };

    const handleAutoAllocateFIFO = () => {
        const grossCash = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
        if (grossCash <= 0) {
            toast.error('Please enter a total payment amount first.');
            return;
        }

        let remainingCash = grossCash;
        const newAllocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};
        let allocatedCount = 0;

        // Sort open invoices with positive balance by date ascending (FIFO)
        const openInvs = [...allocInvoices]
            .filter(i => i.remainingBalance > 0.01)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        openInvs.forEach(inv => {
            if (remainingCash <= 0) return;
            const take = Math.min(remainingCash, inv.remainingBalance);
            const roundedTake = Math.round(take * 100) / 100;
            if (roundedTake > 0) {
                newAllocMap[inv.id] = {
                    amount: String(roundedTake),
                    withholdingTax: '',
                    discount: '',
                };
                remainingCash = Math.round((remainingCash - roundedTake) * 100) / 100;
                allocatedCount++;
            }
        });

        setForm(prev => ({
            ...prev,
            allocations: newAllocMap,
        }));

        if (allocatedCount > 0) {
            toast.success(`Auto-allocated across ${allocatedCount} invoice(s). Remaining unapplied: ₦${Math.max(0, remainingCash).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        } else {
            toast.info('No open invoices with outstanding balance found to allocate.');
        }
    };

    const handleClearAllAllocations = () => {
        setForm(prev => ({ ...prev, allocations: {} }));
        toast.info('All invoice allocations cleared.');
    };

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleClear = () => {
        setForm(initialForm);
        setSelectedId(null);
    };

    const livePreview = useMemo(() => {
        const amount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
        const damages = parseFloat(String(form.damages).replace(/,/g, '')) || 0;
        const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
        const payVat = selectedInvoiceDetails?.vatInc || (siteObj ? siteObj.vat : 'No');

        const { vat, amountForVat } = getVatDetails(amount, payVat, vatRate, damages);

        return { amount, vat, payVat, amountForVat, damages };
    }, [form.amount, form.site, form.client, form.damages, sites, vatRate, selectedInvoiceDetails]);

    const calculatePayment = (): Omit<Payment, 'id'> | null => {
        if (!form.date || !form.client || !form.site) {
            toast.error('Date, Client, and Site are required.');
            return null;
        }

        const amount = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
        const withholdingTax = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
        const discount = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
        const damages = parseFloat(String(form.damages).replace(/,/g, '')) || 0;
        
        const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
        const payVat = (selectedInvoiceDetails?.vatInc || (siteObj ? siteObj.vat : 'No')) as any;

        let allocations: PaymentAllocation[] = [];
        let invoiceId: string | undefined = undefined;
        let invoiceNumber: string | undefined = undefined;
        let unappliedAmount: number = 0;

        if (form.allocationMode === 'multi') {
            let totalAllocCash = 0;
            Object.entries(form.allocations).forEach(([invId, data]) => {
                const aAmt = parseFloat(String(data.amount || '').replace(/,/g, '')) || 0;
                const aWht = parseFloat(String(data.withholdingTax || '').replace(/,/g, '')) || 0;
                const aDisc = parseFloat(String(data.discount || '').replace(/,/g, '')) || 0;
                if (aAmt > 0 || aWht > 0 || aDisc > 0) {
                    totalAllocCash += aAmt;
                    const invObj = allAvailableInvoices.find(i => i.id === invId) || allInvoices.find(i => i.id === invId);
                    const invNum = invObj ? ((invObj as any).invoiceNumber || (invObj as any).invoiceNo || invId) : invId;
                    allocations.push({
                        invoiceId: invId,
                        invoiceNumber: invNum,
                        amount: aAmt,
                        withholdingTax: aWht > 0 ? aWht : undefined,
                        discount: aDisc > 0 ? aDisc : undefined,
                    });
                }
            });

            if (allocations.length === 1) {
                invoiceId = allocations[0].invoiceId;
                invoiceNumber = allocations[0].invoiceNumber;
            } else if (allocations.length > 1) {
                invoiceNumber = `${allocations.length} Invoices`;
            }

            unappliedAmount = Math.max(0, Math.round((amount - totalAllocCash) * 100) / 100);
        } else {
            // Single invoice mode
            if (form.invoiceId) {
                invoiceId = form.invoiceId;
                invoiceNumber = form.invoiceNumber;
                allocations = [{
                    invoiceId: form.invoiceId,
                    invoiceNumber: form.invoiceNumber,
                    amount: amount,
                    withholdingTax: withholdingTax > 0 ? withholdingTax : undefined,
                    discount: discount > 0 ? discount : undefined,
                }];
                unappliedAmount = 0;
            } else {
                // General advance / unallocated
                unappliedAmount = amount;
            }
        }

        return {
            client: form.client,
            site: form.site,
            date: formatDisplayDate(form.date),
            amount,
            withholdingTax,
            discount,
            damages,
            payVat,
            paidTo: form.paidTo || undefined,
            invoiceId,
            invoiceNumber,
            allocations,
            unappliedAmount,
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
        const isMulti = Boolean(pay.allocations && pay.allocations.length > 1);
        const allocMap: Record<string, { amount: string; withholdingTax: string; discount: string }> = {};

        if (pay.allocations && pay.allocations.length > 0) {
            pay.allocations.forEach(a => {
                allocMap[a.invoiceId] = {
                    amount: a.amount ? String(a.amount) : '',
                    withholdingTax: a.withholdingTax ? String(a.withholdingTax) : '',
                    discount: a.discount ? String(a.discount) : '',
                };
            });
        } else if (pay.invoiceId) {
            allocMap[pay.invoiceId] = {
                amount: pay.amount ? String(pay.amount) : '',
                withholdingTax: pay.withholdingTax ? String(pay.withholdingTax) : '',
                discount: pay.discount ? String(pay.discount) : '',
            };
        }

        setForm({
            date: normalizeDate(pay.date),
            client: pay.client,
            site: pay.site,
            amount: pay.amount.toString(),
            withholdingTax: pay.withholdingTax ? pay.withholdingTax.toString() : '',
            discount: pay.discount ? pay.discount.toString() : '',
            damages: pay.damages ? pay.damages.toString() : '',
            paidTo: pay.paidTo || '',
            invoiceId: pay.invoiceId || (pay.allocations && pay.allocations.length === 1 ? pay.allocations[0].invoiceId : ''),
            invoiceNumber: pay.invoiceNumber || (pay.allocations && pay.allocations.length === 1 ? pay.allocations[0].invoiceNumber || '' : ''),
            allocationMode: isMulti ? 'multi' : 'single',
            allocations: allocMap,
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
                const { vat, amountForVat: amtForVat } = getVatDetails(pay.amount || 0, pay.payVat, vatRate, pay.damages || 0);
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

    const uniqueClients = useMemo(() => {
        const set = new Set<string>();
        sites.forEach(s => s.client && set.add(s.client.trim()));
        pendingSites.forEach(ps => ps.clientName && set.add(ps.clientName.trim()));
        clientProfiles.forEach(cp => cp.name && set.add(cp.name.trim()));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [sites, pendingSites, clientProfiles]);

    const sitesForClient = useMemo(() => {
        if (!form.client) return [];
        const normC = normStr(form.client);
        const list: { name: string; vat?: string }[] = [];
        sites.forEach(s => {
            if (normStr(s.client) === normC && s.name) list.push({ name: s.name, vat: s.vat });
        });
        pendingSites.forEach(ps => {
            if (normStr(ps.clientName) === normC && ps.siteName) {
                const v = ps.phase4?.clientTaxStatus?.includes('Add') ? 'Add' : ps.phase4?.clientTaxStatus?.includes('Yes') ? 'Yes' : 'No';
                if (!list.some(x => normStr(x.name) === normStr(ps.siteName))) {
                    list.push({ name: ps.siteName, vat: v });
                }
            }
        });
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [sites, pendingSites, form.client]);

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
            // LIVE VAT CALCULATION
            const { vat, amountForVat: amtForVat } = getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0);

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
                    onClick={() => { handleClear(); setIsModalOpen(true); }}
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
                                const { vat, amountForVat } = getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0);
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
                                    <TableHead colSpan={4} className="px-6 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-blue-600 rounded-sm"></div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">Total Sums</span>
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5" />
                                    <TableHead className="px-4 py-2.5" />
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-700 inline-block">
                                            ₦{formatSum(tableSums.amount)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-700 inline-block">
                                            ₦{formatSum(tableSums.wht)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-200 dark:border-slate-700 inline-block">
                                            ₦{formatSum(tableSums.discount)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-rose-600 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-rose-200 dark:border-rose-800 inline-block">
                                            ₦{formatSum(tableSums.damages)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-center"></TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-bold text-blue-600 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-blue-200 dark:border-blue-800 inline-block">
                                            ₦{formatSum(tableSums.vat)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="px-4 py-2.5 text-right">
                                        <div className="text-[12px] font-mono font-bold text-emerald-600 bg-white dark:bg-slate-800 px-2 py-1 rounded-sm border border-emerald-200 dark:border-emerald-800 inline-block">
                                            ₦{formatSum(tableSums.amtForVat)}
                                        </div>
                                    </TableHead>
                                    {showActions && <TableHead className="sticky right-0 bg-slate-100/80 dark:bg-slate-800/80 p-0 w-14" />}
                                </TableRow>
                                <TableRow className="border-b-0">
                                    {([
                                        { field: 'date',           label: 'Date',        align: 'left'   },
                                        { field: 'client',         label: 'Client',      align: 'left'   },
                                        { field: 'tin',            label: 'TIN',         align: 'left'   },
                                        { field: 'site',           label: 'Site',        align: 'left'   },
                                        { field: 'invoiceNumber',  label: 'Invoice #',   align: 'left'   },
                                        { field: 'paidTo',         label: 'Paid To',     align: 'left'   },
                                        { field: 'amount',         label: 'Amount (₦)',  align: 'right'  },
                                        { field: 'withholdingTax', label: 'WHT',         align: 'right'  },
                                        { field: 'discount',       label: 'Discount',    align: 'right'  },
                                        { field: 'damages',        label: 'Damages',     align: 'right'  },
                                        { field: 'payVat',         label: 'VAT Policy',  align: 'center' },
                                        { field: 'vat',            label: 'VAT (₦)',     align: 'right'  },
                                        { field: 'amountForVat',   label: 'Amt For VAT', align: 'right'  },
                                    ] as const).map(({ field, label, align }) => (
                                        <TableHead
                                            key={field}
                                            className={`font-semibold px-4 py-3 text-slate-500 uppercase text-[10px] tracking-wider select-none text-${align} cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors`}
                                            onClick={() => handleSort(field)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
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
                                {sortedPayments.map((p: Payment) => (
                                    <TableRow key={p.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${selectedId === p.id ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                                        <TableCell className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{formatDisplayDate(p.date)}</TableCell>
                                        <TableCell className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{p.client}</TableCell>
                                        <TableCell className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                            {getTinForClient(p.client) || <span className="text-slate-300 dark:text-slate-600">—</span>}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.site}</TableCell>
                                        <TableCell className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">
                                            {p.allocations && p.allocations.length > 1 ? (
                                                <span
                                                    className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-help"
                                                    title={p.allocations.map(a => `${a.invoiceNumber || a.invoiceId}: ₦${(a.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`).join(', ')}
                                                >
                                                    {p.allocations.length} Invoices
                                                </span>
                                            ) : ((p.allocations && p.allocations.length === 1 && p.allocations[0].invoiceNumber) || p.invoiceNumber) ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    {(p.allocations && p.allocations[0]?.invoiceNumber) || p.invoiceNumber}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic text-[11px]">Unallocated</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                            {p.paidTo ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    {p.paidTo}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                            {priv?.canViewAmounts === false ? '***' : (p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono">
                                            {p.withholdingTax ? p.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono">
                                            {p.discount ? p.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-rose-500 font-mono">
                                            {p.damages ? p.damages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center text-xs">
                                            <Badge variant={p.payVat === 'Yes' ? 'default' : p.payVat === 'Add' ? 'outline' : 'secondary'} className={`rounded-sm ${p.payVat === 'Yes' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' : ''}`}>
                                                {p.payVat || 'No'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-blue-600 font-mono font-medium">
                                            {priv?.canViewAmounts === false ? '***' : (() => {
                                                const { vat } = getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0);
                                                return vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-emerald-600 font-mono font-medium">
                                            {priv?.canViewAmounts === false ? '***' : (() => {
                                                const { amountForVat } = getVatDetails(p.amount || 0, p.payVat, vatRate, p.damages || 0);
                                                return amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                        </TableCell>
                                        {showActions && (
                                            <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur w-14">
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
                                                                <>
                                                                    <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(p.id);
                                                                        }}
                                                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer rounded-sm focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                                        <span>Delete</span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                                {sortedPayments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showActions ? 13 : 12} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide border-b-0">
                                            No payment records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[99] bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col w-full h-full animate-in fade-in duration-200">
                    {/* Page header — fixed top bar */}
                    <div className="shrink-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 md:px-8 py-2.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 -ml-1 shrink-0 transition-colors font-semibold"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Back to Payments</span>
                                </Button>
                                <div className="h-4 w-px bg-slate-300 dark:bg-slate-800" />
                                <div>
                                    <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none">
                                        {selectedId ? 'Edit Payment' : 'Record New Payment'}
                                    </h2>
                                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                                        Record client remittance, allocate across single or multiple invoices, and sync settlement status.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                {/* Allocation Mode Selector */}
                                <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-sm border border-slate-300/80 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, allocationMode: 'single' }))}
                                        className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-xs transition-all flex items-center gap-1.5",
                                            form.allocationMode === 'single'
                                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <FileText className="w-3 h-3" />
                                        <span>Single Invoice</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, allocationMode: 'multi' }))}
                                        className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-xs transition-all flex items-center gap-1.5",
                                            form.allocationMode === 'multi'
                                                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <Split className="w-3 h-3" />
                                        <span>Split Across Invoices</span>
                                        {allocationSummary.allocatedInvoicesCount > 1 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                                                {allocationSummary.allocatedInvoicesCount}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-8 text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSubmit}
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{selectedId ? 'Update Payment' : 'Save Payment'}</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable body with 2 columns */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-5 flex flex-col gap-6">
                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
                            {/* Main Form Left Column */}
                            <div className="space-y-6">
                                {/* Card 1: Remittance Info */}
                                <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                                    <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-sm text-emerald-600 dark:text-emerald-400">
                                            <CreditCard className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Remittance &amp; Account Details</h3>
                                            <p className="text-[10px] text-slate-400">Payment date, client entity, site location, amount, and company bank account.</p>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Date</label>
                                                <Input
                                                    type="date"
                                                    value={form.date}
                                                    onChange={e => handleChange('date', e.target.value)}
                                                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 rounded-sm"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Received Amount (₦)</label>
                                                <NumericFormat
                                                    customInput={Input}
                                                    thousandSeparator
                                                    decimalScale={2}
                                                    placeholder="0.00"
                                                    value={form.amount}
                                                    onValueChange={(v) => handleChange('amount', v.value || '')}
                                                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums font-bold text-base text-emerald-600 dark:text-emerald-400 h-10 rounded-sm"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Received Into (Company Account)</label>
                                                <select
                                                    value={form.paidTo}
                                                    onChange={e => handleChange('paidTo', e.target.value)}
                                                    className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                                                >
                                                    <option value="">Select Receiving Account...</option>
                                                    {sortedBanks.map(b => (
                                                        <option key={b.id} value={b.name}>{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client Account</label>
                                                <select
                                                    value={form.client}
                                                    onChange={e => {
                                                        const newClient = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            client: newClient,
                                                            site: '',
                                                            invoiceId: '',
                                                            invoiceNumber: '',
                                                            allocations: {},
                                                        }));
                                                    }}
                                                    className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    <option value="">Select Client...</option>
                                                    {uniqueClients.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Site Location</label>
                                                    {form.client && (
                                                        <span className="text-[11px] text-slate-400">
                                                            {sitesForClient.length} registered site(s)
                                                        </span>
                                                    )}
                                                </div>
                                                <select
                                                    value={form.site}
                                                    onChange={e => {
                                                        const newSite = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            site: newSite,
                                                        }));
                                                    }}
                                                    disabled={!form.client}
                                                    className="flex h-10 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                                                >
                                                    <option value="">Select Site (or All Sites for {form.client || 'Client'})...</option>
                                                    {sitesForClient.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Invoice Allocation */}
                                <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                                    <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-sm text-blue-600 dark:text-blue-400">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                                                    {form.allocationMode === 'multi' ? 'Split Allocation Across Invoices' : 'Apply to Single Invoice'}
                                                </h3>
                                                <p className="text-[10px] text-slate-400">
                                                    {form.allocationMode === 'multi'
                                                        ? 'Allocate payment amounts directly to specific open invoices with automatic balance reconciliation.'
                                                        : 'Choose an invoice to link this payment directly, or leave unallocated as an advance deposit.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Batch Tools for Multi-allocation */}
                                        <div className="flex items-center gap-2">
                                            {form.allocationMode === 'multi' && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleAutoAllocateFIFO}
                                                        className="h-8 text-xs font-semibold gap-1.5 border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                                        title="Automatically allocates payment to oldest open invoices first"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        <span>Auto-Allocate (FIFO)</span>
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleClearAllAllocations}
                                                        className="h-8 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                                    >
                                                        Clear All
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        {form.allocationMode === 'single' ? (
                                            /* SINGLE INVOICE SELECTION */
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Invoice</label>
                                                        {(form.client || form.site) && (
                                                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                                                                {form.site
                                                                    ? `${siteInvoices.length} on site${otherInvoices.length > 0 ? ` (+${otherInvoices.length} other)` : ''}`
                                                                    : `${clientInvoices.length} invoice${clientInvoices.length !== 1 ? 's' : ''} found`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <select
                                                        value={form.invoiceId}
                                                        onChange={e => handleInvoiceSelected(e.target.value)}
                                                        disabled={!form.client && !form.site}
                                                        className="flex h-11 w-full rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                                                    >
                                                        <option value="">General Deposit / Advance (Unallocated)</option>
                                                        {form.site ? (
                                                            <>
                                                                {siteInvoices.length > 0 && (
                                                                    <optgroup label={`${form.site} Invoices (${siteInvoices.length})`}>
                                                                        {siteInvoices.map(inv => (
                                                                            <option key={inv.id} value={inv.id}>
                                                                                {inv.invoiceNumber} — Billed: ₦{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Balance Due: ₦{inv.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}) [{inv.status}]
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                                {otherInvoices.length > 0 && (
                                                                    <optgroup label={`Other Sites for ${form.client || 'Client'} (${otherInvoices.length})`}>
                                                                        {otherInvoices.map(inv => (
                                                                            <option key={inv.id} value={inv.id}>
                                                                                {inv.invoiceNumber} — Billed: ₦{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Balance Due: ₦{inv.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}) [{inv.status}] • [{inv.siteName || 'Unassigned'}]
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </>
                                                        ) : (
                                                            clientInvoices.map(inv => (
                                                                <option key={inv.id} value={inv.id}>
                                                                    {inv.invoiceNumber} — Billed: ₦{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Balance Due: ₦{inv.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}) [{inv.status}]{inv.siteName ? ` • [${inv.siteName}]` : ''}
                                                                </option>
                                                            ))
                                                        )}
                                                    </select>
                                                </div>

                                                {selectedInvoiceDetails && (
                                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-sm space-y-2">
                                                        <div className="flex flex-wrap justify-between items-center text-sm gap-2">
                                                            <span className="text-slate-700 dark:text-slate-300">
                                                                Invoice: <strong className="font-mono text-slate-900 dark:text-white">{selectedInvoiceDetails.invoiceNumber}</strong>
                                                                {selectedInvoiceDetails.siteName && (
                                                                    <span className="text-xs text-slate-500 ml-2">({selectedInvoiceDetails.siteName})</span>
                                                                )}
                                                            </span>
                                                            <div className="flex items-center gap-4 text-xs">
                                                                <span>Billed: <strong className="font-mono">₦{selectedInvoiceDetails.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                                                                <span>Remaining: <strong className="font-mono text-blue-600 dark:text-blue-400">₦{selectedInvoiceDetails.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                                                            </div>
                                                        </div>

                                                        {(() => {
                                                            const cash = parseFloat(String(form.amount).replace(/,/g, '')) || 0;
                                                            const wht = parseFloat(String(form.withholdingTax).replace(/,/g, '')) || 0;
                                                            const disc = parseFloat(String(form.discount).replace(/,/g, '')) || 0;
                                                            const totalApplied = cash + wht + disc;
                                                            const remAfter = Math.max(0, selectedInvoiceDetails.remainingBalance - totalApplied);
                                                            return (
                                                                <div className="flex flex-wrap justify-between items-center pt-2 border-t border-blue-100 dark:border-blue-900/30 text-xs gap-2">
                                                                    <span className="text-slate-600 dark:text-slate-400">
                                                                        Total Applied: <strong className="font-mono text-emerald-600 dark:text-emerald-400">₦{totalApplied.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                                                    </span>
                                                                    <Badge variant="outline" className={remAfter <= 0.01 ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"}>
                                                                        {remAfter <= 0.01 ? "✓ Clears in Full (Paid)" : `Remaining Balance: ₦${remAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                                                    </Badge>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                <div className="text-center pt-2">
                                                    <Button
                                                        type="button"
                                                        variant="link"
                                                        onClick={() => setForm(f => ({ ...f, allocationMode: 'multi' }))}
                                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline gap-1.5"
                                                    >
                                                        <Split className="w-3.5 h-3.5" />
                                                        <span>Need to split this payment across multiple invoices? Switch to Split Mode</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* MULTI-INVOICE ALLOCATION TABLE */
                                            <div className="space-y-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                                                    <div className="text-xs text-slate-500">
                                                        Specify exact amounts to apply to each invoice. Any unallocated amount will be preserved as advance credit.
                                                    </div>
                                                    {form.site && (
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filterAllocBySite}
                                                                    onChange={e => setFilterAllocBySite(e.target.checked)}
                                                                    className="rounded border-slate-300 text-blue-600"
                                                                />
                                                                <span>Filter to {form.site} invoices only</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>

                                                {allocInvoices.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                                                        <p className="text-sm font-medium">No invoices found for {form.client || 'the selected client'}.</p>
                                                        <p className="text-xs text-slate-400 mt-1">Select a client above to list and allocate open invoices.</p>
                                                    </div>
                                                ) : (
                                                    <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                                                                <TableRow className="border-b border-slate-200 dark:border-slate-800">
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3">Invoice #</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3">Site</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Billed Amount</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Balance Due</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-center w-40">Allocated Cash (₦)</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-center">Quick Fill</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 py-2.5 px-3 text-right">Status After</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {allocInvoices.map((inv) => {
                                                                    const allocVal = form.allocations[inv.id]?.amount || '';
                                                                    const allocNum = parseFloat(String(allocVal).replace(/,/g, '')) || 0;
                                                                    const balAfter = Math.max(0, inv.remainingBalance - allocNum);
                                                                    const isPaidInFull = allocNum >= inv.remainingBalance && inv.remainingBalance > 0;
                                                                    const isPartiallyPaid = allocNum > 0 && !isPaidInFull;

                                                                    return (
                                                                        <TableRow key={inv.id} className={cn(
                                                                            "hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors",
                                                                            allocNum > 0 ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                                                                        )}>
                                                                            <TableCell className="py-2.5 px-3 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                                                                <div>{inv.invoiceNumber}</div>
                                                                                {inv.date && (
                                                                                    <div className="text-[10px] text-slate-400 font-normal">{formatDisplayDate(inv.date)}</div>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">
                                                                                {inv.siteName || <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                                                                                ₦{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                                                ₦{inv.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-center">
                                                                                <NumericFormat
                                                                                    customInput={Input}
                                                                                    thousandSeparator
                                                                                    decimalScale={2}
                                                                                    placeholder="0.00"
                                                                                    value={allocVal}
                                                                                    onValueChange={(v) => {
                                                                                        const val = v.value || '';
                                                                                        setForm(prev => ({
                                                                                            ...prev,
                                                                                            allocations: {
                                                                                                ...prev.allocations,
                                                                                                [inv.id]: {
                                                                                                    ...(prev.allocations[inv.id] || { withholdingTax: '', discount: '' }),
                                                                                                    amount: val
                                                                                                }
                                                                                            }
                                                                                        }));
                                                                                    }}
                                                                                    className={cn(
                                                                                        "h-8 font-mono text-xs text-right bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700",
                                                                                        allocNum > 0 ? "border-blue-500 font-bold text-blue-700 dark:text-blue-300" : ""
                                                                                    )}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-center">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={() => {
                                                                                            setForm(prev => ({
                                                                                                ...prev,
                                                                                                allocations: {
                                                                                                    ...prev.allocations,
                                                                                                    [inv.id]: {
                                                                                                        ...(prev.allocations[inv.id] || { withholdingTax: '', discount: '' }),
                                                                                                        amount: String(inv.remainingBalance)
                                                                                                    }
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                        disabled={inv.remainingBalance <= 0}
                                                                                        className="h-7 px-2 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-sm"
                                                                                        title="Pay full remaining balance"
                                                                                    >
                                                                                        Pay Full
                                                                                    </Button>
                                                                                    {allocNum > 0 && (
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => {
                                                                                                setForm(prev => ({
                                                                                                    ...prev,
                                                                                                    allocations: {
                                                                                                        ...prev.allocations,
                                                                                                        [inv.id]: {
                                                                                                            ...(prev.allocations[inv.id] || { withholdingTax: '', discount: '' }),
                                                                                                            amount: ''
                                                                                                        }
                                                                                                    }
                                                                                                }));
                                                                                            }}
                                                                                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-sm"
                                                                                            title="Clear allocation"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="py-2.5 px-3 text-right">
                                                                                {isPaidInFull ? (
                                                                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                                                        ✓ Cleared Full
                                                                                    </Badge>
                                                                                ) : isPartiallyPaid ? (
                                                                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 font-mono">
                                                                                        ₦{balAfter.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} rem
                                                                                    </Badge>
                                                                                ) : inv.remainingBalance <= 0 ? (
                                                                                    <span className="text-[11px] text-slate-400 italic">Settled</span>
                                                                                ) : (
                                                                                    <span className="text-[11px] text-slate-400">—</span>
                                                                                )}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card 3: Deductions & Taxes */}
                                <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                                    <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-sm text-amber-600 dark:text-amber-400">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">Deductions &amp; VAT Components</h3>
                                            <p className="text-[10px] text-slate-400">Withholding tax, prompt-payment discount, and damages deductions.</p>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Withholding Tax (₦)</label>
                                                <NumericFormat
                                                    customInput={Input}
                                                    thousandSeparator
                                                    decimalScale={2}
                                                    placeholder="0.00"
                                                    value={form.withholdingTax}
                                                    onValueChange={(v) => handleChange('withholdingTax', v.value || '')}
                                                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discount (₦)</label>
                                                <NumericFormat
                                                    customInput={Input}
                                                    thousandSeparator
                                                    decimalScale={2}
                                                    placeholder="0.00"
                                                    value={form.discount}
                                                    onValueChange={(v) => handleChange('discount', v.value || '')}
                                                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Damages (₦) <span className="text-[10px] font-normal text-slate-400">(Non-vatable)</span></label>
                                                <NumericFormat
                                                    customInput={Input}
                                                    thousandSeparator
                                                    decimalScale={2}
                                                    placeholder="0.00"
                                                    value={form.damages}
                                                    onValueChange={(v) => handleChange('damages', v.value || '')}
                                                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono tabular-nums h-10 rounded-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Sticky Sidebar: Real-Time Summary & Save */}
                            <div className="xl:sticky xl:top-4 space-y-4">
                                <div className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                                    <div className="bg-slate-900 px-5 py-4 text-white border-b border-slate-800 flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Payment Breakdown</h4>
                                            <p className="text-[10px] text-slate-400">Live reconciliation state</p>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border",
                                            livePreview.payVat === 'Yes' ? 'text-blue-400 bg-blue-950/50 border-blue-800' :
                                            livePreview.payVat === 'Add' ? 'text-amber-400 bg-amber-950/50 border-amber-800' :
                                            'text-slate-400 bg-slate-800 border-slate-700'
                                        )}>
                                            VAT: {livePreview.payVat}
                                        </Badge>
                                    </div>

                                    <div className="p-5 space-y-4 text-xs">
                                        <div className="flex justify-between items-baseline border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                            <span className="text-slate-500 font-medium">Gross Payment</span>
                                            <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                                                ₦{allocationSummary.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-baseline border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                            <span className="text-slate-500 font-medium flex items-center gap-1">
                                                Total Allocated ({allocationSummary.allocatedInvoicesCount} inv)
                                            </span>
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                ₦{allocationSummary.totalCashAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Status Badge & Unapplied / Overallocated */}
                                        <div className="p-3 rounded-md border bg-slate-50/50 dark:bg-slate-800/50 space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Unapplied Balance</span>
                                                <span className={cn(
                                                    "font-mono font-bold text-xs",
                                                    allocationSummary.isOverallocated ? "text-rose-600" :
                                                    allocationSummary.isFullyAllocated ? "text-emerald-600" : "text-amber-600"
                                                )}>
                                                    ₦{Math.abs(allocationSummary.unappliedCash).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>

                                            {allocationSummary.isOverallocated && (
                                                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    Allocations exceed total payment by ₦{Math.abs(allocationSummary.unappliedCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </p>
                                            )}

                                            {allocationSummary.isFullyAllocated && (
                                                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                                                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                                    100% of payment allocated to invoices
                                                </p>
                                            )}

                                            {allocationSummary.isPartiallyAllocated && (
                                                <p className="text-[10.5px] text-slate-500 leading-tight mt-1">
                                                    ₦{allocationSummary.unappliedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} will remain on ledger as unapplied client deposit.
                                                </p>
                                            )}

                                            {!allocationSummary.isOverallocated && !allocationSummary.isFullyAllocated && !allocationSummary.isPartiallyAllocated && (
                                                <p className="text-[10.5px] text-slate-400 leading-tight">
                                                    Full amount unallocated (Advance payment / general deposit).
                                                </p>
                                            )}
                                        </div>

                                        {/* Tax components */}
                                        <div className="space-y-1.5 pt-1 text-[11px]">
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>VAT Component:</span>
                                                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                                                    ₦{livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Amount For VAT:</span>
                                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    ₦{livePreview.amountForVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            {livePreview.damages > 0 && (
                                                <div className="flex justify-between text-rose-600">
                                                    <span>Damages Deducted:</span>
                                                    <span className="font-mono font-semibold">
                                                        -₦{livePreview.damages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                            <Button
                                                onClick={handleSubmit}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 font-bold rounded-sm shadow-xs"
                                            >
                                                <Save className="w-4 h-4" />
                                                <span>{selectedId ? 'Update Payment' : 'Save Payment'}</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setIsModalOpen(false)}
                                                className="w-full border-slate-300 dark:border-slate-700 h-9 text-slate-700 dark:text-slate-300 rounded-sm"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

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

