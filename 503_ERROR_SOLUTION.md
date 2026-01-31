# Solution: 503 "Authentication service temporarily unavailable" Error

## Problem Summary

The backend returns **503 Service Unavailable** with message **"Authentication service temporarily unavailable. Please try again later."** when the n8n webhook fails.

## Root Cause

The n8n webhook `/webhook/useraccount` is likely:
1. **Returning empty response** (most common) - Filter is blocking all users
2. **Timing out** (>20 seconds) - Workflow is slow
3. **Returning HTML error page** - Workflow has an error
4. **Returning invalid JSON** - Response format is wrong

## Quick Fix (5 minutes)

### Step 1: Test the Webhook

Run the test script:

```bash
bash test-n8n-webhook.sh
```

**Expected output:**
- ✅ HTTP 200
- ✅ Valid JSON array
- ✅ At least 1 user record

**If you see:**
- ❌ Empty response (0 bytes) → Go to Step 2
- ❌ Timeout → Go to Step 3
- ❌ Invalid JSON → Go to Step 4

### Step 2: Fix Empty Response (Most Common)

**Problem:** n8n filter is blocking all users because it uses wrong field paths.

**Fix:**

1. **Open n8n**: https://fixrrahul.app.n8n.cloud
2. **Find workflow**: `/webhook/useraccount`
3. **Click "Filter Test Accounts" node**
4. **Update ALL conditions:**

   **Change FROM:**
   ```
   {{ $json.Username }}
   {{ $json['Account Status'] }}
   ```

   **Change TO:**
   ```
   {{ $json.fields.Username }}
   {{ $json.fields['Account Status'] }}
   ```

5. **Save and activate workflow**

6. **Test again:**
   ```bash
   bash test-n8n-webhook.sh
   ```

### Step 3: Fix Timeout

**Problem:** n8n workflow takes >20 seconds to execute.

**Fix:**

1. **Check n8n execution logs** for slow operations
2. **Add filters to Airtable query** to reduce records
3. **Optimize workflow** - remove unnecessary nodes
4. **Check n8n instance performance**

### Step 4: Fix Invalid JSON

**Problem:** "Respond to Webhook" node is not configured correctly.

**Fix:**

1. **Open "Respond to Webhook" node**
2. **Set "Response Body" to:**
   ```
   {{ $input.all() }}
   ```
   or
   ```
   {{ $json }}
   ```
3. **Save and activate workflow**

## Import Fixed Workflow (Easiest)

If manual fix doesn't work, import the fixed workflow:

1. **In n8n dashboard**, click **"Workflows"** → **"Import from File"**
2. **Select**: `n8n-useraccount-webhook-FIXED.json`
3. **Activate the workflow**
4. **Test:**
   ```bash
   bash test-n8n-webhook.sh
   ```

## Verify Airtable Data

Make sure your user exists in Airtable:

- **Table**: User Accounts
- **Username**: `sagar@sevenfincorp.email` (exact match)
- **Account Status**: `Active` (exact case, no spaces)
- **Password**: `pass@123` (or your password)
- **Role**: `KAM` (or your role)

## Check Backend Logs

**View logs on Fly.io:**

```bash
flyctl logs -a seven-dash --follow
```

**Look for:**
```
[AuthService] Step 1: Fetching user accounts from webhook...
[AuthService] Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Good:**
```
[AuthService] ✅ Webhook fetch successful: 5 users
```

**Bad:**
```
[AuthService] ❌ Webhook fetch failed: Authentication service returned an empty response.
```

## After Fixing

1. **Test webhook** with `bash test-n8n-webhook.sh`
2. **Try login** on frontend
3. **Check console logs** for email debugging (from previous fix)
4. **Verify** correct email is sent to backend

## Still Not Working?

1. **Share webhook test output:**
   ```bash
   bash test-n8n-webhook.sh > webhook-test-output.txt
   ```

2. **Share backend logs:**
   ```bash
   flyctl logs -a seven-dash | grep -i "auth\|webhook" > backend-logs.txt
   ```

3. **Check n8n workflow:**
   - Is it **Active**?
   - Last execution time?
   - Any errors in execution logs?

---

**Most likely fix: Update filter to use `$json.fields.Username` instead of `$json.Username`**
