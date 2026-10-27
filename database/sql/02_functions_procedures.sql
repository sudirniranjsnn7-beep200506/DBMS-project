-- ==============================================================================
-- AssetVault: Stored Procedures & Functions Specification
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 02_functions_procedures.sql: Transactional PL/pgSQL Business Routines
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROCEDURE: sp_allocate_license_seat
-- Allocates a license seat to a user with row-level concurrency locking (SELECT FOR UPDATE).
-- Enforces:
--   - License status = ACTIVE and unexpired
--   - User active and belongs to the same tenant
--   - User does not already hold an ACTIVE allocation for this license
--   - Used seats < total seats (ERRCODE 'check_violation')
-- Emits an audit log entry on completion.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_allocate_license_seat(
    p_license_id UUID,
    p_user_id UUID,
    p_allocated_by UUID,
    INOUT p_allocation_id UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_license RECORD;
    v_user RECORD;
    v_used_seats INT;
    v_existing_alloc INT;
BEGIN
    -- Ensure session context for actor so audit triggers capture user_id
    IF p_allocated_by IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_allocated_by::TEXT, true);
    END IF;

    -- 1. Lock the license row to guarantee serialized seat counter checks
    SELECT id, tenant_id, name, total_seats, status, end_date, deleted_at
    INTO v_license
    FROM licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF NOT FOUND OR v_license.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'License % does not exist or has been deleted', p_license_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- 2. Verify license is ACTIVE and not expired
    IF v_license.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'License % is not ACTIVE (current status: %)', v_license.name, v_license.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_license.end_date IS NOT NULL AND v_license.end_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'License % expired on %', v_license.name, v_license.end_date
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3. Verify user exists, is active, and shares the same tenant
    SELECT id, tenant_id, full_name, is_active
    INTO v_user
    FROM users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NOT v_user.is_active THEN
        RAISE EXCEPTION 'User % (%) is inactive', v_user.full_name, p_user_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_user.tenant_id IS DISTINCT FROM v_license.tenant_id THEN
        RAISE EXCEPTION 'Tenant mismatch: License belongs to tenant % but user belongs to tenant %',
            v_license.tenant_id, v_user.tenant_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- 4. Verify user does not already hold an ACTIVE allocation for this license
    SELECT COUNT(*)
    INTO v_existing_alloc
    FROM license_allocations
    WHERE license_id = p_license_id
      AND user_id = p_user_id
      AND status = 'ACTIVE';

    IF v_existing_alloc > 0 THEN
        RAISE EXCEPTION 'User % already holds an active seat for license %', v_user.full_name, v_license.name
            USING ERRCODE = 'unique_violation';
    END IF;

    -- 5. Count current active seats and enforce total_seats limit
    SELECT COUNT(*)
    INTO v_used_seats
    FROM license_allocations
    WHERE license_id = p_license_id
      AND status = 'ACTIVE';

    IF v_used_seats >= v_license.total_seats THEN
        RAISE EXCEPTION 'License seats exhausted'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 6. Insert new allocation
    INSERT INTO license_allocations (
        id,
        license_id,
        user_id,
        allocated_by,
        allocated_at,
        status
    )
    VALUES (
        gen_random_uuid(),
        p_license_id,
        p_user_id,
        p_allocated_by,
        NOW(),
        'ACTIVE'
    )
    RETURNING id INTO p_allocation_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. PROCEDURE: sp_release_license_seat
-- Revokes an active seat allocation, records timestamp, and logs an audit trail.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_release_license_seat(
    p_allocation_id UUID,
    p_revoked_by UUID,
    p_reason TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_alloc RECORD;
    v_tenant_id UUID;
BEGIN
    -- Ensure session context for actor so audit triggers capture user_id
    IF p_revoked_by IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_revoked_by::TEXT, true);
    END IF;

    -- Pass the reason into the session context
    PERFORM set_config('app.audit_reason', COALESCE(p_reason, ''), true);

    -- 1. Lock allocation row
    SELECT la.*, l.tenant_id AS lic_tenant_id, l.name AS license_name
    INTO v_alloc
    FROM license_allocations la
    JOIN licenses l ON l.id = la.license_id
    WHERE la.id = p_allocation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation % not found', p_allocation_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF v_alloc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Allocation % is not ACTIVE (current status: %)', p_allocation_id, v_alloc.status
            USING ERRCODE = 'check_violation';
    END IF;

    v_tenant_id := v_alloc.lic_tenant_id;

    -- 2. Update status to REVOKED and append reason to notes
    UPDATE license_allocations
    SET status = 'REVOKED',
        released_at = NOW(),
        notes = CASE
            WHEN p_reason IS NOT NULL AND p_reason <> ''
            THEN COALESCE(notes || ' | ', '') || 'Revoked: ' || p_reason
            ELSE notes
        END
    WHERE id = p_allocation_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. PROCEDURE: sp_renew_license
