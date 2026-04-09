import re

with open('src/pages/FinancialReports.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State cleanup
code = re.sub(r'const \[ledgerSummaryYear, setLedgerSummaryYear\] = useState[^;]+;', '', code)
code = re.sub(r'const \[payrollYear, setPayrollYear\] = useState[^;]+;', '', code)
code = re.sub(r'const \[payrollMonth, setPayrollMonth\] = useState[^;]+;', '', code)

# 2. Add global year and month at definition point if missing
if 'const [filterYear' not in code:
    print("WARNING: filterYear not found, skipping UI additions.")
else:
    # Ensure site summary gets the props
    code = code.replace('<SiteSummary />', '<SiteSummary filterYear={filterYear} filterMonth={filterMonth} />')

    # Update ledger logic
    ledger_find = r"if \(ledgerSummaryYear !== 'All' && !e\.date\.startsWith\(ledgerSummaryYear\)\) return false;"
    ledger_repl = r"""if (filterYear !== 'All' && !e.date.startsWith(filterYear)) return false;
            // Handle month filtering
            if (filterMonth !== 'All') {
               const d = new Date(e.date);
               if (!isNaN(d.getTime()) && String(d.getMonth() + 1) !== filterMonth) return false;
            }"""
    code = re.sub(ledger_find, ledger_repl, code)
    code = code.replace('ledgerSummaryYear', 'filterYear')

    # Update Ledger title
    code = re.sub(r'By \{ledgerSummaryView\} — Monthly Breakdown \(\{filterYear\}\)', 
        r'By {ledgerSummaryView} — Monthly Breakdown ({filterYear === \'All\' ? \'All Time\' : filterYear}{filterMonth !== \'All\' ? ` - Month ${filterMonth}` : \'\'})', code)

    # Ledger Columns map logic
    code = code.replace('{MONTH_NAMES.map(m => (', 
        '{MONTH_NAMES.map((m, mi) => { if (filterMonth !== "All" && String(mi + 1) !== filterMonth) return null; return (')
    code = code.replace('<th key={m} className="py-2.5 px-2 text-right font-semibold whitespace-nowrap">{m}</th>', 
        '<th key={m} className="py-2.5 px-2 text-right font-semibold whitespace-nowrap">{m}</th>\n                                  ); })}')
    code = code.replace('{MONTH_NAMES.map((_, mi) => {', 
        '{MONTH_NAMES.map((_, mi) => { if (filterMonth !== "All" && String(mi + 1) !== filterMonth) return null;')

    # Remove Ledger Year UI
    ledgerUI_re = r'<div className="flex items-center gap-2">\s*<span className="text-xs font-bold text-slate-500 uppercase">Year</span>\s*<select value=\{filterYear\}[^>]+>\s*<option value="All">All Years</option>\s*\{ledgerYears\.map\([^)]*\)\}\s*</select>\s*</div>'
    code = re.sub(ledgerUI_re, '', code)

    # Payroll logic
    code = re.sub(r'payrollYear', r'(filterYear === "All" ? currentYear : parseInt(filterYear, 10))', code)
    code = re.sub(r'payrollMonth', r'(filterMonth === "All" ? null : parseInt(filterMonth, 10))', code)
    code = re.sub(r'<select value=\{\(filterMonth[^>]+\}\s*<option value="">All Months</option>[\s\S]*?</select>', '', code)
    code = re.sub(r'<select value=\{\(filterYear[^>]+\}\s*<option value="">All Years</option>[\s\S]*?</select>', '', code)
    
    # Remove Client UI Year/Month
    client_filters_re = r'<div className="flex items-center gap-2">\s*<span className="text-xs font-semibold text-slate-500 uppercase">Year</span>\s*<select value=\{filterYear\}[\s\S]*?</select>\s*</div>\s*<div className="flex items-center gap-2">\s*<span className="text-xs font-semibold text-slate-500 uppercase">Month</span>\s*<select value=\{filterMonth\}[\s\S]*?</select>\s*</div>'
    code = re.sub(client_filters_re, '', code)

    # Add Global UI under Header
    header_find = r'(<p className="text-slate-500 mt-1 max-w-2xl">[\s\S]*?</p>\s*</div>\s*</div>)'
    global_ui = """
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
"""
    code = re.sub(header_find, r'\1' + global_ui, code)

with open('src/pages/FinancialReports.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("FinancialReports.tsx updated successfully.")
