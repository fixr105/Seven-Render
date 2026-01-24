# System-Wide Broken Issues

**Generated:** January 23, 2026  
**Scope:** Frontend, backend, E2E, infra, and cross-cutting

---

## Critical – user-facing

### 1. Profile save does not persist

**Where:** `src/pages/Profile.tsx` (lines 78–94)

**What:** `handleSave` shows an alert and does not call any API:

```ts
alert('Profile update functionality will be implemented via backend API');
```

**Impact:** Edits to name, phone, company are never saved. UX is misleading.

**Backend:** `PATCH /api/user-accounts/:id` exists but:

- Allowed only for `credit_team`.
- Body: `accountStatus`, `role`, `associatedProfile` (no `name`, `phone`, `company`).

**Needed:**

- New or extended endpoint for self-service profile: e.g. `PATCH /api/user-accounts/me` or `PATCH /api/user-accounts/:id` with `{ name, phone, company }` when `req.user.id === id`.
- `apiService.updateProfile({ name, phone, company })` and wire Profile’s `handleSave` to it.

---

### 2. Settings save – backend exists, E2E/local can 404

**Where:** `src/pages/Settings.tsx` (lines 50–70)

**What:** `updateUserSettings(user.id, settings)` → `PATCH /api/user-accounts/:id/settings`. Backend:

- `users.controller.updateUserSettings`:
  - Ensures `req.user.id === id`.
  - Loads User Accounts from n8n, finds `a.id === id`, merges `settings` into `Settings` and POSTs back.

**Impact:**

- **Production with real User Accounts:** Can work if `user.id` is a real User Accounts id and n8n/Airtable has a `Settings` (or equivalent) field and webhooks work.
- **E2E / local without matching n8n data:** Auth uses mock ids (`recE2ECredit01`, etc.). `PATCH /user-accounts/recE2ECredit01/settings` still hits n8n; that id is not in User Accounts → 404. E2E does not mock the users controller, only auth login.

**Optional improvement:**

- In E2E (or when `E2E_USE_MOCK_USER_ACCOUNTS=1`), either:
  - Mock or short-circuit `updateUserSettings` to return 200 and skip n8n, or
  - Document that Settings are not asserted in E2E and 404 is expected.

---

## High – UX / navigation

### 3. Footer “Privacy”, “Terms”, “Support” are placeholders

**Where:** `src/components/layout/Footer.tsx` (lines 24–42)

**What:** Links use `href="#"`, `preventDefault`, and `alert('… - Coming soon!')`.

**Impact:** Placeholder only; not broken, but should be removed or replaced with real routes/URLs before production.

---

### 4. Manual refresh after ApplicationDetail actions

**Where:** `src/pages/ApplicationDetail.tsx` and `FUNCTIONAL_ISSUES_ANALYSIS.md`

**What:** Several flows (e.g. query status, reports) tell the user to refresh the page to see updates. Hooks like `useLedger`, `useApplications` comment “user must manually refresh”.

**Impact:** Feels outdated; increases risk of stale data.

**Improvement:** After successful mutations, call `refetch` / `refreshUser` or invalidate and refetch so the UI updates without a full reload.

---

## Backend / infra

### 5. E2E: 429 from API rate limiter

**Where:** `backend/src/middleware/rateLimit.middleware.ts`, `backend/package.json`

**What:**

- `apiRateLimiter`: 100 requests per 15 minutes (when not skipped).
- `shouldSkipRateLimit` is `true` only when  
  `NODE_ENV === 'development' && ENABLE_RATE_LIMITS !== 'false'`.
- Backend `npm run dev` does not set `NODE_ENV`; it is inherited. In Playwright `webServer`, it is often unset → not `development` → rate limit is applied.
- Four role-persona E2E tests generate many API calls (applications, notifications, ledger, reports, etc.). Hitting 100 in a 15‑minute window is possible → 429.

**Seen in logs:**  
`Error fetching payout requests: Too many requests, please try again later`,  
`Error fetching applications: Too many requests, please try again later`, etc.

**Options:**

