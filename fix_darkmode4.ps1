$base = 'c:\Users\USER\Desktop\assign\spark-beginnings\src\pages'

function Patch {
  param([string]$file, [hashtable]$replacements)
  $path = Join-Path $base $file
  $c = [System.IO.File]::ReadAllText($path)
  foreach ($key in $replacements.Keys) {
    $c = $c.Replace($key, $replacements[$key])
  }
  [System.IO.File]::WriteAllText($path, $c)
  Write-Host "PATCHED: $file"
}

# --- Leaves.tsx ---
Patch 'Leaves.tsx' @{
  'className="flex-1 gap-2 border-slate-200 text-slate-700 bg-white shadow-sm"' = 'className="flex-1 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-sm"'
  'bg-white relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10 w-full max-w-2xl mx-auto' = 'bg-white dark:bg-slate-900 relative overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 z-10 w-full max-w-2xl mx-auto'
  'className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 focus:bg-white px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"' = 'className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 px-3 text-sm transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"'
  'className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 p-3 h-24 focus:bg-white focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"' = 'className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 p-3 h-24 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"'
  'bg-white flex-1 flex flex-col min-h-[500px]' = 'bg-white dark:bg-slate-900 flex-1 flex flex-col min-h-[500px]'
  "filterView === tab ? 'bg-white dark:bg-slate-900 text-teal-700 shadow-sm'" = "filterView === tab ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'"
  'className="pl-9 bg-white border-slate-200 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm"' = 'className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 h-9 text-sm focus-visible:ring-teal-500/50 rounded-lg shadow-sm"'
  'className="w-40 bg-white"' = 'className="w-40 bg-white dark:bg-slate-900 dark:border-slate-700"'
  'className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"' = 'className="bg-white dark:bg-slate-900 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"'
  'className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"' = 'className="bg-white dark:bg-slate-900 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"'
}

# --- PerformanceConduct.tsx remaining ---
Patch 'PerformanceConduct.tsx' @{
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white " = "'bg-white dark:bg-slate-900 "
  'bg-slate-50 focus:bg-white' = 'bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100'
}

# --- Evaluations.tsx remaining ---
Patch 'Evaluations.tsx' @{
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white " = "'bg-white dark:bg-slate-900 "
  'bg-slate-50 focus:bg-white' = 'bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100'
}

# --- LeaveSummary.tsx remaining ---
Patch 'LeaveSummary.tsx' @{
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white " = "'bg-white dark:bg-slate-900 "
}

# --- Beneficiaries.tsx remaining ---
Patch 'Beneficiaries.tsx' @{
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white " = "'bg-white dark:bg-slate-900 "
  'bg-slate-50 focus:bg-white' = 'bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-slate-100'
}

# --- Employees.tsx remaining ---
Patch 'Employees.tsx' @{
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white " = "'bg-white dark:bg-slate-900 "
}

Write-Host "Patch 4 complete!"
