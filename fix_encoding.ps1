# Fix encoding corruption: replace multi-byte garbled sequences with correct Unicode chars
# Run from the project root

$srcDir = ".\src"

# Mapping of corrupted byte sequences (as they appear when UTF-8 is read as Latin-1) to correct chars
$replacements = @(
    # em dash: — (U+2014) becomes â€" when UTF-8 misread
    @{ From = [System.Text.Encoding]::UTF8.GetString([byte[]](0xC3, 0xA2, 0xE2, 0x80, 0x9C, 0xE2, 0x80, 0x9D)); To = "—" }
)

# Use simple string replacements for each known garbled sequence
$garbledToCorrect = @{
    # â€" = — (em dash, U+2014)
    "â€`"" = "—"
    # â€™ = ' (right single quote, U+2019)  
    "â€™" = "'"
    # â€˜ = ' (left single quote, U+2018)
    "â€˜" = "'"
    # â€œ = " (left double quote, U+201C)
    "â€œ" = "`""
    # â€ = " (right double quote, U+201D)  -- note: must come after â€œ
    "â€" = "—"
    # â€¢ = • (bullet, U+2022)
    "â€¢" = "•"
    # â€¦ = … (ellipsis, U+2026)
    "â€¦" = "…"
    # â€" = — (em dash) - alternate encoding
    "â€""  = "—"
}

# Actually use direct UTF-8 replacements
# The garbled text "â€"" is UTF-8 bytes of "—" interpreted as Windows-1252/Latin-1
# In PowerShell with UTF-8 files: the actual character IS — but displayed as â€" due to encoding mismatch

$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx", "*.ts"

$fixCount = 0

foreach ($file in $files) {
    # Read file as UTF-8 bytes then decode
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    
    $originalContent = $content
    
    # The "corrupted" sequences appear when UTF-8 multibyte chars for special Unicode
    # were saved correctly as UTF-8, but a tool is displaying them wrongly.
    # The ACTUAL bytes in the file are correct UTF-8. The issue is:
    # Some files have literal Windows-1252 bytes where UTF-8 is expected.
    
    # Let's check if the file has the Windows-1252 encoded em dash (0x97 = —)
    # or the Latin-1 misinterpreted UTF-8.
    
    # Check for the garbled sequence as literal UTF-8 characters
    $emDashGarbled = [System.Text.Encoding]::UTF8.GetString([byte[]](0xC3, 0xA2, 0xC2, 0x80, 0xC2, 0x93))
    
    Write-Host "Processing: $($file.Name)"
    Write-Host "  Garbled em-dash sequence: $emDashGarbled"
    
    break
}
