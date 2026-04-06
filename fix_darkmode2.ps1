$base = 'c:\Users\USER\Desktop\assign\spark-beginnings\src\pages'

function Patch {
  param([string]$file, [hashtable]$replacements)
  $path = Join-Path $base $file
  if (-not (Test-Path $path)) { Write-Host "SKIP: $file"; return }
  $c = [System.IO.File]::ReadAllText($path)
  foreach ($key in $replacements.Keys) {
    $c = $c.Replace($key, $replacements[$key])
  }
  [System.IO.File]::WriteAllText($path, $c)
  Write-Host "PATCHED: $file"
}

# --- Payroll.tsx ---
Patch 'Payroll.tsx' @{
  # toolbar selects
  'className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"' = 'className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"'
  'className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 mr-2"' = 'className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 mr-2"'
  'className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"' = 'className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-sm"'
  # Export button
  'className="h-9 px-3 gap-2 border-slate-200 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-tight shadow-sm hover:bg-slate-50"' = 'className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] uppercase tracking-tight shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"'
  # Tab pills  
  'flex bg-white p-2 rounded-xl shadow-sm border border-slate-100 items-center overflow-x-auto no-scrollbar gap-2' = 'flex bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 items-center overflow-x-auto no-scrollbar gap-2'
  # KPI cards
  'bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden' = 'bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center relative overflow-hidden'
  'bg-white p-4 rounded-xl border border-red-50 shadow-sm flex flex-col justify-center relative overflow-hidden' = 'bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-50 dark:border-red-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden'
  'bg-white p-4 rounded-xl border border-emerald-50 shadow-sm flex flex-col justify-center relative overflow-hidden' = 'bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-50 dark:border-emerald-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden'
  # Sticky table columns (payroll table)
  'className="sticky left-0 z-10 bg-white border-r border-transparent"' = 'className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-transparent"'
  'className="font-medium sticky z-10 bg-white"' = 'className="font-medium sticky z-10 bg-white dark:bg-slate-900"'
  'className="sticky z-10 bg-white"' = 'className="sticky z-10 bg-white dark:bg-slate-900"'
  'className="sticky z-10 bg-white border-r border-slate-300"' = 'className="sticky z-10 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700"'
  # Sidebar panel
  'w-1/3 max-w-[300px] border-r border-slate-200 bg-white p-4 overflow-y-auto flex flex-col gap-6 hide-on-print shadow-sm z-10' = 'w-1/3 max-w-[300px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-y-auto flex flex-col gap-6 hide-on-print shadow-sm z-10'
  # Print payslip area (keep white for print, but dark mode screen)
  'className="bg-white p-10 mb-8 mx-auto shadow-sm max-w-3xl rounded-sm print-break"' = 'className="bg-white dark:bg-slate-900 p-10 mb-8 mx-auto shadow-sm max-w-3xl rounded-sm print-break"'
  'className="bg-white mx-auto shadow-lg max-w-5xl rounded-sm print-break"' = 'className="bg-white dark:bg-slate-900 mx-auto shadow-lg max-w-5xl rounded-sm print-break"'
}

# --- Onboarding.tsx ---
Patch 'Onboarding.tsx' @{
  'bg-white p-6 rounded-2xl' = 'bg-white dark:bg-slate-900 p-6 rounded-2xl'
  '"bg-white rounded-xl' = '"bg-white dark:bg-slate-900 rounded-xl'
  'className="bg-white rounded-xl' = 'className="bg-white dark:bg-slate-900 rounded-xl'
  'className="bg-white p-4' = 'className="bg-white dark:bg-slate-900 p-4'
  'className="bg-white p-3' = 'className="bg-white dark:bg-slate-900 p-3'
  'className="bg-white p-2' = 'className="bg-white dark:bg-slate-900 p-2'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
  'border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-100 focus:ring-2'
}

# --- PerformanceConduct.tsx ---
Patch 'PerformanceConduct.tsx' @{
  'bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500' = 'bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500'
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-4' = 'className="bg-white dark:bg-slate-900 p-4'
  'className="bg-white p-6' = 'className="bg-white dark:bg-slate-900 p-6'
  'className="bg-white p-3' = 'className="bg-white dark:bg-slate-900 p-3'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
  'border-slate-200 bg-white' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
}

# --- Evaluations.tsx ---
Patch 'Evaluations.tsx' @{
  'bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500' = 'bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500'
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-' = 'className="bg-white dark:bg-slate-900 p-'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
  'border-slate-200 bg-white' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
}

# --- Leaves.tsx ---
Patch 'Leaves.tsx' @{
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-' = 'className="bg-white dark:bg-slate-900 p-'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
  'border-slate-200 bg-white' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
  'bg-slate-50 px-3 py-2 text-sm focus:bg-white' = 'bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700'
}

# --- LeaveSummary.tsx ---
Patch 'LeaveSummary.tsx' @{
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-' = 'className="bg-white dark:bg-slate-900 p-'
  'border-slate-200 bg-white' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
}

# --- Beneficiaries.tsx ---
Patch 'Beneficiaries.tsx' @{
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-' = 'className="bg-white dark:bg-slate-900 p-'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
  'border-slate-200 bg-white' = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
}

# --- Employees.tsx remaining ---
Patch 'Employees.tsx' @{
  'className="bg-white rounded' = 'className="bg-white dark:bg-slate-900 rounded'
  'className="bg-white border' = 'className="bg-white dark:bg-slate-900 border'
  'className="bg-white p-' = 'className="bg-white dark:bg-slate-900 p-'
  'className="bg-white shadow' = 'className="bg-white dark:bg-slate-900 shadow'
}

Write-Host "All done!"
