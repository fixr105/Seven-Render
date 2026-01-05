# How Airtable Tool Search Works

## The Issue

You're right - the previous workflow tried to use Airtable `list` operation which requires the data to flow through nodes. But the AI agent needs to **call** the Airtable tool itself to search.

## Solution: Use Airtable Tool (Not Airtable Node)

The new workflow (`n8n-complete-validate-workflow-v2.json`) uses the **Airtable Tool** which the AI agent can call directly.

### How It Works:

1. **Webhook** receives username/passcode
2. **AI Agent** receives the request
3. **AI Agent calls "Search records in Airtable" tool** with query: `"Username: <username>"`
4. **Airtable Tool** searches and returns results
5. **AI Agent** validates password and formats response
6. **Code node** cleans the response
7. **Respond to Webhook** returns JSON

## Airtable Tool Configuration

The Airtable Tool node is configured as:
- **Operation**: `search`
- **Base**: Your Airtable base
- **Table**: `User Accounts`
- **No query needed** - the AI agent will provide the search query when it calls the tool

## How AI Agent Uses the Tool

The AI agent prompt tells it:
1. "Use the 'Search records in Airtable' tool"
2. "Search query: 'Username: <username>'"
3. The tool will search the User Accounts table
4. The tool returns matching records

## Alternative: If Tool Search Doesn't Work

If the Airtable tool search doesn't work properly, you can use a **Function node** to prepare the search query:

### Option 1: Pre-fetch User (Simpler)

Add an Airtable node before AI Agent:

```
[Webhook] → [Airtable: List Records] → [AI Agent] → [Code] → [Respond]
```

**Airtable Node Configuration:**
- Operation: `list`
- Filter: `LOWER({Username}) = LOWER("{{ $json.body.username }}")`
- Limit: 1

**AI Agent Prompt Update:**
```
You will receive Airtable user data from the previous node.

Airtable data: {{ JSON.stringify($('Airtable: List Records').item.json) }}

If Airtable data is empty → return error
If Airtable data exists:
  - Compare Password field with passcode: {{ $json.body.passcode }}
  - If match → return success with user data
  - If no match → return error
```

### Option 2: Use IF Node (No AI Needed)

If you want to avoid AI complexity:

```
[Webhook] 
  → [Airtable: List Records] (search by username)
    → [IF Node] (check if user exists and password matches)
      ├─> [True] → [Set Node] (format success response)
      └─> [False] → [Set Node] (format error response)
          → [Respond to Webhook]
```

## Recommended Approach

**Use the new workflow v2** which:
- Uses Airtable Tool that AI can call
- AI agent searches by username dynamically
- No need for record IDs
- More flexible

## Testing

After importing v2 workflow:
1. Configure credentials (Airtable, OpenAI)
2. Activate workflow
3. Test:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"Sagar","passcode":"pass@123"}'
```

The AI agent will:
1. Call Airtable tool with search query
2. Get user record(s)
3. Validate password
4. Return formatted response

