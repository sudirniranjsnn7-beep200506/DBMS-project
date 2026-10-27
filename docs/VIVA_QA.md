# AssetVault - 40 Project-Specific Viva Questions & Answers
**Course:** BCSE307L Database Systems (Fall 2026-27)  
**Preparation Target:** Demanding Examiner Viva Voce & Technical Oral Evaluation  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  

---

## Category 1: Relational Database Design & Normalization (Q1 – Q8)

### Q1: Why is AssetVault designed as a shared-database, shared-schema multi-tenant architecture instead of database-per-tenant?
**Answer:**  
In enterprise SaaS, a database-per-tenant approach introduces severe operational overhead: running migrations across hundreds of tenant databases, connection pool exhaustion, and expensive infrastructure costs. A shared-schema architecture with tenant discriminators (`tenant_id UUID`) provides optimal resource utilization, unified connection pooling, and simplified schema evolution. We mitigate cross-tenant data leakage risks through our **Dual-Layer Multi-Tenancy Architecture**, combining application-level query middleware with database-level PostgreSQL session context.

### Q2: Prove that the AssetVault schema satisfies Third Normal Form (3NF).
**Answer:**  
A schema is in 3NF if it is in 2NF and no non-prime attribute is transitively dependent on the primary key ($X \rightarrow Y \rightarrow Z$). We eliminated potential transitive dependencies by factoring out lookup and metadata entities:
1. `plans` is factored out of `tenants` (otherwise: $\text{tenant\_id} \rightarrow \text{plan\_name} \rightarrow \{\text{max\_users}, \text{price}\}$).
2. `license_types` is factored out of `licenses` (otherwise: $\text{license\_id} \rightarrow \text{type\_name} \rightarrow \text{description}$).
3. `roles` is factored out of `users` (otherwise: $\text{user\_id} \rightarrow \text{role\_name} \rightarrow \text{description}$).
Every non-prime attribute in all 19 relations depends directly and solely on its candidate keys.

### Q3: Does the schema satisfy Boyce-Codd Normal Form (BCNF)? Provide an example.
**Answer:**  
Yes. A relation is in BCNF if for every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ is a superkey.  
In our `users` table, the candidate keys are $\{\text{id}\}$ (surrogate UUID) and $\{\text{email}\}$ (natural key with unique constraint). All functional dependencies originate from either $\{\text{id}\}$ or $\{\text{email}\}$. Since both determinants are superkeys, the relation strictly satisfies BCNF.

### Q4: Why did you choose surrogate keys (`UUID`) over natural keys (like email or asset names)?
**Answer:**  
1. **Immutability:** Natural keys (e.g., email or asset names) change over time. If a user changes their email, cascading foreign key updates across millions of allocation and log rows would lock the database and degrade performance.
2. **Distributed Uniqueness:** UUIDv4 generation allows client or service layers to generate unique primary keys without roundtrips to database sequence generators, facilitating horizontal scaling and offline data preparation.
3. **Multi-Tenant Uniqueness:** Different tenants may name their assets identically (e.g., "Company Logo"); UUIDs guarantee absolute global uniqueness.

### Q5: How do you model Many-to-Many (M:N) relationships in the schema?
**Answer:**  
We model M:N relationships using pure associative entities (junction tables) with composite primary keys or surrogate keys plus unique constraints:
- `asset_tags(asset_id, tag_id)` links `assets` and `tags`.
- `asset_licenses(asset_id, license_id)` links `assets` and `licenses`.
Each junction table carries foreign keys referencing both primary entities with `ON DELETE CASCADE` rules.

### Q6: Why did you not create separate tables for `admin_users`, `manager_users`, and `employee_users`?
**Answer:**  
Creating separate user tables is a well-known database anti-pattern that violates relational normalization:
1. It duplicates identical schema structures (email, password hash, timestamps).
2. It makes cross-role polymorphic relationships (like `asset_access_logs` referencing who accessed a file) difficult, requiring multiple nullable foreign keys.
3. It prevents dynamic role transitions (promoting an employee to admin would require moving rows between tables).
In AssetVault, we have strictly **ONE `users` table** with a `role_id` foreign key referencing the `roles` table.

