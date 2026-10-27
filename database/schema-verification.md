# AssetVault: Physical Database Schema Verification & Runtime Audit

**Course:** BCSE307L – Database Systems (Fall Semester 2026–27)  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16 / 18  
**Verification Date:** October 12, 2026  
**Status:** All 19 tables, CHECK constraints, indexes, reference seed data, and API health verified.

---

## 1. API Health Check Response

HTTP GET call to `http://localhost:5000/api/health` confirming API server operation and live database connectivity:

```bash
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get | ConvertTo-Json
```

**Output:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-12T16:07:27.133Z",
  "service": "assetvault-api",
  "uptimeSeconds": 28
}
```

---

## 2. Table Catalog (`\dt`)

PostgreSQL `\dt` listing showing all 19 domain and operational tables derived directly from [`er-diagram.md`](./er-diagram.md) and [`data-dictionary.md`](./data-dictionary.md):

```text
                 List of tables
 Schema |        Name         | Type  |  Owner   
--------+---------------------+-------+----------
 public | _prisma_migrations  | table | postgres
 public | asset_access_logs   | table | postgres
 public | asset_licenses      | table | postgres
 public | asset_tags          | table | postgres
 public | asset_versions      | table | postgres
 public | assets              | table | postgres
 public | audit_logs          | table | postgres
 public | categories          | table | postgres
 public | license_allocations | table | postgres
 public | license_renewals    | table | postgres
 public | license_types       | table | postgres
 public | licenses            | table | postgres
 public | notifications       | table | postgres
 public | plans               | table | postgres
 public | refresh_tokens      | table | postgres
 public | roles               | table | postgres
 public | tags                | table | postgres
 public | tenants             | table | postgres
 public | users               | table | postgres
 public | vendors             | table | postgres
(20 rows)
```

---

## 3. Table Structure and Foreign Keys (`\d assets`)

Detailed schema definition of the core entity `assets`:

```text
                                 Table "public.assets"
   Column    |           Type           | Collation | Nullable |        Default        
-------------+--------------------------+-----------+----------+-----------------------
 id          | uuid                     |           | not null | gen_random_uuid()
 tenant_id   | uuid                     |           | not null | 
 category_id | uuid                     |           |          | 
 owner_id    | uuid                     |           | not null | 
 asset_code  | character varying(50)    |           | not null | 
 name        | character varying(200)   |           | not null | 
 description | text                     |           |          | 
 asset_type  | asset_type               |           | not null | 
 status      | asset_status             |           | not null | 'DRAFT'::asset_status
 created_at  | timestamp with time zone |           | not null | CURRENT_TIMESTAMP
 updated_at  | timestamp with time zone |           | not null | CURRENT_TIMESTAMP
 deleted_at  | timestamp with time zone |           |          | 

Indexes:
    "assets_pkey" PRIMARY KEY, btree (id)
    "assets_category_id_idx" btree (category_id)
    "assets_owner_id_idx" btree (owner_id)
    "assets_tenant_id_asset_code_key" UNIQUE, btree (tenant_id, asset_code)
    "assets_tenant_id_status_idx" btree (tenant_id, status)
    "idx_assets_deleted_at" btree (deleted_at) WHERE deleted_at IS NULL
    "idx_assets_name_trgm" gin (name gin_trgm_ops)

Foreign-key constraints:
    "assets_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
    "assets_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "assets_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE

Referenced by:
    TABLE "asset_access_logs" CONSTRAINT "asset_access_logs_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE
    TABLE "asset_licenses" CONSTRAINT "asset_licenses_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE
    TABLE "asset_tags" CONSTRAINT "asset_tags_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE
    TABLE "asset_versions" CONSTRAINT "asset_versions_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE
```

---

## 4. Comprehensive Index Catalog (`\di`)

All 63 primary, unique, foreign key, partial, and GIN trigram indexes verified active in the database:

```text
                                       List of indexes
 Schema |                    Name                    | Type  |  Owner   |        Table        
