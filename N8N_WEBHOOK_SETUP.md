# How to Fix: "The requested webhook 'POST validate' is not registered"

## Problem
The backend is trying to call `https://fixrrahul.app.n8n.cloud/webhook/validate`, but n8n is returning:
```json
{"success":false,"error":"The requested webhook \"POST validate\" is not registered."}
```

This means the webhook workflow doesn't exist or isn't activated in your n8n instance.

## Solution: Create and Activate the Webhook in n8n

### Step 1: Access Your n8n Instance

1. Go to: https://fixrrahul.app.n8n.cloud
2. Log in to your n8n account

### Step 2: Create a New Workflow

1. Click **"Workflows"** in the left sidebar
2. Click **"+ New Workflow"** button (top right)
3. Give it a name: `User Validation Webhook` or `Login Validate`

### Step 3: Add Webhook Trigger

1. In the workflow canvas, click **"+ Add first step"**
2. Search for **"Webhook"** in the node search
3. Select **"Webhook"** node
4. Configure the Webhook node:
   - **HTTP Method**: `POST`
   - **Path**: `validate`
   - **Response Mode**: `Last Node` (or `When Last Node Finishes`)
   - **Response Code**: `200`

The webhook URL will be: `https://fixrrahul.app.n8n.cloud/webhook/validate`

### Step 4: Add Nodes to Process the Request

The webhook should:
1. Receive `username` and `passcode` from the request body
2. Validate credentials (check against your data source - Airtable, database, etc.)
3. Return a response

#### Example Workflow Structure:

```
[Webhook] → [Function/Code] → [Airtable/Data Source] → [IF Node] → [Respond to Webhook]
```

#### Detailed Node Setup:

**1. Webhook Node (already added)**
- Path: `validate`
- Method: `POST`

**2. Add a Function Node (or Code Node)**
- This extracts `username` and `passcode` from the request
- Node name: `Extract Credentials`
- Code example:
```javascript
const body = $input.item.json;
return {
  json: {
    username: body.username,
    passcode: body.passcode
  }
};
```

**3. Add Your Data Source Node**
- This could be:
  - **Airtable** node (if credentials are in Airtable)
  - **HTTP Request** node (if checking another API)
  - **PostgreSQL/MySQL** node (if using a database)
  - **Google Sheets** node (if using Google Sheets)

**Example: Airtable Node**
- Operation: `List Records` or `Get Record`
- Base: Select your base
- Table: `User Accounts` (or your credentials table)
- Filter: `{Username} = {{ $json.username }}`

**4. Add an IF Node (Conditional Logic)**
- Check if user exists and passcode matches
- Condition: `{{ $json.fields.Password }} === {{ $('Extract Credentials').item.json.passcode }}`
- Or use a Function node for more complex validation

**5. Add Respond to Webhook Nodes**

**For Success (credentials valid):**
- Node: `Respond to Webhook` or `Set` node
- Response:
```json
{
  "success": true,
  "user": {
    "id": "{{ $json.id }}",
    "email": "{{ $json.fields.Email }}",
    "username": "{{ $json.fields.Username }}",
    "role": "{{ $json.fields.Role }}",
    "clientId": "{{ $json.fields.ClientId }}",
    "kamId": "{{ $json.fields.KAMId }}",
    "nbfcId": "{{ $json.fields.NBFCId }}",
    "name": "{{ $json.fields.Name }}"
  }
}
```

**For Failure (credentials invalid):**
- Node: `Respond to Webhook` or `Set` node
- Response:
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

### Step 5: Connect the Nodes

**IMPORTANT**: All nodes must be properly connected! The webhook won't work if nodes are disconnected.

Connect nodes in this order:
1. Webhook → Extract Credentials
2. Extract Credentials → Airtable/Data Source
3. Airtable → IF Node (check credentials)
4. IF Node (true) → Success Response
5. IF Node (false) → Failure Response

**For Simple Test Setup:**
- Webhook → Respond to Webhook (direct connection, no other nodes in between)

**Common Error**: "Unused Respond to Webhook node found"
- This means the Respond to Webhook node is not connected to the workflow
- Make sure there's a connection line from Webhook (or previous node) → Respond to Webhook
- The connection line should be visible in the workflow canvas

### Step 6: Activate the Workflow

**This is critical!** The webhook won't work until activated:

1. Click the **"Active"** toggle in the top-right corner of the workflow editor
2. It should turn **green/blue** and show "Active"
3. You should see a confirmation message

### Step 7: Test the Webhook

Test from command line:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"your-test-username","passcode":"your-test-passcode"}'
```

**Expected Success Response:**
```json
{
  "success": true,
  "user": {
    "id": "rec...",
    "email": "user@example.com",
    "username": "user@example.com",
    "role": "client",
    "clientId": "...",
    "name": "User Name"
  }
}
```

**Expected Failure Response:**
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

## Alternative: Simple Test Webhook

If you want to test quickly without setting up the full validation logic:

1. Create workflow with just:
   - **Webhook** node (POST, path: `validate`)
   - **Respond to Webhook** node

2. In Respond to Webhook, set:
```json
{
  "success": true,
  "user": {
    "id": "test-user-123",
    "email": "test@example.com",
    "username": "test",
    "role": "client"
  }
}
```

3. Activate the workflow
4. Test with curl

This will allow login to work (with test credentials), and you can add proper validation later.

## Troubleshooting

### Webhook still returns 404 after activation?

1. **Check the webhook path**: Must be exactly `validate` (case-sensitive)
2. **Verify workflow is active**: Toggle should be green/blue
3. **Check n8n logs**: Look for errors in the workflow execution
4. **Test webhook URL directly**: Use curl to test

### Webhook returns 500 error?

1. Check n8n workflow execution logs
2. Verify your data source is accessible
3. Check that all node connections are correct
4. Ensure response format matches expected structure

### Credentials not validating?

1. Check your data source has the correct fields
2. Verify username/passcode comparison logic
3. Check for case sensitivity issues
4. Ensure password field matches (plain text vs hashed)

## Quick Reference

**Webhook URL**: `https://fixrrahul.app.n8n.cloud/webhook/validate`  
**Method**: `POST`  
**Path**: `validate`  
**Request Body**:
```json
{
  "username": "string",
  "passcode": "string"
}
```

**Success Response**:
```json
{
  "success": true,
  "user": {
    "id": "string",
    "email": "string",
    "username": "string",
    "role": "client|kam|credit_team|nbfc",
    "clientId": "string (optional)",
    "kamId": "string (optional)",
    "nbfcId": "string (optional)",
    "name": "string (optional)"
  }
}
```

**Failure Response**:
```json
{
  "success": false,
  "error": "Error message"
}
```

