# 🧪 Macha Test - Webhook Testing Guide

## Overview

**Macha Test** is a reusable script for testing GET and POST webhooks. Use it to quickly verify webhook functionality across multiple endpoints.

## Quick Start

### Test GET Webhook
```bash
node macha-test.js GET <webhook-url>
```

**Example:**
```bash
node macha-test.js GET https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52
```

### Test POST Webhook (with default data)
```bash
node macha-test.js POST <webhook-url>
```

**Example:**
```bash
node macha-test.js POST https://fixrrahul.app.n8n.cloud/webhook/POSTLOG
```

### Test POST Webhook (with custom data file)
```bash
node macha-test.js POST <webhook-url> <test-data-file.json>
```

**Example:**
```bash
node macha-test.js POST https://fixrrahul.app.n8n.cloud/webhook/POSTLOG test-data.json
```

## Test Data Format

### Default POST Data
If no test data file is provided, the script uses this default structure:
```json
{
  "id": "TEST-<timestamp>",
  "Activity ID": "ACT-TEST-<timestamp>",
  "Timestamp": "<ISO timestamp>",
  "Performed By": "Macha Test User",
  "Action Type": "Test Action",
  "Description/Details": "Macha test execution",
  "Target Entity": "Test Entity"
}
```

### Custom Test Data File
Create a JSON file with your test data:
```json
{
  "id": "CUSTOM-ID-123",
  "Activity ID": "ACT-CUSTOM-123",
  "Timestamp": "2025-12-02T12:00:00.000Z",
  "Performed By": "Custom User",
  "Action Type": "Custom Action",
  "Description/Details": "Custom test data",
  "Target Entity": "Custom Entity"
}
```

## Output

The script provides:
- ✅ Success/failure status
- 📋 Full response data
- ⚠️  Warnings if fields are empty (for Airtable responses)
- 📊 Summary of test results

## Examples

### Example 1: Test GET Webhook
```bash
$ node macha-test.js GET https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52

🧪 Macha Test - GET Webhook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52

📤 Sending GET request...
✅ GET request successful

📋 Response:
{
  "records": [...]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test Result:
   ✅ Success
```

### Example 2: Test POST Webhook
```bash
$ node macha-test.js POST https://fixrrahul.app.n8n.cloud/webhook/POSTLOG

🧪 Macha Test - POST Webhook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Webhook URL: https://fixrrahul.app.n8n.cloud/webhook/POSTLOG

📤 Sending POST request...
📋 Data: {
  "id": "TEST-1735819200000",
  "Activity ID": "ACT-TEST-1735819200000",
  ...
}

✅ POST request successful

📋 Response:
{
  "id": "rec...",
  "createdTime": "2025-12-02T12:00:00.000Z",
  "fields": {
    "Activity ID": "ACT-TEST-1735819200000",
    "Timestamp": "2025-12-02T12:00:00.000Z",
    ...
  }
}

✅ Fields populated: 6 fields
   Fields: Activity ID, Timestamp, Performed By, Action Type, Description/Details, Target Entity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Test Result:
   ✅ Success
```

## Common Use Cases

### Test Multiple Webhooks
```bash
# Test GET webhook
node macha-test.js GET https://fixrrahul.app.n8n.cloud/webhook/GET-ENDPOINT

# Test POST webhook
node macha-test.js POST https://fixrrahul.app.n8n.cloud/webhook/POST-ENDPOINT

# Test with custom data
node macha-test.js POST https://fixrrahul.app.n8n.cloud/webhook/POST-ENDPOINT custom-data.json
```

### Verify Field Mapping
The script automatically checks if fields are populated in Airtable responses:
- ✅ Shows count of populated fields
- ⚠️  Warns if fields object is empty (indicates n8n mapping issue)

## Troubleshooting

### Empty Fields Warning
If you see `⚠️ Warning: Fields object is empty`, check:
1. n8n workflow is active
2. Field mapping in n8n "Create or Update Record" node
3. Field names match between POST data and Airtable columns

### 404 Error
- Check webhook URL is correct
- Verify n8n workflow is active
- Ensure webhook node is connected in workflow

### 500 Error
- Check n8n workflow execution logs
- Verify all nodes are properly configured
- Check Airtable connection credentials

## Notes

- The script uses `node-fetch` for HTTP requests
- All timestamps are in ISO format
- Test data includes unique IDs to prevent conflicts
- Exit code 0 = success, 1 = failure (useful for CI/CD)

