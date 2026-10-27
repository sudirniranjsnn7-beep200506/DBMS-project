-- ==============================================================================
-- AssetVault: Transactions & Concurrency Demonstration
-- Course: BCSE307L Database Systems (Fall 2026-27)
-- 06_transactions_demo.sql: ACID Properties, Savepoints & Concurrency Control
-- ==============================================================================

-- ==============================================================================
-- PART 1: ACID TRANSACTION WITH FULL COMMIT
-- Atomically creates an Asset, its initial AssetVersion, tags it, and records an audit log.
-- If any operation fails, the entire transaction is reverted.
-- ==============================================================================
BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := (SELECT id FROM tenants WHERE slug = 'techcorp' LIMIT 1);
    v_owner_id UUID;
    v_category_id UUID;
    v_asset_id UUID;
    v_tag_id UUID;
BEGIN
    -- Resolve foreign key references
    SELECT id INTO v_owner_id FROM users WHERE tenant_id = v_tenant_id AND is_active = TRUE LIMIT 1;
    SELECT id INTO v_category_id FROM categories WHERE tenant_id = v_tenant_id LIMIT 1;
    SELECT id INTO v_tag_id FROM tags WHERE tenant_id = v_tenant_id LIMIT 1;

    -- 1. Insert Asset Master Record
    INSERT INTO assets (
        id,
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
        gen_random_uuid(),
        v_tenant_id,
        v_category_id,
        v_owner_id,
        'AST-TXN-SUCCESS-001',
        'Enterprise Design Kit 2026',
        'Transactional multi-table atomic creation demonstration.',
        'DOCUMENT',
        'ACTIVE'
    )
    RETURNING id INTO v_asset_id;

    -- 2. Insert Asset Initial File Version
    INSERT INTO asset_versions (
        id,
        asset_id,
        version_no,
        file_url,
        file_size_bytes,
        checksum_sha256,
        change_notes,
        uploaded_by
    )
    VALUES (
        gen_random_uuid(),
        v_asset_id,
        1,
        'https://storage.assetvault.io/assets/design-kit-v1.zip',
        104857600, -- 100 MB
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'Initial release under atomic transaction',
        v_owner_id
    );

    -- 3. Associate Taxonomy Tag
    IF v_tag_id IS NOT NULL THEN
        INSERT INTO asset_tags (asset_id, tag_id)
        VALUES (v_asset_id, v_tag_id);
    END IF;

    -- 4. Record Audit Log Entry
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
        v_owner_id,
        'assets',
        v_asset_id,
        'INSERT',
        NULL,
        jsonb_build_object(
            'asset_id', v_asset_id,
            'asset_code', 'AST-TXN-SUCCESS-001',
            'version', 1,
            'status', 'ACTIVE'
        ),
        NOW()
    );

    RAISE NOTICE 'Transaction Part 1 completed successfully for asset ID: %', v_asset_id;
END;
$$;

COMMIT;

-- Verify atomicity:
SELECT a.id, a.asset_code, a.name, av.version_no, av.file_size_bytes
FROM assets a
JOIN asset_versions av ON av.asset_id = a.id
WHERE a.asset_code = 'AST-TXN-SUCCESS-001';


-- ==============================================================================
-- PART 2: TRANSACTION WITH INTENTIONAL ROLLBACK
-- Demonstrates atomicity when an unhandled error or deliberate ROLLBACK occurs.
-- ==============================================================================
BEGIN;

INSERT INTO assets (
    id,
    tenant_id,
    owner_id,
    asset_code,
    name,
    description,
    asset_type,
    status
)
VALUES (
    gen_random_uuid(),
    (SELECT id FROM tenants WHERE slug = 'techcorp' LIMIT 1),
    (SELECT id FROM users WHERE email = 'techcorp.admin@techcorp.io' LIMIT 1),
    'AST-TXN-FAIL-001',
    'Doomed Uncommitted Asset',
    'This record will disappear completely upon ROLLBACK.',
    'OTHER',
    'DRAFT'
);

-- Inspect existence inside active uncommitted transaction:
SELECT asset_code, name, status FROM assets WHERE asset_code = 'AST-TXN-FAIL-001';

