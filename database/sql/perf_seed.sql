-- ==============================================================================
-- AssetVault: Bulk Performance Benchmarking Dataset Generator
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- perf_seed.sql: Rapid Set-Based Generation of 50k Assets, 5k Licenses, 200k Logs
-- ==============================================================================

DO $$
DECLARE
    v_perf_tenant UUID;
    v_owner_id UUID;
    v_vendor_id UUID;
    v_cat_id UUID;
    v_lic_type_id INT;
    v_asset_ids UUID[];
    v_lic_ids UUID[];
BEGIN
    -- Query valid references from existing techcorp seed
    SELECT id INTO v_perf_tenant FROM tenants WHERE slug = 'techcorp' LIMIT 1;
    SELECT id INTO v_owner_id FROM users WHERE tenant_id = v_perf_tenant LIMIT 1;
    SELECT id INTO v_vendor_id FROM vendors WHERE tenant_id = v_perf_tenant LIMIT 1;
    SELECT id INTO v_cat_id FROM categories WHERE tenant_id = v_perf_tenant LIMIT 1;
    SELECT id INTO v_lic_type_id FROM license_types LIMIT 1;

    -- Temporarily disable plan limit and audit triggers for high-speed batch insertion
    ALTER TABLE assets DISABLE TRIGGER trg_plan_asset_limit;
    ALTER TABLE assets DISABLE TRIGGER trg_audit_assets;
    ALTER TABLE licenses DISABLE TRIGGER trg_audit_licenses;

    RAISE NOTICE 'Starting bulk generation of 5,000 licenses...';

    -- 1. Generate 5,000 Licenses
    INSERT INTO licenses (
        id,
        tenant_id,
        vendor_id,
        license_type_id,
        name,
        license_key,
        total_seats,
        start_date,
        end_date,
        cost,
        currency,
        auto_renew,
        status,
        terms
    )
    SELECT
        gen_random_uuid(),
        v_perf_tenant,
        v_vendor_id,
        v_lic_type_id,
        'Enterprise Suite Contract #' || i,
        'LIC-PERF-KEY-' || LPAD(i::TEXT, 6, '0') || '-' || SUBSTRING(md5(random()::TEXT), 1, 8),
        10 + (i % 500),
        CURRENT_DATE - (365 || ' days')::INTERVAL,
        CURRENT_DATE + (((i % 90) - 20) || ' days')::INTERVAL, -- varied horizons: expired to upcoming
        (100 + (i % 5000))::NUMERIC(12,2),
        'USD',
        (i % 2 = 0),
        CASE WHEN (i % 10 = 0) THEN 'EXPIRED'::license_status ELSE 'ACTIVE'::license_status END,
        'Standard bulk synthetic commercial license terms agreement.'
    FROM generate_series(1, 5000) AS i
    ON CONFLICT (tenant_id, license_key) DO NOTHING;

    RAISE NOTICE '5,000 licenses generated. Starting bulk generation of 50,000 assets...';

    -- 2. Generate 50,000 Assets
    INSERT INTO assets (
        id,
        tenant_id,
        category_id,
        owner_id,
        asset_code,
        name,
        description,
        asset_type,
        status,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        v_perf_tenant,
        v_cat_id,
        v_owner_id,
        'AST-PERF-' || LPAD(i::TEXT, 7, '0'),
        'Asset #' || i || ' ' || (ARRAY['Production Logo Kit', 'Telemetry Dataset', 'UI Master Vector', 'Font Family Bold', 'Marketing Promo 4K', 'Core Library Source'])[1 + (i % 6)],
        'High resolution production artifact generated for stress-testing and index execution analysis #' || i,
        (ARRAY['FONT', 'IMAGE', 'VIDEO', 'AUDIO', 'SOFTWARE', 'DATASET', 'DOCUMENT', 'OTHER'])[1 + (i % 8)]::asset_type,
        'ACTIVE'::asset_status,
        NOW() - ((i % 180) || ' days')::INTERVAL,
        NOW()
    FROM generate_series(1, 50000) AS i
    ON CONFLICT (tenant_id, asset_code) DO NOTHING;

    RAISE NOTICE '50,000 assets generated. Starting bulk generation of 200,000 access logs...';

    SELECT array_agg(id) INTO v_asset_ids
    FROM (SELECT id FROM assets WHERE tenant_id = v_perf_tenant LIMIT 1000) sub;

    INSERT INTO asset_access_logs (
        asset_id,
        user_id,
        action,
        ip_address,
        accessed_at
    )
    SELECT
        v_asset_ids[1 + (i % array_length(v_asset_ids, 1))],
        v_owner_id,
        (ARRAY['VIEW', 'DOWNLOAD', 'CHECKOUT', 'CHECKIN'])[1 + (i % 4)]::access_action,
        '192.168.1.' || (1 + (i % 254)),
        NOW() - ((i % 90) || ' days')::INTERVAL - ((i % 86400) || ' seconds')::INTERVAL
    FROM generate_series(1, 200000) AS i;

    RAISE NOTICE '200,000 logs generated. Generating 10,000 seat allocations...';

    -- 4. Generate 10,000 License Allocations for Query 4 benchmarking
    SELECT array_agg(id) INTO v_lic_ids
    FROM (SELECT id FROM licenses WHERE tenant_id = v_perf_tenant LIMIT 1000) sub;

    ALTER TABLE license_allocations DISABLE TRIGGER trg_check_seat_availability;
    ALTER TABLE license_allocations DISABLE TRIGGER trg_audit_allocations;

    INSERT INTO license_allocations (
        id,
        license_id,
        user_id,
        allocated_by,
        allocated_at,
        status
    )
    SELECT
        gen_random_uuid(),
        v_lic_ids[1 + (i % array_length(v_lic_ids, 1))],
        v_owner_id,
        v_owner_id,
        NOW() - ((i % 60) || ' days')::INTERVAL,
        CASE WHEN (i % 5 = 0) THEN 'REVOKED'::allocation_status ELSE 'ACTIVE'::allocation_status END
    FROM generate_series(1, 1000) AS i
    ON CONFLICT DO NOTHING;

    ALTER TABLE license_allocations ENABLE TRIGGER trg_check_seat_availability;
    ALTER TABLE license_allocations ENABLE TRIGGER trg_audit_allocations;

    -- Re-enable triggers
    ALTER TABLE assets ENABLE TRIGGER trg_plan_asset_limit;
    ALTER TABLE assets ENABLE TRIGGER trg_audit_assets;
    ALTER TABLE licenses ENABLE TRIGGER trg_audit_licenses;

    RAISE NOTICE 'Bulk generation successfully complete: 5k licenses, 50k assets, 200k logs!';
END;
$$;
