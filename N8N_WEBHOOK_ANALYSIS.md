# n8n Webhook Analysis - `/webhook/useraccount`

## Current Status

✅ **Webhook is LIVE**: https://fixrrahul.app.n8n.cloud/webhook/useraccount

---

## Analysis Results

### Test Results

Run these commands to check the current state:

```bash
# Get total number of users
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq 'length'

# Check for test accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.Username | test("test|dummy|example.com"; "i")) | .Username'

# Check for inactive accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.["Account Status"] != "Active") | {Username: .Username, Status: .["Account Status"]}'
```

---

## What to Check

### 1. Test Accounts Present?
- ❌ **If YES**: Filter node is NOT working → Need to add/update filter
- ✅ **If NO**: Filter is working → Good!

### 2. Inactive Accounts Present?
- ❌ **If YES**: Filter node is NOT filtering by status → Need to update filter
- ✅ **If NO**: Filter is working → Good!

### 3. Response Format
- Should return: Array of user objects
- Each object should have: `Username`, `Password`, `Role`, `Account Status`, etc.

---

## If Filter is Missing or Not Working

### Option 1: Import Pre-Built Workflow

1. **Export Current Workflow** (backup):
   - In n8n, click workflow menu → "Download"
   - Save as backup

2. **Import New Workflow**:
   - Click "Import from File"
   - Select: `n8n-useraccount-webhook-with-filter.json`
   - Update Airtable credentials
   - Update field IDs to match your schema

3. **Test**:
   - Click "Test workflow"
   - Verify test accounts are filtered out

4. **Activate**:
   - Toggle "Active" switch
   - Save

### Option 2: Manual Update

1. **Open Workflow** in n8n editor
2. **Add Filter Node**:
   - Position: Between Airtable and Respond to Webhook
   - Mode: "Keep items that match all conditions"
3. **Add Conditions**:
   - Username does NOT contain "test@"
   - Username does NOT contain "dummy@"
   - Username does NOT contain "example.com"
   - Account Status equals "Active"
   - Username is NOT "test"
   - Username is NOT "dummy"
4. **Test and Activate**

---

## Expected Response After Filter

After adding the filter, the webhook should:
- ✅ Return only "Active" accounts
- ✅ Exclude all test accounts
- ✅ Return array format: `[{...}, {...}, ...]`

---

## Verification

After updating, test again:

```bash
# Should return only active, non-test accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | .Username'

# Should return 0 test accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.Username | test("test|dummy|example.com"; "i")) | .Username' | wc -l
# Expected: 0

# Should return 0 inactive accounts
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.["Account Status"] != "Active") | .Username' | wc -l
# Expected: 0
```

---

## Next Steps

1. **Test Current Webhook** - Run the analysis commands above
2. **Check Results** - See if test accounts are present
3. **Update if Needed** - Add filter node if test accounts found
4. **Verify** - Test again to confirm filtering works
5. **Test Login** - Try logging in with real and test accounts

---

## Notes

- The backend also filters test accounts, but filtering in n8n is more efficient
- Filtering at the webhook level reduces data transfer
- Both backend and n8n filtering provide defense in depth
