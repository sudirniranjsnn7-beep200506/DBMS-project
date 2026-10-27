-- ==============================================================================
-- AssetVault: Advanced Database Objects Migration
-- Migration Name: 20261012162234_advanced_db_objects
-- Includes: Analytical Views, Materialized Views, PL/pgSQL Procedures & Functions,
--           Integrity/Audit Triggers, Application Role, and Row-Level Security
-- ==============================================================================

-- Ensure Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Re-assert Trigram Search Indexes if not present
CREATE INDEX IF NOT EXISTS "idx_assets_name_trgm" ON "assets" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_licenses_name_trgm" ON "licenses" USING gin ("name" gin_trgm_ops);

-- ==============================================================================
-- 1. ANALYTICAL & REPORTING VIEWS
-- ==============================================================================

-- 1.1 View: v_license_utilization
DROP VIEW IF EXISTS v_license_utilization CASCADE;
CREATE OR REPLACE VIEW v_license_utilization AS
SELECT 
    l.id AS license_id,
    l.tenant_id,
    l.vendor_id,
    l.license_type_id,
    l.name AS license_name,
    v.name AS vendor_name,
    lt.name AS license_type,
    l.total_seats,
    COUNT(la.id) FILTER (WHERE la.status = 'ACTIVE') AS used_seats,
    GREATEST(0, l.total_seats - COUNT(la.id) FILTER (WHERE la.status = 'ACTIVE')) AS available_seats,
    ROUND(
        (COUNT(la.id) FILTER (WHERE la.status = 'ACTIVE')::NUMERIC / NULLIF(l.total_seats, 0)::NUMERIC) * 100, 
        2
    ) AS utilization_pct,
    CASE 
        WHEN l.end_date IS NULL THEN NULL 
        ELSE (l.end_date - CURRENT_DATE) 
    END AS days_to_expiry,
    l.status,
    l.start_date,
    l.end_date,
    l.cost,
    l.currency
FROM licenses l
JOIN vendors v ON v.id = l.vendor_id
JOIN license_types lt ON lt.id = l.license_type_id
LEFT JOIN license_allocations la ON la.license_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.tenant_id, l.vendor_id, l.license_type_id, l.name, v.name, lt.name, l.total_seats, l.end_date, l.status, l.start_date, l.cost, l.currency;

-- 1.2 View: v_expiring_licenses
CREATE OR REPLACE VIEW v_expiring_licenses AS
SELECT 
    l.id AS license_id,
    l.tenant_id,
    l.name AS license_name,
    v.name AS vendor_name,
    l.license_key,
    l.total_seats,
    COUNT(la.id) FILTER (WHERE la.status = 'ACTIVE') AS active_allocations,
    l.start_date,
    l.end_date,
    (l.end_date - CURRENT_DATE)::INT AS days_left,
    CASE 
        WHEN (l.end_date - CURRENT_DATE) <= 7 THEN 'CRITICAL'
        WHEN (l.end_date - CURRENT_DATE) <= 15 THEN 'WARNING'
        ELSE 'NOTICE'
    END AS urgency_bucket,
    l.cost,
    l.currency,
    l.auto_renew
FROM licenses l
JOIN vendors v ON v.id = l.vendor_id
LEFT JOIN license_allocations la ON la.license_id = l.id
WHERE l.deleted_at IS NULL
  AND l.status = 'ACTIVE'
  AND l.end_date IS NOT NULL
  AND l.end_date >= CURRENT_DATE
  AND l.end_date <= (CURRENT_DATE + INTERVAL '30 days')
GROUP BY l.id, l.tenant_id, l.name, v.name, l.license_key, l.total_seats, l.start_date, l.end_date, l.cost, l.currency, l.auto_renew;

