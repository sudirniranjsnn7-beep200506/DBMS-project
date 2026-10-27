# AssetVault: Relational Normalization Proofs & Mathematical Analysis

**Course:** BCSE307L – Database Systems (Fall Semester 2026–27)  
**Institution:** School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT), Vellore  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  
**Database Engine:** PostgreSQL 16  

---

## 1. Mathematical Normalization Framework

A relational database is designed to eliminate data redundancy and insertion, update, and deletion anomalies. The formal criteria used throughout AssetVault are:

- **First Normal Form (1NF):** Every attribute domain contains only atomic (indivisible) values, there are no repeating groups or multi-valued arrays, and each record is uniquely identifiable by a primary key.
- **Second Normal Form (2NF):** The relation is in 1NF and contains no *partial functional dependencies*—every non-prime attribute is fully functionally dependent on every candidate key.
- **Third Normal Form (3NF):** The relation is in 2NF and contains no *transitive functional dependencies*—for every non-trivial functional dependency $X \rightarrow Y$, either $X$ is a superkey or $Y$ is a prime attribute (part of a candidate key).
- **Boyce-Codd Normal Form (BCNF):** The relation is in 3NF and for every non-trivial functional dependency $X \rightarrow Y$, $X$ is strictly a superkey.

---

## 2. Table-by-Table Functional Dependency Analysis & Proofs

