# n8n Workflow Update Guide - User Accounts Webhook

## Overview

This guide shows you how to update the `/webhook/useraccount` workflow in n8n to filter out test accounts.

## Option 1: Import Pre-Built Workflow (Recommended)

1. **Open n8n Dashboard**
   - Go to: https://fixrrahul.app.n8n.cloud
   - Login to your account

2. **Import Workflow**
   - Click "Workflows" in the sidebar
   - Click "Import from File" or the "+" button → "Import from File"
   - Select the file: `n8n-useraccount-webhook-with-filter.json`
   - Click "Import"

3. **Configure the Workflow**
   - Update Airtable Base ID (if different)
   - Update Airtable credentials
   - Update field IDs to match your Airtable schema

4. **Test the Workflow**
   - Click "Test workflow"
   - Verify test accounts are filtered out
   - Verify only "Active" accounts are returned

5. **Activate**
   - Toggle "Active" switch
   - Save the workflow

## Option 2: Manual Update (Step-by-Step)

### Step 1: Open Existing Workflow

1. Go to n8n dashboard
2. Find workflow: `/webhook/useraccount` (GET method)
3. Click to open in editor

### Step 2: Add Filter Node

1. **Add Filter Node**
   - Click "+" button between Airtable node and Respond to Webhook node
   - Search for "Filter" node
   - Add "Filter" node

2. **Configure Filter Node**
   - **Mode:** "Keep items that match all conditions"
   - **Add Conditions:**
     
     **Condition 1: Exclude test@ emails**
     - Left Value: `={{ $json.fields['Username'] }}`
     - Operation: "Does Not Contain"
     - Right Value: `test@`
     
     **Condition 2: Exclude dummy@ emails**
     - Left Value: `={{ $json.fields['Username'] }}`
     - Operation: "Does Not Contain"
     - Right Value: `dummy@`
     
     **Condition 3: Exclude example.com emails**
     - Left Value: `={{ $json.fields['Username'] }}`
     - Operation: "Does Not Contain"
     - Right Value: `example.com`
     
     **Condition 4: Only Active accounts**
     - Left Value: `={{ $json.fields['Account Status'] }}`
     - Operation: "Equals"
     - Right Value: `Active`
     
     **Condition 5: Exclude "test" username**
     - Left Value: `={{ $json.fields['Username'] }}`
     - Operation: "Does Not Equal"
     - Right Value: `test`
     
     **Condition 6: Exclude "dummy" username**
     - Left Value: `={{ $json.fields['Username'] }}`
     - Operation: "Does Not Equal"
     - Right Value: `dummy`

3. **Connect Nodes**
   - Connect: Airtable → Filter → Respond to Webhook
   - Make sure all connections are properly linked

### Step 3: Test the Workflow

1. Click "Test workflow" button
2. Check the output:
   - Should NOT contain any test accounts
   - Should only contain "Active" accounts
   - Should return array of user records

### Step 4: Activate

1. Toggle "Active" switch (top right)
2. Click "Save" button
3. Verify workflow shows as "Active"

## Verification

### Test 1: Check Webhook Returns Filtered Data

```bash
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected:**
- Returns JSON array
- No test accounts in the array
- Only "Active" accounts
- All accounts have valid email addresses

### Test 2: Verify Test Accounts Are Filtered

Check the response - it should NOT contain:
- `test@example.com`
- `dummy@test.com`
- `test` (as username)
- `dummy` (as username)
- Accounts with status other than "Active"

## Troubleshooting

### Issue: Filter node not working

**Solution:**
1. Check field names match your Airtable schema exactly
2. Verify field IDs are correct
3. Check filter conditions are set to "AND" (all must match)
4. Test each condition individually

### Issue: Workflow returns empty array

**Solution:**
1. Check if you have any active, non-test accounts
2. Verify filter conditions aren't too restrictive
3. Temporarily remove filter to see all records
4. Check Airtable connection is working

### Issue: Field names don't match

**Solution:**
1. Check your Airtable "User Accounts" table
2. Verify exact field names:
   - `Username` (not `Email` or `email`)
   - `Account Status` (not `Status`)
3. Update filter conditions with correct field names

## Notes

- The filter node runs **after** Airtable search, so it filters the results
- Filter is case-insensitive by default
- All conditions must match (AND logic)
- Test accounts are filtered at multiple levels (n8n + backend)

## Next Steps

After updating the workflow:
1. ✅ Test the webhook
2. ✅ Verify test accounts are filtered
3. ✅ Deploy backend changes
4. ✅ Test login with real accounts
5. ✅ Verify test account rejection
