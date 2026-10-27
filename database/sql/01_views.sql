-- ==============================================================================
-- AssetVault: Database Views Specification
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 01_views.sql: Real-time Analytical and Materialized Reporting Views
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. View: v_license_utilization
-- Calculates active allocations, remaining capacity, percentage utilization,
-- days until expiration, and contractual status.
-- Includes vendor_id and license_type_id for backend filtering.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. View: v_expiring_licenses
-- Captures active licenses terminating within the next 30 days,
-- categorizing urgency into CRITICAL (<=7d), WARNING (<=15d), and NOTICE (<=30d).
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. View: v_asset_catalog
-- Enriched asset repository view combining taxonomic category, custodian,
-- latest version number, aggregated tags array, covering licenses count,
-- and license compliance classification.
-- Includes category_id and owner_id for backend filtering.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. View: v_vendor_spend
-- Aggregates procurement and renewal financial spend per vendor and tenant.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. View: v_tenant_summary
-- Platform-wide overview for Super Administrators summarizing tenant scale,
-- resource quotas, and financial expenditure.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 6. Materialized View: mv_monthly_access_stats & Refresh Routine
-- Pre-aggregated monthly access metrics per tenant for fast reporting.
-- ------------------------------------------------------------------------------
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

CREATE UNIQUE INDEX idx_mv_monthly_access_unique ON mv_monthly_access_stats (tenant_id, month_year);

-- Routine to refresh the materialized view
CREATE OR REPLACE FUNCTION fn_refresh_monthly_access_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;
END;
$$ LANGUAGE plpgsql;
