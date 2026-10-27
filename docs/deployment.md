# AssetVault: Free-Cloud Production Deployment Guide
**Platform Stack**: Supabase (PostgreSQL 16) + Render (Docker API) + Vercel (React Frontend SPA)  
**Academic Coursework**: VIT, BCSE307L Database Systems (Fall 2026-27)

---

## 1. Architecture Overview

AssetVault is designed for zero-cost, high-reliability deployment on modern free-tier cloud platforms:

```
                      ┌──────────────────────────────────────────────┐
                      │              Client Browser                  │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTPS
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │            Vercel Frontend CDN               │
                      │  - Vite React SPA                            │
                      │  - Automatic Let's Encrypt TLS               │
                      │  - Rewrites /api/* -> Render Backend         │
                      └──────────────────────┬───────────────────────┘
                                             │ Reverse Proxy / HTTPS
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │             Render Web Service               │
                      │  - Multi-stage Docker Container (Node 20)    │
                      │  - Express API + In-Process Worker Cron      │
                      │  - PostgreSQL Advisory Locks (1001-1003)     │
                      └──────────────┬───────────────────────────────┘
                                     │
           Pooled Connection (6543)  │  Direct Connection (5432)
         (DATABASE_URL?pgbouncer=true)│  (DIRECT_URL for Migrations)
                                     ▼
                      ┌──────────────────────────────────────────────┐
                      │             Supabase Cloud DB                │
                      │  - PostgreSQL 16 with Row-Level Security     │
                      │  - pg_trgm, uuid-ossp, btree_gist extensions │
                      │  - Restricted assetvault_app runtime role    │
                      └──────────────────────────────────────────────┘
```

---

## 2. Step 1: Database Setup (Supabase)

