# AssetVault Transaction Architecture & ACID Guarantees

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**System:** AssetVault Multi-Tenant Digital Asset & License Management System  
**Framework:** Prisma ORM with Interactive Transactions (`prisma.$transaction`) & PostgreSQL 16  

---

## 1. Architectural Overview

In a multi-tenant relational SaaS platform, operations spanning multiple entities must execute under strict **ACID** guarantees (Atomicity, Consistency, Isolation, Durability). AssetVault utilizes PostgreSQL read committed / repeatable read isolation through Prisma's interactive transaction interface (`prisma.$transaction(async (tx) => { ... })`).

Crucially, every interactive transaction also establishes the **PostgreSQL Session Tenancy Context** before executing business logic:
```sql
SELECT 
  set_config('app.current_tenant_id', $tenant_id, true),
  set_config('app.current_user_id', $user_id, true),
  set_config('app.is_super_admin', $is_super_admin, true);
```
Setting the third parameter to `true` scopes the session variables strictly to the current database transaction boundary, eliminating cross-request leakage across connections in the pool.

---

## 2. Documented Transactions

| # | Transaction Name | Primary Tables Touched | Stored Routines / Triggers Engaged | Isolation Level | Rollback Guarantee |
|---|------------------|------------------------|-----------------------------------|-----------------|--------------------|
| **TX-1** | Tenant Self-Registration | `tenants`, `users`, `audit_logs` | `trg_plan_limits` | Read Committed | Complete teardown of tenant & user on validation or email conflict |
| **TX-2** | Asset Version Increment | `asset_versions`, `assets`, `audit_logs` | `trg_plan_limits`, version constraints | Read Committed | Prevents phantom versions; atomicity between `is_current` flags |
| **TX-3** | Seat-Gated Asset Checkout | `assets`, `asset_access_logs`, `license_allocations`, `asset_licenses` | Active seat coverage verification | Read Committed | Rejects checkout and leaves asset available if seat missing |
| **TX-4** | Atomic Bulk CSV Import | `assets`, `asset_versions`, `asset_tags`, `audit_logs` | Unique constraints, `trg_plan_limits` | Read Committed | All-or-nothing: failure on row $N$ rolls back rows $1 \dots N-1$ |
| **TX-5** | User Role Change & Invalidation | `users`, `audit_logs`, `refresh_tokens` | Role existence, immutability check | Read Committed | Reverts role changes if token invalidation or audit write fails |
| **TX-6** | Tenant Suspension & Session Revocation | `tenants`, `refresh_tokens`, `audit_logs` | Cascade session triggers | Read Committed | Prevents suspended tenants from holding active JWT refresh tokens |

---

### Transaction 1: Tenant Self-Registration
- **Purpose:** Onboards a new organization onto the Free tier with its initial `TENANT_ADMIN` custodian and logs the provisioning event.
- **Tables Touched:**
  1. `tenants` (`INSERT`)
  2. `users` (`INSERT` with `role_id` for `TENANT_ADMIN`)
  3. `audit_logs` (`INSERT` recording tenant provisioning)
- **Isolation Level:** `Read Committed` (with unique index on `tenants.slug` and `users.email`).
- **Failure Modes Handled:**
  - Duplicate slug collision (`slug_unique`).
  - Pre-existing global user email (`users.email_unique`).
  - Password hashing or entropy failure.
  - Network disconnection or database crash mid-provisioning.
- **Rollback Guarantee:** If user creation or audit logging fails, the created tenant record is completely rolled back, leaving zero orphaned tenant or user records in PostgreSQL.

---

### Transaction 2: Asset Version Creation
- **Purpose:** Commits a new binary version of an existing digital asset, atomically adjusting current flags and tracking version delta.
- **Tables Touched:**
  1. `asset_versions` (`UPDATE is_current = false` for existing versions)
  2. `asset_versions` (`INSERT` new row with incremented `version_no` and `is_current = true`)
  3. `assets` (`UPDATE updated_at = NOW()`)
