param(
  [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $root 'apps/web'
$apiDir = Join-Path $root 'apps/api'

function Write-Info($message) { Write-Host "[INFO] $message" -ForegroundColor Cyan }
function Write-Warn($message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-ErrorLine($message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

function Confirm-Action([string]$Message, [bool]$Default=$true) {
  $suffix = if ($Default) { '[Y/n]' } else { '[y/N]' }
  while ($true) {
    $response = Read-Host "$Message $suffix"
    if ([string]::IsNullOrWhiteSpace($response)) {
      return $Default
    }
    switch ($response.ToLowerInvariant()) {
      'y' { return $true }
      'yes' { return $true }
      'n' { return $false }
      'no' { return $false }
      default { Write-Host 'Please answer y or n.' }
    }
  }
}

function Assert-Command($command, $downloadHint) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    Write-Warn "Missing dependency: $command"
    Write-Host $downloadHint
    $continue = Confirm-Action "Continue after installing $command manually?" $false
    if (-not $continue) {
      throw "Cannot continue without $command"
    }
  }
}

Write-Info "VolleySense setup running from $root"
Assert-Command docker 'Install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/'
Assert-Command npm 'Install Node.js LTS: https://nodejs.org/en/download'
Assert-Command node 'Install Node.js LTS: https://nodejs.org/en/download'
Assert-Command python 'Install Python 3.11+: https://www.python.org/downloads/ (enable "Add to PATH")'

if (-not (docker info | Out-Null)) {
  Write-Warn 'Docker daemon not reachable. Start Docker Desktop and ensure WSL 2 is enabled.'
}

if (Confirm-Action 'Install front-end dependencies (npm install)?' $true) {
  Write-Info 'Installing npm packages...'
  Push-Location $webDir
  npm install
  Pop-Location
}

$venvPath = Join-Path $apiDir '.venv'
if (Confirm-Action 'Create (or reuse) Python virtual environment?' $true) {
  Write-Info "Creating virtual environment at $venvPath"
  python -m venv $venvPath
  $activate = Join-Path $venvPath 'Scripts/Activate.ps1'
  . $activate
  python -m pip install --upgrade pip
  python -m pip install -e "$apiDir"[dev]
} else {
  python -m pip install -e "$apiDir"[dev]
}

if ($RunTests -or Confirm-Action 'Run automated tests now?' $false) {
  Write-Info 'Running vitest suite'
  Push-Location $webDir
  npm run test -- --run
  Pop-Location
  Write-Info 'Running pytest suite'
  Push-Location $apiDir
  pytest
  Pop-Location
}

if (Confirm-Action 'Build optimized web bundle?' $false) {
  Push-Location $webDir
  npm run build
  Pop-Location
}

if (Confirm-Action 'Launch docker-compose up --build?' $false) {
  Push-Location $root
  docker-compose up --build
  Pop-Location
}

Write-Info 'Setup complete. Manual start commands:'
Write-Host "  API : cd $apiDir; .\\.venv\\Scripts\\Activate.ps1; uvicorn app.main:app --reload"
Write-Host "  Web : cd $webDir; npm run dev"
Write-Host "  Docker: cd $root; docker-compose up --build"
Write-Host ''
Write-Info 'Troubleshooting:'
Write-Host '  - Ensure Docker Desktop has WSL integration enabled.'
Write-Host '  - If npm install fails, delete node_modules and package-lock.json then rerun.'
Write-Host '  - If pytest cannot import app, activate the virtual environment or run `python -m pip install -e apps/api`.'
