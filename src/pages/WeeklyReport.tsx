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
import { normalizeDate, formatDisplayDate } from '@/src/lib/dateUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


// Import logo for PDF
import logoImg from '../../logo/logo-2.png';

function getReportRange(anchor: Date, mode: 'weekly' | 'monthly') {
  if (mode === 'monthly') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
}

function inWeek(dateStr: string, start: Date, end: Date) {
  if (!dateStr) return false;
  try {
    const normalized = normalizeDate(dateStr);
    if (!normalized) return false;
    const d = parseISO(normalized);
    return isWithinInterval(d, { start, end });
  } catch {
    return false;
  }
}

export function WeeklyReport() {
  const [reportMode, setReportMode] = useState<'weekly' | 'monthly'>('weekly');
  const [anchor, setAnchor] = useState(new Date());
  const { start, end } = getReportRange(anchor, reportMode);
  // Stable string keys for useMemo deps — Date objects are new refs every render
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const publicHolidays   = useAppStore(s => s.publicHolidays);

  // ── Week-filtered data ────────────────────────────────
  const weekAttendance = useMemo(() => attendance.filter(r => inWeek(r.date, start, end)), [attendance, startStr, endStr]);
  const weekMachineLogs = useMemo(() => dailyMachineLogs.filter(l => inWeek(l.date, start, end)), [dailyMachineLogs, startStr, endStr]);
  const weekTrips = useMemo(() => vehicleTrips.filter(t => inWeek(t.departure_time, start, end)), [vehicleTrips, startStr, endStr]);
  const weekJournals = useMemo(() => journals.filter(j => inWeek(j.date, start, end)), [journals, startStr, endStr]);
  const weekJournalEntries = useMemo(() => {
    const ids = new Set(weekJournals.map(j => j.id));
    return journalEntries.filter(e => ids.has(e.journalId));
  }, [weekJournals, journalEntries]);
  
  const weekNewEmployees = useMemo(() => employees.filter(e => e.startDate && inWeek(e.startDate, start, end)), [employees, startStr, endStr]);
  const weekMerits = useMemo(() => meritRecords.filter(r => inWeek(r.incidentDate, start, end)), [meritRecords, startStr, endStr]);
  const weekDisciplinary = useMemo(() => disciplinary.filter(r => inWeek(r.date, start, end)), [disciplinary, startStr, endStr]);
  const weekEvaluations = useMemo(() => evaluations.filter(r => inWeek(r.date, start, end)), [evaluations, startStr, endStr]);
  const weekLeaves = useMemo(() => leaves.filter(r => inWeek(r.startDate, start, end) || inWeek(r.expectedEndDate, start, end)), [leaves, startStr, endStr]);

  const weekCommLogs = useMemo(() => commLogs.filter(l => inWeek(l.date, start, end)), [commLogs, startStr, endStr]);
  const weekExternalComm = useMemo(() => weekCommLogs.filter(l => !l.isInternal), [weekCommLogs]);
  const weekInternalComm = useMemo(() => weekCommLogs.filter(l => l.isInternal), [weekCommLogs]);

  const weekLedger = useMemo(() => ledgerEntries.filter(e => inWeek(e.date, start, end)), [ledgerEntries, startStr, endStr]);
  const weekPayments = useMemo(() => payments.filter(p => inWeek(p.date, start, end)), [payments, startStr, endStr]);
  const weekVats = useMemo(() => vatPayments.filter(v => inWeek(v.date, start, end)), [vatPayments, startStr, endStr]);
  const weekCompanyExpenses = useMemo(() => companyExpenses.filter(e => inWeek(e.date, start, end)), [companyExpenses, startStr, endStr]);

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
    const holidaySet = new Set(publicHolidays.map(h => h.date));
    const daysInPeriod = eachDayOfInterval({ start, end });

    // Build a map of staffId -> real records from actual attendance data
    const staffMap: Record<string, any[]> = {};
    weekAttendance.forEach(r => {
      if (!staffMap[r.staffId]) staffMap[r.staffId] = [];
      staffMap[r.staffId].push(r);
    });

    // Only process staff who have at least ONE real attendance record in the period.
    // Office staff "assumed present" logic fills GAPS within their real records,
    // but does NOT fabricate entries for employees with zero records.
    const staffIdsWithRecords = Object.keys(staffMap);

    return staffIdsWithRecords.map(staffId => {
      const emp = employees.find(e => e.id === staffId);
      const records = staffMap[staffId];
      // An employee is "office" type if their employee profile says so
      const isOffice = emp?.staffType === 'OFFICE';

      const sites = new Set<string>();
      const daysData: { label: string, isPresent: boolean, statusType: 'present' | 'absent-permit' | 'absent-no-permit' | 'default', tooltip: string }[] = [];
      let dayShifts = 0;
      let nightShifts = 0;

      daysInPeriod.forEach(dateObj => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const jsDay = dateObj.getDay();
        const isSunday = jsDay === 0;
        const isHoliday = holidaySet.has(dateStr);
        // Only look for a record that actually exists in the DB for this day
        const record = records.find(r => r.date === dateStr);

        let isPresent = false;
        let statusType: 'present' | 'absent-permit' | 'absent-no-permit' | 'default' = 'default';
        const dailySites: string[] = [];
        let tooltip = format(dateObj, 'MMM d, yyyy');

        if (record) {
          // Real record exists — use it as the source of truth
          const upperStatus = record.absentStatus?.toUpperCase() || '';
          const hasPermit = (upperStatus.includes('PERMIT') && !upperStatus.includes('WITHOUT')) || upperStatus.includes('LEAVE');
          const isAbsent = ["ABSENT WITH PERMIT", "ON LEAVE", "SICK LEAVE", "MATERNITY LEAVE", "ANNUAL LEAVE", "ABSENT WITHOUT PERMIT", "ABSENT"].some(s => upperStatus.includes(s));

          if (record.day === 'Yes' || record.night === 'Yes') {
            isPresent = true;
            statusType = 'present';
            if (record.day === 'Yes') { dayShifts++; if (record.daySite) dailySites.push(record.daySite); }
            if (record.night === 'Yes') { nightShifts++; if (record.nightSite) dailySites.push(record.nightSite); }
          } else if (isAbsent) {
            // Explicitly absent — mark with appropriate color
            statusType = hasPermit ? 'absent-permit' : 'absent-no-permit';
            tooltip += ` - ${record.absentStatus}`;
          } else if (isOffice && !isSunday && !isHoliday) {
            // Office staff with a record but no shift marked and no absent status
            // (e.g. blank record) — treat as office present
            isPresent = true;
            statusType = 'present';
            dayShifts++;
            dailySites.push(record.daySite || 'Office (DCEL)');
          } else {
            if (record.absentStatus) tooltip += ` - ${record.absentStatus}`;
          }
        } else if (isOffice && !isSunday && !isHoliday) {
          // Office staff: no record for this day but has other real records this period.
          // Assume present at office (fill the gap).
          isPresent = true;
          statusType = 'present';
          dayShifts++;
          dailySites.push('Office (DCEL)');
          tooltip += ' - Assumed present (no specific record)';
        } else if (isSunday) {
          tooltip += ' - Sunday (Off)';
        } else if (isHoliday) {
          tooltip += ' - Public Holiday';
        } else {
          tooltip += ' - No record';
        }

        if (isPresent) {
          dailySites.forEach(s => sites.add(s));
          tooltip += dailySites.length > 0
            ? ` - Present at: ${dailySites.join(', ')}`
            : ' - Present';
        }

        daysData.push({ label: reportMode === 'monthly' ? format(dateObj, 'd') : format(dateObj, 'EEE').charAt(0), isPresent, statusType, tooltip });
      });

      const totalShifts = dayShifts + nightShifts;
      const activeDays = daysData.filter(d => d.isPresent).map(d => d.label);
      
      const summaryText = activeDays.length > 0 
        ? `Present on ${activeDays.length} days. Total ${totalShifts} shifts at ${Array.from(sites).join(' & ') || 'N/A'}.`
        : 'No active shifts recorded this week.';

      return {
        staffId,
        staffName: emp ? `${emp.firstname} ${emp.surname}` : records[0]?.staffName,
        position: emp?.position || records[0]?.position || '',
        summary: summaryText,
        isPresent: activeDays.length > 0,
        dayShifts,
        nightShifts,
        totalShifts,
        activeDays,
        daysData,
        sites: Array.from(sites)
      };
    }).filter(r => r.totalShifts > 0 || r.daysData.some(d => d.tooltip.toUpperCase().includes('ABSENT') || d.tooltip.toUpperCase().includes('LEAVE')));
  }, [weekAttendance, employees, publicHolidays, startStr, endStr, reportMode]);

  const reportLabel = reportMode === 'monthly' ? format(start, 'MMMM yyyy') : `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;


  // ── Page Header ───────────────────────────────────────
  useSetPageTitle(
    pdfPreviewUrl ? 'Report Document Preview' : (reportMode === 'monthly' ? 'Monthly Operations Report' : 'Weekly Operations Report'),
    pdfPreviewUrl ? 'Professional Site Operations Ledger' : 'Aggregated enterprise activity and financial summaries',
    <div className="relative flex items-center gap-2">
      {pdfPreviewUrl ? (
        <>
          <Button size="sm" variant="outline" onClick={() => { setPdfPreviewUrl(null); setIsPreviewOpen(false); }} className="h-9 w-9 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm" title="Close Preview">
            <X className="h-5 w-5 text-slate-400" />
          </Button>
          <Button size="sm" onClick={() => generateProfessionalPDF('download')} className="h-9 w-9 bg-slate-900 hover:bg-black text-white shadow-lg shadow-slate-200" title="Save PDF">
            <Printer className="h-5 w-5" />
          </Button>
        </>
      ) : (
        <>
          {/* Desktop controls — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 border border-slate-200 dark:border-slate-700">
              {(['weekly', 'monthly'] as const).map(mode => (
                <button key={mode} onClick={() => setReportMode(mode)}
                  className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-150",
                    reportMode === mode ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}>
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button onClick={() => setAnchor(a => reportMode === 'monthly' ? subMonths(a, 1) : subWeeks(a, 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-90 transition-all duration-100 border-r border-slate-100 dark:border-slate-800">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 px-3 min-w-[170px] justify-center">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight text-center whitespace-nowrap">{reportLabel}</span>
              </div>
              <button onClick={() => setAnchor(a => reportMode === 'monthly' ? addMonths(a, 1) : addWeeks(a, 1))} className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-90 transition-all duration-100 border-l border-slate-100 dark:border-slate-800">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setAnchor(new Date())} className="h-9 px-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm whitespace-nowrap">Today</button>
            <Button variant="outline" size="sm" onClick={handleExportXLSX} className="h-9 w-9 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm" title="Export Excel"><Download className="h-5 w-5 text-indigo-500" /></Button>
            <Button size="sm" onClick={() => generateProfessionalPDF('preview')} className="h-9 w-9 bg-slate-900 hover:bg-black text-white shadow-lg shadow-slate-200" title="View PDF Report"><FileText className="h-5 w-5" /></Button>
          </div>

          {/* Mobile: 3-dot menu trigger */}
          <button
            className="sm:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm"
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            <span className="text-lg font-black leading-none tracking-tighter">⋮</span>
          </button>

          {/* Mobile dropdown panel — fixed to escape header clipping */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
              <div className="sm:hidden fixed top-16 right-3 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-md p-2 space-y-2">
              {/* Mode switcher */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-2">Mode</p>
                <div className="flex gap-1 px-1">
                  {(['weekly', 'monthly'] as const).map(mode => (
                    <button key={mode} onClick={() => { setReportMode(mode); }}
                      className={`flex-1 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors ${
                        reportMode === mode ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period navigator */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-2">Period</p>
                <div className="flex items-center gap-1 px-1">
                  <button onClick={() => setAnchor(a => reportMode === 'monthly' ? subMonths(a, 1) : subWeeks(a, 1))} className="h-8 w-8 shrink-0 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-center text-xs font-bold text-slate-800 dark:text-slate-100 truncate px-1">{reportLabel}</span>
                  <button onClick={() => setAnchor(a => reportMode === 'monthly' ? addMonths(a, 1) : addWeeks(a, 1))} className="h-8 w-8 shrink-0 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 px-1">
                <button onClick={() => { setAnchor(new Date()); setMobileMenuOpen(false); }} className="w-full text-left px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded">Today</button>
                <button onClick={() => { handleExportXLSX(); setMobileMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded">
                  <Download className="h-4 w-4 text-emerald-500" /> Excel Export
                </button>
                <button onClick={() => { generateProfessionalPDF('preview'); setMobileMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded">
                  <FileText className="h-4 w-4 text-indigo-500" /> PDF Report
                </button>
              </div>
            </div>
            </>
          )}
        </>
      )}
    </div>,
    [reportLabel, reportMode, pdfPreviewUrl, mobileMenuOpen]
  );

  async function generateProfessionalPDF(mode: 'preview' | 'download') {
    setIsGenerating(true);
    const doc = new jsPDF();
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Helper to draw section titles
    const drawSectionTitle = (title: string, y: number) => {
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 50);
      doc.text(title, margin, y);
      return y + 6;
    };

    // Helper to draw sub-section titles
    const drawSubTitle = (title: string, y: number) => {
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 70);
      doc.text(title, margin + 5, y);
      return y + 5;
    };

    // Helper to draw text
    const drawText = (text: string, y: number, indent = 0) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 70);
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      doc.text(lines, margin + indent, y);
      return y + (lines.length * 5); // 1.5 line spacing approx
    };

    const drawHeader = (pageTitle?: string) => {
      // Watermark
      try {
        doc.saveGraphicsState();
        // @ts-ignore
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.addImage(logoImg, 'PNG', pageWidth / 2 - 45, pageHeight / 2 - 17, 90, 34);
        doc.restoreGraphicsState();
      } catch (_) {}

      // Logo top-left
      try { doc.addImage(logoImg, 'PNG', 14, 10, 50, 18); } catch (_) {}

      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.5);
      doc.line(14, 32, pageWidth - 14, 32);
      
      doc.setFontSize(18); doc.setFont('times', 'bold'); doc.setTextColor(30, 30, 50);
      doc.text(reportMode === 'weekly' ? 'WEEKLY OPERATIONS REPORT' : 'MONTHLY OPERATIONS REPORT', pageWidth / 2, 42, { align: 'center' });
      
      doc.setFontSize(11); doc.setFont('times', 'italic'); doc.setTextColor(80, 80, 120);
      doc.text(`From ${format(start, 'MMMM d, yyyy')} to ${format(end, 'MMMM d, yyyy')}`, pageWidth / 2, 48, { align: 'center' });

      if (pageTitle) {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 170);
        doc.text(pageTitle, pageWidth - 14, 15, { align: 'right' });
      }

      doc.setLineWidth(0.3); doc.line(14, 52, pageWidth - 14, 52);
      return 62;
    };

    const checkPageBreak = (neededSpace: number, pageTitle?: string) => {
      if (currentY + neededSpace > pageHeight - 20) {
        doc.addPage();
        currentY = drawHeader(pageTitle);
        return true;
      }
      return false;
    };

    // Calculate Summary Stats dynamically
    const attRate = employees.length > 0 ? Math.round((uniqueStaffDeployed / employees.length) * 100) : 0;
    const completedTasksCount = weekTasks.filter(t => t.status === 'completed').length;
    const completedSubtasksCount = weekSubtasks.filter(s => s.status === 'completed').length;
    let totalShifts = 0;
    summarizedAttendance.forEach(s => totalShifts += s.totalShifts);

    // Initial page header
    currentY = drawHeader('EXECUTIVE SUMMARY');

    // 1. QUICK STATS
    currentY = drawSectionTitle('1. EXECUTIVE SUMMARY', currentY);
    currentY += 2;

    doc.setFontSize(11); doc.setFont('times', 'normal'); doc.setTextColor(50, 50, 70);
    doc.text(`Attendance Rate: ${attRate}% (${uniqueStaffDeployed} / ${employees.length} Staff Deployed)`, 20, currentY); currentY += 6;
    doc.text(`Total Shifts Logged: ${totalShifts}`, 20, currentY); currentY += 6;
    doc.text(`Tasks Completed: ${completedTasksCount} Main Tasks, ${completedSubtasksCount} Subtasks`, 20, currentY); currentY += 6;
    doc.text(`Financial Overview: Income NGN ${totalIncome.toLocaleString()} | Expenses NGN ${totalExpenses.toLocaleString()}`, 20, currentY); currentY += 12;

    // 2. SITE-BY-SITE ANALYSIS
    checkPageBreak(30, 'SITE PROFILES');
    currentY = drawSectionTitle('2. SITE PROFILES & OPERATIONS LOG', currentY);
    currentY += 2;

    // Identify all active sites this week from various logs
    const activeSiteNames = Array.from(new Set([
      ...weekTasks.map(t => t.siteName),
      ...weekMachineLogs.map(m => m.siteName),
      ...journalEntries.filter(e => journals.some(j => j.id === e.journalId && j.date >= format(start, 'yyyy-MM-dd') && j.date <= format(end, 'yyyy-MM-dd'))).map(e => e.siteName),
      ...weekLedger.map(e => e.site)
    ].filter(Boolean)));

    if (activeSiteNames.length === 0) {
      currentY = drawText('No active sites recorded for this period.', currentY, 5);
    } else {
      activeSiteNames.forEach(sName => {
        checkPageBreak(50, `SITE PROFILE: ${sName}`);
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 5;
        
        doc.setFontSize(14); doc.setFont('times', 'bold'); doc.setTextColor(20, 20, 40);
        doc.text(`Site: ${sName}`, margin, currentY);
        currentY += 8;

        // A. Expenses on the Site
        const siteExpenses = weekLedger.filter(e => e.site === sName);
        currentY = drawSubTitle('A. Expenses', currentY);
        if (siteExpenses.length > 0) {
          const expenseBody = siteExpenses.map(e => [
            formatDisplayDate(e.date),
            e.category,
            e.description,
            `NGN ${e.amount.toLocaleString()}`
          ]);
          autoTable(doc, {
            startY: currentY,
            head: [['Date', 'Category', 'Description', 'Amount']],
            body: expenseBody,
            theme: 'grid',
            styles: { font: 'times', fontSize: 9, cellPadding: 2, lineColor: [220, 220, 220] },
            headStyles: { fillColor: [245, 245, 250], textColor: [40, 40, 60] },
            margin: { left: margin + 5, right: margin }
          });
          currentY = (doc as any).lastAutoTable.finalY + 6;
        } else {
          currentY = drawText('No expenses recorded.', currentY, 10);
        }

        // B. Machine & Diesel Used
        checkPageBreak(30, `SITE PROFILE: ${sName}`);
        currentY = drawSubTitle('B. Machinery & Diesel Usage', currentY);
        const siteMachines = weekMachineLogs.filter(m => m.siteName === sName);
        if (siteMachines.length > 0) {
          const machineBody = siteMachines.map(m => [
            formatDisplayDate(m.date),
            m.assetName,
            m.dieselUsage ? `${m.dieselUsage} L` : '-',
            m.isActive ? 'Active' : 'Inactive',
            m.issuesOnSite || '-'
          ]);
          autoTable(doc, {
            startY: currentY,
            head: [['Date', 'Machine', 'Diesel Used', 'Status', 'Notes/Issues']],
            body: machineBody,
            theme: 'grid',
            styles: { font: 'times', fontSize: 9, cellPadding: 2, lineColor: [220, 220, 220] },
            headStyles: { fillColor: [245, 245, 250], textColor: [40, 40, 60] },
            margin: { left: margin + 5, right: margin }
          });
          currentY = (doc as any).lastAutoTable.finalY + 6;
        } else {
          currentY = drawText('No machine logs recorded.', currentY, 10);
        }

        // C. Consumables Used
        checkPageBreak(30, `SITE PROFILE: ${sName}`);
        currentY = drawSubTitle('C. Consumables Used (Waybills/Inventory)', currentY);
        const siteWaybills = waybills.filter(w => w.siteName === sName && w.issueDate >= format(start, 'yyyy-MM-dd') && w.issueDate <= format(end, 'yyyy-MM-dd'));
        if (siteWaybills.length > 0) {
          const waybillBody = siteWaybills.map(w => [
            formatDisplayDate(w.issueDate),
            w.items.map(i => `${i.quantity}x ${i.assetName}`).join(', ') || 'Various Items',
            w.status,
            w.driverName || '-'
          ]);
          autoTable(doc, {
            startY: currentY,
            head: [['Date', 'Items Delivered/Used', 'Status', 'Transported By']],
            body: waybillBody,
            theme: 'grid',
            styles: { font: 'times', fontSize: 9, cellPadding: 2, lineColor: [220, 220, 220] },
            headStyles: { fillColor: [245, 245, 250], textColor: [40, 40, 60] },
            margin: { left: margin + 5, right: margin }
          });
          currentY = (doc as any).lastAutoTable.finalY + 6;
        } else {
          currentY = drawText('No consumable deliveries or usage recorded.', currentY, 10);
        }

        // D. Operation Logs (Daily Journal)
        checkPageBreak(30, `SITE PROFILE: ${sName}`);
        currentY = drawSubTitle('D. Operations Log & Status Updates', currentY);
        const siteJournals = journalEntries.filter(e => e.siteName === sName && journals.some(j => j.id === e.journalId && j.date >= format(start, 'yyyy-MM-dd') && j.date <= format(end, 'yyyy-MM-dd')));
        if (siteJournals.length > 0) {
          siteJournals.forEach(entry => {
            checkPageBreak(25, `SITE PROFILE: ${sName}`);
            const jDate = journals.find(j => j.id === entry.journalId)?.date || '';
            doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(80, 80, 100);
            doc.text(`[${jDate}] Logged by: ${entry.loggedBy}`, margin + 10, currentY);
            currentY += 5;
            
            if (entry.narration) {
              doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 70);
              const lines = doc.splitTextToSize(entry.narration, contentWidth - 15);
              doc.text(lines, margin + 10, currentY);
              currentY += (lines.length * 5) + 3;
            }
          });
        } else {
          currentY = drawText('No daily journal updates recorded for this site.', currentY, 10);
        }
        currentY += 8;
      });
    }

    // 3. STAFF ATTENDANCE
    checkPageBreak(50, 'GLOBAL STAFF ATTENDANCE');
    currentY = drawSectionTitle('3. GLOBAL STAFF ATTENDANCE', currentY);
    currentY += 2;

    const staffBody = summarizedAttendance.map(staff => {
      const emp = employees.find(e => e.id === staff.staffId);
      const name = emp ? `${emp.surname} ${emp.firstname}\n${emp.position}` : 'Unknown Staff';
      const shifts = `${staff.dayShifts + staff.nightShifts} Shifts\n(${staff.dayShifts} Day, ${staff.nightShifts} Night)`;
      const sites = Array.from(staff.sites).join(', ') || 'No assigned site';
      return [name, shifts, sites];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Employee', 'Summary', 'Locations']],
      body: staffBody.length > 0 ? staffBody : [['No records', '-', '-']],
      theme: 'grid',
      styles: { font: 'times', fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [240, 240, 245], textColor: [30, 30, 50], fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // Add Footer to all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 170);
      doc.text(`Page ${i} of ${pageCount} · Dewatering Construction Etc Limited · Generated ${format(new Date(), 'PPP')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    if (mode === 'download') {
      doc.save(`Operations_Report_${format(start, 'yyyy_MM_dd')}.pdf`);
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5 sm:space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: 'Operations Staff', value: uniqueStaffDeployed, icon: Users, color: 'text-blue-600 bg-blue-100/50', show: privs.canViewHr },
            { label: 'Diesel Consumed', value: `${totalDiesel.toFixed(0)}L`, icon: Fuel, color: 'text-amber-600 bg-amber-100/50', show: privs.canViewOps },
            { label: 'Income', value: totalIncome.toLocaleString(), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100/50', isCurrency: true, sub: `${weekPayments.length} payment${weekPayments.length !== 1 ? 's' : ''}`, show: privs.canViewFinance },
            { label: 'Expenses', value: totalExpenses.toLocaleString(), icon: TrendingDown, color: 'text-rose-600 bg-rose-100/50', isCurrency: true, show: privs.canViewFinance },
            { label: 'Comms', value: weekCommLogs.length, icon: MessageSquare, color: 'text-indigo-600 bg-indigo-100/50', show: privs.canViewComm },
            { label: 'HR Incidents', value: weekMerits.length + weekDisciplinary.length, icon: ShieldAlert, color: 'text-violet-600 bg-violet-100/50', show: privs.canViewHr },
          ].filter(s => s.show || currentUser?.role === 'admin').map(stat => (
            <Card key={stat.label} className="border border-border/50 shadow-sm bg-card rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', stat.color)}>
                    <stat.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right leading-tight min-w-0">{stat.label}</p>
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "font-black text-foreground tracking-tight leading-none",
                    String(stat.value).length > 8 ? "text-sm sm:text-sm lg:text-xs xl:text-sm break-words" : "text-base sm:text-lg truncate"
                  )}>
                    {stat.isCurrency ? '₦' : ''}{stat.value}
                  </p>
                  {(stat as any).sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{(stat as any).sub}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
          
          {/* Left Column - Large Sections */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* HR SECTION */}
            {(privs.canViewHr || currentUser?.role === 'admin') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Human Resources Summary</h2>
                    <p className="text-[11px] text-muted-foreground">Workforce attendance and incidents</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-semibold text-[11px] px-2.5 py-1">{summarizedAttendance.length} Employees</Badge>
              </div>

              {/* Attendance Table */}
              <Card className="border border-border/50 shadow-sm rounded-2xl bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">Attendance & Shifts</CardTitle>
                </div>
                {/* Mobile card view */}
                <div className="block sm:hidden divide-y divide-border/50">
                  {summarizedAttendance.length === 0 ? (
                    <p className="px-5 py-8 text-center text-slate-400 italic text-xs">No records for this period</p>
                  ) : summarizedAttendance.map(r => (
                    <div key={r.staffId} className="px-4 py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-foreground">{r.staffName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">{r.position}</p>
                        </div>
                        {r.isPresent ? (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-slate-400">Inactive</span>
                        )}
                      </div>
                      {r.totalShifts > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-bold text-foreground">{r.totalShifts} Shifts <span className="font-normal text-muted-foreground">({r.dayShifts}D, {r.nightShifts}N)</span></p>
                          {r.sites.length > 0 && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{r.sites.join(', ')}</p>}
                          <div className="grid grid-cols-7 gap-1 max-w-[180px]">
                            {r.daysData.map((dObj, i) => {
                              let bg = 'bg-slate-100 text-slate-400';
                              if (dObj.statusType === 'present') bg = 'bg-emerald-100 text-emerald-700';
                              else if (dObj.statusType === 'absent-permit') bg = 'bg-amber-100 text-amber-700';
                              else if (dObj.statusType === 'absent-no-permit') bg = 'bg-rose-100 text-rose-700';
                              return <div key={i} title={dObj.tooltip} className={cn('h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold cursor-help', bg)}>{dObj.label}</div>;
                            })}
                          </div>
                        </div>
                      ) : <p className="text-xs text-muted-foreground italic">No active shifts</p>}
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                   <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Employee</th>
                        <th className="px-5 py-3 font-medium">Weekly Summary</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {summarizedAttendance.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic text-xs">No records for this period</td></tr>
                      ) : (
                        summarizedAttendance.map(r => (
                          <tr key={r.staffId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{r.staffName}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">{r.position}</div>
                            </td>
                            <td className="px-5 py-4">
                              {r.totalShifts > 0 ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground text-xs">{r.totalShifts} Shifts</span>
                                    <span className="text-muted-foreground text-[10px]">({r.dayShifts} Day, {r.nightShifts} Night)</span>
                                  </div>
                                  {r.sites.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="text-[10px] line-clamp-1">{r.sites.join(', ')}</span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-7 gap-1 mt-1 max-w-[200px]">
                                    {r.daysData.map((dObj, i) => {
                                      let bgClass = "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-200";
                                      if (dObj.statusType === 'present') bgClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200";
                                      else if (dObj.statusType === 'absent-permit') bgClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200";
                                      else if (dObj.statusType === 'absent-no-permit') bgClass = "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200";
                                      
                                      return (
                                        <div 
                                          key={i} 
                                          title={dObj.tooltip}
                                          className={cn(
                                            "h-5 w-5 sm:h-6 sm:w-6 rounded flex items-center justify-center text-[9px] sm:text-[10px] font-bold cursor-help transition-all",
                                            bgClass
                                          )}
                                        >
                                          {dObj.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No active shifts</span>
                              )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Card className="border border-border/50 shadow-sm rounded-2xl bg-card overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">Fleet Movement Logs</CardTitle>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/50 text-[11px] font-semibold text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Timestamp</th>
                        <th className="px-5 py-3 font-medium">Vehicle</th>
                        <th className="px-5 py-3 font-medium">Driver</th>
                        <th className="px-5 py-3 font-medium">Destination</th>
                        <th className="px-5 py-3 font-medium">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
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

              {/* Daily Journals / Diary Table */}
              <Card className="border border-border/50 shadow-sm rounded-2xl bg-card overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><BookOpen className="h-4 w-4 text-emerald-600" /> Operations Diary (Daily Journals)</CardTitle>
                </div>
                <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                   {weekJournals.length === 0 || weekJournalEntries.length === 0 ? (
                     <div className="px-6 py-8 text-center text-slate-400 italic text-xs">No diary entries for this period</div>
                   ) : (
                     weekJournals.sort((a,b) => b.date.localeCompare(a.date)).map(j => {
                       const entries = weekJournalEntries.filter(e => e.journalId === j.id);
                       if (entries.length === 0) return null;
                       return (
                         <div key={j.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              {formatDisplayDate(j.date)}
                            </h3>
                            <div className="space-y-4">
                              {entries.map(e => (
                                <div key={e.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-border/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none font-bold text-[10px] uppercase">{e.siteName}</Badge>
                                    <span className="text-[10px] text-muted-foreground font-semibold">Logged by: {e.loggedBy}</span>
                                  </div>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{e.narration}</p>
                                </div>
                              ))}
                            </div>
                         </div>
                       );
                     })
                   )}
                </div>
              </Card>

            </section>
            )}

          </div>

          {/* Right Column - Sidebars & Summary Logs */}
          <div className="lg:col-span-4 space-y-5 sm:space-y-8">
            
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

            {/* PAYMENTS RECEIVED SECTION */}
            {(privs.canViewFinance || currentUser?.role === 'admin') && weekPayments.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-emerald-500/10 pb-3 px-1">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">Payments Received</h2>
                <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-none text-[10px] font-black">{weekPayments.length} records</Badge>
              </div>
              <Card className="border border-border/50 shadow-sm rounded-2xl bg-card overflow-hidden">
                <CardContent className="p-0 divide-y divide-border/50">
                  {weekPayments.sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                    <div key={p.id} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{p.client}</p>
                          {p.site && <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-2.5 w-2.5 shrink-0" />{p.site}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-emerald-600">₦{p.amount.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground font-mono">{p.date}</p>
                        </div>
                      </div>
                      {(p.withholdingTax > 0 || p.discount > 0) && (
                        <div className="flex gap-2 mt-1.5">
                          {p.withholdingTax > 0 && <span className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-900/20 px-1.5 py-0.5 rounded font-semibold">WHT: ₦{p.withholdingTax.toLocaleString()}</span>}
                          {p.discount > 0 && <span className="text-[9px] bg-rose-50 text-rose-700 dark:bg-rose-900/20 px-1.5 py-0.5 rounded font-semibold">Disc: ₦{p.discount.toLocaleString()}</span>}
                          {p.payVat === 'Yes' && p.vat && p.vat > 0 && <span className="text-[9px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 px-1.5 py-0.5 rounded font-semibold">VAT: ₦{p.vat.toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-950/10 flex justify-between items-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Received</span>
                    <span className="text-sm font-black text-emerald-700">₦{totalIncome.toLocaleString()}</span>
                  </div>
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
