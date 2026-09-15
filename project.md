# Seven-Render — Complete Project Context

> **Audience:** Hand this file to another LLM/engineer for full product + technical context.  
> **Repo:** Seven Fincorp Loan Management Dashboard (`Seven-Render`)  
> **Last synthesized:** 2026-09-15 from README, `docs/system-overview.md`, `n8nEndpoints.ts`, status machine, loan Airtable mapping, and related docs.

---

## 1. What this product is

**Seven Fincorp Loan Management Dashboard** is a multi-role web app for DSA partners (clients), KAMs, Credit/Admin, and NBFC lenders to originate, review, query, assign, approve/reject, disburse, and close loan files — plus commission ledger, dynamic forms, audit, reports, and AI summaries.

| Role | Code value | Main job |
|------|------------|----------|
| Client (DSA) | `client` | Create/submit apps, respond to queries, ledger/payouts |
| KAM | `kam` | Manage assigned clients, review apps, query client, forward to credit |
| Credit Team | `credit_team` | Full pipeline, NBFC assign, approve/disburse/close, admin ops |
| Admin | `admin` | Same elevated surface as credit |
| NBFC (Lender) | `nbfc` | Decision on assigned files; NBFC Tools (`/nbfc/tools`) |

---

## 2. High-level architecture

```text
Browser (Vite + React + TypeScript SPA)   port 3000 locally
    │  VITE_API_BASE_URL (origin only; client appends /api)
    ▼
Express API (backend/)                    port 3001 locally
    │  JWT auth + RBAC + Zod/validation + statusStateMachine
    │  In-memory GET cache (invalidated on POST writes)
    ▼
n8n webhooks   N8N_BASE_URL (default https://fixrrahul.app.n8n.cloud)
    ▼
Airtable base "Seven Dashboard"   ← system of record for core business data

Optional: PostgreSQL via Prisma (DATABASE_URL) for ToolJob / supporting features
          (RAAD, PAGER, Query Drafter). Core loan entities still live in Airtable.
```

**Deploy (typical):** Frontend → **Vercel**; Backend → **Fly.io** (`fly.toml`, `backend/Dockerfile`).

**Critical rule:** The backend **never** talks to Airtable’s REST API directly. All reads/writes go through **n8n GET/POST webhooks**.

---

## 3. Repository layout

```text
Seven-Render/
├── src/                         # Vite React SPA
│   ├── App.tsx                  # Routes + ProtectedRoute
│   ├── auth/                    # AuthContext, login
│   ├── pages/                   # Screens + dashboards/
│   ├── components/              # Layout, UI, B2C EV wizard, applications
│   ├── config/                  # sidebar, routes, b2cEvFormSchema
│   ├── hooks/                   # useApplications, useLedger, …
│   ├── lib/                     # statusUtils, loanCalculator, CIBIL probability
│   └── services/api.ts          # HTTP client → /api/*
├── backend/
│   ├── src/server.ts            # Express entry; mounts /api
│   ├── src/routes/              # Auth, loan, client, kam, credit, nbfc, …
│   ├── src/controllers/
│   ├── src/services/
│   │   ├── airtable/            # n8nClient, n8nEndpoints, cache, normalizer
│   │   ├── statusTracking/      # statusStateMachine.ts
│   │   ├── validation/          # mandatory fields, B2C EV validation
│   │   ├── auth/, commission/, queries/, ai/, …
│   └── prisma/                  # Optional Postgres schema
├── e2e/                         # Playwright
├── docs/                        # Deeper docs (system-overview, PRD, calculators)
├── n8n/                         # Webhook connectivity notes / exports
└── project.md                   # THIS FILE
```

### Local run

```bash
# Frontend (port 3000; proxies /api → :3001)
npm install && npm run dev

# Backend (port 3001)
cd backend && npm install && npm run dev
```

Vite proxy (`vite.config.ts`): `/api` → `http://localhost:3001`.

---

## 4. Technology stack

