# Fix NBFC Tools 404 Errors

When NBFC tools (RAAD, history, etc.) return 404, the frontend is likely calling the wrong backend or the env var wasn’t baked into the build.

## Root Cause

- **Wrong backend** (old): `https://seven-dash.fly.dev` → 404
- **Correct backend**: `https://seven-render.fly.dev` (NBFC routes exist here)
- **Missing env var**: `VITE_API_BASE_URL` must be set in Vercel and a **new deploy** run so it’s included in the build

## Fix: Set VITE_API_BASE_URL in Vercel and Redeploy

1. **Vercel Dashboard** → [Environment Variables](https://vercel.com/dashboard) → Your project → **Settings** → **Environment Variables**
2. Add or edit `VITE_API_BASE_URL`:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://seven-render.fly.dev` (no trailing slash, no `/api`)
   - **Environments**: Production, Preview, Development
3. **Save**
4. **Redeploy** so the env var is baked in:
   - Deployments tab → ⋮ on latest → **Redeploy**
   - Or push a commit to trigger a new build

## Verification

After redeploy, run the verification script:

```bash
./scripts/verify-nbfc-tools.sh
```

Or manually:

```bash
# Health check
curl -s https://seven-render.fly.dev/health

# NBFC tools ping (no auth)
curl -s https://seven-render.fly.dev/api/nbfc-tools-ping

# RAAD route (expect 401 without auth, not 404)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://seven-render.fly.dev/api/nbfc/tools/raad" -F "bankFile=@/dev/null;filename=x.pdf"

# History route (expect 401 without auth)
curl -s -o /dev/null -w "%{http_code}\n" "https://seven-render.fly.dev/api/nbfc/tools/history"
```

**Expected**: `200` for health/ping, `401` for raad/history when unauthenticated (not `404`).

## Summary

| Item | Wrong | Correct |
|------|-------|---------|
| Frontend `VITE_API_BASE_URL` | seven-dash.fly.dev | seven-render.fly.dev |
| Backend deploy target | N/A | seven-render |
