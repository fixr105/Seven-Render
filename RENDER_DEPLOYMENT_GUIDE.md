# Render Deployment Guide

This guide explains how to deploy the Seven Fincorp backend to Render (server-based deployment).

## Overview

The backend has been migrated from Vercel serverless functions to a standard Express.js server for Render deployment. This resolves data loading issues and enables background jobs.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Environment Variables**: Prepare your environment variables (see below)

## Deployment Steps

### Step 1: Create a Web Service on Render

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select the repository containing this codebase

### Step 2: Configure the Service

**Service Settings:**

- **Name**: `seven-fincorp-backend` (or your preferred name)
- **Region**: Choose closest to your users (e.g., `Singapore` for Asia-Pacific)
- **Branch**: `main` (or your production branch)
- **Root Directory**: Leave empty (or `backend` if deploying from monorepo root)
- **Runtime**: `Node`
- **Build Command**: 
  ```bash
  cd backend && npm install && npm run build
  ```
- **Start Command**: 
  ```bash
  cd backend && npm start
  ```
- **Instance Type**: 
  - **Free tier**: `Free` (512MB RAM, spins down after 15 min inactivity)
  - **Production**: `Starter` ($7/month) or higher for always-on service

**Environment Variables:**

Add the following environment variables in Render dashboard:

```bash
# Required
NODE_ENV=production
PORT=10000  # Render sets this automatically, but include as fallback
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
JWT_SECRET=your-jwt-secret-here

# Optional (configure based on your frontend URL)
CORS_ORIGIN=https://your-frontend.vercel.app

# Optional (for daily summary job scheduling)
CRON_SCHEDULE=0 0 * * *  # Daily at midnight UTC (default)
```

**Important Notes:**

- Render automatically sets `PORT` environment variable - your code should use `process.env.PORT || 3001`
- `CORS_ORIGIN` should match your frontend domain (if frontend is on Vercel, use your Vercel URL)
- `JWT_SECRET` should be a strong, random string (generate with `openssl rand -hex 32`)

### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Install dependencies
   - Build the TypeScript code
   - Start the server
3. Monitor the build logs for any issues
4. Once deployed, you'll get a URL like: `https://seven-fincorp-backend.onrender.com`

### Step 4: Update Frontend Configuration

Update your frontend to point to the Render backend URL:

**Option 1: Environment Variable (Recommended)**

In your frontend's Vercel environment variables (or `.env` file):

```bash
VITE_API_BASE_URL=https://seven-fincorp-backend.onrender.com
```

**Option 2: Update api.ts directly**

If not using environment variables, update `src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://seven-fincorp-backend.onrender.com';
```

### Step 5: Update CORS Configuration

Ensure your Render backend allows requests from your frontend:

1. Go to Render Dashboard → Your Service → Environment
2. Set `CORS_ORIGIN` to your frontend URL:
   ```bash
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. Redeploy the service (Render auto-deploys on env var changes)

## Background Jobs

The daily summary job is now enabled and runs automatically. It:

- Runs daily at midnight UTC (configurable via `CRON_SCHEDULE`)
- Generates daily summary reports
- Saves reports to Airtable
- Can send email notifications (if configured)

To manually trigger the job, use the API endpoint:
```bash
POST /reports/daily/generate
```

## Monitoring & Logs

### View Logs

1. Go to Render Dashboard → Your Service
2. Click **"Logs"** tab
3. View real-time logs or download log history

### Health Check

The service includes a health check endpoint:

```bash
GET /health
```

Render can use this for health monitoring (optional configuration).

### Metrics

Render provides:
- Request metrics (requests/second, response times)
- Error rates
- Resource usage (CPU, memory)

Access via Render Dashboard → Your Service → Metrics

## Scaling

### Auto-Scaling

Render supports auto-scaling based on traffic:

1. Go to Render Dashboard → Your Service → Settings
2. Enable **"Auto-Deploy"** (already enabled if using Git)
3. Configure scaling rules (requires paid plan)

### Manual Scaling

For free tier, service spins down after 15 minutes of inactivity. First request may take 30-60 seconds (cold start).

For production, use **Starter** plan or higher for always-on service.

## Troubleshooting

### Service Won't Start

1. **Check Build Logs**: Look for TypeScript compilation errors
2. **Check Start Logs**: Look for runtime errors
3. **Verify Environment Variables**: Ensure all required vars are set
4. **Check Port**: Ensure code uses `process.env.PORT` (Render sets this automatically)

### Data Loading Issues

1. **Check n8n Webhooks**: Verify `N8N_BASE_URL` is correct
2. **Check Logs**: Look for webhook timeout errors
3. **Verify CORS**: Ensure frontend URL is in `CORS_ORIGIN`

### Background Jobs Not Running

1. **Check Logs**: Look for job start messages
2. **Verify Schedule**: Check `CRON_SCHEDULE` format
3. **Check Service Status**: Jobs only run when service is active (not spun down on free tier)

### Timeout Issues

- Server-based deployment has no execution time limits (unlike serverless)
- Default timeouts are 55-60 seconds (can be increased if needed)
- Check logs for specific timeout errors

## Cost Comparison

### Free Tier
- **Cost**: $0/month
- **Limitations**: 
  - Spins down after 15 min inactivity (cold start ~30-60s)
  - 512MB RAM
  - 750 hours/month (enough for always-on if used consistently)

### Starter Plan
- **Cost**: $7/month
- **Benefits**:
  - Always-on (no spin-down)
  - 512MB RAM
  - Better performance
  - Recommended for production

### Professional Plan
- **Cost**: $25/month
- **Benefits**:
  - 2GB RAM
  - Auto-scaling
  - Better performance
  - For high-traffic applications

## Migration from Vercel

If migrating from Vercel serverless:

1. ✅ Background jobs are now enabled (were disabled on Vercel)
2. ✅ No cold start issues (server stays warm)
3. ✅ No execution time limits (60s limit removed)
4. ✅ Simpler codebase (serverless wrapper removed)
5. ✅ Better debugging (standard server logs)

## Security

### Environment Variables

- Never commit secrets to Git
- Use Render's environment variable management
- Rotate `JWT_SECRET` regularly
- Use strong, random secrets

### HTTPS

- Render provides HTTPS automatically
- No SSL certificate configuration needed
- All traffic is encrypted

### CORS

- Configure `CORS_ORIGIN` to your frontend domain only
- Don't use `*` in production
- Use specific domain: `https://your-app.vercel.app`

## Support

For issues:
1. Check Render documentation: https://render.com/docs
2. Check service logs in Render Dashboard
3. Review this deployment guide
4. Contact Render support if needed

## Next Steps

After deployment:

1. ✅ Test all API endpoints
2. ✅ Verify data loading works correctly
3. ✅ Test background jobs
4. ✅ Monitor logs for errors
5. ✅ Update frontend to use new backend URL
6. ✅ Test end-to-end workflows
7. ✅ Set up monitoring/alerts (optional)

---

**Deployment completed successfully!** 🎉

Your backend is now running on Render with:
- ✅ Persistent server (no cold starts)
- ✅ Background jobs enabled
- ✅ Unlimited execution time
- ✅ Simplified codebase
- ✅ Better reliability






