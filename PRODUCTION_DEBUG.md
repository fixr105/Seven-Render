# Production vs Localhost Debug Guide

## Why it works on localhost but not on production

### Root Cause
The code uses `process.env.N8N_BASE_URL` to construct webhook URLs. On **localhost**, this is loaded from `.env` file. On **Vercel**, it must be set as an **Environment Variable**.

### Quick Check

1. **Visit the diagnostic endpoint:**
   ```
   https://lms.sevenfincorp.com/api/debug/webhook-config
   ```
   
   This will show:
   - Current `N8N_BASE_URL` value
   - Constructed webhook URLs
   - Environment info

2. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Deployments → Latest → Functions
   - Look for logs containing:
     - `🌐 [WEBHOOK CALL]` - Should show webhook URLs being called
     - `N8N_BASE_URL: NOT SET` - Means environment variable is missing
     - `N8N_BASE_URL: https://fixrrahul.app.n8n.cloud` - Means it's set correctly

### Fix: Set Environment Variable in Vercel

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project
   - Go to **Settings** → **Environment Variables**

2. **Add this variable:**
   - **Key**: `N8N_BASE_URL`
   - **Value**: `https://fixrrahul.app.n8n.cloud`
   - **Environment**: Select **all** (Production, Preview, Development)
   - Click **Save**

3. **Redeploy:**
   - After adding the variable, you **MUST redeploy**
   - Go to **Deployments** → Click **⋯** on latest deployment → **Redeploy**
   - Or push a new commit to trigger redeploy

### Verify It's Working

After redeploy, check:

1. **Diagnostic endpoint:**
   ```bash
   curl https://lms.sevenfincorp.com/api/debug/webhook-config
   ```
   Should show `N8N_BASE_URL: https://fixrrahul.app.n8n.cloud`

2. **Check logs for webhook calls:**
   - Should see `🌐 [WEBHOOK CALL] Fetching Loan Products from webhook: https://fixrrahul.app.n8n.cloud/webhook/loanproducts`
   - Should see `✅ [WEBHOOK SUCCESS]` messages

3. **Test the actual endpoint:**
   ```bash
   curl https://lms.sevenfincorp.com/api/loan-products?activeOnly=true
   ```
   Should return JSON data, not timeout

### Common Issues

#### Issue 1: Variable Not Applied
**Symptom**: Still seeing timeouts after adding variable
**Solution**: 
- Make sure you selected **all environments** (Production, Preview, Development)
- **Redeploy** after adding variables (they don't apply to existing deployments)

#### Issue 2: Wrong URL Format
**Symptom**: Webhook calls failing with 404
**Solution**: 
- `N8N_BASE_URL` should be: `https://fixrrahul.app.n8n.cloud`
- **No trailing slash**
- **No `/webhook` suffix** (that's added automatically)

#### Issue 3: Network/Firewall
**Symptom**: Webhooks timing out even with correct URL
**Solution**:
- Check if Vercel can reach n8n (check n8n dashboard for incoming requests)
- Verify n8n workflows are **active** (not paused)
- Check n8n execution history for failed requests

### Localhost vs Production Differences

| Aspect | Localhost | Production (Vercel) |
|--------|-----------|---------------------|
| Environment Variables | Loaded from `.env` file | Must be set in Vercel Dashboard |
| Base URL | `process.env.N8N_BASE_URL` from `.env` | `process.env.N8N_BASE_URL` from Vercel env vars |
| Default Fallback | `'https://fixrrahul.app.n8n.cloud'` | `'https://fixrrahul.app.n8n.cloud'` |
| Cache | Disabled (we just changed this) | Disabled (same) |
| Timeout | 55 seconds | 60 seconds (Vercel limit) |

### Testing Checklist

- [ ] Visit `https://lms.sevenfincorp.com/api/debug/webhook-config`
- [ ] Verify `N8N_BASE_URL` is set correctly
- [ ] Check Vercel logs for `🌐 [WEBHOOK CALL]` messages
- [ ] Verify webhook URLs are correct (should include `https://fixrrahul.app.n8n.cloud/webhook/...`)
- [ ] Test `/api/loan-products` endpoint
- [ ] Test `/api/loan-applications` endpoint
- [ ] Check n8n dashboard for webhook executions

### If Still Not Working

1. **Check Vercel Function Logs:**
   - Look for error messages
   - Check if webhooks are being called
   - Verify response times

2. **Check n8n Dashboard:**
   - Go to n8n execution history
   - See if webhooks are receiving requests
   - Check for any errors in n8n workflows

3. **Test Direct Webhook:**
   ```bash
   curl https://fixrrahul.app.n8n.cloud/webhook/loanproducts
   ```
   Should return data from Airtable

4. **Compare Logs:**
   - Localhost logs vs Production logs
   - Look for differences in webhook URLs
   - Check for different error messages

