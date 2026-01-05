# Fix: AI Agent Returning Markdown-Wrapped JSON

## Problem
The AI agent is returning:
```json
{
  "output": "```json\n{\n  \"success\": false,\n  \"error\": \"Invalid username or passcode\"\n}\n```"
}
```

Instead of:
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

## Solution 1: Update System Prompt (Already Done)

The prompt has been updated to explicitly state:
- "Return ONLY raw JSON - NO markdown code blocks"
- "DO NOT wrap the response in markdown code blocks"

## Solution 2: Add Code Node to Strip Markdown

If the AI still returns markdown, add a Code node between AI Agent and Respond to Webhook:

### Workflow Structure:
```
[Webhook] → [Airtable] → [AI Agent] → [Code: Strip Markdown] → [Respond to Webhook]
```

### Code Node Content:
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
  // If parsing fails, return error response
  return {
    json: {
      success: false,
      error: "Failed to parse AI response: " + error.message
    }
  };
}
```

## Solution 3: Use Output Parser More Strictly

In the AI Agent node settings:
1. Enable **Output Parser**
2. Set **Output Parser Type**: `JSON`
3. Use the JSON schema provided in `N8N_AI_AGENT_PROMPT.md`
4. Set **Temperature**: `0` (for consistent output)
5. Add to system prompt: "The output parser will validate your response. Return ONLY valid JSON that matches the schema."

## Solution 4: Use Function Node Instead of Code Node

If Code node doesn't work, use Function node with same logic.

## Updated User Prompt

Also update the user prompt to be more explicit:

```
Validate these credentials:
Username: {{ $json.body.username }}
Passcode: {{ $json.body.passcode }}

Airtable user data: {{ JSON.stringify($('Airtable: Get User').item.json) }}

Return ONLY the JSON object in this exact format (no markdown, no code blocks, just the JSON):

If valid:
{"success": true, "user": {"id": "...", "email": "...", "username": "...", "role": "...", ...}}

If invalid:
{"success": false, "error": "Invalid username or passcode"}

Remember: Return ONLY the JSON, nothing else.
```

## Testing

Test with:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"tarun","passcode":"pass"}'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "rec...",
    "email": "...",
    "username": "tarun",
    "role": "..."
  }
}
```

## Quick Fix Workflow

1. Add Code node after AI Agent
2. Use the Code node content above
3. Connect: AI Agent → Code → Respond to Webhook
4. Save and test

This will strip any markdown wrapping and return clean JSON.

