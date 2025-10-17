
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Find-Python {
  $cand = Get-ChildItem "$env:LOCALAPPDATA\Programs\Python" -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -notmatch 'WindowsApps' } |
          Select-Object -First 1 -Expand FullName
  if (-not $cand) {
    if (Test-Path "C:\Program Files\Python313\python.exe") { return "C:\Program Files\Python313\python.exe" }
    if (Test-Path "C:\Program Files\Python312\python.exe") { return "C:\Program Files\Python312\python.exe" }
  }
  return $cand
}

$py = Find-Python
if (-not $py) { Write-Host "Python bulunamadı. Python 3.12+ kurup tekrar deneyin." -ForegroundColor Yellow; exit 1 }

$VenvDir = Join-Path $Root ".venv"
if (-not (Test-Path $VenvDir)) { & $py -m venv $VenvDir }

$venvPy = Resolve-Path (Join-Path $VenvDir "Scripts\python.exe")
$req    = Resolve-Path (Join-Path $Root "requirements.txt")

& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r $req

Write-Host "🚀 Açılıyor: http://127.0.0.1:8000" -ForegroundColor Green
& $venvPy -m app.server
