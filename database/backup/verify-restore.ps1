# ==============================================================================
# AssetVault: Restore Verification & Table Row Count Comparison (Windows PowerShell)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Restores into scratch DB and compares row counts across all user tables
# ==============================================================================

[CmdletBinding()]
param (
    [string]$DumpFile = "",
    [switch]$KeepScratch = $false,
    [switch]$Docker = $false
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$RestoreScript = Join-Path $ScriptDir "restore.ps1"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " AssetVault: Database Restore Verification Drill" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# 1. Execute restore into scratch DB
Write-Host "[STEP 1/3] Restoring backup archive into scratch database 'assetvault_restore_test'..." -ForegroundColor Yellow
$restoreArgs = @("-Scratch", "-Yes")
if ($DumpFile) { $restoreArgs += @("-DumpFile", $DumpFile) }
if ($Docker)   { $restoreArgs += "-Docker" }

& powershell -ExecutionPolicy Bypass -File $RestoreScript @restoreArgs
if ($LASTEXITCODE -ne 0) {
    throw "Restoration into scratch database failed with code $LASTEXITCODE"
}

# 2. Load connection details
function Load-EnvFile([string]$path) {
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $idx = $line.IndexOf("=")
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
                if (-not [System.Environment]::GetEnvironmentVariable($key)) {
                    [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
                }
            }
        }
    }
}

if (-not $env:DATABASE_URL -and -not $env:DIRECT_URL) {
    Load-EnvFile (Join-Path $ProjectRoot ".env")
    if (-not $env:DATABASE_URL -and -not $env:DIRECT_URL) {
        Load-EnvFile (Join-Path $ProjectRoot "backend\.env")
        if (-not $env:DATABASE_URL -and -not $env:DIRECT_URL) {
            Load-EnvFile (Join-Path $ProjectRoot "apps\api\.env")
        }
    }
}

$DbHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$DbPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$DbUser = if ($env:PGUSER) { $env:PGUSER } elseif ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$DbPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } elseif ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "" }
$SourceDb = if ($env:PGDATABASE) { $env:PGDATABASE } elseif ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "assetvault_db" }

$ConnUrl = if ($env:MIGRATE_DATABASE_URL) { $env:MIGRATE_DATABASE_URL } elseif ($env:DIRECT_URL) { $env:DIRECT_URL } else { $env:DATABASE_URL }

if ($ConnUrl) {
    if ($ConnUrl -match "^postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)$") {
        $DbUser = $matches[1]
        $DbPass = $matches[2]
        $DbHost = $matches[3]
        if ($matches[4]) { $DbPort = $matches[4] }
        $SourceDb = $matches[5].Split('?')[0]
    }
}

$ScratchDb = "assetvault_restore_test"
$env:PGPASSWORD = $DbPass

# Locate psql
$PsqlExe = "psql"
if (-not $Docker) {
    $foundPsql = Get-Command "psql" -ErrorAction SilentlyContinue
    if (-not $foundPsql) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\psql.exe",
            "C:\Program Files\PostgreSQL\17\bin\psql.exe",
            "C:\Program Files\PostgreSQL\16\bin\psql.exe",
            "C:\Program Files\PostgreSQL\15\bin\psql.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { $PsqlExe = $c; break }
        }
    }
}

function Run-Sql([string]$db, [string]$sql) {
    if ($Docker) {
        return (docker compose exec -T db psql -U $DbUser -d $db -t -A -c $sql).Trim()
    } else {
        return (& $PsqlExe -h $DbHost -p $DbPort -U $DbUser -d $db -t -A -c $sql).Trim()
    }
}

Write-Host "`n[STEP 2/3] Querying table catalog and calculating row counts..." -ForegroundColor Yellow

# Query all public base tables
$tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '_prisma%' ORDER BY table_name;"
$tableListRaw = Run-Sql $SourceDb $tableQuery
$tables = $tableListRaw -split "`r?`n" | Where-Object { $_ -ne "" }

if (-not $tables -or $tables.Count -eq 0) {
    throw "No tables found in public schema of source database '$SourceDb'"
}

$results = @()
$allPassed = $true

foreach ($tbl in $tables) {
    $countSql = "SELECT COUNT(*) FROM `"$tbl`";"
    $sourceCount = [int](Run-Sql $SourceDb $countSql)
    
    $scratchCountRaw = Run-Sql $ScratchDb $countSql
    $scratchCount = if ($scratchCountRaw -match '^\d+$') { [int]$scratchCountRaw } else { -1 }

    $status = if ($sourceCount -eq $scratchCount) { "PASS" } else { "FAIL" }
    if ($status -eq "FAIL") { $allPassed = $false }

    $results += [PSCustomObject]@{
        Table        = $tbl
        SourceRows   = $sourceCount
        ScratchRows  = $scratchCount
        Status       = $status
    }
}

Write-Host "`n================================================================================" -ForegroundColor Green
Write-Host " DATABASE RESTORATION VERIFICATION REPORT" -ForegroundColor Green
Write-Host " Source Database : $SourceDb" -ForegroundColor Gray
Write-Host " Scratch Database: $ScratchDb" -ForegroundColor Gray
Write-Host " Total Tables    : $($tables.Count)" -ForegroundColor Gray
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ("{0,-32} {1,14} {2,14} {3,10}" -f "Table Name", "Source Rows", "Scratch Rows", "Status") -ForegroundColor Cyan
Write-Host ("-" * 74) -ForegroundColor Gray

foreach ($r in $results) {
    $statusColor = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
    $line = "{0,-32} {1,14} {2,14} {3,10}" -f $r.Table, $r.SourceRows, $r.ScratchRows, $r.Status
    Write-Host $line -ForegroundColor $statusColor
}

Write-Host ("=" * 74) -ForegroundColor Green

if ($allPassed) {
    Write-Host "[RESULT] PASS: All $($tables.Count) tables verified with exact row parity." -ForegroundColor Green
} else {
    Write-Host "[RESULT] FAIL: Discrepancy detected between source and scratch databases!" -ForegroundColor Red
}

# 3. Cleanup Scratch Database
if (-not $KeepScratch) {
    Write-Host "`n[STEP 3/3] Dropping transient scratch database '$ScratchDb'..." -ForegroundColor Cyan
    if ($Docker) {
        docker compose exec -T db psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $ScratchDb;" | Out-Null
    } else {
        & $PsqlExe -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $ScratchDb;" | Out-Null
    }
    Write-Host "[INFO] Scratch database cleaned up." -ForegroundColor Gray
} else {
    Write-Host "`n[INFO] Scratch database '$ScratchDb' retained for manual inspection." -ForegroundColor Yellow
}

if (-not $allPassed) {
    exit 1
}
