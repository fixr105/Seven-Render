# KAM SPA Load Test Plan – Applications and Clients on Navigation

**Purpose:** Verify that for KAM (Key Account Manager), **applications** and **clients** load when navigating via the app (sidebar, in-app links) without a full page reload (F5). This validates the isPageReload-removal fixes.

**What was fixed:** Previously, `listClients` on KAM Dashboard and `fetchClients` on the Clients page ran only when `isPageReload()` was true. On SPA navigation (e.g. Dashboard → Clients), the fetch was skipped, so those sections stayed empty until F5. Same pattern was fixed for Applications (via `useApplications`, which already fetched on mount), FormConfiguration, and Reports where applicable.

---

## 1. Scope: What We Verify for KAM

| Page / section       | Data source        | Before fix (SPA nav) | After fix (SPA nav)     |
|----------------------|--------------------|-----------------------|-------------------------|
| **KAM Dashboard**    |                    |                        |                         |
| – Recent Applications| `useApplications`  | Loaded (already on mount) | Loaded               |
| – Client Overview    | `listClients`      | **Empty** (isPageReload)  | **Loaded**           |
| **Applications**     | `useApplications`  | Loaded                 | Loaded                 |
| **Clients**          | `listClients`      | **Empty**              | **Loaded**             |
| **Form Configuration**| `listClients`, `listLoanProducts` | **Empty** | **Loaded**     |
| **Reports**          | `listDailySummaries` | N/A (KAM gets Access Restricted) | No fetch, Access Restricted OK |

We also confirm that a **full reload (F5)** still works as a baseline.

---

## 2. Prerequisites

- **KAM user:** A user that receives `role: 'kam'` and `kamId` from `/auth/validate` (e.g. `Sagar@gmail.com` if your backend returns KAM for that account, or a dedicated KAM test user).
- **Backend:** Running and reachable (e.g. `http://localhost:8080` or your Fly.io API URL). `VITE_API_BASE_URL` (or equivalent) must point to it.
- **Frontend:** Running (e.g. `npm run dev`); use the same origin as in production or your usual test setup.
- **Optional:** At least one managed client and one application for the KAM so “empty” vs “loaded” is distinguishable. If there is no data, “No clients” / “No applications” is acceptable as long as it appears **after** a fetch (loading → empty), not as a skipped fetch.

---

## 3. Manual Test Routine

Use **only** navigation inside the app (sidebar, in-app links). Do **not** use F5, “Reload”, or open a new tab to the same URL during the SPA flow. Use F5 only where the routine says “Full reload” as a separate check.

### 3.1 Login and land on Dashboard (baseline)

1. Open the app at `/login` (or `/` if it redirects to login).
2. Log in as **KAM** (e.g. `Sagar@gmail.com` / `pass@123` if that yields KAM).
3. After login, you should land on **Dashboard** (`/dashboard`).
4. **Wait 3–5 seconds** for requests to finish.

**Pass if:**

- **Recent Applications** (bottom card):  
  - Shows “Loading applications…” then either a table with rows or “No applications from your clients yet” (or similar).  
  - Not a permanent spinner and not obviously “never requested”.
- **Client Overview** (middle card):  
  - Shows “Loading clients…” then either client cards or “No Clients Assigned” / “No clients assigned to you yet” (or similar).  
  - Not a permanent spinner and not obviously “never requested”.
- Top **stats cards** (Managed Clients, Pending Review, etc.) show numbers or 0; they derive from the same data.

If you see “KAM ID not found” in Client Overview, the user has no `kamId` from validate; that is a backend/role setup issue, not an SPA-load bug.

---

### 3.2 SPA: Dashboard → Applications

1. From **Dashboard**, in the sidebar click **Applications** (do **not** refresh or open a new tab).
2. Wait for the page to load (e.g. 3–5 s).

**Pass if:**

- **Applications** page shows either:
  - “Loading…” then a table of applications, or  
  - “Loading…” then “No applications” / “No applications from your clients yet” (or similar).  
- You do **not** see an indefinitely empty table with no loading and no “No applications” message (which would suggest the fetch was skipped).

---

### 3.3 SPA: Applications → Clients

1. From **Applications**, in the sidebar click **Clients**.
2. Wait for the page to load.

**Pass if:**

- **Clients** page shows either:
  - “Loading…” then a table of clients, or  
  - “Loading…” then “No clients” / debug or status line (e.g. “No clients assigned to you yet” for KAM).  
- You do **not** see an indefinitely empty table with no loading and no “No clients”/debug message.

---

### 3.4 SPA: Clients → Form Configuration

1. From **Clients**, in the sidebar click **Form Configuration** (or **Configure Client Forms**, if that’s the label).
2. Wait for the page to load.

**Pass if:**

- **Form Configuration** shows:
  - Loading for clients and/or loan products, then either:
    - A **Client** dropdown with options (or “No clients”) and **Loan product** (or products list), or  
    - Clear “No clients” / “No loan products” (or similar).  
