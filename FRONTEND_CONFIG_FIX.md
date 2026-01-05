# Fix Frontend Configuration - Loan Products Not Loading

## Problem

Frontend at `https://lms.sevenfincorp.com` is trying to use `/api` (which points to old Vercel serverless), but backend is now on Fly.io at `https://seven-dash.fly.dev` (no `/api` prefix).

## Solution: Update Vercel Environment Variable

### Step 1: Go to Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project (`seven-dashboard` or similar)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add/Update Environment Variable

Add or update:
- **Name**: `VITE_API_BASE_URL`
- **Value**: `https://seven-dash.fly.dev`
- **Important**: Do NOT include `/api` at the end
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

### Step 3: Redeploy Frontend

After updating the environment variable:

**Option A: Via Vercel Dashboard**
- Go to **Deployments** tab
- Click the **3 dots** (⋯) on the latest deployment
- Click **Redeploy**

**Option B: Via Command Line**
```bash
vercel --prod
```

## Verification

After redeployment:

1. Open `https://lms.sevenfincorp.com` in browser
2. Open DevTools (F12) → **Network** tab
3. Log in
4. Check Network tab - API requests should go to `https://seven-dash.fly.dev/api/loan-products` (not `https://lms.sevenfincorp.com/api/...`)
5. Loan products and applications should load

## Current Status

- ✅ Backend deployed and running on Fly.io
- ✅ Health endpoint working
- ✅ CORS configured for `https://lms.sevenfincorp.com`
- ❌ Frontend environment variable needs update in Vercel
- ❌ Frontend needs redeploy after updating env variable

## Test in Browser Console

After redeploy, test in browser console on `https://lms.sevenfincorp.com`:

```javascript
// Should show: "https://seven-dash.fly.dev" or "https://seven-dash.fly.dev/api"
console.log(import.meta.env.VITE_API_BASE_URL);

// Test API call
fetch('https://seven-dash.fly.dev/api/loan-products', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
  }
})
.then(r => r.json())
.then(console.log);
```