| Layer | Stack |
|-------|--------|
| UI | React 18, TypeScript, Tailwind, Vite 7, React Router 7, Lucide, i18next |
| API | Express 4, TypeScript, Helmet, CORS, cookie-parser, rate limits |
| Auth | JWT (backend); `src/auth/AuthContext.tsx` |
| Data | Airtable via n8n; optional Prisma/Postgres |
| Validation | Zod + custom services |
| Tests | Vitest (FE), Jest (BE), Playwright (e2e) |

---

## 5. Product modules (M1–M7)

| Module | Name | Status |
|--------|------|--------|
| M1 | Pay In/Out Ledger (commission) | Implemented — auto entry on disbursement |
| M2 | Master Form Builder | Implemented — per-client form config + version freeze |
| M3 | Loan File Status Tracking | Implemented — state machine + history |
| M4 | Audit Trail & Query Dialog | Implemented — File Auditing Log + notifications |
| M5 | Action Center | Implemented — role dashboards / pending work |
| M6 | Daily Summary Reports | Implemented — aggregate + email via n8n |
| M7 | AI File Summary | Implemented — OpenAI / n8n; stored on loan record |

---

## 6. Airtable architecture

### 6.1 Base

| Item | Value |
|------|--------|
| Base name | Seven Dashboard |
| Base ID (docs) | `appzbyi8q7pJRl1cd` |
| Access path | App → Express → **n8n** → Airtable |

Canonical table IDs and webhook paths live in code:

`backend/src/services/airtable/n8nEndpoints.ts`

### 6.2 Entity relationship (conceptual)

```text
User Accounts ──role──► Client | KAM User | Credit Team User | NBFC Partner
                              │
Clients ──Assigned KAM──► KAM Users
   │
   ├── Client Form Mapping ──► Form Categories / Form Fields
   │                      └──► Form Link / Record Titles / Product Documents
   │
   └── Loan Applications ──► Loan Products
            │                └── Vehicles / Client KYC (B2C EV helpers)
            ├── Assigned NBFC ──► NBFC Partners
            ├── Form Data (JSON blob) + Documents (URL string)
            ├── File Auditing Log (queries, status changes)
            ├── Notifications
            └── Commission Ledger (on DISBURSED)

Admin Activity Log ── system-wide ops audit
Daily Summary Reports ── aggregated daily snapshots
```

### 6.3 Tables (names + IDs from `n8nEndpoints.ts`)

| Table name (fetch) | Table ID constant | Purpose |
|--------------------|-------------------|---------|
| User Accounts | `tblQ1rT8wW3yA6cC9` | Login identity, role, status |
| Clients | `tblK8mN3pQvR5sT7u` | DSA partners; Assigned KAM; commission rate; modules |
| KAM Users | `tblM7nP4rS9tU2vW5` | KAM profiles |
| Credit Team Users | `tblX9yZ2wV4nM6pQ8` | Credit profiles |
| NBFC Partners | `tblP0qS7vV2xZ5bB8` | Lenders |
| Loan Application | `tblN8oQ5sT0vX3yZ6` * | Core loan files |
| Loan Products | `tblVukvj8kn5gWBta` | Product catalog |
| Form Categories | `tblqCqXV0Hds0t0bH` | Form sections |
| Form Fields | `tbl5oZ6zI0dc5eutw` | Field defs |
| Client Form Mapping | `tbl70C8uPKmoLkOQJ` | Client ↔ fields/categories |
| Form Link / Record Titles | string IDs in code | Newer form-config model |
| Product Documents | `tblProductDocuments` | Required docs per product |
| Commission Ledger | `tblrBWFuPYBI4WWtn` | Pay-in / pay-out |
| File Auditing Log | `tblL1XJnqW3Q15ueZ` | Per-file audit + queries |
| Notifications | `tblmprms0l3yQjVdx` | In-app notifications |
| Daily Summary Report | `tbla3urDb8kCsO0Et` | Daily rollups |
| Admin Activity Log | `tbl8qJ3xK5vF2hNpL` | Global admin log |
| Vehicles | `tblVehicles` | B2C EV vehicle catalog |
| Client KYC | `tblClientKYC` | Dealer KYC autofill |

