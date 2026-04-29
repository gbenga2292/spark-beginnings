import { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { useAppData } from '@/src/contexts/AppDataContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Users, Fuel, Truck, BookOpen, UserPlus, 
  Activity, MapPin, Download, Calendar, BarChart2, Wallet, 
  CreditCard, MessageSquare, ShieldAlert, FileText, LayoutDashboard,
  ClipboardCheck, TrendingDown, TrendingUp, X, Printer, Search, History,
  Lock
} from 'lucide-react';
import { useUserStore } from '@/src/store/userStore';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// Import logo for PDF
import logoImg from '../../logo/logo-1.png';

function getReportRange(anchor: Date, mode: 'weekly' | 'monthly') {
  if (mode === 'monthly') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
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
  const [reportMode, setReportMode] = useState<'weekly' | 'monthly'>('weekly');
  const [anchor, setAnchor] = useState(new Date());
  const { start, end } = getReportRange(anchor, reportMode);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Permissions ───────────────────────────────────────
  const currentUser = useUserStore(s => s.users.find(u => u.id === s.currentUserId) || null);
  const privs = currentUser?.privileges?.weeklyReport || { 
    canView: false, canViewHr: false, canViewOps: false, canViewComm: false, canViewFinance: false 
  };

  if (!privs.canView && currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
          <Lock className="h-8 w-8 text-slate-300" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-600">Access Restricted</h3>
          <p className="text-sm">You do not have permission to view the Weekly Operations Report.</p>
        </div>
      </div>
    );
  }

  // ── Context data ──────────────────────────────────────
  const { mainTasks, subtasks, comments, users } = useAppData();
  const { dailyMachineLogs, waybills } = useOperations();

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

  // Tasks filtered by week (created or deadline in week)
  const weekTasks = useMemo(() => mainTasks.filter(t => 
    inWeek(t.createdAt || t.created_at, start, end) || 
    (t.deadline && inWeek(t.deadline, start, end))
  ), [mainTasks, start, end]);

  const weekSubtasks = useMemo(() => {
    const taskIds = new Set(weekTasks.map(t => t.id));
    return subtasks.filter(s => taskIds.has(s.main_task_id || s.mainTaskId));
  }, [weekTasks, subtasks]);

  const weekComments = useMemo(() => {
    const taskIds = new Set(weekTasks.map(t => t.id));
    return comments.filter(c => taskIds.has(c.main_task_id || c.task_id));
  }, [weekTasks, comments]);

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

  // ── Summarized Attendance ────────────────────────────
  const summarizedAttendance = useMemo(() => {
    const staffMap: Record<string, any[]> = {};
    weekAttendance.forEach(r => {
      if (!staffMap[r.staffId]) staffMap[r.staffId] = [];
      staffMap[r.staffId].push(r);
    });

    return Object.entries(staffMap).map(([staffId, records]) => {
      const first = records[0];
      const sites = new Set<string>();
      const activeDays: string[] = [];
      let totalShifts = 0;

      records.forEach(r => {
        const isPresent = r.day === 'Yes' || r.night === 'Yes';
        if (isPresent) {
          activeDays.push(format(parseISO(r.date), 'EEE'));
          if (r.day === 'Yes') {
             totalShifts++;
             if (r.daySite) sites.add(r.daySite);
          }
          if (r.night === 'Yes') {
             totalShifts++;
             if (r.nightSite) sites.add(r.nightSite);
          }
        }
      });

      const summaryText = activeDays.length > 0 
        ? `Present on ${activeDays.join(', ')}. Total ${totalShifts} shifts at ${Array.from(sites).join(' & ') || 'N/A'}.`
        : 'No active shifts recorded this week.';

      return {
        staffId,
        staffName: first.staffName,
        position: first.position,
        summary: summaryText,
        isPresent: activeDays.length > 0
      };
    });
  }, [weekAttendance]);

  const reportLabel = reportMode === 'monthly' ? format(start, 'MMMM yyyy') : `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;

  // ── Page Header ───────────────────────────────────────
  useSetPageTitle(
    pdfPreviewUrl ? 'Report Document Preview' : (reportMode === 'monthly' ? 'Monthly Operations Report' : 'Weekly Operations Report'),
    pdfPreviewUrl ? 'Professional Site Operations Ledger' : 'Aggregated enterprise activity and financial summaries',
    <div className="flex items-center gap-2">
      {pdfPreviewUrl ? (
        <>
          <Button size="sm" variant="outline" onClick={() => { setPdfPreviewUrl(null); setIsPreviewOpen(false); }} className="gap-2 h-9 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
             <X className="h-3.5 w-3.5 text-slate-400" /> Close Preview
          </Button>
          <Button size="sm" onClick={() => generateProfessionalPDF('download')} className="gap-2 h-9 bg-slate-900 hover:bg-black text-white font-bold text-[11px] uppercase tracking-tight shadow-lg shadow-slate-200">
             <Printer className="h-3.5 w-3.5" /> Save PDF
          </Button>
        </>
      ) : (
        <>
          <select 
            value={reportMode} 
            onChange={(e) => setReportMode(e.target.value as 'weekly' | 'monthly')}
            className="h-9 px-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm outline-none cursor-pointer hover:bg-slate-50 uppercase tracking-tight"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm mr-2">
            <button onClick={() => setAnchor(a => reportMode === 'monthly' ? subMonths(a, 1) : subWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all text-slate-600 hover:text-blue-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-[11px] font-bold text-slate-700 min-w-[150px] text-center font-mono">{reportLabel}</span>
            <button onClick={() => setAnchor(a => reportMode === 'monthly' ? addMonths(a, 1) : addWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-slate-50 transition-all text-slate-600 hover:text-blue-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} className="gap-2 h-9 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-[11px] uppercase tracking-tight shadow-sm">
            <Download className="h-3.5 w-3.5 text-indigo-500" /> Export Excel
          </Button>
          <Button size="sm" onClick={() => generateProfessionalPDF('preview')} className="gap-2 h-9 bg-slate-900 hover:bg-black text-white font-bold text-[11px] uppercase tracking-tight shadow-lg shadow-slate-200">
            <FileText className="h-3.5 w-3.5" /> View PDF Report
          </Button>
        </>
      )}
    </div>
  );

  // ── Professional PDF Generation ───────────────────────
  async function generateProfessionalPDF(mode: 'preview' | 'download') {
    setIsGenerating(true);
    const doc = new jsPDF();
    
    // Design Tokens
    const colors: Record<string, [number, number, number]> = {
      primary: [15, 23, 42],    // Slate 900
      secondary: [51, 65, 85],  // Slate 700
      accent: [37, 99, 235],    // Blue 600
      muted: [148, 163, 184],   // Slate 400
      light: [248, 250, 252],   // Slate 50
      white: [255, 255, 255],
      border: [226, 232, 240]   // Slate 200
    };

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;

    // Helper: Header Line
    const drawDivider = (y: number, color = colors.border) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
    };

    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('PROFESSIONAL SITE OPERATIONS LEDGER', margin, currentY + 12);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.text('WEEKLY OPERATIONS & RESOURCES SUMMARY', margin, currentY + 18);

    currentY += 35;
    drawDivider(currentY, colors.primary);
    currentY += 10;

    // 2. MEMORANDUM HEADER
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('WEEKLY OPERATIONS SUMMARY', margin, currentY);
    
    doc.setFontSize(10);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(`REPORTING PERIOD: ${format(start, 'MMMM dd')} - ${format(end, 'MMMM dd, yyyy')}`, pageWidth - margin, currentY, { align: 'right' });

    currentY += 12;

    // Memo details
    const memoDetails = [
      ['TO:', 'Executive Management Team'],
      ['FROM:', 'Operations Manager'],
      ['DATE:', format(new Date(), 'MMMM dd, yyyy')],
      ['SUBJECT:', `Weekly Operational Performance & Resource Ledger [Week ${format(start, 'ww')}]`]
    ];

    memoDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 25, currentY);
      currentY += 6;
    });

    currentY += 4;
    drawDivider(currentY);
    currentY += 12;

    // 3. EXECUTIVE NARRATIVE (The "Human" bit)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('01. EXECUTIVE OVERVIEW', margin, currentY);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    
    const narrativeSummary = `During the operational week concluding on ${format(end, 'dd MMMM yyyy')}, a total of ${uniqueStaffDeployed} personnel were active across site operations. Asset utilization consumed approximately ${totalDiesel.toFixed(1)} liters of diesel fuel. Financially, the week recorded a total revenue inflow of NGN ${totalIncome.toLocaleString()} against operational expenditures of NGN ${totalExpenses.toLocaleString()}. This ledger provides an authoritative summary of workforce, logistics, assets, and task progression during this reporting interval.`;
    
    const splitSummary = doc.splitTextToSize(narrativeSummary, contentWidth);
    doc.text(splitSummary, margin, currentY);
    currentY += (splitSummary.length * 5) + 10;

    // 4. PERFORMANCE METRICS (Mini Table)
    autoTable(doc, {
      startY: currentY,
      head: [['KEY PERFORMANCE INDICATORS', 'VALUE']],
      body: [
        ['Total Workforce Deployed', `${uniqueStaffDeployed} Staff`],
        ['Resource Consumption (Diesel)', `${totalDiesel.toFixed(1)} Liters`],
        ['Logistical Movements (Vehicle Trips)', `${weekTrips.length} Records`],
        ['Communications Logged (Internal/External)', `${weekCommLogs.length} Entries`],
        ['Net Cash Position (Weekly)', `NGN ${(totalIncome - totalExpenses).toLocaleString()}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
      headStyles: { fillColor: colors.primary, textColor: colors.white, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 }, 1: { halign: 'right' } },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 5. SITE OPERATIONS & MACHINE STATUS
    if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('02. SITE OPERATIONS & ASSET UTILIZATION', margin, currentY);
    currentY += 8;

    autoTable(doc, {
      startY: currentY,
      head: [['DATE', 'SITE LOCATION', 'MACHINE ASSET', 'UTILIZATION STATUS', 'DIESEL']],
      body: weekMachineLogs.slice(0, 15).map(l => [
        format(parseISO(l.date), 'dd MMM'),
        l.siteName,
        l.assetName,
        l.isActive ? 'OPERATIONAL' : 'DOWNTIME',
        `${l.dieselUsage} L`
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: colors.accent, textColor: colors.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: colors.light },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 6. TASK PROGRESS & PROJECT UPDATES
    if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('03. STRATEGIC TASKS & PROJECT PROGRESS', margin, currentY);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`A total of ${weekTasks.length} primary tasks were managed this week. Below is the status of critical sub-deliverables.`, margin, currentY);
    currentY += 8;

    const taskRows = weekSubtasks.slice(0, 10).map(s => {
      const mainTask = weekTasks.find(t => t.id === (s.main_task_id || s.mainTaskId));
      const statusLabel = s.status === 'completed' ? 'COMPLETED' : s.status === 'pending_approval' ? 'AWAITING REVIEW' : 'IN PROGRESS';
      return [
        mainTask?.title || 'N/A',
        s.title,
        s.assignedTo ? (employees.find(e => e.id === s.assignedTo)?.firstname || 'Assigned') : 'Unassigned',
        statusLabel
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['PARENT TASK', 'SUB-TASK / DELIVERABLE', 'ASSIGNEE', 'STATUS']],
      body: taskRows.length > 0 ? taskRows : [['-', 'No active tasks recorded in this window', '-', '-']],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: colors.primary, textColor: colors.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: colors.light },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 7. TASK UPDATES & COMMENTS
    if (weekComments.length > 0) {
      if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('04. RECENT TASK COMMUNICATIONS', margin, currentY);
      currentY += 8;

      const commentData = weekComments.slice(0, 15).map(c => {
        const author = users.find(u => u.id === c.author_id)?.name || 'System';
        const task = weekTasks.find(t => t.id === (c.main_task_id || c.task_id));
        const taskTitle = task ? task.title : 'General / Unknown Task';
        return [
          format(parseISO(c.created_at || c.createdAt), 'dd/MM HH:mm'),
          taskTitle,
          author,
          c.text
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['TIMESTAMP', 'TASK / CONTEXT', 'AUTHOR', 'UPDATE / COMMENT']],
        body: commentData,
        styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [71, 85, 105] as [number, number, number], textColor: colors.white },
        margin: { left: margin, right: margin },
        columnStyles: { 3: { cellWidth: 90 }, 1: { cellWidth: 40 } }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 7b. GENERAL COMMUNICATIONS
    if (weekCommLogs.length > 0) {
      if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('05. GENERAL COMMUNICATIONS LOG', margin, currentY);
      currentY += 8;

      const commLogData = weekCommLogs.slice(0, 15).map(l => {
        const type = l.isInternal ? 'INTERNAL' : 'EXTERNAL';
        return [
          format(parseISO(l.date), 'dd/MM/yyyy'),
          `[${type}] ${l.channel.toUpperCase()}`,
          l.notes
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['DATE', 'TYPE / CHANNEL', 'NOTES & DETAILS']],
        body: commLogData,
        styles: { fontSize: 7.5, cellPadding: 4, font: 'helvetica' },
        headStyles: { fillColor: colors.secondary, textColor: colors.white },
        margin: { left: margin, right: margin },
        columnStyles: { 2: { cellWidth: 110 } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 8. FINANCIAL OVERVIEW
    if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('06. FINANCIAL RECONCILIATION (SUMMARY)', margin, currentY);
    currentY += 8;

    autoTable(doc, {
      startY: currentY,
      head: [['CLASSIFICATION', 'ITEM COUNT', 'TOTAL VOLUME (NGN)']],
      body: [
        ['Client Invoices / Revenue', weekPayments.length.toString(), totalIncome.toLocaleString()],
        ['Site Operational Expenses', weekLedger.length.toString(), weekLedger.reduce((s, e) => s + e.amount, 0).toLocaleString()],
        ['VAT / Tax Obligations', weekVats.length.toString(), weekVats.reduce((s, e) => s + e.amount, 0).toLocaleString()],
        ['Corporate Overheads', weekCompanyExpenses.length.toString(), weekCompanyExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()]
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: colors.primary, textColor: colors.white },
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: margin, right: margin }
    });

    // 9. CONCLUSION & SIGN-OFF
    currentY = (doc as any).lastAutoTable.finalY + 20;
    if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }

    drawDivider(currentY);
    currentY += 10;
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('This document serves as an official operations ledger. Any discrepancies should be reported immediately.', margin, currentY);
    
    currentY += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARED BY:', margin, currentY);
    doc.text('REVIEWED BY:', pageWidth / 2, currentY);
    
    currentY += 10;
    doc.setFont('helvetica', 'normal');
    doc.text('__________________________', margin, currentY);
    doc.text('__________________________', pageWidth / 2, currentY);
    
    doc.text('Operations Manager', margin, currentY + 5);
    doc.text('Executive Management', pageWidth / 2, currentY + 5);

    // 10. FOOTER (PAGE NUMBERS)
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(7);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Official Operations Ledger | Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, pageHeight - 10);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    if (mode === 'download') {
      doc.save(`Operations_Ledger_${format(start, 'yyyy_MM_dd')}.pdf`);
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
    <div className={cn("flex flex-col bg-slate-50 dark:bg-slate-950/50 overflow-hidden font-sans", pdfPreviewUrl ? "h-full" : "h-full pb-10")}>
      
      {/* Main Content Area */}
      {pdfPreviewUrl ? (
        <div className="flex-1 w-full h-full bg-slate-800 relative z-10">
           <iframe src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`} className="w-full h-full bg-white" title="Operations Ledger Preview" />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Operations Staffs', value: uniqueStaffDeployed, icon: Users, color: 'text-blue-600 bg-blue-100/50', show: privs.canViewHr },
            { label: 'Diesel Consumed', value: `${totalDiesel.toFixed(0)}L`, icon: Fuel, color: 'text-amber-600 bg-amber-100/50', show: privs.canViewOps },
            { label: 'Income', value: totalIncome.toLocaleString(), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100/50', isCurrency: true, show: privs.canViewFinance },
            { label: 'Expenses', value: totalExpenses.toLocaleString(), icon: TrendingDown, color: 'text-rose-600 bg-rose-100/50', isCurrency: true, show: privs.canViewFinance },
            { label: 'Communications', value: weekCommLogs.length, icon: MessageSquare, color: 'text-indigo-600 bg-indigo-100/50', show: privs.canViewComm },
            { label: 'HR Incidents', value: weekMerits.length + weekDisciplinary.length, icon: ShieldAlert, color: 'text-violet-600 bg-violet-100/50', show: privs.canViewHr },
          ].filter(s => s.show || currentUser?.role === 'admin').map(stat => (
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
            {(privs.canViewHr || currentUser?.role === 'admin') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
                    <Users className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">Human Resources Summary</h2>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 text-slate-500 font-bold text-[10px] px-2 py-0.5">{summarizedAttendance.length} Employees</Badge>
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
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Weekly Summary</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summarizedAttendance.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic text-xs">No records for this period</td></tr>
                      ) : (
                        summarizedAttendance.map(r => (
                          <tr key={r.staffId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{r.staffName}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{r.position}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{r.summary}</div>
                            </td>
                            <td className="px-6 py-4">
                              {r.isPresent ? (
                                <div className="flex items-center gap-1.5 font-bold text-[9px] uppercase text-emerald-500">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" /> Active
                                </div>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-400 border-none text-[9px] font-black px-2 py-0.5 uppercase">Inactive</Badge>
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
            )}

            {/* OPERATIONS SECTION */}
            {(privs.canViewOps || currentUser?.role === 'admin') && (
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
            )}

          </div>

          {/* Right Column - Sidebars & Summary Logs */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* COMMUNICATIONS SECTION */}
            {(privs.canViewComm || currentUser?.role === 'admin') && (
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
                             <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-tight mb-1">
                                {l.subject || (() => {
                                  if (!l.notes) return 'Communication Record';
                                  const n = l.notes.toLowerCase();
                                  if (n.includes('report')) return 'Site Report Submission';
                                  if (n.includes('follow up') || n.includes('follow-up')) return 'Follow-up Communication';
                                  if (n.includes('meeting')) return 'Meeting Notes';
                                  if (n.includes('call') || n.includes('called')) return 'Phone Call Summary';
                                  if (n.includes('whatsapp') || n.includes('message')) return 'Instant Messaging Record';
                                  if (n.includes('email')) return 'Email Correspondence';
                                  const words = l.notes.split(' ');
                                  return words.length > 5 ? words.slice(0, 5).join(' ') + '...' : l.notes;
                                })()}
                             </p>
                             <p className="text-[10px] text-slate-500 italic leading-relaxed">"{l.notes}"</p>
                             <div className="flex items-center justify-between mt-2 pt-2 border-t dark:border-slate-800">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">
                                  {l.contactPerson ? `With: ${l.contactPerson}` : 'General Update'}
                                </span>
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
            )}

          </div>
        </div>

        </div>
      )}
    </div>
  );
}
