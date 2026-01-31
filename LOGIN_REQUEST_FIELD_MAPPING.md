# Login Request Field Mapping

## Sample Login Request

### Request Details
- **Endpoint**: `POST /api/auth/login`
- **Email**: `sagar@sevenfincorp.email`
- **Password**: `pass@123`

### Request Format
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

---

## Field Mapping Flow

### 1. Frontend → Backend Request
```json
{
  "email": "sagar@sevenfincorp.email",
  "password": "pass@123"
}
```

**Fields**:
- `email` → User's email address
- `password` → User's password (plaintext)

### 2. Backend → n8n Webhook Request
```http
GET https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**No body** - Webhook returns all user accounts

### 3. n8n → Airtable Query
- **Base**: "Seven Dashboard"
- **Table**: "User Accounts"
- **Operation**: Search/List all records
- **Fields Retrieved**:
  - `Username` (maps to email)
  - `Password` (hashed or plaintext)
  - `Role` (client, kam, credit_team, nbfc)
  - `Account Status` (Active, Locked, Disabled)
  - `Associated Profile` (user's name)
  - `Last Login` (timestamp)
  - `id` (Airtable record ID)

### 4. Backend Processing
1. **Fetch User Accounts** from n8n webhook
2. **Filter Test Accounts** (backend filter)
3. **Find User** by matching `email` with `Username` field
4. **Validate Account Status** = "Active"
5. **Validate Password** (compare with `Password` field)
6. **Resolve Profile IDs**:
   - If Role = "client" → Fetch from Clients table → set `clientId`
   - If Role = "kam" → Fetch from KAM Users table → set `kamId`
   - If Role = "credit_team" → Fetch from Credit Team Users table → set `creditTeamId`
   - If Role = "nbfc" → Fetch from NBFC Partners table → set `nbfcId`
7. **Generate JWT Token** with all profile IDs
8. **Set HTTP-only Cookie** with token

### 5. Backend → Frontend Response
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

**Cookie Set**:
- Name: `auth_token`
- Value: JWT token (not in response body)
- HttpOnly: true
- Secure: true (production)
- SameSite: strict
- MaxAge: 7 days

---

## Airtable Field Mappings

### User Accounts Table Fields

| Airtable Field | Backend Field | Usage |
|----------------|---------------|-------|
| `Username` | `email` | Matched against login email |
| `Password` | `password` | Validated against login password |
| `Role` | `role` | Determines user permissions |
| `Account Status` | - | Must be "Active" to login |
| `Associated Profile` | `name` | User's display name |
| `Last Login` | - | Updated after successful login |
| `id` | `id` | User's unique identifier |

### Profile Tables (Role-Specific)

#### Clients Table (for Role = "client")
- `Client ID` → `clientId`
- `Client Name` → `name`

#### KAM Users Table (for Role = "kam")
- `KAM ID` → `kamId`
- `Name` → `name`
- `Email` → matched with login email

#### Credit Team Users Table (for Role = "credit_team")
- `Credit Team ID` → `creditTeamId`
- `Name` → `name`
- `Email` → matched with login email

#### NBFC Partners Table (for Role = "nbfc")
- `id` → `nbfcId`
- `Lender Name` → `name`
- `Contact Email/Phone` → matched with login email

---

## Response Structure

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

### Error Response
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

## Cookie Details

After successful login, browser automatically receives:

```
Set-Cookie: auth_token=<JWT_TOKEN>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

**JWT Token Contains**:
```json
{
  "userId": "recXXXXXXXXXXXX",
  "email": "sagar@sevenfincorp.email",
  "role": "client",
  "name": "Sagar",
  "clientId": "recYYYYYYYYYYYY",
  "kamId": null,
  "nbfcId": null,
  "creditTeamId": null,
  "iat": 1234567890,
  "exp": 1235173890
}
```

---

## Field Mapping Summary

### Input Fields
- `email` (from login form)
- `password` (from login form)

### Airtable Fields (User Accounts)
- `Username` → matched with `email`
- `Password` → validated against `password`
- `Role` → used for RBAC
- `Account Status` → must be "Active"
- `Associated Profile` → used as `name`
- `id` → used as user `id`

### Output Fields
- `id` → from Airtable record ID
- `email` → from `Username` field
- `role` → from `Role` field
- `name` → from `Associated Profile` or profile table
- `clientId` → from Clients table (if role = client)
- `kamId` → from KAM Users table (if role = kam)
- `creditTeamId` → from Credit Team Users table (if role = credit_team)
- `nbfcId` → from NBFC Partners table (if role = nbfc)

---

## Testing the Login

Run this command to test:

```bash
curl -X POST https://seven-dash.fly.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sagar@sevenfincorp.email","password":"pass@123"}' \
  -c cookies.txt \
  -v
```

Check response and cookies file for:
- Response JSON with user data
- Cookie file with `auth_token`
