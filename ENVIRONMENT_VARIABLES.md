# Environment Variables for Seven-Render Deployment

Complete list of environment variables needed for deployment.

## Frontend (Vercel) - Environment Variables

### Required for Production

```bash
# Backend API URL (point to Fly.io backend)
VITE_API_BASE_URL=https://seven-dash.fly.dev
```

**Important Notes:**
- No `/api` suffix needed (Fly.io serves at root)
- Set in Vercel Dashboard → Settings → Environment Variables
- Apply to: Production, Preview, Development

### Optional Frontend Variables

```bash
# If you want to override default API URL
# VITE_API_BASE_URL=https://seven-dash.fly.dev

# If using different backend URL
# VITE_API_BASE_URL=https://your-backend-url.com
```

---

## Backend (Fly.io) - Environment Variables (Secrets)

### Required Secrets

```bash
# n8n Webhook Base URL
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud

# JWT Secret (generate a strong random string)
JWT_SECRET=your-strong-random-secret-here

# CORS Origin (your frontend domain)
CORS_ORIGIN=https://lms.sevenfincorp.com

# Node Environment
NODE_ENV=production
```

### Optional Backend Variables

```bash
# Cron Schedule for Daily Summary Job (default: daily at midnight UTC)
CRON_SCHEDULE=0 0 * * *

# Port (Fly.io sets this automatically, but can override)
PORT=3001
```

### How to Set Fly.io Secrets

```bash
cd backend

# Set all required secrets
fly secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud --app seven-dash
fly secrets set JWT_SECRET=$(openssl rand -hex 32) --app seven-dash
fly secrets set CORS_ORIGIN=https://lms.sevenfincorp.com --app seven-dash
fly secrets set NODE_ENV=production --app seven-dash

# Optional: Set cron schedule
fly secrets set CRON_SCHEDULE="0 0 * * *" --app seven-dash
```

---

## GitHub Actions / CI/CD (If Using)

If you set up GitHub Actions for automated deployment:

### Repository Secrets (GitHub → Settings → Secrets and variables → Actions)

```bash
# Fly.io API Token (for deploying backend)
FLY_API_TOKEN=your-fly-api-token

# Vercel (if using Vercel CLI in GitHub Actions)
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id
```

### Fly.io API Token

Get your Fly.io API token:
1. Go to https://fly.io/dashboard
2. Click on your profile → Access Tokens
3. Create a new token
4. Copy and add to GitHub Secrets

---

## Local Development (.env file)

Create `.env` file in project root for local development:

```bash
# .env (in project root)

# Frontend Development
VITE_API_BASE_URL=http://localhost:3001

# Backend Development (backend/.env)
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
JWT_SECRET=dev-secret-key-change-in-production
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## Quick Setup Commands

### Fly.io Backend Setup

```bash
cd backend

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET: $JWT_SECRET"

# Set all secrets at once
fly secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud --app seven-dash
fly secrets set JWT_SECRET=$JWT_SECRET --app seven-dash
fly secrets set CORS_ORIGIN=https://lms.sevenfincorp.com --app seven-dash
fly secrets set NODE_ENV=production --app seven-dash

# Verify secrets
fly secrets list --app seven-dash
```

### Vercel Frontend Setup

1. Go to https://vercel.com/dashboard
2. Select your project (`seven-dashboard`)
3. Settings → Environment Variables
4. Add:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://seven-dash.fly.dev`
   - Environment: Production, Preview, Development
5. Save and Redeploy

---

## Environment Variable Reference Table

| Variable | Frontend | Backend | Required | Default | Example |
|----------|----------|---------|----------|---------|---------|
| `VITE_API_BASE_URL` | ✅ Vercel | ❌ | ✅ | `/api` | `https://seven-dash.fly.dev` |
| `N8N_BASE_URL` | ❌ | ✅ Fly.io | ✅ | - | `https://fixrrahul.app.n8n.cloud` |
| `JWT_SECRET` | ❌ | ✅ Fly.io | ✅ | - | `abc123...` (random) |
| `CORS_ORIGIN` | ❌ | ✅ Fly.io | ✅ | - | `https://lms.sevenfincorp.com` |
| `NODE_ENV` | ❌ | ✅ Fly.io | ✅ | `development` | `production` |
| `PORT` | ❌ | ✅ Fly.io | ❌ | `3001` | `3001` |
| `CRON_SCHEDULE` | ❌ | ✅ Fly.io | ❌ | `0 0 * * *` | `0 0 * * *` |

---

## Security Notes

1. **Never commit secrets to Git**
   - Use `.env` files locally (add to `.gitignore`)
   - Use platform secrets management (Vercel/Fly.io)

2. **Generate Strong JWT Secrets**
   ```bash
   # Generate secure random secret
   openssl rand -hex 32
   ```

3. **Rotate Secrets Regularly**
   - Change `JWT_SECRET` periodically
   - Update all services when rotating

4. **Use Different Secrets for Production/Development**
   - Production: Strong, random secrets
   - Development: Simple secrets (but still secure)

---

## Verification

### Verify Fly.io Secrets

```bash
fly secrets list --app seven-dash
```

### Verify Vercel Environment Variables

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Check all variables are set correctly

### Test Configuration

```bash
# Test backend
curl https://seven-dash.fly.dev/health

# Test from browser console (on frontend)
fetch('https://seven-dash.fly.dev/health')
  .then(r => r.json())
  .then(console.log)
```

---

## Troubleshooting

### Frontend Can't Connect to Backend

1. ✅ Check `VITE_API_BASE_URL` is set to `https://seven-dash.fly.dev`
2. ✅ Check backend is running: `fly status --app seven-dash`
3. ✅ Check CORS_ORIGIN matches frontend domain
4. ✅ Redeploy frontend after changing environment variables

### Backend Errors

1. ✅ Check all Fly.io secrets are set: `fly secrets list --app seven-dash`
2. ✅ Verify `N8N_BASE_URL` is correct
3. ✅ Check backend logs: `fly logs --app seven-dash`