\* Live POST column allow-list for loans is documented against table `tbl85RSGR1op38O3G` in `backend/src/utils/loanApplicationAirtableMapping.ts` / `docs/loan-applications-airtable-field-mapping.json`. Prefer **column names in code** over conflicting historical table IDs in older markdown.

### 6.4 Loan Applications — columns that are POSTed

Allow-list (`LOAN_APPLICATION_AIRTABLE_COLUMNS`):

`File ID`, `Client`, `KAM ID`, `Applicant Name`, `Loan Product`, `Requested Loan Amount`, `Mobile Number`, `Email Id`, `Remarks`, `Select`, `Documents`, `Status`, `Assigned Credit Analyst`, `Assigned NBFC`, `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`, `Approved Loan Amount`, `AI File Summary`, `Form Data`, `Creation Date`, `Submitted Date`, `Last Updated`, `MD`

**Important:** Almost all wizard fields live inside **`Form Data`** as a JSON string. Airtable columns are promoted/summary fields for list views and workflow (status, NBFC, amounts, etc.).

**Documents format:** comma-separated `slotId:url|fileName` (e.g. geo photos).

### 6.5 How records relate in practice

1. **User Accounts.Username** (email) → login.  
2. Role decides which profile table is loaded (Client / KAM / Credit / NBFC).  
3. **Clients.Assigned KAM** scopes KAM visibility.  
4. **Loan Applications.Client** scopes client apps; **Assigned NBFC** scopes NBFC apps.  
5. **Form Data** holds B2C EV structure: `borrower.*`, `loan.*`, `_meta.panLookup.*`, `_meta.doRequest.*`, support person, geo photos, etc.  
6. Writes invalidate in-memory GET caches in `cache.service.ts`.

---

## 7. n8n webhook architecture

**Base:** `{N8N_BASE_URL}/webhook/{path}`

### 7.1 Naming conventions (gotchas)

| Op | Loan applications path | Notes |
|----|------------------------|-------|
| GET | `loanapplication` (singular) | Fetch/search |
| POST | `loanapplications1` (code) / historically `loanapplications` | Create/update |

Many POST paths use CamelCase or ALLCAPS; GET paths are mostly lowercase. **Source of truth:** `N8N_GET_WEBHOOK_PATHS` / `N8N_POST_WEBHOOK_PATHS` in `n8nEndpoints.ts` (not older markdown alone).

### 7.2 GET paths (read)

| Path key | Typical path | Table |
|----------|--------------|-------|
| USER_ACCOUNT | `useraccount` | User Accounts |
| CLIENT | `client` | Clients |
| KAM_USERS | `kamusers` | KAM Users |
| CREDIT_TEAM_USER | `creditteamuser` | Credit Team Users |
| NBFC_PARTNERS | `nbfcpartners` | NBFC Partners |
| LOAN_APPLICATION | `loanapplication` | Loan Applications |
| LOAN_PRODUCTS | `loanproducts` | Loan Products |
| FORM_CATEGORIES / FORM_FIELDS | `formcategories` / `formfields` | Forms |
| CLIENT_FORM_MAPPING | `clientformmapping` | Client Form Mapping |
| COMMISSION_LEDGER | `commisionledger` | Commission Ledger (note spelling) |
| FILE_AUDITING_LOG | `fileauditinglog` | File Auditing Log |
| NOTIFICATIONS | `notifications` | Notifications |
| ADMIN_ACTIVITY | `Adminactivity` | Admin Activity Log |
| DAILY_SUMMARY_REPORT | `dailysummaryreport` | Daily Summary |
| PRODUCT_DOCUMENTS | `productdocument` | Product Documents |
| VEHICLES | `VehiclesGET` | Vehicles |
| CLIENT_KYC | `getclientKYC` | Client KYC |
| CIBIL rate matrix | env `CIBIL_RATE_MATRIX_WEBHOOK_URL` or default webhook | Rate bands |

