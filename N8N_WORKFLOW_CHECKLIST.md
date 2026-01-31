# n8n Workflow Checklist - `/webhook/useraccount`

## ✅ Webhook Status: LIVE (HTTP 200)

The webhook is responding, but the response is empty. Let's verify the workflow configuration.

---

## 🔍 Checklist: Verify Workflow Configuration

### 1. Workflow is Active ✅
- [x] Webhook responds (HTTP 200)
- [ ] Workflow shows as "Active" in n8n dashboard
- [ ] Green toggle switch is ON

### 2. Airtable Connection
- [ ] Airtable credentials are configured
- [ ] Base ID is correct: "Seven Dashboard"
- [ ] Table name is correct: "User Accounts"
- [ ] Fields are selected: Username, Password, Role, Account Status, etc.

### 3. Response Format
- [ ] "Respond to Webhook" node is configured
- [ ] Response body is set to: `={{ $json }}` or `={{ $json.body }}`
- [ ] Response mode is: "responseNode"

### 4. Filter Node (If Added)
- [ ] Filter node is between Airtable and Respond to Webhook
- [ ] Filter conditions are configured:
  - Username does NOT contain "test@"
  - Username does NOT contain "dummy@"
  - Username does NOT contain "example.com"
  - Account Status equals "Active"
  - Username is NOT "test"
  - Username is NOT "dummy"
- [ ] Filter mode is: "Keep items that match all conditions"

---

## 🔧 If Response is Empty

### Possible Causes:

1. **Airtable Connection Issue**
   - Check Airtable credentials
   - Verify Base ID is correct
   - Check table name matches exactly

2. **No Records in Table**
   - Verify User Accounts table has records
   - Check if records are in the correct base

3. **Field Mapping Issue**
   - Verify field names match Airtable schema
   - Check if fields are selected in Airtable node

4. **Workflow Execution Error**
   - Check workflow execution logs in n8n
   - Look for error messages
   - Test workflow manually in n8n editor

---

## 🧪 Test Workflow in n8n

1. **Open Workflow** in n8n editor
2. **Click "Test workflow"** button
3. **Check Output**:
   - Airtable node should show records
   - Filter node (if present) should show filtered records
   - Respond to Webhook should show final response

4. **Check Execution Logs**:
   - Look for any error messages
   - Verify each node executed successfully
   - Check data flow between nodes

---

## 📋 Expected Workflow Structure

### Without Filter (Current):
```
Webhook (GET) 
  → Airtable (Search User Accounts)
    → Respond to Webhook
```

### With Filter (Recommended):
```
Webhook (GET)
  → Airtable (Search User Accounts)
    → Filter (Test Accounts + Active Only)
      → Respond to Webhook
```

---

## 🔧 Quick Fixes

### Fix 1: Check Airtable Node
- Open Airtable node
- Verify "Operation" is set to "Search" or "List"
- Check "Table" is set to "User Accounts"
- Verify fields are selected

### Fix 2: Check Respond to Webhook Node
- Open Respond to Webhook node
- Verify "Response Body" is set to: `={{ $json }}`
- Or try: `={{ $json.body }}`
- Check "Response Mode" is "responseNode"

### Fix 3: Test Manually
- Click "Test workflow" in n8n
- Check each node's output
- Verify data flows correctly

---

## ✅ After Fixing

Once the workflow returns data:

1. **Test Webhook Again**:
   ```bash
   ./test-n8n-webhook.sh
   ```

2. **Verify Filter** (if added):
   - Should NOT contain test accounts
   - Should ONLY contain Active accounts

3. **Test Login**:
   - Try logging in with real account
   - Should work ✅

---

## 📞 Next Steps

1. **Open n8n Dashboard**: https://fixrrahul.app.n8n.cloud
2. **Find Workflow**: `/webhook/useraccount`
3. **Check Configuration**: Verify all nodes are configured correctly
4. **Test Workflow**: Click "Test workflow" button
5. **Check Logs**: Review execution logs for errors
6. **Add Filter**: If not present, add Filter node (see guide)
7. **Activate**: Ensure workflow is active

---

## 🎯 Summary

**Status**: Webhook is live but returning empty response

**Action**: 
1. Check n8n workflow configuration
2. Verify Airtable connection
3. Test workflow in n8n editor
4. Add Filter node if needed
5. Test webhook again

**Files Available**:
- `test-n8n-webhook.sh` - Test script
- `n8n-useraccount-webhook-with-filter.json` - Complete workflow
- `N8N_WEBHOOK_SETUP_COMPLETE.md` - Setup guide

The webhook is live - now verify it's configured correctly! 🔧
