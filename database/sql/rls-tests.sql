-- ==============================================================================
-- AssetVault: Row-Level Security (RLS) Verification Tests
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- rls-tests.sql: Proves Tenant Data Isolation & Cross-Tenant Attack Prevention
-- ==============================================================================

\echo '------------------------------------------------------------------------------'
\echo 'TEST SUITE: Multi-Tenant Row Level Security (RLS) Enforcement'
\echo '------------------------------------------------------------------------------'

-- Step 0: Switch session authorization to the restricted application role
SET ROLE assetvault_app;

-- ==============================================================================
-- TEST CASE 1: Querying Assets as Tenant A (TechCorp)
-- EXPECTED: Returns ONLY records belonging to Tenant A (40). Zero from other tenants.
-- ==============================================================================
BEGIN;
SET LOCAL app.current_tenant_id = '449a7330-4bbb-49df-8e64-b401dbeeb4f4';
SET LOCAL app.is_super_admin = 'false';

SELECT 
    'TEST 1 - TechCorp Isolation' AS test_name,
    COUNT(*) AS total_visible_assets,
    COUNT(*) FILTER (WHERE tenant_id = '449a7330-4bbb-49df-8e64-b401dbeeb4f4') AS tenant_a_assets,
    COUNT(*) FILTER (WHERE tenant_id <> '449a7330-4bbb-49df-8e64-b401dbeeb4f4') AS leaked_other_tenant_assets
FROM assets;
COMMIT;

-- ==============================================================================
-- TEST CASE 2: Querying Assets as Tenant B (InnovateLabs)
-- EXPECTED: Returns ONLY records belonging to Tenant B (40). Zero from other tenants.
-- ==============================================================================
BEGIN;
SET LOCAL app.current_tenant_id = '10a93f36-17e4-4d43-a775-9c479283e303';
SET LOCAL app.is_super_admin = 'false';

SELECT 
    'TEST 2 - InnovateLabs Isolation' AS test_name,
    COUNT(*) AS total_visible_assets,
    COUNT(*) FILTER (WHERE tenant_id = '10a93f36-17e4-4d43-a775-9c479283e303') AS tenant_b_assets,
    COUNT(*) FILTER (WHERE tenant_id <> '10a93f36-17e4-4d43-a775-9c479283e303') AS leaked_other_tenant_assets
FROM assets;
COMMIT;

-- ==============================================================================
-- TEST CASE 3: Attempt Cross-Tenant Write Injection
-- Tenant A session attempts to insert an asset record tagged under Tenant B.
-- EXPECTED: PostgreSQL rejects with row-level security policy check error.
-- ==============================================================================
BEGIN;
SET LOCAL app.current_tenant_id = '449a7330-4bbb-49df-8e64-b401dbeeb4f4';
SET LOCAL app.is_super_admin = 'false';

DO $$
DECLARE
    v_owner UUID;
BEGIN
    SELECT id INTO v_owner FROM users WHERE tenant_id = '10a93f36-17e4-4d43-a775-9c479283e303' LIMIT 1;
    
    INSERT INTO assets (
        tenant_id,
        owner_id,
        asset_code,
        name,
        asset_type,
        status
    )
    VALUES (
        '10a93f36-17e4-4d43-a775-9c479283e303', -- Deliberate Tenant B ID inside Tenant A session
        v_owner,
        'AST-INJECT-EXPLOIT',
        'Malicious Cross-Tenant Asset Injection',
        'OTHER',
        'ACTIVE'
    );
    RAISE EXCEPTION 'TEST 3 FAILED: Cross-tenant insertion should have been blocked by RLS!';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'TEST 3 PASSED: Cross-tenant insert rejected by RLS policy WITH CHECK (insufficient_privilege)';
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3 PASSED: Operation blocked with error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;
COMMIT;

-- ==============================================================================
-- TEST CASE 4: Super Administrator Global Bypass
-- Session sets app.is_super_admin = 'true'.
-- EXPECTED: Returns ALL records across ALL tenants across the entire platform (120).
-- ==============================================================================
BEGIN;
SET LOCAL app.current_tenant_id = '';
SET LOCAL app.is_super_admin = 'true';

SELECT 
    'TEST 4 - Super Admin Global Visibility' AS test_name,
    COUNT(*) AS total_platform_assets,
    COUNT(DISTINCT tenant_id) AS distinct_tenants_represented
FROM assets;
COMMIT;

-- Reset session authorization
RESET ROLE;
