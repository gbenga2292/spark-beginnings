import { formatDisplayDate } from '@/src/lib/dateUtils';
import React, { useState, useMemo } from 'react';
import { computeWorkDays } from '@/src/lib/workdays';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Download, FileSpreadsheet, FileText, PieChart as PieChartIcon, Users, Building2, Activity, CheckCircle2, CalendarClock, LayoutGrid, BarChart2, Flame, Eye, Save, AlertCircle, XCircle } from 'lucide-react';
import { useAppStore, DisciplinaryRecord } from '@/src/store/appStore';
import { toast } from '@/src/components/ui/toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { usePriv } from '@/src/hooks/usePriv';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Badge } from '@/src/components/ui/badge';

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

export function Reports() {
  const priv = usePriv('reports');
  const departments = useAppStore((state) => state.departments);
  const nonEmployeeDeptNames = useMemo(() => new Set(departments.filter(d => d.staffType === 'NON-EMPLOYEE').map(d => d.name)), [departments]);

  const employees = useAppStore((state) => state.employees).filter(e => 
    (e.status === 'Active' || e.status === 'On Leave') && 
    e.staffType?.toUpperCase() !== 'NON-EMPLOYEE' && e.staffType?.toUpperCase() !== 'NON EMPLOYEE' &&
    (!e.department || !nonEmployeeDeptNames.has(e.department))
  );
  const sites = useAppStore((state) => state.sites).filter(s => s.name?.toUpperCase() !== 'DCEL' && s.name?.toUpperCase() !== 'OFFICE');
  const attendanceRecords = useAppStore((state) => state.attendanceRecords);
  const leaves = useAppStore((state) => state.leaves);
  const publicHolidays = useAppStore((state) => state.publicHolidays);
  const disciplinaryRecords = useAppStore((state) => state.disciplinaryRecords);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [activeEmpBuilderTab, setActiveEmpBuilderTab] = useState<string>("Identity & Profile");
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'excel' | 'pdf' | 'csv';
    data: any[];
    headers: string[];
    filename: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    type: 'excel',
    data: [],
    headers: [],
    filename: '',
    onConfirm: () => {},
  });

  // Filter state for Staff Site Work Report
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [summaryYear, setSummaryYear] = useState<number>(currentYear);
  const [siteChartView, setSiteChartView] = useState<'table' | 'gantt'>('gantt');
  const [summaryChartView, setSummaryChartView] = useState<'table' | 'heatmap' | 'bar'>('table');
  const [siteStaffTypeFilter, setSiteStaffTypeFilter] = useState<'All' | 'OFFICE' | 'FIELD'>('All');
  const [summaryStaffTypeFilter, setSummaryStaffTypeFilter] = useState<'All' | 'OFFICE' | 'FIELD'>('All');

  const [meritFilter, setMeritFilter] = useState<'All Time' | 'Year' | 'Month'>('All Time');
  const [meritFilterYear, setMeritFilterYear] = useState<number>(currentYear);
  const [meritFilterMonth, setMeritFilterMonth] = useState<number>(new Date().getMonth() + 1);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = [currentYear, currentYear - 1, currentYear - 2];

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const inactiveEmployees = employees.filter(e => e.status !== 'Active').length;
  const totalSites = sites.length;
  const activeSites = sites.filter(s => s.status === 'Active').length;

  const uniqueAttendanceDays = useMemo(() => {
    return new Set(attendanceRecords.map(r => r.date)).size;
  }, [attendanceRecords]);

  const departmentData = useMemo(() => {
    const deps: Record<string, number> = {};
    employees.forEach(e => {
      if (e.status === 'Active') {
        const dep = e.department || 'Unassigned';
        deps[dep] = (deps[dep] || 0) + 1;
      }
    });
    return Object.entries(deps).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [employees]);

  const headcountStatusData = useMemo(() => [
    { name: 'Active', value: activeEmployees, color: '#10b981' },
    { name: 'Inactive', value: inactiveEmployees, color: '#f43f5e' }
  ], [activeEmployees, inactiveEmployees]);


  // ── All staff for site-work report (with optional Office/Field filter) ──
  const siteReportBaseStaff = useMemo(() =>
    employees.filter(emp => emp.status === 'Active'),
  [employees]);

  const operationsStaff = useMemo(() => {
    if (siteStaffTypeFilter === 'All') return siteReportBaseStaff;
    return siteReportBaseStaff.filter(emp => (emp.staffType?.toUpperCase() || '') === siteStaffTypeFilter);
  }, [siteReportBaseStaff, siteStaffTypeFilter]);

  // ── Gantt data: per-employee, per-day attendance grid ──
  const ganttData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const grid: Record<string, Record<number, { site: string; isAbsent: boolean; isNight: boolean }>> = {};

    operationsStaff.forEach(emp => {
      grid[emp.id] = {};
      days.forEach(d => { grid[emp.id][d] = { site: '', isAbsent: false, isNight: false }; });
    });

    attendanceRecords.forEach(rec => {
      const recDate = new Date(rec.date);
      if (recDate.getMonth() + 1 !== selectedMonth || recDate.getFullYear() !== selectedYear) return;
      if (!grid[rec.staffId]) return;
      const day = recDate.getDate();
      const isAbsent = rec.day?.toLowerCase() !== 'yes';
      const isNight = !isAbsent && rec.night?.toLowerCase() === 'yes';
      const site = isAbsent ? 'Absent' : (rec.daySite || rec.nightSite || '');
      grid[rec.staffId][day] = { site, isAbsent, isNight };
    });

    // Office staff: default to 'OFFICE' on elapsed workdays with no record
    const today = new Date();
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
    const lastElapsedDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const publicHolidaySet = new Set(publicHolidays.map(h => h.date));

    operationsStaff.forEach(emp => {
      if (emp.staffType?.toUpperCase() === 'OFFICE') {
        // Find the dept's workDaysPerWeek (default 6 = Mon-Sat)
        const dept = departments.find(d => d.name === emp.department);
        const wdpw = dept?.workDaysPerWeek ?? 6;

        days.forEach(d => {
          if (d > lastElapsedDay) return; // future day — skip
          if (grid[emp.id][d].site) return; // already has a record
          const dateObj = new Date(selectedYear, selectedMonth - 1, d);
          const dow = dateObj.getDay(); // 0=Sun, 6=Sat
          if (dow === 0) return; // Sunday always off
          if (wdpw < 6 && dow === 6) return; // Saturday off
          const iso = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          if (publicHolidaySet.has(iso)) return; // public holiday
          grid[emp.id][d] = { site: 'OFFICE', isAbsent: false, isNight: false };
        });
      }
    });

    return { grid, days };
  }, [attendanceRecords, selectedMonth, selectedYear, operationsStaff, departments, publicHolidays]);

  // ── Active sites for the selected month/year ──
  const activeSitesForMonth = useMemo(() => {
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1).getTime();
    // last day of month at 23:59:59
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).getTime();

    // Sites that have actual attendance this month should ALWAYS be shown.
    const sitesWithAttendanceThisMonth = new Set<string>();
    attendanceRecords.forEach(rec => {
      if (!rec.date) return;
      const parts = rec.date.split('-');
      if (parts.length === 3) {
        const recYear = parseInt(parts[0], 10);
        const recMonth = parseInt(parts[1], 10);
        if (recYear === selectedYear && recMonth === selectedMonth) {
          if (rec.daySite) sitesWithAttendanceThisMonth.add(rec.daySite);
          if (rec.nightSite) sitesWithAttendanceThisMonth.add(rec.nightSite);
        }
      }
    });

    return sites.filter(site => {
      // 1) Force include if they actually had attendance this month
      if (sitesWithAttendanceThisMonth.has(site.name)) return true;

      // 2) Fallback to explicit date check
      let siteStart = 0;
      if (site.startDate && site.startDate.trim() !== '') {
        const parsed = new Date(site.startDate).getTime();
        if (!isNaN(parsed)) siteStart = parsed;
      }

      let siteEnd = Infinity;
      if (site.endDate && site.endDate.trim() !== '') {
        const parsed = new Date(site.endDate).getTime();
        if (!isNaN(parsed)) siteEnd = parsed;
      }

      return siteStart <= monthEnd && siteEnd >= monthStart;
    });
  }, [sites, selectedMonth, selectedYear, attendanceRecords]);

  // ── Site color palette ──
  const SITE_COLORS: Record<string, { bg: string; text: string; border: string }> = useMemo(() => {
    const palette = [
      { bg: '#6366f1', text: '#fff', border: '#4f46e5' },
      { bg: '#10b981', text: '#fff', border: '#059669' },
      { bg: '#f59e0b', text: '#fff', border: '#d97706' },
      { bg: '#3b82f6', text: '#fff', border: '#2563eb' },
      { bg: '#ec4899', text: '#fff', border: '#db2777' },
      { bg: '#8b5cf6', text: '#fff', border: '#7c3aed' },
      { bg: '#14b8a6', text: '#fff', border: '#0d9488' },
      { bg: '#f97316', text: '#fff', border: '#ea580c' },
    ];
    const map: Record<string, { bg: string; text: string; border: string }> = {};
    sites.forEach((s, i) => { map[s.name] = palette[i % palette.length]; });
    // OFFICE is always a fixed slate-blue
    map['OFFICE'] = { bg: '#334155', text: '#fff', border: '#1e293b' };
    return map;
  }, [sites]);

  // ── Merit / performance scores ──
  const staffMeritRecords = useAppStore(s => s.staffMeritRecords);

  const netContextPoints = useMemo(() => {
    return staffMeritRecords.reduce((sum, r) => {
      const pts = r.recordType === 'Accolade' ? 1 : -1;
      return sum + pts;
    }, 0);
  }, [staffMeritRecords]);

  const performanceLeaderboard = useMemo(() => {
    let filteredRecords = staffMeritRecords;
    if (meritFilter === 'Year') {
      filteredRecords = staffMeritRecords.filter(r => {
        const d = new Date(r.incidentDate || r.createdAt);
        return d.getFullYear() === meritFilterYear;
      });
    } else if (meritFilter === 'Month') {
      filteredRecords = staffMeritRecords.filter(r => {
        const d = new Date(r.incidentDate || r.createdAt);
        return d.getFullYear() === meritFilterYear && d.getMonth() + 1 === meritFilterMonth;
      });
    }

    const scores: Record<string, { name: string; points: number }> = {};
    filteredRecords.forEach(r => {
      if (!scores[r.employeeId]) scores[r.employeeId] = { name: r.employeeName, points: 0 };
      const pts = r.recordType === 'Accolade' ? 1 : -1;
      scores[r.employeeId].points += pts;
    });
    return Object.values(scores).sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 5);
  }, [staffMeritRecords, meritFilter, meritFilterYear, meritFilterMonth]);

  // Calculate site work data for all staff
  const operationsStaffSiteData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    const filteredRecords = attendanceRecords.filter(rec => {
      const recDate = new Date(rec.date);
      return recDate.getMonth() + 1 === selectedMonth && recDate.getFullYear() === selectedYear;
    });

    const siteCounts: Record<string, Record<string, number>> = {};
    // Track which calendar days have ANY record per employee
    const recordedDays: Record<string, Set<number>> = {};

    operationsStaff.forEach(emp => {
      siteCounts[emp.id] = {};
      recordedDays[emp.id] = new Set();
      activeSitesForMonth.forEach(site => {
        siteCounts[emp.id][site.name] = 0;
      });
      // Office staff always get an OFFICE bucket
      if (emp.staffType?.toUpperCase() === 'OFFICE') {
        siteCounts[emp.id]['OFFICE'] = 0;
      }
    });

    filteredRecords.forEach(rec => {
      const empId = rec.staffId;
      if (siteCounts[empId]) {
        const day = new Date(rec.date).getDate();
        recordedDays[empId].add(day);
        // Count day site
        if (rec.daySite && rec.day === 'Yes') {
          siteCounts[empId][rec.daySite] = (siteCounts[empId][rec.daySite] || 0) + 1;
        }
        // Count night site
        if (rec.nightSite && rec.night === 'Yes') {
          siteCounts[empId][rec.nightSite] = (siteCounts[empId][rec.nightSite] || 0) + 1;
        }
      }
    });

    // Office staff: unrecorded days count as 'OFFICE' (only elapsed workdays)
    const today = new Date();
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
    const lastElapsedDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const publicHolidaySet = new Set(publicHolidays.map(h => h.date));

    operationsStaff.forEach(emp => {
      if (emp.staffType?.toUpperCase() === 'OFFICE' && siteCounts[emp.id]) {
        const dept = departments.find(d => d.name === emp.department);
        const wdpw = dept?.workDaysPerWeek ?? 6;

        let validOfficeDays = 0;
        for (let d = 1; d <= lastElapsedDay; d++) {
          if (recordedDays[emp.id]?.has(d)) continue; // Day already has a record

          const dateObj = new Date(selectedYear, selectedMonth - 1, d);
          const dow = dateObj.getDay();
          if (dow === 0) continue; // Sunday off
          if (wdpw < 6 && dow === 6) continue; // Saturday off

          const iso = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          if (publicHolidaySet.has(iso)) continue; // Public holiday

          validOfficeDays++;
        }

        siteCounts[emp.id]['OFFICE'] = validOfficeDays;
      }
    });

    return { siteCounts, totalRecords: filteredRecords.length };
  }, [attendanceRecords, selectedMonth, selectedYear, operationsStaff, activeSitesForMonth, departments, publicHolidays]);

  // Calculate monthly work summary for all staff (excluding Engineer and CEO), with optional Office/Field filter
  const summaryBaseStaff = useMemo(() => {
    return employees.filter(emp =>
      emp.status === 'Active' &&
      emp.position !== 'Engineer' &&
      emp.position !== 'CEO'
    );
  }, [employees]);

  const operationsInternalStaff = useMemo(() => {
    if (summaryStaffTypeFilter === 'All') return summaryBaseStaff;
    return summaryBaseStaff.filter(emp => (emp.staffType?.toUpperCase() || '') === summaryStaffTypeFilter);
  }, [summaryBaseStaff, summaryStaffTypeFilter]);

  const monthlyWorkSummary = useMemo(() => {
    const summaryData: Record<string, { 
      name: string; 
      position: string;
      months: Record<number, { daysWorked: number; otDays: number; daysAbsent: number }>;
    }> = {};

    // Initialize all staff
    operationsInternalStaff.forEach(emp => {
      summaryData[emp.id] = {
        name: `${emp.surname} ${emp.firstname}`,
        position: emp.position,
        months: {}
      };
      // Initialize all 12 months
      for (let m = 1; m <= 12; m++) {
        summaryData[emp.id].months[m] = { daysWorked: 0, otDays: 0, daysAbsent: 0 };
      }
    });

    // Filter attendance records for the selected year
    const yearRecords = attendanceRecords.filter(rec => {
      const recDate = new Date(rec.date);
      return recDate.getFullYear() === summaryYear;
    });

    // Process records
    yearRecords.forEach(rec => {
      const empId = rec.staffId;
      if (summaryData[empId]) {
        const month = rec.mth || new Date(rec.date).getMonth() + 1;
        if (month >= 1 && month <= 12) {
          if (rec.day === 'Yes') {
            if ((rec.ot ?? 0) > 0) {
              summaryData[empId].months[month].otDays += 1;
            } else {
              summaryData[empId].months[month].daysWorked += 1;
            }
          }
          if (rec.absentStatus === 'Absent') {
            summaryData[empId].months[month].daysAbsent += 1;
          }
        }
      }
    });

    return summaryData;
  }, [attendanceRecords, summaryYear, operationsInternalStaff]);

  // Calculate totals
  const staffTotals = useMemo(() => {
    const totals: Record<string, { totalDaysWorked: number; totalOTDays: number; totalDaysAbsent: number }> = {};
    Object.entries(monthlyWorkSummary).forEach(([empId, data]) => {
      let totalDaysWorked = 0;
      let totalOTDays = 0;
      let totalDaysAbsent = 0;
      Object.values(data.months).forEach(m => {
        totalDaysWorked += m.daysWorked;
        totalOTDays += m.otDays;
        totalDaysAbsent += m.daysAbsent;
      });
      totals[empId] = { totalDaysWorked, totalOTDays, totalDaysAbsent };
    });
    return totals;
  }, [monthlyWorkSummary]);

  // Grand totals for the footer
  const grandTotals = useMemo(() => {
    let totalDaysWorked = 0;
    let totalOTDays = 0;
    let totalDaysAbsent = 0;
    const monthTotals: Record<number, { daysWorked: number; otDays: number; daysAbsent: number }> = {};
    
    for (let m = 1; m <= 12; m++) {
      monthTotals[m] = { daysWorked: 0, otDays: 0, daysAbsent: 0 };
    }

    Object.values(monthlyWorkSummary).forEach(data => {
      Object.entries(data.months).forEach(([month, stats]) => {
        const m = parseInt(month);
        monthTotals[m].daysWorked += stats.daysWorked;
        monthTotals[m].otDays += stats.otDays;
        monthTotals[m].daysAbsent += stats.daysAbsent;
      });
    });

    Object.values(staffTotals).forEach(t => {
      totalDaysWorked += t.totalDaysWorked;
      totalOTDays += t.totalOTDays;
      totalDaysAbsent += t.totalDaysAbsent;
    });

    return { totalDaysWorked, totalOTDays, totalDaysAbsent, monthTotals };
  }, [monthlyWorkSummary, staffTotals]);

  // Export function for monthly work summary
  const exportMonthlyWorkSummary = () => {
    const headers = ['Full Name'];
    months.forEach(m => {
      headers.push(`${m.label}_Days Wk`, `${m.label}_OT Wk`, `${m.label}_Days_Abs`);
    });
    headers.push('Total_Days Wk', 'Total_OT Wk', 'Total_Days_Abs');

    const rows = operationsInternalStaff.map(emp => {
      const row: (string | number)[] = [monthlyWorkSummary[emp.id]?.name || ''];
      const data = monthlyWorkSummary[emp.id];
      const totals = staffTotals[emp.id];

      for (let m = 1; m <= 12; m++) {
        row.push(data?.months[m]?.daysWorked || 0);
        row.push(data?.months[m]?.otDays || 0);
        row.push(data?.months[m]?.daysAbsent || 0);
      }

      row.push(totals?.totalDaysWorked || 0);
      row.push(totals?.totalOTDays || 0);
      row.push(totals?.totalDaysAbsent || 0);

      return row;
    });

    // Add total row
    const totalRow: (string | number)[] = ['Total'];
    for (let m = 1; m <= 12; m++) {
      totalRow.push(grandTotals.monthTotals[m].daysWorked);
      totalRow.push(grandTotals.monthTotals[m].otDays);
      totalRow.push(grandTotals.monthTotals[m].daysAbsent);
    }
    totalRow.push(grandTotals.totalDaysWorked);
    totalRow.push(grandTotals.totalOTDays);
    totalRow.push(grandTotals.totalDaysAbsent);

    const fileName = `operations_staff_monthly_summary_${summaryYear}.csv`;

    if (window.electronAPI?.savePathDialog) {
      window.electronAPI.savePathDialog({
        title: 'Export Monthly Summary (CSV)',
        defaultPath: fileName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      }).then(filePath => {
        if (filePath) {
          const csvData = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n") + "\n" + totalRow.join(",") + "\n";
          window.electronAPI.writeFile(filePath, csvData, 'utf8').then(success => {
            if (success) toast.success(`Exported to ${filePath}`);
            else toast.error('Failed to save file.');
          });
        }
      });
    } else {
      // Create CSV
      let csv = "data:text/csv;charset=utf-8,";
      csv += headers.join(",") + "\n";
      rows.forEach(row => {
        csv += row.join(",") + "\n";
      });
      csv += totalRow.join(",") + "\n";

      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csv));
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    showExportMessage("Operations Staff Monthly Summary exported!");
  };


  // Export to Excel
  const exportMonthlyWorkSummaryExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const headers = ['Full Name'];
    months.forEach(m => {
      headers.push(`${m.label}_Days Wk`, `${m.label}_OT Wk`, `${m.label}_Days_Abs`);
    });
    headers.push('Total_Days Wk', 'Total_OT Wk', 'Total_Days_Abs');

    const data = operationsInternalStaff.map(emp => {
      const row: (string | number)[] = [monthlyWorkSummary[emp.id]?.name || ''];
      const staffData = monthlyWorkSummary[emp.id];
      const totals = staffTotals[emp.id];

      for (let m = 1; m <= 12; m++) {
        row.push(staffData?.months[m]?.daysWorked || 0);
        row.push(staffData?.months[m]?.otDays || 0);
        row.push(staffData?.months[m]?.daysAbsent || 0);
      }

      row.push(totals?.totalDaysWorked || 0);
      row.push(totals?.totalOTDays || 0);
      row.push(totals?.totalDaysAbsent || 0);

      return row;
    });

    // Add total row
    const totalRow: (string | number)[] = ['Total'];
    for (let m = 1; m <= 12; m++) {
      totalRow.push(grandTotals.monthTotals[m].daysWorked);
      totalRow.push(grandTotals.monthTotals[m].otDays);
      totalRow.push(grandTotals.monthTotals[m].daysAbsent);
    }
    totalRow.push(grandTotals.totalDaysWorked);
    totalRow.push(grandTotals.totalOTDays);
    totalRow.push(grandTotals.totalDaysAbsent);
    
    data.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
    
    const fileName = `operations_staff_monthly_summary_${summaryYear}.xlsx`;
    if (window.electronAPI?.savePathDialog) {
      window.electronAPI.savePathDialog({
        title: 'Export Monthly Summary (Excel)',
        defaultPath: fileName,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      }).then(filePath => {
        if (filePath) {
          const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          window.electronAPI.writeFile(filePath, buf, 'binary').then(success => {
            if (success) toast.success(`Exported to ${filePath}`);
            else toast.error('Failed to save file.');
          });
        }
      });
    } else {
      XLSX.writeFile(wb, fileName);
    }
    showExportMessage("Operations Staff Monthly Summary Excel exported!");
  };


  const toggleField = (field: string) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

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
      doc.text(`Generated on: ${formatDisplayDate(Date.now())}`, 14, 40);
      autoTable(doc, { startY: 46, head, body, theme: 'striped', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8, cellPadding: 3 } });
      doc.save(filename);
      showExportMessage(`${title} PDF exported successfully!`);
    } catch (error) {
      console.error('Error generating PDF', error);
      toast.error('Failed to generate PDF.');
    }
  };

  const exportHeadcountReport = () => {
    const csvData = "Employee ID,Surname,Firstname,Department,Position,Status,Start Date\n" + 
      employees.map(emp => `${emp.id},${emp.surname},${emp.firstname},${emp.department},${emp.position},${emp.status},${formatDisplayDate(emp.startDate)}`).join("\n");
    
    const fileName = "headcount_report.csv";
    if (window.electronAPI?.savePathDialog) {
      window.electronAPI.savePathDialog({
        title: 'Export Headcount Report (CSV)',
        defaultPath: fileName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      }).then(filePath => {
        if (filePath) {
          window.electronAPI.writeFile(filePath, csvData, 'utf8').then(success => {
            if (success) toast.success(`Exported to ${filePath}`);
            else toast.error('Failed to save file.');
          });
        }
      });
    } else {
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csvData));
      link.setAttribute("download", fileName);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    showExportMessage("Headcount Report exported!");
  };

  const exportHeadcountPdf = () => {
    const head = [["Employee ID", "Surname", "Firstname", "Department", "Position", "Status", "Start Date"]];
    const body = employees.map(emp => [emp.id, emp.surname, emp.firstname, emp.department, emp.position, emp.status, formatDisplayDate(emp.startDate)]);
    generatePdf("Headcount Report", head, body, "headcount_report.pdf");
  };

  const exportAttendanceReport = () => {
    if (attendanceRecords.length === 0) { toast.error('No attendance records found.'); return; }
    const csvData = "Date,Staff Name,Position,Day Site,Night Site,Day,Night,Absent Status,OT,Present\n" + 
      attendanceRecords.map(rec => `${formatDisplayDate(rec.date)},${rec.staffName},${rec.position},${rec.daySite},${rec.nightSite},${rec.day},${rec.night},${rec.absentStatus},${rec.ot},${rec.isPresent}`).join("\n");
    
    const fileName = "attendance_report.csv";
    if (window.electronAPI?.savePathDialog) {
      window.electronAPI.savePathDialog({
        title: 'Export Attendance Report (CSV)',
        defaultPath: fileName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      }).then(filePath => {
        if (filePath) {
          window.electronAPI.writeFile(filePath, csvData, 'utf8').then(success => {
            if (success) toast.success(`Exported to ${filePath}`);
            else toast.error('Failed to save file.');
          });
        }
      });
    } else {
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csvData));
      link.setAttribute("download", fileName);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
    showExportMessage("Attendance Report exported!");
  };

  const exportAttendancePdf = () => {
    if (attendanceRecords.length === 0) { toast.error('No attendance records found.'); return; }
    const head = [["Date", "Staff Name", "Day Site", "Night Site", "Present", "OT"]];
    const body = attendanceRecords.slice(0, 100).map(rec => [formatDisplayDate(rec.date), rec.staffName, rec.daySite, rec.nightSite, rec.isPresent, rec.ot ?? 0] as (string | number)[]);
    generatePdf("Attendance Report (Recent)", head, body, "attendance_report.pdf");
  };

  // All available report fields grouped by category
  const REPORT_FIELD_GROUPS = [
    {
      group: 'Identity',
      color: 'indigo',
      fields: ['Employee ID', 'Full Name', 'Surname', 'Firstname', 'Phone', 'Email'],
    },
    {
      group: 'Employment',
      color: 'emerald',
      fields: ['Department', 'Secondary Departments', 'Position', 'Staff Type', 'Level', 'Status', 'Start Date', 'End Date', 'Probation Period', 'Tentative Start Date', 'Verified Start Date', 'Line Manager'],
    },

    {
      group: 'HR',
      color: 'rose',
      fields: ['Yearly Leave Balance', 'Leave Status', 'Leave Days Taken', 'Leave Days Remaining', 'Currently On Leave', 'No of Guarantors'],
    },
    {
      group: 'Compliance',
      color: 'violet',
      fields: ['Tax Type', 'Withholding Tax', 'Withholding Tax Rate', 'PAYE Tax', 'PAYE Number'],
    },
    {
      group: 'Health',
      color: 'sky',
      fields: ['LASHMA Policy', 'LASHMA Reg Date', 'LASHMA Expiry'],
    }
  ];

  const ALL_REPORT_FIELDS = REPORT_FIELD_GROUPS.flatMap(g => g.fields);

  // Resolve a field value for an employee
  const resolveField = (emp: typeof employees[0], field: string): string | number => {
    // Pre-compute leave info for this employee
    const empLeaves = leaves.filter(l => l.employeeId === emp.id);
    const totalTaken = empLeaves.reduce((sum, l) => sum + (l.dateReturned ? l.duration : 0), 0);
    const remaining  = Math.max(0, (emp.yearlyLeave ?? 0) - totalTaken);

    switch (field) {
      case 'Employee ID':           return emp.employeeCode || 'N/A';
      case 'Full Name':             return `${emp.surname} ${emp.firstname}`;
      case 'Surname':               return emp.surname;
      case 'Firstname':             return emp.firstname;
      case 'Phone':                 return emp.phone || 'N/A';
      case 'Email':                 return emp.email || 'N/A';
      case 'Department':            return emp.department || 'N/A';
      case 'Secondary Departments': return emp.secondaryDepartments?.join(', ') || 'N/A';
      case 'Position':              return emp.position || 'N/A';
      case 'Staff Type':            return emp.staffType || 'N/A';
      case 'Level':                 return emp.level ?? 'N/A';
      case 'Status':                return emp.status;
      case 'Start Date':            return formatDisplayDate(emp.startDate) || 'N/A';
      case 'End Date':              return formatDisplayDate(emp.endDate) || 'N/A';
      case 'Probation Period':      return emp.probationPeriod ? `${emp.probationPeriod} days` : 'N/A';
      case 'Tentative Start Date':  return emp.tentativeStartDate ? formatDisplayDate(emp.tentativeStartDate) : 'N/A';
      case 'Verified Start Date':   return emp.verifiedStartDate ? formatDisplayDate(emp.verifiedStartDate) : 'N/A';
      case 'Line Manager': {
        if (!emp.lineManager) return 'N/A';
        const manager = employees.find(e => e.id === emp.lineManager);
        if (manager) return `${manager.surname} ${manager.firstname}`;
        return emp.lineManager;
      }
      case 'Bank Name':             return emp.bankName || 'N/A';
      case 'Account Number':        return emp.accountNo || 'N/A';
      case 'Pension Number':        return emp.pensionNumber || 'N/A';
      case 'Tax ID':                return emp.taxId || 'N/A';
      case 'Payee Type':            return emp.payeeType || 'N/A';
      case 'Type of Pay':           return emp.typeOfPay || 'N/A';
      case 'Start Month of Pay':    return emp.startMonthOfPay || 'N/A';
      case 'Yearly Leave Balance':  return emp.yearlyLeave ?? 'N/A';
      case 'Leave Status':          return emp.status === 'On Leave' ? 'On Leave' : 'Not on Leave';
      case 'Leave Days Taken':      return totalTaken;
      case 'Leave Days Remaining':  return remaining;
      case 'Currently On Leave':    return emp.status === 'On Leave' ? 'Yes' : 'No';
      case 'No of Guarantors':      return emp.noOfGuarantors ?? 'N/A';
      case 'Tax Type':              return emp.payeTax ? 'PAYE' : (emp.withholdingTax ? 'Withholding' : 'None');
      case 'Withholding Tax':       return emp.withholdingTax ? 'Yes' : 'No';
      case 'Withholding Tax Rate':  return emp.withholdingTaxRate ? `${(emp.withholdingTaxRate * 100).toFixed(1)}%` : 'N/A';
      case 'PAYE Tax':              return emp.payeTax ? 'Yes' : 'No';
      case 'PAYE Number':           return emp.payeNumber || 'N/A';
      case 'LASHMA Policy':         return emp.lashmaPolicyNumber || 'N/A';
      case 'LASHMA Reg Date':       return emp.lashmaRegistrationDate ? formatDisplayDate(emp.lashmaRegistrationDate) : 'N/A';
      case 'LASHMA Expiry':         return emp.lashmaExpiryDate ? formatDisplayDate(emp.lashmaExpiryDate) : 'N/A';
      default: return '';
    }
  };

  const generateReport = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one data point.'); return; }
    const headers = selectedFields;
    const body = employees.map(emp => selectedFields.map(field => resolveField(emp, field)));

    const fileName = "custom_employee_report.csv";

    setPreviewModal({
      isOpen: true,
      title: "Custom Employee Report (CSV)",
      type: 'csv',
      data: body,
      headers: headers,
      filename: fileName,
      onConfirm: () => {
        const csvData = headers.join(",") + "\n" + 
          body.map(row => row.map(val => String(val).includes(',') ? `"${val}"` : val).join(",")).join("\n");

        if (window.electronAPI?.savePathDialog) {
          window.electronAPI.savePathDialog({
            title: 'Export Custom Report (CSV)',
            defaultPath: fileName,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
          }).then(filePath => {
            if (filePath) {
              window.electronAPI.writeFile(filePath, csvData, 'utf8').then(success => {
                if (success) toast.success(`Exported to ${filePath}`);
                else toast.error('Failed to save file.');
              });
            }
          });
        } else {
          const link = document.createElement("a");
          link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csvData));
          link.setAttribute("download", fileName);
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }
        showExportMessage("Custom Employee Report (CSV) generated!");
      }
    });
  };

  const generateReportPdf = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one data point.'); return; }
    const head = [selectedFields];
    const body = employees.map(emp => selectedFields.map(field => String(resolveField(emp, field))));
    
    setPreviewModal({
      isOpen: true,
      title: 'Custom Employee Report (PDF)',
      type: 'pdf',
      data: body,
      headers: head[0],
      filename: 'custom_employee_report.pdf',
      onConfirm: () => generatePdf('Custom Employee Report', head, body, 'custom_employee_report.pdf')
    });
  };

  const renderReportPreview = () => {
    if (!previewModal.isOpen) return null;

    return (
      <Dialog open={previewModal.isOpen} onOpenChange={(open: boolean) => setPreviewModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader className="px-6 py-4 bg-slate-50/50 border-b">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>{previewModal.title}</DialogTitle>
                  <p className="text-sm text-slate-500 font-medium">Previewing report content before export</p>
                </div>
              </div>
              <Badge className="bg-indigo-600 text-white font-bold uppercase tracking-wider px-3 py-1">
                {previewModal.type.toUpperCase()}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table className="text-[11px] whitespace-nowrap">
                  <TableHeader className="bg-slate-900 sticky top-0 z-10">
                    <TableRow className="hover:bg-slate-900 border-none">
                      {previewModal.headers.map((h, i) => (
                        <TableHead key={i} className="text-slate-300 font-bold uppercase tracking-wider h-10 px-4">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewModal.data.map((row, ri) => (
                      <TableRow key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        {Object.values(row).map((val: any, ci) => (
                          <TableCell key={ci} className="px-4 py-2.5 font-medium text-slate-700 border-r border-slate-100 last:border-0">{String(val || '-')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {previewModal.data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={previewModal.headers.length} className="px-4 py-12 text-center text-slate-400 font-medium">
                          No data to display in the preview.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 font-medium leading-relaxed">
                Verification complete: Clicking save will generate the full document as {previewModal.filename}.
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-slate-50/50 border-t items-center justify-between sm:justify-between">
            <Button 
              variant="ghost" 
              className="gap-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              onClick={() => setPreviewModal(prev => ({ ...prev, isOpen: false }))}
            >
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
            <div className="flex gap-3">
              <Button 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200"
                onClick={() => {
                  previewModal.onConfirm();
                  setPreviewModal(prev => ({ ...prev, isOpen: false }));
                }}
              >
                <Save className="h-4 w-4" /> Save Report
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  useSetPageTitle(
    'Reports & Analytics',
    'Workforce insights, attendance trends, and HR compliance reports',
    <div className="flex items-center gap-2">
      {selectedFields.length > 0 && priv.canExport && (
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 shadow-sm animate-in fade-in zoom-in-95">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] font-bold uppercase tracking-wider bg-white gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-2" 
            onClick={generateReport}
          >
            <FileSpreadsheet className="h-3 w-3" /> CSV
          </Button>
          <Button 
            size="sm" 
            className="h-7 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-2" 
            onClick={generateReportPdf}
          >
            <FileText className="h-3 w-3" /> PDF
          </Button>
        </div>
      )}
    </div>,
    [selectedFields, priv.canExport]
  );

  return (
    <div className="flex flex-col gap-8 pb-10">
      {renderReportPreview()}

      {/* High-Density Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-indigo-100 bg-indigo-50/50 shadow-none border">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-bold text-indigo-900 uppercase tracking-wider opacity-70">Total Workforce</CardTitle>
            <Users className="h-3.5 w-3.5 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-indigo-900 leading-none">{totalEmployees}</div>
            <p className="text-[10px] text-indigo-600 mt-1 opacity-80 font-medium">{activeEmployees} Active, {inactiveEmployees} Inactive</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/50 shadow-none border">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-bold text-emerald-900 uppercase tracking-wider opacity-70">Active Operations</CardTitle>
            <Building2 className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-emerald-900 leading-none">{activeSites}</div>
            <p className="text-[10px] text-emerald-600 mt-1 opacity-80 font-medium">of {totalSites} total sites</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/50 shadow-none border">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-bold text-amber-900 uppercase tracking-wider opacity-70">Attendance Log</CardTitle>
            <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-amber-900 leading-none">{uniqueAttendanceDays}</div>
            <p className="text-[10px] text-amber-600 mt-1 opacity-80 font-medium">Unique days recorded</p>
          </CardContent>
        </Card>

        <Card className={`shadow-none border ${netContextPoints >= 0 ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className={`text-xs font-bold uppercase tracking-wider opacity-70 ${netContextPoints >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>Personnel Score</CardTitle>
            <Flame className={`h-3.5 w-3.5 ${netContextPoints >= 0 ? 'text-orange-500' : 'text-rose-500'}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-2xl font-bold leading-none ${netContextPoints >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
               {netContextPoints > 0 ? `+${netContextPoints}` : netContextPoints}
            </div>
            <p className={`text-[10px] mt-1 opacity-80 font-medium ${netContextPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net workforce rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <Activity className="h-5 w-5 text-indigo-600" /> Employees by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Employees">
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#4f46e5' }} formatter={(v: any) => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <PieChartIcon className="h-5 w-5 text-emerald-600" /> Headcount Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex justify-center items-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                <PieChart>
                  <Pie data={headcountStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value, percent }: any) => `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine={true}>
                    {headcountStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1">
        <Card className="shadow-sm bg-white border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center w-full">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                <Flame className="h-5 w-5 text-orange-500" /> Professional Merit Leaderboard
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-2">Top 5 Performers</span>
              </CardTitle>
              <div className="flex gap-2 items-center">
                <select
                  className="h-8 rounded-md border border-slate-200 text-sm px-2 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={meritFilter}
                  onChange={(e) => setMeritFilter(e.target.value as any)}
                >
                  <option value="All Time">All Time</option>
                  <option value="Year">Year</option>
                  <option value="Month">Month</option>
                </select>

                {(meritFilter === 'Year' || meritFilter === 'Month') && (
                  <select
                    className="h-8 rounded-md border border-slate-200 text-sm px-2 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={meritFilterYear}
                    onChange={(e) => setMeritFilterYear(Number(e.target.value))}
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = currentYear - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                )}

                {meritFilter === 'Month' && (
                  <select
                    className="h-8 rounded-md border border-slate-200 text-sm px-2 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={meritFilterMonth}
                    onChange={(e) => setMeritFilterMonth(Number(e.target.value))}
                  >
                    {months.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
               {performanceLeaderboard.length === 0 ? (
                 <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">No merit points recorded yet.</div>
               ) : (
                <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                  <BarChart data={performanceLeaderboard} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="points" radius={[0, 10, 10, 0]}>
                       {performanceLeaderboard.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.points > 0 ? '#10b981' : '#f43f5e'} />
                       ))}
                       <LabelList dataKey="points" position="right" style={{fontWeight: 'bold', fontSize: '12px'}} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
               )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Export Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Headcount & Turnover</CardTitle>
            <Users className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Employee demographics, growth, and retention rates.</p>
            {priv.canExport ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportHeadcountReport}>
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportHeadcountPdf}>
                  <FileText className="h-4 w-4" /> PDF
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Export not permitted</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Attendance & Leave</CardTitle>
            <CalendarClock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4 h-10">Track absenteeism, overtime hours, and leave balances.</p>
            {priv.canExport ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportAttendanceReport}>
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={exportAttendancePdf}>
                  <FileText className="h-4 w-4" /> PDF
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Export not permitted</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Site Work Report */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Staff Site Work Report
            </CardTitle>
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setSiteChartView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  siteChartView === 'table'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setSiteChartView('gantt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  siteChartView === 'gantt'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" /> Schedule Chart
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Staff Type:</label>
              <select
                value={siteStaffTypeFilter}
                onChange={(e) => setSiteStaffTypeFilter(e.target.value as any)}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="All">All</option>
                <option value="OFFICE">Office</option>
                <option value="FIELD">Field</option>
              </select>
            </div>
            <div className="ml-auto text-sm text-slate-500">
              {operationsStaffSiteData.totalRecords} attendance records for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </div>
          </div>

          {siteChartView === 'table' ? (
            /* ── TABLE VIEW ── */
            (() => {
              // Include synthetic 'OFFICE' column when any office staff are shown
              const hasOfficeStaff = operationsStaff.some(emp => emp.staffType?.toUpperCase() === 'OFFICE');
              const officeSite = { id: 'OFFICE', name: 'OFFICE' };
              const tableSites = hasOfficeStaff
                ? [...activeSitesForMonth, officeSite]
                : activeSitesForMonth;
              return (
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <Table className="max-h-[420px]">
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-800 to-slate-700 sticky top-0 z-10">
                        <TableHead className="text-left font-semibold text-white py-2 px-3 whitespace-nowrap">Employee</TableHead>
                        {tableSites.map(site => (
                          <TableHead
                            key={site.id}
                            className={`text-center font-semibold text-white py-2 px-2 whitespace-nowrap ${
                              site.id === 'OFFICE' ? 'bg-slate-600/60' : ''
                            }`}
                          >{site.name}</TableHead>
                        ))}
                        <TableHead className="text-center font-semibold text-white bg-indigo-700/60 py-2 px-3 whitespace-nowrap">Total Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operationsStaff.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={tableSites.length + 2} className="text-center py-8 text-slate-500">
                            No staff found for the selected filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        operationsStaff.map((emp, idx) => {
                          const empSiteCounts = operationsStaffSiteData.siteCounts[emp.id] || {};
                          const totalDays = Object.values(empSiteCounts).reduce((sum: number, count) => sum + (count as number), 0);
                          const isOffice = emp.staffType?.toUpperCase() === 'OFFICE';
                          return (
                            <TableRow key={emp.id} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                              <TableCell className="font-medium text-slate-800 py-1.5 px-3">
                                <div className="text-sm leading-tight">{emp.surname} {emp.firstname}</div>
                                <div className="text-xs text-slate-400 leading-tight">{emp.position}</div>
                              </TableCell>
                              {tableSites.map(site => {
                                const days = empSiteCounts[site.name] || 0;
                                const isOfficeSiteCol = site.id === 'OFFICE';
                                return (
                                  <TableCell
                                    key={site.id}
                                    className={`text-center py-1.5 px-2 text-sm ${
                                      days > 0
                                        ? isOfficeSiteCol
                                          ? 'font-semibold text-slate-700'
                                          : 'font-semibold text-emerald-700'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {days > 0 ? (
                                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                        isOfficeSiteCol
                                          ? 'bg-slate-200 text-slate-700'
                                          : 'bg-emerald-100 text-emerald-700'
                                      }`}>{days}</span>
                                    ) : (isOffice && isOfficeSiteCol ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-xs font-bold">0</span>
                                    ) : '—')}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center py-1.5 px-3">
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold px-2">{totalDays}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
            </div>
              );
            })()
          ) : (
            /* ── GANTT / SCHEDULE CHART VIEW ── */
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Legend:</span>
                {/* Show OFFICE chip first if any office staff are visible */}
                {operationsStaff.some(e => e.staffType?.toUpperCase() === 'OFFICE') && (
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#334155' }}>
                    <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#334155' }}></span>
                    OFFICE (default)
                  </span>
                )}
                {activeSitesForMonth.map(site => {
                  const color = SITE_COLORS[site.name];
                  return (
                    <span key={site.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: color?.bg ?? '#6366f1' }}>
                      <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color?.bg ?? '#6366f1' }}></span>
                      {site.name}
                    </span>
                  );
                })}
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                  <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0 bg-red-500"></span>
                  Absent
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0 bg-slate-200 border border-slate-300"></span>
                  No Record
                </span>
              </div>

              {/* Chart grid */}
              <div className="overflow-x-auto">
                <div className="overflow-y-auto" style={{ maxHeight: '450px' }}>
                  <div style={{ minWidth: `${Math.max(700, 160 + ganttData.days.length * 34)}px` }}>
                    {/* Header row: day numbers */}
                    <div className="flex sticky top-0 z-20 bg-slate-800">
                      {/* Employee name column */}
                      <div className="flex-shrink-0 w-40 px-3 py-2 border-r border-slate-700">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Employee</span>
                      </div>
                      {/* Day columns */}
                      {ganttData.days.map(day => {
                        const dateObj = new Date(selectedYear, selectedMonth - 1, day);
                        const dow = dateObj.getDay(); // 0=Sun, 6=Sat
                        const isWeekend = dow === 0 || dow === 6;
                        return (
                          <div
                            key={day}
                            className={`flex-shrink-0 w-8 text-center py-2 border-r border-slate-700 ${
                              isWeekend ? 'bg-slate-700/60' : ''
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-200 leading-none">{day}</div>
                            <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                              {['Su','Mo','Tu','We','Th','Fr','Sa'][dow]}
                            </div>
                          </div>
                        );
                      })}
                      {/* Total column */}
                      <div className="flex-shrink-0 w-12 text-center px-1 py-2 bg-indigo-900/60">
                        <span className="text-xs font-semibold text-slate-200">Days</span>
                      </div>
                    </div>

                    {/* Employee rows */}
                    {operationsStaff.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">No staff found for the selected filter.</div>
                    ) : (
                      operationsStaff.map((emp, idx) => {
                        const empGrid = ganttData.grid[emp.id] || {};
                        const totalAssigned = Object.values(empGrid).filter(v => v.site && v.site !== 'Absent').length;
                        const totalAbsent  = Object.values(empGrid).filter(v => v.isAbsent).length;

                        return (
                          <div
                            key={emp.id}
                            className={`flex border-b border-slate-100 last:border-0 hover:bg-indigo-50/30 transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            {/* Employee name */}
                            <div className="flex-shrink-0 w-40 px-3 py-2 border-r border-slate-200 flex flex-col justify-center">
                              <div className="text-xs font-semibold text-slate-800 leading-tight truncate">{emp.surname} {emp.firstname}</div>
                              <div className="text-[10px] text-slate-400 leading-tight truncate">{emp.position}</div>
                            </div>

                            {/* Day cells */}
                            {ganttData.days.map(day => {
                              const cell = empGrid[day];
                              const dateObj = new Date(selectedYear, selectedMonth - 1, day);
                              const dow = dateObj.getDay();
                              const isWeekend = dow === 0 || dow === 6;
                              const siteName = cell?.site || '';
                              const color = SITE_COLORS[siteName];

                              return (
                                <div
                                  key={day}
                                  title={siteName ? `Day ${day}: ${siteName}${cell?.isNight ? ' (Night)' : ''}` : `Day ${day}: No record`}
                                  className={`flex-shrink-0 w-8 h-10 border-r border-slate-100 flex items-center justify-center relative ${
                                    isWeekend ? 'bg-slate-100/60' : ''
                                  }`}
                                >
                                  {siteName && siteName !== '' ? (
                                    <div
                                      className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shadow-sm"
                                      style={{
                                        backgroundColor: color?.bg ?? '#e2e8f0',
                                        color: color?.text ?? '#1e293b',
                                        border: `1.5px solid ${color?.border ?? '#cbd5e1'}`,
                                      }}
                                    >
                                      {cell.isAbsent ? 'A' : cell.isNight ? 'N' : siteName.charAt(0).toUpperCase()}
                                    </div>
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Totals */}
                            <div className="flex-shrink-0 w-12 h-10 flex flex-col items-center justify-center bg-indigo-50/40">
                              <span className="text-[10px] font-bold text-indigo-700">{totalAssigned}</span>
                              {totalAbsent > 0 && <span className="text-[9px] font-semibold text-red-400">{totalAbsent}A</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-400">
                <span>Hover over a cell for details.</span>
                <span className="ml-auto">Letters = first letter of site name Â· <strong>A</strong> = Absent Â· <strong>N</strong> = Night shift Â· Shaded columns = weekends</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Monthly Work Summary */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
              Staff Monthly Work Summary
            </CardTitle>
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setSummaryChartView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  summaryChartView === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setSummaryChartView('heatmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  summaryChartView === 'heatmap' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Flame className="h-3.5 w-3.5" /> Heat Map
              </button>
              <button
                onClick={() => setSummaryChartView('bar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  summaryChartView === 'bar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" /> Bar Chart
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Year:</label>
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Staff Type:</label>
              <select
                value={summaryStaffTypeFilter}
                onChange={(e) => setSummaryStaffTypeFilter(e.target.value as any)}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="All">All</option>
                <option value="OFFICE">Office</option>
                <option value="FIELD">Field</option>
              </select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportMonthlyWorkSummaryExcel}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50" onClick={exportMonthlyWorkSummary}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>

          {summaryChartView === 'table' ? (
            /* ── TABLE VIEW ── */
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <Table className="max-h-[420px]">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-gradient-to-r from-slate-800 to-slate-700">
                        <TableHead rowSpan={2} className="text-left font-semibold text-white align-middle py-2 px-3 whitespace-nowrap sticky left-0 bg-slate-800 z-20">Full Name</TableHead>
                        {months.map(m => (
                          <TableHead key={m.value} colSpan={3} className="text-center font-semibold text-white border-l border-slate-600 py-1.5 px-1 text-xs">
                            {m.label.substring(0, 3)}
                          </TableHead>
                        ))}
                        <TableHead rowSpan={2} className="text-center font-semibold text-white bg-indigo-700/60 align-middle py-2 px-2 whitespace-nowrap">Total</TableHead>
                      </TableRow>
                      <TableRow className="bg-slate-700">
                        {months.map(m => (
                          <React.Fragment key={m.value}>
                            <TableHead className="text-center font-medium text-slate-300 text-xs py-1 px-1 border-l border-slate-600">Wk</TableHead>
                            <TableHead className="text-center font-medium text-amber-300 text-xs py-1 px-1">OT</TableHead>
                            <TableHead className="text-center font-medium text-red-300 text-xs py-1 px-1">Ab</TableHead>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operationsInternalStaff.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={40} className="text-center py-8 text-slate-500">
                            No staff found for the selected filter (excluding Engineer and CEO positions).
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {operationsInternalStaff.map((emp, idx) => {
                            const data = monthlyWorkSummary[emp.id];
                            const totals = staffTotals[emp.id];
                            return (
                              <TableRow key={emp.id} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                <TableCell className={`font-medium text-slate-800 sticky left-0 py-1.5 px-3 text-sm whitespace-nowrap ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                  {data?.name || `${emp.surname} ${emp.firstname}`}
                                </TableCell>
                                {months.map(m => (
                                  <React.Fragment key={m.value}>
                                    <TableCell className="text-center py-1 px-1 text-xs text-slate-700 border-l border-slate-100">
                                      {data?.months[m.value]?.daysWorked || 0}
                                    </TableCell>
                                    <TableCell className="text-center py-1 px-1 text-xs text-amber-600">
                                      {data?.months[m.value]?.otDays || 0}
                                    </TableCell>
                                    <TableCell className={`text-center py-1 px-1 text-xs ${
                                      (data?.months[m.value]?.daysAbsent || 0) > 0
                                        ? 'text-red-600 font-semibold'
                                        : 'text-slate-300'
                                    }`}>
                                      {data?.months[m.value]?.daysAbsent || 0}
                                    </TableCell>
                                  </React.Fragment>
                                ))}
                                <TableCell className="text-center py-1.5 px-2">
                                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold">
                                    <span className="text-slate-700">{totals?.totalDaysWorked || 0}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-amber-600">{totals?.totalOTDays || 0}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-red-500">{totals?.totalDaysAbsent || 0}</span>
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Grand Total Row */}
                          <TableRow className="bg-slate-900 hover:bg-slate-900 font-semibold sticky bottom-0 z-10">
                            <TableCell className="text-white sticky left-0 bg-slate-900 py-2 px-3 text-sm">Grand Total</TableCell>
                            {months.map(m => (
                              <React.Fragment key={m.value}>
                                <TableCell className="text-center text-slate-200 border-l border-slate-700 py-1 px-1 text-xs">
                                  {grandTotals.monthTotals[m.value]?.daysWorked || 0}
                                </TableCell>
                                <TableCell className="text-center text-amber-300 py-1 px-1 text-xs">
                                  {grandTotals.monthTotals[m.value]?.otDays || 0}
                                </TableCell>
                                <TableCell className="text-center text-red-300 py-1 px-1 text-xs">
                                  {grandTotals.monthTotals[m.value]?.daysAbsent || 0}
                                </TableCell>
                              </React.Fragment>
                            ))}
                            <TableCell className="text-center text-white bg-indigo-900/60 py-2 px-2">
                              <span className="inline-flex items-center gap-0.5 text-xs font-bold">
                                <span>{grandTotals.totalDaysWorked}</span>
                                <span className="text-slate-500">/</span>
                                <span className="text-amber-300">{grandTotals.totalOTDays}</span>
                                <span className="text-slate-500">/</span>
                                <span className="text-red-300">{grandTotals.totalDaysAbsent}</span>
                              </span>
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
            </div>
          ) : summaryChartView === 'heatmap' ? (
            /* ── HEAT MAP VIEW ── */
            (() => {
              // Find max days worked for colour scaling
              let maxWk = 1;
              operationsInternalStaff.forEach(emp => {
                months.forEach(m => {
                  const wk = monthlyWorkSummary[emp.id]?.months[m.value]?.daysWorked || 0;
                  if (wk > maxWk) maxWk = wk;
                });
              });

              const getCellStyle = (wk: number, ot: number, abs: number) => {
                if (abs > 0 && wk === 0) {
                  // Fully absent — red
                  return { backgroundColor: `rgba(239,68,68,${Math.min(0.3 + abs * 0.12, 0.85)})`, color: '#991b1b' };
                }
                if (wk === 0 && ot === 0 && abs === 0) {
                  return { backgroundColor: '#f8fafc', color: '#cbd5e1' };
                }
                // Green scale for worked days, with amber hue shift for OT
                const intensity = Math.min(wk / maxWk, 1);
                const otBoost = ot > 0 ? 0.15 : 0;
                const r = Math.round(16 + (240 - 16) * (1 - intensity) - otBoost * 60);
                const g = Math.round(185 + (248 - 185) * (1 - intensity));
                const b = Math.round(129 + (250 - 129) * (1 - intensity) - otBoost * 60);
                return {
                  backgroundColor: `rgb(${r},${g},${b})`,
                  color: intensity > 0.55 ? '#ffffff' : '#166534',
                };
              };

              return (
                <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Legend:</span>
                    <span className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="flex gap-0.5">
                        {[0.15, 0.35, 0.55, 0.75, 0.95].map((v, i) => (
                          <span key={i} className="inline-block w-5 h-4 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${v})` }}></span>
                        ))}
                      </span>
                      Days Worked (light → dark)
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold">â— </span>
                      OT days present
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                      <span className="inline-block w-5 h-4 rounded-sm bg-red-300"></span>
                      Absent (no work)
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block w-5 h-4 rounded-sm bg-slate-100 border border-slate-200"></span>
                      No record
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
                      <div style={{ minWidth: '720px' }}>
                        {/* Header */}
                        <div className="flex sticky top-0 z-20 bg-slate-800">
                          <div className="flex-shrink-0 w-44 px-3 py-2.5 border-r border-slate-700">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Employee</span>
                          </div>
                          {months.map(m => (
                            <div key={m.value} className="flex-1 min-w-[52px] text-center py-2.5 border-r border-slate-700 last:border-0">
                              <div className="text-xs font-bold text-slate-200">{m.label.substring(0, 3)}</div>
                            </div>
                          ))}
                          <div className="flex-shrink-0 w-28 text-center py-2.5 bg-indigo-900/60 border-l border-slate-700">
                            <span className="text-xs font-semibold text-slate-200">Annual Totals</span>
                          </div>
                        </div>

                        {/* Employee rows */}
                        {operationsInternalStaff.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 text-sm">No staff found for the selected filter.</div>
                        ) : (
                          operationsInternalStaff.map((emp, idx) => {
                            const data = monthlyWorkSummary[emp.id];
                            const totals = staffTotals[emp.id];
                            return (
                              <div
                                key={emp.id}
                                className={`flex border-b border-slate-100 last:border-0 ${
                                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                }`}
                              >
                                {/* Name */}
                                <div className={`flex-shrink-0 w-44 px-3 py-2 border-r border-slate-200 flex flex-col justify-center ${
                                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                                }`}>
                                  <div className="text-xs font-semibold text-slate-800 leading-tight truncate">
                                    {data?.name || `${emp.surname} ${emp.firstname}`}
                                  </div>
                                </div>

                                {/* Month cells */}
                                {months.map(m => {
                                  const wk  = data?.months[m.value]?.daysWorked  || 0;
                                  const ot  = data?.months[m.value]?.otDays      || 0;
                                  const abs = data?.months[m.value]?.daysAbsent  || 0;
                                  const cellStyle = getCellStyle(wk, ot, abs);
                                  const tooltip = `${m.label}\n▸ Worked: ${wk} days\n▸ OT: ${ot} days\n▸ Absent: ${abs} days`;
                                  return (
                                    <div
                                      key={m.value}
                                      title={tooltip}
                                      className="flex-1 min-w-[52px] border-r border-white/60 last:border-0 relative flex flex-col items-center justify-center py-1.5 cursor-default transition-all hover:brightness-90"
                                      style={cellStyle}
                                    >
                                      {/* Days worked number */}
                                      <span className="text-xs font-bold leading-none">
                                        {wk + ot > 0 ? wk + ot : (abs > 0 ? '' : '—')}
                                      </span>
                                      {/* OT indicator dot */}
                                      {ot > 0 && (
                                        <span
                                          className="inline-flex items-center justify-center mt-0.5 text-[9px] font-bold leading-none px-1 py-0.5 rounded-full"
                                          style={{ backgroundColor: 'rgba(245,158,11,0.9)', color: '#fff' }}
                                        >
                                          +{ot}OT
                                        </span>
                                      )}
                                      {/* Absent indicator */}
                                      {abs > 0 && wk === 0 && (
                                        <span className="text-[9px] font-bold" style={{ color: '#991b1b' }}>A{abs}</span>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Annual totals */}
                                <div className="flex-shrink-0 w-28 py-2 px-2 flex flex-col items-center justify-center bg-indigo-50/40 border-l border-indigo-100">
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="font-bold text-emerald-700">{(totals?.totalDaysWorked || 0) + (totals?.totalOTDays || 0)}</span>
                                    <span className="text-slate-300 text-[10px]">wk</span>
                                    {(totals?.totalOTDays || 0) > 0 && (
                                      <span className="text-amber-600 font-semibold text-[10px]">({totals?.totalOTDays}OT)</span>
                                    )}
                                  </div>
                                  {(totals?.totalDaysAbsent || 0) > 0 && (
                                    <div className="text-[10px] text-red-500 font-semibold">{totals?.totalDaysAbsent} absent</div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Grand total row */}
                        <div className="flex sticky bottom-0 z-10 bg-slate-900">
                          <div className="flex-shrink-0 w-44 px-3 py-2 border-r border-slate-700">
                            <span className="text-xs font-semibold text-slate-300">Team Total</span>
                          </div>
                          {months.map(m => (
                            <div key={m.value} className="flex-1 min-w-[52px] text-center py-2 border-r border-slate-700 last:border-0">
                              <div className="text-xs font-bold text-emerald-400">
                                {(grandTotals.monthTotals[m.value]?.daysWorked || 0) + (grandTotals.monthTotals[m.value]?.otDays || 0)}
                              </div>
                              {(grandTotals.monthTotals[m.value]?.daysAbsent || 0) > 0 && (
                                <div className="text-[9px] text-red-400">{grandTotals.monthTotals[m.value]?.daysAbsent}A</div>
                              )}
                            </div>
                          ))}
                          <div className="flex-shrink-0 w-28 text-center py-2 bg-indigo-900/60 border-l border-slate-700">
                            <div className="text-xs font-bold text-white">{grandTotals.totalDaysWorked + grandTotals.totalOTDays}</div>
                            <div className="text-[9px] text-red-300">{grandTotals.totalDaysAbsent}A</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
                    Hover over any cell for full details. Numbers = total days (worked + OT). <strong>+nOT</strong> = overtime days. <strong>An</strong> = absent days.
                  </div>
                </div>
              );
            })()
          ) : (
            /* ── BAR CHART VIEW (monthly team totals) ── */
            (() => {
              const barData = months.map(m => ({
                month: m.label.substring(0, 3),
                'Days Worked': grandTotals.monthTotals[m.value]?.daysWorked || 0,
                'OT Days':    grandTotals.monthTotals[m.value]?.otDays     || 0,
                'Absent':    grandTotals.monthTotals[m.value]?.daysAbsent  || 0,
              }));

              return (
                <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-6">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team Monthly Totals</span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span> Days Worked
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-400"></span> OT Days
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-400"></span> Absent
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="h-[340px]">
                      <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }} barSize={18} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <RechartsTooltip
                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                          />
                          <Bar dataKey="Days Worked" fill="#10b981" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="OT Days"    fill="#f59e0b" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Absent"     fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Per-employee annual bar breakdown */}
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Annual Breakdown Per Employee</div>
                      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
                        {operationsInternalStaff.map(emp => {
                          const totals = staffTotals[emp.id];
                          const data   = monthlyWorkSummary[emp.id];
                          const totalWk  = (totals?.totalDaysWorked || 0);
                          const totalOT  = (totals?.totalOTDays || 0);
                          const totalAbs = (totals?.totalDaysAbsent || 0);
                          const grandMax = Math.max(
                            ...operationsInternalStaff.map(e => (staffTotals[e.id]?.totalDaysWorked || 0) + (staffTotals[e.id]?.totalOTDays || 0))
                          ) || 1;
                          const wkPct  = ((totalWk / grandMax) * 100).toFixed(1);
                          const otPct  = ((totalOT / grandMax) * 100).toFixed(1);
                          const absPct = ((totalAbs / grandMax) * 100).toFixed(1);
                          return (
                            <div key={emp.id} className="flex items-center gap-3">
                              <div className="w-36 flex-shrink-0 text-xs text-slate-700 font-medium truncate">
                                {data?.name || `${emp.surname} ${emp.firstname}`}
                              </div>
                              <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-slate-100">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${wkPct}%` }} title={`Worked: ${totalWk}d`}></div>
                                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${otPct}%` }} title={`OT: ${totalOT}d`}></div>
                                <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${absPct}%` }} title={`Absent: ${totalAbs}d`}></div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2 text-xs">
                                <span className="text-emerald-700 font-semibold">{totalWk}d</span>
                                {totalOT > 0 && <span className="text-amber-600 font-semibold">+{totalOT}OT</span>}
                                {totalAbs > 0 && <span className="text-red-500">{totalAbs}A</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* Custom Employee Report Builder */}
      <Card className="bg-white border-slate-200 mb-6">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-slate-900">Custom Employee Report Builder</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Select the data columns you want — then export as CSV or PDF.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedFields(selectedFields.length === ALL_REPORT_FIELDS.length ? [] : ALL_REPORT_FIELDS)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
              >
                {selectedFields.length === ALL_REPORT_FIELDS.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-slate-400">{selectedFields.length} / {ALL_REPORT_FIELDS.length} fields</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-5">
                        {/* Tab Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar border-b border-slate-100">
              {REPORT_FIELD_GROUPS.map(group => {
                const isActive = activeEmpBuilderTab === group.group;
                const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
                return (
                  <button
                    key={group.group}
                    onClick={() => setActiveEmpBuilderTab(group.group)}
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
            {REPORT_FIELD_GROUPS.filter(g => g.group === activeEmpBuilderTab).map(group => {
              const checkColor: Record<string, string> = {
                indigo:  'accent-indigo-600',
                emerald: 'accent-emerald-600',
                amber:   'accent-amber-500',
                violet:  'accent-violet-600',
                rose:    'accent-rose-600',
              };

              const groupSelectedCount = group.fields.filter(f => selectedFields.includes(f)).length;
              const allGroupSelected = groupSelectedCount === group.fields.length;

              return (
                <div key={group.group} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-medium text-slate-500">Select data fields to include as columns in your report:</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                    {group.fields.map((field) => (
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

            {/* Selected Count & Preview banner */}
            {selectedFields.length > 0 && (
              <div className="flex items-start sm:items-center gap-3 text-xs text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 sm:px-4 sm:py-3 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  Report will include <strong className="text-indigo-700">{selectedFields.length} field{selectedFields.length > 1 ? 's' : ''}</strong> as columns. 
                  <div className="text-indigo-600/80 italic mt-0.5">({selectedFields.slice(0, 5).join(', ')}{selectedFields.length > 5 ? ` +${selectedFields.length - 5} more` : ''})</div>
                </div>
              </div>
            )}

{/* Export buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={generateReport}
                disabled={selectedFields.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={generateReportPdf}
                disabled={selectedFields.length === 0}
              >
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── HR REPORTS ───────────────── */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border text-rose-700 bg-rose-50 border-rose-200">HR</span>
              Leave History Report
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  if (!leaves.length) { toast.error('No leave records found.'); return; }
                  let csv = 'data:text/csv;charset=utf-8,';
                  csv += 'Employee,Start Date,Duration (Days),Expected Return,Actual Return,Reason,Contactable\n';
                  leaves.forEach(l => {
                    csv += `"${l.employeeName}",${formatDisplayDate(l.startDate)},${l.duration},${formatDisplayDate(l.expectedEndDate)},${l.dateReturned ? formatDisplayDate(l.dateReturned) : 'N/A'},"${l.reason}",${l.canBeContacted}\n`;
                  });
                  const link = document.createElement('a');
                  link.setAttribute('href', encodeURI(csv));
                  link.setAttribute('download', 'leave_history_report.csv');
                  document.body.appendChild(link); link.click(); document.body.removeChild(link);
                  showExportMessage('Leave History Report (CSV) exported!');
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => {
                  if (!leaves.length) { toast.error('No leave records found.'); return; }
                  generatePdf(
                    'Leave History Report',
                    [['Employee', 'Start Date', 'Duration', 'Expected Return', 'Actual Return', 'Reason', 'Contactable']],
                    leaves.map(l => [l.employeeName, formatDisplayDate(l.startDate), `${l.duration} days`, formatDisplayDate(l.expectedEndDate), l.dateReturned ? formatDisplayDate(l.dateReturned) : 'N/A', l.reason, l.canBeContacted]),
                    'leave_history_report.pdf'
                  );
                }}
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {leaves.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No leave records found.</div>
          ) : (
            <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <Table className="max-h-[420px]">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-gradient-to-r from-rose-700 to-rose-600">
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Employee</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Start Date</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap text-center">Duration</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Expected Return</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Actual Return</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap">Reason</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap text-center">Contactable</TableHead>
                        <TableHead className="text-white font-semibold py-2 px-3 whitespace-nowrap text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave, idx) => {
                        const returned = !!leave.dateReturned;
                        const overdue  = !returned && new Date(leave.expectedEndDate).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0);
                        return (
                          <TableRow key={leave.id} className={`hover:bg-rose-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            <TableCell className="py-1.5 px-3 text-sm font-medium text-slate-800 whitespace-nowrap">{leave.employeeName}</TableCell>
                            <TableCell className="py-1.5 px-3 text-sm text-slate-600 whitespace-nowrap">{formatDisplayDate(leave.startDate)}</TableCell>
                            <TableCell className="py-1.5 px-3 text-sm text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">{leave.duration}d</span>
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-sm text-slate-600 whitespace-nowrap">{formatDisplayDate(leave.expectedEndDate)}</TableCell>
                            <TableCell className="py-1.5 px-3 text-sm text-slate-600 whitespace-nowrap">{leave.dateReturned ? formatDisplayDate(leave.dateReturned) : <span className="text-slate-400 italic">Not yet</span>}</TableCell>
                            <TableCell className="py-1.5 px-3 text-sm text-slate-600 max-w-[180px] truncate" title={leave.reason}>{leave.reason}</TableCell>
                            <TableCell className="py-1.5 px-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                leave.canBeContacted === 'Yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>{leave.canBeContacted}</span>
                            </TableCell>
                            <TableCell className="py-1.5 px-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                returned ? 'bg-emerald-100 text-emerald-700' : overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {returned ? 'Returned' : overdue ? 'Overdue' : 'On Leave'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-4">
                <span><strong>{leaves.length}</strong> total leave records</span>
                <span className="text-amber-600"><strong>{leaves.filter(l => !l.dateReturned && new Date(l.startDate).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0) && new Date(l.expectedEndDate).setHours(0,0,0,0) > new Date().setHours(0,0,0,0)).length}</strong> currently on leave</span>
                <span className="text-red-500"><strong>{leaves.filter(l => !l.dateReturned && new Date(l.expectedEndDate).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0)).length}</strong> overdue</span>
                <span className="text-emerald-600"><strong>{leaves.filter(l => !!l.dateReturned).length}</strong> returned</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

