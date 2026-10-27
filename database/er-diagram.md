# AssetVault: Entity-Relationship (ER) Architecture

**Course:** BCSE307L – Database Systems (Fall Semester 2026–27)  
**Institution:** School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT), Vellore  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16  

---

## 1. Executive Summary & Primary Entities

AssetVault is structured around five primary business pillars that govern tenant operations, identity lifecycle, digital asset versioning, and compliance enforcement:

1. **`tenants`:** The root organizational boundary for the multi-tenant SaaS. Every tenant is associated with a subscription plan (`plans`) and logically owns users, vendors, categories, tags, assets, licenses, audit logs, and notifications.
2. **`users`:** Unified identity repository across all organizations and administrative tiers. Accommodates Super Administrators (global scope, `tenant_id` is `NULL`) and tenant-scoped actors (Tenant Admin, Asset Manager, Member). Supports both Google OAuth 2.0 federation and bcrypt-hashed local credentials.
3. **`assets`:** Core digital asset repository cataloging proprietary fonts, datasets, design media, and software binaries. Carries categorized taxonomies, version history (`asset_versions`), and tag associations (`asset_tags`).
4. **`licenses`:** Enterprise software and digital rights agreements issued by commercial vendors. Manages seat capacity constraints, contractual validity horizons, renewal history (`license_renewals`), and multi-asset coverage associations (`asset_licenses`).
5. **`vendors`:** Software publishers and content providers (e.g., Adobe, JetBrains, Microsoft) holding supply contracts with individual tenants.

### Key Relationships Overview
- **Tenancy Scoping (1:N):** `tenants` strictly scopes top-level tables (`users`, `vendors`, `categories`, `assets`, `tags`, `licenses`, `audit_logs`, `notifications`). All child entities (`asset_versions`, `asset_tags`, `asset_licenses`, `license_allocations`, `asset_access_logs`, `license_renewals`) inherit tenancy through their parent relationships without redundant foreign keys, eliminating transitive dependencies and strictly maintaining 3NF.
- **Many-to-Many Resolvers (M:N):**
  - `asset_tags`: Associates digital assets with dynamic metadata tags (`assets` M:N `tags`).
  - `asset_licenses`: Resolves asset coverage where one asset can require multiple licenses and a site license covers multiple assets (`assets` M:N `licenses`).
  - `license_allocations`: Resolves seat entitlement where one license allocates seats to multiple users, and one user can hold multiple license seats (`licenses` M:N `users`), enriched with allocation timestamps and status tracking.
- **Hierarchical Self-Reference (1:N):** `categories.parent_id` references `categories.id` allowing arbitrary tree taxonomies for asset classification within each tenant.

---

## 2. Mermaid ER Diagram (Crow's-Foot Notation)