### 2.1 `plans`
- **Candidate Keys:** $\{id\}$, $\{name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{name, max\_users, max\_assets, monthly\_price, is\_active\}$
  - $name \rightarrow \{id, max\_users, max\_assets, monthly\_price, is\_active\}$
- **1NF:** All attributes (integers, strings, numeric prices, booleans) are atomic. Unique PK exists.
- **2NF:** All candidate keys are simple (single-attribute); partial key dependencies are mathematically impossible.
- **3NF & BCNF:** Every determinant ($id$, $name$) is a superkey. Satisfies BCNF.

### 2.2 `tenants`
- **Candidate Keys:** $\{id\}$, $\{slug\}$
- **Functional Dependencies:**
  - $id \rightarrow \{plan\_id, name, slug, status, contact\_email, created\_at, updated\_at\}$
  - $slug \rightarrow \{id, plan\_id, name, status, contact\_email, created\_at, updated\_at\}$
- **1NF:** Atomic attribute domains; no repeating groups.
- **2NF:** Both candidate keys are single-column; holds in 2NF trivially.
- **3NF & BCNF:** $id$ and $slug$ are superkeys. Non-prime attributes ($name, status$) do not determine other non-prime attributes. Holds in BCNF.

### 2.3 `roles`
- **Candidate Keys:** $\{id\}$, $\{name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{name, description\}$
  - $name \rightarrow \{id, description\}$
- **1NF / 2NF / 3NF / BCNF:** Simple keys; determinants are superkeys. Satisfies BCNF.

### 2.4 `users`
- **Candidate Keys:** $\{id\}$, $\{email\}$, $\{google\_id\}$ (when not null)
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, role\_id, email, full\_name, password\_hash, google\_id, avatar\_url, is\_active, last\_login\_at, created\_at, updated\_at\}$
  - $email \rightarrow \{id, tenant\_id, role\_id, full\_name, password\_hash, google\_id, avatar\_url, is\_active, last\_login\_at, created\_at, updated\_at\}$
- **1NF:** Atomic values. Single email and identity tokens per row.
- **2NF:** Candidate keys are single-column; no partial dependencies.
- **3NF & BCNF:** All determinants are candidate superkeys. Satisfies BCNF.

### 2.5 `refresh_tokens`
- **Candidate Keys:** $\{id\}$, $\{token\_hash\}$
- **Functional Dependencies:**
  - $id \rightarrow \{user\_id, token\_hash, expires\_at, revoked\_at, user\_agent, ip\_address, created\_at\}$
  - $token\_hash \rightarrow \{id, user\_id, expires\_at, revoked\_at, user\_agent, ip\_address, created\_at\}$
- **1NF / 2NF / 3NF / BCNF:** Every determinant is a candidate key. Holds in BCNF.

### 2.6 `vendors`
- **Candidate Keys:** $\{id\}$, $\{tenant\_id, name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, name, contact\_email, website, support\_phone\}$
  - $\{tenant\_id, name\} \rightarrow \{id, contact\_email, website, support\_phone\}$
- **1NF:** Atomic contact fields.
- **2NF:** The composite candidate key $\{tenant\_id, name\}$ determines all non-prime fields. Neither $tenant\_id$ nor $name$ alone determines contact info. No partial dependency.
- **3NF & BCNF:** Both $id$ and $\{tenant\_id, name\}$ are candidate superkeys. Holds in BCNF.

### 2.7 `categories`
- **Candidate Keys:** $\{id\}$, $\{tenant\_id, name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, parent\_id, name, description\}$
  - $\{tenant\_id, name\} \rightarrow \{id, parent\_id, description\}$
- **1NF / 2NF / 3NF / BCNF:** Self-reference `parent_id` is an atomic UUID. Determinants are superkeys. Holds in BCNF.

### 2.8 `assets`
- **Candidate Keys:** $\{id\}$, $\{tenant\_id, asset\_code\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, category\_id, owner\_id, asset\_code, name, description, asset\_type, status, created\_at, updated\_at, deleted\_at\}$
  - $\{tenant\_id, asset\_code\} \rightarrow \{id, category\_id, owner\_id, name, description, asset\_type, status, created\_at, updated\_at, deleted\_at\}$
- **1NF:** Atomic values. Tags and licenses are decoupled into junction tables.
- **2NF:** Neither $tenant\_id$ nor $asset\_code$ individually determines the asset attributes. No partial key dependencies.
- **3NF & BCNF:** $owner\_id$ and $category\_id$ are foreign keys pointing to independent relations; they do not determine non-prime asset attributes within `assets`. All determinants are superkeys. Holds in BCNF.

### 2.9 `asset_versions`
- **Candidate Keys:** $\{id\}$, $\{asset\_id, version\_no\}$
- **Functional Dependencies:**
  - $id \rightarrow \{asset\_id, version\_no, file\_url, file\_size\_bytes, checksum\_sha256, change\_notes, uploaded\_by, created\_at\}$
  - $\{asset\_id, version\_no\} \rightarrow \{id, file\_url, file\_size\_bytes, checksum\_sha256, change\_notes, uploaded\_by, created\_at\}$
- **1NF:** Atomic file URLs, sizes, and SHA-256 hashes.
- **2NF:** Non-prime attributes ($file\_url$, $file\_size\_bytes$, $checksum\_sha256$) depend on the full composite key $\{asset\_id, version\_no\}$. No partial dependencies.
- **3NF & BCNF:** All determinants are candidate superkeys. Holds in BCNF.

### 2.10 `tags`
- **Candidate Keys:** $\{id\}$, $\{tenant\_id, name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, name, color\}$
  - $\{tenant\_id, name\} \rightarrow \{id, color\}$
- **1NF / 2NF / 3NF / BCNF:** Determinants are superkeys. Holds in BCNF.

### 2.11 `asset_tags`
- **Candidate Keys:** $\{asset\_id, tag\_id\}$ (Composite Primary Key)
- **Functional Dependencies:**
  - $\{asset\_id, tag\_id\} \rightarrow \emptyset$ (Trivial dependency)
- **1NF / 2NF / 3NF / BCNF:** Contains only prime key attributes. Trivially holds in BCNF.

### 2.12 `license_types`
- **Candidate Keys:** $\{id\}$, $\{name\}$
- **Functional Dependencies:**
  - $id \rightarrow \{name, is\_seat\_based, is\_expirable, description\}$
  - $name \rightarrow \{id, is\_seat\_based, is\_expirable, description\}$
- **1NF / 2NF / 3NF / BCNF:** Determinants are superkeys. Holds in BCNF.

### 2.13 `licenses`
- **Candidate Keys:** $\{id\}$, $\{tenant\_id, license\_key\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, vendor\_id, license\_type\_id, name, license\_key, total\_seats, start\_date, end\_date, cost, currency, auto\_renew, status, terms, created\_at, updated\_at, deleted\_at\}$
  - $\{tenant\_id, license\_key\} \rightarrow \{id, vendor\_id, license\_type\_id, name, total\_seats, start\_date, end\_date, cost, currency, auto\_renew, status, terms, created\_at, updated\_at, deleted\_at\}$
- **1NF:** Atomic dates, costs, seat numbers, and terms.
- **2NF:** No partial dependencies; license attributes depend on the full license contract.
- **3NF & BCNF:** Foreign keys $vendor\_id$ and $license\_type\_id$ do not determine other license columns. All determinants are superkeys. Holds in BCNF.

### 2.14 `asset_licenses`
- **Candidate Keys:** $\{asset\_id, license\_id\}$ (Composite Primary Key)
- **Functional Dependencies:**
  - $\{asset\_id, license\_id\} \rightarrow \{assigned\_by, assigned\_at\}$
- **1NF:** Atomic timestamps and user references.
- **2NF:** Non-prime attributes ($assigned\_by$, $assigned\_at$) depend on the complete composite pair $\{asset\_id, license\_id\}$.
- **3NF & BCNF:** The composite candidate key is the sole determinant. Holds in BCNF.

### 2.15 `license_allocations`
- **Candidate Keys:** $\{id\}$ (Primary Key), $\{license\_id, user\_id\}$ (for active allocation instances)
- **Functional Dependencies:**
  - $id \rightarrow \{license\_id, user\_id, allocated\_by, allocated\_at, released\_at, status\}$
- **1NF:** Atomic allocation state and timestamps.
- **2NF:** The candidate key $\{id\}$ is a single attribute.
- **3NF & BCNF:** Determinant is a superkey. Holds in BCNF.

### 2.16 `asset_access_logs`
- **Candidate Keys:** $\{id\}$
- **Functional Dependencies:**
  - $id \rightarrow \{asset\_id, user\_id, license\_id, action, ip\_address, accessed\_at\}$
- **1NF / 2NF / 3NF / BCNF:** Append-only log with single-attribute primary key. Holds in BCNF.

### 2.17 `license_renewals`
- **Candidate Keys:** $\{id\}$
- **Functional Dependencies:**
  - $id \rightarrow \{license\_id, renewed\_by, old\_end\_date, new\_end\_date, cost, notes, renewed_at\}$
- **1NF / 2NF / 3NF / BCNF:** Simple primary key; no transitive dependencies. Holds in BCNF.

### 2.18 `audit_logs`
- **Candidate Keys:** $\{id\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, user\_id, table\_name, record\_id, action, old\_data, new\_data, performed\_at\}$
- **1NF / 2NF / 3NF / BCNF:** Immutable sequential log. Holds in BCNF.

### 2.19 `notifications`
- **Candidate Keys:** $\{id\}$
- **Functional Dependencies:**
  - $id \rightarrow \{tenant\_id, user\_id, license\_id, type, message, is\_read, created\_at\}$
- **1NF / 2NF / 3NF / BCNF:** Single-attribute primary key. Determinant is a superkey. Holds in BCNF.

---

## 3. Worked Normalization Example: Decomposing a Spreadsheet

### 3.1 Unnormalized Form (UNF)
Consider a realistic enterprise tracking spreadsheet used by an organization prior to AssetVault:

| Tenant_Name | Tenant_Slug | Asset_Code | Asset_Name | Asset_Type | Category | Tags | File_URL | Version | Owner_Email | Vendor_Name | License_Name | License_Key | Total_Seats | Allocated_Users | Expiry_Date | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| Acme Corp | acme | AST-01 | Pro Sans | FONT | Typography | Bold, Vector | s3://... | 1 | alice@acme.com | Monotype | Foundry Pro | MONO-991 | 10 | bob@acme.com, carol@acme.com | 2027-01-01 | $1200 |
| Acme Corp | acme | AST-02 | Logo 4K | IMAGE | Branding | SVG, Logo | s3://... | 1 | alice@acme.com | Adobe | Creative Cloud | ADB-442 | 25 | bob@acme.com, dave@acme.com | 2026-12-31 | $4500 |

#### Severe Anomalies in UNF:
- **Repeating Groups / Non-Atomic Fields:** `Tags` contains comma-separated values (`Bold, Vector`). `Allocated_Users` packs multiple employee emails into a single cell.
- **Insertion Anomaly:** Cannot record a new software vendor or license agreement without first creating a digital asset that uses it.
- **Update Anomaly:** If Monotype updates their corporate name or support contact, every row referencing that vendor across the spreadsheet must be manually edited. Inconsistent updates lead to corrupted data.
- **Deletion Anomaly:** If `AST-01` is decommissioned and deleted, the entire Monotype vendor record, contract cost, and license key are permanently lost.

---

### 3.2 Step 1: UNF to First Normal Form (1NF)
**Transformation:** Remove repeating groups and ensure all attribute values are atomic. Split multi-valued fields (`Tags`, `Allocated_Users`) into distinct tuples.

**Composite Candidate Key for 1NF Relation:**
$$\{Tenant\_Slug, Asset\_Code, Version, Tag, Allocated\_User\}$$

| Tenant_Slug | Asset_Code | Version | Tag | Allocated_User | Asset_Name | Owner_Email | Category | Vendor_Name | License_Key | Total_Seats | Expiry_Date | Cost |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| acme | AST-01 | 1 | Bold | bob@acme.com | Pro Sans | alice@acme.com | Typography | Monotype | MONO-991 | 10 | 2027-01-01 | $1200 |
| acme | AST-01 | 1 | Bold | carol@acme.com | Pro Sans | alice@acme.com | Typography | Monotype | MONO-991 | 10 | 2027-01-01 | $1200 |
| acme | AST-01 | 1 | Vector | bob@acme.com | Pro Sans | alice@acme.com | Typography | Monotype | MONO-991 | 10 | 2027-01-01 | $1200 |
| acme | AST-01 | 1 | Vector | carol@acme.com | Pro Sans | alice@acme.com | Typography | Monotype | MONO-991 | 10 | 2027-01-01 | $1200 |

*Evaluation:* The table is in 1NF (atomic values, no repeating groups). However, it suffers massive partial dependencies because `Asset_Name` depends only on $\{Tenant\_Slug, Asset\_Code\}$, not on `Tag` or `Allocated_User`.

---

### 3.3 Step 2: 1NF to Second Normal Form (2NF)
**Transformation:** Eliminate all partial key dependencies by decomposing the relation so that non-prime attributes depend on the entire candidate key.

Decomposed relations:
1. **$R_{Asset}$** $(\underline{Tenant\_Slug, Asset\_Code}, Asset\_Name, Category, Owner\_Email, Vendor\_Name, License\_Key)$
   - Non-prime attributes depend fully on the asset key.
2. **$R_{AssetVersion}$** $(\underline{Tenant\_Slug, Asset\_Code, Version}, File\_URL)$
   - Version details depend on the asset and version number.
3. **$R_{AssetTag}$** $(\underline{Tenant\_Slug, Asset\_Code, Tag})$
   - Junction relation capturing M:N asset-tag association.
4. **$R_{LicenseAllocation}$** $(\underline{Tenant\_Slug, License\_Key, Allocated\_User})$
   - Junction relation capturing M:N seat allocation.
5. **$R_{License}$** $(\underline{Tenant\_Slug, License\_Key}, License\_Name, Vendor\_Name, Total\_Seats, Expiry\_Date, Cost)$
   - License metadata depends fully on the tenant and license key.

*Evaluation:* All relations are in 2NF. However, transitive dependencies still exist. In $R_{Asset}$, $Asset\_Code \rightarrow License\_Key$ and $License\_Key \rightarrow Vendor\_Name$. In $R_{License}$, $License\_Key \rightarrow Vendor\_Name$ and $Vendor\_Name \rightarrow Vendor\_Email$.

---

### 3.4 Step 3: 2NF to Third Normal Form (3NF)
**Transformation:** Eliminate transitive dependencies $X \rightarrow Y \rightarrow Z$ where non-prime attributes determine other non-prime attributes.

Extract vendor entities, categories, users, and licenses into standalone relations with surrogate keys:
- **`tenants`** $(\underline{id}, name, slug, plan\_id)$
- **`users`** $(\underline{id}, tenant\_id, email, full\_name, role\_id)$
- **`vendors`** $(\underline{id}, tenant\_id, name, contact\_email)$
- **`categories`** $(\underline{id}, tenant\_id, parent\_id, name)$
- **`assets`** $(\underline{id}, tenant\_id, category\_id, owner\_id, asset\_code, name)$
- **`asset_versions`** $(\underline{id}, asset\_id, version\_no, file\_url, checksum\_sha256)$
- **`tags`** $(\underline{id}, tenant\_id, name, color)$
- **`asset_tags`** $(\underline{asset\_id, tag\_id})$
- **`licenses`** $(\underline{id}, tenant\_id, vendor\_id, license\_key, total\_seats, cost, end\_date)$
- **`asset_licenses`** $(\underline{asset\_id, license\_id})$
- **`license_allocations`** $(\underline{id}, license\_id, user\_id, status)$

*Result:* Every non-key attribute is determined solely by the candidate key, the whole candidate key, and nothing but the candidate key. Insertion, update, and deletion anomalies are completely eradicated. The schema is in **3NF / BCNF**.

---

## 4. Architectural & Schema Design Justifications

### 4.1 Justification for Storing Polymorphic Mutation Diffs as JSONB in `audit_logs`
AssetVault captures full audit trails for mutations across all 19 relational entities within a single, unified `audit_logs` table using `old_data JSONB` and `new_data JSONB`.
1. **Polymorphic State Representation:** Creating 19 distinct "shadow audit tables" (e.g., `assets_audit`, `licenses_audit`, etc.) causes severe schema sprawl, operational overhead, and maintenance drag. Storing before-and-after row snapshots in `JSONB` allows one centralized table to capture mutations across any relation uniformly.
2. **Schema Evolution Resilience:** When columns are added, renamed, or modified on existing tables, JSONB audit capture requires zero schema migrations or DDL alteration on the audit ledger.
3. **Queryability and Indexing:** PostgreSQL's native `JSONB` format is stored in a decomposed binary format with full support for containment queries (`@>`), existence queries (`?`), and GIN indexing, allowing security teams to query point-in-time attribute changes efficiently (e.g., `WHERE new_data->>'status' = 'REVOKED'`).

### 4.2 Justification for Storing `license_key` Directly in `licenses`
In software asset management, a `license_key` represents the unique cryptographic serial token, product key, or contract activation string issued by the vendor for that specific procurement instance.
1. **Functional Dependency:** The serial token is functionally determined directly by the specific license contract:
   $$\{tenant\_id, license\_key\} \rightarrow \{license\_id\}$$
   It does not represent a shared or cataloged entity that exists independently of the contract.
2. **Business Uniqueness:** A license key cannot be shared across multiple independent license agreements. Placing `license_key` in `licenses` alongside `tenant_id` with a composite unique constraint `UNIQUE (tenant_id, license_key)` enforces real-world contractual constraints while eliminating unnecessary table joins.

### 4.3 Justification for Why `used_seats` is a View Rather Than a Stored Column
A critical database design rule in AssetVault is that derived values are never persisted as static columns in `licenses`. Instead, `used_seats` is computed dynamically via the analytical view `v_tenant_license_utilization`.
1. **Normalization Integrity (3NF):** A stored `used_seats` column would be functionally dependent on the set of active records in `license_allocations`:
   $$\text{used\_seats} = \operatorname{COUNT}(*) \text{ FROM license\_allocations WHERE status = 'ACTIVE'}$$
   Storing this derived aggregation creates a transitive dependency, violating 3NF and introducing update anomalies.
2. **Elimination of Concurrency Race Conditions:** Under concurrent user seat allocations, multiple transactions attempting to increment or decrement a static `used_seats` counter in `licenses` create severe lock contention and desynchronization bugs (e.g., counter drift where `used_seats` reads 10 but exactly 9 active allocation rows exist). Computing via SQL views or transactional checks ensures mathematical accuracy at all times.
