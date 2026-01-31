# Debugging 503 Service Unavailable Error

## Problem

Login request to `https://seven-dash.fly.dev/api/auth/login` returns **503 Service Unavailable**.

## Root Cause

The backend returns 503 when:
- n8n webhook times out
- Unable to connect to n8n webhook
- Error message contains "temporarily unavailable"

This indicates the `/webhook/useraccount` n8n webhook is likely:
1. Not responding
2. Timing out (>20 seconds)
3. Returning an error
4. Returning empty response

## How to Debug

### Step 1: Check Backend Logs

**On Fly.io:**

```bash
# View recent logs
flyctl logs -a seven-dash

# Follow logs in real-time
flyctl logs -a seven-dash --follow

# Filter for login errors
flyctl logs -a seven-dash | grep -i "login\|503\|timeout\|unavailable"
```

**Look for:**
- `[AuthService] Step 1: Fetching user accounts from webhook...`
- `[AuthService] Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount`
- `[AuthService] ❌ Webhook fetch failed` or timeout errors
- `[AuthController] Login failed` with error message

### Step 2: Test n8n Webhook Directly

**Test the webhook with curl:**

```bash
curl -X GET "https://fixrrahul.app.n8n.cloud/webhook/useraccount" \
  -H "Content-Type: application/json" \
  -v
```

**Expected:**
- HTTP 200 status
- JSON array of user accounts
- Response body should NOT be empty

**If you get:**
- Empty response (0 bytes) → n8n filter is blocking all users
- Timeout → n8n workflow is slow or stuck
- 404/500 → n8n webhook URL is wrong or workflow is not active

### Step 3: Check n8n Workflow Status

1. **Go to n8n dashboard**: https://fixrrahul.app.n8n.cloud
2. **Find workflow**: `/webhook/useraccount`
3. **Check status**: Should be "Active" (green)
4. **Check last execution**: Should be recent (within last few minutes)
5. **View execution logs**: Check for errors

### Step 4: Verify n8n Filter Configuration

The n8n filter might be blocking all users. Check:

1. **Filter node conditions** should use:
   - `$json.fields.Username` (NOT `$json.Username`)
   - `$json.fields['Account Status']` (NOT `$json['Account Status']`)

2. **Test with a known good user**:
   - Make sure `sagar@sevenfincorp.email` exists in Airtable
   - Make sure `Account Status` = "Active" (exact case)
   - Make sure Username field matches exactly

### Step 5: Check Environment Variables

**On Fly.io:**

```bash
# Check N8N_BASE_URL
flyctl secrets list -a seven-dash

# Should see:
# N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

**If missing or wrong:**
```bash
flyctl secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud -a seven-dash
```

## Common Issues and Fixes

### Issue 1: Empty Webhook Response

**Symptom**: Webhook returns HTTP 200 but 0 bytes

**Fix**: 
- Check n8n filter conditions
- Make sure filter uses `$json.fields.Username` not `$json.Username`
- Make sure at least one user passes the filter

### Issue 2: Webhook Timeout

**Symptom**: Request takes >20 seconds and times out

**Fix**:
- Check n8n workflow execution time
- Optimize Airtable query (add filters, limit records)
- Check n8n instance performance

### Issue 3: Webhook Returns Error

**Symptom**: Webhook returns 404, 500, or other error

**Fix**:
- Verify webhook URL is correct
- Make sure workflow is active
- Check n8n credentials (Airtable token)

### Issue 4: Wrong Environment Variable

**Symptom**: Backend can't find n8n webhook

**Fix**:
- Set `N8N_BASE_URL` on Fly.io
- Restart backend after setting

## Quick Test Script

Save this as `test-n8n-webhook.sh`:

```bash
#!/bin/bash

echo "Testing n8n webhook..."
echo "URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount"
echo ""

response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
  "https://fixrrahul.app.n8n.cloud/webhook/useraccount")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
time_total=$(echo "$response" | grep "TIME" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d' | sed '/TIME/d')

echo "HTTP Status: $http_code"
echo "Response Time: ${time_total}s"
echo "Response Size: $(echo "$body" | wc -c) bytes"
echo ""
echo "Response Body (first 500 chars):"
echo "$body" | head -c 500
echo ""
```

Run: `bash test-n8n-webhook.sh`

## Next Steps

1. **Check backend logs** to see exact error message
2. **Test n8n webhook** directly with curl
3. **Verify n8n workflow** is active and working
4. **Check filter conditions** in n8n workflow
5. **Verify environment variables** on Fly.io

## Expected Backend Log Output (Success)

```
[AuthController] ========== LOGIN REQUEST STARTED ==========
[AuthController] Request ID: LOGIN-1234567890-abc123
[AuthController] Input validated: { email: 'sagar@sevenfincorp.email' }
[AuthController] Calling authService.login()...
[AuthService] ========== LOGIN STARTED ==========
[AuthService] Email: sagar@sevenfincorp.email
[AuthService] Step 1: Fetching user accounts from webhook...
[AuthService] Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount
[AuthService] ✅ Webhook fetch successful: 5 users
[AuthService] Step 2: Filtering test accounts...
[AuthService] ✅ Filtered: 4 users remaining
[AuthService] Step 3: Finding user by email...
[AuthService] ✅ User found: sagar@sevenfincorp.email
[AuthService] Step 4: Validating account status...
[AuthService] ✅ Account is Active
[AuthService] Step 5: Validating password...
[AuthService] ✅ Password valid
[AuthService] Step 6: Resolving profile data...
[AuthService] ✅ Profile resolved: { kamId: 'rec123...' }
[AuthService] Step 7: Generating JWT token...
[AuthService] ✅ JWT token generated
[AuthController] Authentication successful: { userId: 'rec123...', email: 'sagar@sevenfincorp.email', role: 'KAM' }
[AuthController] ✅ JWT token set in HTTP-only cookie
[AuthController] Login completed in 2345ms
```

## Expected Backend Log Output (503 Error)

```
[AuthController] ========== LOGIN REQUEST STARTED ==========
[AuthController] Input validated: { email: 'sagar@sevenfincorp.email' }
[AuthController] Calling authService.login()...
[AuthService] ========== LOGIN STARTED ==========
[AuthService] Step 1: Fetching user accounts from webhook...
[AuthService] Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/useraccount
[AuthService] ❌ Webhook fetch failed: timeout after 20000ms
[AuthController] Login failed: Authentication service temporarily unavailable. Please try again later.
[AuthController] Login failed after 20123ms
```

---

**Check the backend logs first to see the exact error!**
