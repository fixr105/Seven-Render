# Live site test results

Run date: 2026-02-12 (from plan "Test if the live site works").

## 1. Backend health (curl)

| Endpoint | Result |
|----------|--------|
| GET https://seven-dash.fly.dev/health | **200** – `{"success":true,"message":"API is running",...}` |
| GET https://seven-dash.fly.dev/api/health | **401** – "Authentication required" (expected when unauthenticated) |

**Verdict:** Backend is up and responding.

## 2. Frontend load

| URL | Result |
|-----|--------|
| https://seven-dashboard-seven.vercel.app | **200** – Page returns HTML with "Seven Fincorp Loan Management Dashboard Design System" and "Loading...". |

**Verdict:** Frontend is deployed and serves the app shell. The "Loading..." state may complete or hang depending on whether API calls succeed (see CORS below).

## 3. API and CORS

- **GET** https://seven-dash.fly.dev/api/health **without** `Origin`: **401** (expected).
- **GET** with `Origin: https://lms.sevenfincorp.com`: **401** and response headers include `access-control-allow-origin: https://lms.sevenfincorp.com`, `access-control-allow-credentials: true`.
- **GET** with `Origin: https://seven-dashboard-seven.vercel.app`: **500** and no `Access-Control-Allow-Origin` header.

**Verdict:** Backend `CORS_ORIGIN` on Fly.io does **not** include the Vercel production origin. Requests from the live frontend (seven-dashboard-seven.vercel.app) are rejected (500). To fix, set CORS on Fly.io to include the Vercel URL:

```bash
./scripts/set-fly-cors.sh "https://seven-dashboard-seven.vercel.app"
```

Or multiple origins:

```bash
./scripts/set-fly-cors.sh "https://seven-dashboard-seven.vercel.app,https://lms.sevenfincorp.com"
```

## 4. Optional: login flow

Not run in this automated pass. After fixing CORS (step 3), retest manually: open https://seven-dashboard-seven.vercel.app, open DevTools Console and Network, sign in with a test user, and confirm no CORS errors and successful redirect to dashboard.

## Summary

| Check | Status |
|-------|--------|
| Backend /health | Pass |
| Backend /api/health | Pass (401 when unauthenticated) |
| Frontend load | Pass (200, app shell) |
| CORS from Vercel origin | **Pass** – fixed; `CORS_ORIGIN` on Fly.io set to include `https://seven-dashboard-seven.vercel.app`. Verified working by user. |

Live site is working: https://seven-dashboard-seven.vercel.app with backend https://seven-dash.fly.dev.
