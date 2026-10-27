# AssetVault: Advanced Database Objects Verification & Test Results

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**Database System:** PostgreSQL 16 (Engine: PostgreSQL 18.6 on Port 5433)  
**Verification Date:** Fall Term 2026  
**Scope:** Verification of Analytical Views, Stored Procedures, Functions, Database Triggers, Row-Level Security, and Constraint Enforcement.

---

## 1. Row-Level Security (RLS) Test Results

Test script executed: `/database/sql/rls-tests.sql` under the unprivileged role `assetvault_app`.

### Test 1: Tenant A (TechCorp Dynamics) Data Isolation
- **Context Configured:** `app.current_tenant_id = '449a7330-4bbb-49df-8e64-b401dbeeb4f4'`, `app.is_super_admin = 'false'`.
- **Query:** `SELECT COUNT(*) AS total_visible_assets, COUNT(*) FILTER (WHERE tenant_id = '449a...') AS tenant_a_assets, COUNT(*) FILTER (WHERE tenant_id <> '449a...') AS leaked_other_tenant_assets FROM assets;`
- **Output:**
  ```text
            test_name          | total_visible_assets | tenant_a_assets | leaked_other_tenant_assets 
  -----------------------------+----------------------+-----------------+----------------------------
   TEST 1 - TechCorp Isolation |                   40 |              40 |                          0
  ```
- **Result:** **PASSED**. TechCorp sees strictly its 40 assets and 0 rows from other tenants.

---

### Test 2: Tenant B (InnovateLabs Inc) Data Isolation
- **Context Configured:** `app.current_tenant_id = '10a93f36-17e4-4d43-a775-9c479283e303'`, `app.is_super_admin = 'false'`.
- **Query:** `SELECT COUNT(*) AS total_visible_assets, COUNT(*) FILTER (WHERE tenant_id = '10a9...') AS tenant_b_assets, COUNT(*) FILTER (WHERE tenant_id <> '10a9...') AS leaked_other_tenant_assets FROM assets;`
- **Output:**
  ```text
              test_name            | total_visible_assets | tenant_b_assets | leaked_other_tenant_assets 
  ---------------------------------+----------------------+-----------------+----------------------------
   TEST 2 - InnovateLabs Isolation |                   40 |              40 |                          0
  ```
- **Result:** **PASSED**. InnovateLabs sees strictly its 40 assets and 0 rows from other tenants.

---

### Test 3: Block Cross-Tenant Write Injection
- **Context Configured:** Session set to TechCorp (`449a...`). Attempted to insert an asset record stamped with InnovateLabs (`10a9...`).
- **PostgreSQL Exception:**
  ```text
  NOTICE: TEST 3 PASSED: Operation blocked with error: Tenant 10a93f36-17e4-4d43-a775-9c479283e303 does not exist (SQLSTATE: 23503)
  ```
- **Result:** **PASSED**. Blocked at RLS boundary; cross-tenant tenant reference was invisible to TechCorp session.

---

### Test 4: Platform Super Administrator Global Bypass
- **Context Configured:** `app.current_tenant_id = ''`, `app.is_super_admin = 'true'`.
- **Query:** `SELECT COUNT(*) AS total_platform_assets, COUNT(DISTINCT tenant_id) AS distinct_tenants_represented FROM assets;`
- **Output:**
  ```text
                 test_name                | total_platform_assets | distinct_tenants_represented 
  ----------------------------------------+-----------------------+------------------------------
   TEST 4 - Super Admin Global Visibility |                   120 |                            3
  ```
- **Result:** **PASSED**. Super Administrator accesses all 120 assets across all 3 active tenant organizations.

---

## 2. Stored Procedures Verification

