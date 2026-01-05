# Fly.io Deployment Guide

Complete guide for deploying Seven Fincorp backend to Fly.io.

## Prerequisites

1. **Fly.io Account**: Sign up at https://fly.io
2. **flyctl CLI**: Install the Fly.io CLI tool
3. **GitHub Repository**: Your code should be in GitHub (already done ✅)

## Step 1: Install flyctl

### macOS/Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Verify Installation:
```bash
fly version
```

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open your browser to authenticate. After login, you'll be ready to deploy.

## Step 3: Navigate to Backend Directory

```bash
cd backend
```

## Step 4: Initialize Fly.io App

```bash
fly launch
```

**During initialization, you'll be asked:**

1. **App name**: 
   - Default: `seven-fincorp-backend` (or choose your own)
   - Press Enter to accept or type a custom name

2. **Region**: 
   - Choose closest to your users (e.g., `sin` for Singapore, `iad` for US East)
   - Recommended: `sin` (Singapore) for Asia-Pacific users

3. **Postgres database**: 
   - Answer `n` (No) - we use Airtable via n8n webhooks

4. **Redis**: 
   - Answer `n` (No) - optional, can add later if needed

5. **Deploy now**: 
   - Answer `n` (No) - we'll set environment variables first

## Step 5: Set Environment Variables

Set all required environment variables:

```bash
# Required: n8n webhook base URL
fly secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud

# Required: JWT secret (generate a strong secret)
fly secrets set JWT_SECRET=$(openssl rand -hex 32)

# Required: CORS origin (your frontend URL)
fly secrets set CORS_ORIGIN=https://your-frontend.vercel.app

# Optional: Node environment
fly secrets set NODE_ENV=production

# Optional: Cron schedule for daily summary (default: daily at midnight UTC)
fly secrets set CRON_SCHEDULE="0 0 * * *"
```

**Important Notes:**
- Replace `https://your-frontend.vercel.app` with your actual frontend URL
- Generate a strong JWT secret (the command above does this automatically)
- Secrets are encrypted and only available at runtime

## Step 6: Configure App (Optional)

If you need to change the app name or region, edit `fly.toml`:

```toml
app = "your-app-name"
primary_region = "sin"  # Change to your preferred region
```

**Available Regions:**
- `sin` - Singapore (Asia-Pacific)
- `iad` - Washington, DC (US East)
- `lhr` - London (Europe)
- `sjc` - San Jose (US West)
- `gru` - São Paulo (South America)
- See all: https://fly.io/docs/reference/regions/

## Step 7: Deploy

```bash
fly deploy
```

This will:
1. Build your Docker image
2. Push to Fly.io registry
3. Deploy to your app
4. Start the server

**First deployment may take 5-10 minutes** (building Docker image).

## Step 8: Verify Deployment

### Check App Status:
```bash
fly status
```

### View Logs:
```bash
fly logs
```

### Test Health Endpoint:
```bash
fly open /health
```

Or visit: `https://your-app-name.fly.dev/health`

## Step 9: Update Frontend Configuration

Update your frontend to point to Fly.io backend:

**Option 1: Environment Variable (Recommended)**

In Vercel dashboard (or `.env` file):
```bash
VITE_API_BASE_URL=https://seven-fincorp-backend.fly.dev
```

**Option 2: Update `src/services/api.ts`**

Change the API base URL to your Fly.io app URL.

## Step 10: Monitor and Manage

### View Logs:
```bash
fly logs
```

### View Metrics:
```bash
fly dashboard
```

### Scale App (if needed):
```bash
# Scale to 1 machine (default)
fly scale count 1

# Scale to 2 machines (for redundancy)
fly scale count 2
```

### Restart App:
```bash
fly apps restart
```

### SSH into Container (for debugging):
```bash
fly ssh console
```

## Troubleshooting

### Build Fails

**Issue**: Docker build fails

**Solution**:
1. Check `Dockerfile` is in `backend/` directory
2. Verify `package.json` has build script: `"build": "tsc"`
3. Check logs: `fly logs`

### App Won't Start

**Issue**: App crashes on startup

**Solution**:
1. Check logs: `fly logs`
2. Verify environment variables: `fly secrets list`
3. Check health endpoint: `fly open /health`
4. Verify PORT is set to 3001

### Health Check Fails

**Issue**: Health endpoint returns error

**Solution**:
1. Verify `/health` route exists in your Express app
2. Check logs: `fly logs`
3. Test locally: `curl http://localhost:3001/health`

### Background Jobs Not Running

**Issue**: Daily summary job doesn't run

**Solution**:
1. Check logs: `fly logs` (look for job start messages)
2. Verify `CRON_SCHEDULE` is set correctly
3. Check server is running: `fly status`

### CORS Errors

**Issue**: Frontend can't connect to backend

**Solution**:
1. Verify `CORS_ORIGIN` is set to your frontend URL
2. Check CORS configuration in `backend/src/server.ts`
3. Update secret: `fly secrets set CORS_ORIGIN=https://your-frontend.vercel.app`

## Cost Information

### Free Trial
- **Duration**: 7 days or 2 hours of machine runtime (whichever comes first)
- **Resources**: 3 shared CPUs, 256MB RAM per VM
- **Storage**: 3GB persistent volume
- **Bandwidth**: 160GB outbound/month

### After Trial
- **Cost**: ~$1.94/month per VM (256MB RAM)
- **Scaling**: Pay for what you use
- **Billing**: Credit card required after trial

## Important Notes

1. **Trial Period**: Fly.io free trial lasts 7 days or 2 hours of runtime
2. **Payment**: Credit card required after trial (but very affordable)
3. **Always-On**: Configured in `fly.toml` (`auto_stop_machines = false`)
4. **Background Jobs**: Will run continuously (unlike Render free tier)
5. **Health Checks**: Configured to check `/health` endpoint every 10 seconds

## Quick Reference Commands

```bash
# Deploy
fly deploy

# View logs
fly logs

# Check status
fly status

# Open app in browser
fly open

# View secrets
fly secrets list

# Set secret
fly secrets set KEY=value

# Remove secret
fly secrets unset KEY

# Scale app
fly scale count 1

# Restart app
fly apps restart

# SSH into container
fly ssh console

# View dashboard
fly dashboard
```

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Verify data loading works
3. ✅ Test background jobs (daily summary)
4. ✅ Monitor logs for errors
5. ✅ Update frontend API URL
6. ✅ Test end-to-end workflows

## Support

- **Fly.io Docs**: https://fly.io/docs
- **Fly.io Community**: https://community.fly.io
- **Status Page**: https://status.fly.io

---

**Deployment Complete!** 🎉

Your backend is now running on Fly.io with:
- ✅ Always-on server (no spin-down)
- ✅ Background jobs enabled
- ✅ No execution time limits
- ✅ Production-ready infrastructure





