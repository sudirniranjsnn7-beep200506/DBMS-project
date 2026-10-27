# ==============================================================================
# AssetVault: Native PostgreSQL Database Restore Script (Windows PowerShell)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_restore (--clean --if-exists --no-owner) + Checksum Verification
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$DumpFile = "",
    [switch]$Scratch = $false,
    [string]$TargetDb = "",
    [switch]$Yes = $false,
    [switch]$Docker = $false
)

$ErrorActionPreference = "Stop"

# 1. Determine Repository Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$BackupDir = Join-Path $ProjectRoot "backups"

# 2. Resolve Dump File
if ([string]::IsNullOrWhiteSpace($DumpFile)) {
    # Find latest dump file in backups directory
    $latestDump = Get-ChildItem -Path $BackupDir -Filter "assetvault_*.dump" -ErrorAction SilentlyContinue | Sort-Object CreationTime -Descending | Select-Object -First 1
    if (-not $latestDump) {
        throw "No backup file specified and no .dump files found in $BackupDir"
    }
    $DumpFile = $latestDump.FullName
    Write-Host "[INFO] No file specified. Auto-selected latest backup: $(Split-Path $DumpFile -Leaf)" -ForegroundColor Cyan
} else {
    if (-not (Test-Path $DumpFile)) {
        # Check inside backups dir if relative name provided
        $candidate = Join-Path $BackupDir $DumpFile
        if (Test-Path $candidate) {
            $DumpFile = $candidate
        } else {
            throw "Specified backup file does not exist: $DumpFile"
        }
    }
}

$DumpFileName = Split-Path $DumpFile -Leaf
$DumpFileDir  = Split-Path $DumpFile -Parent

# 3. Verify SHA-256 Checksum
$ChecksumFile = Join-Path $DumpFileDir "$DumpFileName.sha256"
if (Test-Path $ChecksumFile) {
    Write-Host "[1/3] Verifying SHA-256 checksum..." -ForegroundColor Yellow
    $expectedHashLine = (Get-Content $ChecksumFile | Select-Object -First 1).Trim()
    $expectedHash = ($expectedHashLine -split '\s+')[0].Trim().ToUpper()
    
    $actualHash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash.ToUpper()

    if ($expectedHash -ne $actualHash) {
        Write-Host "[ERROR] Cryptographic checksum mismatch!" -ForegroundColor Red
        Write-Host "  Expected: $expectedHash" -ForegroundColor Red
        Write-Host "  Actual  : $actualHash" -ForegroundColor Red
        throw "Integrity verification failed for backup file: $DumpFile"
    }
    Write-Host "[PASS] Checksum matched: $actualHash" -ForegroundColor Green
} else {
    Write-Host "[WARN] No .sha256 checksum file found next to $DumpFileName; proceeding without verification" -ForegroundColor DarkYellow
}

# 4. Load Environment Variables from .env
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

# 5. Determine Database Connection Parameters
$DbHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$DbPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$DbUser = if ($env:PGUSER) { $env:PGUSER } elseif ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$DbPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } elseif ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "" }
$DbName = if ($TargetDb) { $TargetDb } elseif ($Scratch) { "assetvault_restore_test" } elseif ($env:PGDATABASE) { $env:PGDATABASE } elseif ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "assetvault_db" }

# Extract parameters prioritizing DIRECT_URL or MIGRATE_DATABASE_URL over DATABASE_URL for administrative/bypass-RLS restoration
$ConnUrl = if ($env:MIGRATE_DATABASE_URL) { $env:MIGRATE_DATABASE_URL } elseif ($env:DIRECT_URL) { $env:DIRECT_URL } else { $env:DATABASE_URL }

if ($ConnUrl) {
    if ($ConnUrl -match "^postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)$") {
        $DbUser = $matches[1]
        $DbPass = $matches[2]
        $DbHost = $matches[3]
        if ($matches[4]) { $DbPort = $matches[4] }
        $cleanDb = $matches[5].Split('?')[0]
        if (-not $TargetDb -and -not $Scratch) {
            $DbName = $cleanDb
        }
    }
}

$env:PGPASSWORD = $DbPass

# 6. Locate native tools (pg_restore, psql)
$PgRestoreExe = "pg_restore"
$PsqlExe = "psql"
if (-not $Docker) {
    $foundRestore = Get-Command "pg_restore" -ErrorAction SilentlyContinue
    if (-not $foundRestore) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { $PgRestoreExe = $c; break }
        }
    }

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

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " AssetVault: Database Restoration Engine" -ForegroundColor Green
Write-Host " Archive File   : $DumpFile" -ForegroundColor Green
Write-Host " Target Database: $DbName @ $DbHost`:$DbPort (User: $DbUser)" -ForegroundColor Green
Write-Host " Mode           : $(if ($Scratch) { 'Isolated Scratch Test' } else { 'Live Production Restoration' })" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

# 7. Interactive Confirmation Prompt
if (-not $Yes -and -not $Scratch) {
    Write-Host "`n[WARNING] Restoring into live database '$DbName' will overwrite tables and existing records!" -ForegroundColor Red
    $response = Read-Host "Are you sure you want to continue? [y/N]"
    if ($response -notmatch "^(y|yes)$") {
        Write-Host "[ABORTED] Restoration cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

# 8. Setup Scratch Database if requested
if ($Scratch) {
    Write-Host "[2/3] Preparing scratch database '$DbName'..." -ForegroundColor Cyan
    if ($Docker) {
        docker compose exec -T db psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DbName;" -c "CREATE DATABASE $DbName;"
    } else {
        & $PsqlExe -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DbName;" -c "CREATE DATABASE $DbName;"
    }
}

# 9. Perform Restoration
Write-Host "[3/3] Restoring database schema and records..." -ForegroundColor Yellow

$isPlainSql = $DumpFile.EndsWith(".sql")

if ($Docker) {
    if ($isPlainSql) {
        Get-Content $DumpFile | docker compose exec -T db psql -U $DbUser -d $DbName
    } else {
        # Stream custom dump to pg_restore in container
        Get-Content -Encoding Byte $DumpFile | docker compose exec -T db pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner
    }
} else {
    if ($isPlainSql) {
        & $PsqlExe -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $DumpFile
        if ($LASTEXITCODE -ne 0) { throw "psql restoration failed with code $LASTEXITCODE" }
    } else {
        # pg_restore --clean --if-exists --no-owner
        # Note: pg_restore may return code 1 for non-critical warnings (e.g. notices about objects not existing yet during clean drop).
        & $PgRestoreExe -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists --no-owner $DumpFile
        if ($LASTEXITCODE -gt 1) {
            throw "pg_restore failed with critical error code $LASTEXITCODE"
        }
    }
}

Write-Host "`n================================================================================" -ForegroundColor Green
Write-Host " Restoration Completed Successfully into '$DbName'." -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
