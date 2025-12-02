# POST Webhook Handler Setup

## Overview

The POST webhook handler fetches data from the GET webhook and POSTs it to your n8n POST webhook, which then syncs the data to Airtable tables.

**Flow:**
1. **GET** from: `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52`
2. **POST** to: Your n8n POST webhook URL (configure below)
3. **n8n** syncs to Airtable tables

## Configuration

### Set POST Webhook URL

**Option 1: Environment Variable**
```bash
# In .env file
VITE_N8N_POST_WEBHOOK_URL=https://fixrrahul.app.n8n.cloud/webhook/YOUR-POST-WEBHOOK-ID
```

**Option 2: Update Code**
Edit `src/lib/webhookPostHandler.ts`:
```typescript
const POST_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/YOUR-POST-WEBHOOK-ID';
```

**Option 3: Pass in Options**
```typescript
await handleWebhookPost({
  fetchFromGet: true,
  postUrl: 'https://fixrrahul.app.n8n.cloud/webhook/YOUR-POST-WEBHOOK-ID',
});
```

## Usage

### From Frontend

```typescript
import { handleWebhookPost } from './lib/webhookPostHandler';

// Fetch from GET and POST to n8n
const result = await handleWebhookPost({
  fetchFromGet: true,
});

console.log('POSTed:', result.synced, 'records');
```

### From Test Page

1. Navigate to: `http://localhost:7778/webhook-post-test`
2. Click "Fetch from GET Webhook" to see the data
3. Click "Test POST (Fetch & Sync)" to POST to n8n

### From Node.js

```bash
# Update POST_WEBHOOK_URL in test-post-to-n8n.js first
node test-post-to-n8n.js
```

## Data Format

The handler sends the data **exactly as received** from the GET webhook:

```json
{
  "id": "recAyM1n2jsx5e7RD",
  "createdTime": "2025-12-01T07:03:53.000Z",
  "Mapping ID": "MAP002",
  "Client": "CL001",
  "Category": "C002",
  "Is Required": "True",
  "Display Order": "2"
}
```

Your n8n workflow should:
1. Receive this JSON
2. Map fields to Airtable columns
3. Insert/update records in Airtable

## n8n Workflow Setup

### Step 1: Create POST Webhook Node

1. Add a **Webhook** node
2. Set method to **POST**
3. Copy the webhook URL (e.g., `https://fixrrahul.app.n8n.cloud/webhook/YOUR-ID`)

### Step 2: Add Airtable Node

1. Add an **Airtable** node after the webhook
2. Configure:
   - **Operation**: Create or Update
   - **Table**: Your target table
   - **Fields Mapping**: Map incoming fields to Airtable columns
     - `Mapping ID` → Your File ID column
     - `Client` → Your Client column
     - `Category` → Your Category column
     - etc.

### Step 3: Add Respond to Webhook Node

1. Add a **Respond to Webhook** node
2. Connect it to return success/error response

## Testing

### Test the Flow

1. **Get your POST webhook URL** from n8n
2. **Update** `POST_WEBHOOK_URL` in the code
3. **Run test**: `node test-post-to-n8n.js`
4. **Check n8n execution logs** to see if data was received
5. **Check Airtable** to verify records were created/updated

### Expected Response

```json
{
  "success": true,
  "message": "Successfully POSTed 1 record(s) to n8n webhook. n8n will sync to Airtable.",
  "synced": 1,
  "failed": 0,
  "data": {
    "totalRecords": 1,
    "n8nResponse": { /* n8n response */ }
  }
}
```

## Troubleshooting

### "Invalid JSON response"
- POST webhook URL might be incorrect
- n8n workflow might not be active
- Check n8n execution logs

### "No records to POST"
- GET webhook returned empty data
- Check GET webhook is active and returning data

### "POST webhook returned status 404"
- POST webhook URL is incorrect
- Webhook doesn't exist in n8n
- Workflow is not activated

### Data not appearing in Airtable
- Check n8n workflow execution logs
- Verify field mapping in Airtable node
- Check Airtable table permissions

## Next Steps

1. ✅ Get your n8n POST webhook URL
2. ✅ Update `POST_WEBHOOK_URL` in the code
3. ✅ Configure n8n workflow to map fields to Airtable
4. ✅ Test the complete flow
5. ✅ Verify data in Airtable
