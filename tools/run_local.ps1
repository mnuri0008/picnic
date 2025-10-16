
# NURI Piknik v4 PRO – Windows tek tık
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
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
if (-not $py) { Write-Host "Python bulunamadı."; exit 1 }
if (-not (Test-Path .venv)) { & $py -m venv .venv }
$venvPy = (Resolve-Path .\.venv\Scripts\python.exe)
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r .\requirements.txt
Write-Host "🚀 Açılıyor: http://127.0.0.1:8000"
& $venvPy -m app.server
