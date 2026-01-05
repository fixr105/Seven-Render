# n8n AI Agent Prompt for User Validation

## System Prompt for AI Agent

```
You are a user authentication agent. Your task is to validate user credentials and return user information in a specific JSON format.

## Your Task:
1. Receive username and passcode from the webhook request
2. Validate the credentials against the Airtable database
3. Return user information in the exact JSON format specified below

## Input:
You will receive:
- username: string (from webhook body)
- passcode: string (from webhook body)
- Airtable user records (from Airtable tool)

## Validation Logic:
1. Search Airtable for a user where:
   - Username field matches the provided username (case-insensitive)
   - Password/Passcode field matches the provided passcode
2. If credentials are valid:
   - Return success response with user data
3. If credentials are invalid:
   - Return error response

## Output Format (STRICT - Must match exactly):

### Success Response:
```json
{
  "success": true,
  "user": {
    "id": "<airtable_record_id>",
    "email": "<user_email>",
    "username": "<username>",
    "role": "<user_role>",
    "clientId": "<client_id_if_exists>",
    "kamId": "<kam_id_if_exists>",
    "nbfcId": "<nbfc_id_if_exists>",
    "name": "<user_name>"
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

## Important Rules:
1. ALWAYS return valid JSON in the exact format above
2. Use the Airtable record ID for the "id" field
3. Map Airtable fields to response fields:
   - Airtable "Email" → response "email"
   - Airtable "Username" → response "username"
   - Airtable "Role" → response "role"
   - Airtable "Client ID" or "ClientId" → response "clientId"
   - Airtable "KAM ID" or "KAMId" → response "kamId"
   - Airtable "NBFC ID" or "NBFCId" → response "nbfcId"
   - Airtable "Name" → response "name"
4. If any field is missing in Airtable, use null or empty string
5. Password comparison should be case-sensitive
6. Username comparison should be case-insensitive

## Example Airtable Record:
{
  "id": "recABC123",
  "fields": {
    "Username": "john.doe",
    "Email": "john@example.com",
    "Password": "secret123",
    "Role": "client",
    "Name": "John Doe",
    "Client ID": "client-001"
  }
}

## Example Success Response:
{
  "success": true,
  "user": {
    "id": "recABC123",
    "email": "john@example.com",
    "username": "john.doe",
    "role": "client",
    "clientId": "client-001",
    "kamId": null,
    "nbfcId": null,
    "name": "John Doe"
  }
}
```

## User Prompt (Optional - for additional context)

```
Validate the user credentials and return the response in the specified JSON format.

Username: {{ $json.body.username }}
Passcode: {{ $json.body.passcode }}

Use the Airtable data to find the matching user and validate the credentials.
```

## Output Parser Configuration

### JSON Schema for Output Parser:
```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean",
      "description": "Whether the validation was successful"
    },
    "user": {
      "type": "object",
      "description": "User information (only present if success is true)",
      "properties": {
        "id": {
          "type": "string",
          "description": "Airtable record ID"
        },
        "email": {
          "type": "string",
          "description": "User email address"
        },
        "username": {
          "type": "string",
          "description": "Username"
        },
        "role": {
          "type": "string",
          "description": "User role: client, kam, credit_team, or nbfc",
          "enum": ["client", "kam", "credit_team", "nbfc"]
        },
        "clientId": {
          "type": "string",
          "description": "Client ID if user is a client",
          "nullable": true
        },
        "kamId": {
          "type": "string",
          "description": "KAM ID if user is a KAM",
          "nullable": true
        },
        "nbfcId": {
          "type": "string",
          "description": "NBFC ID if user is an NBFC",
          "nullable": true
        },
        "name": {
          "type": "string",
          "description": "User's full name",
          "nullable": true
        }
      },
      "required": ["id", "email", "username", "role"]
    },
    "error": {
      "type": "string",
      "description": "Error message (only present if success is false)"
    }
  },
  "required": ["success"],
  "oneOf": [
    {
      "properties": {
        "success": { "const": true }
      },
      "required": ["user"]
    },
    {
      "properties": {
        "success": { "const": false }
      },
      "required": ["error"]
    }
  ]
}
```

## Workflow Structure

```
[Webhook] 
  └─> [Airtable: List Records] (Search for user by username)
      └─> [AI Agent] (Validate credentials and format response)
          └─> [Respond to Webhook] (Return JSON response)
```

## Airtable Configuration

### Node: Airtable - List Records
- **Base**: Your Airtable base
- **Table**: User Accounts (or your user table name)
- **Filter By Formula**: `{Username} = LOWER("{{ $json.body.username }}")`
- **Return All**: Yes (or limit to 1)

### Node: AI Agent
- **Model**: GPT-4, Claude, or your preferred model
- **System Prompt**: Use the system prompt above
- **User Prompt**: Use the user prompt above
- **Tools**: Airtable (for additional lookups if needed)
- **Output Parser**: JSON Schema (use the schema above)
- **Temperature**: 0 (for consistent output)

### Node: Respond to Webhook
- **Response Body**: `={{ $json }}` (from AI Agent output)
- **Response Code**: 200

## Alternative: Without AI Agent (Direct Logic)

If you prefer not to use AI, you can use n8n's built-in nodes:

```
[Webhook]
  └─> [Airtable: List Records] (Search user)
      └─> [IF Node] (Check if user exists and password matches)
          ├─> [True] → [Set Node] (Format success response)
          └─> [False] → [Set Node] (Format error response)
              └─> [Respond to Webhook]
```

## Testing

Test with:
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
    "id": "rec...",
    "email": "test@example.com",
    "username": "test",
    "role": "client",
    "name": "Test User"
  }
}
```

