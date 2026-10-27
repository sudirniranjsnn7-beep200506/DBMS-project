# AssetVault: Multi-Tenant Digital Asset & License Management System

[![CI Pipeline](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions)
[![Docker Build & Publish](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions)
[![Continuous Deployment](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions/workflows/deploy.yml/badge.svg)](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![ORM: Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![Backend: Express TypeScript](https://img.shields.io/badge/Backend-Node.js%2020%20+%20Express-68A063?logo=node.js)](https://nodejs.org/)
[![Frontend: React 18](https://img.shields.io/badge/Frontend-React%2018%20+%20Vite-61DAFB?logo=react)](https://react.dev/)
[![License: Academic (VIT)](https://img.shields.io/badge/License-Academic%20(VIT)-blue.svg)](#)

---

## Academic & Course Metadata
* **Course:** BCSE307L — Database Systems (Fall 2026-27)
* **Institution:** Department of Computer Applications, Vellore Institute of Technology (VIT), Vellore
* **Author / Developer:** Karthikeyan S (Registration No. 24BCT0332)
* **Project Title:** AssetVault — Enterprise Multi-Tenant Digital Asset & License Management System

---

## 1. Live Deployment Endpoints

The project is continuously deployed to production cloud environments via automated GitHub Actions CI/CD:

* **Production Frontend (Vercel):** [https://multi-tenant-digital-asset-license.vercel.app](https://multi-tenant-digital-asset-license.vercel.app)
* **Production REST API (Render):** [https://assetvault-api.onrender.com](https://assetvault-api.onrender.com)
* **Interactive OpenAPI Swagger Documentation:** [https://assetvault-api.onrender.com/api/docs](https://assetvault-api.onrender.com/api/docs)
* **Live Service Health Probe:** [https://assetvault-api.onrender.com/api/health](https://assetvault-api.onrender.com/api/health)
* **Database Readiness Probe:** [https://assetvault-api.onrender.com/api/ready](https://assetvault-api.onrender.com/api/ready)

---

## 2. Problem Statement & Project Overview

### The Enterprise Challenge
Modern digital organizations face massive operational liabilities and compliance risks resulting from unmanaged digital assets and software licenses:
1. **Uncontrolled Asset Sprawl:** High-value corporate assets (brand collateral, proprietary fonts, software binaries, architectural diagrams, models, and datasets) are distributed across fragmented storage silos with no centralized versioning, audit trail, or ownership governance.
2. **License Over-Allocation & Non-Compliance Penalties:** Companies routinely purchase software licenses without atomic seat allocation mechanisms. This leads to contractual over-allocation (triggering severe financial audit penalties from software vendors) or unmonitored license expiration causing immediate business disruption.
3. **Under-Utilization & Cloud Waste:** Dormant license seats assigned to inactive employees remain unassigned for months, inflating SaaS expenditure by up to 30%.
4. **Data Isolation Vulnerabilities in Multi-Tenant Architectures:** Traditional SaaS applications frequently rely on application-level filtering (`WHERE tenant_id = x`), leaving data vulnerable to critical cross-tenant data leaks whenever developers omit a `WHERE` clause.

### The AssetVault Solution
**AssetVault** is an enterprise-grade multi-tenant SaaS platform that unifies digital asset management, software license tracking, seat allocations, compliance scoring, and automated renewal workflows into a single high-performance platform.

Engineered strictly in accordance with **Third Normal Form (3NF) and Boyce-Codd Normal Form (BCNF)** relational principles, AssetVault guarantees **absolute tenant isolation at the database kernel level** using PostgreSQL 16 **Row-Level Security (RLS)**, transaction-scoped session configuration contexts (`SET LOCAL app.current_tenant_id`), ACID-compliant stored procedures for concurrent seat reservation, and an immutable audit ledger enforced by database triggers.

---

## 3. Technology Stack

AssetVault is built on a clean, decoupled monorepo architecture leveraging modern, production-grade technologies:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ASSETVAULT MONOREPO                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  Frontend Client Application         │  Backend RESTful API & Workers       │
│  - React 18 (Functional Components)  │  - Node.js 20 LTS & Express.js       │
│  - Vite 6 (Fast Bundler & HMR)       │  - TypeScript (Strict Static Types)  │
│  - TypeScript & Tailwind CSS         │  - Prisma ORM 5 (Data Access Layer)  │
│  - TanStack Query v5 (Data Fetching) │  - Zod (Runtime Schema Validation)   │
│  - Recharts & Lucide React           │  - Nodemailer & PDFKit               │
├──────────────────────────────────────┴──────────────────────────────────────┤
│  Database, Security & Infrastructure Layer                                  │
│  - PostgreSQL 16 (Relational Engine, 3NF/BCNF Schema, PL/pgSQL)             │
│  - Row-Level Security (RLS) Policies & Database-Enforced Append-Only Ledger │
│  - Docker & Docker Compose (Multi-Stage Alpine Linux Containers)            │
│  - GitHub Actions CI/CD (17-Stage Validation Pipeline, Trivy CVE Scanning)  │
│  - Native Database Backup & Disaster Recovery (pg_dump, SHA-256, 7-Day)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Version / Spec | Architecture Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend** | **React** + **Vite** | React 18, Vite 6 | High-speed single-page application (SPA) with optimistic UI updates, responsive Tailwind design tokens, and modular components. |
| **Backend API** | **Express.js** | Node.js 20, Express 4.19 | RESTful API in TypeScript with layered Clean Architecture (Controllers, Services, Repositories), Zod input validation, and JWT authentication. |
| **Database** | **PostgreSQL** | PostgreSQL 16 / 18 | Fully ACID-compliant relational database with PL/pgSQL stored procedures, triggers, materialized views, and `pg_trgm` GIN indexes. |
| **ORM** | **Prisma ORM** | Prisma 5.14 / 5.22 | Type-safe query builder, declarative migration engine, and interactive transactions integrating kernel-level RLS session context. |
| **Deployment** | **Vercel** + **Render** | Cloud Native | Static frontend hosted on Vercel with edge rewrites; containerized backend hosted on Render with automatic health probes. |
| **Containers** | **Docker** | Multi-Stage Alpine | Production containerization (<185 MB API image, <48 MB Web image) with non-root security execution. |

---

## 4. Key Functional Capabilities

* **Rigid Multi-Tenancy via PostgreSQL Row-Level Security (RLS):** True pooled-schema multi-tenancy. Every request sets `app.current_tenant_id` inside an isolated transaction. PostgreSQL drops any row not belonging to the authenticated tenant.
* **Hierarchical Role-Based Access Control (RBAC):** Four pre-configured operational tiers:
  * `SUPER_ADMIN`: Global platform governance, tenant lifecycle, and plan quota management.
  * `TENANT_ADMIN`: Organization-level user provisioning, audit inspection, compliance scoring, and exports.
  * `ASSET_MANAGER`: Asset catalog administration, version control, contract provisioning, and seat allocations.
  * `MEMBER`: Catalog discovery, governed file downloads, and self-service seat checkout.
* **Atomic Seat Allocation with Concurrency Safety:** Stored procedure `sp_allocate_license_seat` utilizes PostgreSQL row locking (`SELECT ... FOR UPDATE`) to guarantee that seat allocations never exceed contractual capacity even under heavy concurrent requests.
* **Append-Only Immutable Compliance Ledger:** Changes to assets, licenses, and users trigger automated audit records (`trg_audit_logs_append_only`). Database triggers physically prevent any `UPDATE` or `DELETE` on the `audit_logs` table (SQLSTATE `28000`).
* **Automated Expiry & Background Workers:** A scheduled worker runs hourly using distributed advisory locks (`pg_try_advisory_lock`), auto-renewing eligible contracts (`sp_renew_license`) and generating expiry notifications (`fn_generate_expiry_notifications`).
* **Cost Optimization & Dormant Seat Reclamation:** Analytical queries detect seats allocated to users who have been inactive for over 30 days, providing one-click reclamation to eliminate unnecessary software expense.
* **Global Fuzzy Search (`Ctrl+K`):** Spotlight command palette executing multi-attribute trigram matching powered by PostgreSQL `pg_trgm` and GIN indexing.

---

## 5. Step-by-Step Local Installation and Execution Guide

Follow these steps to run the complete stack locally on your workstation.

### Prerequisites
* **Node.js:** v20.0.0 or higher ([Download Node.js](https://nodejs.org/))
* **npm:** v10.0.0 or higher
* **PostgreSQL:** v16 or v18 installed locally ([Download PostgreSQL](https://www.postgresql.org/download/)) or Docker Desktop
* **Git:** v2.30.0 or higher

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System.git assetvault
cd assetvault
```

---

### Step 2: Install Monorepo Dependencies
Install root, backend, and frontend dependencies via npm workspaces:
```bash
npm install
```

---

### Step 3: Configure Environment Variables
Copy the template configuration files into active `.env` files:
```bash
# On Linux / macOS
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# On Windows PowerShell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

#### Generate Secure Cryptographic Secrets
Generate 32-byte cryptographic hex tokens for JWT signing:
```bash
# On Linux / macOS
openssl rand -hex 32

# On Windows PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste the generated strings into `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` inside `.env` and `backend/.env`.

---

### Step 4: Initialize the PostgreSQL Database

Create the development database in PostgreSQL:
```sql
-- Connect via psql:
CREATE DATABASE assetvault_db;
```

Apply migrations and push the relational schema:
```bash
# Deploy Prisma migrations
npx prisma migrate deploy --schema backend/prisma/schema.prisma

# Apply custom database objects (Views, Procedures, Triggers, RLS Policies)
psql -h localhost -U postgres -d assetvault_db -f database/sql/01_views.sql
psql -h localhost -U postgres -d assetvault_db -f database/sql/02_functions_procedures.sql
psql -h localhost -U postgres -d assetvault_db -f database/sql/03_triggers.sql
psql -h localhost -U postgres -d assetvault_db -f database/sql/04_rls.sql
psql -h localhost -U postgres -d assetvault_db -f database/sql/08_production_bootstrap.sql
```

---

### Step 5: Seed Baseline Data
Seed initial subscription plans, enterprise tenants, roles, sample assets, licenses, and demo user accounts:
```bash
npm run db:seed
```

---

### Step 6: Launch Local Development Servers

Start both the backend API and frontend Vite server concurrently:
```bash
npm run dev
```

* **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)
* **Backend REST API:** [http://localhost:5000](http://localhost:5000)
* **Interactive Swagger Documentation:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
* **Health Check Endpoint:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Step 7: (Alternative) Run via Docker Compose
To run the full stack (API, Web, PostgreSQL 16, pgAdmin) via containerization:
```bash
# Build and run containers in background
docker compose up --build -d

# Check service status
docker compose ps
```
* **Frontend SPA (Nginx):** [http://localhost:8080](http://localhost:8080)
* **Backend API:** [http://localhost:5000](http://localhost:5000)
* **pgAdmin Database Client:** [http://localhost:5050](http://localhost:5050) *(User: `admin@assetvault.com`, Password: `adminpassword`)*

---

### Step 8: Execute Test & Verification Suites
```bash
# 1. Static type checking & linting across monorepo
npm run lint

# 2. Security gates (SQL injection and secret scans)
npm run check:sqli
npm run check:secrets

# 3. Backend unit & integration test suite (255+ tests under non-superuser RLS)
npm test

# 4. Frontend unit test suite (116 tests)
npm --prefix frontend test

# 5. Playwright End-to-End browser test suite
npm run test:e2e
```

---

## 6. Seeded Demo Accounts for Assessment

Use these pre-seeded credentials to evaluate the application across different RBAC permissions:

| Email Address | Password | Role | Organization Tenant | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `superadmin@assetvault.internal` | `Password123!` | `SUPER_ADMIN` | Global Platform | Cross-tenant metrics, manage subscription plans, suspend/activate tenants. |
| `techcorp.admin@techcorp.io` | `Password123!` | `TENANT_ADMIN` | TechCorp Dynamics | Manage team members, review audit ledger, view compliance score, export data. |
| `techcorp.mgr1@techcorp.io` | `Password123!` | `ASSET_MANAGER` | TechCorp Dynamics | Upload assets, manage versions, provision licenses, allocate and revoke seats. |
| `techcorp.member1@techcorp.io` | `Password123!` | `MEMBER` | TechCorp Dynamics | Browse asset catalog, download files, view assigned license seats. |
| `innovatelabs.admin@innovatelabs.com` | `Password123!` | `TENANT_ADMIN` | InnovateLabs Inc | Isolated second organization used to verify zero cross-tenant data leakage. |

---

## 7. Database Backup & Disaster Recovery (`database/backup/`)

AssetVault includes production-grade native backup and disaster recovery automation located in [`database/backup/`](database/backup/). These scripts satisfy strict academic evaluation criteria for database backup, checksum verification, retention rotation, and recovery drills.

### Script Inventory
* **[`database/backup/backup.sh`](database/backup/backup.sh)** / **[`database/backup/backup.ps1`](database/backup/backup.ps1)**:
  * Creates dual-format timestamped database backups:
    1. **Custom Compressed Binary Archive (`.dump` / `-Fc`)** for fast, flexible `pg_restore`.
    2. **Plain-Text SQL Archive (`.sql` / `-Fp`)** for human-readable auditability and portability.
  * Computes cryptographic **SHA-256 integrity checksums** (`.sha256`) saved alongside every backup.
  * Automatically enforces a **7-day retention policy**, safely pruning expired archives while preserving recent restore points.
* **[`database/backup/restore.sh`](database/backup/restore.sh)** / **[`database/backup/restore.ps1`](database/backup/restore.ps1)**:
  * Verifies the archive's SHA-256 checksum before initiating any restore operation to detect corruption or tampering.
  * Provides non-destructive restoration into an isolated scratch database (`assetvault_restore_test`) using `--scratch` or live restoration using `-y`.
* **[`database/backup/verify-restore.sh`](database/backup/verify-restore.sh)** / **[`database/backup/verify-restore.ps1`](database/backup/verify-restore.ps1)**:
  * Executes an automated disaster recovery drill.
  * Restores the latest backup into a temporary verification database, queries all 19 domain tables, and performs a row-by-row count comparison against the live primary database.
  * Outputs a side-by-side **Parity Audit Table** confirming 100% data fidelity.

### How to Run Backup & Recovery Commands

#### Via Monorepo npm Scripts:
```bash
# Execute native backup with SHA-256 and retention rotation
npm run db:backup

# Execute complete restore verification drill and row parity audit
npm run db:verify-restore

# Restore the latest backup into the database
npm run db:restore -- -y
```

#### Via Direct Shell Scripts (Linux / macOS):
```bash
# Create a backup
./database/backup/backup.sh

# Run restore verification drill
./database/backup/verify-restore.sh

# Restore from a specific backup file
./database/backup/restore.sh backups/assetvault_db_backup_latest.dump -y
```

#### Via Direct PowerShell Scripts (Windows):
```powershell
# Create a backup
.\database\backup\backup.ps1

# Run restore verification drill
.\database\backup\verify-restore.ps1

# Restore from a specific backup file
.\database\backup\restore.ps1 -DumpFile backups\assetvault_db_backup_latest.dump -Confirm
```

#### Sample Verification Output:
```text
================================================================================
 AssetVault: Database Restore Verification Drill & Parity Audit
================================================================================
[STEP 1/3] Restoring backup archive into scratch database 'assetvault_restore_test'...
[STEP 2/3] Performing 19-table row count parity comparison...
--------------------------------------------------------------------------------
 TABLE NAME                LIVE COUNT      RESTORED COUNT   STATUS
--------------------------------------------------------------------------------
 plans                     3               3                PARITY MATCH (OK)
 tenants                   2               2                PARITY MATCH (OK)
 roles                     4               4                PARITY MATCH (OK)
 users                     6               6                PARITY MATCH (OK)
 assets                    8               8                PARITY MATCH (OK)
 asset_versions            12              12               PARITY MATCH (OK)
 licenses                  6               6                PARITY MATCH (OK)
 license_allocations       4               4                PARITY MATCH (OK)
 audit_logs                28              28               PARITY MATCH (OK)
 ...                       ...             ...              ...
--------------------------------------------------------------------------------
[STEP 3/3] Dropping scratch verification database...
✅ DISASTER RECOVERY DRILL PASSED: 19/19 tables matched with zero data loss.
```

---

## 8. Relational Schema & Database Design Inventory

The database is normalized to **3NF / BCNF** with zero transitive dependencies and atomic domain attributes:

* **19 Relational Base Tables:** `tenants`, `plans`, `users`, `roles`, `refresh_tokens`, `categories`, `tags`, `vendors`, `assets`, `asset_versions`, `asset_tags`, `license_types`, `licenses`, `asset_licenses`, `license_allocations`, `license_renewals`, `asset_access_logs`, `audit_logs`, `notifications`.
* **8 Database Views & Materialized Views:**
  * `v_asset_catalog`: Denormalized asset view joining category, vendor, version count, and active license coverage.
  * `v_license_utilization`: Real-time seat allocation math, calculating allocated seats, available seats, and utilization percentage.
  * `v_expiring_licenses`: Filters licenses expiring within the next 30 days for proactive renewal alerts.
  * `v_vendor_spend` & `v_monthly_spend`: Cost aggregation views grouping expenditure across vendors and fiscal periods.
  * `v_top_downloaded_assets` & `v_tenant_summary`: Asset frequency analytics and tenant metric rollups.
  * `mv_monthly_access_stats`: Materialized view aggregating historical download volumes with concurrent refresh capability (`fn_refresh_access_stats`).
* **5 ACID Stored Procedures:**
  * `sp_allocate_license_seat`: Atomically allocates a license seat using row locking (`FOR UPDATE`) to prevent race conditions.
  * `sp_release_license_seat`: Atomically releases an allocated seat and logs transaction telemetry.
  * `sp_renew_license`: Extends license tenure, increments version/term counters, and records renewal history.
  * `sp_soft_delete_asset` & `sp_restore_asset`: Manages soft-deletion workflows without breaking relational foreign keys.
* **8 PL/pgSQL Functions:**
  * `fn_generate_expiry_notifications`: Scans expiring licenses and writes tenant notification rows.
  * `fn_tenant_dashboard_stats`: Aggregates top-level KPI metrics for executive dashboards.
  * `fn_audit_trail_logger`: Automatically generates detailed JSON diffs of modified records.
  * `fn_enforce_audit_append_only`: Rejects any `UPDATE` or `DELETE` attempt on audit logs.
  * `fn_enforce_license_seat_cap`: Guarantees allocations do not exceed `licenses.total_seats`.
  * `fn_enforce_plan_asset_limit`: Validates tenant asset creation counts against plan quotas (`plans.max_assets`).
  * `fn_check_category_cycle`: Prevents recursive circular references in hierarchical category trees.
  * `fn_refresh_monthly_access_stats`: Security-definer procedure to refresh materialized view data.
* **7 Row-Level Triggers:** Enforce append-only immutability, quota limits, cycle checks, and auto-updating timestamps.

---

## 9. Comprehensive Documentation Index

All technical reports, academic evaluation deliverables, and verification evidence are available in the repository:

* **Executive Project Proposal:** [`docs/PROJECT_PROPOSAL.md`](docs/PROJECT_PROPOSAL.md)
* **Comprehensive Final Report (15 Sections):** [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md)
* **Course Brief & Rubric Audit (100% Pass Matrix):** [`docs/FINAL_AUDIT.md`](docs/FINAL_AUDIT.md)
* **Entity-Relationship (ER) Diagram:** [`database/er-diagram.md`](database/er-diagram.md) | Vector: [`database/er-diagram.svg`](database/er-diagram.svg)
* **Data Dictionary & Column Specifications:** [`database/data-dictionary.md`](database/data-dictionary.md)
* **Relational Schema Specification:** [`database/relational-schema.md`](database/relational-schema.md)
* **Database Normalization & BCNF Proofs:** [`database/normalization.md`](database/normalization.md)
* **Transactions & Concurrency Control:** [`docs/transactions.md`](docs/transactions.md)
* **Adversarial Security Penetration Report (22/22 Passing):** [`docs/security-test-report.md`](docs/security-test-report.md)
* **Backup & Disaster Recovery Drill Evidence:** [`docs/backup-recovery.md`](docs/backup-recovery.md)
* **Role-Based Access Control (RBAC) Matrix:** [`docs/rbac-matrix.md`](docs/rbac-matrix.md)
* **Docker Multi-Stage Build & Hardening:** [`docs/docker.md`](docs/docker.md)
* **Production Deployment & Cloud Setup:** [`docs/deployment.md`](docs/deployment.md)
* **Viva Voce Presentation & Demo Script:** [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
* **40 Technical Viva Questions & Model Answers:** [`docs/VIVA_QA.md`](docs/VIVA_QA.md)

---

## 10. Repository Directory Structure

```text
.
├── backend/                             # Express.js & TypeScript Backend API
│   ├── prisma/                          # Prisma schema, migrations, and seed script
│   ├── src/
│   │   ├── config/                      # Database pool, Prisma client, and environment config
│   │   ├── controllers/                 # Express REST request handlers
│   │   ├── middleware/                  # RLS tenant context, JWT auth, and RBAC guards
│   │   ├── repositories/                # Database query abstractions
│   │   ├── routes/                      # API endpoint definitions
│   │   ├── services/                    # Domain business logic & compliance engines
│   │   ├── utils/                       # Security, password hashing, and token helpers
│   │   ├── worker.ts                    # Cron background scheduler process
│   │   └── server.ts                    # Primary application entrypoint
│   ├── Dockerfile                       # Multi-stage optimized production image (<185 MB)
│   └── vitest.config.ts                 # Backend test configuration
├── frontend/                            # React 18 + Vite 6 Frontend Application
│   ├── src/
│   │   ├── components/                  # UI components, layout shell, and modals
│   │   ├── context/                     # AuthContext, ThemeContext, ToastContext
│   │   ├── pages/                       # Dashboard, Assets, Licenses, Users, and Reports
│   │   └── services/api.ts              # Axios HTTP client with auto-refresh queue
│   ├── nginx.conf                       # Production Nginx SPA routing & reverse proxy
│   ├── vercel.json                      # Vercel deployment rewrites & security headers
│   └── Dockerfile                       # Multi-stage Nginx Alpine container (<48 MB)
├── database/
│   ├── backup/                          # Native backup, restore, and verify-restore scripts
│   │   ├── backup.sh / backup.ps1       # Dual -Fc and -Fp backup with SHA-256 and retention
│   │   ├── restore.sh / restore.ps1     # Verified checksum restoration into live or scratch DB
│   │   └── verify-restore.sh / .ps1     # 19-table row count parity drill
│   ├── sql/                             # Custom views, functions, triggers, and bootstrap SQL
│   ├── er-diagram.md                    # Mermaid ER diagram
│   └── data-dictionary.md               # Detailed field-by-field data dictionary
├── docs/                                # Technical project reports, viva prep, and evidence
│   ├── FINAL_AUDIT.md                   # Requirement-by-requirement course evaluation audit
│   ├── FINAL_REPORT.md                  # Comprehensive academic report
│   ├── DEMO_SCRIPT.md                   # 10-minute presentation cue cards
│   ├── VIVA_QA.md                       # 40 technical viva questions and answers
│   └── screenshots/                     # 16 High-resolution viewport captures
├── scripts/                             # Utility verification and CI security tools
├── .github/workflows/                   # Automated CI, Docker publish, and CD pipelines
├── docker-compose.yml                   # Full-stack container orchestration
├── docker-compose.prod.yml              # Production container overrides
├── package.json                         # Monorepo workspaces definition
└── README.md                            # Primary project documentation
```

---

## 11. Evaluation Rubric Compliance Checklist

| Rubric Component | Evaluation Standard | AssetVault Implementation Evidence |
| :--- | :--- | :--- |
| **Problem Formulation** | Clear, authentic real-world problem statement | Rigorous digital asset & SaaS license sprawl formulation in [Section 2](#2-problem-statement--project-overview). |
| **ER Modeling** | Normalized design ($\ge 4$ entities, $\ge 3$ relationships) | 19 domain tables, 34 foreign keys, complete Mermaid diagram in [`database/er-diagram.md`](database/er-diagram.md). |
| **Normalization** | Proof of 3NF / BCNF compliance | Zero transitive dependencies, functional dependency proofs in [`database/normalization.md`](database/normalization.md). |
| **Advanced SQL Objects** | Views, Stored Procedures, Triggers, RLS | 8 Views, 5 Stored Procedures, 8 Functions, 7 Triggers, and PostgreSQL Row-Level Security in [`database/sql/`](database/sql/). |
| **Data Integrity** | Primary, Foreign, Check, Unique, Not Null constraints | 19 PKs, 34 FKs, 11 CHECK constraints, 14 UNIQUE indexes, and 104 NOT NULL columns. |
| **Application Layer** | Full-stack working prototype with RBAC | React 18 + Vite frontend and Express backend with 4-tier RBAC (`SUPER_ADMIN` to `MEMBER`). |
| **Backup & Recovery** | Native backup and disaster recovery validation | Native scripts in [`database/backup/`](database/backup/) with SHA-256 verification and 19-table row parity audit. |
| **Testing & CI/CD** | Automated unit, security, and integration testing | 17-stage GitHub Actions CI pipeline running 255+ backend and 116+ frontend tests with non-superuser RLS. |
| **Cloud Deployment** | Live public production deployment | Vercel frontend ([Live URL](https://multi-tenant-digital-asset-license.vercel.app)) & Render API ([Live URL](https://assetvault-api.onrender.com)). |

---

## 12. License & Acknowledgements

* **Author:** Karthikeyan S (Department of Computer Applications, VIT Vellore)
* **Faculty Review:** Faculty of Database Systems (BCSE307L), School of Computer Science & Engineering, Vellore Institute of Technology
* **Academic License:** Distributed for academic evaluation, peer review, and educational assessment purposes under the Academic Evaluation License.
