# Fix: "Model output doesn't fit required format" Error

## Solution 1: Make Output Parser More Lenient (Recommended)

Update the Structured Output Parser node with this more flexible schema:

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
          "type": ["string", "null"]
        },
        "username": {
          "type": "string"
        },
        "role": {
          "type": "string"
        },
        "clientId": {
          "type": ["string", "null"]
        },
        "kamId": {
          "type": ["string", "null"]
        },
        "nbfcId": {
          "type": ["string", "null"]
        },
        "name": {
          "type": ["string", "null"]
        }
      },
      "required": ["id", "username", "role"]
    },
    "error": {
      "type": "string"
    }
  },
  "required": ["success"],
  "additionalProperties": true,
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
- Removed `enum` for role (allows any string)
- Changed `nullable: true` to `["string", "null"]` (more compatible)
- Added `additionalProperties: true` (allows extra fields)
- Simplified validation

## Solution 2: Configure "On Error" Setting

In the AI Agent node settings:

1. **Click on AI Agent node**
2. **Find "On Error" or "Error Handling" setting**
3. **Set to**: `Continue On Error` or `Ignore Error`
4. **Save the node**

This will allow the workflow to continue even if the parser fails, and the Code node can handle the raw output.

## Solution 3: Remove Output Parser Entirely (Easiest)

1. **Disconnect Structured Output Parser**:
   - Click the connection line from Structured Output Parser → AI Agent
   - Delete it

2. **Delete Structured Output Parser node** (optional)

3. **Update AI Agent node**:
   - Set `hasOutputParser` to `false`
   - Or uncheck "Use Output Parser"

4. **Code node will handle everything**

## Solution 4: Use v3 Workflow (Best Solution)

Import `n8n-complete-validate-workflow-v3.json` which:
- Has no strict output parser
- Code node handles all validation
- More robust error handling
- Works with any AI output format

## Quick Fix Steps

### Option A: Update Parser Schema
1. Click on **Structured Output Parser** node
2. Replace the JSON schema with the lenient version above
3. Save

### Option B: Set On Error to Continue
1. Click on **AI Agent** node
2. Find **"On Error"** setting
3. Set to **"Continue On Error"** or **"Ignore Error"**
4. Save

### Option C: Remove Parser
1. Disconnect **Structured Output Parser** from AI Agent
2. Set AI Agent `hasOutputParser` to `false`
3. Save

## Recommended: Use v3 Workflow

The v3 workflow (`n8n-complete-validate-workflow-v3.json`) is the best solution because:
- No parser errors
- Code node validates everything
- More flexible
- Better error handling

Import it and you're done!

