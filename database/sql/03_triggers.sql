-- ==============================================================================
-- AssetVault: Database Triggers Specification
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 03_triggers.sql: Integrity, Security, Quota, and Audit Triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Trigger: trg_set_updated_at
-- Automatically maintains updated_at timestamp on row modification.
-- Applied to: tenants, users, assets, licenses
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Trigger: trg_audit_row
-- Captures state diffs on core tables (tenants, users, assets, licenses, allocations).
-- Crucial Security Feature: Strips password_hash from logged payload.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_record_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    -- 1. Extract JSON representations
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_data := to_jsonb(NEW);
    END IF;

    -- 2. Strip sensitive credentials (passwords, hashes)
    IF TG_TABLE_NAME = 'users' THEN
        IF v_old_data IS NOT NULL THEN
            v_old_data := v_old_data - 'password_hash';
        END IF;
        IF v_new_data IS NOT NULL THEN
            v_new_data := v_new_data - 'password_hash';
        END IF;
    END IF;

    -- 3. Determine record ID
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;

    -- 4. Determine tenant_id context
    IF TG_TABLE_NAME = 'tenants' THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := NULL;
        ELSE
            v_tenant_id := v_record_id;
        END IF;
    ELSIF TG_TABLE_NAME IN ('users', 'assets', 'licenses', 'vendors') THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := OLD.tenant_id;
        ELSE
            v_tenant_id := NEW.tenant_id;
        END IF;
    ELSIF TG_TABLE_NAME IN ('license_allocations', 'license_renewals') THEN
        IF TG_OP = 'DELETE' THEN
            SELECT tenant_id INTO v_tenant_id FROM licenses WHERE id = OLD.license_id;
        ELSE
            SELECT tenant_id INTO v_tenant_id FROM licenses WHERE id = NEW.license_id;
        END IF;
    END IF;

    -- 5. Extract active user from session variable if set, otherwise fallback
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Fallback to row fields if app.current_user_id not configured
    IF v_user_id IS NULL THEN
        IF TG_TABLE_NAME = 'license_allocations' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.allocated_by ELSE NEW.allocated_by END;
        ELSIF TG_TABLE_NAME = 'assets' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
        ELSIF TG_TABLE_NAME = 'license_renewals' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.renewed_by ELSE NEW.renewed_by END;
        END IF;
    END IF;

    -- 6. Insert audit trail record
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        performed_at
    )
    VALUES (
        v_tenant_id,
        v_user_id,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP::audit_action,
        v_old_data,
        v_new_data,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tenants ON tenants;
CREATE TRIGGER trg_audit_tenants
AFTER INSERT OR UPDATE OR DELETE ON tenants
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_users ON users;
CREATE TRIGGER trg_audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_assets ON assets;
CREATE TRIGGER trg_audit_assets
AFTER INSERT OR UPDATE OR DELETE ON assets
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_licenses ON licenses;
CREATE TRIGGER trg_audit_licenses
AFTER INSERT OR UPDATE OR DELETE ON licenses
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_allocations ON license_allocations;
CREATE TRIGGER trg_audit_allocations
AFTER INSERT OR UPDATE OR DELETE ON license_allocations
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_vendors ON vendors;
CREATE TRIGGER trg_audit_vendors
AFTER INSERT OR UPDATE OR DELETE ON vendors
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_license_renewals ON license_renewals;
CREATE TRIGGER trg_audit_license_renewals
AFTER INSERT OR UPDATE OR DELETE ON license_renewals
FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

-- ------------------------------------------------------------------------------
-- 3. Trigger: trg_audit_immutable
-- Enforces append-only immutable ledger semantics on the audit_logs table.
-- Prevents any UPDATE or DELETE operations.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_audit_delete', true) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs is append-only'
        USING ERRCODE = 'invalid_transaction_state';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_logs;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION fn_audit_immutable();

-- ------------------------------------------------------------------------------
-- 4. Trigger: trg_check_seat_availability
-- Defense-in-depth trigger preventing over-allocation of license seats.
-- Executed before INSERT or status update on license_allocations.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_seat_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_seats INT;
    v_active_seats INT;
BEGIN
    -- Only check if this allocation is or will be ACTIVE
    IF NEW.status = 'ACTIVE' THEN
        -- Fetch total seats available for the target license
        SELECT total_seats INTO v_total_seats
        FROM licenses
        WHERE id = NEW.license_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'License % not found', NEW.license_id
                USING ERRCODE = 'no_data_found';
        END IF;

        -- Count currently active seats excluding the current row (if updating)
        SELECT COUNT(*) INTO v_active_seats
        FROM license_allocations
        WHERE license_id = NEW.license_id
          AND status = 'ACTIVE'
          AND (TG_OP = 'INSERT' OR id <> NEW.id);

        IF v_active_seats >= v_total_seats THEN
            RAISE EXCEPTION 'License seats exhausted'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_seat_availability ON license_allocations;
CREATE TRIGGER trg_check_seat_availability
BEFORE INSERT OR UPDATE OF status ON license_allocations
FOR EACH ROW
EXECUTE FUNCTION fn_check_seat_availability();

-- ------------------------------------------------------------------------------
-- 5. Trigger: trg_enforce_same_tenant
-- Guarantees cross-tenant boundary integrity:
--   a) asset_licenses: asset.tenant_id MUST equal license.tenant_id
--   b) license_allocations: license.tenant_id MUST equal user.tenant_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enforce_asset_license_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_asset_tenant UUID;
    v_license_tenant UUID;
