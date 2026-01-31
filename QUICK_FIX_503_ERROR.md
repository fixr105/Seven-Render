# Quick Fix for 503 "Authentication service temporarily unavailable" Error

## The Problem

The backend is returning 503 because the n8n webhook `/webhook/useraccount` is:
- Returning empty response (0 bytes)
- Timing out (>20 seconds)
- Returning HTML error page
- Returning invalid JSON

## Immediate Steps to Fix

### Step 1: Check n8n Webhook Status

**Test the webhook directly:**

```bash
curl -X GET "https://fixrrahul.app.n8n.cloud/webhook/useraccount" \
  -H "Content-Type: application/json" \
  -v
```

**What to look for:**
- ✅ **Good**: HTTP 200, JSON array with user records
- ❌ **Bad**: HTTP 200 but empty body (0 bytes) → Filter is blocking all users
- ❌ **Bad**: HTTP 404/500 → Workflow not active or URL wrong
- ❌ **Bad**: Timeout → Workflow is slow or stuck

### Step 2: Check n8n Workflow

1. **Go to**: https://fixrrahul.app.n8n.cloud
2. **Find workflow**: `/webhook/useraccount`
3. **Check**:
   - ✅ Status: **Active** (green toggle)
   - ✅ Last execution: Recent (within last hour)
   - ✅ No errors in execution logs

### Step 3: Fix n8n Filter (Most Common Issue)

**The filter node is likely blocking all users because it uses wrong field paths.**

**Current (WRONG):**
```
$json.Username
$json['Account Status']
```

**Should be (CORRECT):**
```
$json.fields.Username
$json.fields['Account Status']
```

**How to fix:**

1. Open the n8n workflow
2. Click on **"Filter Test Accounts"** node
3. For each condition, update:
   - `{{ $json.Username }}` → `{{ $json.fields.Username }}`
   - `{{ $json['Account Status'] }}` → `{{ $json.fields['Account Status'] }}`
4. Save and activate the workflow

**Or import the fixed workflow:**

Use the file: `n8n-useraccount-webhook-FIXED.json`

1. In n8n, click **"Workflows"** → **"Import from File"**
2. Select `n8n-useraccount-webhook-FIXED.json`
3. Activate the workflow

### Step 4: Verify Airtable Data

Make sure `sagar@sevenfincorp.email` exists in Airtable with:
- **Username**: `sagar@sevenfincorp.email` (exact match)
- **Account Status**: `Active` (exact case, no extra spaces)
- **Password**: `pass@123` (or whatever password you're using)

### Step 5: Test Again

After fixing the n8n workflow:

1. **Test webhook:**
   ```bash
   curl "https://fixrrahul.app.n8n.cloud/webhook/useraccount"
   ```

2. **Should return JSON array like:**
   ```json
   [
     {
       "id": "rec123...",
       "fields": {
         "Username": "sagar@sevenfincorp.email",
         "Account Status": "Active",
         "Role": "KAM",
         ...
       }
     }
   ]
   ```

3. **Try login again** on the frontend

## Check Backend Logs

**On Fly.io:**

```bash
flyctl logs -a seven-dash --follow
```

**Look for:**
- `[AuthService] Step 1: Fetching user accounts from webhook...`
- `[AuthService] ✅ Webhook fetch successful` (good)
- `[AuthService] ❌ Webhook fetch failed` (bad - see error message)

## Common Error Messages

| Error Message | Cause | Fix |
|--------------|-------|-----|
| "Authentication service returned an empty response" | Filter blocking all users | Fix filter field paths |
| "Authentication service timeout" | Webhook takes >20 seconds | Optimize n8n workflow |
| "Authentication service returned an error page" | n8n workflow error | Check n8n execution logs |
| "Invalid webhook response format" | Wrong JSON structure | Check "Respond to Webhook" node |

## Quick Checklist

- [ ] n8n workflow is **Active**
- [ ] Filter uses `$json.fields.Username` (NOT `$json.Username`)
- [ ] Filter uses `$json.fields['Account Status']` (NOT `$json['Account Status']`)
- [ ] At least one user passes the filter
- [ ] Webhook returns JSON array (not empty)
- [ ] User exists in Airtable with correct `Account Status: Active`
- [ ] Backend has `N8N_BASE_URL` environment variable set

## Still Not Working?

1. **Check backend logs** for exact error:
   ```bash
   flyctl logs -a seven-dash | grep -i "auth\|webhook\|503"
   ```

2. **Share the error message** from logs

3. **Test webhook response** and share the output

---

**Most likely fix: Update the n8n filter to use `$json.fields.Username` instead of `$json.Username`**
