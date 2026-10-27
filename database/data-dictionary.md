# AssetVault: Comprehensive Data Dictionary & Index Catalog

**Course:** BCSE307L – Database Systems (Fall Semester 2026–27)  
**Institution:** School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT), Vellore  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16  

---

## 1. Table Specifications

### 1.1 `plans`
*Subscription tier specifications that govern tenant resource quotas and billing terms.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `INT` | NO | SERIAL | PK | None | Unique sequential identifier for the plan tier. |
| `name` | `VARCHAR(50)` | NO | None | UK | `UNIQUE` | Tier commercial label (e.g., 'Free Trial', 'Standard', 'Enterprise'). |
| `max_users` | `INT` | NO | None | None | `CHECK (max_users > 0)` | Maximum active user accounts permitted per tenant on this plan. |
| `max_assets` | `INT` | NO | None | None | `CHECK (max_assets > 0)` | Maximum cataloged digital asset entities permitted for the tenant. |
| `monthly_price` | `NUMERIC(10,2)` | NO | `0.00` | None | `CHECK (monthly_price >= 0)` | Recurring monthly charge in standard currency units. |
| `is_active` | `BOOLEAN` | NO | `true` | None | None | Flags whether this tier is currently open for new tenant subscriptions. |

---

### 1.2 `tenants`
*Root organizational customer accounts sharing the multi-tenant PostgreSQL database.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Immutable UUID primary key scoping all tenant-owned data. |
| `plan_id` | `INT` | NO | None | FK | `FK -> plans.id` | Reference to the current subscription plan tier. |
| `name` | `VARCHAR(100)` | NO | None | None | None | Full legal or corporate name of the tenant organization. |
| `slug` | `VARCHAR(100)` | NO | None | UK | `UNIQUE` | URL-safe identifier for tenant subdomains and multi-tenant routing. |
| `status` | `VARCHAR(20)` | NO | `'TRIAL'` | None | `CHECK (status IN ('TRIAL','ACTIVE','SUSPENDED'))` | Operational lifecycle status of the customer organization. |
| `contact_email` | `VARCHAR(255)` | NO | None | None | None | Primary billing and administrative contact email address. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp when the tenant organization was registered. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp of the most recent tenant profile modification. |

---

### 1.3 `roles`
*System-wide Role-Based Access Control (RBAC) privilege tiers.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `INT` | NO | SERIAL | PK | None | Unique sequential role identifier. |
| `name` | `VARCHAR(50)` | NO | None | UK | `UNIQUE, CHECK (name IN ('SUPER_ADMIN','TENANT_ADMIN','ASSET_MANAGER','MEMBER'))` | System role classification governing authorization boundaries. |
| `description` | `TEXT` | YES | None | None | None | Human-readable explanation of privileges associated with this role. |

---

### 1.4 `users`
*Unified user account repository across all tenants and global platform administrators.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique user identifier. |
| `tenant_id` | `UUID` | YES | None | FK | `FK -> tenants.id` | Scoping organization (`NULL` strictly for global `SUPER_ADMIN`). |
| `role_id` | `INT` | NO | None | FK | `FK -> roles.id` | Assigned security clearance tier. |
| `email` | `VARCHAR(255)` | NO | None | UK | `UNIQUE` | Unique user email address used for system authentication. |
| `full_name` | `VARCHAR(100)` | NO | None | None | None | User's full display name. |
| `password_hash` | `VARCHAR(255)` | YES | None | None | None | Blowfish bcrypt hash (cost factor 12); nullable for OAuth-only users. |
| `google_id` | `VARCHAR(100)` | YES | None | UK | `UNIQUE` | Unique Google OAuth 2.0 sub-identifier; nullable for local password users. |
| `avatar_url` | `TEXT` | YES | None | None | None | Secure external URL to profile image avatar. |
| `is_active` | `BOOLEAN` | NO | `true` | None | None | Flag indicating whether the account can authenticate and access assets. |
| `last_login_at` | `TIMESTAMPTZ` | YES | None | None | None | Timestamp of user's most recent successful authentication. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp when account was provisioned. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp of last account modification. |

