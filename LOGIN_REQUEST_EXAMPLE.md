# Login Request Example - Field Mapping Reference

## Sample Login Request

### Request
```bash
curl -X POST https://seven-dash.fly.dev/api/auth/login \
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

## Field Mapping

### Frontend → Backend
| Frontend Field | Backend Field | Airtable Field | Notes |
|----------------|---------------|----------------|-------|
| `email` | `email` | `Username` | Matched case-insensitively |
| `password` | `password` | `Password` | Validated (supports bcrypt or plaintext) |

### Airtable → Response
| Airtable Field | Response Field | Example |
|----------------|----------------|---------|
| `id` | `user.id` | `"recXXXXXXXXXXXX"` |
| `Username` | `user.email` | `"sagar@sevenfincorp.email"` |
| `Role` | `user.role` | `"client"` |
| `Associated Profile` | `user.name` | `"Sagar"` (fallback) |
| `Account Status` | - | Must be `"Active"` |

### Profile Tables → Response
| Role | Table | Airtable Field | Response Field |
|------|-------|----------------|----------------|
| `client` | Clients | `Client ID` | `user.clientId` |
| `client` | Clients | `Client Name` | `user.name` |
| `kam` | KAM Users | `KAM ID` | `user.kamId` |
| `kam` | KAM Users | `Name` | `user.name` |
| `credit_team` | Credit Team Users | `Credit Team ID` | `user.creditTeamId` |
| `credit_team` | Credit Team Users | `Name` | `user.name` |
| `nbfc` | NBFC Partners | `id` | `user.nbfcId` |
| `nbfc` | NBFC Partners | `Lender Name` | `user.name` |

---

## Expected Response (When n8n is Working)

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

**Cookie Set** (automatically):
```
Set-Cookie: auth_token=<JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict
```

---

## Current Issue

**Error**: `503 - Authentication service temporarily unavailable`

**Cause**: n8n webhook returns empty response

**Fix**: Update n8n workflow to return user accounts data

---

Use this as a reference for field mapping! 📋
