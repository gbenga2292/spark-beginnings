import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import {
  Download, Upload, Receipt, Wallet, TrendingUp, Landmark, Activity, AlertCircle,
  PieChart as PieChartIcon, BarChart3, Filter, X, CheckCircle2, FileSpreadsheet, FileText, DollarSign, Backpack, CreditCard
} from 'lucide-react';
import { useAppStore } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const getBase64ImageFromUrl = async (imageUrl: string) => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export function FinancialReports() {
  const rawInvoices = useAppStore(state => state.invoices);
  const rawPayments = useAppStore(state => state.payments);
  const rawVatPayments = useAppStore(state => state.vatPayments);
  const sites = useAppStore(state => state.sites);

  const employees = useAppStore(state => state.employees);
  const loans = useAppStore(state => state.loans);
  const salaryAdvances = useAppStore(state => state.salaryAdvances);
  const [accountsTab, setAccountsTab] = useState<'payroll' | 'loans'>('payroll');
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterClient, setFilterClient] = useState<string>('All');
  const [summaryTab, setSummaryTab] = useState<'client' | 'site'>('client');
  const [debtorView, setDebtorView] = useState<'client' | 'site'>('client');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [activeFinBuilderTab, setActiveFinBuilderTab] = useState<string>("Revenue & Billing");

  // Filters
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

  // Core Metrics
  const globalStats = useMemo(() => {
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCollectedCash = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalWHT = payments.reduce((sum, p) => sum + (p.withholdingTax || 0), 0);
    const totalDiscount = payments.reduce((sum, p) => sum + (p.discount || 0), 0);
    const totalValueCleared = totalCollectedCash + totalWHT + totalDiscount;
    const totalOutstanding = Math.max(0, totalBilled - totalValueCleared);
    const totalVATCollected = payments.reduce((sum, p) => sum + (p.vat || 0), 0);
    const totalVATRemitted = vatPayments.reduce((sum, vp) => sum + (vp.amount || 0), 0);
    const vatDeficit = Math.max(0, totalVATCollected - totalVATRemitted);
    return { totalBilled, totalCollectedCash, totalValueCleared, totalOutstanding, totalWHT, totalDiscount, totalVATCollected, totalVATRemitted, vatDeficit };
  }, [invoices, payments, vatPayments]);

  const collectionRate = globalStats.totalBilled > 0
    ? Math.round((globalStats.totalValueCleared / globalStats.totalBilled) * 100) : 0;

  // Trend Data
  const trendData = useMemo(() => {
    const map = new Map<string, { month: string; sortKey: string; Billed: number; Collected: number }>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const processDate = (dateStr: string, amount: number, type: 'Billed' | 'Collected') => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const display = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (!map.has(key)) map.set(key, { month: display, sortKey: key, Billed: 0, Collected: 0 });
      map.get(key)![type] += amount;
    };
    invoices.forEach(inv => processDate(inv.date, inv.amount, 'Billed'));
    payments.forEach(pay => processDate(pay.date, pay.amount + (pay.withholdingTax || 0), 'Collected'));
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
  }, [invoices, payments]);

  // Debtor Data
  const clientDebtData = useMemo(() => {
    const clients = new Map<string, { name: string; billed: number; cleared: number }>();
    invoices.forEach(inv => {
      const siteName = inv.siteName || (inv as any).site || 'Unknown Site';
      const key = debtorView === 'client' ? inv.client : `${inv.client} - ${siteName}`;
      if (!clients.has(key)) clients.set(key, { name: key, billed: 0, cleared: 0 });
      clients.get(key)!.billed += (inv.amount || 0);
    });
    payments.forEach(pay => {
      const key = debtorView === 'client' ? pay.client : `${pay.client} - ${pay.site}`;
      if (!clients.has(key)) clients.set(key, { name: key, billed: 0, cleared: 0 });
      clients.get(key)!.cleared += (pay.amount + (pay.withholdingTax || 0) + (pay.discount || 0));
    });
    return Array.from(clients.values())
      .map(c => ({ name: c.name, Outstanding: Math.max(0, c.billed - c.cleared), Cleared: c.cleared, Billed: c.billed }))
      .filter(c => c.Outstanding > 0)
      .sort((a, b) => b.Outstanding - a.Outstanding)
      .slice(0, 10);
  }, [invoices, payments, debtorView]);

  // Summary Ledger Data
  const summaryData = useMemo(() => {
    const rowMap = new Map<string, any>();
    invoices.forEach(inv => {
      const siteName = inv.siteName || (inv as any).site || 'Unknown Site';
      const key = summaryTab === 'client' ? inv.client : `${inv.client} - ${siteName}`;
      if (!rowMap.has(key)) rowMap.set(key, { client: inv.client, site: siteName, key, noOfInvoices: 0, totalInvoices: 0, totalPayment: 0, discount: 0, withholdingTax: 0, vat: 0 });
      rowMap.get(key)!.noOfInvoices += 1;
      rowMap.get(key)!.totalInvoices += (inv.amount || 0);
    });
    payments.forEach(pay => {
      const siteName = pay.site || 'Unknown Site';
      const key = summaryTab === 'client' ? pay.client : `${pay.client} - ${siteName}`;
      if (!rowMap.has(key)) rowMap.set(key, { client: pay.client, site: siteName, key, noOfInvoices: 0, totalInvoices: 0, totalPayment: 0, discount: 0, withholdingTax: 0, vat: 0 });
      rowMap.get(key)!.totalPayment += (pay.amount || 0);
      rowMap.get(key)!.discount += (pay.discount || 0);
      rowMap.get(key)!.withholdingTax += (pay.withholdingTax || 0);
      rowMap.get(key)!.vat += (pay.vat || 0);
    });
    return Array.from(rowMap.values()).map(r => {
      const balance = r.totalInvoices - r.totalPayment - r.discount - r.withholdingTax;
      let status = balance > 0 && r.totalPayment === 0 && r.discount === 0 && r.withholdingTax === 0 ? 'OWING'
        : balance > 0 ? 'PART PAID' : balance === 0 && r.totalInvoices > 0 ? 'FULLY PAID' : balance < 0 ? 'OVER PAID' : '-';
      return { ...r, balance, status };
    }).sort((a, b) => a.client.localeCompare(b.client));
  }, [invoices, payments, summaryTab]);

  // VAT Pie
  const vatPieData = useMemo(() => [
    { name: 'Remitted to FIRS', value: globalStats.totalVATRemitted },
    { name: 'VAT Deficit (Unpaid)', value: globalStats.vatDeficit },
  ], [globalStats.totalVATRemitted, globalStats.vatDeficit]);

  // Site financial data
  const siteFinancialData = useMemo(() => {
    const siteMap: Record<string, { paid: number; pending: number }> = {};
    sites.forEach(s => { siteMap[s.name] = { paid: 0, pending: 0 }; });
    invoices.forEach(inv => {
      if (siteMap[inv.siteName]) {
        if (inv.status === 'Paid') siteMap[inv.siteName].paid += inv.amount;
        else siteMap[inv.siteName].pending += inv.amount;
      }
    });
    return Object.entries(siteMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
  }, [sites, invoices]);

  const formatCurrCompact = (val: number) => {
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(1)}k`;
    return `₦${val.toLocaleString()}`;
  };
  const formatCurr = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const showExportMessage = (message: string) => {
    setExportMessage(message);
    setTimeout(() => setExportMessage(null), 3000);
  };

  const generatePdf = async (title: string, head: string[][], body: (string | number)[][], filename: string) => {
    try {
      const doc = new jsPDF();
      const logoBase64 = await getBase64ImageFromUrl('/logo/logo-2.png');
      doc.addImage(logoBase64, 'PNG', 14, 10, 35, 12);
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, 34);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 40);
      autoTable(doc, { startY: 46, head, body, theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, cellPadding: 3 } });
      doc.save(filename);
      showExportMessage(`${title} PDF exported successfully!`);
    } catch (error) {
      console.error('Error generating PDF', error);
      toast.error('Failed to generate PDF.');
    }
  };

  // Export functions
  const exportInvoiceReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Invoice ID,Client,Site,Date,Amount,Status\n";
    invoices.forEach(inv => { csv += `${inv.id},${inv.client},${inv.siteName},${inv.date},${inv.amount},${inv.status}\n`; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "invoice_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("Invoice Report exported!");
  };

  const exportInvoicePdf = () => {
    const head = [["Invoice ID", "Client", "Site", "Date", "Amount (₦)", "Status"]];
    const body = invoices.map(inv => [inv.id, inv.client, inv.siteName, inv.date, (inv.amount || 0).toLocaleString(), inv.status]);
    generatePdf("Invoice Report", head, body, "invoice_report.pdf");
  };

  const exportPaymentReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Payment ID,Client,Site,Date,Amount,WHT,VAT,Discount\n";
    payments.forEach(p => { csv += `${p.id},${p.client},${p.site},${p.date},${p.amount},${p.withholdingTax || 0},${p.vat || 0},${p.discount || 0}\n`; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "payment_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("Payment Report exported!");
  };

  const exportPaymentPdf = () => {
    const head = [["Payment ID", "Client", "Site", "Date", "Amount (₦)", "WHT (₦)", "VAT (₦)"]];
    const body = payments.map(p => [p.id, p.client, p.site, p.date, (p.amount || 0).toLocaleString(), (p.withholdingTax || 0).toLocaleString(), (p.vat || 0).toLocaleString()]);
    generatePdf("Payment Report", head, body, "payment_report.pdf");
  };

  const exportVatReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "VAT ID,Client,Date,Amount,Status\n";
    vatPayments.forEach(v => { csv += `${v.id},${v.client},${v.date},${v.amount}\n`; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "vat_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showExportMessage("VAT Report exported!");
  };

  const exportLedgerPdf = () => {
    const head = [["Client", summaryTab === 'site' ? "Site" : "", "Inv. Qty", "Total Invoiced (₦)", "Total Payments (₦)", "WHT (₦)", "Balance Due (₦)", "Status"].filter(Boolean)];
    const body = summaryData.map(r => [
      r.client, ...(summaryTab === 'site' ? [r.site] : []),
      r.noOfInvoices, (r.totalInvoices || 0).toLocaleString(), (r.totalPayment || 0).toLocaleString(),
      (r.withholdingTax || 0).toLocaleString(), (r.balance || 0).toLocaleString(), r.status
    ]);
    generatePdf("Financial Summary Ledger", head as string[][], body, "financial_ledger.pdf");
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

  const FINANCIAL_REPORT_GROUPS = [
    {
      group: 'Revenue & Billing',
      color: 'indigo',
      fields: ['Invoice Summary', 'Outstanding Balances', 'Client Balances', 'Site Revenue', 'Overdue Invoices'],
    },
    {
      group: 'Collections & Payments',
      color: 'emerald',
      fields: ['Payment Summary', 'WHT Deductions', 'Discounts Applied', 'Payment by Client', 'Payment by Site'],
    },
    {
      group: 'Tax & Compliance',
      color: 'amber',
      fields: ['VAT Remittance', 'VAT Collected vs Remitted', 'WHT Summary by Client'],
    },
    {
      group: 'Performance',
      color: 'violet',
      fields: ['Collection Efficiency', 'Monthly Revenue Trend', 'Top Debtors', 'VAT Deficit Alert'],
    },
  ];

  const ALL_FINANCIAL_FIELDS = FINANCIAL_REPORT_GROUPS.flatMap(g => g.fields);

  const generateCustomReport = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one data point.'); return; }

    const wb = XLSX.utils.book_new();

    if (selectedFields.includes('Invoice Summary')) {
      const ws = XLSX.utils.json_to_sheet(invoices.map(i => ({ ID: i.id, Client: i.client, Site: i.siteName, Date: i.date, Amount: i.amount, Status: i.status, DueDate: i.dueDate || '', BillingCycle: i.billingCycle || '' })));
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    }
    if (selectedFields.includes('Payment Summary')) {
      const ws = XLSX.utils.json_to_sheet(payments.map(p => ({ ID: p.id, Client: p.client, Site: p.site, Date: p.date, Amount: p.amount, WHT: p.withholdingTax || 0, VAT: p.vat || 0, Discount: p.discount || 0 })));
      XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    }
    if (selectedFields.includes('Outstanding Balances')) {
      const ws = XLSX.utils.json_to_sheet(summaryData.filter(r => r.balance > 0).map(r => ({ Client: r.client, Site: r.site, Invoiced: r.totalInvoices, Paid: r.totalPayment, Balance: r.balance, Status: r.status })));
      XLSX.utils.book_append_sheet(wb, ws, 'Outstanding');
    }
    if (selectedFields.includes('Overdue Invoices')) {
      const today = new Date().toISOString().split('T')[0];
      const ws = XLSX.utils.json_to_sheet(rawInvoices.filter(i => i.status !== 'Paid' && i.dueDate && i.dueDate < today).map(i => ({ ID: i.id, Client: i.client, Site: i.siteName, Amount: i.amount, DueDate: i.dueDate, Status: i.status })));
      XLSX.utils.book_append_sheet(wb, ws, 'Overdue Invoices');
    }
    if (selectedFields.includes('VAT Remittance')) {
      const ws = XLSX.utils.json_to_sheet(vatPayments.map(v => ({ ID: v.id, Client: v.client, Month: v.month || '', Date: v.date, Amount: v.amount })));
      XLSX.utils.book_append_sheet(wb, ws, 'VAT Remittance');
    }
    if (selectedFields.includes('VAT Collected vs Remitted')) {
      const ws = XLSX.utils.json_to_sheet([{ VATCollected: globalStats.totalVATCollected, VATRemitted: globalStats.totalVATRemitted, VATDeficit: globalStats.vatDeficit }]);
      XLSX.utils.book_append_sheet(wb, ws, 'VAT Summary');
    }
    if (selectedFields.includes('WHT Deductions')) {
      const ws = XLSX.utils.json_to_sheet(payments.filter(p => (p.withholdingTax || 0) > 0).map(p => ({ Client: p.client, Site: p.site, Date: p.date, Amount: p.amount, WHT: p.withholdingTax })));
      XLSX.utils.book_append_sheet(wb, ws, 'WHT');
    }
    if (selectedFields.includes('WHT Summary by Client')) {
      const whtMap: Record<string, number> = {};
      payments.forEach(p => { if (p.withholdingTax) whtMap[p.client] = (whtMap[p.client] || 0) + p.withholdingTax; });
      const ws = XLSX.utils.json_to_sheet(Object.entries(whtMap).map(([client, total]) => ({ Client: client, TotalWHT: total })));
      XLSX.utils.book_append_sheet(wb, ws, 'WHT By Client');
    }
    if (selectedFields.includes('Discounts Applied')) {
      const ws = XLSX.utils.json_to_sheet(payments.filter(p => (p.discount || 0) > 0).map(p => ({ Client: p.client, Site: p.site, Date: p.date, Amount: p.amount, Discount: p.discount })));
      XLSX.utils.book_append_sheet(wb, ws, 'Discounts');
    }
    if (selectedFields.includes('Client Balances')) {
      const ws = XLSX.utils.json_to_sheet(summaryData.map(r => ({ Client: r.client, Invoiced: r.totalInvoices, Paid: r.totalPayment, Discount: r.discount, WHT: r.withholdingTax, VAT: r.vat, Balance: r.balance, Status: r.status })));
      XLSX.utils.book_append_sheet(wb, ws, 'Client Balances');
    }
    if (selectedFields.includes('Payment by Client')) {
      const clientPay: Record<string, number> = {};
      payments.forEach(p => { clientPay[p.client] = (clientPay[p.client] || 0) + p.amount; });
      const ws = XLSX.utils.json_to_sheet(Object.entries(clientPay).map(([client, total]) => ({ Client: client, TotalPaid: total })));
      XLSX.utils.book_append_sheet(wb, ws, 'Pay By Client');
    }
    if (selectedFields.includes('Payment by Site')) {
      const sitePay: Record<string, number> = {};
      payments.forEach(p => { sitePay[p.site] = (sitePay[p.site] || 0) + p.amount; });
      const ws = XLSX.utils.json_to_sheet(Object.entries(sitePay).map(([site, total]) => ({ Site: site, TotalPaid: total })));
      XLSX.utils.book_append_sheet(wb, ws, 'Pay By Site');
    }
    if (selectedFields.includes('Site Revenue')) {
      const ws = XLSX.utils.json_to_sheet(siteFinancialData.map(s => ({ Site: s.name, PaidInvoices: s.paid, PendingInvoices: s.pending, Total: s.paid + s.pending })));
      XLSX.utils.book_append_sheet(wb, ws, 'Site Revenue');
    }
    if (selectedFields.includes('Collection Efficiency')) {
      const ws = XLSX.utils.json_to_sheet([{ TotalBilled: globalStats.totalBilled, TotalCollected: globalStats.totalCollectedCash, TotalWHT: globalStats.totalWHT, TotalDiscount: globalStats.totalDiscount, TotalOutstanding: globalStats.totalOutstanding, CollectionRate: `${collectionRate}%`, VATCollected: globalStats.totalVATCollected, VATRemitted: globalStats.totalVATRemitted, VATDeficit: globalStats.vatDeficit }]);
      XLSX.utils.book_append_sheet(wb, ws, 'Efficiency');
    }
    if (selectedFields.includes('Monthly Revenue Trend')) {
      const ws = XLSX.utils.json_to_sheet(trendData.map(t => ({ Month: t.month, Billed: t.Billed, Collected: t.Collected })));
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Trend');
    }
    if (selectedFields.includes('Top Debtors')) {
      const ws = XLSX.utils.json_to_sheet(clientDebtData.map(d => ({ Name: d.name, Billed: d.Billed, Cleared: d.Cleared, Outstanding: d.Outstanding })));
      XLSX.utils.book_append_sheet(wb, ws, 'Top Debtors');
    }
    if (selectedFields.includes('VAT Deficit Alert')) {
      const ws = XLSX.utils.json_to_sheet([{ VATCollected: globalStats.totalVATCollected, VATRemitted: globalStats.totalVATRemitted, Deficit: globalStats.vatDeficit, DeficitPct: globalStats.totalVATCollected > 0 ? `${Math.round((globalStats.vatDeficit / globalStats.totalVATCollected) * 100)}%` : '0%' }]);
      XLSX.utils.book_append_sheet(wb, ws, 'VAT Alert');
    }

    XLSX.writeFile(wb, 'Custom_Financial_Report.xlsx');
    showExportMessage('Custom Financial Report (Excel) generated!');
  };

  const generateCustomReportPdf = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one data point.'); return; }
    // Build a single-sheet summary PDF of selected metrics
    const head = [['Metric', 'Value']];
    const body: string[][] = [];
    if (selectedFields.includes('Invoice Summary') || selectedFields.includes('Revenue & Billing')) {
      body.push(['Total Invoices', invoices.length.toString()]);
      body.push(['Total Billed', `₦${globalStats.totalBilled.toLocaleString()}`]);
    }
    if (selectedFields.includes('Payment Summary') || selectedFields.includes('Collections & Payments')) {
      body.push(['Total Payments (Cash)', `₦${globalStats.totalCollectedCash.toLocaleString()}`]);
      body.push(['Total WHT', `₦${globalStats.totalWHT.toLocaleString()}`]);
      body.push(['Total Discounts', `₦${globalStats.totalDiscount.toLocaleString()}`]);
    }
    if (selectedFields.includes('Outstanding Balances') || selectedFields.includes('Client Balances')) {
      body.push(['Outstanding Receivables', `₦${globalStats.totalOutstanding.toLocaleString()}`]);
    }
    if (selectedFields.includes('Collection Efficiency')) {
      body.push(['Collection Efficiency Rate', `${collectionRate}%`]);
    }
    if (selectedFields.includes('VAT Remittance') || selectedFields.includes('VAT Collected vs Remitted')) {
      body.push(['VAT Collected', `₦${globalStats.totalVATCollected.toLocaleString()}`]);
      body.push(['VAT Remitted', `₦${globalStats.totalVATRemitted.toLocaleString()}`]);
      body.push(['VAT Deficit', `₦${globalStats.vatDeficit.toLocaleString()}`]);
    }
    if (selectedFields.includes('Site Revenue')) {
      siteFinancialData.forEach(s => body.push([`Site: ${s.name}`, `₦${(s.paid + s.pending).toLocaleString()} total (₦${s.paid.toLocaleString()} paid)`]));
    }
    if (selectedFields.includes('Top Debtors')) {
      clientDebtData.slice(0, 5).forEach(d => body.push([`Debtor: ${d.name}`, `₦${d.Outstanding.toLocaleString()} outstanding`]));
    }
    if (body.length === 0) {
      body.push(['Selected fields', 'No numeric summary available — use Excel export for full detail.']);
    }
    generatePdf(`Financial Report Summary (${filterYear === 'All' ? 'All Time' : filterYear})`, head, body, 'custom_financial_report.pdf');
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {exportMessage && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5" />{exportMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
            Financial Reports & Analytics
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Revenue insights, collection analysis, and compliance reporting.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 text-slate-800">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide">Filters</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Year</span>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
              className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32">
              <option value="All">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Client</span>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
              className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 md:w-48">
              <option value="All">All Clients</option>
              {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Billed</p>
                <h3 className="text-2xl font-bold font-mono text-slate-800">{formatCurrCompact(globalStats.totalBilled)}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><Receipt className="w-5 h-5" /></div>
            </div>
            <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
              Across {invoices.length} invoices
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
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><Wallet className="w-5 h-5" /></div>
            </div>
            <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
              + {formatCurrCompact(globalStats.totalWHT)} WHT
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 border-l-4 border-l-amber-500">
          <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Total Receivables</p>
                <h3 className="text-2xl font-bold font-mono text-amber-600">{formatCurrCompact(globalStats.totalOutstanding)}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Activity className="w-5 h-5" /></div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${100 - collectionRate}%` }}></div>
            </div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase mt-1 tracking-wide">{collectionRate}% Collection Efficiency</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 border-l-4 border-l-rose-500">
          <CardContent className="p-5 flex flex-col justify-between h-full relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">VAT Liability</p>
                <h3 className="text-2xl font-bold font-mono text-rose-600">{formatCurrCompact(globalStats.vatDeficit)}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600"><Landmark className="w-5 h-5" /></div>
            </div>
            <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md inline-flex items-center gap-1 self-start">
              Collected: {formatCurrCompact(globalStats.totalVATCollected)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FINANCIAL SUMMARY LEDGER - Featured at top */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-0 pt-4 px-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Financial Summary Ledger</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportLedgerPdf}>
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
          </div>
          <div className="flex px-5 gap-6 border-b border-slate-200">
            <button className={`pb-3 text-sm font-semibold transition-all border-b-2 ${summaryTab === 'client' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setSummaryTab('client')}>Client Summary</button>
            <button className={`pb-3 text-sm font-semibold transition-all border-b-2 ${summaryTab === 'site' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setSummaryTab('site')}>Site Summary</button>
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
                  <TableCell className="px-5 py-3 text-right font-mono font-medium text-slate-700">{row.totalInvoices ? row.totalInvoices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-3 text-right font-mono font-medium text-emerald-700">{row.totalPayment ? row.totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-3 text-right font-mono text-slate-400">{row.discount ? row.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-3 text-right font-mono text-indigo-600/70">{row.withholdingTax ? row.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-3 text-right font-mono text-indigo-600/70">{row.vat ? row.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className={`px-5 py-3 text-right font-mono font-bold ${row.balance > 0 ? 'text-rose-600' : row.balance < 0 ? 'text-slate-500' : 'text-emerald-600'}`}>
                    {row.balance !== 0 ? (row.balance < 0 ? `(${Math.abs(row.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-'}
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
              {summaryData.length > 0 && (
                <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-4 border-indigo-500 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] relative z-10">
                  <TableCell colSpan={summaryTab === 'site' ? 2 : 1} className="px-5 py-4 font-bold text-slate-200 text-sm tracking-wider uppercase">Grand Total</TableCell>
                  <TableCell className="px-5 py-4 text-center font-bold text-slate-300 bg-slate-800/80 rounded-sm">{summaryData.reduce((sum, r) => sum + r.noOfInvoices, 0)}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-bold text-slate-200">{globalStats.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-bold text-emerald-400">{globalStats.totalCollectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-medium text-slate-400">{globalStats.totalDiscount ? globalStats.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-medium text-indigo-300">{globalStats.totalWHT ? globalStats.totalWHT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-medium text-indigo-300">{globalStats.totalVATCollected ? globalStats.totalVATCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                  <TableCell className="px-5 py-4 text-right font-mono font-bold text-rose-400 bg-rose-950/20">{globalStats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="px-5 py-4"></TableCell>
                </TableRow>
              )}
              {summaryData.length === 0 && (
                <TableRow><TableCell colSpan={10} className="px-4 py-12 text-center text-slate-500 font-medium">No data available.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200 col-span-1 lg:col-span-2 flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Cash Flow Velocity</CardTitle>
            </div>
            <CardDescription>Billed Revenue vs Cash Collected over time.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 min-h-[300px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBilledR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorCollectedR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.8} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${val / 1000000}M`} />
                  <RechartsTooltip formatter={(value: number | undefined) => formatCurr(value ?? 0)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                  <Area type="monotone" dataKey="Billed" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBilledR)" />
                  <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCollectedR)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm">Not enough data to map trends.</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                    <Pie data={vatPieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                      <Cell fill="#10b981" /><Cell fill="#f43f5e" />
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
                <AlertCircle className="w-8 h-8 opacity-20 mx-auto mb-2" /><p>No VAT collected yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debtors Chart */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-sm text-slate-800 uppercase tracking-wide">Receivables Risk Analysis</CardTitle>
            </div>
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              <button className={`px-3 py-1 text-xs font-semibold rounded transition-all ${debtorView === 'client' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setDebtorView('client')}>By Client</button>
              <button className={`px-3 py-1 text-xs font-semibold rounded transition-all ${debtorView === 'site' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setDebtorView('site')}>By Site</button>
            </div>
          </div>
          <CardDescription>Highest outstanding balances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-5">
          {clientDebtData.length > 0 ? (
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={250} className="min-w-[600px]">
                <BarChart data={clientDebtData} layout="vertical" margin={{ top: 10, right: 30, left: debtorView === 'site' ? 80 : 20, bottom: 5 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₦${(val / 1000000)}M`} />
                  <YAxis type="category" dataKey="name" width={debtorView === 'site' ? 180 : 100} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(value: number | undefined) => formatCurr(value ?? 0)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '13px' }} />
                  <Bar dataKey="Cleared" stackId="a" fill="#cbd5e1" name="Received" />
                  <Bar dataKey="Outstanding" stackId="a" fill="#f59e0b" name="Outstanding" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 font-medium">
              <Activity className="w-10 h-10 opacity-20 mx-auto mb-3" /><p>No outstanding balances.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Revenue Chart */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
            <BarChart3 className="h-5 w-5 text-indigo-600" /> Revenue by Site
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={siteFinancialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000000 ? `₦${(value / 1000000).toFixed(1)}M` : `₦${(value / 1000).toFixed(0)}k`} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number | undefined) => `₦${(value ?? 0).toLocaleString()}`} />
                <Legend verticalAlign="bottom" height={36} />
                <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid Invoice" />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending Invoice" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Export Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Invoice Report</CardTitle>
            <Receipt className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Full invoice listing with client, site, amounts, and status.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportInvoiceReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportInvoicePdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Payment Report</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Payment records with WHT, VAT, and discount breakdowns.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportPaymentReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportPaymentPdf}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">VAT Remittance</CardTitle>
            <Landmark className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Track VAT collected vs remitted to FIRS for compliance.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportVatReport}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Financial Report Builder */}
      <Card className="bg-white border-slate-200 mb-6">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-slate-900">Custom Financial Report Builder</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Pick the data modules you need — export as a multi-sheet Excel or a PDF summary.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedFields(selectedFields.length === ALL_FINANCIAL_FIELDS.length ? [] : ALL_FINANCIAL_FIELDS)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
              >
                {selectedFields.length === ALL_FINANCIAL_FIELDS.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-slate-400">{selectedFields.length} / {ALL_FINANCIAL_FIELDS.length} modules</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar border-b border-slate-100">
              {FINANCIAL_REPORT_GROUPS.map(group => {
                const isActive = activeFinBuilderTab === group.group;
                const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
                return (
                  <button
                    key={group.group}
                    onClick={() => setActiveFinBuilderTab(group.group)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                      isActive 
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {group.group}
                    {groupSelectedCount > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                        {groupSelectedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            {FINANCIAL_REPORT_GROUPS.filter(g => g.group === activeFinBuilderTab).map(group => {
              const checkColor: Record<string, string> = {
                indigo:  'accent-indigo-600',
                emerald: 'accent-emerald-600',
                amber:   'accent-amber-500',
                violet:  'accent-violet-600',
              };
              const allGroupSelected = group.fields.every(f => selectedFields.includes(f));
              return (
                <div key={group.group} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-medium text-slate-500">Select modules to include in your report:</p>
                    <button
                      onClick={() => {
                        if (allGroupSelected) {
                          setSelectedFields(prev => prev.filter(f => !group.fields.includes(f)));
                        } else {
                          setSelectedFields(prev => [...new Set([...prev, ...group.fields])]);
                        }
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {allGroupSelected ? '- Deselect Group' : '+ Select Group'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                    {group.fields.map(field => (
                      <label key={field} className="flex items-start gap-3 text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900 transition-colors bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field)}
                          onChange={() => toggleField(field)}
                          className={`mt-0.5 h-4 w-4 rounded border-slate-300 ${checkColor[group.color]} transition-all`}
                        />
                        <span className="leading-tight">{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Preview bar */}
            {selectedFields.length > 0 && (
              <div className="flex items-start sm:items-center gap-3 text-xs text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 sm:px-4 sm:py-3 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  Report will include <strong className="text-indigo-700">{selectedFields.length} module{selectedFields.length > 1 ? 's' : ''}</strong>. Excel = one sheet per module. PDF = key metric summary.
                  <div className="text-indigo-600/80 italic mt-0.5">{selectedFields.slice(0, 5).join(', ')}{selectedFields.length > 5 ? ` +${selectedFields.length - 5} more` : ''}</div>
                </div>
              </div>
            )}

            {/* Export buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={generateCustomReport}
                disabled={selectedFields.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={generateCustomReportPdf}
                disabled={selectedFields.length === 0}
              >
                <FileText className="h-4 w-4" /> Export PDF Summary
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── ACCOUNTS REPORTS ───────────────── */}
      <Card className="bg-white border-slate-200 mb-6">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border text-amber-700 bg-amber-50 border-amber-200">Accounts</span>
              Financial Staff Reports
            </CardTitle>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setAccountsTab('payroll')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  accountsTab === 'payroll' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <FileText className="h-3.5 w-3.5" /> Payroll Summary
              </button>
              <button onClick={() => setAccountsTab('loans')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  accountsTab === 'loans' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Loans & Advances
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {accountsTab === 'payroll' ? (
            /* ── PAYROLL SUMMARY ── */
            (() => {
              const MONTH_KEYS: (keyof typeof employees[0]['monthlySalaries'])[] = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
              const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const activeEmps = employees.filter(e => e.status === 'Active');

              const exportPayrollCsv = () => {
                let csv = 'data:text/csv;charset=utf-8,';
                csv += `Employee,Department,Position,${monthLabels.join(',')},Annual Total\n`;
                activeEmps.forEach(emp => {
                  const monthVals = MONTH_KEYS.map(k => emp.monthlySalaries?.[k] ?? 0);
                  const annual = monthVals.reduce((s, v) => s + v, 0);
                  csv += `"${emp.surname} ${emp.firstname}",${emp.department},${emp.position},${monthVals.join(',')},${annual}\n`;
                });
                const link = document.createElement('a');
                link.setAttribute('href', encodeURI(csv));
                link.setAttribute('download', `payroll_summary_${payrollYear}.csv`);
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                showExportMessage('Payroll Summary (CSV) exported!');
              };

              const exportPayrollPdf = () => {
                const head = [['Employee', 'Dept', ...monthLabels, 'Annual']];
                const body = activeEmps.map(emp => {
                  const monthVals = MONTH_KEYS.map(k => (emp.monthlySalaries?.[k] ?? 0).toLocaleString());
                  const annual = MONTH_KEYS.reduce((s, k) => s + (emp.monthlySalaries?.[k] ?? 0), 0);
                  return [`${emp.surname} ${emp.firstname}`, emp.department, ...monthVals, annual.toLocaleString()];
                });
                generatePdf(`Payroll Summary ${payrollYear}`, head, body, `payroll_summary_${payrollYear}.pdf`);
              };

              return (
                <>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Year:</label>
                      <select value={payrollYear} onChange={e => setPayrollYear(Number(e.target.value))}
                        className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportPayrollCsv}>
                        <FileSpreadsheet className="h-4 w-4" /> CSV
                      </Button>
                      <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={exportPayrollPdf}>
                        <FileText className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
                        <Table>
                          <TableHeader className="sticky top-0 z-10">
                            <TableRow className="bg-gradient-to-r from-amber-700 to-amber-600">
                              <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap sticky left-0 bg-amber-700 z-20">Employee</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Dept</TableHead>
                              {monthLabels.map(m => (
                                <TableHead key={m} className="text-white font-semibold py-2 px-3 whitespace-nowrap text-right">{m}</TableHead>
                              ))}
                              <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap text-right bg-amber-900/40">Annual</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeEmps.length === 0 ? (
                              <TableRow><TableCell colSpan={15} className="text-center py-8 text-slate-400">No active employees.</TableCell></TableRow>
                            ) : (
                              <>
                                {activeEmps.map((emp, idx) => {
                                  const annual = MONTH_KEYS.reduce((s, k) => s + (emp.monthlySalaries?.[k] ?? 0), 0);
                                  return (
                                    <TableRow key={emp.id} className={`hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                      <TableCell className={`py-1.5 px-3 text-sm font-medium text-slate-800 whitespace-nowrap sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                        {emp.surname} {emp.firstname}
                                      </TableCell>
                                      <TableCell className="py-1.5 px-3 text-xs text-slate-500 whitespace-nowrap">{emp.department}</TableCell>
                                      {MONTH_KEYS.map(k => (
                                        <TableCell key={k} className="py-1.5 px-3 text-xs text-right text-slate-700">
                                          {(emp.monthlySalaries?.[k] ?? 0).toLocaleString()}
                                        </TableCell>
                                      ))}
                                      <TableCell className="py-1.5 px-3 text-xs text-right font-bold text-amber-700 bg-amber-50/60">
                                        {annual.toLocaleString()}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {/* Totals row */}
                                <TableRow className="bg-slate-900 hover:bg-slate-900 sticky bottom-0 z-10">
                                  <TableCell className="text-white font-semibold py-2 px-3 sticky left-0 bg-slate-900 text-sm">Team Total</TableCell>
                                  <TableCell className="py-2 px-3"></TableCell>
                                  {MONTH_KEYS.map(k => (
                                    <TableCell key={k} className="text-right text-amber-300 font-semibold text-xs py-2 px-3">
                                      {activeEmps.reduce((s, e) => s + (e.monthlySalaries?.[k] ?? 0), 0).toLocaleString()}
                                    </TableCell>
                                  ))}
                                  <TableCell className="text-right text-white font-bold text-xs py-2 px-3 bg-amber-900/40">
                                    {activeEmps.reduce((s, e) => s + MONTH_KEYS.reduce((ms, k) => ms + (e.monthlySalaries?.[k] ?? 0), 0), 0).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            /* ── LOANS & ADVANCES ── */
            (() => {
              const activeLoans = loans.filter(l => l.status === 'Active' || l.status === 'Approved');
              const pendingAdvances = salaryAdvances.filter(a => a.status !== 'Deducted');

              const exportLoansCsv = () => {
                let csv = 'data:text/csv;charset=utf-8,';
                csv += 'Type,Employee,Loan Type,Principal,Monthly Deduction,Remaining Balance,Duration,Start Date,Status\n';
                loans.forEach(l => {
                  csv += `Loan,"${l.employeeName}","${l.loanType}",${l.principalAmount},${l.monthlyDeduction},${l.remainingBalance},${l.duration} months,${l.startDate},${l.status}\n`;
                });
                salaryAdvances.forEach(a => {
                  csv += `Advance,"${a.employeeName}",,${a.amount},,,,,${a.status}\n`;
                });
                const link = document.createElement('a');
                link.setAttribute('href', encodeURI(csv));
                link.setAttribute('download', 'loans_advances_report.csv');
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                showExportMessage('Loans & Advances (CSV) exported!');
              };

              const exportLoansPdf = () => {
                const head = [['Type', 'Employee', 'Loan Type', 'Principal', 'Monthly Ded.', 'Balance', 'Status']];
                const body = [
                  ...loans.map(l => ['Loan', l.employeeName, l.loanType, l.principalAmount.toLocaleString(), l.monthlyDeduction.toLocaleString(), l.remainingBalance.toLocaleString(), l.status]),
                  ...salaryAdvances.map(a => ['Advance', a.employeeName, '-', a.amount.toLocaleString(), '-', '-', a.status]),
                ];
                generatePdf('Loans & Advances Report', head, body, 'loans_advances_report.pdf');
              };

              return (
                <>
                  {/* Summary tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    {[
                      { label: 'Active Loans', value: activeLoans.length, color: 'amber' },
                      { label: 'Total Loan Balance', value: `₦${activeLoans.reduce((s, l) => s + l.remainingBalance, 0).toLocaleString()}`, color: 'amber' },
                      { label: 'Pending Advances', value: pendingAdvances.length, color: 'rose' },
                      { label: 'Total Advance Amount', value: `₦${pendingAdvances.reduce((s, a) => s + a.amount, 0).toLocaleString()}`, color: 'rose' },
                    ].map(tile => (
                      <div key={tile.label} className={`rounded-xl border p-4 ${
                        tile.color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                      }`}>
                        <div className={`text-lg font-bold ${
                          tile.color === 'amber' ? 'text-amber-800' : 'text-rose-800'
                        }`}>{tile.value}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{tile.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mb-4">
                    <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportLoansCsv}>
                      <FileSpreadsheet className="h-4 w-4" /> CSV
                    </Button>
                    <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={exportLoansPdf}>
                      <FileText className="h-4 w-4" /> PDF
                    </Button>
                  </div>

                  {/* Loans table */}
                  <div className="mb-6">
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2 px-1">Staff Loans</div>
                    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-amber-700 to-amber-600">
                              <TableHead className="text-white font-semibold py-2 px-3">Employee</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3">Loan Type</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-right">Principal</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-right">Monthly Deduction</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-right">Remaining Balance</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-center">Duration</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3">Start Date</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loans.length === 0 ? (
                              <TableRow><TableCell colSpan={8} className="text-center py-6 text-slate-400">No loan records.</TableCell></TableRow>
                            ) : loans.map((loan, idx) => (
                              <TableRow key={loan.id} className={`hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <TableCell className="py-1.5 px-3 text-sm font-medium text-slate-800">{loan.employeeName}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-slate-600">{loan.loanType}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-right text-slate-700">₦{loan.principalAmount.toLocaleString()}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-right text-slate-700">₦{loan.monthlyDeduction.toLocaleString()}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-right font-semibold text-amber-700">₦{loan.remainingBalance.toLocaleString()}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-center text-slate-600">{loan.duration}m</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-slate-600 whitespace-nowrap">{loan.startDate}</TableCell>
                                <TableCell className="py-1.5 px-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    loan.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                                    loan.status === 'Completed' ? 'bg-slate-100 text-slate-500' :
                                    loan.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>{loan.status}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>

                  {/* Salary Advances table */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-rose-700 mb-2 px-1">Salary Advances</div>
                    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-rose-700 to-rose-600">
                              <TableHead className="text-white font-semibold py-2 px-3">Employee</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-right">Amount</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3">Request Date</TableHead>
                              <TableHead className="text-white font-semibold py-2 px-3 text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {salaryAdvances.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-400">No salary advance records.</TableCell></TableRow>
                            ) : salaryAdvances.map((adv, idx) => (
                              <TableRow key={adv.id} className={`hover:bg-rose-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <TableCell className="py-1.5 px-3 text-sm font-medium text-slate-800">{adv.employeeName}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-right font-semibold text-rose-700">₦{adv.amount.toLocaleString()}</TableCell>
                                <TableCell className="py-1.5 px-3 text-sm text-slate-600 whitespace-nowrap">{adv.requestDate}</TableCell>
                                <TableCell className="py-1.5 px-3 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    adv.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                    adv.status === 'Deducted' ? 'bg-slate-100 text-slate-500' :
                                    adv.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>{adv.status}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
