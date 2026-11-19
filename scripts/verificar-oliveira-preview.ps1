#Requires -Version 5.1
<#
.SYNOPSIS
  Safe local verification for Oliveira Assessoria Preview (Windows PowerShell).
.DESCRIPTION
  Verifies the exact Git branch, Vercel project link and Node version before
  running local tests. No deploys, Git pushes, secrets access, or production writes.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verificar-oliveira-preview.ps1 -Navegador -SitePublico -Auditoria
#>
[CmdletBinding()]
param(
  [switch]$AtualizarDependencias,
  [switch]$Navegador,
  [switch]$SitePublico,
  [switch]$Lighthouse,
  [ValidateRange(1,5)]
  [int]$LighthouseRodadas = 1,
  [switch]$Auditoria
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$expectedProjectId = "prj_IB4FPuQ8CWkSS0VjZvIQsq3kE2Ie"
$expectedTeamId = "team_SzgCrqKBL9o0MvVqzmsA1ji0"
$expectedBranch = "feature/plataforma-operacional-preview"

function Assert-LastCommand([string]$action) {
  if ($LASTEXITCODE -ne 0) {
    throw ("Failed: " + $action + " (exit " + $LASTEXITCODE + ")")
  }
}

Push-Location $root
try {
  Write-Host "Oliveira Assessoria - local Preview checks only" -ForegroundColor Cyan

  $linkPath = Join-Path $root ".vercel\project.json"
  if (-not (Test-Path $linkPath)) {
    throw "Missing .vercel/project.json. Run npx vercel link for the isolated project first."
  }
  $project = Get-Content $linkPath -Raw | ConvertFrom-Json
  if ($project.projectId -ne $expectedProjectId -or $project.orgId -ne $expectedTeamId) {
    throw "Wrong Vercel project/team link. Expected the isolated Preview project. No tests executed."
  }

  $branch = (& git branch --show-current | Out-String).Trim()
  Assert-LastCommand "read Git branch"
  if ($branch -ne $expectedBranch) {
    throw "Wrong branch: $branch. Expected $expectedBranch."
  }

  $remote = (& git remote get-url origin | Out-String).Trim()
  Assert-LastCommand "read Git remote"
  $acceptedRemote = '(?i)^(https://github\.com/Roh-barboza/oliveira-assessoria(\.git)?|git@github\.com:Roh-barboza/oliveira-assessoria(\.git)?)$'
  if ($remote -notmatch $acceptedRemote) {
    throw "Unexpected Git remote; no tests executed."
  }

  $nodeVersion = (& node --version | Out-String).Trim()
  Assert-LastCommand "read Node version"
  if ($nodeVersion -notmatch '^v24\.') {
    throw "Node 24.x required. Current: $nodeVersion"
  }

  Write-Host "Verified isolated project, expected branch and Node $nodeVersion." -ForegroundColor Green
  if ($AtualizarDependencias) {
    & npm.cmd ci
    Assert-LastCommand "npm ci"
  }
  if (-not (Test-Path (Join-Path $root "node_modules"))) {
    throw "Dependencies missing: execute npm ci or use -AtualizarDependencias."
  }

  & npm.cmd run test:platform
  Assert-LastCommand "backend tests"

  if ($Auditoria) {
    & npm.cmd audit --omit=dev
    Assert-LastCommand "npm audit --omit=dev"
  }

  if ($Navegador -or $SitePublico -or $Lighthouse) {
    & npx.cmd playwright install chromium
    Assert-LastCommand "install Playwright Chromium"

    if ($Navegador) {
      $listener = Get-NetTCPConnection -LocalPort 4176 -State Listen -ErrorAction SilentlyContinue
      if ($listener) {
        throw "Port 4176 is already in use. Stop the other local server first."
      }
      $serverProcess = $null
      $priorBase = [Environment]::GetEnvironmentVariable("BASE_URL", "Process")
      try {
        $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
        $serverProcess = Start-Process -FilePath $nodeExe -ArgumentList "scripts/serve-platform.mjs" -WorkingDirectory $root -WindowStyle Hidden -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
          Start-Sleep -Milliseconds 500
          try {
            $result = Invoke-WebRequest -Uri "http://127.0.0.1:4176/api/plataforma?op=config" -TimeoutSec 2 -UseBasicParsing
            if ($result.StatusCode -eq 200) {
              $config = $result.Content | ConvertFrom-Json
              if ($config.mode -ne "synthetic-only") {
                throw "Unexpected local server mode. Aborting UI tests."
              }
              $ready = $true
              break
            }
          } catch {
            if ($serverProcess.HasExited) { break }
          }
        }
        if (-not $ready) {
          throw "Local test server did not become ready on port 4176."
        }

        $env:BASE_URL = "http://127.0.0.1:4176"
        & npm.cmd run test:platform-ui
        Assert-LastCommand "local authenticated browser tests"
      } finally {
        if ($null -ne $priorBase) {
          $env:BASE_URL = $priorBase
        } else {
          Remove-Item Env:\BASE_URL -ErrorAction SilentlyContinue
        }
        if ($serverProcess -and -not $serverProcess.HasExited) {
          Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        }
      }
    }

    if ($SitePublico -or $Lighthouse) {
      $priorBase = [Environment]::GetEnvironmentVariable("BASE_URL", "Process")
      try {
        Remove-Item Env:\BASE_URL -ErrorAction SilentlyContinue
        if ($SitePublico) {
          & npm.cmd test
          Assert-LastCommand "public-site browser regression"
        }
        if ($Lighthouse) {
          $priorRuns = [Environment]::GetEnvironmentVariable("LIGHTHOUSE_RUNS", "Process")
          try {
            $env:LIGHTHOUSE_RUNS = [string]$LighthouseRodadas
            & npm.cmd run audit
            Assert-LastCommand "Lighthouse local repeat audit"
            & node scripts/diagnosticar-lighthouse.mjs
            Assert-LastCommand "Lighthouse performance diagnosis"
          } finally {
            if ($null -ne $priorRuns) {
              $env:LIGHTHOUSE_RUNS = $priorRuns
            } else {
              Remove-Item Env:\LIGHTHOUSE_RUNS -ErrorAction SilentlyContinue
            }
          }
        }
      } finally {
        if ($null -ne $priorBase) {
          $env:BASE_URL = $priorBase
        } else {
          Remove-Item Env:\BASE_URL -ErrorAction SilentlyContinue
        }
      }
    }
  }

  Write-Host "Local checks passed. No deploy, production change, or Blob connection was performed." -ForegroundColor Green
} finally {
  Pop-Location
}
