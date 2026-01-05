# Fix: AI Agent Can't Find User in Airtable

## Problem
The AI agent returns "Invalid username or passcode" even though the user exists. This is because:
1. **Airtable tool has no search query** - it's searching without any criteria
2. **AI agent doesn't know how to search** - the prompt doesn't tell it to use the Airtable tool with a username filter
3. **Code node still has corrupted text** - needs to be cleaned

## Solution 1: Fix Code Node (First Priority)

Your Code node still has corrupted text at the end. Replace it with this clean version:

```javascript
// Get AI output
const aiOutput = $input.item.json;

// Extract JSON from markdown if present
let jsonString = '';

if (aiOutput.output) {
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
  return { json: aiOutput };
}

// Parse and validate JSON
try {
  const parsed = JSON.parse(jsonString);
  
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
      error: "Failed to parse AI response"
    }
  };
}
```

## Solution 2: Add Airtable Node Before AI Agent (Recommended)

Instead of relying on the AI to use the Airtable tool correctly, fetch the user data first:

### New Workflow Structure:
```
[Webhook]
  └─> [Airtable: List Records] (Search by username)
      └─> [AI Agent] (Validate password and format response)
          └─> [Code in JavaScript] (Clean response)
              └─> [Respond to Webhook]
```

### Add Airtable List Records Node:

1. **Add new node** between Webhook and AI Agent
2. **Node type**: `Airtable` (not Airtable Tool)
3. **Operation**: `List Records`
4. **Base**: Your Airtable base
5. **Table**: `User Accounts`
6. **Filter By Formula**: `LOWER({Username}) = LOWER("{{ $json.body.username }}")`
7. **Return All**: No
8. **Limit**: 1

This will fetch the user BEFORE the AI agent runs, so the AI has the data.

## Solution 3: Update AI Agent Prompt

Add this to the system prompt to tell the AI how to use the Airtable tool:

```
## How to Use Airtable Tool:

1. The Airtable tool is already connected. To search for a user:
   - Use the "Search records in Airtable" tool
   - Search query should be: "Username: <username_from_request>"
   - The tool will search the "User Accounts" table

2. After getting Airtable results:
   - Check if any records were returned
   - If no records → return {"success": false, "error": "Invalid username or passcode"}
   - If records found → check Password field matches the passcode from request
   - Password comparison is case-sensitive
   - Username comparison is case-insensitive

3. Example Airtable tool usage:
   - Tool: "Search records in Airtable"
   - Query: "Username: Sagar"
   - This will search for user with username "Sagar" (case-insensitive)
```

## Solution 4: Configure Airtable Tool Properly

If you want to keep using the Airtable tool (not the regular Airtable node):

1. **In "Search records in Airtable" node**:
   - The tool needs to be called by the AI with a search query
   - Update the AI prompt to explicitly tell it to call this tool with: `"Username: {{ $json.body.username }}"`

2. **Better approach**: Configure the tool to accept a query parameter:
   - The AI agent should call the tool with: `search("Username", username_from_request)`
   - But this requires the tool to be configured to accept dynamic queries

## Solution 5: Update User Prompt in AI Agent

Change the user prompt to be more explicit:

```
Validate these credentials:
Username: {{ $json.body.username }}
Passcode: {{ $json.body.passcode }}

STEP 1: Use the "Search records in Airtable" tool to search for a user where Username matches "{{ $json.body.username }}" (case-insensitive).

STEP 2: If no user found → return {"success": false, "error": "Invalid username or passcode"}

STEP 3: If user found → Compare the Password field from Airtable with the passcode "{{ $json.body.passcode }}" (case-sensitive).

STEP 4: If password matches → Return success response with user data from Airtable.

STEP 5: If password doesn't match → Return {"success": false, "error": "Invalid username or passcode"}

IMPORTANT: You MUST use the Airtable tool to search for the user. Do not assume the user exists.
```

## Recommended: Use Regular Airtable Node (Easiest)

The easiest solution is to use a regular Airtable node (not the tool) before the AI agent:

1. **Delete or disconnect** the Airtable Tool nodes from AI Agent
2. **Add regular Airtable node** between Webhook and AI Agent
3. **Configure it** to search by username (see Solution 2)
4. **Update AI Agent prompt** to use the data from the previous node:

```
You will receive Airtable user data from the previous node. 

The input data structure:
{{ JSON.stringify($('Airtable: List Records').item.json) }}

Validate:
- Username from request: {{ $json.body.username }}
- Passcode from request: {{ $json.body.passcode }}
- Airtable Username: {{ $('Airtable: List Records').item.json.fields.Username }}
- Airtable Password: {{ $('Airtable: List Records').item.json.fields.Password }}

If Airtable data is empty or username doesn't match → return error
If password doesn't match → return error
If both match → return success with user data
```

## Quick Fix Checklist

- [ ] Fix Code node (remove corrupted text)
- [ ] Add Airtable List Records node before AI Agent (search by username)
- [ ] Update AI Agent prompt to use data from Airtable node
- [ ] OR configure Airtable tool with proper search query
- [ ] Test with username "Sagar" and passcode "pass@123"

## Testing After Fix

Check the execution in n8n:
1. Go to Executions tab
2. Click on the latest execution
3. Check if Airtable node found the user
4. Check what data the AI agent received
5. Check what the AI agent returned

This will help you debug where the issue is.

