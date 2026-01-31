# Sample Login Request & Response - Field Mapping

## Request Sent

### Command
```bash
curl -X POST https://seven-dash.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sagar@sevenfincorp.email",
    "password": "pass@123"
  }' \
  -c cookies.txt \
  -v
```

### Request Body
```json
{
  "email": "sagar@sevenfincorp.email",
  "password": "pass@123"
}
```

---

## Current Response (Error)

### HTTP Status
```
HTTP/2 503 Service Unavailable
```

### Response Body
```json
{
  "success": false,
  "error": "Authentication service temporarily unavailable. Please try again later."
}
```

### Why This Error?
The n8n webhook at `https://fixrrahul.app.n8n.cloud/webhook/useraccount` is returning an empty response, causing the backend to fail.

---

## Expected Response (When Working)

### Success Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "recXXXXXXXXXXXX",
      "email": "sagar@sevenfincorp.email",
      "role": "client",
      "name": "Sagar",
      "clientId": "recYYYYYYYYYYYY",
      "kamId": null,
      "nbfcId": null,
      "creditTeamId": null
    }
  }
}
```

### HTTP Headers (Cookie Set)
```
Set-Cookie: auth_token=<JWT_TOKEN>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

## Field Mapping Flow

### 1. Frontend Input → Backend Request
```
email: "sagar@sevenfincorp.email"
password: "pass@123"
```

### 2. Backend → n8n Webhook
```
GET https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected Response from n8n:**
```json
[
  {
    "id": "recXXXXXXXXXXXX",
    "Username": "sagar@sevenfincorp.email",
    "Password": "$2a$10$...",  // or plaintext
    "Role": "client",
    "Account Status": "Active",
    "Associated Profile": "Sagar",
    "Last Login": "",
    ...
  },
  ...
]
```

### 3. Backend Processing

**Step 1: Find User**
- Match `email` ("sagar@sevenfincorp.email") with `Username` field in Airtable

**Step 2: Validate**
- Check `Account Status` = "Active"
- Compare `password` ("pass@123") with `Password` field

**Step 3: Resolve Profile**
- If `Role` = "client":
  - Fetch from Clients table
  - Match by email or name
  - Set `clientId` from `Client ID` field
  - Set `name` from `Client Name` field

**Step 4: Generate Response**
```json
{
  "id": "recXXXXXXXXXXXX",           // from User Accounts.id
  "email": "sagar@sevenfincorp.email", // from User Accounts.Username
  "role": "client",                    // from User Accounts.Role
  "name": "Sagar",                     // from Clients.Client Name or User Accounts.Associated Profile
  "clientId": "recYYYYYYYYYYYY",       // from Clients.Client ID
  "kamId": null,
  "nbfcId": null,
  "creditTeamId": null
}
```

---

## Airtable Field Mapping

### User Accounts Table

| Airtable Field | Backend Uses | Example Value |
|----------------|--------------|--------------|
| `Username` | Matches with login `email` | `sagar@sevenfincorp.email` |
| `Password` | Validates against login `password` | `$2a$10$...` or `pass@123` |
| `Role` | Sets user `role` | `client`, `kam`, `credit_team`, `nbfc` |
| `Account Status` | Must be "Active" | `Active`, `Locked`, `Disabled` |
| `Associated Profile` | Used as `name` (fallback) | `Sagar` |
| `Last Login` | Updated after login | `2026-01-29T10:15:20Z` |
| `id` | Used as user `id` | `recXXXXXXXXXXXX` |

### Clients Table (for Role = "client")

| Airtable Field | Backend Uses | Example Value |
|----------------|--------------|--------------|
| `Client ID` | Sets `clientId` | `recYYYYYYYYYYYY` |
| `Client Name` | Sets `name` | `Sagar` |
| `Contact Email / Phone` | Matched with login email | `sagar@sevenfincorp.email` |

---

## Complete Data Flow

```
1. User enters:
   email: "sagar@sevenfincorp.email"
   password: "pass@123"

2. Frontend sends:
   POST /api/auth/login
   {
     "email": "sagar@sevenfincorp.email",
     "password": "pass@123"
   }

3. Backend fetches from n8n:
   GET /webhook/useraccount
   → Returns array of all user accounts

4. Backend finds user:
   Match: email === Username
   Found: {
     id: "recXXXXXXXXXXXX",
     Username: "sagar@sevenfincorp.email",
     Password: "pass@123",
     Role: "client",
     Account Status: "Active"
   }

5. Backend validates:
   ✅ Account Status = "Active"
   ✅ Password matches

6. Backend fetches profile (if Role = "client"):
   GET /webhook/clients
   → Find matching client
   → Extract Client ID and Client Name

7. Backend generates JWT:
   {
     userId: "recXXXXXXXXXXXX",
     email: "sagar@sevenfincorp.email",
     role: "client",
     name: "Sagar",
     clientId: "recYYYYYYYYYYYY",
     ...
   }

8. Backend responds:
   {
     "success": true,
     "data": {
       "user": { ... }
     }
   }
   + Sets cookie: auth_token=<JWT>

9. Frontend receives:
   - User data in response body
   - Cookie automatically stored by browser
```

---

## Current Issue

**Problem**: n8n webhook returns empty response

**Solution**: 
1. Check n8n workflow configuration
2. Verify Airtable connection
3. Test workflow in n8n editor
4. Ensure workflow is active

**Test n8n webhook**:
```bash
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected**: Should return JSON array of user accounts
**Current**: Returns empty (causing 503 error)

---

## Field Mapping Summary

### Input → Airtable
- `email` → Matches `Username` field
- `password` → Validates against `Password` field

### Airtable → Output
- `id` → `user.id`
- `Username` → `user.email`
- `Role` → `user.role`
- `Associated Profile` → `user.name` (fallback)
- `Account Status` → Validation (must be "Active")

### Profile Tables → Output
- `Client ID` → `user.clientId` (if role = client)
- `Client Name` → `user.name` (if role = client)
- `KAM ID` → `user.kamId` (if role = kam)
- `Credit Team ID` → `user.creditTeamId` (if role = credit_team)
- `id` (NBFC) → `user.nbfcId` (if role = nbfc)

---

## Next Steps

1. **Fix n8n Webhook**:
   - Open workflow in n8n
   - Test workflow
   - Verify Airtable connection
   - Ensure it returns data

2. **Test Login Again**:
   ```bash
   curl -X POST https://seven-dash.fly.dev/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"sagar@sevenfincorp.email","password":"pass@123"}' \
     -c cookies.txt \
     -v
   ```

3. **Verify Response**:
   - Should return user data
   - Should set cookie
   - Should include profile IDs

---

**The login request structure is correct. The issue is the n8n webhook not returning data. Fix the n8n workflow and the login will work!** 🔧
