$pages = @('Employees','Onboarding','Payroll','Leaves','LeaveSummary','Beneficiaries','PerformanceConduct','Evaluations')
$base = 'c:\Users\USER\Desktop\assign\spark-beginnings\src\pages'
foreach ($p in $pages) {
  $path = Join-Path $base ($p + '.tsx')
  if (-not (Test-Path $path)) { Write-Host ($p + ': MISSING'); continue }
  $lines = [System.IO.File]::ReadAllLines($path)
  $bad = ($lines | Where-Object { $_ -match 'bg-white' -and $_ -notmatch 'dark:bg-slate' -and $_ -notmatch 'focus:bg-white' }).Count
  Write-Host ($p + ': ' + $bad + ' unguarded bg-white')
}
