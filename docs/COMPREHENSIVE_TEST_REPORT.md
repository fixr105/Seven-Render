# Comprehensive Test Report

**Generated:** 2026-02-26  
**Scope:** Broken functionality, buttons with no actions, login stickiness across pages, and test run results.

---

## 1. Test Run Summary

### TypeScript typecheck
- **Result:** Passed  
- **Command:** `npm run typecheck`

### Unit tests (Vitest)
- **Result:** 6 failed | 76 passed | 1 skipped (83 total)  
- **Command:** `npm run test`

**Unit test failures:**

| Test file | Failing test | Cause |
|-----------|--------------|--------|
| `Applications.test.tsx` | M3-FE-005: filter applications by status | `Unable to find an accessible element with the role "combobox"` – test expects a combobox for status filter; UI may use a different control (e.g. tabs/buttons). |
| `Applications.test.tsx` | (implicit) | `apiService.getQueries is not a function` – Applications page calls `apiService.getQueries(app.id)` in `fetchQueryCounts`; test mock does not provide `getQueries`, so real `apiService` is used and may not expose it in test env. |
| `NewApplication.test.tsx` | M2-FE-002: access new application page | `getByText(/Application|New Application|Loan/i)` not visible within timeout – page content or loading differs from expectation. |
| `NewApplication.test.tsx` | M2-FE-003: form config loading / error | `expect(apiService.getFormConfig).toHaveBeenCalled()` – mock not invoked (timing or conditional load path). |
| `NewApplication.test.tsx` | M2-FE-003: error when form config fails | Same: `getFormConfig` spy never called. |

**Other unit test notes:**
- Ledger tests: React `act(...)` warnings (state updates not wrapped in `act`).
- Applications: stderr `Error fetching queries for application app1: apiService.getQueries is not a function` indicates missing or incorrect mock for `getQueries` in Applications tests.

### E2E tests (Playwright, Chromium)
- **Run:** 76 tests, local dev servers (frontend + backend) started by Playwright.  
- **Credentials:** Used provided E2E_* env vars (CI unset so fallbacks apply).
- **Observed:** Many tests hit **401 Unauthorized** on API calls after login; backend also logs **webhook timeouts** (n8n) for Loan Application, Clients, Loan Products, Notifications, Commission Ledger, File Auditing Log.
- **Known E2E failure (from partial run):** e.g. `prd-m2-form.spec.ts` – “Access new application page” timed out waiting for text matching `/Application|New Application|Loan/i`.
- **Skipped tests:** Several specs use `test.skip()` when data or UI is missing (e.g. 8-bug-fixes-verification, prd-user-journey, prd-m7-ai-summary, prd-nbfc-decision, prd-m4-queries, prd-m3-status, 2-commission-payout-workflow).

**E2E conclusion:** With local backend + frontend, login often succeeds but subsequent API requests return 401 (cookie/token or proxy setup). Webhook timeouts are an environment/integration issue, not a front-end button/action bug.

---

## 2. Broken Functionality (from code + tests)

### 2.1 401 does not trigger redirect to login (session expiry)
- **Where:** `src/services/api.ts` (401/403 handling), `src/auth/AuthContext.tsx`, `src/hooks/useApplications.ts`.
- **Behavior:** On 401/403, `apiService` clears the token (`clearAuthToken()` / sessionStorage) and returns an error. **AuthContext does not set `user` to `null`** on 401; that only happens on initial `refreshUser()` (e.g. page load) or explicit `logout()`.
- **Result:** After session expiry or invalid token, the UI can still show the app and make requests that fail with 401; the user is not redirected to `/login` until they refresh the page or navigate in a way that triggers a full reload. Comments in `useApplications` (“auth context will handle redirect”) are misleading because no global 401 handler updates auth state.

**Recommendation:** On 401/403, either call a shared “session expired” callback that sets `user` to `null` (so `ProtectedRoute` redirects), or have a central API interceptor that triggers `refreshUser()` / `logout()` and then redirect.

