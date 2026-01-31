# ✅ n8n Webhook Setup - Complete Guide

## Current Status

✅ **Webhook is LIVE**: https://fixrrahul.app.n8n.cloud/webhook/useraccount

The webhook is active and responding. Now we need to verify if it has the test account filter.

---

## 🔍 Quick Verification

### Test 1: Check Response Format
```bash
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected**: JSON array of user objects
```json
[
  {
    "id": "rec...",
    "Username": "user@example.com",
    "Password": "...",
    "Role": "client",
    "Account Status": "Active",
    ...
  },
  ...
]
```

### Test 2: Check for Test Accounts
```bash
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.Username | test("test|dummy|example.com"; "i")) | .Username'
```

**Expected**: Empty (no test accounts)
**If test accounts appear**: Filter is NOT working → Need to add filter

### Test 3: Check for Inactive Accounts
```bash
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.["Account Status"] != "Active")'
```

**Expected**: Empty (only Active accounts)
**If inactive accounts appear**: Filter is NOT working → Need to add filter

---

## 📋 What the Filter Should Do

The filter node should:
1. ✅ Exclude usernames containing "test@"
2. ✅ Exclude usernames containing "dummy@"
3. ✅ Exclude usernames containing "example.com"
4. ✅ Exclude username exactly "test"
5. ✅ Exclude username exactly "dummy"
6. ✅ Only include accounts with "Account Status" = "Active"

---

## 🔧 How to Add/Update Filter

### Step 1: Open n8n Workflow

1. Go to: https://fixrrahul.app.n8n.cloud
2. Click "Workflows" in sidebar
3. Find workflow: `/webhook/useraccount` (GET method)
4. Click to open in editor

### Step 2: Check Current Structure

**Current structure should be:**
```
Webhook (GET) → Airtable (Search) → Respond to Webhook
```

**If Filter node is missing**, add it:
```
Webhook (GET) → Airtable (Search) → Filter → Respond to Webhook
```

### Step 3: Add Filter Node

1. **Click "+" button** between Airtable and Respond to Webhook
2. **Search for "Filter"** node
3. **Add Filter node**

### Step 4: Configure Filter

**Mode**: "Keep items that match all conditions"

**Add these conditions:**

1. **Condition 1: Exclude test@**
   - Left Value: `={{ $json.fields['Username'] }}` or `={{ $json['Username'] }}`
   - Operation: "Does Not Contain"
   - Right Value: `test@`

2. **Condition 2: Exclude dummy@**
   - Left Value: `={{ $json.fields['Username'] }}` or `={{ $json['Username'] }}`
   - Operation: "Does Not Contain"
   - Right Value: `dummy@`

3. **Condition 3: Exclude example.com**
   - Left Value: `={{ $json.fields['Username'] }}` or `={{ $json['Username'] }}`
   - Operation: "Does Not Contain"
   - Right Value: `example.com`

4. **Condition 4: Only Active accounts**
   - Left Value: `={{ $json.fields['Account Status'] }}` or `={{ $json['Account Status'] }}`
   - Operation: "Equals"
   - Right Value: `Active`

5. **Condition 5: Exclude "test" username**
   - Left Value: `={{ $json.fields['Username'] }}` or `={{ $json['Username'] }}`
   - Operation: "Does Not Equal"
   - Right Value: `test`

6. **Condition 6: Exclude "dummy" username**
   - Left Value: `={{ $json.fields['Username'] }}` or `={{ $json['Username'] }}`
   - Operation: "Does Not Equal"
   - Right Value: `dummy`

**Note**: Use `$json.fields['...']` if Airtable returns fields in a `fields` object, or `$json['...']` if fields are at root level.

### Step 5: Connect Nodes

- Connect: Airtable → Filter → Respond to Webhook
- Make sure all connections are properly linked

### Step 6: Test

1. Click **"Test workflow"** button
2. Check output:
   - Should NOT contain test accounts
   - Should only contain "Active" accounts
   - Should return array format

### Step 7: Activate

1. Toggle **"Active"** switch (top right)
2. Click **"Save"** button
3. Verify workflow shows as "Active"

---

## 🎯 Alternative: Import Pre-Built Workflow

If you prefer to import the complete workflow:

1. **Backup Current Workflow**:
   - Click workflow menu → "Download"
   - Save as backup

2. **Import New Workflow**:
   - Click "Import from File"
   - Select: `n8n-useraccount-webhook-with-filter.json`
   - **Important**: Update these after import:
     - Airtable Base ID
     - Airtable credentials
     - Field IDs (if different from your schema)

3. **Test and Activate**

---

## ✅ Verification After Update

After adding the filter, test again:

```bash
# Should return only active, non-test accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq 'length'
# Note the count

# Should return 0 test accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.Username | test("test|dummy|example.com"; "i")) | .Username' | wc -l
# Expected: 0

# Should return 0 inactive accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.["Account Status"] != "Active") | .Username' | wc -l
# Expected: 0
```

---

## 🧪 Test Login After Update

Once the filter is working:

1. **Test Real User Login**:
   - Go to frontend login page
   - Login with real account
   - Should work ✅

2. **Test Account Rejection**:
   - Try `test@example.com`
   - Should fail with "Invalid email or password" ❌

3. **Verify Cookies**:
   - Check browser DevTools → Application → Cookies
   - Verify `auth_token` cookie is set
   - Verify `httpOnly: true`

---

## 📊 Expected Results

### Before Filter:
- May include test accounts
- May include inactive accounts
- Backend filters them (but less efficient)

### After Filter:
- ✅ Only active accounts
- ✅ No test accounts
- ✅ More efficient (less data transfer)
- ✅ Defense in depth (filtered at both n8n and backend)

---

## 🆘 Troubleshooting

### Issue: Filter node not working
- Check field names match your Airtable schema exactly
- Verify filter conditions are set to "AND" (all must match)
- Test each condition individually

### Issue: Workflow returns empty array
- Check if you have any active, non-test accounts
- Verify filter conditions aren't too restrictive
- Temporarily remove filter to see all records

### Issue: Field names don't match
- Check your Airtable "User Accounts" table
- Verify exact field names: `Username`, `Account Status`
- Update filter conditions with correct field names

---

## ✨ Summary

**Current Status**: Webhook is live ✅

**Next Step**: 
1. Test current webhook response
2. Check if test accounts are present
3. Add filter node if needed
4. Test again to verify filtering
5. Test login with real and test accounts

**Files Available**:
- `n8n-useraccount-webhook-with-filter.json` - Complete workflow with filter
- `N8N_WORKFLOW_UPDATE_GUIDE.md` - Detailed instructions
- `N8N_WEBHOOK_ANALYSIS.md` - Analysis guide

The webhook is live - now verify it's filtering correctly! 🚀