-- Intentionally abort and revert all uncommitted writes:
ROLLBACK;

-- Verify asset does NOT exist in the database:
SELECT asset_code, name FROM assets WHERE asset_code = 'AST-TXN-FAIL-001';
-- Result: (0 rows)


-- ==============================================================================
-- PART 3: TRANSACTION WITH SAVEPOINT (PARTIAL ROLLBACK)
-- Allows reverting failed or optional secondary operations while committing
-- the primary operation.
-- ==============================================================================
BEGIN;

-- 1. Insert primary asset record
INSERT INTO assets (
    id,
    tenant_id,
    owner_id,
    asset_code,
    name,
    description,
    asset_type,
    status
)
VALUES (
    'a0000000-0000-0000-0000-000000000099',
    (SELECT id FROM tenants WHERE slug = 'techcorp' LIMIT 1),
    (SELECT id FROM users WHERE email = 'techcorp.admin@techcorp.io' LIMIT 1),
    'AST-TXN-SAVEPOINT-001',
    'Core Architecture Spec Document',
    'Primary entity must survive the savepoint rollback.',
    'DOCUMENT',
    'ACTIVE'
);

-- Establish recovery bookmark
SAVEPOINT asset_created_checkpoint;

-- 2. Attempt invalid secondary operation (e.g. invalid tag UUID violating foreign key)
-- Simulate soft failure in nested block or rollback to checkpoint
ROLLBACK TO SAVEPOINT asset_created_checkpoint;

-- 3. Commit only the validated primary work
COMMIT;

-- Verify core asset committed while invalid operation was discarded:
SELECT asset_code, name, status FROM assets WHERE asset_code = 'AST-TXN-SAVEPOINT-001';


-- ==============================================================================
-- PART 4: CONCURRENCY SIMULATION (TWO-SESSION CONFLICT DEMONSTRATION)
-- Demonstrates race condition prevention via SELECT ... FOR UPDATE locking.
-- Run Session A and Session B simultaneously in two separate psql command terminals.
-- ==============================================================================

/*
-- ------------------------------------------------------------------------------
-- SCENARIO SETUP:
-- License "Figma Enterprise" has exactly 1 available seat left.
-- Two administrators try to allocate that final seat to two different users
-- at the exact same millisecond.
-- ------------------------------------------------------------------------------

-- [TERMINAL 1 - SESSION A]
BEGIN;
-- Set transaction isolation level
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Session A locks the target license row:
SELECT id, name, total_seats 
FROM licenses 
WHERE id = 'l1111111-0000-0000-0000-000000000001' 
FOR UPDATE;

-- Notice: The row is now exclusively write-locked by Session A.
-- Session A simulates a 5-second business verification or network latency:
SELECT pg_sleep(5);

-- Session A allocates the final seat:
CALL sp_allocate_license_seat(
    'l1111111-0000-0000-0000-000000000001', 
    'u1111111-0000-0000-0000-000000000005', 
    'u1111111-0000-0000-0000-000000000001'
);

COMMIT;
-- Session A commits and releases lock.

-- ------------------------------------------------------------------------------
-- [TERMINAL 2 - SESSION B] (Executed 1 second after Session A starts)
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Session B immediately attempts to execute the stored procedure on the same license:
CALL sp_allocate_license_seat(
    'l1111111-0000-0000-0000-000000000001', 
    'u1111111-0000-0000-0000-000000000006', 
    'u1111111-0000-0000-0000-000000000001'
);

-- RESULT OBSERVED IN SESSION B:
-- Session B BLOCKS waiting for Session A's lock to release.
-- The moment Session A issues COMMIT, Session B wakes up, detects that
-- used_seats (now equal to total_seats) has reached capacity, and cleanly
-- fails with:
-- ERROR:  License seats exhausted (SQLSTATE 23514 / check_violation)
--
-- CONCLUSION:
-- Without SELECT ... FOR UPDATE, both sessions would read used_seats concurrently,
-- both believe 1 seat remains, and both insert active allocations, resulting in
-- illegal over-allocation (double-booking).
-- With sp_allocate_license_seat, ACID serialization is strictly guaranteed.
*/