### A. Create Project & Extensions
1. Sign up or log in at [supabase.com](https://supabase.com) (Free Tier).
2. Create a new organization and project named `assetvault-production`.
3. Select your preferred AWS region (e.g., `us-east-1` or `ap-southeast-1`).
4. Note your database master password.
5. In the Supabase Dashboard, navigate to **Database** -> **Extensions** and ensure the following are enabled:
   - `uuid-ossp`
   - `pg_trgm` (for trigram global search)
   - `btree_gist` (for temporal exclusion constraints)

### B. Connection String Architecture (`DATABASE_URL` vs `DIRECT_URL`)
Prisma's datasource configuration in `backend/prisma/schema.prisma` defines both `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`:

1. **Transaction Pooler (Port 6543 - `DATABASE_URL`)**:
   - Used for Express API runtime traffic and client queries.
   - Cloud providers (Supabase / Neon) route runtime queries through a transaction pooler (PgBouncer / Supavisor) to prevent PostgreSQL connection starvation under high concurrency.
   - Must include `?pgbouncer=true` so Prisma knows not to create cached prepared statements across pooled sessions:
     ```
     postgresql://postgres.[project-ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
     ```

2. **Direct Connection (Port 5432 - `DIRECT_URL`)**:
   - Used by Prisma CLI and migrations (`prisma migrate deploy`, `prisma db push`, `prisma db seed`).
   - Transaction poolers do **not** support session-level locks, advisory locks, or DDL schema migrations. Attempting to run migrations through a transaction pooler will fail with errors such as `P3009` or `prepared statement already exists`.
   - Bypasses the pooler and connects directly to the PostgreSQL instance:
     ```
     postgresql://postgres.[project-ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres?schema=public
     ```

3. **Local Development & Docker Compose Parity**:
   - In local environments and local Docker Compose orchestration, no transaction pooler is active.
   - In `.env.example` and `.env`, `DIRECT_URL` and `DATABASE_URL` point to the same direct connection string (`localhost:5432`).
   - In `docker-compose.yml`, both `DATABASE_URL` and `DIRECT_URL` are explicitly injected into the `api` and `worker` container environments pointing to `db:5432`. This guarantees that container initialization (`docker-entrypoint.sh` executing `npx prisma migrate deploy`) succeeds seamlessly without missing variable errors (`P1012`) or localhost fallback misroutes.

### C. Create Restricted Runtime Role (`assetvault_app`) & Enforce RLS
In PostgreSQL, **Row-Level Security (RLS) policies do not apply to superusers or table owners** (`postgres`). Connecting as `postgres` completely bypasses RLS policies at the engine level. 

To enforce Layer 1 database tenant isolation, the application must connect as a non-superuser, non-owner role: `assetvault_app`.
Because the initial migration creates `assetvault_app WITH NOLOGIN`, you must explicitly grant `LOGIN` and assign a secure password:

```sql
-- Direct SQL command (or executed via 08_production_bootstrap.sql):
ALTER ROLE assetvault_app WITH LOGIN PASSWORD '<STRONG_APP_PASSWORD_HERE>';
```

Run the production bootstrap script using the Supabase SQL Editor or `psql`:

```bash
# Execute 08_production_bootstrap.sql against your Supabase Direct URL
psql "$DIRECT_URL" -v APP_PASSWORD="'<STRONG_APP_PASSWORD_HERE>'" -f database/sql/08_production_bootstrap.sql
```

This ensures:
1. `assetvault_app` has `LOGIN` enabled with a dedicated password.
2. Standard DML rights (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) are granted on all application tables.
3. DDL privileges (`CREATE`, `DROP`, `ALTER TABLE`) are completely revoked.
4. RLS policies actively filter all queries executed under `assetvault_app`.

#### Dual-Role Connection Architecture:
- **Application Runtime (`DATABASE_URL`)**: Connects as `assetvault_app` (`postgresql://assetvault_app:<APP_PASSWORD>@...`). RLS is strictly enforced by PostgreSQL.
- **Migrations & Seeding (`DIRECT_URL` / `MIGRATE_DATABASE_URL`)**: Connects as the schema owner (`postgres`). Runs DDL and cross-tenant seed operations that bypass RLS.

### D. Apply Migrations & Reference Data
From your local terminal or CI/CD runner:

```bash
# 1. Apply Prisma migrations to the cloud database
DIRECT_URL="<YOUR_SUPABASE_DIRECT_URL>" npx prisma migrate deploy --schema backend/prisma/schema.prisma

# 2. Seed system roles, subscription plans, license types and initial Super Admin
DIRECT_URL="<YOUR_SUPABASE_DIRECT_URL>" \
DATABASE_URL="<YOUR_SUPABASE_POOLED_URL>" \
SEED_DEMO="false" \
SUPER_ADMIN_EMAIL="admin@yourdomain.com" \
SUPER_ADMIN_PASSWORD="<STRONG_ADMIN_PASSWORD>" \
npm run db:seed
```

---

## 3. Step 2: Backend API Deployment (Render)

### Option A: Render Blueprint (Recommended)
1. Fork or push your AssetVault repository to GitHub.
2. In [dashboard.render.com](https://dashboard.render.com), click **New** -> **Blueprint**.
3. Connect your repository. Render automatically reads root [`render.yaml`](../render.yaml).
4. Fill in the prompted secret values (Render will auto-generate strong random strings for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET`).
5. Click **Apply**.

### Option B: Manual Web Service
1. In Render, select **New** -> **Web Service**.
2. Connect your Git repository.
3. Choose **Docker** environment.
4. Set **Dockerfile Path**: `backend/Dockerfile`.
5. Set **Docker Context**: `.` (root directory).
6. Set **Health Check Path**: `/api/health`.
8. Add the environment variables listed in Section 5 below.

### Background Worker Architecture (`ENABLE_IN_PROCESS_WORKER`)
AssetVault provides background jobs (license expiry notifications, MV refresh, contract auto-renewal) that can execute in two modes governed by `ENABLE_IN_PROCESS_WORKER`:
- **Single-Container Deployments (Render Web Service Free Tier)**: Set `ENABLE_IN_PROCESS_WORKER=true` on the web service so cron tasks run directly inside the API process.
- **Multi-Container Deployments (`docker-compose.yml`, Kubernetes)**: Set `ENABLE_IN_PROCESS_WORKER=false` on the `api` container and `true` on the `worker` container to ensure jobs run only in the dedicated worker process without duplication.

---

## 4. Step 3: Frontend Deployment (Vercel)

1. Log in to [vercel.com](https://vercel.com) and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variables:
   - `VITE_API_BASE_URL`: `https://assetvault-api.onrender.com/api` (or `/api` if using Vercel rewrites)
5. Deploy. Vercel automatically honors [`frontend/vercel.json`](../frontend/vercel.json) for SPA routing and API reverse-proxying.

---

## 5. Complete Environment Variable Reference Table

### A. Backend Application Configuration (`backend/src/config/env.ts`)

| Variable Name | Type / Allowed Values | Default Value | Required? | Purpose & Security Note |
|---|---|---|---|---|
| `PORT` | Number | `5000` | No | Port for the Express HTTP server listener. |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` | No | Sets Node runtime environment. In `production`, enables HSTS, secure cookies, suppresses stack traces. |
| `DATABASE_URL` | String (PostgreSQL URL) | *(None)* | **Yes** | Primary database connection string. In production, points to the Supabase pooled connection (port 6543 with `?pgbouncer=true`). |
| `DIRECT_URL` | String (PostgreSQL URL) | *(Optional)* | No (Prod Yes) | Direct database connection string (port 5432) bypassing connection poolers. Required for schema migrations & DDL. |
| `MIGRATE_DATABASE_URL` | String (PostgreSQL URL) | *(Optional)* | No | Fallback direct URL used during CI migrations if `DIRECT_URL` is unset. |
| `JWT_ACCESS_SECRET` | String (min 32 chars) | *(None)* | **Yes** | Cryptographic HMAC secret for signing short-lived access JWTs. |
| `JWT_REFRESH_SECRET` | String (min 32 chars) | *(None)* | **Yes** | Cryptographic HMAC secret for signing and validating rotating refresh tokens. |
| `JWT_ACCESS_EXPIRES_IN`| String (zeit/ms format)| `15m` | No | Expiration duration for access tokens. |
| `JWT_REFRESH_EXPIRES_IN`| String (zeit/ms format)| `7d` | No | Expiration duration for refresh tokens. |
| `COOKIE_SECRET` | String (min 32 chars) | *(None)* | **Yes** | Secret used to sign and verify httpOnly session cookies. |
| `COOKIE_SAMESITE` | `lax` \| `strict` \| `none` | `lax` (default) | No | `SameSite` attribute for the refresh token cookie. Set to `none` if frontend and backend reside on different domains with HTTPS. |
| `COOKIE_DOMAIN` | String | *(Optional)* | No | Explicit domain scope for cookies (e.g., `.yourdomain.com`). |
| `CLIENT_URL` | String (URL list) | `http://localhost:5173` | No | Comma-separated allowed frontend origins for CORS and redirect validations. |
| `CORS_ORIGIN` | String (URL) | `http://localhost:5173` | No | Primary frontend origin matching Vite client. |
| `RATE_LIMIT_WINDOW_MS` | Number (milliseconds) | `900000` (15m) | No | Sliding window duration for Express API rate limiting. |
| `RATE_LIMIT_MAX` | Number | `100` | No | Maximum requests per IP address within the rate-limiting window. |
| `GOOGLE_CLIENT_ID` | String | `mock_google_client_id...` | No | Google OAuth 2.0 Web Client ID for enterprise SSO. |
| `GOOGLE_CLIENT_SECRET` | String | `mock_google_client_secret`| No | Google OAuth 2.0 Client Secret. Never commit. |
| `GOOGLE_CALLBACK_URL` | String (URL) | `http://localhost:5000/api/v1/auth/google/callback` | No | OAuth redirect callback URI registered with Google Cloud Console. |
| `SMTP_HOST` | String | `smtp.ethereal.email` | No | SMTP relay server hostname for transactional notification emails. |
| `SMTP_PORT` | Number | `587` | No | SMTP port (typically `587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | String | *(Optional)* | No | SMTP authentication username. |
| `SMTP_PASS` | String | *(Optional)* | No | SMTP authentication password. Never commit. |
| `SMTP_FROM` | String | `AssetVault <notifications@assetvault.io>` | No | Default `From` email header address. |
| `SMTP_SECURE` | Boolean | `false` | No | If `true`, connects via SSL/TLS on port 465; if `false`, upgrades via STARTTLS. |
| `METRICS_BEARER_TOKEN` | String | `assetvault-metrics-token-2026` | No (Prod Yes) | Bearer authentication token required to access protected `/metrics` Prometheus endpoint. |
| `ENABLE_IN_PROCESS_WORKER`| Boolean | `false` | No | Authoritative flag for in-process background cron jobs (defaults to `false`). Set `true` on single-container deployments (Render); set `false` on multi-container deployments where a dedicated worker exists. |
| `RUN_WORKER_IN_API` | Boolean | *(Optional)* | No | Backwards-compatible fallback alias for `ENABLE_IN_PROCESS_WORKER`. |

### B. Database Seeding Configuration (`backend/prisma/seed.ts`)

| Variable Name | Default Value | Required? | Purpose |
|---|---|---|---|
| `SUPER_ADMIN_EMAIL` | `superadmin@assetvault.io` | No | Initial Super Admin login email created during first seed run. |
| `SUPER_ADMIN_PASSWORD`| `Password123!` | No | Initial password for the Super Admin user. Must be rotated immediately. |
| `SUPER_ADMIN_NAME` | `Global Super Administrator` | No | Display full name of the initial Super Admin account. |
| `SEED_DEMO` | `true` | No | Set to `false` in production to omit demo tenants and sample data. |

### C. CI/CD & Automation GitHub Secrets

| Secret Name | Workflow | Required? | Purpose |
|---|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | `deploy.yml` | Optional | Webhook URL triggered to initiate Render web service re-deployment. |
| `RENDER_API_URL` | `deploy.yml`, `keepalive.yml` | Optional | Base URL for post-deployment health verification and keepalive pings. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | `db-backup.yml` | Optional | Passphrase used with OpenSSL AES-256-CBC to encrypt nightly cloud database dumps before artifact upload. |

---

## 6. First Login & Verification

1. Open your Vercel deployment URL (e.g. `https://assetvault.vercel.app`).
2. Navigate to `/login`.
3. Log in with:
   - **Email**: The value set in `SUPER_ADMIN_EMAIL`
   - **Password**: The value set in `SUPER_ADMIN_PASSWORD`
4. Access the **Super Admin Console** to create organizations, assign plans, and invite Tenant Administrators.
5. In your profile settings, immediately change the Super Admin password.

---

## 7. Production Smoke Test Checklist

Execute these checks after every production deployment:

- [ ] **Health Endpoint**: `curl -I https://assetvault-api.onrender.com/api/health` returns HTTP 200 OK.
- [ ] **Database Readiness**: `curl https://assetvault-api.onrender.com/api/ready` returns `status: "ready"` and database latency < 50ms.
- [ ] **Protected Metrics**: `curl -H "Authorization: Bearer <METRICS_BEARER_TOKEN>" https://assetvault-api.onrender.com/metrics` returns Prometheus metrics.
- [ ] **CORS Verification**: Requests with `Origin: https://assetvault.vercel.app` return `Access-Control-Allow-Origin`.
- [ ] **Authentication Flow**: Login returns access token in response body and sets httpOnly `refreshToken` cookie.
- [ ] **SSE Stream**: Navigating into the dashboard establishes `/api/notifications/stream` connection.
- [ ] **License Allocation**: Allocating a user seat succeeds and decrements available seats in `v_license_utilization`.
- [ ] **Document Export**: PDF dossier and CSV audit log downloads succeed.
- [ ] **Keepalive Cron**: GitHub Actions keepalive ping runs every 10 minutes to eliminate Render cold start delays.

---

## 8. Rollback Procedures

### API Rollback (Render)
1. Go to **Dashboard** -> **assetvault-api** -> **Deploys**.
2. Select the previous stable deployment.
3. Click **Rollback to this deploy**.

### Frontend Rollback (Vercel)
1. Go to **Project** -> **Deployments**.
2. Locate the previous working production deployment.
3. Click the three dots (`...`) -> **Promote to Production**.

### Database Schema Rollback
If a migration caused issues:
1. Restore the most recent backup taken prior to migration using `database/backup/restore.sh`:
   ```bash
   ./database/backup/restore.sh backups/assetvault_cloud_YYYYMMDD_HHMMSS.dump
   ```
2. Verify table integrity with `./database/backup/verify-restore.sh`.
