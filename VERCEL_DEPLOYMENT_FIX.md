# Vercel Deployment Fix - Supabase Error Resolution

## Problem
The app was crashing on Vercel with error:
```
Uncaught Error: Missing Supabase environment variables
```

## Solution
The frontend has been updated to:
1. **No longer require Supabase environment variables** - The app will work without them
2. **Use Backend API by default** - Set `VITE_USE_API_AUTH=true` to use the backend API
3. **Graceful fallback** - If Supabase vars are missing, the app uses a mock client instead of crashing

## Vercel Environment Variables

### Required Variables (Backend API)
Add these to your Vercel project settings:

```bash
# Backend API URL (your deployed backend)
VITE_API_BASE_URL=https://your-backend-api.vercel.app

# Enable Backend API Authentication
VITE_USE_API_AUTH=true
```

### Optional Variables (Legacy Supabase)
Only needed if you want to use Supabase (not recommended):

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `VITE_API_BASE_URL` = Your backend API URL
   - `VITE_USE_API_AUTH` = `true`
4. **Remove** any existing Supabase variables (or leave them empty)
5. Redeploy your application

## Quick Fix for Immediate Deployment

If you need to deploy immediately without backend API:

1. Set in Vercel:
   ```
   VITE_USE_API_AUTH=false
   ```
2. The app will use Supabase auth (if you have those vars) or gracefully handle missing vars

## Testing Locally

1. Create a `.env` file:
   ```bash
   VITE_API_BASE_URL=http://localhost:3000
   VITE_USE_API_AUTH=true
   ```

2. Start your backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Start your frontend:
   ```bash
   npm run dev
   ```

## What Changed

### Files Updated:
- ✅ `src/lib/supabase.ts` - No longer throws error, creates mock client if vars missing
- ✅ `src/App.tsx` - Supports both API auth and Supabase auth
- ✅ `src/components/ProtectedRoute.tsx` - Works with both auth systems
- ✅ `.env.example` - Added configuration examples

### Behavior:
- **Before**: App crashed if Supabase vars were missing
- **After**: App works without Supabase vars, uses backend API by default

## Next Steps

1. **Set Vercel environment variables** (see above)
2. **Deploy your backend API** to Vercel or another hosting service
3. **Update `VITE_API_BASE_URL`** to point to your deployed backend
4. **Redeploy frontend** on Vercel

The app will now work without Supabase! 🎉

