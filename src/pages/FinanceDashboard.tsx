import { useMemo, useState, useRef } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Landmark, Receipt, TrendingUp, Wallet, ArrowRight, Activity, AlertCircle, PieChart as PieChartIcon, BarChart3, HelpCircle, Filter, Download, Upload, X, CheckCircle } from 'lucide-react';
import {
    BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/components/ui/toast';
import * as XLSX from 'xlsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function FinanceDashboard() {
    const rawInvoices = useAppStore(state => state.invoices);
    const rawPayments = useAppStore(state => state.payments);
    const rawVatPayments = useAppStore(state => state.vatPayments);
    const addInvoice = useAppStore(state => state.addInvoice);
    const addPayment = useAppStore(state => state.addPayment);
    const addVatPayment = useAppStore(state => state.addVatPayment);

    const [debtorView, setDebtorView] = useState<'client' | 'site'>('client');
    const [summaryTab, setSummaryTab] = useState<'client' | 'site'>('client');

    const [filterYear, setFilterYear] = useState<string>('All');
    const [filterClient, setFilterClient] = useState<string>('All');

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportSelection, setExportSelection] = useState({ invoices: true, payments: true, vat: true });

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importSelection, setImportSelection] = useState({ invoices: true, payments: true, vat: true });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportData = () => {
        if (!exportSelection.invoices && !exportSelection.payments && !exportSelection.vat) {
            toast.error('Please select at least one data type to export.');
            return;
        }

        const wb = XLSX.utils.book_new();

        if (exportSelection.invoices && rawInvoices.length > 0) {
            const wsInvoices = XLSX.utils.json_to_sheet(rawInvoices);
            XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoices");
        }
        if (exportSelection.payments && rawPayments.length > 0) {
            const wsPayments = XLSX.utils.json_to_sheet(rawPayments);
            XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");
        }
        if (exportSelection.vat && rawVatPayments.length > 0) {
            const wsVat = XLSX.utils.json_to_sheet(rawVatPayments);
            XLSX.utils.book_append_sheet(wb, wsVat, "VAT Payments");
        }

        XLSX.writeFile(wb, "Financial_Data_Export.xlsx");
        toast.success("Data exported successfully!");
        setIsExportModalOpen(false);
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });

                let importedCount = 0;

                if (importSelection.invoices && wb.Sheets["Invoices"]) {
                    const data = XLSX.utils.sheet_to_json(wb.Sheets["Invoices"]);
                    data.forEach((row: any) => {
                        const invId = row.id || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        addInvoice({ ...row, id: invId });
                        importedCount++;
                    });
                }
                if (importSelection.payments && wb.Sheets["Payments"]) {
                    const data = XLSX.utils.sheet_to_json(wb.Sheets["Payments"]);
                    data.forEach((row: any) => {
                        const payId = row.id || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        addPayment({ ...row, id: payId });
                        importedCount++;
                    });
                }
                if (importSelection.vat && wb.Sheets["VAT Payments"]) {
                    const data = XLSX.utils.sheet_to_json(wb.Sheets["VAT Payments"]);
                    data.forEach((row: any) => {
                        const vatId = row.id || `VAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        addVatPayment({ ...row, id: vatId });
                        importedCount++;
                    });
                }

                if (importedCount > 0) {
                    toast.success(`Successfully imported ${importedCount} records.`);
                } else {
                    toast.error("No valid records found for the selected options.");
                }
                setIsImportModalOpen(false);
            } catch (err) {
                console.error(err);
                toast.error("Error reading the Excel file.");
            }
        };
        reader.readAsBinaryString(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        [...rawInvoices, ...rawPayments, ...rawVatPayments].forEach(item => {
            if (item.date) years.add(item.date.substring(0, 4));
        });
        return Array.from(years).sort().reverse();
    }, [rawInvoices, rawPayments, rawVatPayments]);

    const availableClients = useMemo(() => {
        const clients = new Set<string>();
        [...rawInvoices, ...rawPayments, ...rawVatPayments].forEach(item => {
            if (item.client) clients.add(item.client);
        });
        return Array.from(clients).sort();
    }, [rawInvoices, rawPayments, rawVatPayments]);

    const invoices = useMemo(() => rawInvoices.filter(i => {
        const matchY = filterYear === 'All' || (i.date && i.date.startsWith(filterYear));
        const matchC = filterClient === 'All' || i.client === filterClient;
        return matchY && matchC;
    }), [rawInvoices, filterYear, filterClient]);

    const payments = useMemo(() => rawPayments.filter(p => {
        const matchY = filterYear === 'All' || (p.date && p.date.startsWith(filterYear));
        const matchC = filterClient === 'All' || p.client === filterClient;
        return matchY && matchC;
    }), [rawPayments, filterYear, filterClient]);

    const vatPayments = useMemo(() => rawVatPayments.filter(v => {
        const matchY = filterYear === 'All' || (v.date && v.date.startsWith(filterYear));
        const matchC = filterClient === 'All' || v.client === filterClient;
        return matchY && matchC;
    }), [rawVatPayments, filterYear, filterClient]);

    // 1. Core Top-Level Metrics
    const globalStats = useMemo(() => {
        const totalBilled = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        // Payments cover the invoice. Usually: Cash + WHT + Discount = Value cleared against invoice.
        const totalCollectedCash = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalWHT = payments.reduce((sum, p) => sum + (p.withholdingTax || 0), 0);
        const totalDiscount = payments.reduce((sum, p) => sum + (p.discount || 0), 0);

        const totalValueCleared = totalCollectedCash + totalWHT + totalDiscount;
        const totalOutstanding = Math.max(0, totalBilled - totalValueCleared);

        const totalVATCollected = payments.reduce((sum, p) => sum + (p.vat || 0), 0);
        const totalVATRemitted = vatPayments.reduce((sum, vp) => sum + (vp.amount || 0), 0);
        const vatDeficit = Math.max(0, totalVATCollected - totalVATRemitted);

        return {
            totalBilled,
            totalCollectedCash,
            totalValueCleared,
            totalOutstanding,
            totalWHT,
            totalDiscount,
            totalVATCollected,
            totalVATRemitted,
            vatDeficit
        };
    }, [invoices, payments, vatPayments]);

    // 2. Trend Analysis (Last 6 Months Billed vs Collected)
    const trendData = useMemo(() => {
        const map = new Map<string, { month: string; sortKey: string; Billed: number; Collected: number }>();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const processDate = (dateStr: string, amount: number, type: 'Billed' | 'Collected') => {
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const display = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;

            if (!map.has(key)) {
                map.set(key, { month: display, sortKey: key, Billed: 0, Collected: 0 });
            }
            map.get(key)![type] += amount;
        };

        invoices.forEach(inv => processDate(inv.date, inv.amount, 'Billed'));
        payments.forEach(pay => processDate(pay.date, pay.amount + (pay.withholdingTax || 0), 'Collected'));

        return Array.from(map.values())
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
            .slice(-6); // Take only the last 6 active months
    }, [invoices, payments]);

    // 3. Outstanding Balances by Client (Top Debtors)
    const clientDebtData = useMemo(() => {
        const clients = new Map<string, { name: string; billed: number; cleared: number; limit: number }>();

        invoices.forEach(inv => {
            const siteName = inv.siteName || (inv as any).site || 'Unknown Site';
            const key = debtorView === 'client' ? inv.client : `${inv.client} - ${siteName}`;

            if (!clients.has(key)) clients.set(key, { name: key, billed: 0, cleared: 0, limit: 0 });
            clients.get(key)!.billed += (inv.amount || 0);
        });

        payments.forEach(pay => {
            const key = debtorView === 'client' ? pay.client : `${pay.client} - ${pay.site}`;

            if (!clients.has(key)) clients.set(key, { name: key, billed: 0, cleared: 0, limit: 0 });
            clients.get(key)!.cleared += (pay.amount + (pay.withholdingTax || 0) + (pay.discount || 0));
        });

        const outstandingArray = Array.from(clients.values()).map(c => ({
            name: c.name,
            Outstanding: Math.max(0, c.billed - c.cleared),
            Cleared: c.cleared,
            Billed: c.billed,
        }));

        return outstandingArray
            .filter(c => c.Outstanding > 0)
            .sort((a, b) => b.Outstanding - a.Outstanding)
            .slice(0, 10); // Show Top 10 for better comparative granularity
    }, [invoices, payments, debtorView]);

    // 4. Detailed Summary Table Data (Client / Site)
    const summaryData = useMemo(() => {
        const rowMap = new Map<string, any>();

        invoices.forEach(inv => {
            const siteName = inv.siteName || (inv as any).site || 'Unknown Site';
            const key = summaryTab === 'client' ? inv.client : `${inv.client} - ${siteName}`;

            if (!rowMap.has(key)) {
                rowMap.set(key, {
                    client: inv.client, site: siteName, key,
                    noOfInvoices: 0, totalInvoices: 0, totalPayment: 0, discount: 0, withholdingTax: 0, vat: 0
                });
            }
            rowMap.get(key)!.noOfInvoices += 1;
            rowMap.get(key)!.totalInvoices += (inv.amount || 0);
        });

        payments.forEach(pay => {
            const siteName = pay.site || 'Unknown Site';
            const key = summaryTab === 'client' ? pay.client : `${pay.client} - ${siteName}`;

            if (!rowMap.has(key)) {
                rowMap.set(key, {
                    client: pay.client, site: siteName, key,
                    noOfInvoices: 0, totalInvoices: 0, totalPayment: 0, discount: 0, withholdingTax: 0, vat: 0
                });
            }
            rowMap.get(key)!.totalPayment += (pay.amount || 0);
            rowMap.get(key)!.discount += (pay.discount || 0);
            rowMap.get(key)!.withholdingTax += (pay.withholdingTax || 0);
            rowMap.get(key)!.vat += (pay.vat || 0);
        });

        let rows = Array.from(rowMap.values()).map(r => {
            const balance = r.totalInvoices - r.totalPayment - r.discount - r.withholdingTax;
            let status = '';

            if (balance > 0 && r.totalPayment === 0 && r.discount === 0 && r.withholdingTax === 0) {
                status = 'OWING';
            } else if (balance > 0) {
                status = 'PART PAID';
            } else if (balance === 0 && r.totalInvoices > 0) {
                status = 'FULLY PAID';
            } else if (balance < 0) {
                status = 'OVER PAID';
            } else {
                status = '-';
            }

            return { ...r, balance, status };
        });

        return rows.sort((a, b) => a.client.localeCompare(b.client));
    }, [invoices, payments, summaryTab]);

    // 5. VAT Health Data for Pie Chart
    const vatPieData = useMemo(() => [
        { name: 'Remitted to FIRS', value: globalStats.totalVATRemitted },
        { name: 'VAT Deficit (Unpaid)', value: globalStats.vatDeficit },
    ], [globalStats.totalVATRemitted, globalStats.vatDeficit]);

    const formatCurrCompact = (val: number) => {
        if (val >= 1000000) return `₦${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `₦${(val / 1000).toFixed(1)}k`;
        return `₦${val.toLocaleString()}`;
    };

    const formatCurr = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const collectionRate = globalStats.totalBilled > 0
        ? Math.round((globalStats.totalValueCleared / globalStats.totalBilled) * 100)
        : 0;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300 pb-10">
            {/* GLOBAL FILTERS */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 text-slate-800">
                    <Filter className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wide">Financial Filters</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Year</span>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32"
                        >
                            <option value="All">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Client</span>
                        <select
                            value={filterClient}
                            onChange={(e) => setFilterClient(e.target.value)}
                            className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 md:w-48"
                        >
                            <option value="All">All Clients</option>
                            {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="h-9 w-px bg-slate-200 hidden md:block mx-1"></div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-9 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setIsImportModalOpen(true)}>
                            <Upload className="w-4 h-4 mr-2" /> Import
                        </Button>
                        <Button size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsExportModalOpen(true)}>
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* TOP METRICS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Billed</p>
                                <h3 className="text-2xl font-bold font-mono text-slate-800">{formatCurrCompact(globalStats.totalBilled)}</h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                                <Receipt className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
                            Across {invoices.length} active invoices
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Collections</p>
                                <h3 className="text-2xl font-bold font-mono text-emerald-600">{formatCurrCompact(globalStats.totalCollectedCash)}</h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                                <Wallet className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
                            + {formatCurrCompact(globalStats.totalWHT)} WHT Deduction
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 relative border-l-4 border-l-amber-500">
                    <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Receivables</p>
                                <h3 className="text-2xl font-bold font-mono text-amber-600">{formatCurrCompact(globalStats.totalOutstanding)}</h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                                <Activity className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${100 - collectionRate}%` }}></div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase mt-1 tracking-wide">{collectionRate}% Collection Efficiency</div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 relative border-l-4 border-l-rose-500">
                    <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">VAT Liability</p>
                                <h3 className="text-2xl font-bold font-mono text-rose-600">{formatCurrCompact(globalStats.vatDeficit)}</h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 transition-transform group-hover:scale-110">
                                <Landmark className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
                            Total Collected: {formatCurrCompact(globalStats.totalVATCollected)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MIDDLE ROW: CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Billing Cashflow Trend */}
                <Card className="shadow-sm border-slate-200 col-span-1 lg:col-span-2 flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Cash Flow Velocity</CardTitle>
                        </div>
                        <CardDescription>Billed Revenue vs Cash & Value Collected over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 flex-1 min-h-[300px]">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${val / 1000000}M`} />
                                    <RechartsTooltip
formatter={(value: number | undefined) => formatCurr(value ?? 0)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                                    <Area type="monotone" dataKey="Billed" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBilled)" />
                                    <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                                <p className="text-sm">Not enough data to map trends.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* VAT Compliance Donut */}
                <Card className="shadow-sm border-slate-200 flex flex-col">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                                <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">VAT Compliance</CardTitle>
                            </div>
                            <Badge variant={globalStats.vatDeficit > 0 ? "outline" : "secondary"} className={globalStats.vatDeficit > 0 ? "text-amber-600 border-amber-200 bg-amber-50" : "bg-emerald-50 text-emerald-700"}>
                                {globalStats.vatDeficit > 0 ? 'Action Reqd' : 'Healthy'}
                            </Badge>
                        </div>
                        <CardDescription>Portion of collected VAT remitted.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 flex-1 min-h-[300px] flex flex-col items-center justify-center relative">
                        {globalStats.totalVATCollected > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height="80%">
                                    <PieChart>
                                        <Pie
                                            data={vatPieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={95}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill="#10b981" /> {/* Remitted */}
                                            <Cell fill="#f43f5e" /> {/* Deficit */}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number | undefined) => formatCurr(value ?? 0)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                                    <span className="text-2xl font-bold text-slate-800 tracking-tighter font-mono mt-8">
                                        {Math.round((globalStats.totalVATRemitted / Math.max(1, globalStats.totalVATCollected)) * 100)}%
                                    </span>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Remitted</span>
                                </div>
                                <div className="flex w-full justify-center gap-4 mt-2 mb-2 text-xs">
                                    <div className="flex items-center gap-1 font-medium text-slate-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Remitted</div>
                                    <div className="flex items-center gap-1 font-medium text-slate-600"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Deficit</div>
                                </div>
                            </>
                        ) : (
                            <div className="text-slate-400 text-sm text-center">
                                <AlertCircle className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                <p>No VAT collected yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            {/* BOTTOM SECTION: RISK ANALYSIS */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Receivables Risk Analysis (Top Debtors)</CardTitle>
                        </div>
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${debtorView === 'client' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setDebtorView('client')}
                            >
                                By Client
                            </button>
                            <button
                                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${debtorView === 'site' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setDebtorView('site')}
                            >
                                By Client + Site
                            </button>
                        </div>
                    </div>
                    <CardDescription>Highest outstanding balances currently held based on Active Invoices.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-5">
                    {clientDebtData.length > 0 ? (
                        <div className="overflow-x-auto">
                            <ResponsiveContainer width="100%" height={250} className="min-w-[600px]">
                                <BarChart
                                    data={clientDebtData}
                                    layout="vertical"
                                    margin={{ top: 10, right: 30, left: debtorView === 'site' ? 80 : 20, bottom: 5 }}
                                    barSize={20}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${(val / 1000000)}M`} />
                                    <YAxis type="category" dataKey="name" width={debtorView === 'site' ? 180 : 100} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        formatter={(value: number) => formatCurr(value)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />
                                    <Bar dataKey="Cleared" stackId="a" fill="#cbd5e1" name="Received Income" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Outstanding" stackId="a" fill="#f59e0b" name="Outstanding Balance" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-slate-500 font-medium">
                            <Activity className="w-10 h-10 opacity-20 mx-auto mb-3" />
                            <p>No outstanding balances to display. All clients are clear!</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* FULL DATA AT A GLANCE (TABLE SUMMARY) */}
            <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-0 pt-4 px-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 pb-3">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-indigo-600" />
                            <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Financial Summary Ledger</CardTitle>
                        </div>
                    </div>
                    {/* Tabs */}
                    <div className="flex px-5 gap-6 border-b border-slate-200">
                        <button
                            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${summaryTab === 'client' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setSummaryTab('client')}
                        >
                            Client Summary
                        </button>
                        <button
                            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${summaryTab === 'site' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setSummaryTab('site')}
                        >
                            Site Summary
                        </button>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto min-h-[300px]">
                    <Table className="whitespace-nowrap min-w-full text-[13px]">
                        <TableHeader className="bg-slate-900 sticky top-0 z-10 shadow-md">
                            <TableRow className="hover:bg-slate-900 border-b border-indigo-500/50">
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4">Client</TableHead>
                                {summaryTab === 'site' && <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4">Site</TableHead>}
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-center">Inv. Qty</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-right">Total Invoiced</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-right">Total Payments</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-right">Discounts</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-indigo-200 px-5 py-4 text-right">WHT</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-indigo-200 px-5 py-4 text-right">VAT</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-right">Sharing Accts</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-rose-300 px-5 py-4 text-right">Balance Due</TableHead>
                                <TableHead className="font-semibold text-xs tracking-wider uppercase text-slate-300 px-5 py-4 text-center">Health</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.map((row, i) => (
                                <TableRow key={i} className={`hover:bg-indigo-50/40 transition-colors border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                    <TableCell className="px-5 py-3 font-semibold text-slate-700 bg-white/50">{row.client}</TableCell>
                                    {summaryTab === 'site' && <TableCell className="px-5 py-3 text-slate-500 font-medium bg-white/50">{row.site}</TableCell>}
                                    <TableCell className="px-5 py-3 text-center text-slate-500 font-medium">
                                        <div className="bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 inline-block text-[11px] font-bold">{row.noOfInvoices || '0'}</div>
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono font-medium text-slate-700">
                                        {row.totalInvoices ? row.totalInvoices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono font-medium text-emerald-700">
                                        {row.totalPayment ? row.totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono text-slate-400">
                                        {row.discount ? row.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono text-indigo-600/70">
                                        {row.withholdingTax ? row.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono text-indigo-600/70">
                                        {row.vat ? row.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-right font-mono text-slate-400">-</TableCell>
                                    <TableCell className={`px-5 py-3 text-right font-mono font-bold ${row.balance > 0 ? 'text-rose-600' : row.balance < 0 ? 'text-slate-500' : 'text-emerald-600'}`}>
                                        {row.balance !== 0 ? (
                                            row.balance < 0 ? `(${Math.abs(row.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-3 text-center">
                                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase shadow-sm
                                            ${row.status === 'OWING' ? 'bg-rose-100 border border-rose-200 text-rose-700' :
                                                row.status === 'PART PAID' ? 'bg-amber-100 border border-amber-200 text-amber-700' :
                                                    row.status === 'OVER PAID' ? 'bg-indigo-100 border border-indigo-200 text-indigo-700' :
                                                        row.status === 'FULLY PAID' ? 'bg-emerald-100 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {row.status}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {/* Aggregation Footer Row */}
                            {summaryData.length > 0 && (
                                <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-4 border-indigo-500 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] relative z-10">
                                    <TableCell colSpan={summaryTab === 'site' ? 2 : 1} className="px-5 py-4 font-bold text-slate-200 text-sm tracking-wider uppercase">Grand Total</TableCell>
                                    <TableCell className="px-5 py-4 text-center font-bold text-slate-300 bg-slate-800/80 rounded-sm">
                                        {summaryData.reduce((sum, r) => sum + r.noOfInvoices, 0)}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-bold text-slate-200">
                                        {globalStats.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                                        {globalStats.totalCollectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-medium text-slate-400">
                                        {globalStats.totalDiscount ? globalStats.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-medium text-indigo-300">
                                        {globalStats.totalWHT ? globalStats.totalWHT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-medium text-indigo-300">
                                        {globalStats.totalVATCollected ? globalStats.totalVATCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-medium text-slate-500">-</TableCell>
                                    <TableCell className="px-5 py-4 text-right font-mono font-bold text-rose-400 bg-rose-950/20">
                                        {globalStats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="px-5 py-4"></TableCell>
                                </TableRow>
                            )}

                            {summaryData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={summaryTab === 'site' ? 11 : 10} className="px-4 py-12 text-center text-slate-500 font-medium">
                                        No data available to summarize.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* EXPORT MODAL */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Export Financial Data</h2>
                                <p className="text-xs text-slate-500">Select which entities to include in the Excel file.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsExportModalOpen(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={exportSelection.invoices} onChange={(e) => setExportSelection(prev => ({ ...prev, invoices: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">Invoices ({rawInvoices.length})</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={exportSelection.payments} onChange={(e) => setExportSelection(prev => ({ ...prev, payments: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">Payments ({rawPayments.length})</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={exportSelection.vat} onChange={(e) => setExportSelection(prev => ({ ...prev, vat: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">VAT Payments ({rawVatPayments.length})</span>
                            </label>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <Button variant="outline" className="flex-1 border-slate-300 h-10 text-slate-600 hover:bg-slate-100" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-10" onClick={handleExportData}><Download className="w-4 h-4" /> Export</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Import Financial Data</h2>
                                <p className="text-xs text-slate-500">Pick which entities you want to extract and import.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-800" onClick={() => setIsImportModalOpen(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={importSelection.invoices} onChange={(e) => setImportSelection(prev => ({ ...prev, invoices: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">Import Invoices</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={importSelection.payments} onChange={(e) => setImportSelection(prev => ({ ...prev, payments: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">Import Payments</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" checked={importSelection.vat} onChange={(e) => setImportSelection(prev => ({ ...prev, vat: e.target.checked }))} />
                                <span className="text-sm font-semibold text-slate-700">Import VAT Payments</span>
                            </label>

                            <div className="mt-4 pt-4 border-t border-slate-100 pointer-events-auto">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImportData}
                                />
                                <Button className="w-full bg-slate-800 hover:bg-slate-900 text-white gap-2 h-10" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="w-4 h-4" /> Pick Excel File
                                </Button>
                                <p className="text-center text-[10px] text-slate-500 mt-2 font-medium">Must structurally match the system Export file.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
