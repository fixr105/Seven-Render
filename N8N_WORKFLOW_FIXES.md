# Fixes for Your n8n Workflow

## Issues Found

1. **Code Node has corrupted JavaScript** - contains text that shouldn't be there
2. **Code Node regex is wrong** - `/on\s*/g` should be `/```json\s*/g`
3. **Airtable tool only returns 2 fields** - needs Username, Email, Password, etc.
4. **Output parser schema too strict** - email validation fails on error responses

## Fix 1: Code Node JavaScript

Replace the Code node content with this clean version:

```javascript
// Get AI output
const aiOutput = $input.item.json;

// Extract JSON from markdown if present
let jsonString = '';

if (aiOutput.output) {
  // If wrapped in markdown code blocks
  jsonString = aiOutput.output
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
} else if (typeof aiOutput === 'string') {
  jsonString = aiOutput
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
} else {
  // Already JSON object
  return { json: aiOutput };
}

// Parse JSON
try {
  const parsed = JSON.parse(jsonString);
  
  // Validate and format response
  if (parsed.success === true && parsed.user) {
    return {
      json: {
        success: true,
        user: {
          id: parsed.user.id || '',
          email: parsed.user.email || null,
          username: parsed.user.username || '',
          role: parsed.user.role || 'client',
          clientId: parsed.user.clientId || null,
          kamId: parsed.user.kamId || null,
          nbfcId: parsed.user.nbfcId || null,
          name: parsed.user.name || null
        }
      }
    };
  } else {
    return {
      json: {
        success: false,
        error: parsed.error || 'Invalid username or passcode'
      }
    };
  }
} catch (error) {
  return {
    json: {
      success: false,
      error: "Failed to parse AI response: " + error.message
    }
  };
}
```

## Fix 2: Airtable Tool Configuration

Update the Airtable tool to return ALL necessary fields:

1. **In "Search records in Airtable" node**:
   - **Operation**: Keep as `search`
   - **Fields to return**: Add ALL these fields:
     - `Username`
     - `Email`
     - `Password` (or `Passcode` - whatever your field is named)
     - `Role`
     - `Name`
     - `Client ID` (or `ClientId`)
     - `KAM ID` (or `KAMId`)
     - `NBFC ID` (or `NBFCId`)
     - `Associated Profile`
   - **Query/Filter**: The AI agent should search by username, but you can also add a filter formula if needed

2. **Better: Use List Records with Filter**:
   - Change operation to `list`
   - **Filter By Formula**: `LOWER({Username}) = LOWER("{{ $json.body.username }}")`
   - Return all necessary fields

## Fix 3: Update Output Parser Schema

In the AI Agent node, update the output parser JSON schema to:

```json
{
  "type": "object",
  "properties": {
    "success": {
      "type": "boolean"
    },
    "user": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "email": {
          "type": "string",
          "nullable": true
        },
        "username": {
          "type": "string"
        },
        "role": {
          "type": "string",
          "enum": ["client", "kam", "credit_team", "nbfc"]
        },
        "clientId": {
          "type": "string",
          "nullable": true
        },
        "kamId": {
          "type": "string",
          "nullable": true
        },
        "nbfcId": {
          "type": "string",
          "nullable": true
        },
        "name": {
          "type": "string",
          "nullable": true
        }
      },
      "required": ["id", "username", "role"]
    },
    "error": {
      "type": "string"
    }
  },
  "required": ["success"],
  "oneOf": [
    {
      "properties": {
        "success": {
          "const": true
        }
      },
      "required": ["user"]
    },
    {
      "properties": {
        "success": {
          "const": false
        }
      },
      "required": ["error"]
    }
  ]
}
```

**Key changes:**
- `email` is now `nullable: true` and NOT in required fields
- Removed email format validation
- Only `id`, `username`, and `role` are required in user object

## Fix 4: Update AI Agent Prompt

Add this to the system prompt to make it clearer:

```
CRITICAL VALIDATION RULES:
1. Use the Airtable tool to search for the user by username (case-insensitive)
2. Compare the password/passcode from the request with the Password field in Airtable (case-sensitive)
3. If username NOT found → return {"success": false, "error": "Invalid username or passcode"}
4. If username found but password doesn't match → return {"success": false, "error": "Invalid username or passcode"}
5. Only return user object when BOTH username AND password match exactly
6. When returning error, DO NOT include a user object at all
7. When returning success, map ALL Airtable fields to the response format
8. If email is missing or invalid in Airtable, use null (not empty string)
```

## Fix 5: Update Respond to Webhook

Make sure Respond to Webhook node uses:
- **Response Body**: `={{ $json }}` (from Code node output)
- **Response Code**: `200`

## Complete Fixed Workflow Structure

```
[Webhook]
  └─> [AI Agent]
      ├─> [OpenAI Chat Model] (connected as ai_languageModel)
      ├─> [Search records in Airtable] (connected as ai_tool)
      └─> [Code in JavaScript] (clean and validate response)
          └─> [Respond to Webhook]
```

## Testing

After making these fixes, test with:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"Sagar","passcode":"pass@123"}'
```

Expected response (if credentials are valid):
```json
{
  "success": true,
  "user": {
    "id": "rec...",
    "email": "...",
    "username": "Sagar",
    "role": "...",
    "name": "..."
  }
}
```

Expected response (if credentials are invalid):
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

## Quick Checklist

- [ ] Fix Code node JavaScript (remove corrupted text, fix regex)
- [ ] Update Airtable tool to return all necessary fields (Username, Email, Password, Role, etc.)
- [ ] Update output parser schema (make email nullable, remove from required)
- [ ] Update AI agent prompt with clearer validation rules
- [ ] Verify Respond to Webhook uses `={{ $json }}`
- [ ] Save and activate workflow
- [ ] Test with username "Sagar" and passcode "pass@123"