BEGIN
    SELECT tenant_id INTO v_asset_tenant FROM assets WHERE id = NEW.asset_id;
    SELECT tenant_id INTO v_license_tenant FROM licenses WHERE id = NEW.license_id;

    IF v_asset_tenant IS DISTINCT FROM v_license_tenant THEN
        RAISE EXCEPTION 'Cross-tenant violation: Asset tenant % does not match License tenant %',
            v_asset_tenant, v_license_tenant
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_asset_license_tenant ON asset_licenses;
CREATE TRIGGER trg_enforce_asset_license_tenant
BEFORE INSERT OR UPDATE ON asset_licenses
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_asset_license_tenant();

CREATE OR REPLACE FUNCTION fn_enforce_allocation_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_lic_tenant UUID;
    v_usr_tenant UUID;
BEGIN
    SELECT tenant_id INTO v_lic_tenant FROM licenses WHERE id = NEW.license_id;
    SELECT tenant_id INTO v_usr_tenant FROM users WHERE id = NEW.user_id;

    IF v_lic_tenant IS DISTINCT FROM v_usr_tenant THEN
        RAISE EXCEPTION 'Cross-tenant violation: License tenant % does not match User tenant %',
            v_lic_tenant, v_usr_tenant
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_allocation_tenant ON license_allocations;
CREATE TRIGGER trg_enforce_allocation_tenant
BEFORE INSERT OR UPDATE ON license_allocations
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_allocation_tenant();

-- ------------------------------------------------------------------------------
-- 6. Trigger: trg_user_role_tenant_rule
-- Enforces tenancy domain rules based on user role:
--   - SUPER_ADMIN MUST have tenant_id IS NULL
--   - All other roles (TENANT_ADMIN, ASSET_MANAGER, MEMBER) MUST have tenant_id IS NOT NULL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_user_role_tenant_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_name VARCHAR(50);
BEGIN
    SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;

    IF v_role_name = 'SUPER_ADMIN' THEN
        IF NEW.tenant_id IS NOT NULL THEN
            RAISE EXCEPTION 'SUPER_ADMIN user cannot be assigned to a specific tenant'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        IF NEW.tenant_id IS NULL THEN
            RAISE EXCEPTION 'Role % requires a valid tenant_id', v_role_name
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_role_tenant_rule ON users;
CREATE TRIGGER trg_user_role_tenant_rule
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION fn_user_role_tenant_rule();

