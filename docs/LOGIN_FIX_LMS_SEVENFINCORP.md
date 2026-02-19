# Fix: Login works on localhost but not on https://lms.sevenfincorp.com

## Problem

Login works locally but fails on production with:

> Cannot connect to backend API at https://seven-dash.fly.dev/api/auth/login. This could be due to: CORS configuration (backend must allow your frontend origin)...

## Root cause

The backend on Fly.io (`seven-dash.fly.dev`) only accepts requests from origins listed in `CORS_ORIGIN`. If this secret is set to an old URL (e.g. `https://seven-dashboard-seven.vercel.app`) or is missing `https://lms.sevenfincorp.com`, the browser blocks the login request.

## Fix (2 steps)

### 1. Set CORS on Fly.io to allow lms.sevenfincorp.com

Run this command (requires [Fly CLI](https://fly.io/docs/hacks/install-flyctl/) and `fly auth login`):

```bash
fly secrets set CORS_ORIGIN="https://lms.sevenfincorp.com" --app seven-dash
```

**To allow both production and Vercel previews:**

```bash
fly secrets set CORS_ORIGIN="https://lms.sevenfincorp.com,https://seven-dashboard-seven.vercel.app" --app seven-dash
```

Fly will redeploy after changing secrets. Wait ~1–2 minutes.

### 2. Confirm Vercel env

1. Vercel project → **Settings** → **Environment Variables**
2. Ensure `VITE_API_BASE_URL` = `https://seven-dash.fly.dev` (no trailing slash, no `/api`)
3. Redeploy if you changed it

## Verify

### Backend health

```bash
curl -s https://seven-dash.fly.dev/health
# Expected: {"success":true,"message":"API is running",...}
```

### CORS preflight

```bash
curl -s -I -X OPTIONS "https://seven-dash.fly.dev/api/auth/login" \
  -H "Origin: https://lms.sevenfincorp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Look for: `Access-Control-Allow-Origin: https://lms.sevenfincorp.com`

### Login

1. Open https://lms.sevenfincorp.com/login
2. Enter credentials
3. Login should succeed

## Quick script

```bash
./scripts/set-fly-cors.sh "https://lms.sevenfincorp.com"
```
