# AssetVault: Production Go-Live Verification Checklist
**Target Release**: v1.0.0 Enterprise SaaS  
**Audit Standard**: BCSE307L Database Systems Final Release Gate  
**Deployment Stack**: Supabase PostgreSQL 16 + Render Docker + Vercel React SPA

---

## 1. Security & Hygiene Pre-Flight Gate

- [x] **Zero Secrets in Repository**: Full history scanned with `npm run check:secrets`. Zero private keys, unignored `.env` files, or production secrets committed.
- [x] **SQL Injection Prevention**: `npm run check:sqli` passes cleanly with zero instances of `$queryRawUnsafe` or `$executeRawUnsafe`. All dynamic queries utilize parameterized `Prisma.sql` templates or typed methods.
- [x] **Least Privilege Database Role**: `assetvault_app` runtime role provisioned via [`database/sql/08_production_bootstrap.sql`](../database/sql/08_production_bootstrap.sql). `CREATE` and `DROP` privileges revoked from public schema.
- [x] **Reverse Proxy Security**: `app.set('trust proxy', 1)` configured so client IPs are verified correctly behind Render/Vercel reverse proxies.
- [x] **HTTP Strict Transport Security (HSTS)**: Helmet configured with `maxAge: 31536000`, `includeSubDomains: true`, and `preload: true` in production.
- [x] **Secure Cookie Flags**: `refreshToken` cookie enforces `httpOnly: true`, `secure: true` (in production), configurable `sameSite: 'lax'|'strict'|'none'`, and path scoping to `/api/auth`.
- [x] **Input Sanitization & Body Limits**: Express configured with `2mb` body limits and `hpp` parameter pollution prevention.

---

## 2. Database Schema & Business Logic Integrity

- [x] **PostgreSQL 16 Extensions Enabled**: `uuid-ossp`, `pg_trgm`, `btree_gist` active on cloud database.
- [x] **Prisma Cloud Connectivity**: `DATABASE_URL` configured with transaction pooler (`?pgbouncer=true`) and `DIRECT_URL` configured for migrations.
- [x] **Migration Alignment**: `npx prisma migrate deploy` executed cleanly with zero pending migrations.
- [x] **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce tenant isolation across all multi-tenant tables.
- [x] **Views & Procedures Operational**:
  - `v_asset_catalog`
  - `v_license_utilization`
  - `v_expiring_licenses`
  - `v_vendor_spend`
  - `mv_monthly_access_stats`
  - Stored procedure `sp_allocate_license_seat`
  - Stored procedure `sp_release_license_seat`
  - Stored procedure `sp_renew_license`
  - Stored function `fn_generate_expiry_notifications`
- [x] **PostgreSQL Advisory Locks**: Schedulers lock IDs 1001 (Daily Expiry), 1002 (MV Refresh), 1003 (Auto Renew) preventing race conditions across instances.

---

## 3. Background Workers & Schedulers

- [x] **In-Process Worker Configuration**: `ENABLE_IN_PROCESS_WORKER=true` activates background cron inside API process when standalone worker container is not deployed.
- [x] **Daily Expiry Audit**: Runs at 02:00 UTC, invokes `fn_generate_expiry_notifications()`, and triggers real-time SSE broadcast.
- [x] **Materialized View Concurrent Refresh**: Hourly concurrent refresh of `mv_monthly_access_stats`.
- [x] **Automated License Renewal**: Daily scan auto-renews licenses with `auto_renew = true` within 3 days of expiration.
- [x] **Transactional Email Alerts**: 30-day, 15-day, 7-day and expired alerts dispatched via Nodemailer.

---

## 4. Telemetry, Observability & Monitoring

- [x] **Health Check Endpoint**: `GET /api/health` returns status `healthy` with uptime.
- [x] **Readiness Check Endpoint**: `GET /api/ready` validates database connectivity and latency.
- [x] **Prometheus Scrape Endpoint**: `GET /metrics` protected by `METRICS_BEARER_TOKEN`.
- [x] **Docker Compose Monitoring Profile**:
  - Prometheus scraping `api:5000/metrics` every 15s.
  - Grafana pre-provisioned datasource and dashboard at [`monitoring/grafana/dashboards/assetvault-overview.json`](../monitoring/grafana/dashboards/assetvault-overview.json).
- [x] **Free-Tier Keepalive**: GitHub Actions workflow [`.github/workflows/keepalive.yml`](../.github/workflows/keepalive.yml) pings `/api/health` every 10 minutes to prevent Render free-tier cold starts.
- [x] **UptimeRobot Integration**: Free external ping monitoring configured for `/api/health` at 5-minute intervals.

---

## 5. Automated Backup & Disaster Recovery

- [x] **Native Backup Tools**: `database/backup/backup.sh` and `backup.ps1` generate custom format (`.dump`) and plain SQL dumps with SHA-256 checksums.
- [x] **Rotation Policy**: Maintains 7 latest backups locally.
- [x] **Restoration Drill**: Verified via `database/backup/restore.sh` and `verify-restore.sh`.
- [x] **Nightly Cloud Backup Workflow**: [`.github/workflows/nightly-backup.yml`](../.github/workflows/nightly-backup.yml) runs `pg_dump` daily at 02:00 UTC and stores artifacts with 7-day retention.

---

## 6. CI/CD Pipeline Verification

- [x] **CI Pipeline ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))**:
  - Secret scan gate (`npm run check:secrets`)
  - SQL injection gate (`npm run check:sqli`)
  - Dependency audit (`npm audit`)
  - TypeScript type-check and lint (`npm run lint`)
  - PostgreSQL 16 service container migration & seed
  - Unit and integration test suite (`npm run test -- --coverage`)
  - Monorepo production build (`npm run build`)
- [x] **Docker Pipeline ([`.github/workflows/docker.yml`](../.github/workflows/docker.yml))**:
  - Buildx multi-stage build for API and Web
  - Image tagging (`:latest`, `:sha-<sha>`, `:semver`)
  - Trivy vulnerability scanning
- [x] **CD Pipeline ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml))**:
  - Triggers Render deploy hook
  - 3-minute timeout health verification polling `/api/health` and `/api/ready`

---

## 7. Sign-Off Summary

| Component | Status | Verified By | Date |
|---|---|---|---|
| PostgreSQL Database & RLS | **PASS** | Automated Test Suite | 2026-10-14 |
| Express API & Security Middleware | **PASS** | Vitest (81/81 Passed) | 2026-10-14 |
| React Web Frontend SPA | **PASS** | Vite Production Build | 2026-10-14 |
| Background Schedulers & Advisory Locks | **PASS** | Automated Integration Tests | 2026-10-14 |
| Docker Multi-Stage Packaging | **PASS** | Docker Compose Engine | 2026-10-14 |
| GitHub Actions Workflows | **PASS** | Workflow Lint & YAML Parse | 2026-10-14 |
