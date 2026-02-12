# Live site setup (after deploy)

Use this checklist when the GitHub Deploy workflow succeeds but the live app does not work. All fixes are configuration-only (Vercel and Fly.io).

## 1. Verify backend

Backend should respond at:

- **GET** https://seven-dash.fly.dev/health → expect `200` and `{"success":true,"message":"API is running",...}`
- **GET** https://seven-dash.fly.dev/api/health → may return `401` if auth is required; that is OK. `502`/timeout means the app is down.

```bash
curl -s https://seven-dash.fly.dev/health
```

## 2. Vercel: set API URL and redeploy

The frontend needs the backend URL at **build time** via `VITE_API_BASE_URL`.

1. Open **Vercel** → your project → **Settings** → **Environment Variables**.
2. Add or edit:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://seven-dash.fly.dev`
   - **Environments:** Production (and Preview if you use preview deployments).
3. Do **not** add `/api`; the client appends it.
4. **Redeploy** the frontend (Vite bakes `VITE_*` into the build):
   - Vercel dashboard → Deployments → ⋮ on latest → Redeploy, or
   - Push a commit to `main` and let the Deploy workflow run again.

## 3. Fly.io: set CORS to your frontend origin

The backend allows only origins listed in `CORS_ORIGIN`. If the live site is on Vercel, you must set this on Fly.io.

1. Get your **exact** frontend URL (e.g. `https://seven-render.vercel.app` or the URL from Vercel).
2. From the repo root (with [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and logged in):

```bash
# Replace YOUR_VERCEL_URL with your actual Vercel production URL (no trailing slash)
flyctl secrets set CORS_ORIGIN=https://YOUR_VERCEL_URL -a seven-dash
```

Multiple origins (comma-separated, no spaces):

```bash
flyctl secrets set "CORS_ORIGIN=https://seven-render.vercel.app,https://lms.sevenfincorp.com" -a seven-dash
```

3. Fly redeploys automatically when secrets change.

## 4. Fly.io: ensure required secrets (if API returns 500 or "N8N_BASE_URL required")

Backend expects these secrets on Fly.io. Set them if missing:

```bash
flyctl secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud -a seven-dash
flyctl secrets set JWT_SECRET="$(openssl rand -base64 32)" -a seven-dash
# CORS_ORIGIN already set in step 3
```

List secrets (values are hidden):

```bash
flyctl secrets list -a seven-dash
```

View logs after redeploy:

```bash
flyctl logs -a seven-dash
```

## 5. Retest the live site

1. Open the live Vercel URL in a **new incognito/private window** (or hard refresh).
2. Open DevTools → **Console** and **Network**.
3. If you see:
   - **"VITE_API_BASE_URL environment variable is required"** → Vercel env not set or frontend not redeployed after setting it.
   - **CORS error** on requests to `https://seven-dash.fly.dev` → `CORS_ORIGIN` on Fly.io does not include your Vercel origin (step 3).
   - **401** on API calls → often CORS/cookie related; ensure `CORS_ORIGIN` is set so the backend sends cookies for your origin.
   - **500** or **"N8N_BASE_URL required"** → set Fly.io secrets (step 4).

## Summary

| Where   | Variable             | Value / action |
|---------|----------------------|----------------|
| Vercel  | `VITE_API_BASE_URL` | `https://seven-dash.fly.dev` then **redeploy** |
| Fly.io  | `CORS_ORIGIN`        | Your exact frontend URL(s), e.g. Vercel production URL |
| Fly.io  | `N8N_BASE_URL`       | `https://fixrrahul.app.n8n.cloud` |
| Fly.io  | `JWT_SECRET`         | At least 32 chars, e.g. `openssl rand -base64 32` |

Reference: [.env.production.example](.env.production.example) for the frontend API URL.