### 7.3 POST paths (write)

| Path key | Typical path | Table / action |
|----------|--------------|----------------|
| LOAN_APPLICATIONS | `loanapplications1` | Upsert loan file |
| FILE_AUDIT_LOG | `Fileauditinglog1` | Audit / query events |
| POST_LOG | `POSTLOG` | Admin activity |
| CLIENT | `Client` | Client upsert |
| ADD_USER | `adduser` | User account |
| COMMISSION_LEDGER | `COMISSIONLEDGER` | Ledger entry |
| NOTIFICATION | `notification` | Notification |
| EMAIL | `email` | Outlook send |
| NBFC_PARTNERS | `NBFCPartners1` | NBFC upsert |
| LOAN_PRODUCTS | `loanproducts1` | Product upsert |
| … | see `n8nEndpoints.ts` | Form mapping, categories, fields, vehicles, etc. |

### 7.4 Client implementation

- **`n8nClient.ts`:** `fetchTable(name)`, `postLoanApplication(...)`, cache helpers, timeouts.  
- **`n8nApiClient.ts`:** lower-level HTTP.  
- **`recordNormalizer.service.ts`:** flattens Airtable `{id, fields}` shapes.  
- **`dataFilter.service.ts`:** RBAC-oriented filtering after fetch.

Full API↔webhook walkthrough: `backend/API_ENDPOINTS_WEBHOOK_MAPPING.md`.

---

## 8. Backend API surface (groups)

Mounted under `/api` (`backend/src/routes/index.ts`):

| Group | Prefix | Notes |
|-------|--------|-------|
| Auth | `/auth` | login, refresh, me, logout |
| Loans | `/loan-applications` | CRUD, submit, status, queries, AI |
| Client | `/client` | dashboard, form-config, applications |
| KAM | `/kam` | clients, form config, DO actions |
| Credit | `/credit` | pipeline, assign NBFC, clients list |
| NBFC | `/nbfc`, `/nbfc/tools` | decisions; RAAD/PAGER/query drafter |
| Ledger / Reports | `/clients`, `/reports` | commission, summaries |
| Config | `/config` | e.g. CIBIL rate matrix |
| Health | `/health`, `/metrics` | probes |

Debug routes only when `NODE_ENV=development` **and** `DEBUG_ROUTES_ENABLED=true`.

---

## 9. Auth & RBAC

1. `POST /api/auth/login` → GET `useraccount` → match email on `Username` → check Active → bcrypt/plaintext password → JWT with `{ userId, email, role, clientId?, kamId?, nbfcId? }`.  
2. Background: load role profile tables; optionally POST `adduser` for Last Login.  
3. Middleware: `authenticate` + role guards (`requireClient`, `requireKAM`, …).  
4. Controllers filter Airtable rows by `clientId` / assigned KAM / assigned NBFC.

Frontend: `AuthContext` stores token; `api.ts` sends `Authorization: Bearer …` (and cookies where used).

---

## 10. Loan status state machine

**Canonical enum** (`backend/src/config/constants.ts`):

`draft` → `under_kam_review` → `query_with_client` ↔ … → `pending_credit_review` → `credit_query_with_kam` / `in_negotiation` → `sent_to_nbfc` → `approved` → `disbursed` → `closed`  
Also: `rejected`, `withdrawn`.

**Enforcement:** `backend/src/services/statusTracking/statusStateMachine.ts`  
- `STATUS_TRANSITIONS` — allowed edges  
- `ROLE_STATUS_PERMISSIONS` — who may set which target status  
- `normalizeToCanonicalStatus` — aliases like `forwarded_to_credit` → `pending_credit_review`

**Frontend display:** `src/lib/statusUtils.ts` (`normalizeStatus`, tile counts).

