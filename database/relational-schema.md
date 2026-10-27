# AssetVault: Relational Schema Specification & Referential Integrity

**Course:** BCSE307L – Database Systems (Fall Semester 2026–27)  
**Institution:** School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT), Vellore  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16  

---

## 1. Relational Schema in Standard Notation

In standard relational notation, primary keys are underlined with `<u></u>` and foreign keys are explicitly annotated with `(FK -> referenced_table.column)`:

1. **PLANS** (<u>id</u>, name, max_users, max_assets, monthly_price, is_active)
2. **TENANTS** (<u>id</u>, plan_id (FK -> plans.id), name, slug, status, contact_email, created_at, updated_at)
3. **ROLES** (<u>id</u>, name, description)
4. **USERS** (<u>id</u>, tenant_id (FK -> tenants.id), role_id (FK -> roles.id), email, full_name, password_hash, google_id, avatar_url, is_active, last_login_at, created_at, updated_at)
5. **REFRESH_TOKENS** (<u>id</u>, user_id (FK -> users.id), token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
6. **VENDORS** (<u>id</u>, tenant_id (FK -> tenants.id), name, contact_email, website, support_phone)
7. **CATEGORIES** (<u>id</u>, tenant_id (FK -> tenants.id), parent_id (FK -> categories.id), name, description)
8. **ASSETS** (<u>id</u>, tenant_id (FK -> tenants.id), category_id (FK -> categories.id), owner_id (FK -> users.id), asset_code, name, description, asset_type, status, created_at, updated_at, deleted_at)
9. **ASSET_VERSIONS** (<u>id</u>, asset_id (FK -> assets.id), version_no, file_url, file_size_bytes, checksum_sha256, change_notes, uploaded_by (FK -> users.id), created_at)
10. **TAGS** (<u>id</u>, tenant_id (FK -> tenants.id), name, color)
11. **ASSET_TAGS** (<u>asset_id</u> (FK -> assets.id), <u>tag_id</u> (FK -> tags.id))
12. **LICENSE_TYPES** (<u>id</u>, name, is_seat_based, is_expirable, description)
13. **LICENSES** (<u>id</u>, tenant_id (FK -> tenants.id), vendor_id (FK -> vendors.id), license_type_id (FK -> license_types.id), name, license_key, total_seats, start_date, end_date, cost, currency, auto_renew, status, terms, created_at, updated_at, deleted_at)
14. **ASSET_LICENSES** (<u>asset_id</u> (FK -> assets.id), <u>license_id</u> (FK -> licenses.id), assigned_by (FK -> users.id), assigned_at)
15. **LICENSE_ALLOCATIONS** (<u>id</u>, license_id (FK -> licenses.id), user_id (FK -> users.id), allocated_by (FK -> users.id), allocated_at, released_at, status)
16. **ASSET_ACCESS_LOGS** (<u>id</u>, asset_id (FK -> assets.id), user_id (FK -> users.id), license_id (FK -> licenses.id), action, ip_address, accessed_at)
17. **LICENSE_RENEWALS** (<u>id</u>, license_id (FK -> licenses.id), renewed_by (FK -> users.id), old_end_date, new_end_date, cost, notes, renewed_at)
18. **AUDIT_LOGS** (<u>id</u>, tenant_id (FK -> tenants.id), user_id (FK -> users.id), table_name, record_id, action, old_data, new_data, performed_at)
19. **NOTIFICATIONS** (<u>id</u>, tenant_id (FK -> tenants.id), user_id (FK -> users.id), license_id (FK -> licenses.id), type, message, is_read, created_at)

---

## 2. Referential Integrity & Foreign Key Actions

The table below catalogs every foreign key relationship in AssetVault along with its defined `ON DELETE` and `ON UPDATE` actions and business justification:

| # | Foreign Key Column | Referenced Table.Column | ON DELETE | ON UPDATE | Design Rationale & Business Justification |
| :-: | :--- | :--- | :---: | :---: | :--- |
| 1 | `tenants.plan_id` | `plans.id` | `RESTRICT` | `CASCADE` | Prevents accidental deletion of commercial subscription plans that currently govern active client organizations. Plan ID updates propagate cleanly. |
| 2 | `users.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | When a tenant organization account is permanently decommissioned, all tenant employee records are purged. (`NULL` allowed only for global `SUPER_ADMIN`). |
| 3 | `users.role_id` | `roles.id` | `RESTRICT` | `CASCADE` | RBAC roles represent foundational security privileges; a role cannot be removed if any active users currently depend on it. |
| 4 | `refresh_tokens.user_id` | `users.id` | `CASCADE` | `CASCADE` | User deletion terminates all active session state; refresh token hashes must be eliminated immediately. |
| 5 | `vendors.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Vendor directories are strictly scoped to the tenant organization lifecycle. |
| 6 | `categories.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Asset categories are tenant-owned; decommissioning a tenant cleans up its taxonomy tree. |
| 7 | `categories.parent_id` | `categories.id` | `SET NULL` | `CASCADE` | Deleting an intermediate category node promotes subcategories to top-level roots rather than deleting child classifications or associated assets. |
| 8 | `assets.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Asset catalogs are strictly tenant-owned; decommissioning a tenant purges its assets. |
| 9 | `assets.category_id` | `categories.id` | `SET NULL` | `CASCADE` | Removing a category retains the underlying digital assets in an "Uncategorized" state, preventing catastrophic data loss. |
| 10 | `assets.owner_id` | `users.id` | `RESTRICT` | `CASCADE` | Prevents deletion of an employee account if they are the primary registered custodian of active enterprise assets; ownership must be transferred first. |
| 11 | `asset_versions.asset_id` | `assets.id` | `CASCADE` | `CASCADE` | File versions exist solely as historical iterations of the parent asset; removing the asset purges all versions. |
| 12 | `asset_versions.uploaded_by` | `users.id` | `SET NULL` | `CASCADE` | Preserves file version history and cryptographic hashes even if the authoring employee leaves the company. |
| 13 | `tags.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Tag vocabularies belong strictly to the tenant organization. |
| 14 | `asset_tags.asset_id` | `assets.id` | `CASCADE` | `CASCADE` | Purging an asset removes its M:N tag junction references. |
| 15 | `asset_tags.tag_id` | `tags.id` | `CASCADE` | `CASCADE` | Deleting a tag removes the association across all tagged assets without affecting the asset entities themselves. |
| 16 | `licenses.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Software license contracts belong strictly to the tenant organization. |
| 17 | `licenses.vendor_id` | `vendors.id` | `RESTRICT` | `CASCADE` | Prevents deletion of a vendor while active software licenses and contracts are bound to it. Prevents orphan commercial contracts. |
| 18 | `licenses.license_type_id` | `license_types.id` | `RESTRICT` | `CASCADE` | System license models (per-seat, site, subscription) cannot be dropped if live licenses reference them. |
| 19 | `asset_licenses.asset_id` | `assets.id` | `CASCADE` | `CASCADE` | Deleting an asset clears its license coverage association. |
| 20 | `asset_licenses.license_id` | `licenses.id` | `CASCADE` | `CASCADE` | Deleting a license contract removes coverage links across covered assets. |
| 21 | `asset_licenses.assigned_by` | `users.id` | `SET NULL` | `CASCADE` | Retains asset-to-license coverage links even if the assigning administrator account is removed. |
| 22 | `license_allocations.license_id` | `licenses.id` | `CASCADE` | `CASCADE` | Deleting a license revokes and removes all seat allocation records. |
| 23 | `license_allocations.user_id` | `users.id` | `CASCADE` | `CASCADE` | Deleting a user account automatically frees and clears their allocated license seats. |
| 24 | `license_allocations.allocated_by` | `users.id` | `SET NULL` | `CASCADE` | Historical allocation proof is retained even if the granting administrator leaves the company. |
| 25 | `license_renewals.license_id` | `licenses.id` | `CASCADE` | `CASCADE` | Deleting a license removes its renewal history records. |
| 26 | `license_renewals.renewed_by` | `users.id` | `SET NULL` | `CASCADE` | Retains contractual renewal transaction history even if the renewing manager leaves the organization. |
| 27 | `asset_access_logs.asset_id` | `assets.id` | `CASCADE` | `CASCADE` | Historical asset access events cascade upon complete asset purge. |
| 28 | `asset_access_logs.user_id` | `users.id` | `SET NULL` | `CASCADE` | Regulatory compliance records must be preserved; if an employee is deleted, the log retains the event with user reference set to null. |
| 29 | `asset_access_logs.license_id` | `licenses.id` | `SET NULL` | `CASCADE` | Access event logs remain intact if the specific authorizing license agreement is retired. |
| 30 | `audit_logs.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Decommissioning an entire tenant purges all tenant-scoped audit records. |
| 31 | `audit_logs.user_id` | `users.id` | `SET NULL` | `CASCADE` | Immutable audit trail integrity: if a user account is deleted, prior mutations caused by that user remain recorded with user reference set to null. |
| 32 | `notifications.tenant_id` | `tenants.id` | `CASCADE` | `CASCADE` | Tenant-scoped notification messages cascade upon tenant deletion. |
| 33 | `notifications.user_id` | `users.id` | `CASCADE` | `CASCADE` | Deleting a user clears their personal notifications. |
| 34 | `notifications.license_id` | `licenses.id` | `SET NULL` | `CASCADE` | Retains alert notification text if the referenced license is subsequently deleted. |

---

## 3. ER to Relational Mapping

The transition from conceptual ER diagrams to the relational schema adheres to standard database engineering rules:

### 3.1 Mapping Regular Entities
Each strong entity type in the ER model maps directly to a discrete relational table:
- Simple attributes become table columns with explicit PostgreSQL data types (`VARCHAR`, `INT`, `UUID`, `BOOLEAN`, `TIMESTAMPTZ`, `NUMERIC(12,2)`).
- Synthetic primary keys use `gen_random_uuid()` for distributed uniqueness and data obfuscation across tenants, while lookup tables (`plans`, `roles`, `license_types`) employ memory-efficient `SERIAL INT`.
- Enums (`status`, `asset_type`, `action`) enforce domain bounds directly at the schema layer.

### 3.2 Mapping 1:N Binary Relationships
For all 1:N relationships, the primary key of the "1" (parent) entity is placed as a foreign key attribute inside the "N" (child) relation:
- `plans` (1) to `tenants` (N) $\rightarrow$ `tenants.plan_id` references `plans.id`.
- `tenants` (1) to `users` (N) $\rightarrow$ `users.tenant_id` references `tenants.id`.
- `roles` (1) to `users` (N) $\rightarrow$ `users.role_id` references `roles.id`.
- `tenants` (1) to `assets` (N) $\rightarrow$ `assets.tenant_id` references `tenants.id`.
- `categories` (1) to `assets` (N) $\rightarrow$ `assets.category_id` references `categories.id`.
- `vendors` (1) to `licenses` (N) $\rightarrow$ `licenses.vendor_id` references `vendors.id`.
- `license_types` (1) to `licenses` (N) $\rightarrow$ `licenses.license_type_id` references `license_types.id`.

### 3.3 Mapping M:N Binary Relationships (Associative Tables)
Relational theory strictly prohibits multi-valued attributes or direct M:N links. AssetVault resolves all three M:N relationships into associative junction relations:

1. **`asset_tags` (`assets` M:N `tags`):**
   - An asset can have multiple tags, and a tag can label multiple assets.
   - Mapped to `asset_tags` with composite primary key `(asset_id, tag_id)`.
   - Both columns are foreign keys referencing `assets(id)` and `tags(id)` with `ON DELETE CASCADE`.

2. **`asset_licenses` (`assets` M:N `licenses`):**
   - An enterprise license (e.g. Adobe Master Collection) covers multiple software binaries and fonts, while an asset may require multiple licenses (e.g. runtime font license + authoring license).
   - Mapped to `asset_licenses` with composite primary key `(asset_id, license_id)`.
   - Contains relationship-specific descriptive attributes: `assigned_by FK->users(id)` and `assigned_at TIMESTAMPTZ`.

3. **`license_allocations` (`licenses` M:N `users`):**
   - A multi-seat license allocates seats to multiple employees, and an employee holds seats across multiple tools (e.g. IDE, design suite, cloud license).
   - In addition to standard junction behavior, allocations possess a full state lifecycle (`ACTIVE`, `RELEASED`, `REVOKED`), timestamps (`allocated_at`, `released_at`), and an allocating administrator (`allocated_by FK->users(id)`).
   - Mapped using a surrogate primary key `id UUID` to allow historical auditing of multiple released allocations over time, paired with a PostgreSQL partial unique index ensuring at most one `ACTIVE` seat allocation row exists per `(license_id, user_id)` pair.

### 3.4 Mapping Recursive (Self-Referencing) 1:N Relationships
- **`categories` Hierarchy:**
  - Asset categories support nested sub-categories (e.g., `Design Assets` $\rightarrow$ `Typography` $\rightarrow$ `Display Fonts`).
  - Represented within the single `categories` table via `parent_id UUID (FK -> categories.id)`.
  - `parent_id` is defined as nullable (`NULL` indicates a root category node).
  - Referential action `ON DELETE SET NULL` guarantees that deleting a parent folder promotes immediate children to root status without destroying categorized assets.

### 3.5 Tenancy Scoping & Transitive Dependency Elimination (3NF)
A core tenet of AssetVault's relational mapping is the strict segregation of tenancy keys:
- Top-level tables (`users`, `vendors`, `categories`, `assets`, `tags`, `licenses`, `audit_logs`, `notifications`) store `tenant_id`.
- Dependent entities (`asset_versions`, `asset_tags`, `asset_licenses`, `license_allocations`, `license_renewals`, `asset_access_logs`) inherit tenancy through their parent foreign key.
- Duplicating `tenant_id` into child relations would introduce a transitive dependency:
  $$\text{asset\_versions} \rightarrow \text{asset\_id} \rightarrow \text{tenant\_id}$$
  which violates Third Normal Form (3NF). Cross-tenant consistency between parent and child is guaranteed at the database engine level via stored procedure validation and triggers.