- **Isolation Level:** `Read Committed` (guarded by `@@unique([assetId, versionNo])`).
- **Failure Modes Handled:**
  - Concurrent version uploads for the same asset code.
  - Non-existent parent asset record.
  - Checksum or file size negative constraint violations.
- **Rollback Guarantee:** If the version insertion or timestamp touch fails, the previous version retains `is_current = true`, ensuring users never observe an asset with zero active versions.

---

### Transaction 3: Seat-Gated Asset Checkout
- **Purpose:** Validates that the requesting user holds an active seat on a license covering the specified asset, logs the checkout event, and marks the asset as checked out.
- **Tables Touched:**
  1. `license_allocations` (`READ` / `JOIN` to `asset_licenses`)
  2. `asset_access_logs` (`INSERT action = 'CHECKOUT'`)
  3. `assets` (`UPDATE status = 'ACTIVE'`)
- **Isolation Level:** `Read Committed`.
- **Failure Modes Handled:**
  - User has no active seat allocation on a valid license covering this asset (`403 Forbidden`).
  - Asset has been soft-deleted or archived.
  - License expired or terminated before checkout.
- **Rollback Guarantee:** If seat verification fails or logging fails, no access log is generated and the asset status is unchanged.

---

### Transaction 4: Atomic Bulk CSV Import
- **Purpose:** Parses, validates, and imports hundreds of digital assets in bulk from a single CSV upload in an all-or-nothing transactional pipeline.
- **Tables Touched:**
  1. `assets` (`INSERT` batch)
  2. `asset_versions` (`INSERT` initial version batch)
  3. `asset_tags` (`INSERT` tag associations)
  4. `audit_logs` (`INSERT` bulk creation ledger entry)
- **Isolation Level:** `Read Committed`.
- **Failure Modes Handled:**
  - Missing mandatory column headers.
  - Duplicate `asset_code` within the tenant.
  - Quota limit overflow triggered by `trg_plan_limits`.
  - Malformed foreign keys (`category_id` not found).
- **Rollback Guarantee:** If even one row among 500 rows fails validation or database constraint check, the entire transaction throws an exception and rolls back every inserted row. The API responds with HTTP 422 containing the exact row numbers and error descriptions.

---

### Transaction 5: User Role Change with Session Revocation
- **Purpose:** Modifies an organization member's permission role, invalidates all existing refresh tokens to force re-authentication with new privileges, and writes an audit ledger entry.
- **Tables Touched:**
  1. `users` (`UPDATE role_id`)
  2. `refresh_tokens` (`UPDATE is_revoked = true`)
  3. `audit_logs` (`INSERT` recording previous role and new role)
- **Isolation Level:** `Read Committed`.
- **Failure Modes Handled:**
  - Tenant admin attempting to grant `SUPER_ADMIN` (`403 Forbidden`).
  - Target user belonging to a different tenant (`404 Not Found`).
  - Database deadlock on simultaneous refresh token revocation.
- **Rollback Guarantee:** If token revocation or audit recording fails, the user's role remains unchanged, preventing privilege escalation without session invalidation.

---

### Transaction 6: Tenant Suspension & Session Revocation
- **Purpose:** Suspends a non-compliant or delinquent tenant organization, revoking all active refresh tokens across all users belonging to that organization.
- **Tables Touched:**
  1. `tenants` (`UPDATE status = 'SUSPENDED'`)
  2. `refresh_tokens` (`UPDATE is_revoked = true` for all users in `tenant_id`)
  3. `audit_logs` (`INSERT action = 'UPDATE'`)
- **Isolation Level:** `Read Committed`.
- **Failure Modes Handled:**
  - Target tenant not found.
  - Unauthorized invocation by non-Super Admin.
- **Rollback Guarantee:** If token invalidation fails, the tenant status update is rolled back, preventing partial suspension states where users could continue generating access tokens.
