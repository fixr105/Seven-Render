# Webhook Setup Guide

## Current Status
- ✅ Webhook URL is active: `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d`
- ⚠️ "Respond to Webhook" node exists but is not connected
- ✅ Code is ready to fetch and analyze data

## n8n Workflow Setup

### Required Steps in n8n:

1. **Webhook Trigger Node** (already exists)
   - Method: GET
   - Path: `/46a2b46b-3288-4970-bd13-99c2ba08d52d`

2. **Database Query Node** (add if needed)
   - Connect to your database
   - Query the tables you want to return
   - Example: `SELECT * FROM loan_applications`

3. **Respond to Webhook Node** (exists but needs connection)
   - Connect it to the output of your query node
   - This node will return the data to the webhook caller

### Workflow Structure Should Be:
```
[Webhook Trigger] → [Database Query] → [Respond to Webhook]
```

## Expected Data Format

The webhook should return data in one of these formats:

### Option 1: Single Table
```json
{
  "table": "loan_applications",
  "data": [
    {
      "file_number": "SF12345678",
      "applicant_name": "John Doe",
      "requested_loan_amount": 5000000,
      ...
    }
  ]
}
```

### Option 2: Multiple Tables
```json
{
  "loan_applications": [...],
  "dsa_clients": [...],
  "commission_ledger": [...]
}
```

### Option 3: Tables Object
```json
{
  "tables": {
    "loan_applications": [...],
    "dsa_clients": [...],
    "commission_ledger": [...]
  }
}
```

## Testing

Once the "Respond to Webhook" node is connected:

1. **Via Browser**: Navigate to `/webhook-test` in the app
2. **Via Terminal**: 
   ```bash
   curl "https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d"
   ```
3. **Via Code**: 
   ```typescript
   import { testWebhookData } from './lib/webhookDataFetcher';
   const data = await testWebhookData();
   ```

## What's Ready

✅ **Webhook Fetcher** (`src/lib/webhookDataFetcher.ts`)
- Fetches data from webhook
- Analyzes data structure
- Logs compatibility information
- Does NOT process/import data (as per requirements)

✅ **Test Page** (`src/pages/WebhookTest.tsx`)
- UI to test webhook
- Displays fetched data
- Available at `/webhook-test` route
- Accessible to Credit Team and KAM roles

✅ **Compatibility Analysis** (`WEBHOOK_COMPATIBILITY.md`)
- Field mapping documentation
- Expected data structures
- Integration points

## Next Steps

1. **In n8n**: Connect the "Respond to Webhook" node to your query output
2. **Test**: Use the test page or curl command to verify data is returned
3. **Analyze**: Check browser console for data structure analysis
4. **Review**: Compare returned data with `WEBHOOK_COMPATIBILITY.md`

## Current Error

```
{"code":0,"message":"Unused Respond to Webhook node found in the workflow"}
```

**Solution**: Connect the "Respond to Webhook" node in your n8n workflow to the node that contains the data you want to return.