### Q7: What are the trade-offs of using soft deletion (`deleted_at TIMESTAMP`) versus hard deletion (`DELETE`)?
**Answer:**  
In financial, compliance, and enterprise asset systems, hard deletion destroys historical audit trails and breaks foreign key integrity on historical logs. AssetVault uses soft deletion (`deleted_at TIMESTAMP NULL`):
- **Benefits:** Complete historical auditability, non-destructive restoration, and legal compliance.
- **Trade-offs:** Every query must filter `WHERE deleted_at IS NULL`. We mitigated index bloat and query overhead by creating partial B-Tree indexes on active rows (`WHERE deleted_at IS NULL`).

### Q8: Explain the difference between candidate keys, primary keys, and foreign keys in your schema.
**Answer:**  
- **Candidate Key:** Any minimal set of attributes that uniquely identifies a row. In `tenants`, both `id` and `slug` are candidate keys.
- **Primary Key:** The chosen candidate key enforced by the database engine. In `tenants`, `id UUID` is the primary key.
- **Foreign Key:** An attribute that creates a referential link to a primary key in another table. In `users`, `tenant_id` references `tenants(id)`.

---

## Category 2: Advanced SQL, Stored Procedures, & Triggers (Q9 – Q16)

### Q9: What is the difference between a Stored Procedure and a User-Defined Function (UDF) in PostgreSQL?
**Answer:**  
In PostgreSQL, Stored Procedures (`CREATE PROCEDURE ... CALL`) were introduced in version 11 to support transaction control (`COMMIT` and `ROLLBACK` inside the body) and procedural output arguments without returning a scalar result set. Functions (`CREATE FUNCTION ... SELECT`) cannot execute independent transaction boundaries and must return a value or table. AssetVault uses Stored Procedures (`sp_allocate_license_seat`, `sp_release_license_seat`, `sp_renew_license`) for atomic procedural operations that mutate multiple related entities.

### Q10: How does `sp_allocate_license_seat` prevent concurrent over-allocation?
**Answer:**  
In strict accordance with **Third Normal Form (3NF)** (`database/normalization.md` Section 4.3), `used_seats` is **not** stored as a physical column on `licenses`—storing it would introduce an update anomaly and a transitive functional dependency ($\text{license\_id} \rightarrow \text{allocations} \rightarrow \text{used\_seats}$).

Instead, `sp_allocate_license_seat` resolves concurrency and seat tracking as follows:
1. **Pessimistic Row-Level Lock:** It executes `SELECT id, tenant_id, name, total_seats, status, end_date, deleted_at FROM licenses WHERE id = p_license_id FOR UPDATE`. This exclusive row lock forces all concurrent transactions targeting the same license to queue sequentially at the database engine level.
2. **Dynamic Active Seat Count:** Under the protection of the lock, it computes used seats directly from the source of truth:
   ```sql
   SELECT COUNT(*)::INT INTO v_used_seats
   FROM license_allocations
   WHERE license_id = p_license_id AND status = 'ACTIVE';
   ```
3. **Capacity Validation:** It verifies `v_used_seats < v_license.total_seats`. If seats are exhausted (`v_used_seats >= v_license.total_seats`), it immediately raises SQL exception code `23514` (`check_violation`).
4. **Atomic Insertion:** If available, it inserts the new record into `license_allocations` with `status = 'ACTIVE'` within the same serialized transaction.
This guarantees zero over-allocation under concurrent load while keeping the relational schema fully normalized in 3NF.

