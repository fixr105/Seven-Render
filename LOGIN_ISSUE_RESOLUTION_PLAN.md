# Comprehensive Login Issue Resolution Plan

## Problem Statement

**Error**: "Authentication service temporarily unavailable. Please try again later."

**Current Status**:
- ✅ Webhook works when tested with curl (returns valid JSON with 11 user records)
- ❌ Backend login fails with the above error
- ✅ Backend code has been updated with better error handling and logging
- ✅ Profile data fetching is now blocking (ensures profile IDs are available)

## Root Cause Analysis

The error occurs in `backend/src/services/auth/auth.service.ts` during the User Accounts webhook fetch. Based on investigation, the most likely causes are:

### Primary Suspects (In Order of Likelihood)

1. **Environment Variable Missing/Incorrect** (90% likely)
   - `N8N_BASE_URL` not set in backend environment
   - `N8N_BASE_URL` set to wrong value
   - Environment variable not loaded after deployment

2. **Network Connectivity Issues** (5% likely)
   - Backend cannot reach n8n instance
   - Firewall blocking outbound HTTPS requests
   - DNS resolution issues

3. **Response Format Mismatch** (3% likely)
   - Backend receives different response than curl
   - Load balancer routing differently
   - n8n returning different format for backend requests

4. **Timeout Issues** (2% likely)
   - Request times out before response received
   - n8n instance is slow/overloaded

## Diagnostic Phase - Step by Step

### Step 1: Verify Environment Variables ⚠️ CRITICAL

**Location**: Backend hosting platform (Render/Fly.io/Vercel/etc.)

**Action Items**:
1. Log into your backend hosting platform dashboard
2. Navigate to Environment Variables / Secrets section
3. Verify `N8N_BASE_URL` exists
4. Verify value is exactly: `https://fixrrahul.app.n8n.cloud`
5. If missing or incorrect:
   - Add/Update the variable
   - **Redeploy the backend** (required for env vars to take effect)

**How to Check**:
- **Render**: Dashboard → Your Service → Environment → Check `N8N_BASE_URL`
- **Fly.io**: `fly secrets list` or Dashboard → Secrets
- **Vercel**: Project Settings → Environment Variables
- **Local**: Check `.env` file in backend directory

**Expected Value**:
```
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

**⚠️ IMPORTANT**: Environment variables require a redeploy to take effect!

### Step 2: Check Backend Logs After Latest Deployment

**Location**: Backend hosting platform logs

**What to Look For**:

**✅ Success Indicators**:
```
[AuthService] Fetching from: https://fixrrahul.app.n8n.cloud/webhook/useraccount
[AuthService] Response received - Status: 200, Content-Type: application/json
[AuthService] ✅ JSON parsed successfully. Response type: array, Length: 11
```

**❌ Error Indicators**:

1. **Missing Environment Variable**:
```
Error: N8N_BASE_URL environment variable is required
```
**Solution**: Set `N8N_BASE_URL` and redeploy

2. **HTML Error Page**:
```
[AuthService] ❌ Response looks like HTML (error page)
[AuthService] ❌ Body preview: <!DOCTYPE html>...
```
**Solution**: Check n8n workflow is active

3. **Invalid JSON**:
```
[AuthService] ❌ Webhook response is not valid JSON
[AuthService] ❌ Body preview: ...
```
**Solution**: Check n8n workflow response format

4. **Empty Response**:
```
[AuthService] ❌ Webhook returned empty body
```
**Solution**: Check n8n workflow configuration

5. **Timeout**:
```
[AuthService] ⚠️ Request timed out, will retry...
```
**Solution**: Check network connectivity or increase timeout

6. **Network Error**:
```
[AuthService] ❌ Webhook fetch error: ECONNREFUSED
```
**Solution**: Check network connectivity from backend to n8n

### Step 3: Test Webhook from Backend Server (If Possible)

**Script**: `backend/scripts/test-useraccount-webhook.js`

**If you have SSH access to backend server**:
```bash
cd backend
node scripts/test-useraccount-webhook.js
```

**Expected Output**:
```
✅ N8N_BASE_URL: https://fixrrahul.app.n8n.cloud
📡 Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount
✅ Response is valid JSON array with 11 records
✅ Webhook test PASSED!
```

**If it fails**, the error message will indicate the specific issue.

### Step 4: Verify n8n Workflow Configuration

**Action Items**:
1. Open n8n dashboard: https://fixrrahul.app.n8n.cloud
2. Find workflow with webhook path: `/webhook/useraccount`
3. Verify:
   - ✅ Workflow is **Active** (green toggle in top right)
   - ✅ Webhook node path is exactly `/webhook/useraccount` (case-sensitive, no trailing slash)
   - ✅ "Respond to Webhook" node:
     - Response Mode: `responseNode`
     - Response Body: Returns Airtable data directly (array format)
   - ✅ Airtable node is connected and configured:
     - Base: "Seven Dashboard"
     - Table: "User Accounts"
     - Operation: "search"
4. Check recent executions:
   - Click on workflow
   - View "Executions" tab
   - Check for failed executions
   - Review execution logs for errors

### Step 5: Compare Response Formats

**Test 1: curl (Already Works)**:
```bash
curl -v https://fixrrahul.app.n8n.cloud/webhook/useraccount
```
**Result**: Returns valid JSON array ✅

**Test 2: Check Backend Logs**:
- Look for the actual response received by backend
- Compare headers, content-type, body format
- Check if response is different from curl

## Solution Phase - By Issue Type

### Solution 1: Fix Missing/Incorrect N8N_BASE_URL (Most Likely Fix)

**For Render**:
1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add/Update: `N8N_BASE_URL` = `https://fixrrahul.app.n8n.cloud`
5. Click **Save Changes**
6. **Redeploy** the service (required!)

