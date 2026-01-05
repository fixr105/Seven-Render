# Fix: Frontend Cannot Connect to Backend

## Problem
The frontend deployed on Vercel cannot connect to the backend on Fly.io, showing:
```
Cannot connect to backend API at https://seven-dash.fly.dev/api/auth/validate
```

## Root Cause
The frontend needs the `VITE_API_BASE_URL` environment variable set in Vercel to point to the Fly.io backend.

## Solution

### Step 1: Set Environment Variable in Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Navigate to your project (likely `seven-render` or similar)
3. Go to **Settings** → **Environment Variables**
4. Add/Update the following variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://seven-dash.fly.dev`
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

### Step 2: Redeploy Frontend

After setting the environment variable, you need to redeploy:

1. Go to **Deployments** tab in Vercel
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

### Step 3: Verify Backend is Running

Test the backend directly:
```bash
curl -X POST https://seven-dash.fly.dev/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

Expected response (even if n8n webhook isn't registered):
```json
{"success":false,"error":"The requested webhook \"POST validate\" is not registered."}
```

This confirms the backend is reachable.

### Step 4: Activate n8n Webhook

The backend is working, but the n8n webhook needs to be activated:

1. Go to your n8n instance: https://fixrrahul.app.n8n.cloud
2. Create or find the workflow with webhook path `validate`
3. Ensure the webhook trigger is set to:
   - **Path**: `validate`
   - **Method**: `POST`
   - **Full URL**: `https://fixrrahul.app.n8n.cloud/webhook/validate`
4. **Activate the workflow** (toggle in top-right)
5. Test the webhook:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username":"test","passcode":"test"}'
   ```

## Alternative: Use Vercel Serverless Functions

If you prefer to keep everything on Vercel, you can:

1. Remove `VITE_API_BASE_URL` from Vercel environment variables
2. Ensure `vercel.json` has the correct rewrites
3. Deploy the backend code to Vercel's serverless functions

However, the current setup (Fly.io backend) is recommended for better performance and reliability.

## Troubleshooting

### Still seeing connection errors?

1. **Check browser console** for CORS errors
2. **Verify CORS_ORIGIN** in Fly.io backend:
   ```bash
   fly secrets list --app seven-dash
   ```
   Should include: `CORS_ORIGIN=https://lms.sevenfincorp.com`
3. **Test from browser console**:
   ```javascript
   fetch('https://seven-dash.fly.dev/api/health')
     .then(r => r.json())
     .then(console.log)
   ```

### Backend returns 404 from n8n?

This is expected if the n8n webhook isn't activated. The backend is working correctly; you just need to activate the n8n workflow.

## Quick Fix Summary

```bash
# 1. Set in Vercel Dashboard → Settings → Environment Variables
VITE_API_BASE_URL=https://seven-dash.fly.dev

# 2. Redeploy frontend in Vercel

# 3. Activate n8n webhook at https://fixrrahul.app.n8n.cloud
```