### 2.2 NBFC dashboard: data may never load if `user` is not ready on first mount
- **Where:** `src/pages/dashboards/NBFCDashboard.tsx`.
- **Behavior:** `useEffect` that calls `fetchAssignedApplications()` has dependency array `[]` but uses `userRoleId` (from `user?.nbfcId || user?.id`). If `user` is not yet available on first mount, the effect runs once with `userRoleId === null`, sets loading false and empty list, and **never runs again** when `user` loads.
- **Result:** NBFC users may see an empty dashboard or loading state that never resolves until they refresh.

**Recommendation:** Add `userRoleId` (or `user`) to the effect dependency array so that when auth resolves, the dashboard fetches.

### 2.3 Applications page: `apiService.getQueries` in tests
- **Where:** `src/pages/Applications.tsx` (e.g. `fetchQueryCounts`), `src/services/api.ts` (defines `getQueries`).
- **Behavior:** In unit tests, the Applications page triggers `apiService.getQueries(app.id)`. If the test environment uses a mock that doesn’t define `getQueries`, this throws “getQueries is not a function”.
- **Result:** Broken Applications unit tests and console errors; production behavior depends on real `apiService` having `getQueries`.

**Recommendation:** Ensure test helpers (e.g. `src/test/helpers.ts`) and Applications test setup mock `apiService.getQueries` so that all code paths that call it are covered.

### 2.4 Forgot Password: no self-service action
- **Where:** `src/pages/ForgotPassword.tsx`.
- **Behavior:** Page only shows “Password reset is admin-only. Please contact your administrator” and a “Back to login” link. There is no form or button to request a reset.
- **Result:** Not “broken” per se, but the Forgot Password route provides no actionable reset flow—by design.

---

## 3. Buttons With No Actions / Weak Actions

### 3.1 Credit dashboard – Recent Applications empty state
- **Where:** `src/pages/dashboards/CreditDashboard.tsx`, `src/components/dashboard/RecentApplicationsSection.tsx`.
- **Behavior:** Credit dashboard uses `RecentApplicationsSection` **without** `onEmptyAction`. For the “credit” role, `EMPTY_STATE_CONFIG` has `showCta: false`, so no CTA button is rendered in the empty state.
- **Result:** No dead “empty state” button for Credit; behavior is consistent (no CTA). Only Client and KAM get an empty-state CTA (“Create Your First Application”, “Onboard Your First Client”) with real actions.

### 3.2 Notification click – invalid link
- **Where:** `src/components/layout/TopBar.tsx` – `handleNotificationClick`.
- **Behavior:** If `notification.actionLink` or `notification.relatedFile` is present but doesn’t yield a valid in-app path, the code shows `alert('Invalid notification link')` and closes the panel. There is no “Go to dashboard” or “Dismiss” button in that alert; the only action is closing the notification panel.
- **Result:** Minor UX: user sees an alert with no secondary action beyond closing.

### 3.3 All other buttons checked
- Buttons reviewed across ApplicationDetail, Applications, Ledger, Clients, dashboards (Client/KAM/Credit/NBFC), FormConfiguration, Reports, Settings, Profile, Admin* pages, Modals, ErrorBoundary, Sidebar, TopBar (logout, profile, notifications) have explicit handlers (navigation, refetch, submit, open modal, etc.). **No additional buttons were found that are clearly “no-op” or have no action.**

---

## 4. Login Stickiness Across Pages

### 4.1 How login is persisted
- **Token storage:** `src/services/api.ts` stores the auth token in **sessionStorage** (key from `AUTH_TOKEN_STORAGE_KEY`). The backend can also set an HTTP-only cookie; the client sends both (Bearer in `Authorization` and `credentials: 'include'` for cookies).
- **Auth state:** `AuthContext` holds `user` in React state. On app load, `AuthProvider` runs `refreshUser()` once, which calls `apiService.getMe()`. If that succeeds, `user` is set; if it fails or returns non-success, `user` is set to `null`.
- **Restore on load:** In `ApiService` constructor, `restoreTokenFromStorage()` reads the token from sessionStorage so that after a full page reload, authenticated requests can be sent until the server says otherwise.

