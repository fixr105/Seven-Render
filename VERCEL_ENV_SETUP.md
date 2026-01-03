# Vercel Environment Variables Setup Guide

## Problem
Webhooks work on localhost but timeout on Vercel production. This is usually due to missing environment variables.

## Required Environment Variables

You need to set these in your Vercel project settings:

### 1. n8n Base URL (Required)
```
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

### 2. Optional: Individual Webhook URLs (if different from defaults)
If you have custom webhook URLs, you can override them:

**GET Webhooks:**
```
N8N_GET_CLIENT_FORM_MAPPING_URL=https://fixrrahul.app.n8n.cloud/webhook/clientformmapping
N8N_GET_LOAN_PRODUCTS_URL=https://fixrrahul.app.n8n.cloud/webhook/loanproducts
N8N_GET_LOAN_APPLICATION_URL=https://fixrrahul.app.n8n.cloud/webhook/loanapplication
N8N_GET_CLIENT_URL=https://fixrrahul.app.n8n.cloud/webhook/client
N8N_GET_COMMISSION_LEDGER_URL=https://fixrrahul.app.n8n.cloud/webhook/commisionledger
N8N_GET_NOTIFICATIONS_URL=https://fixrrahul.app.n8n.cloud/webhook/notifications
N8N_GET_USER_ACCOUNTS_URL=https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**POST Webhooks:**
```
N8N_POST_APPLICATIONS_URL=https://fixrrahul.app.n8n.cloud/webhook/loanapplications
N8N_POST_CLIENT_FORM_MAPPING_URL=https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENTFORMMAPPING
N8N_POST_CLIENT_URL=https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENT
```

### 3. Other Environment Variables (if used)
```
ASANA_PAT=your_asana_personal_access_token
ASANA_CLIENT_ID=your_asana_client_id
ASANA_CLIENT_SECRET=your_asana_client_secret
```

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: `seven-dashboard` or similar
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: `N8N_BASE_URL`
   - **Value**: `https://fixrrahul.app.n8n.cloud`
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**
6. **Redeploy** your project after adding variables

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variable
vercel env add N8N_BASE_URL production
# When prompted, enter: https://fixrrahul.app.n8n.cloud

# Redeploy
vercel --prod
```

## Verify Environment Variables

After setting variables, check Vercel function logs:

1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab
4. Click on any function (e.g., `api/loan-applications`)
5. Check logs for:
   - `[WEBHOOK CALL]` messages (should show correct URLs)
   - `N8N_BASE_URL` should be logged correctly

## Common Issues

### Issue 1: Variables Not Applied
**Symptom**: Still seeing timeouts after adding variables
**Solution**: 
- Make sure you selected all environments (Production, Preview, Development)
- **Redeploy** after adding variables (variables don't apply to existing deployments)

### Issue 2: Wrong Base URL
**Symptom**: Webhook calls failing with 404 or connection errors
**Solution**: 
- Verify `N8N_BASE_URL` is exactly: `https://fixrrahul.app.n8n.cloud`
- No trailing slash
- Check n8n dashboard to confirm the base URL

### Issue 3: Vercel Function Timeout
**Symptom**: Functions timing out at 10 seconds (Hobby plan) or 60 seconds (Pro plan)
**Solution**:
- Check `vercel.json` has `maxDuration: 60` (requires Pro plan)
- Or ensure all operations complete within 10 seconds

## Testing After Setup

1. **Check Vercel Logs**:
   - Look for `[WEBHOOK CALL]` messages
   - Should see webhook URLs being called
   - Should see `[WEBHOOK SUCCESS]` or `[CACHE HIT]` messages

2. **Test Directly**:
   ```bash
   curl https://lms.sevenfincorp.com/api/loan-products?activeOnly=true
   ```
   Should return JSON data, not timeout

3. **Check n8n Dashboard**:
   - Go to n8n execution history
   - Should see webhook executions from Vercel IPs
   - Should see successful executions

## Quick Fix Checklist

- [ ] Set `N8N_BASE_URL` in Vercel environment variables
- [ ] Select all environments (Production, Preview, Development)
- [ ] Redeploy the project after adding variables
- [ ] Check Vercel function logs for webhook calls
- [ ] Verify n8n workflows are activated in production mode
- [ ] Test a simple endpoint like `/api/loan-products`

## Minimum Required Variable

**At minimum, you MUST set:**
```
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

Without this, the backend will try to use the default URL, but if there's any issue with environment loading, it might fail.

