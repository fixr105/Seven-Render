# Seven Fincorp Loan Management Dashboard

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/fixr105/Seven-Render?utm_source=oss&utm_medium=github&utm_campaign=fixr105%2FSeven-Render&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Multi-role loan operations dashboard: DSA clients, KAMs, Credit team (including admin), and NBFC partners. The UI is a **Vite + React + TypeScript** SPA; the **Express + TypeScript** API lives in `backend/` and integrates with **Airtable through n8n webhooks**.

## Architecture at a glance

```text
Browser (Vite/React)
    → API base URL (`VITE_API_BASE_URL`, origin without `/api`; client code in `src/services/api.ts` appends `/api`)
        → Express under `/api` (backend/) — auth, RBAC, validation, state machine
            → n8n GET/POST webhooks → Airtable
Optional: PostgreSQL via Prisma (`DATABASE_URL`) for audit/logging when configured; core business data remains in Airtable.
```

**Typical deployment:** frontend on **Vercel**, API on **Fly.io** (`fly.toml` builds `backend/Dockerfile`). See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) and [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) for env and hosting notes.

## User roles

| Role | Purpose |
|------|---------|
| `client` | Create/submit applications, ledger (when M1 enabled), queries |
| `kam` | Assigned clients, form-related workflows, forward to credit |
| `credit_team` | Full pipeline, NBFC assignment, disbursement, admin pages (with `admin`) |
| `admin` | Same app surface as credit with elevated operations (e.g. Credit dashboard) |
| `nbfc` | Assigned files, lender decision, **NBFC Tools** (`/nbfc/tools`) |

Role-specific home views: `src/pages/dashboards/ClientDashboard.tsx`, `KAMDashboard.tsx`, `CreditDashboard.tsx`, `NBFCDashboard.tsx`. Sidebar items are centralized in `src/config/sidebar.ts` (`useSidebarItems`).

## Frontend routes (high level)

Defined in `src/App.tsx` (all authenticated areas use `ProtectedRoute` + `ErrorBoundary` where wrapped):

| Path | Roles | Notes |
|------|--------|------|
| `/dashboard` | all | Role-specific dashboard |
| `/applications`, `/applications/:id` | all | List and detail |
| `/applications/new` | client | New application |
| `/ledger` | client, kam, credit_team, admin | Commission ledger |
| `/clients` | kam, credit_team, admin | Client management |
| `/form-configuration` | credit_team, admin | Dynamic form configuration |
| `/admin/activity-log`, `/admin/user-accounts`, `/admin/nbfc-partners` | credit_team, admin | Admin |
| `/nbfc/tools` | nbfc | NBFC utilities |
| `/reports`, `/profile`, `/settings` | varies | Reports and account |
| `/privacy`, `/terms` | public | Legal |
| `/login`, `/forgot-password`, `/reset-password` | public | Auth |

Authentication is **JWT via the backend** (`src/auth/AuthContext.tsx` → `src/services/api.ts`), not Supabase.

## Repository layout

```text
Seven-Render/
├── src/                          # Vite React app
│   ├── App.tsx                   # Routes
│   ├── auth/                     # Login, AuthContext, types
│   ├── components/               # Layout, UI, dashboards, guards
│   ├── config/                   # sidebar.ts, appRoutes.ts
│   ├── hooks/                    # useApplications, useNotifications, useLedger, …
│   ├── lib/                      # statusUtils, applicationsStatusCatalog
│   ├── pages/                    # Screens + dashboards/
│   ├── services/                 # api.ts (API client), webhooks helpers
│   └── utils/                    # Validation, transforms, errors
├── backend/
│   ├── src/
│   │   ├── routes/               # Express routers (auth, loan, nbfc, ledger, …)
│   │   ├── controllers/
│   │   ├── services/             # n8n/Airtable, status, commission, forms, AI, …
│   │   ├── auth/
│   │   ├── middleware/           # RBAC, rate limits
│   │   └── server.ts
│   └── prisma/                   # Optional Postgres schema (Prisma)
├── e2e/                          # Playwright specs
└── docs/                         # Deeper docs (e.g. system-overview, PRD, deployment)
```

