!macro customInit
  ; Force kill any lingering main or background Electron/DCEL processes before installer begins
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500

  ; Clear any legacy UninstallString from previous versions in the registry.
  ; This prevents electron-builder from attempting to run the previous version's
  ; broken uninstaller (which aborts with exit code 2 when run silently).
  ; The installer will directly extract and overwrite the files cleanly in place.
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\5391b589-9763-5ef3-a23a-8ac1553ad393" "UninstallString" ""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\5391b589-9763-5ef3-a23a-8ac1553ad393" "UninstallString" ""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString" ""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString" ""

  ; Delete legacy uninstaller file if present to prevent execution
  Delete "$PROGRAMFILES64\DCEL Office Suite\Uninstall DCEL Office Suite.exe"
  Delete "$PROGRAMFILES\DCEL Office Suite\Uninstall DCEL Office Suite.exe"
!macroend

!macro customCheckAppRunning
  ; Overrides electron-builder's fragile PowerShell Get-CimInstance check
  ; Ensure all existing instances and child processes are terminated cleanly
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500
!macroend

!macro customUnInit
  ; Terminate processes before silent uninstaller executes during upgrades
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500
!macroend

!macro customUnInstallCheck
  ; Prevent installer from aborting with 'Failed to uninstall old application files: 2'
  ; if an older uninstaller returned a non-zero exit code.
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500
  ClearErrors
  StrCpy $R0 0
!macroend

!macro customUnInstallCheckCurrentUser
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500
  ClearErrors
  StrCpy $R0 0
!macroend

!macro customInstall
  ; Double check and ensure processes are terminated before file extraction/overwrite begins
  nsExec::Exec 'cmd /c taskkill /F /T /IM "DCEL Office Suite.exe" >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /T /IM "dcel-office-app.exe" >nul 2>&1'
  Sleep 500
!macroend
