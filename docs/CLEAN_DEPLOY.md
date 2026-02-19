# Clean Deploy for lms.sevenfincorp.com

## Problem

Updates work on localhost but don't reflect on production:
- Old pages load
- Changes don't appear even after redeploy
- Browser or CDN serving cached content

## Solution

This project is configured for clean deploys:

### 1. Cache-Control Headers (vercel.json)

- **index.html / SPA routes**: `no-cache, no-store, must-revalidate` — always fetch fresh HTML
- **/assets/\***: `immutable, max-age=31536000` — hashed files can be cached (Vite adds content hashes)

### 2. Force Deploy (No Build Cache)

- **Script**: `./scripts/clean-deploy.sh` — builds and deploys with cache disabled
- **Manual**: `VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force`
- **GitHub Actions**: Deploy workflow uses `--force` and `VERCEL_FORCE_NO_BUILD_CACHE=1`

### 3. Run a Clean Deploy Now

```bash
./scripts/clean-deploy.sh
```

Or manually:

```bash
# Build (fresh)
VERCEL_FORCE_NO_BUILD_CACHE=1 npm run build

# Deploy (skip cache)
VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force
```

### 4. After Deploy

If users still see old content:

- **Hard refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- **Clear site data**: DevTools → Application → Storage → Clear site data for lms.sevenfincorp.com

### 5. Vercel Dashboard (Optional)

To purge CDN cache for a deployment:

1. Vercel Dashboard → Project → Deployments
2. Select the deployment
3. ⋮ menu → Redeploy (with "Use existing Build Cache" **unchecked**)

## Files Changed

| File | Change |
|------|--------|
| `vercel.json` | Added `headers` for Cache-Control |
| `deploy-frontend.sh` | Added `--force` and `VERCEL_FORCE_NO_BUILD_CACHE=1` |
| `.github/workflows/deploy.yml` | Added `--force` and env for clean deploy |
| `scripts/clean-deploy.sh` | New script for one-command clean deploy |
