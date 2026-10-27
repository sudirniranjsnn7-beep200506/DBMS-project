-- ==============================================================================
-- AssetVault: Row-Level Security (RLS) Specification
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 04_rls.sql: Granular Multi-Tenant Isolation Policies & Application Role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Dedicated Application Role
-- Role assetvault_app connects or executes transactions with least privilege.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'assetvault_app') THEN
        CREATE ROLE assetvault_app WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
    END IF;
END
$$;

-- Grant schema and DML privileges (Strictly NO DDL, NO DROP, NO ALTER)
GRANT USAGE ON SCHEMA public TO assetvault_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assetvault_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assetvault_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO assetvault_app;

-- ------------------------------------------------------------------------------
-- 2. Helper Functions for Clean Session Context Access
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION fn_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(current_setting('app.is_super_admin', true) = 'true', FALSE);
$$;

-- ------------------------------------------------------------------------------
-- 3. Enable RLS on All Multi-Tenant Tables
-- ------------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses FORCE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE asset_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_licenses FORCE ROW LEVEL SECURITY;
ALTER TABLE license_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE license_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_renewals FORCE ROW LEVEL SECURITY;
ALTER TABLE asset_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_access_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. Top-Level Multi-Tenant Policies
-- Direct tenant_id column comparison or Super Admin override.
-- ------------------------------------------------------------------------------

-- Tenants Table
DROP POLICY IF EXISTS rls_tenants_isolation ON tenants;
CREATE POLICY rls_tenants_isolation ON tenants
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Users Table
DROP POLICY IF EXISTS rls_users_isolation ON users;
CREATE POLICY rls_users_isolation ON users
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Vendors Table
DROP POLICY IF EXISTS rls_vendors_isolation ON vendors;
CREATE POLICY rls_vendors_isolation ON vendors
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Categories Table
DROP POLICY IF EXISTS rls_categories_isolation ON categories;
CREATE POLICY rls_categories_isolation ON categories
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Assets Table
DROP POLICY IF EXISTS rls_assets_isolation ON assets;
CREATE POLICY rls_assets_isolation ON assets
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Licenses Table
DROP POLICY IF EXISTS rls_licenses_isolation ON licenses;
CREATE POLICY rls_licenses_isolation ON licenses
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Tags Table
DROP POLICY IF EXISTS rls_tags_isolation ON tags;
CREATE POLICY rls_tags_isolation ON tags
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Notifications Table
DROP POLICY IF EXISTS rls_notifications_isolation ON notifications;
CREATE POLICY rls_notifications_isolation ON notifications
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- Audit Logs Table
DROP POLICY IF EXISTS rls_audit_logs_isolation ON audit_logs;
CREATE POLICY rls_audit_logs_isolation ON audit_logs
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
)
WITH CHECK (
    tenant_id = fn_current_tenant_id() OR fn_is_super_admin()
);

-- ------------------------------------------------------------------------------
-- 5. Child Tables Policies (Normalized 3NF Hierarchy Traversals)
-- Security enforced via parent joins to avoid redundant denormalized tenant columns.
-- ------------------------------------------------------------------------------

-- Asset Versions
DROP POLICY IF EXISTS rls_asset_versions_isolation ON asset_versions;
CREATE POLICY rls_asset_versions_isolation ON asset_versions
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_versions.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_versions.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
);

-- Asset Tags
DROP POLICY IF EXISTS rls_asset_tags_isolation ON asset_tags;
CREATE POLICY rls_asset_tags_isolation ON asset_tags
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_tags.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_tags.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
);

-- Asset Licenses
DROP POLICY IF EXISTS rls_asset_licenses_isolation ON asset_licenses;
CREATE POLICY rls_asset_licenses_isolation ON asset_licenses
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_licenses.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_licenses.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
);

-- License Allocations
DROP POLICY IF EXISTS rls_license_allocations_isolation ON license_allocations;
CREATE POLICY rls_license_allocations_isolation ON license_allocations
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM licenses l 
        WHERE l.id = license_allocations.license_id 
          AND l.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM licenses l 
        WHERE l.id = license_allocations.license_id 
          AND l.tenant_id = fn_current_tenant_id()
    )
);

-- License Renewals
DROP POLICY IF EXISTS rls_license_renewals_isolation ON license_renewals;
CREATE POLICY rls_license_renewals_isolation ON license_renewals
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM licenses l 
        WHERE l.id = license_renewals.license_id 
          AND l.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM licenses l 
        WHERE l.id = license_renewals.license_id 
          AND l.tenant_id = fn_current_tenant_id()
    )
);

-- Asset Access Logs
DROP POLICY IF EXISTS rls_asset_access_logs_isolation ON asset_access_logs;
CREATE POLICY rls_asset_access_logs_isolation ON asset_access_logs
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_access_logs.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM assets a 
        WHERE a.id = asset_access_logs.asset_id 
          AND a.tenant_id = fn_current_tenant_id()
    )
);

-- Refresh Tokens
DROP POLICY IF EXISTS rls_refresh_tokens_isolation ON refresh_tokens;
CREATE POLICY rls_refresh_tokens_isolation ON refresh_tokens
AS PERMISSIVE FOR ALL TO PUBLIC
USING (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = refresh_tokens.user_id 
          AND u.tenant_id = fn_current_tenant_id()
    )
)
WITH CHECK (
    fn_is_super_admin() OR EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = refresh_tokens.user_id 
          AND u.tenant_id = fn_current_tenant_id()
    )
);
