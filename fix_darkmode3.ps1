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

# --- Onboarding.tsx ---
Patch 'Onboarding.tsx' @{
  '"p-4 bg-white space-y-3"' = '"p-4 bg-white dark:bg-slate-900 space-y-3"'
  '"p-3 space-y-2 bg-white"' = '"p-3 space-y-2 bg-white dark:bg-slate-900"'
  "border-slate-300 bg-white group-hover:border-indigo-400" = "border-slate-300 bg-white dark:bg-slate-800 group-hover:border-indigo-400"
  'className="h-9 text-sm bg-slate-50 border-slate-200 focus:bg-white"' = 'className="h-9 text-sm bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700"'
  'bg-white">' = 'bg-white dark:bg-slate-900">'
  'shadow-sm bg-white overflow-hidden flex flex-col h-[720px]' = 'shadow-sm bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-[720px]'
  "bg-white shadow-sm text-indigo-700'" = "bg-white dark:bg-slate-700 shadow-sm text-indigo-700 dark:text-indigo-300'"
  'shadow-lg bg-white overflow-hidden min-h-[720px]' = 'shadow-lg bg-white dark:bg-slate-900 overflow-hidden min-h-[720px]'
  'bg-white/50 sticky top-0' = 'bg-white/50 dark:bg-slate-900/80 sticky top-0'
  "'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100'" = "'bg-white dark:bg-slate-800 border-emerald-200 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'"
  "'bg-white border-slate-200'" = "'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'"
  'bg-white border border-slate-200 shadow-sm transition-shadow mb-2' = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow mb-2'
  'bg-white border border-slate-100 hover:shadow-sm' = 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:shadow-sm'
  'bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200' = 'bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700'
}

# --- PerformanceConduct.tsx ---
Patch 'PerformanceConduct.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  '"bg-white p-' = '"bg-white dark:bg-slate-900 p-'
  '"bg-white shadow' = '"bg-white dark:bg-slate-900 shadow'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

# --- Evaluations.tsx ---
Patch 'Evaluations.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  '"bg-white p-' = '"bg-white dark:bg-slate-900 p-'
  '"bg-white shadow' = '"bg-white dark:bg-slate-900 shadow'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

# --- Leaves.tsx ---
Patch 'Leaves.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  '"bg-white p-' = '"bg-white dark:bg-slate-900 p-'
  '"bg-white shadow' = '"bg-white dark:bg-slate-900 shadow'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

# --- LeaveSummary.tsx ---
Patch 'LeaveSummary.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  '"bg-white p-' = '"bg-white dark:bg-slate-900 p-'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

# --- Beneficiaries.tsx ---
Patch 'Beneficiaries.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  '"bg-white p-' = '"bg-white dark:bg-slate-900 p-'
  '"bg-white shadow' = '"bg-white dark:bg-slate-900 shadow'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

# --- Employees.tsx ---
Patch 'Employees.tsx' @{
  '"bg-white rounded' = '"bg-white dark:bg-slate-900 rounded'
  '"bg-white border' = '"bg-white dark:bg-slate-900 border'
  "bg-white'" = "bg-white dark:bg-slate-900'"
  "'bg-white" = "'bg-white dark:bg-slate-900"
}

Write-Host "Patch 3 complete!"
