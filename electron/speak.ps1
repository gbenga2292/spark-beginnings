param(
    [string]$Text = "Attention: Executive briefing ready.",
    [string]$Gender = "Female",
    [string]$VoiceName = "",
    [double]$Rate = 0.98,
    [double]$Volume = 1.0,
    [int]$WithChime = 1
)

if ($WithChime -ne 0) {
    try { [System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 400 } catch {}
}

$tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "dcel_tts_$([System.Guid]::NewGuid().ToString('N')).wav")
$spoken = $false

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' 
    } | Select-Object -First 1

    function Wait-WinRtTask($task, $type) {
        $m = $asTaskGeneric.MakeGenericMethod($type)
        $netTask = $m.Invoke($null, @($task))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
    }

    [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime] | Out-Null
    $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    $synth.Options.SpeakingRate = [Math]::Max(0.5, [Math]::Min(1.5, $Rate))
    $synth.Options.AudioVolume = [Math]::Max(0.0, [Math]::Min(1.0, $Volume))

    $voice = $null
    if ($VoiceName) {
        $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { 
            $_.DisplayName -like "*$VoiceName*" -or $_.Id -like "*$VoiceName*" 
        } | Select-Object -First 1
    }
    if (-not $voice) {
        $targetGender = if ($Gender -eq 'Male') { [Windows.Media.SpeechSynthesis.VoiceGender]::Male } else { [Windows.Media.SpeechSynthesis.VoiceGender]::Female }
        $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Gender -eq $targetGender } | Select-Object -First 1
    }
    if ($voice) {
        $synth.Voice = $voice
    }

    $stream = Wait-WinRtTask ($synth.SynthesizeTextToStreamAsync($Text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    
    $fileStream = [System.IO.File]::Create($tempFile)
    $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $netStream.CopyTo($fileStream)
    $fileStream.Close()
    $netStream.Close()

    $player = New-Object System.Media.SoundPlayer $tempFile
    $player.PlaySync()
    $spoken = $true
} catch {
    # If WinRT fails, fall through to legacy SAPI
} finally {
    if (Test-Path $tempFile) {
        try { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue } catch {}
    }
}

if (-not $spoken) {
    try {
        Add-Type -AssemblyName System.Speech
        $sapi = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $sapi.Volume = [int]($Volume * 100)
        $sapiGender = if ($Gender -eq 'Male') { [System.Speech.Synthesis.VoiceGender]::Male } else { [System.Speech.Synthesis.VoiceGender]::Female }
        $sapi.SelectVoiceByHints($sapiGender)
        $sapi.Speak($Text)
    } catch {}
}
