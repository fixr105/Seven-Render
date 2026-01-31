# Deployment and n8n Setup Guide

## ⚠️ Status: Changes NOT Yet Deployed

The code changes have been completed but **NOT yet deployed** to production. You need to:

1. **Deploy Backend Changes**
2. **Update n8n Workflows** (add test account filtering)
3. **Test the System**

---

## 1. Backend Deployment

### Prerequisites
- Backend is deployed on Fly.io (based on project structure)
- Environment variables are configured

### Steps to Deploy Backend

1. **Build the backend:**
   ```bash
   cd backend
   npm run build
   ```

2. **Deploy to Fly.io:**
   ```bash
   flyctl deploy
   ```
   
   Or if using a different deployment method:
   - Vercel: `vercel --prod`
   - Render: Push to main branch (auto-deploys)
   - Other: Follow your deployment process

3. **Verify Environment Variables:**
   Ensure these are set in your deployment platform:
   ```env
   N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=7d
   TEST_EMAIL_PATTERNS=test@,dummy@,example.com
   ALLOWED_TEST_EMAILS=realadmin@sevenfincorp.com
   TEST_NAME_PATTERNS=Test User,Dummy User
   CORS_ORIGIN=https://your-frontend-url.com
   ```

4. **Test Backend Health:**
   ```bash
   curl https://your-backend-url/api/health
   ```

---

## 2. Frontend Deployment

### Prerequisites
- Frontend is deployed on Vercel (based on project structure)
- Environment variables are configured

### Steps to Deploy Frontend

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```
   
   Or push to main branch if auto-deploy is enabled

3. **Verify Environment Variables:**
   Ensure this is set:
   ```env
   VITE_API_BASE_URL=https://your-backend-url
   ```

---

## 3. n8n Workflow Updates Required

### ⚠️ CRITICAL: Update n8n Workflows

The new login system requires **test account filtering** in n8n workflows. You need to update the following webhook:

### `/webhook/useraccount` (GET) - User Accounts Webhook

**Current Status:** ❌ Needs Update

**Required Changes:**

1. **Add Filter Node** to filter out test accounts
2. **Filter Active Accounts Only**

#### Step-by-Step n8n Workflow Update

1. **Open n8n Workflow Editor**
   - Go to: https://fixrrahul.app.n8n.cloud
   - Find workflow: `/webhook/useraccount` (GET)

2. **Current Workflow Structure:**
   ```
   Webhook (GET) → Airtable (Search Records) → Respond to Webhook
   ```

3. **Updated Workflow Structure:**
   ```
   Webhook (GET) → Airtable (Search Records) → Filter Node → Respond to Webhook
   ```

4. **Add Filter Node:**
   - **Position:** Between Airtable node and Respond to Webhook node
   - **Filter Rules:**
     ```
     Condition 1: Username does NOT contain "test@"
     Condition 2: Username does NOT contain "dummy@"
     Condition 3: Username does NOT contain "example.com"
     Condition 4: Account Status equals "Active"
     Condition 5: Username is NOT exactly "test"
     Condition 6: Username is NOT exactly "dummy"
     ```
   - **Mode:** "Keep items that match all conditions"

5. **Filter Node Configuration:**
   ```json
   {
     "conditions": {
       "options": {
         "caseSensitive": false,
         "leftValue": "",
         "typeValidation": "strict"
       },
       "conditions": [
         {
           "id": "condition1",
           "leftValue": "={{ $json['Username'] }}",
           "rightValue": "test@",
           "operator": {
             "type": "string",
             "operation": "notContains"
           }
         },
         {
           "id": "condition2",
           "leftValue": "={{ $json['Username'] }}",
           "rightValue": "dummy@",
           "operator": {
             "type": "string",
             "operation": "notContains"
           }
         },
         {
           "id": "condition3",
           "leftValue": "={{ $json['Username'] }}",
           "rightValue": "example.com",
           "operator": {
             "type": "string",
             "operation": "notContains"
           }
         },
         {
           "id": "condition4",
           "leftValue": "={{ $json['Account Status'] }}",
           "rightValue": "Active",
           "operator": {
             "type": "string",
             "operation": "equals"
           }
         },
         {
           "id": "condition5",
           "leftValue": "={{ $json['Username'] }}",
           "rightValue": "test",
           "operator": {
             "type": "string",
             "operation": "notEquals"
           }
         },
         {
           "id": "condition6",
           "leftValue": "={{ $json['Username'] }}",
           "rightValue": "dummy",
           "operator": {
             "type": "string",
             "operation": "notEquals"
           }
         }
       ],
       "combinator": "and"
     }
   }
   ```

6. **Test the Workflow:**
   - Click "Test workflow"
   - Verify that test accounts are filtered out
   - Verify that only "Active" accounts are returned

7. **Activate the Workflow:**
   - Toggle "Active" switch
   - Save the workflow

### Other Webhooks (Optional Updates)

The following webhooks are used for profile data resolution. They don't need filtering, but you can add it for consistency:

- `/webhook/kamusers` - KAM Users
- `/webhook/clients` - Clients
- `/webhook/creditteamusers` - Credit Team Users
- `/webhook/nbfcpartners` - NBFC Partners

**Note:** These are already filtered by the backend, but filtering in n8n reduces unnecessary data transfer.

---

## 4. Testing After Deployment

### Test Checklist

1. **Backend Health Check:**
   ```bash
   curl https://your-backend-url/api/health
   ```

2. **Test Login (Each Role):**
   - ✅ KAM user login
   - ✅ Client user login
   - ✅ Credit Team user login
   - ✅ NBFC user login

3. **Test Account Rejection:**
   - ❌ Try logging in with test@example.com (should fail)
   - ❌ Try logging in with dummy@test.com (should fail)
   - ❌ Try logging in with test account (should fail)

4. **Test Profile IDs:**
   - ✅ Verify `clientId` is returned for Client users
   - ✅ Verify `kamId` is returned for KAM users
   - ✅ Verify `creditTeamId` is returned for Credit Team users
   - ✅ Verify `nbfcId` is returned for NBFC users

5. **Test HTTP-Only Cookies:**
   - ✅ Verify cookie is set in browser DevTools
   - ✅ Verify cookie is `httpOnly: true`
   - ✅ Verify cookie is `secure: true` in production

6. **Test Logout:**
   - ✅ Verify logout clears cookie
   - ✅ Verify user cannot access protected routes after logout

---

## 5. Verification Commands

### Check Backend Deployment
```bash
# Health check
curl https://your-backend-url/api/health