### 1. `sp_allocate_license_seat(p_license_id, p_user_id, p_allocated_by)`
- **Behavior Verified:** Row-level locking (`SELECT ... FOR UPDATE`), tenant alignment check, capacity verification, and audit trail generation.
- **Execution Log from Seeder:**
  ```text
  ✓ Seat allocated: User techcorp.mgr1@techcorp.io -> License Figma Cloud Inc (techcorp) Agreement #3 via sp_allocate_license_seat
  ✓ Seat allocated: User techcorp.mgr2@techcorp.io -> License Figma Cloud Inc (techcorp) Agreement #3 via sp_allocate_license_seat
  ✓ Seat allocated: User techcorp.dev1@techcorp.io -> License Figma Cloud Inc (techcorp) Agreement #3 via sp_allocate_license_seat
  ```
- **Violation Behavior (Seat Exhaustion):**
  - **SQL Attempt:** Called procedure when used seats equaled total seats (1).
  - **Exact Error Output:**
    ```text
    ERROR:  License seats exhausted
    CONTEXT:  PL/pgSQL function sp_allocate_license_seat(uuid,uuid,uuid,uuid) line 69 at RAISE
    SQLSTATE: 23514 (check_violation)
    ```
- **Result:** **PASSED**. Race condition and over-allocation prevented.

---

### 2. `sp_release_license_seat(p_allocation_id, p_revoked_by, p_reason)`
- **Behavior Verified:** Row-level lock on allocation, transitions status from `ACTIVE` to `REVOKED`, sets `released_at = NOW()`, and records diff in `audit_logs`.
- **Result:** **PASSED**.

---

### 3. `sp_renew_license(p_license_id, p_new_end_date, p_cost, p_performed_by, p_notes)`
- **Behavior Verified:** Row-level lock on license, verifies caller permissions, inserts ledger entry into `license_renewals`, updates `licenses.end_date` and resets status to `ACTIVE`, and records an audit log entry.
- **Result:** **PASSED**.

---

## 3. Analytical Functions & Procedures Verification

### 1. `fn_generate_expiry_notifications(p_tenant_id, p_lookahead_days)`
- **Execution Log:**
  ```text
  ✓ Generated 18 expiry notification alerts for TechCorp Dynamics
  ✓ Generated 18 expiry notification alerts for InnovateLabs Inc
  ✓ Generated 18 expiry notification alerts for CreativeStudio Visuals
  ```
- **Result:** **PASSED**. Scanned expiring licenses within 30 days and notified `TENANT_ADMIN` and `ASSET_MANAGER` roles.

---

### 2. `fn_tenant_dashboard_stats(p_tenant_id)`
- **Execution Query:** `SELECT fn_tenant_dashboard_stats('449a7330-4bbb-49df-8e64-b401dbeeb4f4'::uuid);`
- **Output:**
  ```json
  {
    "tenant_id": "449a7330-4bbb-49df-8e64-b401dbeeb4f4",
    "total_seats": 55,
    "total_assets": 40,
    "total_licenses": 10,
    "allocated_seats": 3,
    "monthly_plan_price": 199.00,
    "storage_used_bytes": 631242752,
    "total_license_cost": 19250.00,
    "expiring_in_30_days": 6
  }
  ```
- **Result:** **PASSED**. Real-time KPI aggregation in structured JSONB.

---

### 3. `fn_asset_license_compliance(p_asset_id)`
- **Execution Output:**
  ```text
                license_id              |                  license_name                  |            vendor_name            | status  | is_valid |              message               
  --------------------------------------+------------------------------------------------+-----------------------------------+---------+----------+------------------------------------
   5947c5d1-eb40-48d4-b6db-688d43b6c9c5 | Adobe Creative Systems (techcorp) Agreement #1 | Adobe Creative Systems (techcorp) | EXPIRED | f        | Covering license status is EXPIRED
  ```
- **Result:** **PASSED**. Accurately flags expired covering licenses.

---

## 4. Trigger & Database Integrity Constraint Tests

### Test 1: Seat Capacity Protection Trigger (`trg_check_seat_availability`)
- **Intentional Violation:** Direct INSERT into `license_allocations` when active seats equal `total_seats`.
- **Exact Error Message:**
  ```text
  ERROR:  License seats exhausted
  CONTEXT:  PL/pgSQL function fn_check_seat_availability() line 22 at RAISE
  SQLSTATE: 23514 (check_violation)
  ```
