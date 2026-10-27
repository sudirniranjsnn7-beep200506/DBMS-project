-- ==============================================================================
-- AssetVault: Comprehensive Course Queries Specification
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 05_queries.sql: Advanced DML, Joins, Window Functions, CTEs & Set Operations
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: CRUD OPERATIONS
-- ==============================================================================

-- Ensure clean state for repeatable execution
DELETE FROM assets WHERE asset_code = 'AST-BRAND-2026-001';

-- 1.1 INSERT with RETURNING: Create a new digital asset and instantly retrieve generated attributes
INSERT INTO assets (
    tenant_id,
    category_id,
    owner_id,
    asset_code,
    name,
    description,
    asset_type,
    status
)
VALUES (
    (SELECT id FROM tenants WHERE slug = 'techcorp' LIMIT 1),
    (SELECT id FROM categories WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'techcorp' LIMIT 1) LIMIT 1),
    (SELECT id FROM users WHERE email = 'techcorp.admin@techcorp.io' LIMIT 1),
    'AST-BRAND-2026-001',
    'Global Corporate Brand Guidelines 2026',
    'Comprehensive identity standards, typography hierarchy, and color palettes.',
    'DOCUMENT',
    'ACTIVE'
)
RETURNING id, asset_code, name, status, created_at;

-- 1.2 UPDATE: Update metadata, change status and track modification
UPDATE assets
SET description = 'Updated corporate brand manual with secondary sub-brand identities.',
    status = 'ACTIVE',
    updated_at = NOW()
WHERE asset_code = 'AST-BRAND-2026-001'
RETURNING id, asset_code, name, status, updated_at;

-- 1.3 SOFT DELETE: Mark an asset as deleted while preserving relational integrity and audit history
UPDATE assets
SET deleted_at = NOW(),
    status = 'ARCHIVED'
WHERE asset_code = 'AST-BRAND-2026-001'
  AND deleted_at IS NULL
RETURNING id, asset_code, deleted_at;

-- 1.4 HARD DELETE: Permanently purge expired notifications older than 90 days
DELETE FROM notifications
WHERE is_read = TRUE
  AND created_at < NOW() - INTERVAL '90 days'
RETURNING id, user_id, type, created_at;


-- ==============================================================================
-- SECTION 2: RELATIONAL JOINS & RECURSIVE HIERARCHIES
-- ==============================================================================

-- 2.1 INNER JOIN & LEFT JOIN: Assets with their assigned owners and taxonomic categories
SELECT 
    a.asset_code,
    a.name AS asset_name,
    a.asset_type,
    c.name AS category_name,
    u.full_name AS owner_name,
    u.email AS owner_email
FROM assets a
INNER JOIN users u ON u.id = a.owner_id
LEFT JOIN categories c ON c.id = a.category_id
WHERE a.deleted_at IS NULL
ORDER BY a.created_at DESC;

-- 2.2 FULL OUTER JOIN: Comprehensive alignment between vendors and active licenses
SELECT 
    COALESCE(v.name, 'Unlinked Vendor') AS vendor_name,
    v.contact_email,
    l.name AS license_name,
    l.license_key,
    l.status AS license_status,
    l.cost
FROM vendors v
FULL OUTER JOIN licenses l ON l.vendor_id = v.id AND l.deleted_at IS NULL
ORDER BY v.name, l.name;

-- 2.3 SELF-JOIN: Immediate Parent-Child Category Taxonomic Tree
SELECT 
    child.name AS category_name,
    COALESCE(parent.name, '[Root Category]') AS parent_category_name,
    child.description
FROM categories child
LEFT JOIN categories parent ON parent.id = child.parent_id
ORDER BY parent_category_name, child.name;

-- 2.4 RECURSIVE CTE: Multi-level hierarchical path reconstruction (e.g. "Creative > 3D > Models")
WITH RECURSIVE category_tree AS (
    -- Anchor member: Root-level categories (no parent)
    SELECT 
        id,
        tenant_id,
        parent_id,
        name,
        1 AS depth,
        name::TEXT AS breadcrumb_path
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive member: Traverse down through child nodes
    SELECT 
        c.id,
        c.tenant_id,
        c.parent_id,
        c.name,
        ct.depth + 1 AS depth,
        ct.breadcrumb_path || ' > ' || c.name AS breadcrumb_path
    FROM categories c
    INNER JOIN category_tree ct ON ct.id = c.parent_id
)
SELECT 
    depth,
    breadcrumb_path,
    name AS leaf_category
FROM category_tree
ORDER BY breadcrumb_path;

-- 2.5 COMPLEX 4-TABLE JOIN: Trace asset compliance through M:N resolvers to vendor contracts
SELECT 
    a.asset_code,
    a.name AS asset_name,
    a.asset_type,
    l.name AS license_name,
    l.license_key,
    l.status AS license_status,
    l.end_date AS license_expiration,
    v.name AS vendor_name,
    v.contact_email AS vendor_contact
FROM assets a
INNER JOIN asset_licenses al ON al.asset_id = a.id
INNER JOIN licenses l ON l.id = al.license_id
INNER JOIN vendors v ON v.id = l.vendor_id
WHERE a.deleted_at IS NULL
  AND l.deleted_at IS NULL
ORDER BY a.asset_code, l.name;


-- ==============================================================================
-- SECTION 3: AGGREGATES, GROUPING, ROLLUP & WINDOW FUNCTIONS
-- ==============================================================================

-- 3.1 GROUP BY with HAVING: Vendors managing more than 2 active enterprise software contracts
SELECT 
    v.name AS vendor_name,
    v.contact_email,
    COUNT(l.id) AS total_contracts,
    SUM(l.cost) AS cumulative_contract_value,
    ROUND(AVG(l.cost), 2) AS average_contract_cost
