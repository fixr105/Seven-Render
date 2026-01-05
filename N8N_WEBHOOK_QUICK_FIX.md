# Quick Fix: "Unused Respond to Webhook node found"

## Problem
You're getting this error:
```json
{"code":0,"message":"Unused Respond to Webhook node found in the workflow"}
```

This means the **Respond to Webhook** node exists but isn't connected to the workflow.

## Solution

### Step 1: Check Your Workflow in n8n

1. Open your workflow in n8n
2. Look at the canvas - you should see connection lines between nodes
3. The **Respond to Webhook** node should have a connection line coming INTO it

### Step 2: Connect the Nodes

**Option A: Simple Test Setup (Recommended for Quick Test)**

1. You should have:
   - **Webhook** node (POST, path: `validate`)
   - **Respond to Webhook** node

2. **Connect them**:
   - Click and drag from the **output** of the Webhook node (right side)
   - Drag to the **input** of the Respond to Webhook node (left side)
   - You should see a connection line appear

3. **Configure Respond to Webhook**:
   - Click on the Respond to Webhook node
   - Set the response body:
   ```json
   {
     "success": true,
     "user": {
       "id": "test-123",
       "email": "test@example.com",
       "username": "test",
       "role": "client"
     }
   }
   ```

4. **Save and Activate**:
   - Click "Save" (or Ctrl+S)
   - Make sure the workflow is **Active** (toggle in top-right)

### Option B: With Validation Logic

If you have more nodes (Function, Airtable, IF, etc.):

1. Make sure **every node is connected**:
   - Webhook → Function/Code
   - Function → Airtable
   - Airtable → IF Node
   - IF Node (true branch) → Respond to Webhook (Success)
   - IF Node (false branch) → Respond to Webhook (Failure)

2. **Check for disconnected nodes**:
   - Any node without connection lines is "unused"
   - Either connect it or delete it

### Step 3: Test Again

```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

**Expected Success Response:**
```json
{
  "success": true,
  "user": {
    "id": "test-123",
    "email": "test@example.com",
    "username": "test",
    "role": "client"
  }
}
```

## Visual Guide

Your workflow should look like this:

```
[Webhook] ────> [Respond to Webhook]
   POST              (Response Body)
  validate
```

**NOT like this:**
```
[Webhook]          [Respond to Webhook]
   POST              (No connection!)
  validate
```

## Still Not Working?

1. **Check workflow is Active**: Toggle should be green/blue
2. **Check webhook path**: Must be exactly `validate` (case-sensitive)
3. **Check HTTP method**: Must be `POST`
4. **Save the workflow**: Click Save after making changes
5. **Wait a few seconds**: n8n may need a moment to update