*Table Constraint:* `CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)` ensures every user has at least one valid authentication provider.

---

### 1.5 `refresh_tokens`
*Cryptographic refresh token state for secure session lifecycle management.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique session token record identifier. |
| `user_id` | `UUID` | NO | None | FK | `FK -> users.id` | Authenticated user owning this session. |
| `token_hash` | `VARCHAR(64)` | NO | None | UK | `UNIQUE` | SHA-256 digest of the refresh token secret; plaintext never stored. |
| `expires_at` | `TIMESTAMPTZ` | NO | None | None | None | Absolute expiration horizon for token renewal. |
| `revoked_at` | `TIMESTAMPTZ` | YES | None | None | None | Revocation timestamp if session was terminated early or rotated. |
| `user_agent` | `TEXT` | YES | None | None | None | Client browser/device user agent string for security audit. |
| `ip_address` | `VARCHAR(45)` | YES | None | None | None | IPv4 or IPv6 originating client address. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp when token was granted. |

---

### 1.6 `vendors`
*External software and content vendors contracted by individual tenant organizations.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique vendor identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Tenant organization contracting this vendor. |
| `name` | `VARCHAR(100)` | NO | None | None | None | Commercial name of software vendor (e.g., 'Adobe Inc.'). |
| `contact_email` | `VARCHAR(255)` | YES | None | None | None | Vendor sales or support contact email. |
| `website` | `VARCHAR(255)` | YES | None | None | None | Official vendor corporate portal or customer URL. |
| `support_phone` | `VARCHAR(50)` | YES | None | None | None | Customer service hotline phone number. |

*Table Constraint:* `UNIQUE (tenant_id, name)` guarantees no duplicate vendor entries within a single tenant.

---

### 1.7 `categories`
*Hierarchical taxonomy trees for classifying tenant digital assets.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique category node identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Tenant organization owning this taxonomy. |
| `parent_id` | `UUID` | YES | None | FK | `FK -> categories.id` | Self-referencing link to parent category node (`NULL` indicates root). |
| `name` | `VARCHAR(100)` | NO | None | None | None | Category classification label (e.g., 'Proprietary Typefaces'). |
| `description` | `TEXT` | YES | None | None | None | Extended notes regarding classification usage. |

*Table Constraint:* `UNIQUE (tenant_id, name)` guarantees unique category names per tenant namespace.

---

### 1.8 `assets`
*Enterprise catalog of managed digital assets, metadata, and lifecycle statuses.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique digital asset identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Tenant organization owning this asset. |
| `category_id` | `UUID` | YES | None | FK | `FK -> categories.id` | Taxonomic classification link. |
| `owner_id` | `UUID` | NO | None | FK | `FK -> users.id` | Primary user custodian responsible for the asset. |
| `asset_code` | `VARCHAR(50)` | NO | None | None | None | Human-readable asset inventory SKU/code (e.g., 'AST-FNT-001'). |
| `name` | `VARCHAR(200)` | NO | None | None | None | Descriptive name of the asset. |
| `description` | `TEXT` | YES | None | None | None | Detailed specifications, usage guidelines, or summary. |
| `asset_type` | `VARCHAR(20)` | NO | None | None | `CHECK (asset_type IN ('FONT','IMAGE','VIDEO','AUDIO','SOFTWARE','DATASET','DOCUMENT','OTHER'))` | Domain asset classification type. |
| `status` | `VARCHAR(20)` | NO | `'DRAFT'` | None | `CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED'))` | Operational lifecycle status. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Ingestion timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Modification timestamp. |
| `deleted_at` | `TIMESTAMPTZ` | YES | None | None | None | Soft-delete timestamp (`NULL` indicates active non-deleted asset). |

*Table Constraint:* `UNIQUE (tenant_id, asset_code)` guarantees unique asset inventory codes per tenant.

---

