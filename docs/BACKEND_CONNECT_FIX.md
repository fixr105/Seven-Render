# Fix: Cannot connect to backend API at seven-dash.fly.dev

## What’s going on

The frontend at `https://lms.sevenfincorp.com` calls `https://seven-dash.fly.dev/api/auth/login`. You see:

> Cannot connect to backend API at https://seven-dash.fly.dev/api/auth/login. This could be due to: Network connectivity, CORS, Server down, Missing VITE_API_BASE_URL

Common causes:

1. **Wrong image on Fly (goStatic)** – The app `seven-dash` was previously deployed with the **root** `Dockerfile` (goStatic on 8080) instead of the **backend** Node/Express API. The root `fly.toml` and `Dockerfile` have been removed; you must deploy from `backend/`.
2. **CORS** – Backend must allow `https://lms.sevenfincorp.com` in `Access-Control-Allow-Origin`.
3. **Vercel env** – Frontend needs `VITE_API_BASE_URL=https://seven-dash.fly.dev` and a redeploy.

---

## 1. Deploy the backend to Fly.io (from `backend/`)

**Important:** Deploy only from the `backend/` directory so Fly uses `backend/Dockerfile` (Node) and `backend/fly.toml` (port 3001). **Do not** run `fly deploy` from the repo root.

From the repo root:

```bash
cd backend
flyctl deploy --app seven-dash --remote-only
```

(Or `fly deploy --app seven-dash --remote-only` if you use `fly`.)

- Needs: [Fly CLI](https://fly.io/docs/hacks/install-flyctl/) and `flyctl auth login` (or `FLY_API_TOKEN` in CI).
- Deploy uses `backend/Dockerfile` and runs `node dist/server.js` on port 3001.

---

## 2. CORS on Fly.io

The backend defaults to `https://lms.sevenfincorp.com` when `CORS_ORIGIN` is **unset** in production. If you set `CORS_ORIGIN` on Fly, it must include your frontend origin.

**If you want to set it explicitly (recommended):**

```bash
fly secrets set CORS_ORIGIN="https://lms.sevenfincorp.com" --app seven-dash
```

**To allow both production and Vercel previews:**

```bash
fly secrets set CORS_ORIGIN="https://lms.sevenfincorp.com,https://seven-dashboard-seven.vercel.app" --app seven-dash
```

After changing secrets, Fly restarts the app automatically.

---

## 3. Vercel: `VITE_API_BASE_URL`

1. Vercel project → **Settings** → **Environment Variables**
2. Add or update:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://seven-dash.fly.dev`  
     (no `/api` – the frontend adds it)
3. Enable: Production, Preview, Development.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new value is used.

---

## 4. Check the backend

**Confirm it’s Node, not goStatic:**

```bash
fly logs -a seven-dash
```

You should see Node/Express logs (e.g. `Server started`, `Daily summary job started`). If you see `goStatic` or `Listening at http://0.0.0.0:8080`, the wrong image is still deployed — deploy again from `backend/` as in step 1.

**Health:**

```bash
curl -s https://seven-dash.fly.dev/health
# Expected: {"success":true,"message":"API is running",...}
```

**API health:**

```bash
curl -s https://seven-dash.fly.dev/api/health
# Expected: JSON with success/status.
```

**CORS (from browser or with Origin):**

```bash
curl -s -I -X OPTIONS "https://seven-dash.fly.dev/api/auth/login" \
  -H "Origin: https://lms.sevenfincorp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
# Look for: Access-Control-Allow-Origin: https://lms.sevenfincorp.com
```

If `/health` or `/api/health` is 404 or returns HTML (e.g. SPA), the Fly app is not running the Express backend – redeploy the backend as in step 1.

---

## 5. Code change in this fix

In `backend/src/server.ts`:

- If `CORS_ORIGIN` is **unset** and `NODE_ENV=production`, the server defaults to  
  `CORS_ORIGIN=https://lms.sevenfincorp.com`.
- `optionsSuccessStatus: 204` is set for CORS preflight.

So in production, `lms.sevenfincorp.com` is allowed even when `CORS_ORIGIN` is not set on Fly. Setting `CORS_ORIGIN` on Fly overrides this default.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | `cd backend && flyctl deploy --app seven-dash --remote-only` |
| 2 | `fly secrets set CORS_ORIGIN="https://lms.sevenfincorp.com" --app seven-dash` (optional but recommended) |
| 3 | In Vercel: `VITE_API_BASE_URL=https://seven-dash.fly.dev` and redeploy |
| 4 | `curl -s https://seven-dash.fly.dev/health` → JSON with `"success":true` |
| 5 | Login at https://lms.sevenfincorp.com |
