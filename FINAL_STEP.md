# Final Step: Update Frontend Environment Variable

## ✅ Backend is Fixed

- Backend deployed with `/api` prefix
- Routes now available at `/api/loan-products`, `/api/loan-applications`, etc.
- Health check still works at `/health` (for Fly.io)

## 🔧 Update Vercel Environment Variable

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Find your project (probably `seven-dashboard` or similar)
3. Click on it

### Step 2: Add/Update Environment Variable

1. Go to **Settings** → **Environment Variables**
2. Find or add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://seven-dash.fly.dev`
   - **Important**: Do NOT include `/api` - the frontend code adds it automatically
   - ✅ Check: **Production**
   - ✅ Check: **Preview** 
   - ✅ Check: **Development**
3. Click **Save**

### Step 3: Redeploy Frontend

**Option A: Via Dashboard (Easiest)**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **⋯** (three dots) → **Redeploy**
4. Check **Use existing Build Cache** (optional)
5. Click **Redeploy**

**Option B: Via Command Line**
```bash
cd ~/Desktop/Seven-Render
vercel --prod
```

## ✅ Verification

After redeployment (wait 1-2 minutes):

1. Visit `https://lms.sevenfincorp.com`
2. Log in
3. Check browser console (F12 → Console)
4. Loan products and applications should load!

### Test in Browser Console

After logging in, test:
```javascript
// Check API base URL
console.log(import.meta.env.VITE_API_BASE_URL);

// Should show: "https://seven-dash.fly.dev"

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

## Summary

- ✅ Backend deployed with `/api` prefix
- ⏳ Frontend needs: `VITE_API_BASE_URL=https://seven-dash.fly.dev` in Vercel
- ⏳ Frontend needs redeploy after updating env variable

Once you update Vercel and redeploy, loan products and applications will load!




