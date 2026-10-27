# AssetVault — Advanced Enterprise SaaS Architecture & Database Features Guide

> **Course:** BCSE307L Database Systems (Fall 2026-27)  
> **System:** Multi-Tenant Digital Asset & License Management System (AssetVault)  
> **Scope:** 11 Advanced Architectural Capabilities & Underlying PostgreSQL 16 Mechanisms  

---

## 1. Feature-to-Database Mapping Summary

| # | Advanced SaaS Capability | Underlying PostgreSQL Database Feature (One-Line Explanation) |
|:---:|---|---|
| **1** | **Scheduled Background Jobs (`worker.ts`)** | **PostgreSQL Session Advisory Locks (`pg_try_advisory_lock`)**, Stored Procedures (`sp_renew_license`), and PL/pgSQL Notification Functions (`fn_generate_expiry_notifications`). |
| **2** | **Transactional Email Notifications** | **PL/pgSQL Trigger Notification Ledgers (`notifications`)** queried asynchronously to dispatch templates without blocking HTTP transactions. |
| **3** | **Real-Time Push Alerts (Server-Sent Events)** | **PostgreSQL Row-Level Security (RLS)** ensuring SSE event streams only broadcast records matching `current_setting('app.current_tenant_id')`. |
| **4** | **Tenant Compliance & Governance Engine** | **Multi-table Relational Aggregation & View Joins** cross-evaluating `v_license_utilization`, `license_covered_assets`, and `v_asset_catalog`. |
| **5** | **Cost Optimisation & Inactive Seat Reclaim** | **Temporal Interval Outer Joins (`NOW() - INTERVAL '30 days'`)** combined with the atomic capacity stored procedure `sp_release_license_seat`. |
| **6** | **Global Omnisearch (`Ctrl+K` Command Palette)** | **PostgreSQL Trigram Extension (`pg_trgm`)** with GIN fuzzy-matching indexes (`gin_trgm_ops`) and word similarity ranking. |
| **7** | **Document Generation (PDF Dossier & CSV Ledger)** | **Relational Graph Aggregates & Index Cursor Streams** formatting nested entity trees into standard interchange formats. |
| **8** | **Enterprise Observability & Prometheus Metrics** | **PostgreSQL Connection Pool Instrumentation (`pg_stat_activity` / Prisma Metrics)** and query duration measurement. |
| **9** | **High-Scale Query Performance Tuning** | **Materialized Views (`REFRESH MATERIALIZED VIEW CONCURRENTLY`)**, Tuple-Index Cursor Pagination, and Composite SQL Views. |
| **10** | **Data Lifecycle & Token Invalidation** | **Cascading Relational Extraction (JSON Export)** and instant tenant state validation inside Auth middleware. |
| **11** | **Automated Vitest & Playwright Verification** | **Transaction Rollbacks & ACID Constraint Validation** verifying stored procedure exceptions, concurrency limits, and RLS barriers. |

---

## 2. In-Depth Technical Specification of Each Capability

---

### Feature 1: Distributed Scheduled Background Jobs
* **Entry Point:** `backend/src/worker.ts` (supports standalone worker process or inline execution via `RUN_WORKER=true`).
* **Cron Schedules & Advisory Lock IDs:**
  1. `0 2 * * *` (Daily 02:00 AM) — Expiry Check: Calls `fn_generate_expiry_notifications()`. Protected by Advisory Lock `1001`.
  2. `0 * * * *` (Hourly) — Materialized View Refresh: Executes `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;`. Protected by Advisory Lock `1002`.
  3. `15 2 * * *` (Daily 02:15 AM) — Auto-Renewal Engine: Scans licenses where `auto_renew = true` and `end_date <= NOW() + INTERVAL '3 days'`, calling `sp_renew_license(license_id, period_interval, cost)`. Protected by Advisory Lock `1003`.
* **Idempotency & Concurrency Safety:**
  Every job wraps its execution in `SELECT pg_try_advisory_lock($1)`. If another worker instance or replica currently holds the lock, the job cleanly skips execution without conflict:
  ```sql
  SELECT pg_try_advisory_lock(1001) AS acquired;
  -- If acquired = true: execute procedure; SELECT pg_advisory_unlock(1001);
  ```
