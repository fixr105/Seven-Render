# How to Import n8n Workflow

## Step 1: Download the Workflow File

The workflow file is saved as: `n8n-validate-webhook.json`

## Step 2: Import into n8n

1. **Go to your n8n instance**: https://fixrrahul.app.n8n.cloud
2. **Click "Workflows"** in the left sidebar
3. **Click the "..." menu** (three dots) in the top right
4. **Select "Import from File"** or **"Import"**
5. **Choose the file**: `n8n-validate-webhook.json`
6. **Click "Import"**

## Step 3: Verify the Workflow

After importing, you should see:
- **Webhook node** on the left
- **Respond to Webhook node** on the right
- A connection line between them

## Step 4: Configure the Webhook

1. **Click on the Webhook node**
2. **Verify settings**:
   - HTTP Method: `POST`
   - Path: `validate`
   - Response Mode: `Using 'Respond to Webhook' Node`
3. **Note the Production URL**: Should be `https://fixrrahul.app.n8n.cloud/webhook/validate`

## Step 5: Configure Respond to Webhook

1. **Click on Respond to Webhook node**
2. **Verify Response Body** is set to JSON format
3. The response should be:
   ```json
   {
     "success": true,
     "user": {
       "id": "test-user-123",
       "email": "test@example.com",
       "username": "test",
       "role": "client",
       "name": "Test User"
     }
   }
   ```

## Step 6: Activate the Workflow

1. **Click the "Active" toggle** in the top-right corner
2. **It should turn green/blue** (Active)
3. **Save the workflow** (Ctrl+S or Cmd+S)

## Step 7: Test the Webhook

```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "test-user-123",
    "email": "test@example.com",
    "username": "test",
    "role": "client",
    "name": "Test User"
  }
}
```

## Customizing the Response

To customize the response for real users:

1. **Click on Respond to Webhook node**
2. **Edit the Response Body** field
3. **Update the JSON** with your actual user data structure
4. **Save and activate**

## Troubleshooting

### Import Failed?
- Make sure you're using the correct n8n version (1.121.3 or compatible)
- Try copying the JSON content and pasting it in "Import from URL" or "Paste JSON"

### Workflow Not Active?
- Check if the toggle is ON (green/blue)
- Save the workflow after activating

### Webhook Returns Wrong Response?
- Check Respond to Webhook node settings
- Verify Response Body is set to JSON
- Make sure Webhook node Response Mode is "Using 'Respond to Webhook' Node"

## Next Steps

After the basic webhook works, you can:
1. Add validation logic (check username/passcode against database)
2. Add Airtable node to fetch user data
3. Add error handling for invalid credentials
4. Customize the response based on actual user data

See `N8N_WEBHOOK_SETUP.md` for detailed setup with validation logic.

