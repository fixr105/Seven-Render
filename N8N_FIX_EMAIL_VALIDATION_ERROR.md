# Fix: Invalid Email Validation Error in Output Parser

## Problem
Getting error:
```json
{
  "validation": "email",
  "code": "invalid_string",
  "message": "Invalid email",
  "path": ["email"]
}
```

This happens because the output parser JSON schema is validating the `email` field even when `success: false`.

## Root Causes

1. **Code Node Language Mismatch**: Code node is set to Python but contains JavaScript code
2. **Output Parser Schema Too Strict**: Schema validates `user.email` even when success is false
3. **Airtable Search Not Filtering**: Airtable tool isn't searching by username correctly

## Solution 1: Fix Code Node

### Option A: Use JavaScript (Recommended)

1. **Change Code node language to JavaScript**
2. **Use this code**:
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
     return { json: parsed };
   } catch (error) {
     return {
       json: {
         success: false,
         error: "Failed to parse AI response: " + error.message
       }
     };
   }
   ```

### Option B: Use Python

If you want to use Python:
```python
import json
import re

# Get AI output
ai_output = items[0]['json']

# Extract JSON from markdown if present
json_string = ''

if 'output' in ai_output:
    output = ai_output['output']
    # Remove markdown code blocks
    json_string = re.sub(r'```json\s*', '', output)
    json_string = re.sub(r'```\s*', '', json_string).strip()
elif isinstance(ai_output, str):
    json_string = re.sub(r'```json\s*', '', ai_output)
    json_string = re.sub(r'```\s*', '', json_string).strip()
else:
    # Already JSON object
    return [{'json': ai_output}]

# Parse JSON
try:
    parsed = json.loads(json_string)
    return [{'json': parsed}]
except Exception as e:
    return [{
        'json': {
            'success': False,
            'error': f'Failed to parse AI response: {str(e)}'
        }
    }]
```

## Solution 2: Fix Output Parser Schema

Update the JSON schema in the AI Agent node to be more lenient:

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
        "id": {"type": "string"},
        "email": {
          "type": "string",
          "format": "email",
          "nullable": true
        },
        "username": {"type": "string"},
        "role": {
          "type": "string",
          "enum": ["client", "kam", "credit_team", "nbfc"]
        },
        "clientId": {"type": "string", "nullable": true},
        "kamId": {"type": "string", "nullable": true},
        "nbfcId": {"type": "string", "nullable": true},
        "name": {"type": "string", "nullable": true}
      },
      "required": ["id", "username", "role"]
    },
    "error": {"type": "string"}
  },
  "required": ["success"],
  "oneOf": [
    {
      "properties": {
        "success": {"const": true}
      },
      "required": ["user"]
    },
    {
      "properties": {
        "success": {"const": false}
      },
      "required": ["error"]
    }
  ]
}
```

**Key changes:**
- `email` is now `nullable: true` and not in required fields
- `email` format validation is optional
- Only validate `user` object when `success: true`

## Solution 3: Fix Airtable Search

The Airtable tool needs to search by username. Update the search query:

1. **In Airtable Tool node**, set:
   - **Operation**: `search`
   - **Query**: Use a formula or search by the Username field
   - **Fields to return**: Include Username, Email, Password, Role, etc.

2. **Better approach**: Use Airtable List Records with filter:
   - **Operation**: `list`
   - **Filter By Formula**: `{Username} = "{{ $json.body.username }}"` (case-insensitive: `LOWER({Username}) = LOWER("{{ $json.body.username }}")`)

## Solution 4: Update AI Agent Prompt

Make the prompt clearer about when to return error:

Add to system prompt:
```
CRITICAL VALIDATION RULES:
1. If username is not found in Airtable → return {"success": false, "error": "Invalid username or passcode"}
2. If username found but password doesn't match → return {"success": false, "error": "Invalid username or passcode"}
3. Only return user object when BOTH username AND password match
4. When returning error, DO NOT include a user object
5. When returning success, ensure email is a valid email format or use null
```

## Solution 5: Simplify Output Parser (Recommended)

Instead of strict schema validation, use a simpler approach:

1. **Disable strict output parser** OR
2. **Use a Code node to validate and format** the response before Respond to Webhook

### Code Node for Validation (Add before Respond to Webhook):

```javascript
const aiOutput = $input.item.json;

// Ensure proper format
let response = {};

if (aiOutput.success === true && aiOutput.user) {
  // Success case - validate user object
  response = {
    success: true,
    user: {
      id: aiOutput.user.id || '',
      email: aiOutput.user.email || null,
      username: aiOutput.user.username || '',
      role: aiOutput.user.role || 'client',
      clientId: aiOutput.user.clientId || null,
      kamId: aiOutput.user.kamId || null,
      nbfcId: aiOutput.user.nbfcId || null,
      name: aiOutput.user.name || null
    }
  };
} else {
  // Error case
  response = {
    success: false,
    error: aiOutput.error || 'Invalid username or passcode'
  };
}

return { json: response };
```

## Updated Workflow Structure

```
[Webhook]
  └─> [AI Agent] (with Airtable tool)
      └─> [Code: Strip Markdown] (JavaScript)
          └─> [Code: Validate & Format] (JavaScript) ← Add this
              └─> [Respond to Webhook]
```

## Quick Fix Checklist

- [ ] Fix Code node language (JavaScript or Python, not mixed)
- [ ] Update output parser schema to make email nullable
- [ ] Fix Airtable search to filter by username
- [ ] Update AI prompt to be clearer about error cases
- [ ] Add validation Code node before Respond to Webhook
- [ ] Test with username "Sagar" and passcode "pass@123"

