$lines = Get-Content 'src\pages\Client360.tsx'
$top = $lines[0..1073] -join "`r`n"
Set-Content -Path 'src\pages\Client360.tsx' -Value $top -Encoding UTF8 -NoNewline
Write-Host "Done. Lines kept: $($lines[0..1073].Count)"