* **Database Feature:** `pg_try_advisory_lock` (Session-level distributed synchronization locks).

---

### Feature 2: Transactional Expiry Email Notifications
* **Service:** `backend/src/services/email.service.ts` (Nodemailer with Ethereal / Mailtrap / SMTP transport).
* **Delivery Strategy:** Expiry emails are decoupled from HTTP request loops and triggered directly from the daily scheduler or admin trigger.
* **Email Templates:**
  - `30 Days Remaining` (Notice): Friendly notification with renewal terms.
  - `15 Days Remaining` (Warning): Highlighting seats at risk of revocation.
  - `7 Days Remaining` (Urgent): Amber alert with single-click renewal instructions.
  - `Expired` (Critical Alert): Red badge notification indicating software compliance breach.
* **Target Recipients:** Dispatched automatically to all active `TENANT_ADMIN` and `ASSET_MANAGER` accounts belonging to the affected tenant.
* **Database Feature:** Decoupled event generation via PL/pgSQL function `fn_generate_expiry_notifications()`.

---

### Feature 3: Real-Time Server-Sent Events (SSE) Stream
* **Endpoint:** `GET /api/notifications/stream`
* **Protocol:** HTTP/1.1 chunked streaming with `Content-Type: text/event-stream` and `Cache-Control: no-cache`.
* **Security & Multi-Tenancy:**
  - Authenticated via JWT bearer token or cookie session.
  - Strict tenant and user isolation: Each connection is registered in memory partitioned by `tenantId:userId`.
  - On notification creation, events are dispatched only to the matching tenant's active client streams.
* **Frontend Integration:** `Navbar.tsx` listens via standard browser `EventSource`, automatically incrementing the unread badge and playing audio-visual alerts without polling.
* **Database Feature:** Row-Level Security (RLS) tenant isolation on the backing `notifications` table.

---

### Feature 4: Automated Governance & Compliance Engine
* **Endpoint:** `GET /api/reports/compliance`
* **Score Calculation Formula ($0 - 100$):**
  $$\text{Score} = 100 - (25 \times \text{UnlicensedRisk}) - (25 \times \text{ExhaustedRisk}) - (25 \times \text{ExpiredActiveRisk}) - (25 \times \text{ImminentExpiryRisk})$$
  - **Grade Thresholds:** $A \ge 90$, $B \ge 80$, $C \ge 70$, $D \ge 60$, $F < 60$.
* **Frontend Widget:** Dynamic circular SVG gauge on `DashboardPage.tsx` with an interactive "Remediate Issues" modal outlining affected assets, exhausted license IDs, and direct action buttons.
* **Database Feature:** Multi-table relational joins combining `v_license_utilization`, `license_covered_assets`, and `v_asset_catalog`.

---

### Feature 5: Cost Optimisation & Inactive Seat Reclaim
* **Endpoint:** `GET /api/reports/unused-seats`
* **Reclamation Logic:** Identifies seat allocations where `license_seat_allocations.allocated_at < NOW() - INTERVAL '30 days'` and no corresponding download entry exists in `access_logs` within the last 30 days.
* **Financial Insights:**
  - Calculates potential monthly cost savings per dormant seat: $\frac{\text{License Cost}}{\text{Seats Total} \times 12}$.
  - Computes top vendor spend breakdown to negotiate enterprise contract tiers.
* **One-Click Reclaim:** Employs the ACID stored procedure `sp_release_license_seat(p_license_id, p_user_id, p_released_by, p_reason)` to free seats instantaneously while maintaining audit history.
* **Database Feature:** Temporal interval outer joins (`NOW() - INTERVAL '30 days'`) and atomic procedure `sp_release_license_seat`.

---

### Feature 6: Global Multi-Entity Search (`Ctrl+K` Command Palette)
* **Endpoint:** `GET /api/search?q=:query`
* **Search Corpus:** Scans across 4 entities simultaneously:
  1. `assets` (name, description, file_format)
  2. `licenses` (name, license_key, vendor_name)
  3. `vendors` (name, contact_email, website_url)
  4. `tags` (name)