-- 1.3 View: v_asset_catalog
DROP VIEW IF EXISTS v_asset_catalog CASCADE;
CREATE OR REPLACE VIEW v_asset_catalog AS
WITH latest_versions AS (
    SELECT 
        asset_id,
        MAX(version_no) AS latest_version_no,
        COUNT(id) AS total_versions
    FROM asset_versions
    GROUP BY asset_id
),
asset_tag_list AS (
    SELECT 
        at.asset_id,
        COALESCE(array_agg(t.name ORDER BY t.name), ARRAY[]::VARCHAR[]) AS tags
    FROM asset_tags at
    JOIN tags t ON t.id = at.tag_id
    GROUP BY at.asset_id
),
active_covering_licenses AS (
    SELECT 
        al.asset_id,
        COUNT(l.id) AS total_covering_licenses,
        COUNT(l.id) FILTER (
            WHERE l.status = 'ACTIVE' 
              AND l.deleted_at IS NULL 
              AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
        ) AS valid_active_licenses_count
    FROM asset_licenses al
    JOIN licenses l ON l.id = al.license_id
    GROUP BY al.asset_id
)
SELECT 
    a.id AS asset_id,
    a.tenant_id,
    a.category_id,
    a.owner_id,
    a.asset_code,
    a.name AS asset_name,
    a.description,
    a.asset_type,
    a.status AS asset_status,
    c.name AS category_name,
    u.full_name AS owner_name,
    u.email AS owner_email,
    COALESCE(lv.latest_version_no, 0) AS latest_version_no,
    COALESCE(lv.total_versions, 0) AS total_versions,
    COALESCE(atl.tags, ARRAY[]::VARCHAR[]) AS tags,
    COALESCE(acl.total_covering_licenses, 0) AS covering_licenses_count,
    CASE 
        WHEN COALESCE(acl.valid_active_licenses_count, 0) > 0 THEN 'COMPLIANT'
        WHEN COALESCE(acl.total_covering_licenses, 0) > 0 THEN 'EXPIRED_LICENSE'
        ELSE 'UNLICENSED'
    END AS compliance_status,
    a.created_at,
    a.updated_at
FROM assets a
LEFT JOIN categories c ON c.id = a.category_id
JOIN users u ON u.id = a.owner_id
LEFT JOIN latest_versions lv ON lv.asset_id = a.id
LEFT JOIN asset_tag_list atl ON atl.asset_id = a.id
LEFT JOIN active_covering_licenses acl ON acl.asset_id = a.id
WHERE a.deleted_at IS NULL;

-- 1.4 View: v_vendor_spend
CREATE OR REPLACE VIEW v_vendor_spend AS
SELECT 
    v.tenant_id,
    v.id AS vendor_id,
    v.name AS vendor_name,
    v.contact_email,
    COUNT(DISTINCT l.id) AS license_count,
    COALESCE(SUM(l.cost), 0)::NUMERIC(12,2) AS total_initial_cost,
    COALESCE(SUM(lr.cost), 0)::NUMERIC(12,2) AS total_renewal_cost,
    (COALESCE(SUM(l.cost), 0) + COALESCE(SUM(lr.cost), 0))::NUMERIC(12,2) AS grand_total_spend,
    COALESCE(SUM(l.total_seats), 0) AS total_seats_contracted,
    ROUND(
        (COALESCE(SUM(l.cost), 0) + COALESCE(SUM(lr.cost), 0)) / NULLIF(SUM(l.total_seats), 0),
        2
    ) AS avg_cost_per_seat
FROM vendors v
LEFT JOIN licenses l ON l.vendor_id = v.id AND l.deleted_at IS NULL
LEFT JOIN license_renewals lr ON lr.license_id = l.id
GROUP BY v.tenant_id, v.id, v.name, v.contact_email;

-- 1.5 View: v_tenant_summary
CREATE OR REPLACE VIEW v_tenant_summary AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug,
    t.status AS tenant_status,
    p.name AS plan_name,
    p.max_users,
    p.max_assets,
    p.monthly_price AS plan_monthly_price,
    COALESCE(u.user_count, 0) AS user_count,
    COALESCE(a.asset_count, 0) AS asset_count,
    COALESCE(l.license_count, 0) AS license_count,
    COALESCE(la.active_seats_count, 0) AS active_seats_count,
    (COALESCE(l.total_initial_cost, 0) + COALESCE(lr.total_renewal_cost, 0))::NUMERIC(12,2) AS total_license_spend,
    t.created_at AS onboarded_at
FROM tenants t
JOIN plans p ON p.id = t.plan_id
LEFT JOIN (
    SELECT tenant_id, COUNT(id) AS user_count 
    FROM users 
    GROUP BY tenant_id
) u ON u.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id, COUNT(id) AS asset_count 
    FROM assets 
    WHERE deleted_at IS NULL 
    GROUP BY tenant_id
) a ON a.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id, COUNT(id) AS license_count, SUM(cost) AS total_initial_cost 
    FROM licenses 
    WHERE deleted_at IS NULL 
    GROUP BY tenant_id
) l ON l.tenant_id = t.id
LEFT JOIN (
    SELECT lic.tenant_id, COUNT(la.id) AS active_seats_count
    FROM license_allocations la
    JOIN licenses lic ON lic.id = la.license_id
    WHERE la.status = 'ACTIVE' AND lic.deleted_at IS NULL
    GROUP BY lic.tenant_id
) la ON la.tenant_id = t.id
LEFT JOIN (
    SELECT lic.tenant_id, SUM(lr.cost) AS total_renewal_cost
    FROM license_renewals lr
    JOIN licenses lic ON lic.id = lr.license_id
    GROUP BY lic.tenant_id
) lr ON lr.tenant_id = t.id;

