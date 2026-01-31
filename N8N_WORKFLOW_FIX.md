# n8n Workflow Fix - Field Access Issue

## Current Workflow Structure

✅ **Workflow is correctly structured:**
```
Webhook31 → Airtable → Filter → Respond to Webhook32
```

✅ **Filter conditions are correct** - but there's a field access issue!

---

## 🔴 Issue: Field Access Path

### Current Filter (WRONG):
```javascript
$json.Username
$json['Account Status']
```

### Problem:
Airtable returns data in this format:
```json
{
  "id": "recXXXXXXXXXXXX",
  "fields": {
    "Username": "sagar@sevenfincorp.email",
    "Password": "...",
    "Role": "client",
    "Account Status": "Active",
    ...
  }
}
```

**Fields are nested inside `fields` object!**

---

## ✅ Fix: Update Filter Conditions

### Updated Filter Conditions:

**Condition 1: Exclude test@**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Contain"
- Right Value: `test@`

**Condition 2: Exclude dummy@**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Contain"
- Right Value: `dummy@`

**Condition 3: Exclude example.com**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Contain"
- Right Value: `example.com`

**Condition 4: Only Active accounts**
- Left Value: `={{ $json.fields['Account Status'] }}`
- Operation: "Equals"
- Right Value: `Active`

**Condition 5: Exclude "test" username**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Equal"
- Right Value: `test`

**Condition 6: Exclude "dummy" username**
- Left Value: `={{ $json.fields.Username }}`
- Operation: "Does Not Equal"
- Right Value: `dummy`

---

## 🔧 How to Fix in n8n

### Step 1: Open Filter Node
1. Go to n8n workflow editor
2. Click on "Filter Test Accounts" node

### Step 2: Update Each Condition
For each condition, change:
- `$json.Username` → `$json.fields.Username`
- `$json['Account Status']` → `$json.fields['Account Status']`

### Step 3: Test Workflow
1. Click "Test workflow"
2. Check output from Filter node
3. Verify test accounts are filtered out

### Step 4: Activate
1. Toggle "Active" switch
2. Save workflow

---

## 📋 Complete Updated Filter Configuration

```json
{
  "conditions": {
    "options": {
      "caseSensitive": false,
      "leftValue": "",
      "typeValidation": "strict"
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
```

---

## 🧪 Test After Fix

### Test 1: Check Webhook Response
```bash
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.'
```

**Expected**: Array of user objects with `fields` wrapper

### Test 2: Verify Filter Works
```bash
curl -s https://fixrrahul.app.n8n.cloud/webhook/useraccount | jq '.[] | select(.fields.Username | test("test|dummy"; "i"))'
```

**Expected**: Empty (no test accounts)

### Test 3: Test Login
```bash
curl -X POST https://seven-dash.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sagar@sevenfincorp.email","password":"pass@123"}' \
  -c cookies.txt
```

**Expected**: Success response with user data

---

## 📊 Airtable Response Format

### What Airtable Returns:
```json
[
  {
    "id": "recXXXXXXXXXXXX",
    "fields": {
      "Username": "sagar@sevenfincorp.email",
      "Password": "pass@123",
      "Role": "client",
      "Account Status": "Active",
      "Associated Profile": "Sagar"
    }
  },
  {
    "id": "recYYYYYYYYYYYY",
    "fields": {
      "Username": "test@example.com",
      "Password": "test123",
      "Role": "client",
      "Account Status": "Active"
    }
  }
]
```

### After Filter (Should Return):
```json
[
  {
    "id": "recXXXXXXXXXXXX",
    "fields": {
      "Username": "sagar@sevenfincorp.email",
      "Password": "pass@123",
      "Role": "client",
      "Account Status": "Active",
      "Associated Profile": "Sagar"
    }
  }
]
```

**Note**: Test account is filtered out ✅

---

## 🔍 Alternative: Flatten Fields in n8n

If you prefer to keep current filter conditions, you can add a "Set" node to flatten:

**Add Set Node** between Airtable and Filter:
- Operation: "Keep Only Set Fields"
- Fields to Set:
  - `Username`: `={{ $json.fields.Username }}`
  - `Password`: `={{ $json.fields.Password }}`
  - `Role`: `={{ $json.fields.Role }}`
  - `Account Status`: `={{ $json.fields['Account Status'] }}`
  - `Associated Profile`: `={{ $json.fields['Associated Profile'] }}`
  - `id`: `={{ $json.id }}`

Then your current filter conditions will work!

---

## ✅ Summary

**Issue**: Filter uses `$json.Username` but Airtable returns `$json.fields.Username`

**Fix**: Update all filter conditions to use `$json.fields.*`

**Quick Fix**: Change 6 conditions in Filter node:
- `$json.Username` → `$json.fields.Username`
- `$json['Account Status']` → `$json.fields['Account Status']`

**After Fix**: Webhook will return filtered data, login will work! 🚀
