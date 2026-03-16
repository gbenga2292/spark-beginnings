$file = 'src\pages\Payroll.tsx'
$lines = Get-Content $file
$totalLines = $lines.Length
Write-Host "Total lines before: $totalLines"

# Keep lines 1..113 (index 0..112) and lines 144..end (index 143..end)
$keep = @()
for ($i = 0; $i -lt 113; $i++) { $keep += $lines[$i] }
for ($i = 143; $i -lt $totalLines; $i++) { $keep += $lines[$i] }

$keep | Set-Content $file -Encoding UTF8
Write-Host "Total lines after: $($keep.Length)"