# Test login endpoint (should return 400 without credentials)
curl -X POST https://your-backend-url/api/auth/login
```

### Check n8n Webhook
```bash
# Test useraccount webhook (should return filtered users)
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

### Check Frontend
```bash
# Open frontend in browser
# Try logging in with a real account
# Check browser DevTools → Application → Cookies
# Verify `auth_token` cookie is set
```

---

## 6. Troubleshooting

### Backend Issues

**Issue:** "Authentication service temporarily unavailable"
- **Cause:** n8n webhook not responding or timeout
- **Fix:** Check n8n workflow is active, verify webhook URL

**Issue:** "Invalid email or password" for valid accounts
- **Cause:** Test account filter too aggressive
- **Fix:** Check `ALLOWED_TEST_EMAILS` environment variable

**Issue:** Profile IDs are null
- **Cause:** Profile data fetch timeout or failed
- **Fix:** Check n8n profile webhooks are active, verify table names

### Frontend Issues

**Issue:** Login redirects but user not authenticated
- **Cause:** Cookie not being set
- **Fix:** Check CORS configuration, verify `credentials: 'include'` in fetch

**Issue:** "Not authenticated" on protected routes
- **Cause:** Cookie not being sent with requests
- **Fix:** Verify `credentials: 'include'` in API service

### n8n Issues

**Issue:** Webhook returns empty array
- **Cause:** Filter too restrictive or no matching records
- **Fix:** Check filter conditions, verify Airtable has active users

**Issue:** Webhook timeout
- **Cause:** Airtable query too slow
- **Fix:** Add pagination, optimize Airtable query

---

## 7. Deployment Checklist

- [ ] Backend code built successfully
- [ ] Backend deployed to production
- [ ] Backend environment variables configured
- [ ] Backend health check passes
- [ ] Frontend code built successfully
- [ ] Frontend deployed to production
- [ ] Frontend environment variables configured
- [ ] n8n `/webhook/useraccount` workflow updated with filter
- [ ] n8n workflow activated
- [ ] n8n webhook tested and working
- [ ] Test login with each role (KAM, Client, Credit Team, NBFC)
- [ ] Test account rejection verified
- [ ] Profile IDs verified for all roles
- [ ] HTTP-only cookies verified
- [ ] Logout verified

---

## 8. Post-Deployment Monitoring

Monitor these metrics after deployment:

1. **Login Success Rate:** Should be > 95%
2. **Login Response Time:** Should be < 3 seconds
3. **Test Account Rejection Rate:** Should be 100%
4. **Profile ID Resolution Rate:** Should be > 90%
5. **Cookie Setting Success Rate:** Should be 100%

---

## Summary

**Current Status:**
- ✅ Code changes complete
- ❌ Backend NOT deployed
- ❌ Frontend NOT deployed
- ❌ n8n workflows NOT updated

**Next Steps:**
1. Deploy backend
2. Deploy frontend
3. Update n8n `/webhook/useraccount` workflow
4. Test all user roles
5. Monitor for issues

---

## Quick Reference

**Backend URL:** `https://your-backend-url`
**Frontend URL:** `https://your-frontend-url`
**n8n URL:** `https://fixrrahul.app.n8n.cloud`
**Webhook to Update:** `/webhook/useraccount` (GET)
