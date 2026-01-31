# Filter Issue: test@gmail.com Not Being Filtered

## Problem

The webhook is returning `test@gmail.com` instead of filtering it out. This means the filter conditions are not working correctly.

---

## Why test@gmail.com is NOT Being Filtered

### Current Filter Conditions:
1. Username does NOT contain "test@" ❌
2. Username does NOT contain "dummy@" ✅
3. Username does NOT contain "example.com" ❌
4. Account Status equals "Active" ✅
5. Username is NOT "test" ✅
6. Username is NOT "dummy" ✅

### Issue:
`test@gmail.com` contains `test@` but the filter condition checks for "test@" - this should work, but there might be:
- Case sensitivity issue
- Field path issue
- Filter not executing

---

## Quick Fix

### Option 1: Add More Test Patterns

Add these additional conditions to the filter:

**Condition 7: Exclude "test" anywhere in email**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Contain"
- Right Value: `test` (without @)

**Condition 8: Exclude emails ending in .com with test**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Contain"
- Right Value: `@gmail.com` (if you want to exclude all gmail test accounts)

### Option 2: Use Airtable Formula Filter

Instead of Filter node, use Airtable's built-in filter:

In Airtable node, add to "Filter By Formula":
```
AND(
  NOT(FIND("test@", {Username})),
  NOT(FIND("dummy@", {Username})),
  NOT(FIND("example.com", {Username})),
  {Account Status} = "Active",
  {Username} != "test",
  {Username} != "dummy"
)
```

---

## Updated Filter JSON

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": false,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 1
      },
      "conditions": [
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "test@",
          "operator": {
            "type": "string",
            "operation": "notContains"
          }
        },
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "test",
          "operator": {
            "type": "string",
            "operation": "notContains"
          }
        },
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "dummy@",
          "operator": {
            "type": "string",
            "operation": "notContains"
          }
        },
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "example.com",
          "operator": {
            "type": "string",
            "operation": "notContains"
          }
        },
        {
          "leftValue": "={{ $json.fields['Account Status'] }}",
          "rightValue": "Active",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        },
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "test",
          "operator": {
            "type": "string",
            "operation": "notEquals"
          }
        },
        {
          "leftValue": "={{ $json.fields.Username }}",
          "rightValue": "dummy",
          "operator": {
            "type": "string",
            "operation": "notEquals"
          }
        }
      ],
      "combinator": "and"
    }
  }
}
```

**Key Change**: Added condition to check if Username contains "test" (not just "test@")

---

## Test After Fix

```bash
# Should NOT return test@gmail.com
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.fields.Username | test("test"; "i"))'

# Should return sagar@sevenfincorp.email
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.fields.Username == "sagar@sevenfincorp.email")'
```

---

**The filter needs to check for "test" anywhere in the email, not just "test@" at the start!** 🔧
