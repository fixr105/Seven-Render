# Complete n8n Workflow Setup Guide

## Overview

This is a fully configured n8n workflow for user validation that:
1. Receives username/passcode via webhook
2. Searches Airtable for the user by username
3. Uses AI agent to validate credentials
4. Returns formatted JSON response

## Import the Workflow

1. **Download**: `n8n-complete-validate-workflow.json`
2. **Go to n8n**: https://fixrrahul.app.n8n.cloud
3. **Import**: Workflows → "..." → Import from File
4. **Select**: `n8n-complete-validate-workflow.json`

## Configure Credentials

After importing, you need to configure:

### 1. Airtable Credentials
- **Node**: "Airtable: Get User by Username"
- **Credentials**: Airtable Personal Access Token
- **Base ID**: `appzbyi8q7pJRl1cd` (already set)
- **Table ID**: `tbl7RRcehD5xLiPv7` (User Accounts - already set)

### 2. OpenAI Credentials
- **Node**: "OpenAI Chat Model"
- **Credentials**: OpenAI API Key
- **Model**: `gpt-4o-mini` (already set)

## Verify Configuration

### Webhook Node
- **Path**: `validate` ✓
- **Method**: `POST` ✓
- **Response Mode**: `Using 'Respond to Webhook' Node` ✓
- **URL**: `https://fixrrahul.app.n8n.cloud/webhook/validate` ✓

### Airtable Node
- **Operation**: `List Records` ✓
- **Filter**: `LOWER({Username}) = LOWER("{{ $json.body.username }}")` ✓
- **Limit**: 1 ✓

### AI Agent Node
- **Prompt**: Configured with validation logic ✓
- **Output Parser**: JSON schema configured ✓
- **Temperature**: 0 (for consistent output) ✓

### Code Node
- **Language**: JavaScript ✓
- **Function**: Cleans markdown, validates JSON ✓

### Respond to Webhook Node
- **Response Body**: `={{ $json }}` ✓
- **Response Code**: 200 ✓

## Workflow Flow

```
[Webhook] 
  → [Airtable: Get User by Username] (searches by username)
    → [AI Agent: Validate Credentials] (validates password)
      → [Code: Clean & Validate Response] (cleans output)
        → [Respond to Webhook] (returns JSON)
```

## Activate the Workflow

1. **Click "Active" toggle** in top-right (should turn green/blue)
2. **Save the workflow** (Ctrl+S or Cmd+S)
3. **Wait 10 seconds** for n8n to register the webhook

## Test the Workflow

### Test with valid credentials:
```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"Sagar","passcode":"pass@123"}'
```

### Expected Success Response:
```json
{
  "success": true,
  "user": {
    "id": "rec...",
    "email": "...",
    "username": "Sagar",
    "role": "...",
    "clientId": "...",
    "kamId": null,
    "nbfcId": null,
    "name": "..."
  }
}
```

### Expected Error Response:
```json
{
  "success": false,
  "error": "Invalid username or passcode"
}
```

## Troubleshooting

### Webhook returns 404
- Check workflow is **Active** (toggle ON)
- Check webhook path is exactly `validate`
- Wait 10+ seconds after activating

### Always returns "Invalid username or passcode"
1. **Check Airtable node**:
   - Verify it's finding the user (check execution logs)
   - Check Username field name matches in Airtable
   - Check Password field name matches in Airtable

2. **Check AI Agent**:
   - Verify it receives Airtable data
   - Check execution logs to see what data it got
   - Verify password comparison logic

3. **Check field names**:
   - Airtable field names must match: `Username`, `Password`, `Email`, `Role`, etc.
   - If your fields have different names, update the AI prompt

### Response has markdown wrapping
- Code node should strip it automatically
- Check Code node is executing (check execution logs)
- Verify Code node JavaScript is correct

### Email validation error
- Output parser schema makes email nullable
- Code node handles null emails
- Should not cause errors

## Customization

### Change Airtable Table
1. Update **Airtable node**:
   - Change `table` value to your table ID
   - Update filter formula if needed

2. Update **AI Agent prompt**:
   - Change field names if your Airtable uses different names
   - Update field mapping section

### Change AI Model
1. Update **OpenAI Chat Model node**:
   - Change `model` value (e.g., `gpt-4`, `gpt-3.5-turbo`)

### Add More Validation
1. Update **AI Agent prompt**:
   - Add additional validation rules
   - Add more field mappings

## Field Mapping Reference

The workflow maps these Airtable fields:
- `id` → `user.id`
- `Email` → `user.email`
- `Username` → `user.username`
- `Role` → `user.role`
- `Client ID` or `ClientId` → `user.clientId`
- `KAM ID` or `KAMId` → `user.kamId`
- `NBFC ID` or `NBFCId` → `user.nbfcId`
- `Name` → `user.name`

If your Airtable uses different field names, update the AI Agent prompt.

## Support

If you encounter issues:
1. Check n8n execution logs
2. Verify all credentials are configured
3. Check Airtable field names match
4. Test Airtable node separately to ensure it finds users
5. Test AI Agent with sample data to see what it returns

