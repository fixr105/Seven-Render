# Frontend Testing Guide

This guide explains how to test your frontend with the Fly.io backend.

## Architecture

- **Frontend**: React app (deploy on Vercel or run locally)
- **Backend**: Express API on Fly.io (`https://seven-dash.fly.dev`)

## Step 1: Start Backend on Fly.io

Your backend machines are currently stopped. Start them:

```bash
cd backend
fly machine start --app seven-dash
```

Or scale up:
```bash
fly scale count 1 --app seven-dash
```

Verify backend is running:
```bash
fly status --app seven-dash
curl https://seven-dash.fly.dev/health
```

## Step 2: Configure Frontend to Point to Fly.io Backend

### Option A: Test Locally (Development)

1. **Create/Update `.env` file** in project root:

```bash
# .env
VITE_API_BASE_URL=https://seven-dash.fly.dev
```

2. **Start frontend dev server**:

```bash
npm install
npm run dev
```

3. **Access frontend**: `http://localhost:3000`

### Option B: Deploy to Vercel (Production)

1. **Set Environment Variable in Vercel Dashboard**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_BASE_URL` = `https://seven-dash.fly.dev`
   - Apply to: Production, Preview, Development

2. **Deploy**:
   ```bash
   vercel --prod
   ```
   
   Or push to GitHub (if auto-deploy is enabled)

3. **Access frontend**: Your Vercel URL (e.g., `https://your-app.vercel.app`)

## Step 3: Test the Frontend

### Basic Tests

1. **Login Page**:
   - Navigate to `/login`
   - Try logging in with test credentials
   - Check browser console for API calls

2. **API Connection**:
   - Open browser DevTools → Network tab
   - Look for requests to `seven-dash.fly.dev`
   - Verify requests are successful (200 status)

3. **Health Check**:
   - Open browser console
   - Run: `fetch('https://seven-dash.fly.dev/health').then(r => r.json()).then(console.log)`
   - Should return: `{success: true, message: "API is running"}`

### Test Login

Use test credentials (if you have them set up):

```javascript
// In browser console or test script
fetch('https://seven-dash.fly.dev/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password'
  })
})
.then(r => r.json())
.then(console.log)
```

## Troubleshooting

### CORS Errors

If you see CORS errors:

1. **Check backend CORS configuration**:
   ```bash
   fly secrets list --app seven-dash
   ```

2. **Set CORS_ORIGIN**:
   ```bash
   # For local development
   fly secrets set CORS_ORIGIN=http://localhost:3000 --app seven-dash
   
   # For Vercel production
   fly secrets set CORS_ORIGIN=https://your-app.vercel.app --app seven-dash
   ```

3. **Restart backend**:
   ```bash
   fly apps restart --app seven-dash
   ```

### Backend Not Responding

1. **Check backend status**:
   ```bash
   fly status --app seven-dash
   fly logs --app seven-dash
   ```

2. **Verify backend is running**:
   ```bash
   curl https://seven-dash.fly.dev/health
   ```

3. **Start backend if stopped**:
   ```bash
   fly scale count 1 --app seven-dash
   ```

### API Requests Failing

1. **Check environment variable**:
   - Verify `VITE_API_BASE_URL` is set correctly
   - For local: Should be `https://seven-dash.fly.dev`
   - No `/api` suffix needed (Fly.io serves at root)

2. **Check browser console**:
   - Look for error messages
   - Check Network tab for failed requests

3. **Verify backend logs**:
   ```bash
   fly logs --app seven-dash
   ```

## Quick Test Checklist

- [ ] Backend is running (`fly status` shows machines running)
- [ ] Health endpoint works (`curl https://seven-dash.fly.dev/health`)
- [ ] Frontend environment variable set (`VITE_API_BASE_URL=https://seven-dash.fly.dev`)
- [ ] Frontend running (locally or on Vercel)
- [ ] Can access login page
- [ ] Browser console shows API calls to `seven-dash.fly.dev`
- [ ] No CORS errors in console
- [ ] Login works (or shows proper error messages)

## Next Steps

After confirming frontend-backend connection works:

1. ✅ Test all features (dashboard, applications, etc.)
2. ✅ Verify data loading works
3. ✅ Test background jobs (daily summary)
4. ✅ Monitor Fly.io logs for any errors
5. ✅ Set up monitoring/alerts (optional)