### 1.9 `asset_versions`
*Version iteration history, cryptographic hashes, and storage pointers for digital assets.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique version iteration identifier. |
| `asset_id` | `UUID` | NO | None | FK | `FK -> assets.id` | Parent digital asset entity. |
| `version_no` | `INT` | NO | None | None | `CHECK (version_no >= 1)` | Sequential iteration number (1, 2, 3...). |
| `file_url` | `TEXT` | NO | None | None | None | External secure URI or storage bucket pointer. |
| `file_size_bytes`| `BIGINT` | NO | None | None | `CHECK (file_size_bytes >= 0)` | File payload size in bytes. |
| `checksum_sha256`| `CHAR(64)` | NO | None | None | None | Cryptographic SHA-256 fingerprint validating binary file integrity. |
| `change_notes` | `TEXT` | YES | None | None | None | Release notes describing changes in this version. |
| `uploaded_by` | `UUID` | YES | None | FK | `FK -> users.id` | User account who published this revision. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Publication timestamp. |

*Table Constraint:* `UNIQUE (asset_id, version_no)` enforces unique iteration numbering per parent asset.

---

### 1.10 `tags`
*Dynamic vocabulary of metadata labeling tags scoped per tenant.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique tag identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Tenant organization owning this tag. |
| `name` | `VARCHAR(50)` | NO | None | None | None | Tag word/phrase label (e.g., 'Commercial', 'Vector', 'Q4-Marketing'). |
| `color` | `VARCHAR(7)` | NO | `'#6366f1'` | None | None | Hexadecimal color code for frontend badge rendering. |

*Table Constraint:* `UNIQUE (tenant_id, name)` prevents duplicate tag labels within an organization.

---

### 1.11 `asset_tags`
*Many-to-Many associative table linking assets to descriptive tags.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `asset_id` | `UUID` | NO | None | PK, FK | `FK -> assets.id` | Referenced digital asset. |
| `tag_id` | `UUID` | NO | None | PK, FK | `FK -> tags.id` | Referenced tag label. |

*Composite Primary Key:* `PRIMARY KEY (asset_id, tag_id)` resolves the M:N relationship without surrogate keys.

---

### 1.12 `license_types`
*System lookup categorizing software license agreements and their operational rules.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `INT` | NO | SERIAL | PK | None | Unique license type lookup identifier. |
| `name` | `VARCHAR(50)` | NO | None | UK | `UNIQUE, CHECK (name IN ('PERPETUAL','SUBSCRIPTION','SEAT_BASED','USAGE_BASED','OPEN_SOURCE'))` | Commercial licensing archetype. |
| `is_seat_based` | `BOOLEAN` | NO | `true` | None | None | Flags whether this model enforces finite user seat allocation bounds. |
| `is_expirable` | `BOOLEAN` | NO | `true` | None | None | Flags whether this model requires expiration tracking and renewal alerts. |
| `description` | `TEXT` | YES | None | None | None | Detailed description of the license model. |

---

### 1.13 `licenses`
*Commercial software license contracts, seat quotas, and validity terms.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique license contract identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Tenant organization procuring the license. |
| `vendor_id` | `UUID` | NO | None | FK | `FK -> vendors.id` | Commercial vendor issuing the license. |
| `license_type_id`| `INT` | NO | None | FK | `FK -> license_types.id`| Categorized licensing archetype. |
| `name` | `VARCHAR(200)` | NO | None | None | None | Commercial product title (e.g., 'JetBrains All Products Pack'). |
| `license_key` | `VARCHAR(255)` | NO | None | None | None | Serial key, activation token, or license agreement credential. |
| `total_seats` | `INT` | NO | None | None | `CHECK (total_seats >= 1)` | Contracted maximum concurrent user seats purchased. |
| `start_date` | `DATE` | NO | None | None | None | Effective date of agreement commencement. |
| `end_date` | `DATE` | YES | None | None | None | Termination horizon (`NULL` for perpetual agreements). |
| `cost` | `NUMERIC(12,2)` | NO | `0.00` | None | `CHECK (cost >= 0)` | Commercial procurement or recurring cost. |
| `currency` | `CHAR(3)` | NO | `'USD'` | None | None | ISO 4217 three-letter currency symbol. |
| `auto_renew` | `BOOLEAN` | NO | `false` | None | None | Flag indicating automated contract rollover. |
| `status` | `VARCHAR(20)` | NO | `'ACTIVE'` | None | `CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED','CANCELLED'))` | Contractual state. |
| `terms` | `TEXT` | YES | None | None | None | Legal terms, usage restrictions, and territory clauses. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Registration timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Modification timestamp. |
| `deleted_at` | `TIMESTAMPTZ` | YES | None | None | None | Soft-delete timestamp (`NULL` indicates active contract). |

