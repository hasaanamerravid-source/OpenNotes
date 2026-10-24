param(
  [string]$Zip = "I:\notepad\node_modules\electron\electron-v44.9.0-win32-x64.zip",
  [string]$Half = "I:\notepad\node_modules\electron\half2.bin",
  [long]$Split = 78000000,
  [string]$Dest = "I:\notepad\node_modules\electron\dist"
)

$ErrorActionPreference = "Stop"
$merged = "$Zip.merged"

$fs = [System.IO.File]::Create($merged)
try {
  $head = New-Object System.IO.FileStream($Zip, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $buf = New-Object byte[] 4194304
    $remaining = $Split
    while ($remaining -gt 0) {
      $want = [int][math]::Min($buf.Length, $remaining)
      $n = $head.Read($buf, 0, $want)
      if ($n -le 0) { break }
      $fs.Write($buf, 0, $n)
      $remaining -= $n
    }
  } finally { $head.Close() }

  $tail = [System.IO.File]::OpenRead($Half)
  try {
    $buf = New-Object byte[] 4194304
    while (($n = $tail.Read($buf, 0, $buf.Length)) -gt 0) { $fs.Write($buf, 0, $n) }
  } finally { $tail.Close() }
} finally { $fs.Close() }

Write-Output ("merged file: {0:N1} MB" -f ((Get-Item $merged).Length / 1MB))

if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null
Write-Output "extracting..."
& tar.exe -xf $merged -C $Dest
if ($LASTEXITCODE -ne 0) { Write-Output "tar failed"; exit 1 }

Set-Content -Path "I:\notepad\node_modules\electron\path.txt" -Value "electron.exe" -NoNewline
Write-Output "electron installed:"
Get-ChildItem $Dest | Select-Object -First 5 Name, Length | Format-Table -AutoSize | Out-String | Write-Output
