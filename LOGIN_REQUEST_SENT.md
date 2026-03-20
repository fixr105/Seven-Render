# Login Request Sent - Field Mapping

## ✅ Request Sent

### Command
```bash
curl -X POST https://seven-render.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sagar@sevenfincorp.email",
    "password": "pass@123"
  }'
```

### Request Body
```json
{
  "email": "sagar@sevenfincorp.email",
  "password": "pass@123"
}
```

---

## Current Response

```json
{
  "success": false,
  "error": "Authentication service temporarily unavailable. Please try again later."
}
```

**Status**: HTTP 503

**Reason**: n8n webhook filter is not working because it's using wrong field paths.

---

## 🔧 Issue: Filter Field Paths

### Current (WRONG):
```javascript
$json.Username           // ❌ Fields are nested
$json['Account Status']  // ❌ Fields are nested
```

### Should Be (CORRECT):
```javascript
$json.fields.Username           // ✅ Correct path
$json.fields['Account Status']  // ✅ Correct path
```

---

## Field Mapping Reference

### Request → Airtable
| Request Field | Airtable Field Path | Example |
|---------------|---------------------|---------|
| `email` | `fields.Username` | `"sagar@sevenfincorp.email"` |
| `password` | `fields.Password` | `"pass@123"` |

### Airtable → Response
| Airtable Field Path | Response Field | Example |
|---------------------|----------------|---------|
| `id` | `user.id` | `"recXXXXXXXXXXXX"` |
| `fields.Username` | `user.email` | `"sagar@sevenfincorp.email"` |
| `fields.Role` | `user.role` | `"client"` |
| `fields['Account Status']` | Validation | Must be `"Active"` |
| `fields['Associated Profile']` | `user.name` | `"Sagar"` |

---

## Expected Response (After Fix)

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

**Cookie**: `auth_token=<JWT>` (set automatically)

---

## Quick Fix

Update Filter node conditions:
- `$json.Username` → `$json.fields.Username`
- `$json['Account Status']` → `$json.fields['Account Status']`

**See**: `QUICK_FIX_N8N_FILTER.md` for step-by-step instructions

**Or Import**: `n8n-useraccount-webhook-FIXED.json` (already fixed)

---

**Login request sent! Fix the filter field paths and it will work!** 🚀
