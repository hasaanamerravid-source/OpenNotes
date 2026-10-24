param(
  [string]$Url = "https://github.com/electron/electron/releases/download/v44.9.0/electron-v44.9.0-win32-x64.zip",
  [string]$Out = "I:\notepad\node_modules\electron\electron-v44.9.0-win32-x64.zip",
  [int]$Parts = 4
)

$ErrorActionPreference = "Continue"
$tmp = Split-Path $Out -Parent
$partDir = Join-Path $env:TEMP ("eparts-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $partDir -Force | Out-Null
$url = $Url

$head = & curl.exe -sIL $url
$size = 0
foreach ($line in $head) {
  if ($line -match '^[Cc]ontent-[Ll]ength:\s*(\d+)') { $size = [int64]$Matches[1] }
}
if ($size -le 0) { Write-Output "could not determine size"; exit 1 }
Write-Output "size: $size bytes, $Parts parts"

$chunk = [math]::Ceiling($size / $Parts)
$procs = @()
for ($i = 0; $i -lt $Parts; $i++) {
  $start = $i * $chunk
  $end = [math]::Min($size - 1, ($i + 1) * $chunk - 1)
  $part = Join-Path $partDir ("epart$i")
  $curlArgs = @('-sS', '-L', '-r', "$start-$end", '-o', $part, $url)
  $procs += Start-Process curl.exe -ArgumentList $curlArgs -PassThru -WindowStyle Hidden
}

$sw = [Diagnostics.Stopwatch]::StartNew()
while (@($procs | Where-Object { -not $_.HasExited }).Count -gt 0) {
  $bytes = (Get-ChildItem $partDir -Filter "epart*" -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  Write-Output ("{0:N1} / {1:N1} MB ({2}%)" -f ($bytes / 1MB), ($size / 1MB), [math]::Round(100 * $bytes / $size, 1))
  Start-Sleep -Seconds 10
}

# Retry short parts one by one (in the foreground so we can see progress).
for ($i = 0; $i -lt $Parts; $i++) {
  $part = Join-Path $partDir ("epart$i")
  $start = $i * $chunk
  $end = [math]::Min($size - 1, ($i + 1) * $chunk - 1)
  $expect = $end - $start + 1
  $have = 0
  if (Test-Path $part) { $have = (Get-Item $part).Length }
  if ($have -ge $expect) { continue }
  Write-Output "retry part $i ($have / $expect)"
  & curl.exe -sS -L --retry 5 --retry-delay 3 -r "$start-$end" -o $part $url
}

$outStream = [System.IO.File]::Create($Out)
for ($i = 0; $i -lt $Parts; $i++) {
  $part = Join-Path $partDir ("epart$i")
  if (Test-Path $part) {
    $bytes = [System.IO.File]::ReadAllBytes($part)
    $outStream.Write($bytes, 0, $bytes.Length)
    Remove-Item $part -Force -ErrorAction SilentlyContinue
  }
}
$outStream.Close()
$final = (Get-Item $Out).Length
Write-Output ("merged {0:N1} MB in {1:N0}s" -f ($final / 1MB), $sw.Elapsed.TotalSeconds)
if ($final -ne $size) { Write-Output "SIZE MISMATCH: expected $size got $final"; exit 1 }
Write-Output "OK"
