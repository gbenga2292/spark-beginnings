import { format } from 'date-fns';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import logoImg from '../../../logo/logo-2.png';

// ── Types ──────────────────────────────────────────────────────────────
interface AttendanceRow {
  staffId: string;
  staffName: string;
  position: string;
  totalShifts: number;
  dayShifts: number;
  nightShifts: number;
  sites: string[];
  isPresent: boolean;
}

interface MachineLogs {
  date: string;
  assetName: string;
  dieselUsage: number;
  isActive: boolean;
  supervisorOnSite?: string;
  issuesOnSite?: string;
  siteName: string;
}

interface LedgerEntry {
  date: string;
  category: string;
  description: string;
  amount: number;
  site: string;
}

interface WaybillItem { quantity: number; assetName: string; }
interface Waybill {
  issueDate: string;
  siteName?: string;
  items: WaybillItem[];
  status: string;
  driverName?: string;
}

interface JournalEntry {
  journalId: string;
  siteName: string;
  narration?: string;
  loggedBy: string;
}

interface Journal { id: string; date: string; }

export interface WeeklyReportPreviewProps {
  reportMode: 'weekly' | 'monthly';
  start: Date;
  end: Date;
  reportLabel: string;
  uniqueStaffDeployed: number;
  totalDiesel: number;
  totalIncome: number;
  totalExpenses: number;
  employeesTotal: number;
  completedTasksCount: number;
  completedSubtasksCount: number;
  totalShifts: number;
  summarizedAttendance: AttendanceRow[];
  weekMachineLogs: MachineLogs[];
  weekLedger: LedgerEntry[];
  waybills: Waybill[];
  weekJournals: Journal[];
  weekJournalEntries: JournalEntry[];
  activeSiteNames: string[];
}

// ── Helper sub-components ──────────────────────────────────────────────

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="border-b border-slate-300 pb-1.5 mb-4 mt-8">
      <h2 className="m-0 text-sm sm:text-base font-semibold text-slate-800 tracking-wide uppercase">
        {number}. {title}
      </h2>
    </div>
  );
}

function SubTitle({ label }: { label: string }) {
  return (
    <h3 className="my-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
      {label}
    </h3>
  );
}

