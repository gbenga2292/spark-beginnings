!macro customInit
  ; Force kill any lingering main or background Electron/DCEL processes before installer begins
  nsExec::Exec 'cmd /c taskkill /F /IM "DCEL Office Suite.exe" /T >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /IM "dcel-office-app.exe" /T >nul 2>&1'
!macroend

!macro customInstall
  ; Double check and ensure processes are terminated before file extraction/overwrite begins
  nsExec::Exec 'cmd /c taskkill /F /IM "DCEL Office Suite.exe" /T >nul 2>&1'
  nsExec::Exec 'cmd /c taskkill /F /IM "dcel-office-app.exe" /T >nul 2>&1'
!macroend
