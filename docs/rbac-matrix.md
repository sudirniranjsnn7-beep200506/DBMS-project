# AssetVault: Role-Based Access Control (RBAC) Permission Matrix

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**System Architecture:** Multi-Tenant Relational SaaS with Single `users` Table  
**Source of Truth:** Defined here and programmatically enforced via `backend/src/config/permissions.ts`.

---

## 1. Architectural Principles of AssetVault RBAC

1. **Single Unified `users` Directory:**
   - AssetVault strictly avoids separate tables for admins, managers, and members (`no admin_users or tenant_members tables`).
   - Every human account resides in the unified `users` table linked via foreign key to `roles(id)`.
   - The role name (`SUPER_ADMIN`, `TENANT_ADMIN`, `ASSET_MANAGER`, `MEMBER`) is encoded into signed JWT claims, but **the user is re-loaded from PostgreSQL on every authenticated request** (`loadUser` middleware) to guarantee that role revocations or account suspensions take effect with zero latency.

2. **Strict Multi-Tenant Boundary:**
   - `SUPER_ADMIN` is a platform-level infrastructure operator (`users.tenant_id IS NULL`). The Super Admin can govern tenant accounts, configure subscription plans, and inspect global health analytics, but has **zero access to view, download, or manipulate any tenant's proprietary digital assets or license agreements**.
   - `TENANT_ADMIN`, `ASSET_MANAGER`, and `MEMBER` are strictly scoped to their respective tenant organization (`users.tenant_id = tenants.id`).

3. **Principle of Least Privilege:**
   - Route authorization is enforced via middleware using granular permissions (`authorize('permission_name')`).
   - If an unauthenticated user attempts access, the API returns `401 Unauthorized`.
   - If an authenticated user lacks the necessary permission, the API returns `403 Forbidden` with the standard error response shape `{ error: { code: 'FORBIDDEN', message: '...' } }`.
   - If an authenticated user attempts to probe a resource ID belonging to another tenant, the API returns `404 Not Found` (never `403`), preventing ID enumeration attacks.

---

## 2. Resource & Action Permission Matrix

| Resource & Action | Permission String | SUPER_ADMIN | TENANT_ADMIN | ASSET_MANAGER | MEMBER | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Tenants: Read Platform** | `tenants:read_platform` | ✅ | ❌ | ❌ | ❌ | List all organizations across platform |
| **Tenants: Manage Platform** | `tenants:manage_platform` | ✅ | ❌ | ❌ | ❌ | Suspend/activate tenants, modify quotas |
| **Tenants: Read Own** | `tenants:read_own` | ❌ | ✅ | ✅ | ✅ | View organization metadata & plan info |
| **Tenants: Update Own** | `tenants:update_own` | ❌ | ✅ | ❌ | ❌ | Update company name, contact email, settings |
| **Plans: Read** | `plans:read` | ✅ | ✅ | ✅ | ✅ | View subscription tiers & feature limits |
| **Plans: Manage** | `plans:manage` | ✅ | ❌ | ❌ | ❌ | Create, update, or deactivate pricing plans |
| **Platform Analytics** | `analytics:platform_read` | ✅ | ❌ | ❌ | ❌ | Cross-tenant global metrics & storage stats |
| **Users: Read Tenant** | `users:read` | ❌ | ✅ | ❌ | ❌ | List organization employees & managers |
| **Users: Manage Tenant** | `users:manage` | ❌ | ✅ | ❌ | ❌ | Invite members, modify roles, deactivate |
| **Vendors: Read** | `vendors:read` | ❌ | ✅ | ✅ | ❌ | View commercial software providers |
| **Vendors: Manage** | `vendors:manage` | ❌ | ✅ | ✅ | ❌ | Create, edit, and archive supplier profiles |
| **Categories: Read** | `categories:read` | ❌ | ✅ | ✅ | ✅ | Browse taxonomic category tree |
| **Categories: Manage** | `categories:manage` | ❌ | ✅ | ✅ | ❌ | Create, nest, edit, and delete categories |
| **Tags: Read** | `tags:read` | ❌ | ✅ | ✅ | ✅ | Browse metadata vocabulary tags |
| **Tags: Manage** | `tags:manage` | ❌ | ✅ | ✅ | ❌ | Create and update tag names & color codes |
| **Assets: Read** | `assets:read` | ❌ | ✅ | ✅ | ✅ | Browse catalog, search, and view metadata |
| **Assets: Create** | `assets:create` | ❌ | ✅ | ✅ | ❌ | Register new digital asset repository items |
| **Assets: Update** | `assets:update` | ❌ | ✅ | ✅ | ❌ | Modify asset description, category, tags |
| **Assets: Delete** | `assets:delete` | ❌ | ✅ | ✅ | ❌ | Soft-delete / archive asset records |
| **Assets: Download** | `assets:download` | ❌ | ✅ | ✅ | ✅ | Download files & generate access audit logs |
| **Versions: Read** | `versions:read` | ❌ | ✅ | ✅ | ✅ | View file version history & SHA-256 hashes |
| **Versions: Create** | `versions:create` | ❌ | ✅ | ✅ | ❌ | Upload iterative file revisions |
| **Licenses: Read** | `licenses:read` | ❌ | ✅ | ✅ | ✅ | View contract details and remaining seats |
| **Licenses: Create** | `licenses:create` | ❌ | ✅ | ✅ | ❌ | Create software contract & seat quotas |
| **Licenses: Update** | `licenses:update` | ❌ | ✅ | ✅ | ❌ | Modify terms, license keys, renewal dates |
| **Licenses: Delete** | `licenses:delete` | ❌ | ✅ | ❌ | ❌ | Archive or cancel software contracts |
| **Licenses: Renew** | `licenses:renew` | ❌ | ✅ | ✅ | ❌ | Record renewals via `sp_renew_license` |
| **Licenses: Link Asset** | `licenses:link_asset` | ❌ | ✅ | ✅ | ❌ | Associate licenses to digital assets |
| **Allocations: Read** | `allocations:read` | ❌ | ✅ | ✅ | ✅ | View seat allocations |
| **Allocations: Manage All** | `allocations:manage_all` | ❌ | ✅ | ✅ | ❌ | Allocate/revoke seats for any organization user |
| **Allocations: Checkout Self** | `allocations:checkout_self` | ❌ | ✅ | ✅ | ✅ | Request/claim available seat for self |
| **Allocations: Release Self** | `allocations:release_self` | ❌ | ✅ | ✅ | ✅ | Voluntarily release own seat allocation |
| **Audit Logs: Read** | `audit:read` | ❌ | ✅ | ❌ | ❌ | View immutable organization audit trails |
| **Notifications: Read** | `notifications:read` | ✅ | ✅ | ✅ | ✅ | Read personalized system & expiry alerts |
| **Notifications: Manage** | `notifications:manage` | ✅ | ✅ | ✅ | ❌ | Mark notifications as read or dismiss alerts |

