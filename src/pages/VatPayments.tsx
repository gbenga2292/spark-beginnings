import { useState, useMemo } from 'react';
import { useAppStore, VatPayment } from '@/src/store/appStore';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { Trash2, Edit, CheckCircle, Plus, X } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { usePriv } from '@/src/hooks/usePriv';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function VatPayments() {
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

    const initialForm = {
        client: '',
        date: '',
        month: '',
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
            amount,
        };

        if (selectedId) {
            updateVatPayment(selectedId, data);
            toast.success('VAT payment updated successfully!');
        } else {
            addVatPayment({ ...data, id: `VAT-${Date.now()}` });
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

    const uniqueClients = useMemo(() => {
        const allClients = new Set([
            ...sites.map(s => s.client),
            ...payments.map(p => p.client)
        ]);
        return Array.from(allClients);
    }, [sites, payments]);

    const totalsData = useMemo(() => {
        return uniqueClients.map(client => {
            const clientPayments = payments.filter(p => p.client === client && p.vat > 0);
            const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
            const totalVat = clientPayments.reduce((sum, p) => sum + p.vat, 0);

            const clientVatPayments = vatPayments.filter(vp => vp.client === client);
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
    }, [uniqueClients, payments, vatPayments]);

    const overallTotals = useMemo(() => {
        return totalsData.reduce((acc, curr) => ({
            totalPaid: acc.totalPaid + curr.totalPaid,
            vat: acc.vat + curr.vat,
            vatPaid: acc.vatPaid + curr.vatPaid,
            vatBalanceToPay: acc.vatBalanceToPay + curr.vatBalanceToPay,
            principleOnVatDue: acc.principleOnVatDue + curr.principleOnVatDue,
        }), { totalPaid: 0, vat: 0, vatPaid: 0, vatBalanceToPay: 0, principleOnVatDue: 0 });
    }, [totalsData]);

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
                        VAT Remittance
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Record VAT remittances to FIRS.</p>
                </div>
            </div>
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">
            <div className="flex justify-end">
                {priv.canManageVat && (
                  <Button
                      className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-md transition-all h-10 px-5"
                      onClick={() => { handleClear(); setIsModalOpen(true); }}
                  >
                      <Plus className="w-5 h-5" /> Add VAT Payment
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
                            </div>
                            <Badge variant="secondary" className="font-mono bg-indigo-100 text-indigo-800 border-indigo-200">{vatPayments.length}</Badge>
                        </div>

                        <div className="flex-1 overflow-x-auto min-h-[250px] max-h-[350px]">
                            <Table className="whitespace-nowrap min-w-full text-sm">
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="font-semibold px-4 py-3">Date</TableHead>
                                        <TableHead className="font-semibold px-4 py-3">Client</TableHead>
                                        <TableHead className="font-semibold px-4 py-3">Month</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right">Amount (₦)</TableHead>
                                        {priv.canManageVat && (
                                          <TableHead className="font-semibold px-4 py-3 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vatPayments.map((p: VatPayment) => (
                                        <TableRow key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedId === p.id ? 'bg-indigo-50/50' : ''}`}>
                                            <TableCell className="px-4 py-3 text-slate-500">{p.date}</TableCell>
                                            <TableCell className="px-4 py-3 font-semibold text-slate-800">{p.client}</TableCell>
                                            <TableCell className="px-4 py-3 text-slate-600">{p.month}</TableCell>
                                            <TableCell className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                                                {priv?.canViewAmounts === false ? '***' : (p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            {priv.canManageVat && (
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
                                    {vatPayments.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
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

                        <div className="flex-1 overflow-x-auto min-h-[250px] max-h-[350px]">
                            <Table className="whitespace-nowrap min-w-full text-sm">
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="font-semibold px-4 py-3">Client</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right">Total Paid</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right">VAT Value</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right">VAT Remitted</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right text-rose-600">Balance to Pay</TableHead>
                                        <TableHead className="font-semibold px-4 py-3 text-right text-indigo-600">Principle on VAT Due</TableHead>
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

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Month Coverage</label>
                                <div className="relative">
                                    <select value={form.month} onChange={e => handleChange('month', e.target.value)} className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none font-semibold text-slate-700">
                                        <option value="" disabled>Select Month...</option>
                                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount Paid (₦)</label>
                                <Input type="number" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} className="font-mono bg-slate-50 font-bold text-lg text-indigo-700 h-11" />
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
        </div>
        </div>
    );
}
