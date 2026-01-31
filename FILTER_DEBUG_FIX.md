# Filter Debug: Sagar Not Sent, test@gmail.com Sent

## Problem

- ❌ Sagar's account (`sagar@sevenfincorp.email`) is NOT in webhook response
- ❌ `test@gmail.com` IS in webhook response (should be filtered)
- There's a gap between Airtable field names and filter conditions

---

## Issue: Field Name Mismatch

The filter might be checking wrong field names. Let's verify the exact Airtable field structure.

### Possible Issues:

1. **Field names have spaces**: `Account Status` vs `AccountStatus`
2. **Field names are different**: `Email` vs `Username`
3. **Case sensitivity**: Field names might be case-sensitive
4. **Field path wrong**: `$json.fields.Username` vs `$json.Username`

---

## Solution: Check Airtable Field Names

### Step 1: Verify Field Names in Airtable

Open Airtable "User Accounts" table and check exact field names:
- Is it `Username` or `Email`?
- Is it `Account Status` or `AccountStatus` or `Status`?
- Are there any extra spaces?

### Step 2: Update Filter to Match Exact Field Names

The filter must use the EXACT field names from Airtable.

---

## Quick Fix: Make Filter More Flexible

### Option 1: Use Multiple Field Name Variations

Update filter to check both possible field names:

**For Username:**
- Try: `$json.fields.Username`
- Or: `$json.fields.Email`
- Or: `$json.Username`
- Or: `$json.Email`

**For Account Status:**
- Try: `$json.fields['Account Status']`
- Or: `$json.fields.AccountStatus`
- Or: `$json.fields.Status`
- Or: `$json['Account Status']`

### Option 2: Remove Filter Temporarily

To test if filter is the issue:
1. Temporarily remove Filter node
2. Connect Airtable directly to Respond to Webhook
3. Test webhook - should return all accounts including Sagar
4. If Sagar appears, filter is the issue
5. If Sagar doesn't appear, Airtable node is the issue

---

## Debug: Check What Airtable Returns

### In n8n Workflow:

1. **Test Workflow**
2. **Check Airtable Node Output**:
   - What field names does it show?
   - Is Sagar's account in the output?
   - What is the exact structure?

3. **Check Filter Node Output**:
   - What data does it receive?
   - What data does it output?
   - Is Sagar's account filtered out?

---

## Updated Filter (Flexible Field Names)

Try this filter configuration that handles multiple field name variations:

```json
{
  "conditions": [
    {
      "leftValue": "={{ $json.fields.Username || $json.fields.Email || $json.Username || $json.Email }}",
      "rightValue": "test@",
      "operator": {"type": "string", "operation": "notContains"}
    },
    {
      "leftValue": "={{ $json.fields.Username || $json.fields.Email || $json.Username || $json.Email }}",
      "rightValue": "test",
      "operator": {"type": "string", "operation": "notContains"}
    },
    {
      "leftValue": "={{ $json.fields['Account Status'] || $json.fields.AccountStatus || $json.fields.Status || $json['Account Status'] }}",
      "rightValue": "Active",
      "operator": {"type": "string", "operation": "equals"}
    }
  ]
}
```

---

## Alternative: Check Airtable Node Configuration

The issue might be in the Airtable node:

1. **Check Fields Selected**:
   - Are `Username` and `Account Status` fields selected?
   - Are they spelled exactly as in Airtable?

2. **Check Field Mapping**:
   - Airtable might return fields differently
   - Check the actual output structure

---

## Test Steps

1. **Remove Filter Node Temporarily**:
   - Connect Airtable → Respond to Webhook
   - Test webhook
   - Check if Sagar appears

2. **If Sagar Appears**:
   - Filter is the issue
   - Check field names in filter conditions

3. **If Sagar Doesn't Appear**:
   - Airtable node is the issue
   - Check field selection
   - Check Airtable connection

---

**Check the exact field names in Airtable and match them in the filter!** 🔍