--------+--------------------------------------------+-------+----------+---------------------
 public | _prisma_migrations_pkey                    | index | postgres | _prisma_migrations
 public | asset_access_logs_asset_id_accessed_at_idx | index | postgres | asset_access_logs
 public | asset_access_logs_pkey                     | index | postgres | asset_access_logs
 public | asset_licenses_license_id_idx              | index | postgres | asset_licenses
 public | asset_licenses_pkey                        | index | postgres | asset_licenses
 public | asset_tags_pkey                            | index | postgres | asset_tags
 public | asset_tags_tag_id_idx                      | index | postgres | asset_tags
 public | asset_versions_asset_id_version_no_idx     | index | postgres | asset_versions
 public | asset_versions_asset_id_version_no_key     | index | postgres | asset_versions
 public | asset_versions_pkey                        | index | postgres | asset_versions
 public | assets_category_id_idx                     | index | postgres | assets
 public | assets_owner_id_idx                        | index | postgres | assets
 public | assets_pkey                                | index | postgres | assets
 public | assets_tenant_id_asset_code_key            | index | postgres | assets
 public | assets_tenant_id_status_idx                | index | postgres | assets
 public | audit_logs_pkey                            | index | postgres | audit_logs
 public | audit_logs_table_name_record_id_idx        | index | postgres | audit_logs
 public | audit_logs_tenant_id_performed_at_idx      | index | postgres | audit_logs
 public | categories_parent_id_idx                   | index | postgres | categories
 public | categories_pkey                            | index | postgres | categories
 public | categories_tenant_id_idx                   | index | postgres | categories
 public | categories_tenant_id_name_key              | index | postgres | categories
 public | idx_assets_deleted_at                      | index | postgres | assets
 public | idx_assets_name_trgm                       | index | postgres | assets
 public | idx_license_alloc_active                   | index | postgres | license_allocations
 public | idx_licenses_deleted_at                    | index | postgres | licenses
 public | idx_licenses_end_date_active               | index | postgres | licenses
 public | idx_licenses_name_trgm                     | index | postgres | licenses
 public | idx_notifications_user_unread              | index | postgres | notifications
 public | license_allocations_pkey                   | index | postgres | license_allocations
 public | license_allocations_user_id_idx            | index | postgres | license_allocations
 public | license_renewals_license_id_renewed_at_idx | index | postgres | license_renewals
 public | license_renewals_pkey                      | index | postgres | license_renewals
 public | license_types_name_key                     | index | postgres | license_types
 public | license_types_pkey                         | index | postgres | license_types
 public | licenses_end_date_idx                      | index | postgres | licenses
 public | licenses_pkey                              | index | postgres | licenses
 public | licenses_tenant_id_license_key_key         | index | postgres | licenses
 public | licenses_tenant_id_status_idx              | index | postgres | licenses
 public | licenses_vendor_id_idx                     | index | postgres | licenses
 public | notifications_pkey                         | index | postgres | notifications
 public | notifications_user_id_is_read_idx          | index | postgres | notifications
 public | plans_name_key                             | index | postgres | plans
 public | plans_pkey                                 | index | postgres | plans
 public | refresh_tokens_pkey                        | index | postgres | refresh_tokens
 public | refresh_tokens_token_hash_key              | index | postgres | refresh_tokens
 public | refresh_tokens_user_id_idx                 | index | postgres | refresh_tokens
 public | roles_name_key                             | index | postgres | roles
 public | roles_pkey                                 | index | postgres | roles
 public | tags_pkey                                  | index | postgres | tags
 public | tags_tenant_id_idx                         | index | postgres | tags
 public | tags_tenant_id_name_key                    | index | postgres | tags
 public | tenants_pkey                               | index | postgres | tenants
 public | tenants_plan_id_idx                        | index | postgres | tenants
 public | tenants_slug_key                           | index | postgres | tenants
 public | users_email_key                            | index | postgres | users
 public | users_google_id_key                        | index | postgres | users
 public | users_pkey                                 | index | postgres | users
 public | users_role_id_idx                          | index | postgres | users
 public | users_tenant_id_idx                        | index | postgres | users
 public | vendors_pkey                               | index | postgres | vendors
 public | vendors_tenant_id_idx                      | index | postgres | vendors
 public | vendors_tenant_id_name_key                 | index | postgres | vendors
(63 rows)
```

---

## 5. Domain CHECK Constraints (`pg_constraint`)

Verification of declarative check constraints enforcing business bounds:

```text
            conname            |     relname      |                       pg_get_constraintdef                       
-------------------------------+------------------+------------------------------------------------------------------
 chk_plans_max_users           | plans            | CHECK ((max_users > 0))
 chk_plans_max_assets          | plans            | CHECK ((max_assets > 0))
 chk_plans_monthly_price       | plans            | CHECK ((monthly_price >= (0)::numeric))
 chk_users_auth_provider       | users            | CHECK (((password_hash IS NOT NULL) OR (google_id IS NOT NULL)))
 chk_asset_versions_version_no | asset_versions   | CHECK ((version_no >= 1))
 chk_asset_versions_file_size  | asset_versions   | CHECK ((file_size_bytes >= 0))
 chk_licenses_total_seats      | licenses         | CHECK ((total_seats >= 1))
 chk_licenses_cost             | licenses         | CHECK ((cost >= (0)::numeric))
 chk_licenses_dates            | licenses         | CHECK (((end_date IS NULL) OR (end_date > start_date)))
 chk_license_renewals_cost     | license_renewals | CHECK ((cost >= (0)::numeric))
 chk_license_renewals_dates    | license_renewals | CHECK ((new_end_date > old_end_date))
(11 rows)
```

---

## 6. Seeded Reference Data Verification

Output of queries verifying reference rows in lookup tables:

### 6.1 `plans`
```text
 id |    name    | max_users | max_assets | monthly_price 
----+------------+-----------+------------+---------------
  1 | Free Trial |         5 |        100 |          0.00
  2 | Pro        |        50 |       5000 |         49.00
  3 | Enterprise |       500 |      50000 |        199.00
(3 rows)
```

### 6.2 `roles`
```text
 id |     name      
----+---------------
  1 | SUPER_ADMIN
  2 | TENANT_ADMIN
  3 | ASSET_MANAGER
  4 | MEMBER
(4 rows)
```

### 6.3 `license_types`
```text
 id |     name     | is_seat_based | is_expirable 
----+--------------+---------------+--------------
  1 | PERPETUAL    | f             | f
  2 | SUBSCRIPTION | f             | t
  3 | SEAT_BASED   | t             | t
  4 | USAGE_BASED  | f             | t
  5 | OPEN_SOURCE  | f             | f
(5 rows)
```

---

## 7. Migration Synchronization Status

```bash
npx prisma migrate status
```

**Output:**
```text
Datasource "db": PostgreSQL database "assetvault_db", schema "public" at "localhost:5433"

1 migration found in prisma/migrations
Database schema is up to date!
```
