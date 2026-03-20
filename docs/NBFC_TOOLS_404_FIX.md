# Fix NBFC Tools 404 Errors

When NBFC tools (RAAD, history, etc.) return 404, the frontend is likely calling the wrong backend. The backend with NBFC tools is deployed to **seven-render.fly.dev**, not seven-dash.fly.dev.

## Root Cause

- **Frontend calls**: `https://seven-dash.fly.dev/api/nbfc/tools/...` → 404
- **Correct backend**: `https://seven-render.fly.dev` (where CI deploys and NBFC routes exist)

## Fix: Update Vercel VITE_API_BASE_URL

1. **Vercel Dashboard** → Your project → **Settings** → **Environment Variables**
2. Find `VITE_API_BASE_URL`
3. **Change** from `https://seven-dash.fly.dev` to **`https://seven-render.fly.dev`**
4. Ensure it applies to **Production** (and Preview if needed)
5. **Redeploy** the frontend so the new URL is baked into the build

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