### Q11: Why is an application-level check like `if (license.usedSeats < license.totalSeats)` insufficient under high concurrency?
**Answer:**  
Due to the classic **Time-of-Check to Time-of-Use (TOCTOU)** race condition. If 10 requests hit 10 concurrent Node.js threads when 1 seat remains, all 10 threads query `license_allocations` simultaneously and read `activeSeats = 9` before any thread commits its insert. All 10 evaluate the condition as `true`, and all 10 issue `INSERT INTO license_allocations`. As a result, 19 seats are assigned for a 10-seat license. Only database-level row locks (`FOR UPDATE` on the parent `licenses` row inside `sp_allocate_license_seat`) serialize access at the data storage layer, ensuring each thread evaluates `COUNT(*)` only after the preceding thread has either committed its insertion or rolled back.

### Q12: What does the trigger `trg_audit_log_immutable` do, and why is it important?
**Answer:**  
The trigger is bound to the `audit_logs` table on `BEFORE UPDATE OR DELETE`. If any user or application thread attempts to mutate or delete an audit log row, the trigger raises an SQL exception:
```sql
RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.'
USING ERRCODE = '28000';
```
This guarantees non-repudiation: even if an attacker acquires administrative privileges, they cannot erase historical footprints of their actions.

### Q13: What is the purpose of database view `v_asset_catalog`?
**Answer:**  
`v_asset_catalog` pre-defines a 6-table join across `assets`, `categories`, `users`, `asset_versions`, `asset_tags`, and `asset_licenses`. It abstracts complex relational joins into a single clean virtual table, simplifying application queries while allowing the PostgreSQL query optimizer to push down `WHERE` clauses directly to the underlying physical tables.

### Q14: What is a Materialized View, and why do you use `REFRESH MATERIALIZED VIEW CONCURRENTLY`?
**Answer:**  
Unlike a standard view (which re-executes its underlying query every time it is read), a Materialized View physically caches the computed query result on disk. We use `mv_monthly_access_stats` to store monthly aggregation metrics. Because computing these metrics involves scanning millions of access log rows, we refresh it hourly. The `CONCURRENTLY` modifier allows the view to be refreshed in the background without acquiring exclusive read locks, ensuring user read requests never experience blocking.

### Q15: What requirement must be met to refresh a materialized view concurrently in PostgreSQL?
**Answer:**  
PostgreSQL requires that the materialized view has at least one `UNIQUE INDEX` defined on an explicit combination of non-nullable columns. In AssetVault, we created a unique composite index `idx_mv_monthly_access_stats_unique ON mv_monthly_access_stats(asset_id, access_year, access_month)`.

### Q16: How do you guarantee idempotency in scheduled background jobs across multiple server instances?
**Answer:**  
We utilize **PostgreSQL Advisory Locks** via `pg_try_advisory_lock(bigint)`. Unlike table or row locks, advisory locks are application-defined mutexes managed by the PostgreSQL server. When our background cron worker runs, it attempts to acquire the advisory lock:
- If `true`: The instance executes the job and unlocks it upon completion.
- If `false`: Another instance is already running the job, so the current instance skips execution without blocking or duplicating work.

---

## Category 3: Transactions, ACID Properties, & Concurrency (Q17 – Q24)

### Q17: Explain how the 4 ACID properties are maintained in AssetVault.
**Answer:**  
- **Atomicity:** Ensured via PostgreSQL transactions and Prisma `$transaction`. In `changeUserRole`, updating the user role, writing the audit log, and revoking active refresh tokens all succeed together or rollback completely. In `sp_allocate_license_seat`, capacity verification and allocation insertion occur in a single atomic unit.
- **Consistency:** Enforced by PostgreSQL declarative check constraints (`chk_*`), foreign key references with referential integrity, trigger-based invariants (`fn_check_seat_availability`), NOT NULL column rules, and 3NF normalization (e.g., dynamically computing `used_seats` via `COUNT(*)` on `license_allocations` to prevent aggregate drift).
- **Isolation:** Managed via PostgreSQL Read Committed and Repeatable Read isolation levels, supplemented by explicit `FOR UPDATE` row locks on `licenses` to prevent non-repeatable reads and race conditions during seat allocation.
- **Durability:** Guaranteed by PostgreSQL Write-Ahead Logging (WAL) and synchronous disk flushes before transactions report success to the application.