```mermaid
erDiagram
    PLANS ||--o{ TENANTS : "subscribes"
    ROLES ||--o{ USERS : "authorizes"
    TENANTS ||--o{ USERS : "employs"
    USERS ||--o{ REFRESH_TOKENS : "authenticates"

    TENANTS ||--o{ VENDORS : "contracts"
    TENANTS ||--o{ CATEGORIES : "defines"
    CATEGORIES ||--o{ CATEGORIES : "parent_of"

    TENANTS ||--o{ TAGS : "creates"
    TENANTS ||--o{ ASSETS : "owns"
    CATEGORIES ||--o{ ASSETS : "classifies"
    USERS ||--o{ ASSETS : "manages"

    ASSETS ||--o{ ASSET_VERSIONS : "versions"
    USERS ||--o{ ASSET_VERSIONS : "uploads"

    ASSETS ||--o{ ASSET_TAGS : "tagged_with"
    TAGS ||--o{ ASSET_TAGS : "assigned_to"

    LICENSE_TYPES ||--o{ LICENSES : "classifies"
    TENANTS ||--o{ LICENSES : "procures"
    VENDORS ||--o{ LICENSES : "supplies"

    ASSETS ||--o{ ASSET_LICENSES : "associated_with"
    LICENSES ||--o{ ASSET_LICENSES : "covers"
    USERS ||--o{ ASSET_LICENSES : "assigns"

    LICENSES ||--o{ LICENSE_ALLOCATIONS : "allocates_seat"
    USERS ||--o{ LICENSE_ALLOCATIONS : "holds_seat"
    USERS ||--o{ LICENSE_ALLOCATIONS : "allocated_by"

    LICENSES ||--o{ LICENSE_RENEWALS : "extends"
    USERS ||--o{ LICENSE_RENEWALS : "authorizes_renewal"

    ASSETS ||--o{ ASSET_ACCESS_LOGS : "logs_access"
    USERS ||--o{ ASSET_ACCESS_LOGS : "performs_access"
    LICENSES ||--o{ ASSET_ACCESS_LOGS : "authorizes_access"

    TENANTS ||--o{ AUDIT_LOGS : "scopes_audit"
    USERS ||--o{ AUDIT_LOGS : "initiates_audit"

    TENANTS ||--o{ NOTIFICATIONS : "delivers"
    USERS ||--o{ NOTIFICATIONS : "receives"
    LICENSES ||--o{ NOTIFICATIONS : "triggers_alert"

    PLANS {
        int id PK
        varchar name UK
        int max_users
        int max_assets
        numeric monthly_price
        boolean is_active
    }

    TENANTS {
        uuid id PK
        int plan_id FK
        varchar name
        varchar slug UK
        varchar status
        varchar contact_email
        timestamptz created_at
        timestamptz updated_at
    }

    ROLES {
        int id PK
        varchar name UK
        text description
    }

    USERS {
        uuid id PK
        uuid tenant_id FK
        int role_id FK
        varchar email UK
        varchar full_name
        varchar password_hash
        varchar google_id UK
        text avatar_url
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
        text user_agent
        varchar ip_address
        timestamptz created_at
    }

    VENDORS {
        uuid id PK
        uuid tenant_id FK
        varchar name
        varchar contact_email
        varchar website
        varchar support_phone
    }

    CATEGORIES {
        uuid id PK
        uuid tenant_id FK
        uuid parent_id FK
        varchar name
        text description
    }

    ASSETS {
        uuid id PK
        uuid tenant_id FK
        uuid category_id FK
        uuid owner_id FK
        varchar asset_code
        varchar name
        text description
        varchar asset_type
        varchar status
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    ASSET_VERSIONS {
        uuid id PK
        uuid asset_id FK
        int version_no
        text file_url
        bigint file_size_bytes
        char checksum_sha256
        text change_notes
        uuid uploaded_by FK
        timestamptz created_at
    }

    TAGS {
        uuid id PK
        uuid tenant_id FK
        varchar name
        varchar color
    }

    ASSET_TAGS {
        uuid asset_id PK,FK
        uuid tag_id PK,FK
    }

    LICENSE_TYPES {
        int id PK
        varchar name UK
        boolean is_seat_based
        boolean is_expirable
        text description
    }

    LICENSES {
        uuid id PK
        uuid tenant_id FK
        uuid vendor_id FK
        int license_type_id FK
        varchar name
        varchar license_key
        int total_seats
        date start_date
        date end_date
        numeric cost
        char currency
        boolean auto_renew
        varchar status
        text terms
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    ASSET_LICENSES {
        uuid asset_id PK,FK
        uuid license_id PK,FK
        uuid assigned_by FK
        timestamptz assigned_at
    }

    LICENSE_ALLOCATIONS {
        uuid id PK
        uuid license_id FK
        uuid user_id FK
        uuid allocated_by FK
        timestamptz allocated_at
        timestamptz released_at
        varchar status
    }

    LICENSE_RENEWALS {
        uuid id PK
        uuid license_id FK
        uuid renewed_by FK
        date old_end_date
        date new_end_date
        numeric cost
        text notes
        timestamptz renewed_at
    }

    ASSET_ACCESS_LOGS {
        bigint id PK
        uuid asset_id FK
        uuid user_id FK
        uuid license_id FK
        varchar action
        varchar ip_address
        timestamptz accessed_at
    }

    AUDIT_LOGS {
        bigint id PK
        uuid tenant_id FK
        uuid user_id FK
        varchar table_name
        uuid record_id
        varchar action
        jsonb old_data
        jsonb new_data
        timestamptz performed_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        uuid license_id FK
        varchar type
        text message
        boolean is_read
        timestamptz created_at
    }
```

---

## 3. Diagram Notation & Legend

| Symbol | Notation Meaning | Cardinality Semantics |
| :---: | :--- | :--- |
| `||--o{` | One to Zero-or-Many | The parent entity must exist; the child entity can have 0, 1, or many rows. |
| `||--|{` | One to One-or-Many | Mandatory parent relationship with at least one corresponding child record. |
| `PK` | Primary Key | Unique, non-null identifier for the relation. Uses UUIDv4 or SERIAL integer. |
| `FK` | Foreign Key | Referential constraint enforcing referential integrity back to parent relation. |
| `UK` | Unique Key | Unique constraint enforcing column or composite business exclusivity. |

### Visual Diagram File
The rendered vector architecture diagram is exported and maintained as [`er-diagram.svg`](./er-diagram.svg).