### 4.2 Stickiness across SPA navigation
- **Same tab:** As long as the tab is open and sessionStorage is not cleared, token and (until 401) backend session keep the user “logged in.” Navigating between routes (Dashboard, Applications, Ledger, etc.) does not trigger a full reload, so `user` stays set and **login is sticky** across pages.
- **New tab:** sessionStorage is per-tab. A new tab has no token until the user logs in again (or the backend cookie is used if same origin and cookie is set). So “stickiness” does not automatically carry to new tabs unless the backend relies on cookies and they are shared.
- **Refresh:** On refresh, `AuthProvider` runs `refreshUser()`; if `getMe()` succeeds, `user` is restored and the user stays on the current (protected) page; if 401, `user` becomes `null` and `ProtectedRoute` redirects to `/login`.

### 4.3 Gaps affecting “stickiness” and UX
1. **401 mid-session (above):** Token is cleared but React `user` is not, so no automatic redirect to login.
2. **Session expiry:** Same as 401 – user may only see failing requests or errors until they refresh or trigger a reload that runs `refreshUser()`.
3. **Logout:** TopBar logout calls `logout()` (clears token and sets `user` to `null`) then `navigate('/login')` – behavior is correct and consistent.

---

## 5. Summary Table

| Category | Item | Severity | Location |
|----------|------|----------|----------|
| Broken | 401/403 does not clear user or redirect to login | High | api.ts, AuthContext, useApplications |
| Broken | NBFC dashboard may never fetch if user loads after mount | Medium | NBFCDashboard.tsx |
| Broken | Unit tests: getQueries not mocked for Applications | Medium | Applications.test.tsx, test helpers |
| Broken | Unit tests: NewApplication getFormConfig / visibility | Medium | NewApplication.test.tsx |
| Broken | Unit test: Applications status filter expects combobox | Low | Applications.test.tsx |
| Buttons | No no-op buttons found; Credit empty state has no CTA by design | – | RecentApplicationsSection, CreditDashboard |
| Login | Stickiness works across SPA navigation and refresh when token valid | – | AuthContext, api.ts, ProtectedRoute |
| Login | 401 mid-session does not redirect (see Broken) | High | Same as above |
| E2E | 401s and webhook timeouts in local run | Env/config | Backend/auth and n8n |

---

## 6. Fixes Applied (post-report)

The following fixes were implemented:

1. **401/403 → redirect to login:** When the API returns 401 or 403, the app now calls `refreshUser()` from `useAuth()` in the affected flows so that `AuthContext` sets `user` to `null` and `ProtectedRoute` redirects to `/login`. Updated: `useApplications`, `ApplicationDetail`, `ClientDashboard`.
2. **NBFC dashboard data load:** The `useEffect` in `NBFCDashboard` now depends on `userRoleId` so that when the user loads after mount, the dashboard fetches assigned applications.
3. **Unit tests:** Applications test mock now includes `getQueries`; status filter test uses “Filter by” buttons instead of combobox; NewApplication tests wait for loan products to load and select a product before asserting on `getFormConfig`, and use `queryAllByText` where multiple matches exist.

---

## 7. How to Re-run

```bash
# Typecheck
npm run typecheck

# Unit tests
npm run test

# E2E (ensure backend + frontend env; set E2E_* if CI=true)
CI= E2E_CLIENT_USERNAME=... E2E_CLIENT_PASSWORD=... npm run test:e2e -- --project=chromium
```

For a full E2E run against a deployed frontend and backend, set `PLAYWRIGHT_TEST_BASE_URL` and any required `E2E_*` credentials.