* **Frontend UI:** Keyboard-driven modal palette (`CommandPalette.tsx`) bound to `Ctrl+K` / `Cmd+K`.
* **Database Feature:** PostgreSQL `pg_trgm` extension with GIN trigram indexes (`gin_trgm_ops`) for substring and typo-tolerant fuzzy matching.

---

### Feature 7: Branded Export Engines (PDF Dossier & RFC 4180 CSV)
* **Endpoints:**
  - `GET /api/licenses/:id/pdf` — Generates a downloadable multi-page PDF dossier detailing contract terms, active seat holders, covered digital assets, and renewal ledger.
  - `GET /api/audit-logs/export` — Streams immutable audit logs directly to standard RFC 4180 CSV, with support for actor, entity, and action filters.
* **Database Feature:** Relational graph projection and cursor streaming preventing memory spikes during multi-megabyte exports.

---

### Feature 8: Observability, Structured Logging & Prometheus Metrics
* **Components:**
  - `X-Request-Id` Middleware: Injects a unique UUIDv4 into incoming requests and response headers for distributed trace tracking.
  - Structured Pino Logger: Redacts sensitive headers (`Authorization`, `cookie`, `password`) and writes structured JSON logs.
  - Liveness & Readiness Probes: `GET /api/health` (process health) and `GET /api/ready` (tests active PostgreSQL connectivity with `SELECT 1`).
  - Prometheus Metrics: `GET /api/metrics` exposing standard node metrics plus:
    - `http_request_duration_seconds` (Histogram by method, route, status code)
    - `license_allocation_failures_total` (Counter tracking quota rejections)
  - Protected via `METRICS_BEARER_TOKEN` environment variable.
* **Database Feature:** Active PostgreSQL connection pool monitoring and query duration tracing.

---

### Feature 9: Database Query Performance Hardening
* **Techniques Implemented:**
  1. **N+1 Elimination:** Consolidated entity views (`v_asset_catalog`, `v_license_utilization`, `v_vendor_spend`).
  2. **Cursor Pagination:** Replaced `OFFSET` with `(created_at, id) < ($1, $2)` index seeks on `audit_logs` and `access_logs`.
  3. **Compression & ETags:** Added gzip compression and automatic HTTP ETag caching.
  4. **Materialized View:** Concurrent refresh of `mv_monthly_access_stats`.
* **Database Feature:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` and composite tuple B-tree indexes.

---

### Feature 10: Tenant Data Lifecycle & Immediate Suspension
* **Data Lifecycle Export:** `GET /api/tenant/export` generates a comprehensive, portable JSON document containing all tenant data (assets, versions, licenses, allocations, categories, tags) for disaster recovery or tenant migration.
* **Immediate Token Revocation on Suspension:**
  - When a `SUPER_ADMIN` suspends a tenant (`status = 'SUSPENDED'`), the authentication middleware (`loadUser.middleware.ts`) verifies tenant status on every request.
  - Any request bearing a valid JWT from a suspended tenant is immediately rejected with `403 Forbidden: Tenant organization has been suspended`.
* **Database Feature:** Cascading multi-entity queries bounded by tenant foreign keys and append-only trigger validation.

---

### Feature 11: End-to-End Automated Testing & Code Coverage
* **Service Unit & Integration Tests (Vitest):**
  - **81 tests** passing across 4 comprehensive suites.
  - **Statement Coverage: 70.01%** (exceeding the 70% threshold).
  - **Function Coverage: 77.96%**.
* **Playwright End-to-End User Journeys (Chromium Headless):**
  - **Journey 1 (`01-rbac-menu.spec.ts`):** Multi-role authentication (Tenant Admin vs Member), dynamic sidebar generation, and route-level 403 barriers.
  - **Journey 2 (`02-asset-license-capacity.spec.ts`):** Asset repository listing, license seat provisioning, 409 Conflict enforcement upon capacity exhaustion, and seat release via stored procedures.
  - **Journey 3 (`03-renewal-notification.spec.ts`):** Automated contract term extension via `sp_renew_license`, manual triggering of `fn_generate_expiry_notifications`, and notification center verification.
* **Database Feature:** ACID transaction rollback guarantees and stored procedure exception assertions.