### Q18: What is a "phantom read", and how do database isolation levels address it?
**Answer:**  
A phantom read occurs when a transaction reads a set of rows satisfying a condition, a second transaction inserts or deletes rows satisfying that condition and commits, and the first transaction re-executes the query and observes a different set of rows. Serializable isolation prevents phantom reads using predicate locking or serializable snapshot isolation (SSI). In AssetVault, seat allocation avoids phantom read risks by locking the parent `licenses` row directly (`FOR UPDATE`).

### Q19: What is deadlock, and how does AssetVault prevent it?
**Answer:**  
A deadlock occurs when two transactions wait on locks held by each other (Transaction A locks License 1 and waits for License 2; Transaction B locks License 2 and waits for License 1). We prevent deadlocks by:
1. Enforcing strict, deterministic resource locking orders (e.g., locking licenses in ascending UUID order when multiple licenses are touched).
2. Keeping transaction lifetimes strictly under $10\text{ms}$ by doing network I/O and password hashing *before* opening database transactions.

### Q20: What is the difference between optimistic concurrency control and pessimistic concurrency control?
**Answer:**  
- **Optimistic Concurrency Control (OCC):** Assumes conflicts are rare. Reads data with a version column (`version INT`) and checks `WHERE version = expected_version` upon update. If changed, the application retries.
- **Pessimistic Concurrency Control (PCC):** Assumes conflicts are likely. Acquires explicit exclusive locks (`FOR UPDATE`) at the time of read, preventing any other transaction from touching the record until commit. AssetVault uses pessimistic locking for license seats because burst concurrent checkouts are common.

### Q21: What is the purpose of database indexes, and how does a B-Tree index work?
**Answer:**  
An index is an auxiliary data structure that enables fast logarithmic search ($O(\log N)$) instead of linear full-table scans ($O(N)$). A B-Tree (Balanced Tree) maintains sorted keys in hierarchical nodes. Root and internal nodes guide traversals using range comparisons down to leaf nodes, which contain pointers to physical heap disk pages (`ctid`).

### Q22: What is an index full-table scan, and when does PostgreSQL intentionally choose a sequential scan over an index?
**Answer:**  
A sequential scan reads all physical disk pages of a table from start to end. The PostgreSQL cost-based query planner (CBO) intentionally chooses a sequential scan when:
1. The table is very small (a few pages fit in a single I/O read).
2. The query predicate selects a large fraction ($>20-30\%$) of the table, making random disk page fetches from an index more expensive than sequential page reads.

### Q23: What are composite indexes, and why does column ordering matter?
**Answer:**  
A composite index indexes multiple columns (e.g., `(tenant_id, status)`). Column order matters due to the **Leftmost Prefix Rule**: the index can accelerate queries filtering on `tenant_id` alone, or `(tenant_id AND status)`, but cannot efficiently optimize queries filtering on `status` alone without `tenant_id`.

### Q24: What is a partial index, and where is it used in AssetVault?
**Answer:**  
A partial index covers only a subset of table rows satisfying a predicate (`WHERE clause`). We use partial indexes on `deleted_at`:
```sql
CREATE INDEX idx_assets_active ON assets(tenant_id, created_at DESC) 
WHERE deleted_at IS NULL;
```
This keeps the index compact and excludes deleted records, dramatically reducing memory usage in the database buffer cache (`shared_buffers`).

---

## Category 4: Multi-Tenancy & Application Security (Q25 – Q32)

