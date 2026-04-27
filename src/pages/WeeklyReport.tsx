import { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval, addWeeks, subWeeks } from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Users, Fuel, Truck, BookOpen, UserPlus, 
  Activity, MapPin, Download, Calendar, BarChart2, Wallet, 
  CreditCard, MessageSquare, ShieldAlert, FileText, LayoutDashboard,
  ClipboardCheck, TrendingDown, TrendingUp, X, Printer, Search, History
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";

function getWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return { start, end };
}

function inWeek(dateStr: string, start: Date, end: Date) {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr.split('T')[0]);
    return isWithinInterval(d, { start, end });
  } catch {
    return false;
  }
}

export function WeeklyReport() {
  const [anchor, setAnchor] = useState(new Date());
  const { start, end } = getWeekRange(anchor);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Store data ────────────────────────────────────────
  const sites            = useAppStore(s => s.sites);
  const employees        = useAppStore(s => s.employees);
  const attendance       = useAppStore(s => s.attendanceRecords);
  const vehicleTrips     = useAppStore(s => s.vehicleTrips);
  const journals         = useAppStore(s => s.dailyJournals);
  const journalEntries   = useAppStore(s => s.siteJournalEntries);
  const commLogs         = useAppStore(s => s.commLogs);
  const ledgerEntries    = useAppStore(s => s.ledgerEntries);
  const payments         = useAppStore(s => s.payments);
  const vatPayments      = useAppStore(s => s.vatPayments);
  const companyExpenses  = useAppStore(s => s.companyExpenses);
  const meritRecords     = useAppStore(s => s.staffMeritRecords);
  const disciplinary     = useAppStore(s => s.disciplinaryRecords);
  const evaluations      = useAppStore(s => s.evaluations);
  const leaves           = useAppStore(s => s.leaves);

  const { dailyMachineLogs, waybills } = useOperations();

  // ── Week-filtered data ────────────────────────────────
  const weekAttendance = useMemo(() => attendance.filter(r => inWeek(r.date, start, end)), [attendance, start, end]);
  const weekMachineLogs = useMemo(() => dailyMachineLogs.filter(l => inWeek(l.date, start, end)), [dailyMachineLogs, start, end]);
  const weekTrips = useMemo(() => vehicleTrips.filter(t => inWeek(t.departure_time, start, end)), [vehicleTrips, start, end]);
  const weekJournals = useMemo(() => journals.filter(j => inWeek(j.date, start, end)), [journals, start, end]);
  const weekJournalEntries = useMemo(() => {
    const ids = new Set(weekJournals.map(j => j.id));
    return journalEntries.filter(e => ids.has(e.journalId));
  }, [weekJournals, journalEntries]);
  
  const weekNewEmployees = useMemo(() => employees.filter(e => e.startDate && inWeek(e.startDate, start, end)), [employees, start, end]);
  const weekMerits = useMemo(() => meritRecords.filter(r => inWeek(r.incidentDate, start, end)), [meritRecords, start, end]);
  const weekDisciplinary = useMemo(() => disciplinary.filter(r => inWeek(r.date, start, end)), [disciplinary, start, end]);
  const weekEvaluations = useMemo(() => evaluations.filter(r => inWeek(r.date, start, end)), [evaluations, start, end]);
  const weekLeaves = useMemo(() => leaves.filter(r => inWeek(r.startDate, start, end) || inWeek(r.expectedEndDate, start, end)), [leaves, start, end]);

  const weekCommLogs = useMemo(() => commLogs.filter(l => inWeek(l.date, start, end)), [commLogs, start, end]);
  const weekExternalComm = weekCommLogs.filter(l => !l.isInternal);
  const weekInternalComm = weekCommLogs.filter(l => l.isInternal);

  const weekLedger = useMemo(() => ledgerEntries.filter(e => inWeek(e.date, start, end)), [ledgerEntries, start, end]);
  const weekPayments = useMemo(() => payments.filter(p => inWeek(p.date, start, end)), [payments, start, end]);
  const weekVats = useMemo(() => vatPayments.filter(v => inWeek(v.date, start, end)), [vatPayments, start, end]);
  const weekCompanyExpenses = useMemo(() => companyExpenses.filter(e => inWeek(e.date, start, end)), [companyExpenses, start, end]);

  // ── Summary Stats ─────────────────────────────────────
  const uniqueStaffDeployed = useMemo(() => new Set(weekAttendance.filter(r => r.day === 'Yes' || r.night === 'Yes').map(r => r.staffId)).size, [weekAttendance]);
  const totalAbsences = useMemo(() => weekAttendance.filter(r => r.absentStatus && r.absentStatus !== '').length, [weekAttendance]);
  const totalDiesel   = useMemo(() => weekMachineLogs.reduce((s, l) => s + l.dieselUsage, 0), [weekMachineLogs]);
  const totalIncome   = useMemo(() => weekPayments.reduce((s, p) => s + p.amount, 0), [weekPayments]);
  const totalExpenses = useMemo(() => weekLedger.reduce((s, e) => s + e.amount, 0) + weekCompanyExpenses.reduce((s, e) => s + e.amount, 0), [weekLedger, weekCompanyExpenses]);

  // ── Per-site machine summary ─────────────────────────
  const siteMachineSummary = useMemo(() => {
    const map: Record<string, { siteName: string; machines: Record<string, { assetName: string; logs: typeof weekMachineLogs }> }> = {};
    weekMachineLogs.forEach(log => {
      if (!map[log.siteId]) map[log.siteId] = { siteName: log.siteName, machines: {} };
      if (!map[log.siteId].machines[log.assetId]) map[log.siteId].machines[log.assetId] = { assetName: log.assetName, logs: [] };
      map[log.siteId].machines[log.assetId].logs.push(log);
    });
    return Object.values(map);
  }, [weekMachineLogs]);

  const weekLabel = `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;

  // ── Page Header ───────────────────────────────────────
  useSetPageTitle(
    'Weekly Operations Report',
    'Aggregated enterprise activity and financial summaries for the week',
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm mr-2">
        <button onClick={() => setAnchor(a => subWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all text-slate-600 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-[11px] font-bold text-slate-700 min-w-[180px] text-center font-mono">{weekLabel}</span>
        <button onClick={() => setAnchor(a => addWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all text-slate-600 hover:text-blue-600">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <Button variant="outline" size="sm" onClick={handleExportXLSX} className="gap-2 h-9 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
        <Download className="h-3.5 w-3.5 text-indigo-500" /> Export Excel
      </Button>
      <Button size="sm" onClick={() => generateProfessionalPDF('preview')} className="gap-2 h-9 bg-slate-900 hover:bg-black text-white font-bold text-[11px] uppercase tracking-tight shadow-lg shadow-slate-200">
        <FileText className="h-3.5 w-3.5" /> View PDF Report
      </Button>
    </div>
  );

  // ── Professional PDF Generation ───────────────────────
  async function generateProfessionalPDF(mode: 'preview' | 'download') {
    setIsGenerating(true);
    const doc = new jsPDF();
    const primaryColor = [15, 23, 42]; // slate-900
    const accentColor = [37, 99, 235]; // blue-600
    const textColor = [51, 65, 85]; // slate-700
    const headerTextColor = [255, 255, 255];
    
    const periodStr = `${format(start, 'dd MMM yyyy')} - ${format(end, 'dd MMM yyyy')}`;

    // 1. HEADER SECTION
    // Dark background header bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 45, 'F');
    
    // Title & Subtitle
    doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SPARK BEGINNINGS', 15, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('WEEKLY OPERATIONS & PERFORMANCE LEDGER', 15, 28);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(periodStr.toUpperCase(), 210 - 15, 28, { align: 'right' });
    
    // Bottom border for header
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(2);
    doc.line(0, 45, 210, 45);

    let currentY = 55;

    // 2. EXECUTIVE SUMMARY GRID
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 15, currentY);
    currentY += 8;

    autoTable(doc, {
      startY: currentY,
      head: [['METRIC', 'VALUE', 'METRIC', 'VALUE']],
      body: [
        ['Staff Deployed', uniqueStaffDeployed.toString(), 'Diesel Consumed', `${totalDiesel.toFixed(1)} L`],
        ['Net Cashflow', `NGN ${ (totalIncome - totalExpenses).toLocaleString() }`, 'Total Absences', totalAbsences.toString()],
        ['Movement Logs', weekTrips.length.toString(), 'Communications', weekCommLogs.length.toString()]
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [100, 116, 139], width: 40 },
        1: { fontStyle: 'bold', textColor: primaryColor, width: 50 },
        2: { fontStyle: 'bold', textColor: [100, 116, 139], width: 40 },
        3: { fontStyle: 'bold', textColor: primaryColor, width: 50 }
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 3. HUMAN RESOURCES SECTION
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('01. HUMAN RESOURCES', 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['STAFF NAME', 'POSITION', 'SITE LOCATION', 'SHIFTS', 'STATUS']],
      body: weekAttendance.map(r => [
        r.staffName.toUpperCase(),
        r.position,
        r.daySite || r.nightSite || 'N/A',
        `${r.day === 'Yes' ? 'DAY' : ''}${r.day === 'Yes' && r.night === 'Yes' ? ' & ' : ''}${r.night === 'Yes' ? 'NIGHT' : ''}`,
        r.absentStatus || 'PRESENT'
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: primaryColor, textColor: headerTextColor, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 4. OPERATIONS & MACHINE ACTIVITY
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('02. OPERATIONS & MACHINES', 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['DATE', 'SITE', 'MACHINE', 'STATUS', 'DIESEL', 'SUPERVISOR']],
      body: weekMachineLogs.map(l => [
        l.date,
        l.siteName,
        l.assetName,
        l.isActive ? 'OPERATIONAL' : 'DOWN',
        `${l.dieselUsage} L`,
        l.supervisorOnSite || 'N/A'
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: primaryColor, textColor: headerTextColor, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 5. FINANCIALS
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('03. FINANCIAL SUMMARY', 15, currentY);
    currentY += 5;

    const financeBody = [
      ...weekPayments.map(p => [p.date, 'REVENUE', p.client || 'N/A', 'CLIENT PAYMENT', p.amount]),
      ...weekLedger.map(e => [e.date, 'EXPENSE', e.site || 'N/A', e.description || 'N/A', -e.amount]),
      ...weekVats.map(v => [v.date, 'TAX', v.client || 'N/A', 'VAT PAYMENT', -v.amount]),
      ...weekCompanyExpenses.map(e => [e.date, 'OVERHEAD', 'COMPANY', e.description || 'N/A', -e.amount])
    ].sort((a: any, b: any) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    autoTable(doc, {
      startY: currentY,
      head: [['DATE', 'CLASS', 'TARGET', 'PARTICULARS', 'AMOUNT']],
      body: financeBody.map(row => [
        row[0], row[1], row[2], row[3], 
        new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(row[4] as number)
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: primaryColor, textColor: headerTextColor, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });

    // 6. FOOTER (PAGE NUMBERS)
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Spark Beginnings Internal Operations Report | Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 285);
      doc.text(`Page ${i} of ${pageCount}`, 210 - 15, 285, { align: 'right' });
    }

    if (mode === 'download') {
      doc.save(`Weekly_Report_${format(start, 'yyyy_MM_dd')}.pdf`);
    } else {
      const blobUrl = doc.output('bloburl').toString();
      setPdfPreviewUrl(blobUrl);
      setIsPreviewOpen(true);
    }
    setIsGenerating(false);
  }

  // ── Export XLSX ────────────────────────────────────────
  function handleExportXLSX() {
    const wb = XLSX.utils.book_new();

    // Attendance
    const attRows = weekAttendance.map(r => ({
      Date: r.date, Staff: r.staffName, Position: r.position,
      'Day Site': r.daySite, 'Night Site': r.nightSite,
      Present: r.day === 'Yes' || r.night === 'Yes' ? 'Yes' : 'No',
      Absent: r.absentStatus || '', OT: r.overtimeDetails || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), 'Attendance');

    // Machine Logs
    const machineRows = weekMachineLogs.map(l => ({
      Date: l.date, Site: l.siteName, Machine: l.assetName,
      Status: l.isActive ? 'Operational' : 'Down',
      'Diesel (L)': l.dieselUsage, Supervisor: l.supervisorOnSite || '',
      Issues: l.issuesOnSite || '', Maintenance: l.maintenanceDetails || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machineRows), 'Operations');

    // Financials
    const financeRows = [
      ...weekPayments.map(p => ({ Date: p.date, Type: 'Income', Target: p.client, Detail: 'Payment', Amount: p.amount })),
      ...weekLedger.map(e => ({ Date: e.date, Type: 'Site Expense', Target: e.site, Detail: e.description, Amount: -e.amount })),
      ...weekVats.map(v => ({ Date: v.date, Type: 'VAT Paid', Target: v.client, Detail: 'VAT', Amount: -v.amount })),
      ...weekCompanyExpenses.map(e => ({ Date: e.date, Type: 'General Exp', Target: 'Company', Detail: e.description, Amount: -e.amount }))
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(financeRows), 'Financials');

    XLSX.writeFile(wb, `Weekly_Report_${format(start, 'dd-MMM-yyyy')}.xlsx`);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/50 overflow-hidden font-sans pb-10">
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Staff Deployed', value: uniqueStaffDeployed, icon: Users, color: 'text-blue-600 bg-blue-100/50' },
            { label: 'Diesel Consumed', value: `${totalDiesel.toFixed(0)}L`, icon: Fuel, color: 'text-amber-600 bg-amber-100/50' },
            { label: 'Net Cashflow', value: (totalIncome - totalExpenses).toLocaleString(), icon: Wallet, color: totalIncome >= totalExpenses ? 'text-emerald-600 bg-emerald-100/50' : 'text-rose-600 bg-rose-100/50', isCurrency: true },
            { label: 'Communications', value: weekCommLogs.length, icon: MessageSquare, color: 'text-indigo-600 bg-indigo-100/50' },
            { label: 'HR Incidents', value: weekMerits.length + weekDisciplinary.length, icon: ShieldAlert, color: 'text-violet-600 bg-violet-100/50' },
          ].map(stat => (
            <Card key={stat.label} className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none mb-1">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                    {stat.isCurrency ? '₦' : ''}{stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Large Sections */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* HR SECTION */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">Human Resources Summary</h2>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 text-slate-500 font-bold text-[10px] px-2 py-0.5">{weekAttendance.length} records</Badge>
              </div>

              {/* Attendance Table */}
              <Card className="border-none shadow-sm rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex items-center justify-between">
                   <CardTitle className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Attendance & Shifts</CardTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Shifts</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {weekAttendance.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic text-xs">No records for this period</td></tr>
                      ) : (
                        weekAttendance.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-slate-400 font-mono text-[10px] whitespace-nowrap">{r.date}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{r.staffName}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{r.position}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1">
                                {r.day === 'Yes' && <Badge className="bg-orange-100 text-orange-600 dark:bg-orange-900/20 border-none text-[9px] font-black px-2 py-0">DAY</Badge>}
                                {r.night === 'Yes' && <Badge className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 border-none text-[9px] font-black px-2 py-0">NIGHT</Badge>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold text-xs">{r.daySite || r.nightSite || 'N/A'}</td>
                            <td className="px-6 py-4">
                              {r.absentStatus ? (
                                <Badge className="bg-rose-500 text-white border-none text-[9px] font-black px-2 py-0.5">{r.absentStatus}</Badge>
                              ) : (
                                <div className="flex items-center gap-1.5 font-bold text-[9px] uppercase text-emerald-500">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" /> Present
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* HR Events Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-sm rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="py-4 px-6 border-b dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10">
                    <CardTitle className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" /> Recognition & Merits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[250px] overflow-y-auto">
                    {weekMerits.length === 0 ? (
                      <p className="text-[10px] text-slate-400 p-8 text-center italic">No records found</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {weekMerits.map(m => (
                          <div key={m.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                            <div className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", m.recordType === 'Accolade' ? "bg-emerald-500" : "bg-rose-500")} />
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.employeeName}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{m.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="py-4 px-6 border-b dark:border-slate-800 bg-rose-50/20 dark:bg-rose-950/10">
                    <CardTitle className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                      <TrendingDown className="h-3.5 w-3.5" /> Disciplinary Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[250px] overflow-y-auto">
                    {weekDisciplinary.length === 0 ? (
                      <p className="text-[10px] text-slate-400 p-8 text-center italic">No records found</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {weekDisciplinary.map(d => (
                          <div key={d.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{employees.find(e => e.id === d.employeeId)?.firstname} {employees.find(e => e.id === d.employeeId)?.surname}</p>
                              <Badge className="bg-rose-100 text-rose-600 dark:bg-rose-900/30 border-none text-[8px] font-black uppercase px-1.5 py-0">{d.severity}</Badge>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{d.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* OPERATIONS SECTION */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
                    <Activity className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">Operational Activity</h2>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 text-slate-500 font-bold text-[10px] px-2 py-0.5">{weekMachineLogs.length} logs</Badge>
              </div>

              {/* Machine Site Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {siteMachineSummary.map((site, si) => (
                  <Card key={si} className="border-none shadow-sm rounded-xl bg-white dark:bg-slate-900 overflow-hidden border-t-4 border-t-emerald-500">
                    <CardHeader className="py-3 px-5 bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
                      <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 uppercase tracking-tight">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500" /> {site.siteName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {Object.values(site.machines).map((machine, mi) => (
                          <div key={mi} className="p-4 hover:bg-slate-50/30 transition-colors">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-black text-slate-600 dark:text-slate-300">{machine.assetName}</span>
                              <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                <Fuel className="h-3 w-3" /> {machine.logs.reduce((s, l) => s + l.dieselUsage, 0)}L
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {machine.logs.map((l, li) => (
                                <div key={li} className="flex items-center gap-2 text-[9px] bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border dark:border-slate-800">
                                  <span className="font-bold text-slate-400 font-mono">{format(parseISO(l.date), 'EEE')}</span>
                                  <div className={cn("h-1.5 w-1.5 rounded-full", l.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                                  <span className="text-slate-600 dark:text-slate-400 font-bold truncate">{l.supervisorOnSite || 'No Sup.'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Logistics Table */}
              <Card className="border-none shadow-sm rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex items-center justify-between">
                   <CardTitle className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Fleet Movement Logs</CardTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        <th className="px-6 py-3">Timestamp</th>
                        <th className="px-6 py-3">Vehicle</th>
                        <th className="px-6 py-3">Driver</th>
                        <th className="px-6 py-3">Destination</th>
                        <th className="px-6 py-3">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {weekTrips.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic text-xs">No movements logged</td></tr>
                      ) : (
                        weekTrips.map((t, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-slate-400 font-mono text-[10px] whitespace-nowrap">
                              {format(parseISO(t.departure_time), 'dd/MM HH:mm')}
                            </td>
                            <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400 text-xs tracking-tight">{t.vehicle_reg}</td>
                            <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-300 text-xs">{t.driver_name}</td>
                            <td className="px-6 py-4">
                              <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 border-none text-[9px] font-black px-2 py-0.5">
                                {t.site_name || 'GENERIC'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-[11px] italic truncate max-w-[150px]">{t.purpose}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

          </div>

          {/* Right Column - Sidebars & Summary Logs */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* COMMUNICATIONS SECTION */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-indigo-500/10 pb-3 px-1">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">Communications</h2>
              </div>

              <Card className="border-none shadow-sm overflow-hidden rounded-xl bg-white dark:bg-slate-900">
                <div className="grid grid-cols-2 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                   <div className="p-3 text-center border-r dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">External</p>
                      <p className="text-xl font-black text-indigo-600 tracking-tighter">{weekExternalComm.length}</p>
                   </div>
                   <div className="p-3 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Internal</p>
                      <p className="text-xl font-black text-violet-600 tracking-tighter">{weekInternalComm.length}</p>
                   </div>
                </div>
                <CardContent className="p-0 max-h-[450px] overflow-y-auto scrollbar-hide">
                   {weekCommLogs.length === 0 ? (
                     <p className="text-[10px] text-slate-400 p-8 text-center italic">No records found</p>
                   ) : (
                     <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {weekCommLogs.sort((a,b) => b.date.localeCompare(a.date)).map(l => (
                          <div key={l.id} className="p-4 hover:bg-slate-50/30 transition-all">
                             <div className="flex justify-between items-start mb-1.5">
                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tight bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded border dark:border-slate-800">{l.channel}</span>
                                <span className="text-[9px] text-slate-300 font-mono font-bold">{l.date}</span>
                             </div>
                             <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-tight mb-1">{l.subject || 'UNTITLED COMM'}</p>
                             <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-relaxed">"{l.notes}"</p>
                             <div className="flex items-center justify-between mt-2 pt-2 border-t dark:border-slate-800">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">With: {l.contactPerson || 'N/A'}</span>
                                <Badge className={cn("text-[8px] border-none font-black px-1.5 py-0", l.isInternal ? "bg-violet-100 text-violet-600" : "bg-indigo-100 text-indigo-600")}>
                                  {l.isInternal ? 'INTERNAL' : 'CLIENT'}
                                </Badge>
                             </div>
                          </div>
                        ))}
                     </div>
                   )}
                </CardContent>
              </Card>
            </section>

          </div>
        </div>

      </div>

      {/* PDF PREVIEW MODAL */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-slate-900 border-slate-800 shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 bg-slate-800 border-b border-slate-700 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-white tracking-tight">Report Document Preview</DialogTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Professional Site Operations Ledger</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsPreviewOpen(false)} className="rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 font-bold text-[10px] uppercase">
                  <X className="h-4 w-4 mr-1.5" /> Close
                </Button>
                <Button size="sm" onClick={() => generateProfessionalPDF('download')} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-900/20 px-6 gap-2 text-[10px] uppercase">
                  <Printer className="h-4 w-4" /> Save as PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-slate-800/50 p-4 sm:p-8 flex items-center justify-center overflow-hidden">
            {pdfPreviewUrl ? (
              <iframe 
                src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`} 
                className="w-full h-full rounded-xl shadow-2xl bg-white border-8 border-slate-700/50" 
                title="Weekly Report PDF Preview"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
                <p className="font-bold tracking-widest uppercase text-[10px]">Generating Ledger...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
