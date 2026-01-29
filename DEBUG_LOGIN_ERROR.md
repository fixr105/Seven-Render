# Debug Login Error - Step by Step Guide

## Error: "Authentication service temporarily unavailable. Please try again later."

## Quick Diagnosis Steps

### Step 1: Check Backend Environment Variable

The backend needs `N8N_BASE_URL` environment variable set. Verify it's correct:

```bash
# In your backend environment, check:
echo $N8N_BASE_URL

# Should be:
# https://fixrrahul.app.n8n.cloud
```

### Step 2: Test Webhook from Backend Server

Run the test script to verify the backend can reach the webhook:

```bash
cd backend
node scripts/test-useraccount-webhook.js
```

**Expected Output:**
```
✅ N8N_BASE_URL: https://fixrrahul.app.n8n.cloud
📡 Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount
✅ Response is valid JSON array with 11 records
✅ Webhook test PASSED!
```

**If it fails:**
- Check N8N_BASE_URL is set correctly
- Check network connectivity from backend to n8n
- Check if webhook URL is correct

### Step 3: Check Backend Logs

After deploying the latest changes, the backend now logs detailed information:

Look for these log messages:
```
[AuthService] Response received - Status: 200, Content-Type: application/json
[AuthService] ✅ JSON parsed successfully. Response type: array, Length: XX
```

**If you see errors:**
- `❌ Response looks like HTML` → n8n workflow is returning error page
- `❌ Webhook response is not valid JSON` → Response format issue
- `❌ Webhook returned empty body` → n8n workflow not returning data

### Step 4: Verify n8n Workflow

1. **Check workflow is Active** (green toggle in n8n)
2. **Check webhook path** is exactly `/webhook/useraccount` (case-sensitive)
3. **Check "Respond to Webhook" node**:
   - Response Mode: `responseNode`
   - Response Body: Should return the Airtable data directly
4. **Check recent executions** for errors

### Step 5: Test Webhook Directly

```bash
curl -v https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected:**
- HTTP 200
- Content-Type: application/json
- Valid JSON array

## Common Issues & Solutions

### Issue 1: N8N_BASE_URL Not Set

**Symptom:** Backend can't construct webhook URL

**Solution:**
```bash
# Set in your backend environment
export N8N_BASE_URL=https://fixrrahul.app.n8n.cloud

# Or in .env file:
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

### Issue 2: Network Timeout

**Symptom:** Backend times out before getting response

**Solution:**
- Check network connectivity
- Increase timeout (currently 20 seconds)
- Check if n8n instance is slow/overloaded

### Issue 3: Response Format Mismatch

**Symptom:** Backend gets different response than curl

**Solution:**
- Check if there are multiple n8n instances
- Verify webhook path is correct
- Check if load balancer is routing differently

### Issue 4: HTML Error Page

**Symptom:** Backend receives HTML instead of JSON

**Solution:**
- Check n8n workflow is active
- Check workflow execution logs
- Verify "Respond to Webhook" node is configured correctly

## What Was Fixed

1. ✅ **Better error handling** - More specific error messages
2. ✅ **Improved logging** - Detailed response information
3. ✅ **Fixed response reading** - Can only read response body once
4. ✅ **HTML detection** - Detects error pages early
5. ✅ **Retry logic** - 3 retries with exponential backoff

## Next Steps

1. **Deploy latest changes** (already pushed)
2. **Check backend logs** for detailed error information
3. **Run test script** to verify connectivity
4. **Verify N8N_BASE_URL** is set correctly
5. **Check n8n workflow** is active and configured correctly

## Test Script Usage

```bash
# From backend directory
cd backend
node scripts/test-useraccount-webhook.js
```

This will test the exact same code path as the backend login.