-- 1.6 Materialized View: mv_monthly_access_stats & Refresh Routine
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_access_stats CASCADE;

CREATE MATERIALIZED VIEW mv_monthly_access_stats AS
SELECT 
    a.tenant_id,
    TO_CHAR(aal.accessed_at, 'YYYY-MM') AS month_year,
    COUNT(aal.id) FILTER (WHERE aal.action = 'DOWNLOAD') AS download_count,
    COUNT(aal.id) FILTER (WHERE aal.action = 'CHECKOUT') AS checkout_count,
    COUNT(aal.id) FILTER (WHERE aal.action = 'VIEW') AS view_count,
    COUNT(aal.id) FILTER (WHERE aal.action = 'CHECKIN') AS checkin_count,
    COUNT(aal.id) AS total_access_events,
    COUNT(DISTINCT aal.user_id) AS active_accessing_users,
    COUNT(DISTINCT aal.asset_id) AS distinct_assets_accessed
FROM asset_access_logs aal
JOIN assets a ON a.id = aal.asset_id
GROUP BY a.tenant_id, TO_CHAR(aal.accessed_at, 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_access_unique ON mv_monthly_access_stats (tenant_id, month_year);

CREATE OR REPLACE FUNCTION fn_refresh_monthly_access_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. STORED PROCEDURES & FUNCTIONS
-- ==============================================================================

-- 2.1 PROCEDURE: sp_allocate_license_seat
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

    SELECT id, tenant_id, name, total_seats, status, end_date, deleted_at
    INTO v_license
    FROM licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF NOT FOUND OR v_license.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'License % does not exist or has been deleted', p_license_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF v_license.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'License % is not ACTIVE (current status: %)', v_license.name, v_license.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_license.end_date IS NOT NULL AND v_license.end_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'License % expired on %', v_license.name, v_license.end_date
            USING ERRCODE = 'check_violation';
    END IF;

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

    SELECT COUNT(*)
    INTO v_used_seats
    FROM license_allocations
    WHERE license_id = p_license_id
      AND status = 'ACTIVE';

    IF v_used_seats >= v_license.total_seats THEN
        RAISE EXCEPTION 'License seats exhausted'
            USING ERRCODE = 'check_violation';
    END IF;

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

ALTER TABLE license_allocations ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2.2 PROCEDURE: sp_release_license_seat
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

-- 2.3 PROCEDURE: sp_renew_license
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

    SELECT *
    INTO v_license
    FROM licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF NOT FOUND OR v_license.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'License % not found or has been deleted', p_license_id
            USING ERRCODE = 'no_data_found';
    END IF;

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

    UPDATE licenses
    SET start_date = COALESCE(v_old_end_date, start_date),
        end_date = p_new_end_date,
        status = 'ACTIVE',
        updated_at = NOW()
    WHERE id = p_license_id;
END;
$$;

-- 2.4 FUNCTION: fn_generate_expiry_notifications
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

        FOR v_admin IN
            SELECT u.id, u.full_name
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.tenant_id = p_tenant_id
              AND u.is_active = TRUE
              AND r.name IN ('TENANT_ADMIN', 'ASSET_MANAGER')
        LOOP
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

-- 2.5 FUNCTION: fn_tenant_dashboard_stats
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

-- 2.6 FUNCTION: fn_asset_license_compliance
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


-- ==============================================================================
-- 3. TRIGGERS & INTEGRITY RULES
-- ==============================================================================

-- 3.1 Updated At Timestamp Trigger
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

-- 3.2 Audit Log Trigger (With password_hash stripping)
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
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_new_data := to_jsonb(NEW);
    END IF;

    IF TG_TABLE_NAME = 'users' THEN
        IF v_old_data IS NOT NULL THEN
            v_old_data := v_old_data - 'password_hash';
        END IF;
        IF v_new_data IS NOT NULL THEN
            v_new_data := v_new_data - 'password_hash';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
    ELSE
        v_record_id := NEW.id;
    END IF;

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

    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF v_user_id IS NULL THEN
        IF TG_TABLE_NAME = 'license_allocations' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.allocated_by ELSE NEW.allocated_by END;
        ELSIF TG_TABLE_NAME = 'assets' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
        ELSIF TG_TABLE_NAME = 'license_renewals' THEN
            v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.renewed_by ELSE NEW.renewed_by END;
        END IF;
    END IF;

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

-- 3.3 Immutable Audit Logs Trigger
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

-- 3.4 Seat Capacity Check Trigger
CREATE OR REPLACE FUNCTION fn_check_seat_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_seats INT;
    v_active_seats INT;
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        SELECT total_seats INTO v_total_seats
        FROM licenses
        WHERE id = NEW.license_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'License % not found', NEW.license_id
                USING ERRCODE = 'no_data_found';
        END IF;

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

-- 3.5 Cross-Tenant Isolation Enforcement Triggers
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

-- 3.6 User Role Tenancy Domain Rules Trigger
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

-- 3.7 Automatic License Expiration Trigger
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

-- 3.8 Subscription Plan Quota Limits Triggers
CREATE OR REPLACE FUNCTION fn_plan_asset_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_assets INT;
    v_current_assets INT;
BEGIN
    SELECT p.max_assets INTO v_max_assets
    FROM tenants t
    JOIN plans p ON p.id = t.plan_id
    WHERE t.id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

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

-- Cross-Tenant Integrity Enforcement Triggers
CREATE OR REPLACE FUNCTION fn_enforce_asset_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_tenant UUID;
    v_cat_tenant UUID;
BEGIN
    SELECT tenant_id INTO v_owner_tenant
    FROM users
    WHERE id = NEW.owner_id;

    IF v_owner_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant violation: Asset owner % belongs to tenant %, not asset tenant %',
            NEW.owner_id, v_owner_tenant, NEW.tenant_id
            USING ERRCODE = 'check_violation';
    END IF;

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


-- ==============================================================================
-- 4. ROW-LEVEL SECURITY & APPLICATION ROLE
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'assetvault_app') THEN
        CREATE ROLE assetvault_app WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO assetvault_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assetvault_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assetvault_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assetvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO assetvault_app;

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