- You do **not** see forever-empty dropdowns with no loading and no “No clients”/“No products” message.

---

### 3.5 SPA: Form Configuration → Reports

1. From **Form Configuration**, in the sidebar click **Reports**.
2. Wait for the page to load.

**Pass if:**

- **Reports** page shows “Access Restricted” or similar (KAM is not credit_team/admin).  
- No crash, no unhandled errors. Fetch for reports does not run for KAM; this step only checks navigation and that the page does not depend on a report list that was never loaded.

---

### 3.6 SPA: Reports → Dashboard (full circle)

1. From **Reports**, in the sidebar click **Dashboard**.
2. Wait for the page to load.

**Pass if:**

- **Dashboard** again shows:
  - **Recent Applications**: loaded or “No applications” (after loading).
  - **Client Overview**: loaded or “No Clients Assigned” (after loading).  
- Same as in 3.1: no permanent empty state that looks like “fetch never ran”.

---

### 3.7 Full reload (F5) baseline

1. From **Dashboard**, press **F5** (full reload).
2. Wait for the page to load.

**Pass if:**

- **Recent Applications** and **Client Overview** behave as in 3.1 (loaded or “No data” after loading).  
- This confirms that the full-reload path still works and is consistent with the SPA path.

---

### 3.8 Refresh and error handling (optional)

1. On **Dashboard**, click **Refresh** in the Action Center (or the Client Overview / Applications section if there is a per-section Refresh).
2. **Pass if:** Data reloads (or stays “No data”) without errors; no duplicate or stuck loading.

3. On **Clients**, if there is a **Refresh** button, click it.  
4. **Pass if:** List reloads (or stays “No clients”) without errors.

5. On **Form Configuration**, if there is a **Refresh** button, click it.  
6. **Pass if:** Clients and loan products reload without errors.

---

## 4. Quick Reference: SPA-Only Path

To stress the SPA path only (no F5 in between):

```
Login → Dashboard (wait) → Applications (sidebar) → Clients (sidebar) → Form Configuration (sidebar) → Reports (sidebar) → Dashboard (sidebar)
```

At each step, ensure:

- Any list/overview that should fetch either shows **loading then data or “No …”**, or a clear error.  
- No step has an **indefinitely empty** list with no loading and no “No …” / error.

---

## 5. E2E (Playwright) – Optional

You can extend the existing KAM test in `e2e/0-role-persona-smoke.spec.ts` to assert that, after SPA navigation, the relevant sections show “loaded” or “empty” (not “never fetched”):

- After `page.goto('/dashboard')` and `waitForLoadState('networkidle')`:  
  - `page.getByText(/Loading clients|Managed Clients|No Clients Assigned|Client Overview/i)` becomes visible (and eventually, if no clients, “No Clients Assigned” or similar).  
  - `page.getByText(/Loading applications|Recent Applications|No applications from your clients/i)` becomes visible.

- After `page.goto('/clients')` (or sidebar click to `/clients`):  
  - `page.getByText(/Loading|Client Management|All Clients|No clients|Found 0 clients/i)` becomes visible.

- After `page.goto('/form-configuration')`:  
  - `page.getByText(/Loading|Select Client|Configure Client Forms|No clients|No loan products/i)` becomes visible.

You can also listen for the relevant API responses (`/api/kam/clients`, `/api/loan-applications`, etc.) and assert they are requested when reaching each page via SPA (and optionally that they return 200).

---

## 6. Checklist Summary

| #   | Step                         | Pass criteria |
|-----|------------------------------|---------------|
| 3.1 | Login → Dashboard            | Recent Applications and Client Overview show loading then data or “No …”. |
| 3.2 | Dashboard → Applications (SPA) | Applications list shows loading then data or “No applications”. |
| 3.3 | Applications → Clients (SPA) | Clients list shows loading then data or “No clients”. |
| 3.4 | Clients → Form Config (SPA)  | Client and product controls show loading then data or “No …”. |
| 3.5 | Form Config → Reports (SPA)  | “Access Restricted” or similar; no crash. |
| 3.6 | Reports → Dashboard (SPA)    | Same as 3.1. |
| 3.7 | F5 on Dashboard              | Same as 3.1 (full-reload baseline). |
| 3.8 | Refresh buttons (optional)    | Data reloads without errors. |

---

## 7. Troubleshooting

- **“KAM ID not found” in Client Overview:** `user.kamId` is missing from `/auth/validate`. Check backend and role/KAM-user mapping.  
- **Persistent “Loading”:** Backend or n8n may be slow or failing; check network tab for `/api/kam/clients`, `/api/loan-applications`, etc.  
- **Empty with no “Loading” or “No …”:** Suggests the fetch was skipped (e.g. old isPageReload behaviour). Confirm the deployed frontend includes the isPageReload-removal changes.  
- **CORS or 401/403:** Verify `VITE_API_BASE_URL` and auth token; check backend logs.

---

*Last updated: 2026-01-25*
