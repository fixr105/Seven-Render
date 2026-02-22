# Path audit and 404 usage

This document is the human-readable output for the path audit and answers: **how many 404 pages, and for what actions?**

Source of truth in code: [src/config/appRoutes.ts](../src/config/appRoutes.ts).

---

## Path audit (all open frontend paths)

Every frontend path resolves to either a **defined action** (page or redirect) or the **404 page**. The only 404 entry point is the catch-all route in [App.tsx](../src/App.tsx).

### Redirects

| Path | Outcome |
|------|---------|
| `/` | Redirects to `/dashboard` |
| `/LOGIN` | Redirects to `/login` |
| `/Login` | Redirects to `/login` |

### Actions (pages)

| Path | Description |
|------|-------------|
| `/login` | Login page |
| `/forgot-password` | Forgot password page |
| `/dashboard` | Dashboard |
| `/applications` | Applications list |
| `/applications/new` | New application (client only) |
| `/applications/:id` | Application detail (invalid or no-access id handled **in-page** in ApplicationDetail, not global 404) |
| `/ledger` | Ledger |
| `/clients` | Clients |
| `/profile` | Profile |
| `/settings` | Settings |
| `/reports` | Reports |
| `/admin/activity-log` | Admin activity log |
| `/admin/user-accounts` | Admin user accounts |
| `/admin/nbfc-partners` | Admin NBFC partners |
| `/form-configuration` | Form configuration |
| `/unauthorized` | Unauthorized message (inline) |

### Protected routes and allowed roles

All protected routes use [ProtectedRoute](../src/components/ProtectedRoute.tsx) with optional `allowedRoles`. NBFC-only and client-only routes are explicitly restricted via this list (from [App.tsx](../src/App.tsx)).

| Path | Allowed roles | Note |
|------|----------------|------|
| `/dashboard` | All authenticated | — |
| `/applications` | All authenticated | — |
| `/applications/:id` | All authenticated | 403/no-data handled in ApplicationDetail |
| `/applications/new` | `client` | Client-only; others → /unauthorized |
| `/ledger` | `client`, `kam`, `credit_team`, `admin` | NBFC not allowed |
| `/clients` | `kam`, `credit_team`, `admin` | Client and NBFC not allowed |
| `/profile` | All authenticated | — |
| `/settings` | All authenticated | — |
| `/reports` | All authenticated | — |
| `/admin/activity-log` | `credit_team`, `admin` | — |
| `/admin/user-accounts` | `credit_team`, `admin` | — |
| `/admin/nbfc-partners` | `credit_team`, `admin` | — |
| `/form-configuration` | `credit_team`, `admin` | — |

### 404 (catch-all)

| Path | Outcome |
|------|---------|
| Any path not listed above (e.g. `/foo`, `/admin`, typo URLs) | Renders `NotFoundPage` |

---

## 404 output

- **How many 404 pages:** **1** (the `NotFoundPage` component in [src/pages/NotFoundPage.tsx](../src/pages/NotFoundPage.tsx)).
- **For what actions:** **1 action**
  - **Unmatched route** — Any URL path that does not match any of the defined routes in [App.tsx](../src/App.tsx). Examples: unknown paths, typos, `/admin` without a known subpath. The catch-all `<Route path="*" element={<NotFoundPage />} />` is the only place that renders this page.

Invalid `/applications/:id` (non-existent application or no access) does **not** use the 404 page; it uses the in-page “Application not found” view in ApplicationDetail by design.