*Table Constraints:*
- `CHECK (end_date IS NULL OR end_date > start_date)` guarantees temporal validity.
- `UNIQUE (tenant_id, license_key)` guarantees no duplicate license keys within a tenant.

---

### 1.14 `asset_licenses`
*Many-to-Many associative table linking assets to authorizing software licenses.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `asset_id` | `UUID` | NO | None | PK, FK | `FK -> assets.id` | Covered digital asset entity. |
| `license_id` | `UUID` | NO | None | PK, FK | `FK -> licenses.id` | Authorizing software license agreement. |
| `assigned_by` | `UUID` | YES | None | FK | `FK -> users.id` | Administrator who linked the asset to the license. |
| `assigned_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp when association was mapped. |

*Composite Primary Key:* `PRIMARY KEY (asset_id, license_id)` resolves the M:N relationship cleanly.

---

### 1.15 `license_allocations`
*User seat assignments under a commercial license with strict state tracking.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique seat allocation record identifier. |
| `license_id` | `UUID` | NO | None | FK | `FK -> licenses.id` | Parent license agreement whose seat is granted. |
| `user_id` | `UUID` | NO | None | FK | `FK -> users.id` | Beneficiary employee holding the seat. |
| `allocated_by` | `UUID` | YES | None | FK | `FK -> users.id` | Administrator authorizing the seat grant. |
| `allocated_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp of seat entitlement grant. |
| `released_at` | `TIMESTAMPTZ` | YES | None | None | None | Timestamp when seat was revoked or relinquished. |
| `status` | `VARCHAR(20)` | NO | `'ACTIVE'` | None | `CHECK (status IN ('ACTIVE','RELEASED','REVOKED'))` | Allocation lifecycle status. |

*Business Rule & Partial Unique Index:* A partial unique index `UNIQUE (license_id, user_id) WHERE status = 'ACTIVE'` guarantees that a user cannot hold duplicate active seats simultaneously for the same license, while permitting historical release/revocation audit records.

---

### 1.16 `asset_access_logs`
*Immutable security audit record of digital asset views, checkouts, and downloads.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | NO | IDENTITY | PK | None | High-throughput sequential primary key. |
| `asset_id` | `UUID` | NO | None | FK | `FK -> assets.id` | Accessed digital asset. |
| `user_id` | `UUID` | YES | None | FK | `FK -> users.id` | User performing access (nullable for public/guest links). |
| `license_id` | `UUID` | YES | None | FK | `FK -> licenses.id` | Authorizing license covering the access event. |
| `action` | `VARCHAR(20)` | NO | None | None | `CHECK (action IN ('VIEW','DOWNLOAD','CHECKOUT','CHECKIN'))` | Recorded access action type. |
| `ip_address` | `VARCHAR(45)` | YES | None | None | None | Originating client IP address (IPv4 or IPv6). |
| `accessed_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Exact timestamp when access occurred. |

---

### 1.17 `license_renewals`
*Contractual renewal history and cost records for software license agreements.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique renewal record identifier. |
| `license_id` | `UUID` | NO | None | FK | `FK -> licenses.id` | License agreement being renewed. |
| `renewed_by` | `UUID` | YES | None | FK | `FK -> users.id` | Manager authorizing the renewal transaction. |
| `old_end_date` | `DATE` | NO | None | None | None | Prior contractual termination date. |
| `new_end_date` | `DATE` | NO | None | None | None | Extended expiration date. |
| `cost` | `NUMERIC(12,2)` | NO | `0.00` | None | `CHECK (cost >= 0)` | Contract renewal fee charged by vendor. |
| `notes` | `TEXT` | YES | None | None | None | Transaction reference numbers, PO notes, or terms. |
| `renewed_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Timestamp when renewal transaction was recorded. |

