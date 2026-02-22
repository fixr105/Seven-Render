# Application Audit: Broken Logic and Systems

**Date:** 2025-02-21  
**Scope:** Full application (frontend, backend, e2e, config)

---

## Summary

The codebase was audited for broken logic, inconsistent behaviour, and system-level issues. Several **confirmed bugs were fixed**; the rest are documented as recommendations for manual review or follow-up.

---

## Architecture (High Level)

| Layer      | Tech              | Location    |
|-----------|-------------------|------------|
| Frontend  | React 18, Vite 7  | `/src`     |
| Backend   | Express, TS       | `/backend/src` |
| E2E       | Playwright        | `/e2e`     |
| Config    | Vite, Vercel      | `vite.config.ts`, `vercel.json` |

- **Routing:** React Router in `App.tsx`; paths and 404 behaviour in `src/config/appRoutes.ts` and `docs/PATHS_AND_404.md`.
- **API:** Single client in `src/services/api.ts`; backend mounts auth, loan, KAM, credit, NBFC, ledger, reports, etc. in `backend/src/routes/index.ts`.
- **Status:** Backend `statusStateMachine.ts` + constants; frontend `src/lib/statusUtils.ts` (display names and colours). No shared types package.

---

## Fixes Applied

### 1. Applications list – status badge colour (frontend)

- **Issue:** Status column showed display names (e.g. “Under KAM Review”, “Query with Client”) but badge variant was chosen by a switch on different strings (e.g. “Pending KAM Review”, “KAM Query Raised”), so most statuses fell to `default` and looked neutral.
- **Fix:** Use canonical status for colour. Badge now uses `getStatusColor(row.rawStatus)` from `statusUtils.ts` (display text unchanged). Removed unused `getStatusVariant`.
- **File:** `src/pages/Applications.tsx`

### 2. Applications list – wrong API when client raises query (frontend)

- **Issue:** “Raise query” from the list used `credit_team ? raiseQueryToKAM : raiseQueryToClient`. For **client** that called `raiseQueryToClient`, which hits `/kam/loan-applications/:id/queries` (KAM-only) and returns 403 for clients.
- **Fix:** Match ApplicationDetail: **credit_team** → `raiseQueryToKAM`, **kam** → `raiseQueryToClient`, **client** → `createClientQuery` (POST `/loan-applications/:id/queries`).
- **File:** `src/pages/Applications.tsx`

### 3. Loan list – duplicate client/product name and unsafe Form Data parse (backend)

- **Issue:** `client` used `client?.['Client Name'] || client?.['Client Name']` (duplicate); same for product. `formData` used `JSON.parse(app['Form Data'])` with no try/catch, so one malformed string could break the whole list response.
- **Fix:** Use `client?.['Client Name'] ?? app.Client ?? app['Client']` and `product?.['Product Name'] ?? app['Loan Product'] ?? app.loanProduct`. Form Data: parse in try/catch and fall back to `{}` on error.
- **File:** `backend/src/controllers/loan.controller.ts`

### 4. useApplications – Form Data parse can throw (frontend)

- **Issue:** `JSON.parse(String(app['Form Data'] || '{}'))` could throw on invalid JSON and break the applications list.
- **Fix:** Wrapped in try/catch; on error use `{}`.
- **File:** `src/hooks/useApplications.ts`

---

## Issues Addressed

| # | Issue | Resolution |
|---|--------|-------------|
| 1 | Dual status field (`status` / `Status`) | Documented in `api.ts` JSDoc; frontend normalizes at read with `app.status ?? app.Status` in useApplications. |

| 2 | hasRole / hasAnyRole | Added hasAnyRole in AuthContext; ProtectedRoute uses it. |

| 3 | Debug routes and NODE_ENV | Debug routes only when `NODE_ENV=development` and `DEBUG_ROUTES_ENABLED=true`; documented in API_ENDPOINTS_WEBHOOK_MAPPING.md. |

| 4 | Status normalization and filters | Applications "Pending KAM Review" fixed to `under_kam_review` only; comments added for FILTER_TO_RAW_STATUSES / URL maps. |

| 5 | Credit status update and state machine | Manual-test checklist in manual-QA-checklist.md; retry documented as idempotent (same payload). |

| 6 | Form Data shape and parsing | Safe parsing: `parseFormData()` in backend (credit, nbfc, ai controllers); useApplications and ApplicationDetail already had try/catch. |

| 7 | RBAC and list/detail APIs | Documented: ApplicationDetail handles 403 with clear message; list/detail use same RBAC endpoints. |

| 8 | E2E coverage | E2E: client raises query from list (createClientQuery); unit tests for getStatusDisplayName and getStatusColor. |

| 9 | Dashboard data and caching | Documented in SYSTEM_SYNC_ACTIONS_CHECKLIST.md: dashboards use filtered applications; cache invalidation after status change and new application. |

| 10 | API timeouts and retries | Documented in api.ts: timeouts (auth/create 60s, GET 55s, others 30s); credit status retry once, same payload (no double-apply). |

| 11 | ProtectedRoute and roles | Table of path vs allowed roles added to docs/PATHS_AND_404.md. |

---

## Documentation and checklists (added)

- **Credit status (2.5):** Manual-test checklist added to `docs/manual-QA-checklist.md`: Credit transitions (Pending Credit Review → Sent to NBFC, In Negotiation, Rejected, Credit Query); NBFC decision → Approved/Rejected; Admin close. Retries in `api.ts` are for cold-start; retry sends same payload (idempotent, no double-apply).
- **RBAC (2.7):** ApplicationDetail handles 403 from getApplication with a clear "not found or access denied" message and no data leak. List and detail use the same RBAC endpoints.
- **Dashboard/caching (2.9):** KAM/Credit dashboards: pending queries and files-by-stage come from filtered applications; cache invalidation runs after status change and new application (see `n8nClient` invalidation in `docs/SYSTEM_SYNC_ACTIONS_CHECKLIST.md`).
- **API timeouts and retries (2.10):** Documented in `src/services/api.ts`: timeouts auth/create 60s, GET 55s, others 30s; credit status update retries once on 404-like failure; retry sends same payload (no double-apply). Comment added above the retry block.

---

## Verification

After the fixes:

- **Build:** Run `npm run build` (frontend) and backend build/start.
- **Types:** Run `npm run type-check` or equivalent if available.
- **E2E:** Run Playwright smoke and application workflow tests; add or run a test for “client raises query from list” if added.
- **Manual:** As a client, open Applications list, raise a query on an application, and confirm it succeeds (no 403). Check status badges for correct colours across statuses.

---

## References

- Paths and 404: `docs/PATHS_AND_404.md`
- System sync (webhooks, cache, status): `docs/SYSTEM_SYNC_ACTIONS_CHECKLIST.md`, `.cursor/rules/system-sync-planning.mdc`
- Backend webhooks: `backend/API_ENDPOINTS_WEBHOOK_MAPPING.md`
- Status state machine: `backend/src/services/statusTracking/statusStateMachine.ts`
