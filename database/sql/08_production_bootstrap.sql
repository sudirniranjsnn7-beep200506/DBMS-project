-- ==============================================================================
-- AssetVault: Production Database Security Bootstrap
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- Purpose: Creates the restricted application runtime role (assetvault_app)
--          with least-privilege access (DML only, no DDL/DROP capabilities).
--
-- Usage:
--   psql "$DIRECT_URL" -v APP_PASSWORD="'${APP_DB_PASSWORD}'" -f database/sql/08_production_bootstrap.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- Default fallback password if not supplied via -v APP_PASSWORD
\if :{?APP_PASSWORD}
\else
  \set APP_PASSWORD '\'ChangeMe_In_Production_Secret!\''
\endif

-- 1. Create restricted application runtime role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'assetvault_app') THEN
    CREATE ROLE assetvault_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    RAISE NOTICE 'Role assetvault_app created.';
  ELSE
    RAISE NOTICE 'Role assetvault_app already exists. Updating attributes...';
  END IF;
END $$;

-- 2. Enable login and set password for application runtime role from variable
ALTER ROLE assetvault_app WITH LOGIN PASSWORD :APP_PASSWORD;

-- 3. Grant connection privileges on the current database
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO assetvault_app', current_database());
END $$;

-- 4. Grant schema usage (prevents schema tampering)
GRANT USAGE ON SCHEMA public TO assetvault_app;

-- 5. Revoke DDL creation rights on schema public (Least Privilege: No table creations or drops at runtime)
REVOKE CREATE ON SCHEMA public FROM assetvault_app;

-- 5b. Create failed_login_attempts table for persistent brute-force defense
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  key VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  count INT NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

-- 6. Grant standard DML rights across all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assetvault_app;

-- 7. Grant sequence usage across all sequences for primary key autoincrements
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO assetvault_app;

-- 8. Grant execution rights on all stored functions and procedures
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO assetvault_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO assetvault_app;

-- 9. Configure default privileges for future objects created by migrations/admin
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO assetvault_app;

-- 10. Verification query: output granted privileges
SELECT
  grantee,
  table_schema,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'assetvault_app';

SELECT 'Production bootstrap role configuration completed successfully.' AS status;

-- 7. Ensure materialized view ownership and specialized indexes
ALTER MATERIALIZED VIEW IF EXISTS mv_monthly_access_stats OWNER TO assetvault_app;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm ON assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_licenses_name_trgm ON licenses USING gin (software_product gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_license_alloc_active ON license_allocations (license_id, user_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_deleted_at ON licenses (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, created_at) WHERE is_read = false;