---

## 3. Role Responsibilities Breakdown

### `SUPER_ADMIN`
- **Scope:** Global SaaS Platform.
- **Responsibilities:**
  - Create and manage customer tenants (`tenants:manage_platform`).
  - Configure subscription plans, asset quotas, and monthly prices (`plans:manage`).
  - Inspect platform-wide utilization via `v_tenant_summary`.
  - **Hard Security Constraint:** No access to tenant business data (cannot read or download assets, view license keys, or allocate seats).

### `TENANT_ADMIN`
- **Scope:** Single Tenant Organization.
- **Responsibilities:**
  - Full administrative governance of their tenant domain.
  - User management: inviting new colleagues, assigning roles, deactivating departing staff (`users:manage`).
  - Vendor relationship management and commercial software licenses.
  - Full inspection of tamper-evident audit logs (`audit:read`).

### `ASSET_MANAGER`
- **Scope:** Single Tenant Organization.
- **Responsibilities:**
  - Daily asset stewardship and catalog classification.
  - Uploading new asset files and iterating versions with SHA-256 integrity verification (`versions:create`).
  - Associating covering licenses to assets (`licenses:link_asset`).
  - Allocating seat entitlements to team members via `sp_allocate_license_seat`.
  - **Constraint:** Cannot manage team users or view the organization audit log.

### `MEMBER`
- **Scope:** Single Tenant Organization.
- **Responsibilities:**
  - Browsing the approved digital asset catalog (`assets:read`).
  - Downloading authorized assets (`assets:download`), which automatically creates an entry in `asset_access_logs`.
  - Self-service license seat checkout (`allocations:checkout_self`) when capacity is available.
  - Viewing assigned seats and releasing them upon project completion (`allocations:release_self`).

---

## 4. UI Navigation Menu Provisioning (`GET /api/auth/menu`)

The backend dynamically serves role-based navigation menus through `GET /api/auth/menu`, ensuring that UI sidebars only render pages that match the user's explicit permissions:

```json
[
  { "key": "dashboard", "label": "Dashboard", "path": "/dashboard", "icon": "LayoutDashboard" },
  { "key": "assets", "label": "Asset Catalog", "path": "/assets", "icon": "FolderGit2" },
  { "key": "licenses", "label": "Licenses", "path": "/licenses", "icon": "KeyRound" },
  { "key": "allocations", "label": "My Seats", "path": "/allocations", "icon": "UserCheck" },
  { "key": "team", "label": "Team Members", "path": "/team", "icon": "Users", "requiredRole": ["TENANT_ADMIN"] },
  { "key": "vendors", "label": "Vendors", "path": "/vendors", "icon": "Building2", "requiredRole": ["TENANT_ADMIN", "ASSET_MANAGER"] },
  { "key": "audit", "label": "Audit Ledger", "path": "/audit", "icon": "ShieldCheck", "requiredRole": ["TENANT_ADMIN"] },
  { "key": "tenants", "label": "Tenant Management", "path": "/admin/tenants", "icon": "Server", "requiredRole": ["SUPER_ADMIN"] },
  { "key": "plans", "label": "Subscription Plans", "path": "/admin/plans", "icon": "CreditCard", "requiredRole": ["SUPER_ADMIN"] }
]
```
