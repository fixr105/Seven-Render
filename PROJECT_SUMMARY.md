# Seven-Render — Project Summary

**Seven Fincorp Loan Management Dashboard** is a proprietary web application for managing loan applications across DSA partners, internal operations, and NBFC lenders. It coordinates **multi-role workflows** (clients, KAMs, credit team, admins, NBFC partners) on a single platform with **role-based access control** and a **canonical loan status state machine**.

---

## What the product does

- **Origination & pipeline:** Clients create and submit applications; KAMs and credit staff review, query, negotiate, assign to NBFCs, and drive files through approval, rejection, disbursement, and closure.
- **Dynamic forms:** Credit configures **per-client (and product-aware) form templates** so application fields and mandatory rules can evolve without redeploying static forms.
- **Commission ledger:** When enabled for a client, the system supports **commission tracking** (pay-in/pay-out, disputes, credit approval flows) tied to disbursement events.
- **NBFC collaboration:** NBFC users work assigned files and access **NBFC-only tools** from a dedicated surface in the app.
- **Operations & compliance:** Admin-style pages cover activity, user accounts, NBFC partner records, reports, and related configuration.

Business capability is described module-by-module (M1–M7) in [`docs/system-overview.md`](./docs/system-overview.md).

---

## How it is built (architecture)

```text
Browser (Vite + React + TypeScript SPA)
  → HTTP API (`VITE_API_BASE_URL`; client appends `/api` — see `src/services/api.ts`)
      → Express API (`backend/`, routes mounted under `/api`)
          → n8n webhooks → Airtable (system of record for core loan data)

Optional: PostgreSQL via Prisma when `DATABASE_URL` is set (supporting/audit features);
primary business entities remain in Airtable.
```

**Typical hosting:** frontend on **Vercel**, API on **Fly.io** (see `fly.toml`, `backend/Dockerfile`). Environment and platform notes live in [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) and [`RENDER_DEPLOYMENT_GUIDE.md`](./RENDER_DEPLOYMENT_GUIDE.md).

---

## Repository layout

| Area | Role |
|------|------|
| `src/` | Vite React app: routes (`App.tsx`), pages, dashboards, hooks, API client, UI components, Tailwind styling |
| `backend/` | Express + TypeScript API: routes, controllers, services (Airtable/n8n, validation, workflows, commissions, forms), auth, middleware |
| `backend/prisma/` | Optional relational schema (Prisma) |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | Deeper product/system documentation (e.g. system overview, PRD notes) |

---

## Roles (RBAC)

| Role | Summary |
|------|---------|
| `client` | DSA partner: applications, optional ledger, queries |
| `kam` | Key account management for assigned clients; forwards work to credit |
| `credit_team` / `admin` | Full pipeline, NBFC assignment, disbursement, admin surfaces |
| `nbfc` | Assigned files, lender decisions, NBFC tools (`/nbfc/tools`) |

Dashboard entry points: `src/pages/dashboards/*.tsx`. Navigation is centralized (e.g. `src/config/sidebar.ts`).

---

## Backend surface (conceptual)

The API aggregates routers from `backend/src/routes/` (see `backend/src/server.ts` and `backend/src/routes/index.ts`). Representative groups:

- **Auth:** JWT login, refresh, session (`/auth`)
- **Loans:** CRUD/list/detail, submit, status transitions, audit, attachments/AI summaries where configured (`/loan-applications`, related paths)
- **Domain slices:** `/client`, `/kam`, `/credit`, `/nbfc`, NBFC tools
- **Ledger & reports:** client ledger, reporting endpoints
- **Catalog & admin:** form categories, products, partners, user administration
- **Health:** `/health`, `/metrics`

Loan status changes are governed by **`backend/src/services/statusTracking/statusStateMachine.ts`** (e.g. `DRAFT`, `UNDER_KAM_REVIEW`, `QUERY_WITH_CLIENT`, `PENDING_CREDIT_REVIEW`, `CREDIT_QUERY_WITH_KAM`, `IN_NEGOTIATION`, `SENT_TO_NBFC`, `APPROVED`, `REJECTED`, `DISBURSED`, `WITHDRAWN`, `CLOSED`).

Airtable access is **mediated by n8n** (`backend/src/services/airtable/n8nClient.ts`, webhook configuration): GET webhooks for reads (with cache invalidation on writes), POST webhooks for creates/updates.

---

## Technology stack

| Layer | Choices |
|-------|---------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide |
| Backend | Express 4, TypeScript, Zod, JWT, bcrypt, rate limiting / security middleware |
| Data | Airtable via n8n; optional Prisma + Postgres |
| Tests | Vitest (frontend unit), Jest (backend), Playwright (e2e) |

---

## Local development & verification

**Frontend (repo root):** `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`.

**Backend:** `cd backend && npm install && npm run dev`; `npm test` for Jest; additional targeted scripts in `backend/package.json` (RBAC, state machine, webhooks, operational scripts).

---

## Documentation map

| Document | Use when |
|----------|----------|
| [`README.md`](./README.md) | Primary onboarding: routes table, stack, scripts, design notes |
| [`docs/system-overview.md`](./docs/system-overview.md) | M1–M7 modules, roles, Airtable/n8n narrative |
| [`backend/README.md`](./backend/README.md) | Backend setup and coarse route list |
| [`backend/API_SPECIFICATION.md`](./backend/API_SPECIFICATION.md) / [`backend/API_ENDPOINTS_WEBHOOK_MAPPING.md`](./backend/API_ENDPOINTS_WEBHOOK_MAPPING.md) | API and webhook mapping (when maintained) |
| [`e2e/README.md`](./e2e/README.md) | Running and extending Playwright suites |

---

## License & ownership

**Proprietary — Seven Fincorp.** Internal/support contact: development team (per root `README.md`).
