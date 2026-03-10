import { useState, useMemo } from 'react';
import { useAppStore, Payment } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';

export function Payments() {
    const sites = useAppStore((state) => state.sites);
    const payments = useAppStore((state) => state.payments);
    const addPayment = useAppStore((state) => state.addPayment);
    const updatePayment = useAppStore((state) => state.updatePayment);
    const deletePayment = useAppStore((state) => state.deletePayment);
    const vatRate = useAppStore((state) => state.payrollVariables.vatRate);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

        let vat = 0;
        if (payVat === 'Yes') {
            vat = (amount / (100 + vatRate)) * vatRate;
        } else if (payVat === 'Add') {
            vat = amount * (vatRate / 100);
        }

        let amountForVat = 0;
        if (payVat !== 'No') {
            amountForVat = amount - vat;
        }

        return { amount, vat, payVat, amountForVat };
    }, [form.amount, form.site, form.client, sites, vatRate]);

    const calculatePayment = (): Omit<Payment, 'id'> | null => {
        if (!form.date || !form.client || !form.site) {
            toast.error('Date, Client, and Site are required.');
            return null;
        }

        const amount = parseFloat(form.amount) || 0;
        const withholdingTax = parseFloat(form.withholdingTax) || 0;
        const discount = parseFloat(form.discount) || 0;

        const siteObj = sites.find(s => s.name === form.site && s.client === form.client);
        const payVat = siteObj ? siteObj.vat : 'No';

        let vat = 0;
        if (payVat === 'Yes') {
            vat = (amount / (100 + vatRate)) * vatRate;
        } else if (payVat === 'Add') {
            vat = amount * (vatRate / 100);
        }

        let amountForVat = 0;
        if (payVat !== 'No') {
            amountForVat = amount - vat;
        }

        return {
            client: form.client,
            site: form.site,
            date: form.date,
            amount,
            withholdingTax,
            discount,
            payVat,
            vat,
            amountForVat,
        };
    };

    const handleSubmit = () => {
        const data = calculatePayment();
        if (!data) return;

        if (selectedId) {
            updatePayment(selectedId, data);
            toast.success('Payment updated successfully!');
        } else {
            addPayment({ ...data, id: `PAY-${Date.now()}` });
            toast.success('Payment submitted successfully!');
        }
        setIsModalOpen(false);
        handleClear();
    };

    const handleEdit = (pay: Payment) => {
        setSelectedId(pay.id);
        setForm({
            date: pay.date,
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

    const uniqueClients = useMemo(() => Array.from(new Set(sites.map(s => s.client))), [sites]);
    const sitesForClient = useMemo(() => form.client ? sites.filter(s => s.client === form.client) : sites, [sites, form.client]);

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
                        Payments
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Record and manage client payments.</p>
                </div>
            </div>
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">

            <div className="flex justify-end">
                <Button
                    className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md transition-all h-10 px-5"
                    onClick={() => { handleClear(); setIsModalOpen(true); }}
                >
                    <Plus className="w-5 h-5" /> Add Payment
                </Button>
            </div>

            <div className="flex flex-1 gap-6 items-start flex-col">

                <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-w-0 min-h-[400px]">
                    <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                Payment Entries
                            </h3>
                            <Badge variant="secondary" className="ml-2 font-mono bg-emerald-100 text-emerald-800 border-emerald-200">{payments.length}</Badge>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <Table className="whitespace-nowrap min-w-full text-sm">
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-semibold px-4 py-3">Date</TableHead>
                                    <TableHead className="font-semibold px-4 py-3">Client</TableHead>
                                    <TableHead className="font-semibold px-4 py-3">Site</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-right">Amount (₦)</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-right text-slate-500">WHT</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-right text-slate-500">Discount</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-center">VAT Policy</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-right">VAT (₦)</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-right">Amt For VAT</TableHead>
                                    <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((p: Payment) => (
                                    <TableRow key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedId === p.id ? 'bg-indigo-50/50' : ''}`}>
                                        <TableCell className="px-4 py-3 text-slate-500">{p.date}</TableCell>
                                        <TableCell className="px-4 py-3 font-semibold text-slate-800">{p.client}</TableCell>
                                        <TableCell className="px-4 py-3 text-slate-600">{p.site}</TableCell>
                                        <TableCell className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                            {(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 font-mono">
                                            {p.withholdingTax ? p.withholdingTax.toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-slate-500 font-mono">
                                            {p.discount ? p.discount.toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center text-xs">
                                            <Badge variant={p.payVat === 'Yes' ? 'default' : p.payVat === 'Add' ? 'outline' : 'secondary'} className={`${p.payVat === 'Yes' ? 'bg-indigo-100 text-indigo-800' : ''}`}>
                                                {p.payVat || 'No'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-indigo-600 font-mono font-medium">
                                            {(p.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-emerald-600 font-mono font-medium">
                                            {(p.amountForVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center sticky right-0 bg-white/95 backdrop-blur shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="Edit record">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="h-8 w-8 text-rose-600 hover:bg-rose-50" title="Delete record">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {payments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="px-4 py-12 text-center text-slate-500 font-medium tracking-wide border-b-0">
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
                                    <Input type="number" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} className="bg-slate-50 font-mono font-semibold text-lg text-emerald-700 h-11" />
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
                                    <Input type="number" min="0" value={form.withholdingTax} onChange={e => handleChange('withholdingTax', e.target.value)} className="bg-slate-50 h-11" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount</label>
                                    <Input type="number" min="0" value={form.discount} onChange={e => handleChange('discount', e.target.value)} className="bg-slate-50 h-11" />
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
                                            <span className="font-mono text-slate-200 font-medium text-sm">₦{livePreview.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-700 pl-4">
                                            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Tax Component (VAT {livePreview.payVat})</span>
                                            <span className="font-mono text-indigo-400 font-medium text-sm">₦{livePreview.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
        </div>
        </div>
    );
}
