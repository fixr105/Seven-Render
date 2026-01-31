# Debug: Field Name Mismatch Issue

## Problem

- ❌ Sagar's account filtered out (not sent to webhook)
- ❌ test@gmail.com passed through (should be filtered)
- Gap between Airtable field names and filter conditions

---

## Root Cause: Field Name Mismatch

The filter is checking field names that don't match what Airtable actually returns.

### Expected Field Names (from backend):
- `Username` (not `Email`)
- `Account Status` (with space, not `AccountStatus`)

### But Airtable Might Return:
- `Email` instead of `Username`
- `AccountStatus` instead of `Account Status`
- Or fields at root level, not in `fields` object

---

## Solution: Check What Airtable Actually Returns

### Step 1: Test Airtable Node in n8n

1. Open workflow in n8n
2. Click **"Test workflow"**
3. Check **Airtable node output**
4. **Copy the exact structure** - what does it look like?

### Step 2: Compare with Filter

Check if filter field paths match Airtable output:

**If Airtable returns:**
```json
{
  "fields": {
    "Email": "...",  // Not "Username"!
    "Status": "..."  // Not "Account Status"!
  }
}
```

**Then filter should use:**
- `$json.fields.Email` (not `$json.fields.Username`)
- `$json.fields.Status` (not `$json.fields['Account Status']`)

---

## Quick Fix: Update Filter to Match Airtable

Based on what you see in Airtable node output, update filter:

### If Field is "Email" not "Username":
Change all filter conditions from:
- `$json.fields.Username` → `$json.fields.Email`

### If Field is "Status" not "Account Status":
Change condition from:
- `$json.fields['Account Status']` → `$json.fields.Status`

### If Fields are at Root Level:
Change from:
- `$json.fields.Username` → `$json.Username`
- `$json.fields['Account Status']` → `$json['Account Status']`

---

## Test: Remove Filter Temporarily

To verify Airtable is returning Sagar:

1. **Remove Filter node** temporarily
2. **Connect**: Airtable → Respond to Webhook
3. **Test webhook**: `curl https://fixrrahul.app.n8n.cloud/webhook/useraccount`
4. **Check**: Does Sagar appear?

**If YES**: Filter field names are wrong
**If NO**: Airtable node isn't fetching Sagar (different issue)

---

## Updated Filter (Based on Common Issues)

Try this filter that handles multiple field name variations:

```json
{
  "conditions": [
    {
      "leftValue": "={{ ($json.fields.Username || $json.fields.Email || $json.Username || $json.Email || '').toString() }}",
      "rightValue": "test@",
      "operator": {"type": "string", "operation": "notContains"}
    },
    {
      "leftValue": "={{ ($json.fields.Username || $json.fields.Email || $json.Username || $json.Email || '').toString() }}",
      "rightValue": "test",
      "operator": {"type": "string", "operation": "notContains"}
    },
    {
      "leftValue": "={{ ($json.fields['Account Status'] || $json.fields.AccountStatus || $json.fields.Status || $json['Account Status'] || $json.AccountStatus || '').toString() }}",
      "rightValue": "Active",
      "operator": {"type": "string", "operation": "equals"}
    }
  ]
}
```

---

## Action Required

1. **Test workflow in n8n**
2. **Check Airtable node output** - what are the exact field names?
3. **Update filter** to match those exact field names
4. **Test again**

---

**Check the Airtable node output to see the exact field names, then update the filter to match!** 🔍