*Table Constraint:* `CHECK (new_end_date > old_end_date)` enforces that a renewal must strictly advance the termination date.

---

### 1.18 `audit_logs`
*Immutable, tamper-evident audit ledger capturing granular database row mutations.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | NO | IDENTITY | PK | None | High-throughput sequential audit sequence number. |
| `tenant_id` | `UUID` | YES | None | FK | `FK -> tenants.id` | Tenant organization boundary (`NULL` for global changes). |
| `user_id` | `UUID` | YES | None | FK | `FK -> users.id` | Actor who triggered the mutation (`NULL` for system automated tasks). |
| `table_name` | `VARCHAR(100)` | NO | None | None | None | Name of the mutated relational table (e.g., 'assets', 'licenses'). |
| `record_id` | `UUID` | NO | None | None | None | Primary key of the mutated entity record. |
| `action` | `VARCHAR(20)` | NO | None | None | `CHECK (action IN ('INSERT','UPDATE','DELETE'))` | DML mutation action type. |
| `old_data` | `JSONB` | YES | None | None | None | Pre-mutation row state (`NULL` on INSERT). |
| `new_data` | `JSONB` | YES | None | None | None | Post-mutation row state (`NULL` on DELETE). |
| `performed_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Exact timestamp when mutation occurred. |

---

### 1.19 `notifications`
*System notifications and license expiration alerts delivered to tenant users.*

| Column Name | Data Type | Nullable | Default | Key | Constraints | Description |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | None | Unique notification message identifier. |
| `tenant_id` | `UUID` | NO | None | FK | `FK -> tenants.id` | Scoping tenant organization. |
| `user_id` | `UUID` | NO | None | FK | `FK -> users.id` | Recipient user account. |
| `license_id` | `UUID` | YES | None | FK | `FK -> licenses.id` | Associated license agreement triggering the alert. |
| `type` | `VARCHAR(30)` | NO | None | None | `CHECK (type IN ('EXPIRY_30','EXPIRY_15','EXPIRY_7','EXPIRED','OVER_ALLOCATION','SYSTEM'))` | Notification classification category. |
| `message` | `TEXT` | NO | None | None | None | Full notification body text. |
| `is_read` | `BOOLEAN` | NO | `false` | None | None | Flag indicating user acknowledgment of notification. |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | None | None | Notification generation timestamp. |

---

## 2. Comprehensive Index Catalog

The table below catalogs every index defined in AssetVault, its storage type, column set, and the exact query patterns it accelerates:

| # | Index Name | Table | Columns | Index Type | Query Acceleration Rationale |
| :-: | :--- | :--- | :--- | :---: | :--- |
| 1 | `idx_tenants_plan_id` | `tenants` | `(plan_id)` | B-tree | Speeds up JOINs between tenants and subscription plans. |
| 2 | `idx_users_tenant_id` | `users` | `(tenant_id)` | B-tree | Accelerates tenant-scoped user directory queries (`WHERE tenant_id = ?`). |
| 3 | `idx_users_role_id` | `users` | `(role_id)` | B-tree | Optimizes RBAC privilege lookups during authorization middleware checks. |
| 4 | `idx_refresh_tokens_user_id` | `refresh_tokens` | `(user_id)` | B-tree | Accelerates session lookup and user logout cleanup routines. |
| 5 | `idx_vendors_tenant_id` | `vendors` | `(tenant_id)` | B-tree | Scopes vendor queries to the active tenant session. |
| 6 | `idx_categories_tenant_id` | `categories` | `(tenant_id)` | B-tree | Speeds up category tree retrieval for tenant catalog rendering. |
| 7 | `idx_categories_parent_id` | `categories` | `(parent_id)` | B-tree | Optimizes recursive parent-child category tree traversals (`CONNECT BY` / CTE). |
| 8 | `idx_assets_tenant_status` | `assets` | `(tenant_id, status)` | Composite B-tree | Speeds up filtered asset catalog listing (`WHERE tenant_id = ? AND status = 'ACTIVE'`). |
| 9 | `idx_assets_category_id` | `assets` | `(category_id)` | B-tree | Accelerates asset catalog navigation filtered by taxonomic category. |
| 10 | `idx_assets_owner_id` | `assets` | `(owner_id)` | B-tree | Speeds up personal dashboard queries ("Assets Owned by Me"). |
| 11 | `idx_assets_deleted_at` | `assets` | `(deleted_at)` | Partial B-tree | Filters out soft-deleted records (`WHERE deleted_at IS NULL`) with minimal index overhead. |
| 12 | `idx_assets_name_trgm` | `assets` | `(name gin_trgm_ops)` | GIN Trigram | High-speed fuzzy text search (`WHERE name ILIKE '%query%'`) across asset titles. |
| 13 | `idx_asset_versions_asset_id` | `asset_versions` | `(asset_id, version_no DESC)` | Composite B-tree | Instantly retrieves the latest file version for a given digital asset. |
| 14 | `idx_tags_tenant_id` | `tags` | `(tenant_id)` | B-tree | Speeds up retrieval of the tenant's tag vocabulary. |
| 15 | `idx_asset_tags_tag_id` | `asset_tags` | `(tag_id)` | B-tree | Speeds up reverse search ("Find all assets tagged with #Marketing"). |
| 16 | `idx_licenses_tenant_status` | `licenses` | `(tenant_id, status)` | Composite B-tree | Accelerates tenant license dashboard queries (`WHERE tenant_id = ? AND status = 'ACTIVE'`). |
| 17 | `idx_licenses_vendor_id` | `licenses` | `(vendor_id)` | B-tree | Speeds up vendor portal queries showing all licenses supplied by a vendor. |
| 18 | `idx_licenses_end_date` | `licenses` | `(end_date)` | Partial B-tree | Speeds up automated expiration scans (`WHERE end_date BETWEEN ? AND ? AND status = 'ACTIVE'`). |
| 19 | `idx_asset_licenses_license_id`| `asset_licenses`| `(license_id)` | B-tree | Speeds up reverse lookups ("Which assets are covered by License X?"). |
| 20 | `idx_license_alloc_active` | `license_allocations` | `(license_id, user_id)` | Partial Unique B-tree | Enforces at most one active seat per user per license (`WHERE status = 'ACTIVE'`) and accelerates capacity checks. |
| 21 | `idx_license_alloc_user_id` | `license_allocations` | `(user_id)` | B-tree | Accelerates employee profile view ("Which software tools do I have access to?"). |
| 22 | `idx_access_logs_asset_time` | `asset_access_logs` | `(asset_id, accessed_at DESC)`| Composite B-tree | Speeds up chronological access audit history for individual digital assets. |
| 23 | `idx_license_renewals_lic_id` | `license_renewals` | `(license_id, renewed_at DESC)`| Composite B-tree | Speeds up chronological renewal ledger retrieval for contract renegotiations. |
| 24 | `idx_audit_logs_tenant_time` | `audit_logs` | `(tenant_id, performed_at DESC)`| Composite B-tree | Accelerates tenant-scoped administrative audit log viewing and compliance exports. |
| 25 | `idx_audit_logs_record_id` | `audit_logs` | `(table_name, record_id)` | Composite B-tree | Accelerates point-in-time diff inspections for any specific entity record. |
| 26 | `idx_notifications_user_unread`| `notifications` | `(user_id, is_read)` | Composite B-tree | Rapidly loads unread notifications badge count on web user interface header (`WHERE user_id = ? AND is_read = false`). |