**On DISBURSED:** commission ledger entry may be auto-created (M1).

### Lender decision fields (separate from Status)

- `Lender Decision Status`: Pending / Approved / Rejected / Needs Clarification  
- `Lender Decision Date`, `Lender Decision Remarks`, `Approved Loan Amount`  
NBFC records decision; Credit drives disbursement/close.

---

## 11. Forms & B2C EV application logic

### 11.1 Dynamic forms (M2)

- Master: Form Categories + Form Fields.  
- Per client: Client Form Mapping (+ Form Link / Record Titles / Product Documents).  
- On submit: freeze **Form Config Version** into Form Data meta.  
- Validation: `validateMandatoryFields` / B2C-specific validators on FE + BE.

### 11.2 B2C EV wizard (major product path)

Key files:

- `src/components/applications/B2CEvApplicationWizard.tsx`  
- `src/config/forms/b2cEvFormSchema.ts`  
- `src/lib/loanCalculator.ts` + `LoanCalculator.tsx`  
- `src/lib/b2cEvCibilProbability.ts`  
- Backend: `b2cEvFormValidation.service.ts`, PAN lookup mappers, DO request services

Flow sketch:

1. PAN lookup → CIBIL + borrower meta into `_meta.panLookup.*`  
2. **CIBIL probability bar** (UI only — see §12)  
3. Support person / guarantor optional  
4. Loan calculator → freeze ROI/PF/EMI into `loan.*` keys  
5. Documents / geo photos → OneDrive URLs → Documents string + Form Data  
6. Draft persist / submit → POST loanapplications webhook  

### 11.3 Pricing / CIBIL rate matrix

- Dynamic bands from n8n (`GET /api/config/cibil-rate-matrix`).  
- Fallback hardcoded band: CIBIL 0–900 → ROI **35%**, PF **8%** (`cibilRateMatrix.service.ts`).  
- Affects **rates/fees**, not approve/reject.

---

## 12. CIBIL chances (dynamic Lender BRE)

Client-facing “chances” are **not** hardcoded CIBIL bands anymore.

- Airtable table **NBFC BRE Config** via n8n `GET /webhook/lenderbre`
- Backend: `CibilChancesService` → `GET /api/config/cibil-chances?cibil=`
- Returns `{ score, label }` to clients; staff (`kam` / `credit_team` / `admin`) also get `recommendedLender`
- Label bands: 0 Almost No Chance · 1–33 Co-applicant · 34–66 Chances · 67–100 High Chance
- Score &lt; 50 on B2C EV **borrower** stage gates Next and offers **Proceed with Seven One** (`draft` → `seven_one`)

Lender names must never appear in client UI or client API payloads.

---

## 13. Queries, audit, notifications

- Raise query → File Auditing Log + status branch (`query_with_client` or `credit_query_with_kam`) + Notification.  
- Resolve → only author (or KAM/Credit for any) per query service rules.  
- Admin Activity Log via `POSTLOG` for system-wide actions.  
- B2C EV also has DO (Disbursement Order) request meta (`_meta.doRequest.*`) with KAM approve/reject.

---

## 14. NBFC tools

Routes under `/nbfc/tools`: RAAD, PAGER, Query Drafter — often backed by separate n8n hosts + **Prisma `ToolJob`** when `DATABASE_URL` is set. Frontend also has helpers like `raadWebhook.ts` / `pagerWebhook.ts` for direct fetch in some environments.

---

## 15. Environment variables (essentials)

**Frontend:** `VITE_API_BASE_URL` = backend origin only (no `/api`). Locally often empty (uses Vite proxy).

**Backend:**

| Var | Purpose |
|-----|---------|
| `N8N_BASE_URL` | n8n root |
| `JWT_SECRET` | JWT signing |
| `CORS_ORIGIN` | Allowed frontend origin(s) |
| `PORT` | Default 3001 |
| `DATABASE_URL` | Optional Postgres |
| `CIBIL_RATE_MATRIX_WEBHOOK_URL` | Optional override |
| Various `N8N_*` | Specific webhook URL overrides |

