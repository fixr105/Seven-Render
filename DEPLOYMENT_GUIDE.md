# Deployment Guide - Critical Fixes Release

## Build Commands

### Frontend Build

```bash
# Navigate to project root
cd /path/to/Seven-Dashboard

# Install dependencies (if not already installed)
npm install

# Build for production
npm run build

# The build output will be in the `dist/` directory
```

**Build Output**: `dist/` directory contains optimized production build

---

### Backend Build

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
npm install

# TypeScript compilation (if needed)
npm run build

# Or run directly (TypeScript is compiled on-the-fly in Vercel)
# No separate build step required for Vercel serverless functions
```

**Note**: Vercel automatically builds TypeScript serverless functions. No manual compilation needed.

---

## Environment Variables

### Required Environment Variables

#### Backend (Vercel)

```bash
# n8n Configuration
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud

# Optional: Override specific webhook URLs (if different from defaults)
# N8N_GET_USER_ACCOUNTS_URL=https://fixrrahul.app.n8n.cloud/webhook/useraccount
# N8N_POST_ADD_USER_URL=https://fixrrahul.app.n8n.cloud/webhook/adduser
# ... (see backend/src/services/airtable/n8nEndpoints.ts for all options)

# Logging (optional)
LOG_WEBHOOK_CALLS=false  # Set to 'true' for debugging

# Node Environment
NODE_ENV=production
```

#### Frontend (Vercel)

```bash
# API Base URL (for production)
VITE_API_BASE_URL=https://your-backend-domain.vercel.app/api

# Or use relative URLs (default)
# VITE_API_BASE_URL=/api
```

---

### Environment Variable Setup in Vercel

1. **Go to Vercel Dashboard**
   - Select your project
   - Go to Settings → Environment Variables

2. **Add Variables for Backend**:
   ```
   N8N_BASE_URL = https://fixrrahul.app.n8n.cloud
   NODE_ENV = production
   ```

3. **Add Variables for Frontend** (if using absolute URLs):
   ```
   VITE_API_BASE_URL = https://your-backend-domain.vercel.app/api
   ```

4. **Redeploy** after adding variables

---

## Configuration Flags

### Feature Flags

No feature flags required. All fixes are enabled by default.

### Timeout Configuration

Timeouts are hardcoded in the application:
- **Save Draft**: 55 seconds (`backend/src/services/airtable/n8nClient.ts:503`)
- **Report Generation**: 60 seconds (`backend/src/controllers/reports.controller.ts`)
- **Loan Products**: 20 seconds (`backend/src/controllers/products.controller.ts`)
- **Frontend API**: 60 seconds for application creation (`src/services/api.ts:279`)

**No configuration needed** - these are set automatically.

---

## Vercel Configuration

### Backend Configuration (`vercel.json` or `vercel-backend.json`)

Ensure `maxDuration` is set to 60 seconds (Pro plan):

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Frontend Configuration (`vercel.json`)

Standard Vercel configuration for React app:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

---

## Pre-Deployment Checklist

### Backend
- [ ] All environment variables set in Vercel
- [ ] `maxDuration: 60` configured in `vercel.json`
- [ ] n8n webhooks are accessible and active
- [ ] Test users exist (run `node backend/scripts/ensure-test-users.js`)

### Frontend
- [ ] `VITE_API_BASE_URL` set correctly (or using relative URLs)
- [ ] Build completes without errors
- [ ] No console errors in production build

### Testing
- [ ] All regression tests pass locally
- [ ] Manual smoke tests completed
- [ ] Error scenarios tested

---

## Deployment Steps

### 1. Deploy Backend

```bash
# If using Vercel CLI
cd backend
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git push origin main
```

**Verify Backend Deployment**:
```bash
# Check health endpoint
curl https://your-backend-domain.vercel.app/api/health

# Should return: {"status":"ok"}
```

### 2. Deploy Frontend

```bash
# If using Vercel CLI
vercel --prod

# Or push to main branch (if auto-deploy is enabled)
git push origin main
```

**Verify Frontend Deployment**:
- Visit your frontend URL
- Check browser console for errors
- Verify API calls are working

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://your-backend-domain.vercel.app/api/health

# Should return: {"status":"ok"}
```

### 2. Critical Workflow Tests

Run these tests in production:

#### Test 1: Loan Products
1. Login as `client@test.com`
2. Go to "New Application"
3. Verify products load within 20 seconds

#### Test 2: Save Draft
1. Login as `client@test.com`
2. Create new application
3. Fill required fields
4. Click "Save Draft"
5. Verify no timeout error

#### Test 3: KAM Onboarding
1. Login as `kam@test.com`
2. Onboard a new client
3. Verify client appears in list

#### Test 4: Report Generation
1. Login as `credit@test.com`
2. Generate daily report
3. Verify report completes within 60 seconds

#### Test 5: Phone Validation
1. Login as any user
2. Go to Profile
3. Try typing letters in phone field
4. Verify letters are rejected

#### Test 6: Footer Links
1. Login as any user
2. Click footer links
3. Verify "Coming soon!" alerts appear

---

## Rollback Procedure

If issues are discovered:

### Vercel Rollback

1. **Go to Vercel Dashboard**
   - Select your project
   - Go to "Deployments" tab
   - Find the previous working deployment
   - Click "..." → "Promote to Production"

2. **Or via CLI**:
   ```bash
   vercel rollback [deployment-url]
   ```

### No Database Rollback Needed

All changes are code-only. No database migrations or schema changes.

---

## Monitoring

### Key Metrics to Monitor

1. **Error Rates**:
   - Timeout errors (should be < 1%)
   - Webhook failures (should be < 5%)

2. **Performance**:
   - Average response time for save draft (< 10s)
   - Average response time for report generation (< 30s)
   - Loan products load time (< 15s)

3. **User Feedback**:
   - Support tickets related to timeouts
   - User complaints about functionality

### Logging

Check Vercel logs for:
- Webhook timeout errors
- Failed webhook calls
- Application errors

**Access Logs**:
- Vercel Dashboard → Project → Deployments → [Deployment] → Functions → Logs

---

## Troubleshooting

### Issue: Timeouts Still Occurring

**Check**:
1. Vercel `maxDuration` is set to 60
2. n8n webhooks are responding quickly
3. Network connectivity to n8n

**Solution**:
- Increase timeout in code (if needed)
- Check n8n workflow performance
- Verify webhook URLs are correct

### Issue: Loan Products Not Loading

**Check**:
1. Webhook URL: `https://fixrrahul.app.n8n.cloud/webhook/loanproducts`
2. n8n workflow is active
3. Airtable has active loan products

**Solution**:
- Run verification script: `node backend/scripts/verify-webhooks-and-users.js`
- Check n8n logs
- Verify Airtable data

### Issue: Test Users Not Working

**Check**:
1. Test users exist in Airtable
2. Profile records exist for each role

**Solution**:
- Run: `node backend/scripts/ensure-test-users.js`
- Verify in Airtable directly

---

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Review `REGRESSION_TEST_PLAN.md` for test procedures
3. Check `WEBHOOK_VERIFICATION.md` for webhook configuration
4. Contact development team with specific error messages

---

## Additional Resources

- **Test Plan**: `REGRESSION_TEST_PLAN.md`
- **Release Notes**: `RELEASE_NOTES.md`
- **Webhook Verification**: `backend/WEBHOOK_VERIFICATION.md`
- **API Documentation**: `API_DOCUMENTATION.md`



