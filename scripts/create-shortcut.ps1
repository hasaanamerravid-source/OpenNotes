param(
  [Parameter(Mandatory = $true)][string]$Launcher,
  [Parameter(Mandatory = $true)][string]$Icon,
  # The packaged application. It is preferred over the launcher, because its
  # process is called "OpenNotes" and it does not need the development
  # runtime.
  [string]$Application = ''
)

$ErrorActionPreference = 'Stop'

$programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
if (-not (Test-Path $programs)) { New-Item -ItemType Directory -Path $programs -Force | Out-Null }

$target = $Launcher
if ($Application -and (Test-Path $Application)) { $target = $Application }

$shortcut = Join-Path $programs 'OpenNotes.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $target
$link.WorkingDirectory = Split-Path $target
if (Test-Path $Icon) { $link.IconLocation = "$Icon,0" }
$link.Description = 'OpenNotes - an all-in-one text editor'
# The window of the editor is drawn by the application itself: the console of
# the launcher must not appear.
$link.WindowStyle = 7
$link.Save()

$desktop = [Environment]::GetFolderPath('Desktop')
if (Test-Path $desktop) {
  $desktopLink = Join-Path $desktop 'OpenNotes.lnk'
  Copy-Item $shortcut $desktopLink -Force
}

Write-Host "Shortcut created: $shortcut"
Write-Host "Target: $target"
