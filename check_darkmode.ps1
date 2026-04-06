$base = 'c:\Users\USER\Desktop\assign\spark-beginnings\src\pages'
$files = @('Employees.tsx','Onboarding.tsx','Payroll.tsx','Leaves.tsx','LeaveSummary.tsx','Beneficiaries.tsx','PerformanceConduct.tsx','Evaluations.tsx')
foreach ($f in $files) {
  $path = Join-Path $base $f
  if (Test-Path $path) {
    $content = [System.IO.File]::ReadAllText($path)
    $matches = [regex]::Matches($content, 'bg-white(?! dark)')
    Write-Host "$f : $($matches.Count) remaining bare bg-white"
  }
}