Full list: `ENVIRONMENT_VARIABLES.md`, `.env.example`.

---

## 16. Frontend routes (high level)

| Path | Roles |
|------|--------|
| `/login`, `/forgot-password`, `/reset-password` | public |
| `/dashboard` | all authenticated |
| `/applications`, `/applications/:id` | all |
| `/applications/new` | client |
| `/ledger` | client, kam, credit, admin |
| `/clients` | kam, credit, admin |
| `/form-configuration` | credit, admin |
| `/admin/*` | credit, admin |
| `/nbfc/tools` | nbfc |
| `/reports`, `/profile`, `/settings` | varies |
| `/calculator` | EMI range (standalone; separate from wizard freeze) |

---

## 17. Worked Example A — Login + Client dashboard

**Goal:** Client `anya@example.com` opens the app and sees her files.

```text
1. Browser POST /api/auth/login { email, password }
2. Backend GET {N8N}/webhook/useraccount
   → find Username match (case-insensitive), Status=Active, verify password
3. Issue JWT { role: "client", clientId: "CLI-…", … }
4. Background GET /webhook/client → attach Client profile
5. Browser GET /api/auth/me  (session restore)
6. Browser GET /api/client/dashboard (or applications list)
7. Backend GET /webhook/loanapplication (+ ledger, audit as needed)
8. Filter rows where Client matches clientId
9. Aggregate status tiles via normalizeStatus()
10. UI: ClientDashboard
```

**Failure modes to know:** empty n8n body, timeout (~55s on some GETs), cache serving stale rows until a POST invalidates, email overwritten if POST useraccount sends non-email into Email field (historical footgun).

---

## 18. Worked Example B — B2C EV draft → submit → KAM forward → Credit → NBFC

**Goal:** End-to-end happy path for one EV loan file.

```text
[CLIENT]
1. POST /api/loan-applications  (draft)
   - Validate partial form / allow incomplete draft
   - Build Airtable payload (File ID, Client, Form Data JSON, Status=draft or omit)
   - POST n8n loanapplications1
   - POST Fileauditinglog1 (created)
   - Optional POSTLOG

2. PAN lookup → CIBIL stored in Form Data `_meta.panLookup.cibilScore`
   - UI shows CibilProbabilityBar (hardcoded tiers; no BRE)

3. LoanCalculator freezes loan.interestRate, processing fee, EMI, amounts into Form Data
   - Rate band from GET /api/config/cibil-rate-matrix (or default 35%/8%)

4. Client submits
   - Mandatory validation (B2C EV + product documents)
   - Status: draft → under_kam_review (state machine + CLIENT role)
   - Set Submitted Date, freeze form config version in Form Data
   - POST loan update + audit + notify Assigned KAM

[KAM]
5. KAM opens /applications/:id
6. Optional: raise query → status query_with_client → client responds → under_kam_review
7. KAM forwards → pending_credit_review
   - validateTransition(KAM, under_kam_review → pending_credit_review)
   - POST loan Status + File Auditing Log + notify credit

[CREDIT]
8. Credit reviews; optional credit_query_with_kam or in_negotiation
9. Credit assigns NBFC → sent_to_nbfc
   - Sets Assigned NBFC (+ may set analyst)
   - POST loanapplications1

[NBFC]
10. NBFC lists assigned apps; records Lender Decision Status = Approved
    - May set Approved Loan Amount + remarks
    - Status → approved (NBFC permission)

[CREDIT]
11. Mark disbursed → disbursed
    - Commission Ledger POST (client rate × disbursed amount)
12. Close → closed
```

**Airtable after step 4 (illustrative Form Data fragment):**

