# PRD LATEST DASHBOARD – Reference

This document references the **Seven Fincorp Loan Dashboard – Product Requirements Document (PRD)** (the technical “PRD LATEST DASHBOARD” spec). Use it as the source of truth for API contracts, environment variables, architecture, and deployment.

## Relationship to other docs

- **PRD LATEST DASHBOARD** (root: `PRD LATEST DASHBOARD.pdf`, or the full text spec): Full technical PRD – system architecture, repository inventory, dependencies, build/deploy, env vars, **API & webhook endpoints catalog**, data models (Prisma), RBAC, frontend structure, backend/n8n, AI, testing, security, migration plan, module implementation plan (17.1–17.11).
- **PRD-Revised.md**: Describes the product “as implemented” (workflow, roles, modules M1–M7). Aligns with the same product; implementation details and API paths follow the technical PRD above.
- **prd-implementation-map.md**: Maps PRD modules to backend controllers/routes, frontend pages, and n8n webhooks.
- **PRD_GAP_ANALYSIS.md**: Gap analysis of PRD-Revised vs current implementation.

## API base path

When the app is deployed on **Vercel**, the backend is typically served under `/api`. So the canonical API base URL is the deployment origin plus `/api` (e.g. `https://your-app.vercel.app/api`). Examples:

- Login: `POST /api/auth/login`
- Current user: `GET /api/auth/me`
- Client dashboard: `GET /api/client/dashboard`

The frontend uses `VITE_API_BASE_URL`; in production this should point to the deployed API (e.g. `https://api.your-domain.com` or `https://your-app.vercel.app/api`).

## Auth API (PRD §6)

- **Login:** Body may be `{ username, password }` or `{ email, password }`; both are accepted.
- **Validate (JWT):** `POST /api/auth/validate` with body `{ token: string }` validates the JWT and returns a new token if valid.
- **Validate credentials (legacy):** `POST /api/auth/validate-credentials` with body `{ username, passcode }` for username+passcode login.

## Key references in the technical PRD

- **Section 6:** API & webhook endpoints catalog (paths, methods, auth, description).
- **Section 7:** Data models & schemas (Prisma).
- **Section 17:** Module-by-module implementation plan (17.1 Authentication through 17.11 Deployment).