## Backend API surface

Mounted under `/api` from `backend/src/server.ts`; `backend/src/routes/index.ts` aggregates modules. Illustrative groups:

- **Auth:** `/auth` — login, refresh, me, logout  
- **Loans:** `/loan-applications`, queries, audit, AI summary attachments  
- **Domain:** `/client`, `/kam`, `/credit`, `/nbfc`, `/nbfc/tools` (NBFC-only tools)  
- **Ledger / reports:** `/clients` (ledger), `/reports`  
- **Catalog / admin data:** `/form-categories`, products and partners under `/`, `/credit-team-users`, `/users` routes  
- **Health:** `/health`, `/metrics` (for probes and ops)

RBAC is enforced in middleware (`authenticate`, role-specific `require*` helpers). Loan status changes go through **`statusStateMachine.ts`** (canonical statuses include `DRAFT`, `UNDER_KAM_REVIEW`, `QUERY_WITH_CLIENT`, `PENDING_CREDIT_REVIEW`, `CREDIT_QUERY_WITH_KAM`, **`IN_NEGOTIATION`**, `SENT_TO_NBFC`, `APPROVED`, `REJECTED`, `DISBURSED`, `WITHDRAWN`, `CLOSED`).

Data access to Airtable is **via n8n** (`backend/src/services/airtable/n8nClient.ts`, `webhookConfig.ts`): GET webhooks for reads (with in-memory cache invalidated after writes), POST webhooks for creates/updates. See [docs/system-overview.md](./docs/system-overview.md) for module M1–M7 narrative and webhook-oriented field notes.

## Technology stack

| Layer | Stack |
|-------|--------|
| UI | React 18, TypeScript, Tailwind CSS, Vite, Lucide React, React Router |
| API | Express 4, TypeScript, Helmet, CORS, cookie-parser, rate limiting |
| Data | Airtable (via n8n); optional Prisma/Postgres for supporting features |
| Validation | Zod (frontend/backend where used) |
| Tests | Vitest (frontend unit), Jest (backend), Playwright (e2e) |

## Scripts

**Root (`package.json`):**

- `npm run dev` — Vite dev server  
- `npm run build` — typecheck + production build  
- `npm run test` — Vitest  
- `npm run test:e2e` — Playwright  

**Backend (`backend/package.json`):**

- `npm run dev` — `tsx watch src/server.ts`  
- `npm run build` / `npm start` — compile and run  
- `npm test` — Jest  
- Various `test:*` runners for RBAC, state machine, validation, etc.

## Design system (summary)

Boltt-oriented fintech UI: primary `#2A5DB0`, secondary `#20A070`, responsive breakpoints, shared layout in `src/components/layout/` (`MainLayout`, `Sidebar`, `TopBar`). Components under `src/components/ui/`.

## Configuration

- **Frontend:** set `VITE_API_BASE_URL` to the **backend origin only** (for example `https://seven-render.fly.dev`). The app adds `/api` automatically in `src/services/api.ts`.  
- **Backend:** `N8N_BASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, optional `DATABASE_URL`, etc. Full lists: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

## Further documentation

- [docs/system-overview.md](./docs/system-overview.md) — modules M1–M7, roles, Airtable/n8n tables and webhook naming  
- [backend/API_SPECIFICATION.md](./backend/API_SPECIFICATION.md) / [backend/API_ENDPOINTS_WEBHOOK_MAPPING.md](./backend/API_ENDPOINTS_WEBHOOK_MAPPING.md) — API and webhook mapping (when maintained)  
- [e2e/README.md](./e2e/README.md) — end-to-end testing  

## License

Proprietary - Seven Fincorp

## Support

For questions or issues, contact the development team.