```json
{
  "File ID": "SF20260915001",
  "Client": "recClientABC",
  "KAM ID": "USER-…",
  "Applicant Name": "Ravi Kumar",
  "Loan Product": "LP-EV-B2C",
  "Requested Loan Amount": 450000,
  "Status": "under_kam_review",
  "Form Data": "{ \"borrower.customerName\": \"Ravi Kumar\", \"loan.amount\": \"450000\", \"loan.interestRate\": \"35\", \"_meta.panLookup.cibilScore\": \"720\", \"_meta.formConfigVersion\": \"…\" }",
  "Submitted Date": "2026-09-15T10:00:00.000Z"
}
```

---

## 19. Prisma / Postgres (optional)

When `DATABASE_URL` is set, Prisma models include mirrors/helpers such as `UserAccount`, `LoanFile`, `CommissionLedger`, `ToolJob`, etc. (`backend/prisma/schema.prisma`). **Do not assume Prisma is the primary store for loan workflow** — production pipeline is Airtable-first via n8n. Postgres is required for some NBFC AI tool job persistence.

---

## 20. Testing map

| Layer | Command | Notes |
|-------|---------|-------|
| FE unit | `npm run test` | Vitest |
| BE unit | `cd backend && npm test` | Jest |
| E2E | `npm run test:e2e` | Playwright; credentials via env |
| State machine / RBAC | backend `test:statemachine`, `test:rbac` | Dedicated runners |

Do-not-regress checklist: `.cursor/rules/do-not-regress.mdc` (8 bug fixes around draft submit, queries, KAM names, tiles, ledger, admin filters).

---

## 21. Key source files (bookmark list)

| Concern | Path |
|---------|------|
| FE routes | `src/App.tsx` |
| API client | `src/services/api.ts` |
| Status UI | `src/lib/statusUtils.ts` |
| CIBIL chances UI | `src/lib/b2cEvCibilProbability.ts` |
| Loan math | `src/lib/loanCalculator.ts` |
| Webhook paths / table IDs | `backend/src/services/airtable/n8nEndpoints.ts` |
| n8n HTTP + cache | `backend/src/services/airtable/n8nClient.ts` |
| Status machine | `backend/src/services/statusTracking/statusStateMachine.ts` |
| Loan Airtable columns | `backend/src/utils/loanApplicationAirtableMapping.ts` |
| Constants / enums | `backend/src/config/constants.ts` |
| API ↔ webhook doc | `backend/API_ENDPOINTS_WEBHOOK_MAPPING.md` |
| Modules narrative | `docs/system-overview.md` |
| Env | `ENVIRONMENT_VARIABLES.md` |

---

## 22. Invariants for any code change

1. **Never** call Airtable API from app code — use n8n client/endpoints.  
2. Status changes must go through **`validateTransition` / state machine**.  
3. Loan POSTs must stay within **Airtable column allow-list**; put new fields in **Form Data** JSON unless a real Airtable column is added + mapped.  
4. After POST, **invalidate** related GET caches.  
5. GET vs POST path spelling for loans differs (`loanapplication` vs `loanapplications1`).  
6. Commission spelling in webhook: **`commisionledger`** / **`COMISSIONLEDGER`**.  
7. Do not treat CIBIL probability tiers as lender BRE.  
8. Preserve the 8 do-not-regress behaviors when touching status/query/ledger/dashboard.

---

## 23. Related docs (deeper dives)

- `README.md` / `PROJECT_SUMMARY.md` — short overview  
- `docs/system-overview.md` — M1–M7 + Airtable narrative  
- `docs/dynamic-pf-interest-rate-system.md` — calculator / PF / ROI  
- `docs/loan-details-calculator-logic.md` — loan math  
- `docs/FORM_INPUT_FLOW_CHECKLIST.md` — form action checklist  
- `WEBHOOK_TABLE_MAPPING.md`, `WEBHOOK_FIELD_MAPPING.md` — mapping tables  
- `n8n/WEBHOOK_CONNECTIVITY.md` — connectivity pitfalls  

---

*End of project context document.*
