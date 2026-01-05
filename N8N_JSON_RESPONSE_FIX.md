# Fix: Invalid JSON in Response Body Field

## Problem
Getting error: "Invalid JSON in 'Response Body' field"

This usually means:
- Extra quotes or escaping issues
- Missing commas
- Invalid JSON syntax

## Solution: Use This Exact JSON

Copy and paste this **EXACTLY** into the Response Body field (no modifications):

```json
{
  "success": true,
  "user": {
    "id": "test-user-123",
    "email": "test@example.com",
    "username": "test",
    "role": "client",
    "name": "Test User"
  }
}
```

## Step-by-Step

1. **Click on Respond to Webhook node**
2. **Find "Response Body" field**
3. **Select "JSON" from dropdown** (if there's a dropdown)
4. **Paste the JSON above** into the field
5. **Make sure:**
   - No extra quotes around the JSON
   - No backslashes before quotes
   - Proper indentation (or no indentation - both work)
   - All quotes are straight quotes (") not curly quotes (")

6. **Click Save** on the node
7. **Save the workflow**

## Alternative: Use Code Node (Easier)

If JSON keeps causing issues, use a Code node instead:

1. **Delete Respond to Webhook node**
2. **Add Code node** after Webhook
3. **Paste this in Code node:**
   ```javascript
   return {
     json: {
       success: true,
       user: {
         id: "test-user-123",
         email: "test@example.com",
         username: "test",
         role: "client",
         name: "Test User"
       }
     }
   };
   ```
4. **In Webhook node**, set:
   - **Response Mode**: `Last Node`
   - **Response Code**: `200`
5. **Save workflow**

## Common JSON Errors

### ❌ Wrong (with extra quotes):
```
"{ \"success\": true }"
```

### ✅ Correct:
```json
{
  "success": true
}
```

### ❌ Wrong (curly quotes):
```
{ "success": true }
```

### ✅ Correct (straight quotes):
```json
{
  "success": true
}
```

## Minimal Test JSON

If the full JSON doesn't work, try this minimal version first:

```json
{
  "success": true
}
```

Once that works, add the user object:

```json
{
  "success": true,
  "user": {
    "id": "test-123",
    "email": "test@example.com",
    "role": "client"
  }
}
```

## Verify JSON is Valid

Before saving, n8n should validate the JSON. If you see red error text, check:
- All opening `{` have closing `}`
- All opening `[` have closing `]`
- All strings are in quotes `"string"`
- Commas between properties (not after last one)
- No trailing commas

## Test After Fixing

```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "test-user-123",
    "email": "test@example.com",
    "username": "test",
    "role": "client",
    "name": "Test User"
  }
}
```

