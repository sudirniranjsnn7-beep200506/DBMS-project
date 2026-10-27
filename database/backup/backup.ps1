# ==============================================================================
# AssetVault: Native PostgreSQL Database Backup Script (Windows PowerShell)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_dump (Custom -Fc & Plain SQL -Fp) + SHA-256 + 7-Day Retention
# ==============================================================================

[CmdletBinding()]
param (
    [string]$BackupDir = "",
    [switch]$Docker = $false,
    [string]$TargetDb = ""
)

$ErrorActionPreference = "Stop"

# 1. Determine Repository Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $ProjectRoot "backups"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[INFO] Created backup directory: $BackupDir" -ForegroundColor Cyan
}

# 2. Load Environment Variables from .env if not already set
function Load-EnvFile([string]$path) {
    if (Test-Path $path) {
        Write-Host "[INFO] Loading connection parameters from: $path" -ForegroundColor Cyan
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

# 3. Parse Database Parameters
$DbHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$DbPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$DbUser = if ($env:PGUSER) { $env:PGUSER } elseif ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$DbPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } elseif ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "" }
$DbName = if ($TargetDb) { $TargetDb } elseif ($env:PGDATABASE) { $env:PGDATABASE } elseif ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "assetvault_db" }

# Extract parameters prioritizing DIRECT_URL or MIGRATE_DATABASE_URL over DATABASE_URL for administrative/bypass-RLS backup
$ConnUrl = if ($env:MIGRATE_DATABASE_URL) { $env:MIGRATE_DATABASE_URL } elseif ($env:DIRECT_URL) { $env:DIRECT_URL } else { $env:DATABASE_URL }

if ($ConnUrl -and -not $TargetDb) {
    if ($ConnUrl -match "^postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)$") {
        $DbUser = $matches[1]
        $DbPass = $matches[2]
        $DbHost = $matches[3]
        if ($matches[4]) { $DbPort = $matches[4] }
        $cleanDb = $matches[5].Split('?')[0]
        $DbName = $cleanDb
    }
}

$env:PGPASSWORD = $DbPass

# 4. Locate pg_dump tool
$PgDumpExe = "pg_dump"
if ($Docker) {
    Write-Host "[INFO] Operating in Docker container mode (docker compose exec)..." -ForegroundColor Cyan
} else {
    $found = Get-Command "pg_dump" -ErrorAction SilentlyContinue
    if (-not $found) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) {
                $PgDumpExe = $c
                break
            }
        }
    }
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " AssetVault: Database Backup Engine" -ForegroundColor Green
Write-Host " Target Database : $DbName @ $DbHost`:$DbPort (User: $DbUser)" -ForegroundColor Green
Write-Host " Backup Directory: $BackupDir" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

# 5. Generate Timestamps & File Paths
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$CustomDumpName = "assetvault_$Timestamp.dump"
$PlainSqlName   = "assetvault_$Timestamp.sql"
$CustomDumpPath = Join-Path $BackupDir $CustomDumpName
$PlainSqlPath   = Join-Path $BackupDir $PlainSqlName
$ChecksumPath   = Join-Path $BackupDir "$CustomDumpName.sha256"

# 6. Execute Backups
if ($Docker) {
    Write-Host "[1/3] Generating custom format binary dump (-Fc) via Docker..." -ForegroundColor Yellow
    docker compose exec -T db pg_dump -U $DbUser -d $DbName -Fc > $CustomDumpPath
    Write-Host "[2/3] Generating readable plain SQL dump (-Fp) via Docker..." -ForegroundColor Yellow
    docker compose exec -T db pg_dump -U $DbUser -d $DbName -Fp > $PlainSqlPath
} else {
    Write-Host "[1/3] Generating custom format binary dump (-Fc)..." -ForegroundColor Yellow
    & $PgDumpExe -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $CustomDumpPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump custom format failed with code $LASTEXITCODE" }

    Write-Host "[2/3] Generating readable plain SQL dump (-Fp)..." -ForegroundColor Yellow
    & $PgDumpExe -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fp -f $PlainSqlPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump plain SQL failed with code $LASTEXITCODE" }
}

# 7. Generate SHA-256 Checksum
Write-Host "[3/3] Generating SHA-256 cryptographic checksum..." -ForegroundColor Yellow
$hashResult = Get-FileHash -Path $CustomDumpPath -Algorithm SHA256
$hashString = "$($hashResult.Hash.ToLower())  $CustomDumpName"
[System.IO.File]::WriteAllText($ChecksumPath, $hashString)

$dumpSize = (Get-Item $CustomDumpPath).Length / 1KB
$sqlSize = (Get-Item $PlainSqlPath).Length / 1KB

Write-Host "`n[SUCCESS] Backup Generated Successfully:" -ForegroundColor Green
Write-Host "  - Custom Binary Dump: $CustomDumpPath ($([math]::Round($dumpSize, 2)) KB)" -ForegroundColor Gray
Write-Host "  - Plain Text SQL Dump: $PlainSqlPath ($([math]::Round($sqlSize, 2)) KB)" -ForegroundColor Gray
Write-Host "  - SHA-256 Checksum  : $($hashResult.Hash)" -ForegroundColor Gray

# 8. Retention Policy: Retain Only Latest 7 Backups
Write-Host "`n[INFO] Enforcing 7-Day Backup Retention Policy..." -ForegroundColor Cyan
$allDumps = Get-ChildItem -Path $BackupDir -Filter "assetvault_*.dump" | Sort-Object CreationTime -Descending

if ($allDumps.Count -gt 7) {
    $staleDumps = $allDumps | Select-Object -Skip 7
    foreach ($stale in $staleDumps) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($stale.Name)
        $associatedFiles = @(
            $stale.FullName,
            (Join-Path $BackupDir "$baseName.sql"),
            (Join-Path $BackupDir "$($stale.Name).sha256")
        )
        foreach ($f in $associatedFiles) {
            if (Test-Path $f) {
                Remove-Item -Path $f -Force
                Write-Host "  - Purged expired archive: $(Split-Path $f -Leaf)" -ForegroundColor DarkYellow
            }
        }
    }
} else {
    Write-Host "  - Currently $($allDumps.Count) backup archive(s) stored (Retention limit: 7)." -ForegroundColor Gray
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " Backup Completed Successfully." -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
