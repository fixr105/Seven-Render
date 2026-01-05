# Fix Frontend-Backend Connection

## Problem

Frontend at `https://lms.sevenfincorp.com` is trying to connect to `/api` (relative path), but backend is on Fly.io at `https://seven-dash.fly.dev`.

## Solution

### Step 1: Start Backend on Fly.io

The backend machines are currently stopped. Start them:

```bash
cd backend
fly scale count 1 --app seven-dash --yes
```

Wait a few seconds, then verify:
```bash
curl https://seven-dash.fly.dev/health
```

Should return: `{"success":true,"message":"API is running",...}`

### Step 2: Configure CORS on Fly.io Backend

Allow requests from your frontend domain:

```bash
fly secrets set CORS_ORIGIN=https://lms.sevenfincorp.com --app seven-dash
```

Restart backend:
```bash
fly apps restart --app seven-dash
```

### Step 3: Update Frontend Environment Variable

You need to set `VITE_API_BASE_URL` to point to Fly.io backend.

**Option A: If Frontend is on Vercel**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update: `VITE_API_BASE_URL` = `https://seven-dash.fly.dev`
3. **Important**: Do NOT include `/api` - Fly.io serves at root
4. Redeploy frontend

**Option B: If Frontend is Self-Hosted**

1. Set environment variable in your hosting platform
2. `VITE_API_BASE_URL=https://seven-dash.fly.dev`
3. Restart/redeploy frontend

**Option C: If Using Custom Domain/Server**

Set the environment variable in your deployment configuration:
```bash
export VITE_API_BASE_URL=https://seven-dash.fly.dev
```

### Step 4: Verify Configuration

After setting the environment variable and redeploying:

1. Check browser console - API calls should go to `seven-dash.fly.dev`
2. Test health endpoint in browser console:
   ```javascript
   fetch('https://seven-dash.fly.dev/health')
     .then(r => r.json())
     .then(console.log)
   ```
3. Try logging in - should work now

## Important Notes

1. **No `/api` suffix needed**: Fly.io backend serves at root (`https://seven-dash.fly.dev/health`, not `/api/health`)

2. **CORS must be configured**: Backend must allow requests from `https://lms.sevenfincorp.com`

3. **Backend must be running**: Check with `fly status --app seven-dash`

## Quick Fix Commands

```bash
# 1. Start backend
cd backend
fly scale count 1 --app seven-dash --yes

# 2. Set CORS
fly secrets set CORS_ORIGIN=https://lms.sevenfincorp.com --app seven-dash

# 3. Restart backend
fly apps restart --app seven-dash

# 4. Verify backend is working
curl https://seven-dash.fly.dev/health

# 5. Then update frontend environment variable:
# VITE_API_BASE_URL=https://seven-dash.fly.dev
# (Set in your frontend hosting platform - Vercel, custom server, etc.)
```

## After Fix

Once configured correctly:
- Frontend at `https://lms.sevenfincorp.com` will make requests to `https://seven-dash.fly.dev`
- All API endpoints will work
- No more NetworkError




