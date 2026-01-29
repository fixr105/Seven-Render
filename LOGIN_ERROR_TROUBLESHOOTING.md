# Login Error Troubleshooting - "Authentication service temporarily unavailable"

## Error Message
```
Authentication service temporarily unavailable. Please try again later.
```

## Root Cause Analysis

This error occurs when the **User Accounts webhook** (`/webhook/useraccount`) returns invalid JSON or HTML instead of valid JSON data.

### Common Causes

1. **n8n Workflow Not Active**
   - The `/webhook/useraccount` workflow is not activated in n8n
   - Solution: Activate the workflow in n8n dashboard

2. **n8n Workflow Returning HTML Error Page**
   - The workflow is returning an HTML error page instead of JSON
   - Solution: Check n8n workflow execution logs for errors

3. **n8n Workflow Returning Invalid JSON**
   - The workflow is returning malformed JSON
   - Solution: Check the "Respond to Webhook" node configuration

4. **Network/Timeout Issues**
   - The webhook is timing out or network is unreachable
   - Solution: Check n8n instance status and network connectivity

## Quick Fixes

### 1. Check n8n Workflow Status

1. Go to your n8n dashboard
2. Find the workflow with webhook path `/webhook/useraccount`
3. Ensure it's **Active** (green toggle)
4. Check recent executions for errors

### 2. Verify Webhook Response Format

The webhook should return an **array of user records**:

```json
[
  {
    "id": "recXXXXXXXXXXXX",
    "fields": {
      "Username": "user@example.com",
      "Password": "password123",
      "Role": "client",
      "Account Status": "Active",
      "Associated Profile": "Profile Name"
    }
  }
]
```

### 3. Test Webhook Directly

```bash
curl -X GET https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected**: JSON array of user records
**If you get HTML**: The workflow is not configured correctly

### 4. Check Backend Logs

Look for these log messages:
- `[AuthService] ❌ Webhook response is not valid JSON`
- `[AuthService] ❌ Body looks like HTML`
- `[AuthService] ❌ Webhook returned status XXX`

## Profile Data Fetch Changes

The recent changes made profile data fetching **blocking**, but:
- ✅ Profile data fetch has **3-second timeout** per table
- ✅ Errors in profile data fetch **do NOT block login**
- ✅ Login succeeds even if profile data is missing (IDs will be null)

**The error is NOT from profile data fetch** - it's from the initial User Accounts fetch.

## Debugging Steps

### Step 1: Check n8n Workflow

1. Open n8n dashboard
2. Find `/webhook/useraccount` workflow
3. Check if it's active
4. View recent executions
5. Check for errors in execution logs

### Step 2: Test Webhook Manually

```bash
# Test the webhook
curl -v https://fixrrahul.app.n8n.cloud/webhook/useraccount

# Check response:
# - Should be JSON array
# - Should have Content-Type: application/json
# - Should NOT be HTML
```

### Step 3: Check Backend Logs

Look for:
```
[AuthService] ❌ Webhook response is not valid JSON
[AuthService] ❌ Response status: XXX
[AuthService] ❌ Body preview: ...
```

### Step 4: Verify Workflow Configuration

Ensure the "Respond to Webhook" node:
- Has "Response Mode" set to `responseNode`
- Returns the Airtable data directly (not wrapped in extra JSON)
- Is connected properly to the Airtable node

## Temporary Workaround

If you need to get login working immediately:

1. **Disable profile data fetching temporarily** (not recommended, but will allow login)
2. **Use cached user accounts** if available
3. **Check n8n workflow** and fix the issue

## Permanent Solution

1. **Fix n8n workflow** to return valid JSON
2. **Ensure workflow is active**
3. **Test webhook response** manually
4. **Verify backend can parse the response**

## Related Files

- `backend/src/services/auth/auth.service.ts` - Lines 160-182 (User Accounts fetch)
- n8n workflow: `/webhook/useraccount`

## Next Steps

1. ✅ Check n8n workflow is active
2. ✅ Test webhook manually with curl
3. ✅ Check n8n execution logs
4. ✅ Verify "Respond to Webhook" node configuration
5. ✅ Check backend logs for specific error details

---

**Note**: The profile data fetching changes are working correctly. The error is from the User Accounts webhook, not the profile data fetch.