function DataTable({ headers, rows, emptyText = 'No records' }: {
  headers: string[];
  rows: (string | number)[][];
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto w-full mb-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50/80">
            {headers.map(h => (
              <th key={h} className="p-2.5 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="p-3 text-slate-400 italic text-center">
                {emptyText}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              {row.map((cell, j) => (
                <td key={j} className="p-2.5 text-slate-700 border-b border-slate-100 min-w-max">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Preview Component ─────────────────────────────────────────────

export function WeeklyReportPreview({
  reportMode, start, end, reportLabel,
  uniqueStaffDeployed, totalDiesel, totalIncome, totalExpenses,
  employeesTotal, completedTasksCount, completedSubtasksCount, totalShifts,
  summarizedAttendance, weekMachineLogs, weekLedger, waybills,
  weekJournals, weekJournalEntries, activeSiteNames,
}: WeeklyReportPreviewProps) {
  const attRate = employeesTotal > 0 ? Math.round((uniqueStaffDeployed / employeesTotal) * 100) : 0;
  const generatedAt = format(new Date(), 'PPP p');
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  return (
    <div className="bg-slate-100 p-2 sm:p-6 min-h-full font-sans flex justify-center text-slate-800">
      {/* A4 Paper */}
      <div className="w-full max-w-[794px] bg-white shadow-xl sm:shadow-2xl sm:rounded-md p-5 sm:p-10 md:p-14">

        {/* ── Document Header ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 mb-6">
          <img src={logoImg} alt="DCEL Logo" className="h-10 sm:h-12 object-contain" />
          <div className="text-center sm:text-right text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide">
            <div>Generated: {generatedAt}</div>
            <div>CONFIDENTIAL – DCEL Internal Document</div>
          </div>
        </div>

        <div className="border-t border-slate-300 border-b py-4 mb-8 text-center">
          <h1 className="m-0 text-base sm:text-lg font-bold text-slate-800 tracking-widest uppercase">
            {reportMode === 'monthly' ? 'Monthly Operations Report' : 'Weekly Operations Report'}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 font-medium tracking-wide">
            {format(start, 'MMMM d, yyyy')} — {format(end, 'MMMM d, yyyy')}
          </p>
        </div>

        {/* ── 1. Executive Summary ── */}
        <SectionTitle number={1} title="Executive Summary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Attendance Rate', value: `${attRate}% (${uniqueStaffDeployed}/${employeesTotal})` },
            { label: 'Total Shifts', value: totalShifts },
            { label: 'Diesel Used', value: `${totalDiesel.toFixed(0)} L` },
            { label: 'Income', value: `₦${totalIncome.toLocaleString()}` },
            { label: 'Expenses', value: `₦${totalExpenses.toLocaleString()}` },
            { label: 'Tasks Completed', value: `${completedTasksCount} main / ${completedSubtasksCount} sub` },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 border border-slate-100 rounded-md p-3 sm:p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{stat.label}</div>
              <div className="text-sm sm:text-base font-semibold text-slate-700 mt-1.5">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ── 2. Site Profiles ── */}
        <SectionTitle number={2} title="Site Profiles & Operations Log" />
        {activeSiteNames.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No active sites recorded for this period.</p>
        ) : activeSiteNames.map(sName => {
          const siteExpenses = weekLedger.filter(e => e.site === sName);
          const siteMachines = weekMachineLogs.filter(m => m.siteName === sName);
          const siteWaybills = waybills.filter(w =>
            w.siteName === sName && w.issueDate >= startStr && w.issueDate <= endStr
          );
          const siteJournalEntries = weekJournalEntries.filter(e =>
            e.siteName === sName &&
            weekJournals.some(j => j.id === e.journalId)
          );

          return (
            <div key={sName} className="border-l-2 border-slate-300 pl-4 sm:pl-5 mb-8 overflow-hidden">
              <h3 className="m-0 mb-3 text-sm sm:text-base font-semibold text-slate-800 tracking-wide uppercase">
                {sName}
              </h3>

              <SubTitle label="A. Expenses" />
              <DataTable
                headers={['Date', 'Category', 'Description', 'Amount']}
                rows={siteExpenses.map(e => [
                  formatDisplayDate(e.date), e.category, e.description, `₦${e.amount.toLocaleString()}`
                ])}
                emptyText="No expenses recorded"
              />

              <SubTitle label="B. Machinery & Diesel Usage" />
              <DataTable
                headers={['Date', 'Machine', 'Diesel (L)', 'Status', 'Issues']}
                rows={siteMachines.map(m => [
                  formatDisplayDate(m.date), m.assetName,
                  m.dieselUsage ? `${m.dieselUsage}L` : '-',
                  m.isActive ? 'Active' : 'Inactive',
                  m.issuesOnSite || '-'
                ])}
                emptyText="No machine logs"
              />

              <SubTitle label="C. Consumables / Waybills" />
              <DataTable
                headers={['Date', 'Items', 'Status', 'Driver']}
                rows={siteWaybills.map(w => [
                  formatDisplayDate(w.issueDate),
                  w.items.map(i => `${i.quantity}× ${i.assetName}`).join(', ') || 'Various',
                  w.status, w.driverName || '-'
                ])}
                emptyText="No deliveries recorded"
              />

              <SubTitle label="D. Operations Log" />
              {siteJournalEntries.length === 0 ? (
                <p className="text-xs text-slate-400 italic my-2">No journal updates.</p>
              ) : siteJournalEntries.map((entry, i) => {
                const jDate = weekJournals.find(j => j.id === entry.journalId)?.date || '';
                return (
                  <div key={i} className="mb-2 p-3 bg-slate-50/80 border border-slate-100 rounded-md text-xs">
                    <div className="font-semibold text-slate-500 mb-1 tracking-wide">
                      [{formatDisplayDate(jDate)}] — Logged by: {entry.loggedBy}
                    </div>
                    <div className="text-slate-700 leading-relaxed font-medium">{entry.narration || '—'}</div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* ── 3. Global Staff Attendance ── */}
        <SectionTitle number={3} title="Global Staff Attendance" />
        <DataTable
          headers={['Employee', 'Position', 'Total Shifts', 'Day', 'Night', 'Locations']}
          rows={summarizedAttendance.map(s => [
            s.staffName, s.position, s.totalShifts, s.dayShifts, s.nightShifts,
            s.sites.join(', ') || 'N/A'
          ])}
          emptyText="No attendance records for this period"
        />

        {/* ── Footer ── */}
        <div className="border-t border-slate-200 mt-10 pt-4 text-center text-[10px] text-slate-400 font-medium tracking-wide uppercase">
          Dewatering Construction Etc Limited · {reportLabel} · Page 1 · {generatedAt}
        </div>
      </div>
    </div>
  );
}
