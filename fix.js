const fs = require('fs');
let code = fs.readFileSync('src/pages/FinancialReports.tsx', 'utf8');

// 1. Remove ledgerSummaryYear state
code = code.replace(/const \[ledgerSummaryYear, setLedgerSummaryYear\] = useState<string>\(String\(new Date\(\)\.getFullYear\(\)\)\);/, '');

// 2. Remove payrollYear, payrollMonth state
code = code.replace(/const \[payrollYear, setPayrollYear\] = useState\(currentYear\);/, '');
code = code.replace(/const \[payrollMonth, setPayrollMonth\] = useState<number \| null>\(null\);/, '');

// 3. Update SiteSummary props
code = code.replace(/<SiteSummary \/>/, '<SiteSummary filterYear={filterYear} filterMonth={filterMonth} />');

// 4. Ledger Summary logic uses filterYear instead of ledgerSummaryYear
code = code.replace(/if \(ledgerSummaryYear !== 'All' && !e\.date\.startsWith\(ledgerSummaryYear\)\) return false;/g, 
  `if (filterYear !== 'All' && !e.date.startsWith(filterYear)) return false;
            // Handle Month
            if (filterMonth !== 'All') {
               const d = new Date(e.date);
               if (!isNaN(d.getTime()) && String(d.getMonth() + 1) !== filterMonth) return false;
            }`);
code = code.replace(/ledgerSummaryYear/g, 'filterYear');

// 5. Ledger Summary title mapping
code = code.replace(/By \{ledgerSummaryView\} — Monthly Breakdown \(\{filterYear\}\)/g, 
  'By {ledgerSummaryView} — Monthly Breakdown ({filterYear === "All" ? "All Time" : filterYear}{filterMonth !== "All" ? ` - Month ${filterMonth}` : ""})');

// 6. Ledger Summary months array filter
code = code.replace(/\{MONTH_NAMES\.map\(m => \(/g, 
  '{MONTH_NAMES.map((m, mi) => { if (filterMonth !== "All" && String(mi + 1) !== filterMonth) return null; return (');
code = code.replace(/<th key=\{m\} className="py-2\.5 px-2 text-right font-semibold whitespace-nowrap">\{m\}<\/th>/g, 
  '<th key={m} className="py-2.5 px-2 text-right font-semibold whitespace-nowrap">{m}</th>');
code = code.replace(/\{MONTH_NAMES\.map\(\(_, mi\) => \{/g, 
  '{MONTH_NAMES.map((_, mi) => { if (filterMonth !== "All" && String(mi + 1) !== filterMonth) return null;');

// 7. Remove Year filter from Ledger Summary UI
code = code.replace(/<div className="flex items-center gap-2">\s*<span className="text-xs font-bold text-slate-500 uppercase">Year<\/span>\s*<select value=\{filterYear\} onChange[^>]+>\s*<option value="All">All Years<\/option>\s*\{ledgerYears\.map[^}]+\}\s*<\/select>\s*<\/div>/g, '');

// 8. Remove filters from Payroll Summary
code = code.replace(/<div className="flex items-center gap-2">\s*<select value=\{payrollMonth[^<]+<\/select>\s*<select value=\{payrollYear[^<]+<\/select>\s*<\/div>/g, '');

// 9. Fix payrollYear uses
code = code.replace(/payrollYear/g, '(filterYear === "All" ? currentYear : parseInt(filterYear, 10))');

// 10. Fix payrollMonth uses
code = code.replace(/payrollMonth/g, '(filterMonth === "All" ? null : parseInt(filterMonth, 10))');

// 11. Remove Year and Month filters from Client Account UI
code = code.replace(/<div className="flex items-center gap-2">\s*<span className="text-xs font-semibold text-slate-500 uppercase">Year<\/span>\s*<select value=\{filterYear\}[^>]*>(?:[^<]|<(?!\/select>))*<\/select>\s*<\/div>\s*<div className="flex items-center gap-2">\s*<span className="text-xs font-semibold text-slate-500 uppercase">Month<\/span>\s*<select value=\{filterMonth\}[^>]*>(?:[^<]|<(?!\/select>))*<\/select>\s*<\/div>/g, '');

// 12. Add Global Filters directly under Page Header
const globalFilters = `
      {/* GLOBAL FILTERS */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between mb-0">
        <div className="flex items-center gap-2 text-slate-800">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{display:'inline-block'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
          <h2 className="text-sm font-bold uppercase tracking-wide">Global Report Filters</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Year</span>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
              className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[120px]">
              <option value="All">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Month</span>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
              className="h-9 px-3 text-sm font-semibold rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[140px]">
              <option value="All">All Months</option>
              {MONTHS_LIST.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>
`;
code = code.replace(/(<p className="text-slate-500 mt-1 max-w-2xl">[\s\S]*?<\/p>\s+<\/div>\s+<\/div>)/, '$1' + globalFilters);

// 13. Remove "Filters" heading since it's just Client now
code = code.replace(/<h2 className="text-sm font-bold uppercase tracking-wide">Filters<\/h2>\s*<\/div>\s*<div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">/, '<h2 className="text-sm font-bold uppercase tracking-wide">Client Filter<\/h2>\n            </div>\n        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">');

// Write out
fs.writeFileSync('src/pages/FinancialReports.tsx', code);