-- ------------------------------------------------------------------------------
-- 7. Trigger: trg_license_auto_expire
-- Automatically transitions license status to EXPIRED whenever end_date is in the past.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_license_auto_expire()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE AND NEW.status = 'ACTIVE' THEN
        NEW.status := 'EXPIRED';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_license_auto_expire ON licenses;
CREATE TRIGGER trg_license_auto_expire
BEFORE INSERT OR UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION fn_license_auto_expire();

-- ------------------------------------------------------------------------------
-- 8. Trigger: trg_plan_limits
-- Enforces subscription tier quotas (max_assets, max_users) defined in plans.
-- Blocks inserts when limits are reached.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_plan_asset_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_assets INT;
    v_current_assets INT;
BEGIN
    -- Query max allowed assets for tenant's plan
    SELECT p.max_assets INTO v_max_assets
    FROM tenants t
    JOIN plans p ON p.id = t.plan_id
    WHERE t.id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Count existing active assets
    SELECT COUNT(*) INTO v_current_assets
    FROM assets
    WHERE tenant_id = NEW.tenant_id
      AND deleted_at IS NULL;

    IF v_current_assets >= v_max_assets THEN
        RAISE EXCEPTION 'Tenant asset limit of % exceeded for current subscription plan', v_max_assets
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_asset_limit ON assets;
CREATE TRIGGER trg_plan_asset_limit
BEFORE INSERT ON assets
FOR EACH ROW
EXECUTE FUNCTION fn_plan_asset_limit();

CREATE OR REPLACE FUNCTION fn_plan_user_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_users INT;
    v_current_users INT;
BEGIN
    -- Only evaluate if tenant_id is provided (non super-admins)
    IF NEW.tenant_id IS NOT NULL THEN
        SELECT p.max_users INTO v_max_users
        FROM tenants t
        JOIN plans p ON p.id = t.plan_id
        WHERE t.id = NEW.tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        SELECT COUNT(*) INTO v_current_users
        FROM users
        WHERE tenant_id = NEW.tenant_id;

        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Tenant user limit of % exceeded for current subscription plan', v_max_users
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_user_limit ON users;
CREATE TRIGGER trg_plan_user_limit
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION fn_plan_user_limit();

-- ------------------------------------------------------------------------------
-- 10. Cross-Tenant Integrity Enforcement Triggers
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_asset_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_tenant UUID;
    v_cat_tenant UUID;
BEGIN
    -- Verify asset owner belongs to the same tenant
    SELECT tenant_id INTO v_owner_tenant
    FROM users
    WHERE id = NEW.owner_id;

    IF v_owner_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Asset owner % belongs to tenant %, not asset tenant %',
            NEW.owner_id, v_owner_tenant, NEW.tenant_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- Verify category belongs to the same tenant if assigned
    IF NEW.category_id IS NOT NULL THEN
        SELECT tenant_id INTO v_cat_tenant
        FROM categories
        WHERE id = NEW.category_id;

        IF v_cat_tenant IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'Cross-tenant violation: Category % belongs to tenant %, not asset tenant %',
                NEW.category_id, v_cat_tenant, NEW.tenant_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_asset_tenant ON assets;
CREATE TRIGGER trg_enforce_asset_tenant
BEFORE INSERT OR UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_asset_tenant();

CREATE OR REPLACE FUNCTION fn_enforce_license_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_vendor_tenant UUID;
BEGIN
    -- Verify vendor belongs to the same tenant
    SELECT tenant_id INTO v_vendor_tenant
    FROM vendors
    WHERE id = NEW.vendor_id;

    IF v_vendor_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Vendor % belongs to tenant %, not license tenant %',
            NEW.vendor_id, v_vendor_tenant, NEW.tenant_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_license_tenant ON licenses;
CREATE TRIGGER trg_enforce_license_tenant
BEFORE INSERT OR UPDATE ON licenses
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_license_tenant();