-- Extends a license validity date, logs renewal ledger entry, and restores status.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_renew_license(
    p_license_id UUID,
    p_new_end_date DATE,
    p_cost NUMERIC(12,2),
    p_performed_by UUID,
    p_notes TEXT DEFAULT NULL,
    INOUT p_renewal_id UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_license RECORD;
    v_performer RECORD;
    v_old_end_date DATE;
    v_old_status license_status;
BEGIN
    -- Ensure session context for actor so audit triggers capture user_id
    IF p_performed_by IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_performed_by::TEXT, true);
    END IF;

    -- 1. Lock license row
    SELECT *
    INTO v_license
    FROM licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF NOT FOUND OR v_license.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'License % not found or has been deleted', p_license_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- 2. Validate performer privileges and tenant alignment
    SELECT u.id, u.tenant_id, r.name AS role_name
    INTO v_performer
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = p_performed_by;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Performer user % not found', p_performed_by
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_performer.role_name <> 'SUPER_ADMIN' AND v_performer.tenant_id IS DISTINCT FROM v_license.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant license renewal forbidden'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 3. Validate new expiration date
    IF v_license.end_date IS NOT NULL AND p_new_end_date <= v_license.end_date THEN
        RAISE EXCEPTION 'New expiration date (%) must be after current expiration date (%)',
            p_new_end_date, v_license.end_date
            USING ERRCODE = 'check_violation';
    END IF;

    IF p_new_end_date <= CURRENT_DATE THEN
        RAISE EXCEPTION 'New expiration date (%) must be in the future', p_new_end_date
            USING ERRCODE = 'check_violation';
    END IF;

    v_old_end_date := v_license.end_date;
    v_old_status := v_license.status;

    -- 4. Record entry in license_renewals ledger
    INSERT INTO license_renewals (
        id,
        license_id,
        renewed_by,
        old_end_date,
        new_end_date,
        cost,
        notes,
        renewed_at
    )
    VALUES (
        gen_random_uuid(),
        p_license_id,
        p_performed_by,
        COALESCE(v_old_end_date, CURRENT_DATE),
        p_new_end_date,
        p_cost,
        p_notes,
        NOW()
    )
    RETURNING id INTO p_renewal_id;

    -- 5. Update license record
    UPDATE licenses
    SET start_date = COALESCE(v_old_end_date, start_date),
        end_date = p_new_end_date,
        status = 'ACTIVE',
        updated_at = NOW()
    WHERE id = p_license_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNCTION: fn_generate_expiry_notifications
