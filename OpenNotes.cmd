@echo off
rem ---------------------------------------------------------------------------
rem  OpenNotes - start the editor.
rem
rem  Double click this file, or pin it to the taskbar / start menu.
rem
rem  The packaged application is preferred: its process is called "OpenNotes".
rem  The window of the editor is drawn by the application itself, so no
rem  console window stays open.
rem ---------------------------------------------------------------------------
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

if exist "%ROOT%release\win-unpacked\OpenNotes.exe" (
  start "" "%ROOT%release\win-unpacked\OpenNotes.exe" %*
  endlocal
  exit /b 0
)

if exist "%ROOT%OpenNotes.exe" (
  start "" "%ROOT%OpenNotes.exe" %*
  endlocal
  exit /b 0
)

if exist "%ROOT%bin\opennotes-launcher.exe" (
  start "" "%ROOT%bin\opennotes-launcher.exe" %*
  endlocal
  exit /b 0
)

if exist "%ROOT%node_modules\electron\dist\electron.exe" (
  rem The development runtime is a console program: the window is hidden.
  start "" /b "%ROOT%node_modules\electron\dist\electron.exe" "%ROOT%" %*
  endlocal
  exit /b 0
)

echo OpenNotes is not installed yet. Run "npm install" in this folder first.
pause
endlocal