-- Top-Level Table Policies
DROP POLICY IF EXISTS rls_tenants_isolation ON tenants;
CREATE POLICY rls_tenants_isolation ON tenants
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_users_isolation ON users;
CREATE POLICY rls_users_isolation ON users
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_vendors_isolation ON vendors;
CREATE POLICY rls_vendors_isolation ON vendors
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_categories_isolation ON categories;
CREATE POLICY rls_categories_isolation ON categories
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_assets_isolation ON assets;
CREATE POLICY rls_assets_isolation ON assets
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_licenses_isolation ON licenses;
CREATE POLICY rls_licenses_isolation ON licenses
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_tags_isolation ON tags;
CREATE POLICY rls_tags_isolation ON tags
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_notifications_isolation ON notifications;
CREATE POLICY rls_notifications_isolation ON notifications
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

DROP POLICY IF EXISTS rls_audit_logs_isolation ON audit_logs;
CREATE POLICY rls_audit_logs_isolation ON audit_logs
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (tenant_id = fn_current_tenant_id() OR fn_is_super_admin())
WITH CHECK (tenant_id = fn_current_tenant_id() OR fn_is_super_admin());

-- Child Table Policies
DROP POLICY IF EXISTS rls_asset_versions_isolation ON asset_versions;
CREATE POLICY rls_asset_versions_isolation ON asset_versions
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_versions.asset_id AND a.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_versions.asset_id AND a.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_asset_tags_isolation ON asset_tags;
CREATE POLICY rls_asset_tags_isolation ON asset_tags
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_tags.asset_id AND a.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_tags.asset_id AND a.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_asset_licenses_isolation ON asset_licenses;
CREATE POLICY rls_asset_licenses_isolation ON asset_licenses
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_licenses.asset_id AND a.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_licenses.asset_id AND a.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_license_allocations_isolation ON license_allocations;
CREATE POLICY rls_license_allocations_isolation ON license_allocations
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM licenses l WHERE l.id = license_allocations.license_id AND l.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM licenses l WHERE l.id = license_allocations.license_id AND l.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_license_renewals_isolation ON license_renewals;
CREATE POLICY rls_license_renewals_isolation ON license_renewals
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM licenses l WHERE l.id = license_renewals.license_id AND l.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM licenses l WHERE l.id = license_renewals.license_id AND l.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_asset_access_logs_isolation ON asset_access_logs;
CREATE POLICY rls_asset_access_logs_isolation ON asset_access_logs
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_access_logs.asset_id AND a.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_access_logs.asset_id AND a.tenant_id = fn_current_tenant_id()));

DROP POLICY IF EXISTS rls_refresh_tokens_isolation ON refresh_tokens;
CREATE POLICY rls_refresh_tokens_isolation ON refresh_tokens
AS PERMISSIVE FOR ALL TO assetvault_app, PUBLIC
USING (fn_is_super_admin() OR EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens.user_id AND u.tenant_id = fn_current_tenant_id()))
WITH CHECK (fn_is_super_admin() OR EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens.user_id AND u.tenant_id = fn_current_tenant_id()));