FROM vendors v
INNER JOIN licenses l ON l.vendor_id = v.id
WHERE l.deleted_at IS NULL
GROUP BY v.id, v.name, v.contact_email
HAVING COUNT(l.id) >= 2
ORDER BY cumulative_contract_value DESC;

-- 3.2 ROLLUP & GROUPING SETS: Multi-dimensional financial spend matrix by vendor and license type
SELECT 
    COALESCE(v.name, '--- ALL VENDORS ---') AS vendor_name,
    COALESCE(lt.name, '--- ALL TYPES ---') AS license_type,
    COUNT(l.id) AS contracts_count,
    SUM(l.total_seats) AS total_seats_procured,
    SUM(l.cost) AS total_expenditure
FROM licenses l
INNER JOIN vendors v ON v.id = l.vendor_id
INNER JOIN license_types lt ON lt.id = l.license_type_id
WHERE l.deleted_at IS NULL
GROUP BY ROLLUP (v.name, lt.name)
ORDER BY v.name NULLS LAST, lt.name NULLS LAST;

-- 3.3 WINDOW FUNCTION: ROW_NUMBER() partitioning latest version iterations per asset
SELECT 
    a.asset_code,
    a.name AS asset_name,
    av.version_no,
    av.file_size_bytes,
    av.checksum_sha256,
    av.created_at AS version_uploaded_at,
    ROW_NUMBER() OVER (
        PARTITION BY av.asset_id 
        ORDER BY av.version_no DESC
    ) AS version_recency_rank
FROM assets a
INNER JOIN asset_versions av ON av.asset_id = a.id
WHERE a.deleted_at IS NULL;

-- 3.4 WINDOW FUNCTION: DENSE_RANK() of vendors classified by financial spend
SELECT 
    v.name AS vendor_name,
    SUM(l.cost) AS total_spend,
    DENSE_RANK() OVER (
        ORDER BY SUM(l.cost) DESC
    ) AS vendor_spend_rank
FROM vendors v
INNER JOIN licenses l ON l.vendor_id = v.id
WHERE l.deleted_at IS NULL
GROUP BY v.id, v.name;

-- 3.5 WINDOW FUNCTION: Running cumulative sum of license capital commitments over time
SELECT 
    l.start_date,
    l.name AS license_name,
    l.cost AS contract_cost,
    SUM(l.cost) OVER (
        PARTITION BY l.tenant_id
        ORDER BY l.start_date ASC, l.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_tenant_spend
FROM licenses l
WHERE l.deleted_at IS NULL
ORDER BY l.start_date ASC;


-- ==============================================================================
-- SECTION 4: ADVANCED SUBQUERIES & PREDICATES
-- ==============================================================================

-- 4.1 SCALAR SUBQUERY: Calculate individual license cost delta relative to tenant average
SELECT 
    l.name AS license_name,
    l.cost,
    ROUND(
        (SELECT AVG(cost) FROM licenses sub_l WHERE sub_l.tenant_id = l.tenant_id AND sub_l.deleted_at IS NULL), 
        2
    ) AS tenant_avg_license_cost,
    ROUND(
        l.cost - (SELECT AVG(cost) FROM licenses sub_l WHERE sub_l.tenant_id = l.tenant_id AND sub_l.deleted_at IS NULL),
        2
    ) AS cost_variance_from_average
FROM licenses l
WHERE l.deleted_at IS NULL
ORDER BY l.cost DESC;

-- 4.2 CORRELATED SUBQUERY: Assets whose latest file version exceeds 50 Megabytes (52,428,800 bytes)
SELECT 
    a.id,
    a.asset_code,
    a.name,
    a.asset_type
FROM assets a
WHERE a.deleted_at IS NULL
  AND (
      SELECT av.file_size_bytes
      FROM asset_versions av
      WHERE av.asset_id = a.id
      ORDER BY av.version_no DESC
      LIMIT 1
  ) > 52428800;

-- 4.3 NOT EXISTS: Find orphaned or unmonitored digital assets lacking any covering licenses
SELECT 
    a.id AS unlicensed_asset_id,
    a.asset_code,
    a.name,
    a.asset_type,
    a.created_at
FROM assets a
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM asset_licenses al 
      WHERE al.asset_id = a.id
  );

-- 4.4 EXISTS: Identify users who have never been granted an active seat allocation
SELECT 
    u.id,
    u.full_name,
    u.email,
    r.name AS role_title
FROM users u
INNER JOIN roles r ON r.id = u.role_id
WHERE u.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 
      FROM license_allocations la 
      WHERE la.user_id = u.id 
        AND la.status = 'ACTIVE'
  );


-- ==============================================================================
-- SECTION 5: SET OPERATIONS (UNION, INTERSECT, EXCEPT)
-- ==============================================================================

-- 5.1 UNION vs UNION ALL: Combine categorized catalog tags with raw search activity terms
SELECT name AS keyword, 'ASSIGNED_TAG' AS origin FROM tags
UNION
SELECT asset_type::TEXT AS keyword, 'MEDIA_FORMAT' AS origin FROM assets
ORDER BY keyword;

-- 5.2 INTERSECT: Users who have BOTH been granted active software seats AND downloaded assets
SELECT user_id FROM license_allocations WHERE status = 'ACTIVE'
INTERSECT
SELECT user_id FROM asset_access_logs WHERE action = 'DOWNLOAD';

-- 5.3 EXCEPT: Tags created in the tenant dictionary that have NEVER been linked to any asset
SELECT t.id, t.name, t.color
FROM tags t
WHERE t.id IN (
    SELECT id FROM tags
    EXCEPT
    SELECT tag_id FROM asset_tags
);
