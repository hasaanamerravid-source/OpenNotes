param(
  [switch]$KeepElectron
)

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path $PSScriptRoot -Parent

Write-Host "Cleaning OpenNotes build output..." -ForegroundColor Cyan

# Build output and caches
foreach ($path in @('out', 'release', 'dist', '.vite')) {
  $full = Join-Path $root $path
  if (Test-Path $full) {
    Remove-Item $full -Recurse -Force
    Write-Host "  removed $path"
  }
}

# Test leftovers
foreach ($path in @('.test-vault', '.stress', '.demo', '.probe-vault')) {
  $full = Join-Path $root $path
  if (Test-Path $full) {
    Remove-Item $full -Recurse -Force
    Write-Host "  removed $path"
  }
}

# Download leftovers of the Electron runtime
Get-ChildItem (Join-Path $root 'node_modules/electron') -Filter 'epart*' -ErrorAction SilentlyContinue |
  Remove-Item -Force
Get-ChildItem (Join-Path $root 'node_modules/electron') -Filter '*.zip*' -ErrorAction SilentlyContinue |
  Remove-Item -Force

if (-not $KeepElectron) {
  # The extracted Electron runtime is ~300 MB. Delete it when the app is
  # already packaged; "npm run dev" will ask for it again (scripts/fetch-electron.ps1).
  $dist = Join-Path $root 'node_modules/electron/dist'
  if (Test-Path $dist) {
    Remove-Item $dist -Recurse -Force
    Write-Host "  removed node_modules/electron/dist (run scripts/fetch-electron.ps1 to get it back)"
  }
  # Only the English locale is needed.
  $locales = Join-Path $root 'node_modules/electron/dist/locales'
}

Write-Host ""
$total = (Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("Project size: {0:N0} MB" -f ($total / 1MB)) -ForegroundColor Green