- In E2E, run backend with `NODE_ENV=development` or `ENABLE_RATE_LIMITS=false` in `webServer.env`.
- Or add a separate, higher limit (or skip) for E2E (e.g. via a header or `E2E_USE_MOCK_USER_ACCOUNTS`).

---

### 6. E2E: “Failed to fetch” and “Cannot connect to backend API”

**Where:** E2E console:  
`baseUrl: /api`,  
`Error fetching applications: Cannot connect to backend API. The frontend is missing the VITE_API_BASE_URL...`

**What:** With `baseUrl = '/api'`, the browser calls the same origin; Vite proxies `/api` to the backend. “Failed to fetch” can be:

- Backend not ready when the first requests run.
- Proxy not active yet (timing at startup).
- Intermittent 429 or 5xx causing the generic “Cannot connect” message.

**Mitigation:** Align with rate-limit fixes (above). Optionally add retries or a short “warm-up” after `webServer` health checks before critical E2E steps.

---

### 7. n8n “Unexpected end of JSON input” in E2E

**Where:** Backend logs, e.g.  
`[fetchTable] Fetch error for Commission Ledger: Unexpected end of JSON input`  
`[fetchTable] Fetch error for Credit Team Users: Unexpected end of JSON input`

**What:** n8n webhooks often return non‑JSON or empty bodies (misconfiguration, timeouts, or E2E hitting real n8n without proper test data). `n8nClient` / `fetchTable` then fails to parse.

**Impact:** Handled in many code paths (e.g. empty arrays, fallback names in `getMe`), so E2E can still pass. The same in production would mean missing or wrong data from Airtable.

**Note:** `E2E_USE_MOCK_USER_ACCOUNTS=1` only mocks the **auth** user-accounts fetch. All other n8n usage (Commission Ledger, Credit Team Users, Clients, Loan Application, Notifications, etc.) still hits real n8n in E2E.

---

### 8. getMe “Credit user not found in table”

**Where:** `backend/src/controllers/auth.controller.ts` (getMe, credit_team branch)

**What:** For `credit_team`, getMe fetches “Credit Team Users” from n8n and looks up by `creditTeamId` or `email`. If not found or n8n errors, it logs  
`[AuthController] getMe: Credit user not found in table` and continues.

**Impact:** getMe still returns 200 with `name` from JWT or email. So auth and E2E continue to work; the log is a warning, not a hard failure.

---

## Already fixed or OK

- **Credit Ledger 403:** `useLedger` now calls `getPayoutRequests()` for `credit_team` instead of `getClientPayoutRequests()`, avoiding 403 and token clear. Credit E2E passes.
- **ClientForm:** Uses `navigate('/dashboard')`, not `window.location`.
- **FormConfiguration:** Uses `<Link to="/clients">` for Clients.
- **Login “Forgot passcode”:** Not present in current `Login.tsx`; no dead link.
- **Settings:** Wired to `PATCH /user-accounts/:id/settings`; works when User Accounts and n8n are correctly set up; can 404 in E2E with mock ids.

---

## From existing docs (for reference)

- **ISSUES_TO_FIX.md:** Form config loading, mandatory field validation, document upload storage, notification delivery, etc.
- **FUNCTIONAL_ISSUES_ANALYSIS.md:** Profile, Settings, ClientForm, Forgot password, ApplicationDetail refresh, FormConfiguration, error boundaries, navigation, button states.

---

## Suggested order of work

1. **Profile:** Implement self-service profile API and `updateProfile`; connect `Profile` `handleSave`.
2. **E2E rate limit:** Set `NODE_ENV=development` or `ENABLE_RATE_LIMITS=false` (or an E2E-specific bypass) for the backend `webServer` in `playwright.config.ts` to avoid 429 in E2E.
3. **Settings in E2E:** Either mock `updateUserSettings` when `E2E_USE_MOCK_USER_ACCOUNTS=1` or accept 404 and document it.
4. **ApplicationDetail / hooks:** Add refetch after mutations to remove “please refresh” for key flows.
5. **Footer:** Replace or remove “Coming soon” placeholders before production.
6. **n8n in E2E:** Decide whether to broaden E2E mocks for n8n (beyond auth) or to run E2E against a dedicated n8n test env with stable data.