-- Detects licenses terminating within p_lookahead_days and generates alerts
-- for TENANT_ADMIN and ASSET_MANAGER roles, deduplicating within a 24-hour window.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_expiry_notifications(
    p_tenant_id UUID,
    p_lookahead_days INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT := 0;
    v_lic RECORD;
    v_admin RECORD;
    v_days_left INT;
    v_notif_type notification_type;
    v_already_notified BOOLEAN;
    v_tenant_status tenant_status;
BEGIN
    -- Only generate notifications for eligible tenants (ACTIVE or TRIAL; exclude SUSPENDED/CANCELLED)
    SELECT status INTO v_tenant_status
    FROM tenants
    WHERE id = p_tenant_id;

    IF v_tenant_status IS NULL OR v_tenant_status NOT IN ('ACTIVE', 'TRIAL') THEN
        RETURN 0;
    END IF;

    FOR v_lic IN
        SELECT id, name, end_date
        FROM licenses
        WHERE tenant_id = p_tenant_id
          AND status = 'ACTIVE'
          AND deleted_at IS NULL
          AND end_date IS NOT NULL
          AND end_date >= CURRENT_DATE
          AND end_date <= (CURRENT_DATE + (p_lookahead_days || ' days')::INTERVAL)
    LOOP
        v_days_left := (v_lic.end_date - CURRENT_DATE)::INT;

        IF v_days_left <= 7 THEN
            v_notif_type := 'EXPIRY_7';
        ELSIF v_days_left <= 15 THEN
            v_notif_type := 'EXPIRY_15';
        ELSE
            v_notif_type := 'EXPIRY_30';
        END IF;

        -- Target TENANT_ADMIN and ASSET_MANAGER in the tenant
        FOR v_admin IN
            SELECT u.id, u.full_name
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.tenant_id = p_tenant_id
              AND u.is_active = TRUE
              AND r.name IN ('TENANT_ADMIN', 'ASSET_MANAGER')
        LOOP
            -- Check for existing notification in the last 24 hours
            SELECT EXISTS (
                SELECT 1
                FROM notifications
                WHERE tenant_id = p_tenant_id
                  AND user_id = v_admin.id
                  AND license_id = v_lic.id
                  AND type = v_notif_type
                  AND created_at >= (NOW() - INTERVAL '24 hours')
            ) INTO v_already_notified;

            IF NOT v_already_notified THEN
                INSERT INTO notifications (
                    id,
                    tenant_id,
                    user_id,
                    license_id,
                    type,
                    message,
                    is_read,
                    created_at
                )
                VALUES (
                    gen_random_uuid(),
                    p_tenant_id,
                    v_admin.id,
                    v_lic.id,
                    v_notif_type,
                    format('License "%s" will expire in %s days on %s.', v_lic.name, v_days_left, v_lic.end_date),
                    FALSE,
                    NOW()
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: fn_tenant_dashboard_stats
-- Returns consolidated dashboard operational and financial KPIs in JSONB format.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tenant_dashboard_stats(
    p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tenant_id', p_tenant_id,
        'total_assets', COALESCE((
            SELECT COUNT(*) 
            FROM assets 
            WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
        ), 0),
        'total_licenses', COALESCE((
            SELECT COUNT(*) 
            FROM licenses 
            WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
        ), 0),
        'total_seats', COALESCE((
            SELECT SUM(total_seats) 
            FROM licenses 
            WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
        ), 0),
        'allocated_seats', COALESCE((
            SELECT COUNT(la.id) 
            FROM license_allocations la
            JOIN licenses l ON l.id = la.license_id
            WHERE l.tenant_id = p_tenant_id 
              AND la.status = 'ACTIVE'
              AND l.deleted_at IS NULL
        ), 0),
        'expiring_in_30_days', COALESCE((
            SELECT COUNT(*) 
            FROM licenses 
            WHERE tenant_id = p_tenant_id 
              AND status = 'ACTIVE' 
              AND deleted_at IS NULL
              AND end_date IS NOT NULL
              AND end_date >= CURRENT_DATE 
              AND end_date <= (CURRENT_DATE + INTERVAL '30 days')
        ), 0),
        'monthly_plan_price', COALESCE((
            SELECT p.monthly_price
            FROM tenants t
            JOIN plans p ON p.id = t.plan_id
            WHERE t.id = p_tenant_id
        ), 0.00),
        'total_license_cost', COALESCE((
            SELECT SUM(cost)
            FROM licenses
            WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
        ), 0.00),
        'storage_used_bytes', COALESCE((
            SELECT SUM(av.file_size_bytes)
            FROM asset_versions av
            JOIN assets a ON a.id = av.asset_id
            WHERE a.tenant_id = p_tenant_id AND a.deleted_at IS NULL
        ), 0),
        'user_count', COALESCE((
            SELECT COUNT(*)
            FROM users
            WHERE tenant_id = p_tenant_id AND is_active = TRUE
        ), 0),
        'unlicensed_assets_count', COALESCE((
            SELECT COUNT(*)
            FROM v_asset_catalog
            WHERE tenant_id = p_tenant_id AND compliance_status = 'UNLICENSED'
        ), 0),
        'asset_type_breakdown', COALESCE((
            SELECT jsonb_object_agg(asset_type, cnt)
            FROM (
                SELECT asset_type::TEXT, COUNT(*)::INT AS cnt
                FROM assets
                WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
                GROUP BY asset_type
            ) sub
        ), '{}'::jsonb)
    ) INTO v_stats;

    RETURN v_stats;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. FUNCTION: fn_asset_license_compliance
-- Evaluates compliance status of an asset against associated software licenses.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_asset_license_compliance(
    p_asset_id UUID
)
RETURNS TABLE (
    license_id UUID,
    license_name VARCHAR,
    vendor_name VARCHAR,
    status license_status,
    is_valid BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_asset_exists BOOLEAN;
    v_has_coverage BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM assets WHERE id = p_asset_id AND deleted_at IS NULL
    ) INTO v_asset_exists;

    IF NOT v_asset_exists THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            NULL::VARCHAR, 
            NULL::VARCHAR, 
            NULL::license_status, 
            FALSE, 
            'Asset does not exist or has been deleted'::TEXT;
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM asset_licenses WHERE asset_id = p_asset_id
    ) INTO v_has_coverage;

    IF NOT v_has_coverage THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            'None'::VARCHAR, 
            'None'::VARCHAR, 
            NULL::license_status, 
            FALSE, 
            'UNLICENSED: No covering license attached to this asset'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        l.id AS license_id,
        l.name AS license_name,
        v.name AS vendor_name,
        l.status,
        (
            l.status = 'ACTIVE' 
            AND l.deleted_at IS NULL 
            AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
        ) AS is_valid,
        CASE
            WHEN l.deleted_at IS NOT NULL THEN 'Covering license record has been soft-deleted'
            WHEN l.status <> 'ACTIVE' THEN 'Covering license status is ' || l.status::TEXT
            WHEN l.end_date IS NOT NULL AND l.end_date < CURRENT_DATE THEN 'Covering license expired on ' || l.end_date::TEXT
            ELSE 'COMPLIANT: Active license in good standing'
        END AS message
    FROM asset_licenses al
    JOIN licenses l ON l.id = al.license_id
    JOIN vendors v ON v.id = l.vendor_id
    WHERE al.asset_id = p_asset_id;
END;
$$;
