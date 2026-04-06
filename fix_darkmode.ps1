$base = 'c:\Users\USER\Desktop\assign\spark-beginnings\src\pages'
$files = @('Employees.tsx','Onboarding.tsx','Payroll.tsx','Leaves.tsx','LeaveSummary.tsx','Beneficiaries.tsx','PerformanceConduct.tsx','Evaluations.tsx')

function Fix-Page {
  param([string]$path)
  if (-not (Test-Path $path)) { Write-Host "SKIP: $path"; return }
  $c = [System.IO.File]::ReadAllText($path)

  # select elements: bg-slate-50 focus:bg-white
  $c = $c.Replace('bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none', 'bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none')
  $c = $c.Replace('bg-slate-50 px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none', 'bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none')

  # Input className variants
  $c = $c.Replace('className="bg-slate-50 focus:bg-white"', 'className="bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700"')
  $c = $c.Replace('className="bg-slate-50 focus:bg-white font-mono"', 'className="bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 font-mono"')
  $c = $c.Replace('className="font-mono bg-slate-50 focus:bg-white"', 'className="font-mono bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700"')
  $c = $c.Replace('className="font-mono text-sm pl-7 bg-slate-50 focus:bg-white"', 'className="font-mono text-sm pl-7 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700"')
  $c = $c.Replace('className="h-8 text-xs bg-white"', 'className="h-8 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"')
  $c = $c.Replace('className="h-8 text-xs bg-white font-mono"', 'className="h-8 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 font-mono"')
  $c = $c.Replace('className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"', 'className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"')
  $c = $c.Replace('className="bg-white shadow-sm"', 'className="bg-white dark:bg-slate-800 dark:text-slate-200 shadow-sm"')

  # Modal/panel containers
  $c = $c.Replace('bg-white rounded-lg shadow-xl max-w-2xl', 'bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl')
  $c = $c.Replace('bg-white rounded-lg shadow-xl max-w-md', 'bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md')
  $c = $c.Replace('relative bg-white rounded-[2rem]', 'relative bg-white dark:bg-slate-900 rounded-[2rem]')
  $c = $c.Replace('bg-white p-6 rounded-2xl shadow-sm border border-slate-100', 'bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800')
  $c = $c.Replace('rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden', 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden')
  $c = $c.Replace('py-8 bg-white rounded-lg border border-slate-100 shadow-inner', 'py-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-inner')

  # Tab active state
  $c = $c.Replace("bg-white text-indigo-700 shadow-sm'", "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'")
  $c = $c.Replace('"bg-white text-indigo-700 shadow-sm"', '"bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm"')

  # Upload button / label span
  $c = $c.Replace('border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm h-9 px-4 py-2', 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm h-9 px-4 py-2')

  # Checkbox department labels
  $c = $c.Replace('bg-white px-2 py-1 rounded border border-slate-200', 'bg-white dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-slate-700')

  # Table wrappers and general bg-white inline panels
  $c = $c.Replace('"bg-white rounded-lg', '"bg-white dark:bg-slate-900 rounded-lg')
  $c = $c.Replace('"bg-white border', '"bg-white dark:bg-slate-900 border')

  [System.IO.File]::WriteAllText($path, $c)
  Write-Host "DONE: $($path.Split('\')[-1])"
}

foreach ($f in $files) {
  Fix-Page (Join-Path $base $f)
}