### Q25: How does AssetVault prevent Insecure Direct Object References (IDOR)?
**Answer:**  
1. **Application Layer:** `prismaForRequest` automatically appends `where: { tenantId }` based on the authenticated JWT token.
2. **Concealment Policy:** If a user specifies a resource ID that does not exist within their tenant, the system throws `NotFoundError('Resource not found')` -> HTTP 404. It never returns HTTP 403 Forbidden, because a 403 reveals to an attacker that the resource ID exists in another tenant.

### Q26: Why are passwords hashed with BCrypt instead of SHA-256 or MD5?
**Answer:**  
SHA-256 and MD5 are fast cryptographic digest algorithms designed for high throughput. Modern GPUs can compute billions of SHA-256 hashes per second, making brute-force dictionary attacks trivial. BCrypt is a slow, adaptive key derivation function based on the Blowfish cipher. It incorporates a per-password salt and an exponential cost factor (we use cost **12**, requiring $\sim 250\text{ms}$ per hash), making mass offline brute-force computationally prohibitive.

### Q27: How does AssetVault implement JWT Refresh Token rotation with reuse detection?
**Answer:**  
1. Upon login, the client receives an Access Token (15m) and a single-use Refresh Token (7d).
2. When the client refreshes, the presented refresh token is marked as `revoked_at = NOW()`, and a brand new refresh token is issued.
3. If an attacker intercepts and replays an already-revoked refresh token, the system detects a token reuse violation: it immediately revokes the **entire token family** for that user, invalidating all sessions and forcing immediate re-authentication.

### Q28: Where are JWT tokens stored on the client, and why?
**Answer:**  
- **Access Tokens:** Stored in client memory (JavaScript state). This prevents XSS attacks from reading tokens from persistent browser storage.
- **Refresh Tokens:** Stored strictly in `HttpOnly`, `SameSite=Strict`, `Secure` browser cookies. JavaScript cannot access `HttpOnly` cookies, preventing token theft via XSS, while `SameSite=Strict` prevents Cross-Site Request Forgery (CSRF).

### Q29: How does AssetVault guarantee 100% immunity to SQL Injection?
**Answer:**  
1. We enforce static analysis rules (`scripts/check-sqli.js`) prohibiting `$queryRawUnsafe` and `$executeRawUnsafe`.
2. All raw SQL queries utilize tagged template literals (`Prisma.sql`). Tagged templates separate SQL query structure from dynamic variables, sending dynamic values as isolated bind parameters ($1, $2) over the PostgreSQL wire protocol. The database treats parameters strictly as data literals, never as executable code.

### Q30: What is Mass Assignment vulnerability, and how does AssetVault prevent it?
**Answer:**  
Mass assignment occurs when client-supplied JSON payloads are passed directly to database update methods, allowing attackers to inject privileged attributes (e.g., `{ "roleId": 1, "isSuperAdmin": true }`). AssetVault prevents this using Zod schema validation with `.strip()`. Any fields not explicitly defined in the update schema are stripped before reaching service and repository layers.

### Q31: How does AssetVault defend against credential stuffing and brute-force attacks?
**Answer:**  
1. **IP Rate Limiting:** Global rate limiters cap requests to 100 requests per 15 minutes per IP address.
2. **Account Lockout:** An in-memory sliding window tracks failed authentication attempts per email. After 5 failed attempts within 15 minutes, the account is locked for 15 minutes (`423 Locked`).
3. **Generic Responses:** Failed attempts always return `'Invalid email or password'`, preventing account enumeration.

### Q32: What is Row-Level Security (RLS) in PostgreSQL?
**Answer:**  
RLS is a database security feature that restricts which rows in a table can be returned or mutated by SQL queries based on the identity or attributes of the database user executing the query. In AssetVault, RLS policies evaluate `current_setting('app.current_tenant_id', true)::uuid = tenant_id`, providing kernel-level data isolation.

---

## Category 5: Architecture, DevOps, & Observability (Q33 – Q40)