**For Fly.io**:
```bash
fly secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
fly deploy
```

**For Vercel**:
1. Go to Project Settings → Environment Variables
2. Add: `N8N_BASE_URL` = `https://fixrrahul.app.n8n.cloud`
3. Select all environments (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** the project

**For Local Development**:
1. Create/Edit `.env` file in `backend/` directory:
   ```
   N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
   ```
2. Restart backend server

**Verification**:
- After redeploy, check backend logs
- Should see: `[AuthService] Fetching from: https://fixrrahul.app.n8n.cloud/webhook/useraccount`
- Login should work

### Solution 2: Fix Network Connectivity

**If backend cannot reach n8n**:

1. **Check Firewall Rules**:
   - Ensure backend can make outbound HTTPS requests
   - Port 443 should be open
   - No firewall blocking `fixrrahul.app.n8n.cloud`

2. **Test Connectivity** (if SSH access):
   ```bash
   # From backend server
   curl -v https://fixrrahul.app.n8n.cloud/webhook/useraccount
   ```

3. **Check DNS Resolution**:
   ```bash
   # From backend server
   nslookup fixrrahul.app.n8n.cloud
   # Should resolve to Cloudflare IPs
   ```

4. **Check Proxy/VPN**:
   - If backend is behind proxy, configure proxy settings
   - Check if VPN is interfering

### Solution 3: Fix n8n Workflow Configuration

**If workflow is misconfigured**:

1. **Verify Webhook Path**:
   - Should be exactly: `useraccount` (not `userAccount`, `UserAccount`, etc.)
   - No leading/trailing slashes
   - Case-sensitive

2. **Fix "Respond to Webhook" Node**:
   - Open the node
   - Set Response Mode: `responseNode`
   - Set Response Body: `={{ $json }}` or `={{ $json.body }}`
   - Remove any hardcoded test data

3. **Verify Airtable Node**:
   - Base: "Seven Dashboard" (appzbyi8q7pJRl1cd)
   - Table: "User Accounts" (tbl7RRcehD5xLiPv7)
   - Operation: "search"
   - Credentials: Valid Airtable token

4. **Activate Workflow**:
   - Toggle should be green (Active)
   - Save workflow
   - Test execution manually

### Solution 4: Increase Timeout (If Timeout Issue)

**Current timeout**: 20 seconds

**If logs show timeout errors**, increase timeout:

**File**: `backend/src/services/auth/auth.service.ts`

**Change**:
```typescript
const INITIAL_TIMEOUT = 30000; // Increase from 20000 to 30000 (30 seconds)
```

**Or make it configurable**:
```typescript
const INITIAL_TIMEOUT = parseInt(process.env.N8N_TIMEOUT || '20000', 10);
```

Then set environment variable:
```
N8N_TIMEOUT=30000
```

### Solution 5: Add Health Check Endpoint

**Create endpoint to test webhook connectivity**:

**File**: `backend/src/routes/auth.routes.ts`

**Add**:
```typescript
router.get('/health/webhook', async (req, res) => {
  try {
    const { n8nEndpoints } = await import('../services/airtable/n8nEndpoints.js');
    const webhookUrl = n8nEndpoints.get.userAccount;
    
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const text = await response.text();
    const data = JSON.parse(text);
    
    res.json({
      success: true,
      webhookUrl,
      status: response.status,
      recordCount: Array.isArray(data) ? data.length : 0,
      n8nBaseUrl: process.env.N8N_BASE_URL,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      webhookUrl: n8nEndpoints.get.userAccount,
      n8nBaseUrl: process.env.N8N_BASE_URL,
    });
  }
});
```

**Usage**:
```bash
curl https://your-backend-url/api/auth/health/webhook
```

## Implementation Checklist

### Immediate Actions (Do First)

- [ ] **Check backend logs** after latest deployment
  - Look for specific error messages
  - Note response status, content-type
  - Identify exact failure point

- [ ] **Verify N8N_BASE_URL** in backend environment
  - Check hosting platform dashboard
  - Verify value: `https://fixrrahul.app.n8n.cloud`
  - If missing/incorrect: Add/Update and **redeploy**

- [ ] **Test webhook from backend** (if SSH access)
  - Run: `node backend/scripts/test-useraccount-webhook.js`
  - Compare results with curl test

### If N8N_BASE_URL is Missing/Incorrect

- [ ] Add `N8N_BASE_URL` to backend environment
- [ ] Set value to `https://fixrrahul.app.n8n.cloud`
- [ ] **Redeploy backend** (critical!)
- [ ] Verify in logs that URL is correct
- [ ] Test login

### If Network Issue

- [ ] Check firewall rules allow outbound HTTPS
- [ ] Test connectivity from backend server
- [ ] Check DNS resolution
- [ ] Verify no proxy/VPN interference

### If n8n Workflow Issue

- [ ] Verify workflow is Active
- [ ] Check webhook path is `/webhook/useraccount`
- [ ] Verify "Respond to Webhook" node configuration
- [ ] Check recent executions for errors
- [ ] Test workflow manually in n8n

### Verification Steps

- [ ] Backend logs show successful webhook fetch
- [ ] Login works for at least one user
- [ ] Profile IDs are returned in response
- [ ] No "Authentication service temporarily unavailable" errors
- [ ] All user types can login

## Troubleshooting Decision Tree

```
START: Login Error
│
├─ Check Backend Logs
│  │
│  ├─ Error: "N8N_BASE_URL environment variable is required"
│  │  └─→ Set N8N_BASE_URL and redeploy
│  │
│  ├─ Error: "Response looks like HTML"
│  │  └─→ Check n8n workflow is active
│  │
│  ├─ Error: "Webhook response is not valid JSON"
│  │  └─→ Check n8n workflow response format
│  │
│  ├─ Error: "Request timed out"
│  │  └─→ Check network connectivity or increase timeout
│  │
│  └─ Error: "ECONNREFUSED" or "ENOTFOUND"
│     └─→ Check network connectivity
│
├─ Verify N8N_BASE_URL
│  │
│  ├─ Missing → Add and redeploy
│  ├─ Incorrect → Update and redeploy
│  └─ Correct → Continue
│
├─ Test Webhook from Backend
│  │
│  ├─ PASSED → Issue is in login flow, check logs
│  └─ FAILED → Issue is connectivity, check network
│
└─ Verify n8n Workflow
   │
   ├─ Not Active → Activate workflow
   ├─ Wrong Path → Fix webhook path
   └─ Misconfigured → Fix "Respond to Webhook" node
```

## Expected Log Output (Success)

After fixing the issue, you should see in backend logs:

```
[AuthService] Step 1: Fetching user accounts from webhook...
[AuthService] Webhook URL: /webhook/useraccount
[AuthService] Fetching from: https://fixrrahul.app.n8n.cloud/webhook/useraccount
[AuthService] Attempt 1/3 to fetch user accounts...
[AuthService] Response received - Status: 200, Content-Type: application/json
[AuthService] ✅ JSON parsed successfully. Response type: array, Length: 11
[AuthService] ✅ Successfully extracted 11 user accounts
[AuthService] Step 2: Searching for user by email...
[AuthService] ✅ User account found: recXXXXXXXXXXXX
[AuthService] Step 6.5: Fetching role-specific profile data...
[AuthService] ✅ Profile data fetch completed. Final profile: {...}
[AuthService] ✅ JWT token generated successfully
```

## Quick Fix Summary

**Most Likely Fix** (90% of cases):
1. Set `N8N_BASE_URL=https://fixrrahul.app.n8n.cloud` in backend environment
2. **Redeploy backend** (required!)
3. Test login

**If that doesn't work**:
1. Check backend logs for specific error
2. Follow troubleshooting decision tree
3. Run test script if possible
4. Verify n8n workflow configuration

## Files Modified (Already Done)

1. ✅ `backend/src/services/auth/auth.service.ts` - Better error handling, logging
2. ✅ `backend/src/controllers/auth.controller.ts` - Updated response format
3. ✅ `backend/scripts/test-useraccount-webhook.js` - Test script created
4. ✅ `DEBUG_LOGIN_ERROR.md` - Debug guide created

## Next Steps

1. **IMMEDIATE**: Check backend environment variables (N8N_BASE_URL)
2. **IMMEDIATE**: Check backend logs after latest deployment
3. **If env var missing**: Add it and redeploy
4. **If still failing**: Follow troubleshooting decision tree
5. **Verify**: Test login with all user types

## Success Criteria

- [ ] `N8N_BASE_URL` is set correctly in backend environment
- [ ] Backend logs show successful webhook fetch
- [ ] Login works for all user types
- [ ] Profile IDs are returned correctly
- [ ] No "Authentication service temporarily unavailable" errors

---

**Priority**: Fix `N8N_BASE_URL` environment variable first - this is the most likely cause!
