# AssetVault AI Assistant & License Optimization Advisor

This plan integrates the dedicated **AI Assistant & License Optimization Advisor** workspace in the primary sidebar using the server-side `@google/genai` SDK (`gemini-3.8-flash`), and hardens the dev script so Prisma client generation always runs automatically on cold container starts.

## User Review & Critical Decisions

> [!IMPORTANT]
> The dev server is now live and running. Click **Proceed** to build the dedicated AI Assistant sidebar workspace and harden the startup script.

- **Confirmed UI Placement**: Dedicated **AI Assistant** page (`/ai-assistant`) accessible from the main sidebar navigation.
- **Confirmed AI Capability Scope**: A unified 3-mode AI Assistant workspace featuring the **License Optimization & Compliance Advisor**, **Natural Language Database Copilot**, and **Contract Metadata Extractor**.
- **Permanent Cold-Start Guard**: Ensures `prisma generate` runs automatically as part of the `dev` script and wraps `PrismaClient` initialization in a defensive `try/catch` block.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **License Optimization & Compliance Audit**: Analyzes the current tenant's active software/font licenses, seat utilization percentages, upcoming renewal windows, and unallocated seats to generate structured cost-saving recommendations and compliance risk alerts.
  2. **Natural Language Asset & License Copilot**: Allows users to ask plain-English questions about their organization's catalog, seat allocations, vendors, and spend, grounded directly in the tenant's live database state.
  3. **Smart Contract & Quote Analyzer**: Accepts pasted vendor quotes or license agreement snippets and extracts structured fields (vendor, license type, total seats, annual cost, expiry date, and compliance notes) using strict JSON schema validation.
- **Target Audience / Persona**: Tenant Administrators, Asset Managers, and Organization Members (plus Super Administrators inspecting platform-wide health).
- **Key Value**: Transforms static database records into actionable procurement intelligence while preserving strict multi-tenant data isolation and server-side API security.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Sidebar Entry**: Users click **AI Assistant** in the primary sidebar navigation to open the dedicated `/ai-assistant` workspace.
  2. **One-Click Optimization Audit**: Clicking **Run License & Compliance Audit** sends the tenant's current catalog and license utilization summary to the server-side Gemini model, returning a structured breakdown of estimated annual savings, seat reclamation opportunities, expiry risks, and health metrics.
  3. **Interactive Database Q&A**: Users select a suggested prompt or type a custom question in the Copilot panel to receive immediate, data-grounded answers with tabular figures.
  4. **Contract Snippet Parsing**: Users paste raw invoice or contract text into the extractor tab and click **Extract License Metadata** to preview structured database-ready fields.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Enterprise SaaS analytical console matching AssetVault's dark/light theme architecture.
  - *Color Palette & Mood*: Deep slate canvas (`#020617` / `#0F172A`), subtle 1px structural borders (`#1E293B`), indigo primary accents (`#6366F1`), and semantic status indicators (emerald for compliant/optimal, amber for renewal warnings, crimson for over-allocated or expiring seats).
  - *Typography & Hierarchy*: Clean sans headings paired with strict tabular monospace numerals (`JetBrains Mono`, `tabular-nums`) for all seat counts, utilization percentages, and currency figures.
  - *Component Styling & Layout*: Single-elevation bordered panels with clean unboxed metadata (`·` separators), segmented mode tabs at the top of the workspace, and skeleton loading states during AI generation.
- **Interactive Feedback & Motion**:
  - Immediate skeleton shimmer placeholders while awaiting model responses, subtle 150ms hover transitions, and clear error banners with retry actions if an API call fails.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side `@google/genai` Execution with `gemini-3.8-flash`**
  - *Chosen Approach*: All Gemini API calls execute strictly on the Express backend using `@google/genai` and `gemini-3.8-flash` with `User-Agent: 'aistudio-build'`.
  - *Why*: Protects `GEMINI_API_KEY` on the server, enables direct pre-fetching of tenant-scoped database context within the same request lifecycle, and provides fast, low-latency structured JSON and conversational responses.
- **Decision 2: Tenant-Scoped Context Injection**
  - *Chosen Approach*: The backend AI service queries the authenticated user's tenant-scoped Prisma client (`req.prisma`) to assemble a live snapshot of assets, license utilization, vendors, and allocations before invoking Gemini.
  - *Why*: Guarantees zero cross-tenant data leakage and ensures the AI model reasons over real database rows.
- **Decision 3: Fault-Tolerant Prisma Initialization on Boot**
  - *Chosen Approach*: Wrap `new PrismaClient()` instantiation in `try/catch` and run `prisma generate` before `tsx server.ts` in the `dev` script so cold container starts never fail.
  - *Why*: Guarantees 100% startup reliability across container restarts.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Frontend SPA (React 18 + Vite)                       │
│                                                                          │
│  ┌────────────────────┐      ┌────────────────────────────────────────┐  │
│  │  Sidebar NavLink   │─────▶│       AI Assistant Page (/ai-assistant)│  │
│  │  "AI Assistant"    │      ├────────────────────────────────────────┤  │
│  └────────────────────┘      │ • Mode 1: License Optimization Advisor │  │
│                              │ • Mode 2: Natural Language DB Copilot  │  │
│                              │ • Mode 3: Contract Metadata Extractor  │  │
│                              └───────────────────┬────────────────────┘  │
└──────────────────────────────────────────────────┼───────────────────────┘
                                                   │ POST /api/ai/*
                                                   │ (JWT + X-Tenant-ID)
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Backend API (Express + TypeScript)                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Resilient Boot & Tenant Context Middleware                         │  │
│  └───────────────┬────────────────────────────────────┬───────────────┘  │
│                  │                                    │                  │
│                  ▼                                    ▼                  │
│  ┌───────────────────────────────┐    ┌───────────────────────────────┐  │
│  │ Tenant-Scoped Database Layer  │    │   Server-Side Gemini Service  │  │
│  │ (Safe Prisma / MockStore)     │───▶│   (@google/genai SDK)         │  │
│  │ • Assets & Compliance Status  │    │   • Model: gemini-3.8-flash   │  │
│  │ • License Seat Utilization    │    │   • Structured JSON Schemas   │  │
│  │ • Active Seat Allocations     │    │   • Grounded Tenant Context   │  │
│  └───────────────────────────────┘    └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Structured AI Schemas

- **Optimization Audit Response Schema (`Type.OBJECT`)**:
  - `executiveSummary`: Concise assessment of the tenant's overall license posture and compliance health.
  - `estimatedAnnualSavings`: Numeric USD value of reclaimable or over-provisioned seats.
  - `healthScore`: Integer (0–100) representing utilization efficiency and compliance coverage.
  - `recommendations`: Array of structured action items (`title`, `category`, `priority`, `impactSummary`, `affectedResource`, `suggestedAction`).
- **Contract Extractor Response Schema (`Type.OBJECT`)**:
  - `vendorName`, `assetName`, `licenseType` (`SEAT_BASED`, `SUBSCRIPTION`, `PERPETUAL`), `totalSeats`, `annualCost`, `currency`, `expirationDate`, `autoRenew`, and `complianceNotes`.

### Interactive Component & State Mapping

- **Segmented Workspace Switcher**: Switches cleanly between the *Optimization Advisor*, *Database Copilot*, and *Contract Extractor* views while preserving results in component state during the session.
- **Audit Trigger & Filter Controls**: Users can filter AI optimization recommendations by priority (`All`, `High`, `Medium`, `Low`) and copy or export insights.
- **Copilot Conversation State**: Maintains message history, quick-prompt buttons for one-click database questions, loading indicators, and clear history controls.