### Q33: What is the purpose of Server-Sent Events (SSE), and why did you choose it over WebSockets?
**Answer:**  
AssetVault uses SSE (`GET /api/notifications/stream`) for real-time notification delivery. SSE is built over standard HTTP/1.1 and HTTP/2, natively supports automatic client reconnection, traverses corporate proxies and firewalls without custom protocols, and requires less server memory than bidirectional WebSockets. Since notifications flow in one direction (server to client), SSE is the most lightweight, robust choice.

### Q34: What is the difference between custom format (`-Fc`) and plain SQL format (`-Fp`) in `pg_dump`?
**Answer:**  
- **Custom Format (`-Fc`):** A compressed, binary format. It is non-human-readable but supports selective table restoration (`pg_restore -t`), parallel restoration across multiple CPU cores (`-j`), and reordering of schema elements.
- **Plain SQL (`-Fp`):** Plain text containing SQL DDL and `COPY` statements. It can be inspected in text editors and executed via standard `psql`, but cannot be restored in parallel. AssetVault generates both during daily backups.

### Q35: Why do you compute SHA-256 checksums alongside database backup dumps?
**Answer:**  
Backups stored on disk or transferred across cloud networks can suffer silent bit rot, network truncation, or malicious tampering. A cryptographic SHA-256 checksum file (`.sha256`) allows our restore scripts (`restore.sh`) to verify bit-level file integrity before executing destructive database operations.

### Q36: Describe your disaster recovery drill and what RPO and RTO mean.
**Answer:**  
- **RPO (Recovery Point Objective):** The maximum acceptable age of data loss. With daily automated backups, our baseline RPO is 24 hours (can be reduced to minutes with WAL archiving).
- **RTO (Recovery Time Objective):** The duration required to restore service. Our automated native restore script achieves an RTO of $<3$ minutes for databases under $10\text{GB}$.
In our documented recovery drill (`docs/backup-recovery.md`), we took a backup, intentionally deleted asset and license records, restored into scratch database `assetvault_restore_test`, and proved 100% row match via `verify-restore.sh`.

### Q37: How does Prometheus collect metrics from AssetVault?
**Answer:**  
The API exposes a Prometheus scrape endpoint (`GET /metrics`) instrumented via `prom-client`. Prometheus periodically polls (scrapes) this endpoint over HTTP, ingesting metrics such as HTTP request counts, response latency histograms (p50, p95, p99), active database connection pool counts, and process memory utilization into its time-series database.

### Q38: Why do multi-stage Docker builds produce smaller and more secure images?
**Answer:**  
In a single-stage build, compiler tools (`gcc`, `python`), development packages (`devDependencies`), and source code remain inside the final container, creating an image $>1\text{GB}$ with a large attack surface. A multi-stage build compiles TypeScript in an intermediate builder stage and copies only the compiled JavaScript files and production `node_modules` into a clean, minimal Alpine Linux runtime stage, yielding a secure image of $<150\text{MB}$ running as a non-root user.

### Q39: What is the role of GitHub Actions in your project?
**Answer:**  
Our GitHub Actions pipelines automate quality control on every push:
1. `ci.yml`: Starts a real PostgreSQL service container, runs migrations and seeds, executes TypeScript typechecks, linters, and all 103 Vitest unit/integration tests.
2. `docker.yml`: Builds Docker containers to ensure image build reproducibility.
3. `nightly-backup.yml`: Executes scheduled automated backup drills.

### Q40: What are the three most significant engineering lessons you learned while building AssetVault?
**Answer:**  
1. **Pushing business invariants to the database kernel:** Application logic can have bugs or be bypassed, but database check constraints, row-level locks, and triggers guarantee data consistency unconditionally.
2. **Designing for adversarial concurrency:** Developing the 20-thread concurrency test proved that multi-threaded race conditions occur easily in high-throughput environments unless handled with atomic row locks.
3. **Observability and automated verification:** Writing automated verification tests for backups and security penetration provides mathematical confidence that the system is truly production-ready.
