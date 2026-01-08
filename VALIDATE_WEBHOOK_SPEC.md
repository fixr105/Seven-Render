# Validate Webhook Specification for Login

## Webhook Details

### URL
```
POST {N8N_BASE_URL}/webhook/validate
```

**Example:**
```
POST https://fixrrahul.app.n8n.cloud/webhook/validate
```

### Request Payload
```json
{
  "username": "string",
  "passcode": "string"
}
```

**Example:**
```json
{
  "username": "Sagar",
  "passcode": "password123"
}
```

## Expected Response Formats

The backend accepts **three different response formats**. The webhook can return any of these:

### Format 1: Array with Output Field (Preferred)
```json
[
  {
    "output": "{\"username\": \"Sagar\", \"role\": \"kam\", \"Associated profile\": \"Sagar\"}"
  }
]
```

The `output` field contains a **JSON string** that needs to be parsed. After parsing, it should contain:
- `username`: The user's username
- `role`: User role (`kam`, `client`, `credit_team`, `nbfc`)
- `Associated profile`: The user's display name

### Format 2: Direct Object with Success/User Fields
```json
{
  "success": true,
  "user": {
    "username": "Sagar",
    "role": "kam",
    "name": "Sagar",
    "email": "sagar@example.com"
  }
}
```

### Format 3: Direct Object with User Fields
```json
{
  "username": "Sagar",
  "role": "kam",
  "Associated profile": "Sagar",
  "email": "sagar@example.com"
}
```

## Required Fields

After parsing, the backend expects at least one of:
- `username` OR `email` - User identifier
- `role` - User role (will be normalized to: `kam`, `client`, `credit_team`, `nbfc`)

Optional but recommended:
- `Associated profile` OR `name` - User's display name
- `id` - User ID
- `clientId` - If role is `client`
- `kamId` - If role is `kam`
- `nbfcId` - If role is `nbfc`

## Response Status Codes

- **200 OK**: Validation successful (returns one of the formats above)
- **401 Unauthorized**: Invalid username or passcode
- **500 Internal Server Error**: Server error

## Role Mapping

The backend normalizes roles as follows:
- `kam` → `kam`
- `client` → `client`
- `credit_team` or `credit team` → `credit_team`
- `nbfc` → `nbfc`
- Any other value → defaults to `client`

## Example n8n Workflow

Your n8n workflow should:

1. **Webhook Trigger Node**
   - Method: `POST`
   - Path: `validate`
   - Receives: `{username, passcode}`

2. **Airtable Search Node**
   - Search for user by `username` (case-insensitive)
   - Get user's role and profile information

3. **Code/Function Node** (Optional)
   - Format the response in one of the accepted formats
   - Clean any markdown wrapping if using AI agent

4. **Respond to Webhook Node**
   - Return the formatted JSON response
   - Status: 200 for success, 401 for invalid credentials

## Testing

Test the webhook directly:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

Expected successful response (Format 1):
```json
[
  {
    "output": "{\"username\": \"test\", \"role\": \"client\", \"Associated profile\": \"Test User\"}"
  }
]
```

## Notes

- The webhook must be **activated** in n8n for it to work
- The webhook should respond within **45 seconds** (backend timeout)
- If the webhook returns an error or invalid format, login will fail
- The backend will log all webhook calls and responses for debugging