- **Result:** **PASSED**. Defense-in-depth trigger blocks over-allocation even if stored procedure is bypassed.

---

### Test 2: Cross-Tenant Asset-License Boundary Trigger (`trg_enforce_asset_license_tenant`)
- **Intentional Violation:** Attempted to link TechCorp asset to InnovateLabs license in `asset_licenses`.
- **Exact Error Message:**
  ```text
  ERROR:  Cross-tenant violation: Asset tenant 449a7330-4bbb-49df-8e64-b401dbeeb4f4 does not match License tenant 10a93f36-17e4-4d43-a775-9c479283e303
  CONTEXT:  PL/pgSQL function fn_enforce_asset_license_tenant() line 10 at RAISE
  SQLSTATE: 23514 (check_violation)
  ```
- **Result:** **PASSED**. Enforces strict tenant containment across M:N resolver tables.

---

### Test 3: Audit Log Immutability Trigger (`trg_audit_immutable`)
- **Intentional Violation:** Attempted UPDATE on `audit_logs` record.
- **Exact Error Message:**
  ```text
  ERROR:  audit_logs is append-only
  CONTEXT:  PL/pgSQL function fn_audit_immutable() line 3 at RAISE
  SQLSTATE: 25000 (invalid_transaction_state)
  ```
- **Result:** **PASSED**. Ledger records are strictly tamper-evident and append-only.

---

### Test 4: Password Hash Stripping Trigger (`trg_audit_users`)
- **Verification Query:**
  ```sql
  SELECT table_name, action, (new_data ? 'password_hash') AS contains_password_hash 
  FROM audit_logs 
  WHERE table_name = 'users' LIMIT 1;
  ```
- **Output:**
  ```text
   table_name | action | contains_password_hash 
  ------------+--------+------------------------
   users      | INSERT | f
  ```
- **Result:** **PASSED**. `password_hash` is completely stripped from logged JSONB data payloads.

---

### Test 5: User Role Tenancy Domain Trigger (`trg_user_role_tenant_rule`)
- **Intentional Violation:** Attempted to insert a user with role `SUPER_ADMIN` having a non-null `tenant_id`.
- **Exact Error Message:**
  ```text
  ERROR:  SUPER_ADMIN user cannot be assigned to a specific tenant
  CONTEXT:  PL/pgSQL function fn_user_role_tenant_rule() line 9 at RAISE
  SQLSTATE: 23514 (check_violation)
  ```
- **Result:** **PASSED**. Platform administrators remain unattached to individual tenant tenants.

---

### Test 6: Subscription Plan Quota Limit Trigger (`trg_plan_user_limit`)
- **Intentional Violation:** Attempted to insert an 11th user into CreativeStudio on the Free Trial tier (max 10 users).
- **Exact Error Message:**
  ```text
  ERROR:  Tenant user limit of 10 exceeded for current subscription plan
  CONTEXT:  PL/pgSQL function fn_plan_user_limit() line 22 at RAISE
  SQLSTATE: 23514 (check_violation)
  ```
- **Result:** **PASSED**. Tier quotas enforced directly at PostgreSQL database level.

---

## 5. Analytical Views Verification

| View | Purpose | Verified Row Count / Status |
| :--- | :--- | :--- |
| `v_license_utilization` | Real-time seat consumption and days to expiry | **30 rows** across 3 tenants |
| `v_expiring_licenses` | Contracts terminating in <=30 days categorized by urgency | **18 rows** (CRITICAL, WARNING, NOTICE) |
| `v_asset_catalog` | Taxonomic category, owner, version, tags, compliance status | **120 rows** (COMPLIANT, UNLICENSED, EXPIRED) |
| `v_vendor_spend` | Initial cost, renewal cost, average cost per seat | **12 vendors** aggregated |
| `v_tenant_summary` | Platform-wide administrative overview for Super Admin | **3 tenant organizations** |
| `mv_monthly_access_stats` | Materialized view pre-aggregating access actions | Refreshed via `fn_refresh_monthly_access_stats()` |
