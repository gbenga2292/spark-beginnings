import { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { useOperations } from '@/src/contexts/OperationsContext';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Users, Fuel, Truck, BookOpen, UserPlus, Activity, MapPin, Download, Calendar } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import * as XLSX from 'xlsx';

function getWeekRange(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return { start, end };
}

function inWeek(dateStr: string, start: Date, end: Date) {
  try {
    const d = parseISO(dateStr.split('T')[0]);
    return isWithinInterval(d, { start, end });
  } catch {
    return false;
  }
}

export function WeeklyReport() {
  useSetPageTitle('Weekly Report');
  const [anchor, setAnchor] = useState(new Date());
  const { start, end } = getWeekRange(anchor);
  const days = eachDayOfInterval({ start, end });

  // ── Store data ────────────────────────────────────────
  const sites        = useAppStore(s => s.sites).filter(s => s.status === 'Active');
  const employees    = useAppStore(s => s.employees);
  const attendance   = useAppStore(s => s.attendanceRecords);
  const vehicles     = useAppStore(s => s.vehicles);
  const vehicleTrips = useAppStore(s => s.vehicleTrips);
  const journals     = useAppStore(s => s.dailyJournals);
  const journalEntries = useAppStore(s => s.siteJournalEntries);

  const { dailyMachineLogs, waybills } = useOperations();

  // ── Week-filtered data ────────────────────────────────
  const weekAttendance = useMemo(() =>
    attendance.filter(r => inWeek(r.date, start, end)), [attendance, start, end]);

  const weekMachineLogs = useMemo(() =>
    dailyMachineLogs.filter(l => inWeek(l.date, start, end)), [dailyMachineLogs, start, end]);

  const weekTrips = useMemo(() =>
    vehicleTrips.filter(t => inWeek(t.departure_time, start, end)), [vehicleTrips, start, end]);

  const weekJournals = useMemo(() =>
    journals.filter(j => inWeek(j.date, start, end)), [journals, start, end]);

  const weekJournalEntries = useMemo(() => {
    const ids = new Set(weekJournals.map(j => j.id));
    return journalEntries.filter(e => ids.has(e.journalId));
  }, [weekJournals, journalEntries]);

  const newEmployees = useMemo(() =>
    employees.filter(e => e.startDate && inWeek(e.startDate, start, end)), [employees, start, end]);

  // ── Summary Stats ─────────────────────────────────────
  const uniqueStaffDeployed = useMemo(() => new Set(weekAttendance.filter(r => r.day === 'Yes' || r.night === 'Yes').map(r => r.staffId)).size, [weekAttendance]);
  const totalAbsences = useMemo(() => weekAttendance.filter(r => r.absentStatus && r.absentStatus !== '').length, [weekAttendance]);
  const totalDiesel   = useMemo(() => weekMachineLogs.reduce((s, l) => s + l.dieselUsage, 0), [weekMachineLogs]);
  const totalTrips    = weekTrips.length;

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

  // ── Per-site attendance summary ───────────────────────
  const siteAttendanceSummary = useMemo(() => {
    const map: Record<string, { day: Set<string>; night: Set<string>; absent: number }> = {};
    weekAttendance.forEach(r => {
      const site = r.daySite || r.nightSite;
      if (!site) return;
      if (!map[site]) map[site] = { day: new Set(), night: new Set(), absent: 0 };
      if (r.day === 'Yes' && r.daySite) map[r.daySite].day.add(r.staffId);
      if (r.night === 'Yes' && r.nightSite) map[r.nightSite].night.add(r.staffId);
      if (r.absentStatus) map[site].absent++;
    });
    return map;
  }, [weekAttendance]);

  // ── Diesel supply for week ────────────────────────────
  const dieselSupplies = useMemo(() =>
    waybills.filter(w => w.sentToSiteDate && inWeek(w.sentToSiteDate, start, end) && w.items.some(i => i.assetName?.toLowerCase().includes('diesel'))),
    [waybills, start, end]);

  // ── Export ────────────────────────────────────────────
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Attendance summary
    const attRows = weekAttendance.map(r => ({
      Date: r.date, Staff: r.staffName, Position: r.position,
      'Day Site': r.daySite, 'Night Site': r.nightSite,
      Present: r.day === 'Yes' || r.night === 'Yes' ? 'Yes' : 'No',
      Absent: r.absentStatus || '', OT: r.overtimeDetails || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), 'Attendance');

    // Sheet 2: Machine logs
    const machineRows = weekMachineLogs.map(l => ({
      Date: l.date, Site: l.siteName, Machine: l.assetName,
      Status: l.isActive ? 'Operational' : 'Down',
      'Diesel (L)': l.dieselUsage, Supervisor: l.supervisorOnSite || '',
      Issues: l.issuesOnSite || '', Maintenance: l.maintenanceDetails || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(machineRows), 'Operations');

    // Sheet 3: Vehicles
    const tripRows = weekTrips.map(t => ({
      Vehicle: t.vehicle_reg, Driver: t.driver_name,
      Site: t.site_name, Purpose: t.purpose,
      Departure: t.departure_time, Arrival: t.arrival_time || '',
      Remarks: t.remark || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripRows), 'Logistics');

    XLSX.writeFile(wb, `Weekly_Report_${format(start, 'dd-MMM-yyyy')}_to_${format(end, 'dd-MMM-yyyy')}.xlsx`);
  };

  const weekLabel = `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Weekly Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Compiled operations report for the selected week</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setAnchor(a => subWeeks(a, 1))} className="p-1.5 rounded-md hover:bg-white transition-colors text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-700 min-w-[200px] text-center">{weekLabel}</span>
            <button onClick={() => setAnchor(a => addWeeks(a, 1))} className="p-1.5 rounded-md hover:bg-white transition-colors text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Staff Deployed', value: uniqueStaffDeployed, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Absences', value: totalAbsences, icon: Calendar, color: 'text-rose-600 bg-rose-50' },
            { label: 'Total Diesel (L)', value: totalDiesel.toFixed(0), icon: Fuel, color: 'text-amber-600 bg-amber-50' },
            { label: 'Vehicle Trips', value: totalTrips, icon: Truck, color: 'text-emerald-600 bg-emerald-50' },
          ].map(stat => (
            <Card key={stat.label} className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Section: HR / Daily Register ─────────────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Users className="h-5 w-5 text-blue-500" /> HR & Staffing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {weekAttendance.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No attendance records for this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Date', 'Staff', 'Position', 'Day Site', 'Night Site', 'OT', 'Absent'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weekAttendance.slice(0, 50).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{r.date}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.staffName}</td>
                        <td className="px-4 py-2 text-slate-500">{r.position}</td>
                        <td className="px-4 py-2 text-slate-600">{r.daySite || '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{r.nightSite || '—'}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{r.overtimeDetails || '—'}</td>
                        <td className="px-4 py-2">
                          {r.absentStatus
                            ? <Badge className="bg-rose-50 text-rose-700 border-rose-100 text-xs">{r.absentStatus}</Badge>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {weekAttendance.length > 50 && (
                  <p className="text-xs text-slate-400 text-center py-2">Showing 50 of {weekAttendance.length} records. Export for full data.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Per-site Attendance Quick View ───────────────── */}
        {Object.keys(siteAttendanceSummary).length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <MapPin className="h-5 w-5 text-indigo-500" /> Staff Per Site This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(siteAttendanceSummary).map(([siteName, data]) => (
                  <div key={siteName} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <p className="font-semibold text-slate-700 text-sm mb-2">{siteName}</p>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Day Staff: <strong className="text-slate-700">{data.day.size}</strong></span>
                      <span>Night Staff: <strong className="text-slate-700">{data.night.size}</strong></span>
                      {data.absent > 0 && <span className="text-rose-600">Absences: <strong>{data.absent}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section: Operations / Machine Logs ───────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Activity className="h-5 w-5 text-emerald-500" /> Operations — Machine Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {siteMachineSummary.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No machine logs recorded for this week.</p>
            ) : siteMachineSummary.map((site, si) => (
              <div key={si} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-300" />
                  <span className="text-sm font-bold text-white">{site.siteName}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {Object.values(site.machines).map((machine, mi) => {
                    const activeDays = machine.logs.filter(l => l.isActive).length;
                    const totalMachineDiesel = machine.logs.reduce((s, l) => s + l.dieselUsage, 0);
                    const avgDiesel = machine.logs.length > 0 ? (totalMachineDiesel / machine.logs.length).toFixed(1) : '0';
                    const issues = machine.logs.filter(l => l.issuesOnSite).map(l => l.issuesOnSite);
                    return (
                      <div key={mi} className="p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-slate-700">{machine.assetName}</p>
                          <div className="flex gap-2">
                            <Badge className={cn('text-xs', activeDays === machine.logs.length ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                              {activeDays}/{machine.logs.length} days active
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500">
                          <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Diesel</p>
                            <p className="font-semibold text-slate-700">{totalMachineDiesel.toFixed(1)} L</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider mb-0.5">Avg/Day</p>
                            <p className="font-semibold text-slate-700">{avgDiesel} L</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider mb-0.5">Days Logged</p>
                            <p className="font-semibold text-slate-700">{machine.logs.length}</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-400 uppercase tracking-wider mb-0.5">Downtime Events</p>
                            <p className="font-semibold text-slate-700">{machine.logs.reduce((s, l) => s + l.downtimeEntries.length, 0)}</p>
                          </div>
                        </div>
                        {issues.length > 0 && (
                          <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-100 text-xs text-amber-700">
                            <strong>Issues:</strong> {issues.join(' | ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Diesel Supply ─────────────────────────────────── */}
        {dieselSupplies.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <Fuel className="h-5 w-5 text-amber-500" /> Diesel Supplied This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {dieselSupplies.map(w => (
                <div key={w.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3 bg-amber-50/30">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{w.siteName || 'Unknown Site'}</p>
                    <p className="text-xs text-slate-500">Supplied: {w.sentToSiteDate}</p>
                  </div>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    {w.items.filter(i => i.assetName?.toLowerCase().includes('diesel')).map(i => `${i.quantity} L`).join(', ')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Section: Vehicle Movements ────────────────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Truck className="h-5 w-5 text-cyan-500" /> Logistics & Vehicle Movements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {weekTrips.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No vehicle trips logged this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Vehicle', 'Driver', 'Site', 'Purpose', 'Departure', 'Arrival', 'Remarks'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weekTrips.map((t, i) => (
                      <tr key={t.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-700">{t.vehicle_reg}</td>
                        <td className="px-4 py-2 text-slate-600">{t.driver_name}</td>
                        <td className="px-4 py-2 text-slate-600">{t.site_name || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{t.purpose}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">{t.departure_time}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">{t.arrival_time || '—'}</td>
                        <td className="px-4 py-2 text-slate-400 text-xs">{t.remark || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section: Site Journal ────────────────────────── */}
        {weekJournalEntries.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <BookOpen className="h-5 w-5 text-violet-500" /> Site Journal — This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {weekJournals.map(journal => {
                const entries = weekJournalEntries.filter(e => e.journalId === journal.id);
                return (
                  <div key={journal.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-sm">{journal.date}</span>
                      <span className="text-xs text-slate-400">by {journal.loggedBy}</span>
                    </div>
                    {journal.generalNotes && (
                      <div className="px-4 py-2 text-sm text-slate-600 italic border-b border-slate-100">{journal.generalNotes}</div>
                    )}
                    <div className="divide-y divide-slate-100">
                      {entries.map(entry => (
                        <div key={entry.id} className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{entry.siteName} — {entry.clientName}</p>
                          <p className="text-sm text-slate-600">{entry.narration}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Section: New Employees ───────────────────────── */}
        {newEmployees.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <UserPlus className="h-5 w-5 text-green-500" /> New Employees This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {newEmployees.map(emp => (
                  <div key={emp.id} className="border border-green-200 bg-green-50/30 rounded-lg p-3">
                    <p className="font-semibold text-slate-700">{emp.firstname} {emp.surname}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{emp.position} — {emp.department}</p>
                    <Badge className="mt-2 bg-green-50 text-green-700 border-green-200 text-xs">Started {emp.startDate}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
