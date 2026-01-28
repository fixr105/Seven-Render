# n8n Notifications Webhook Configuration Guide

**Date:** 2026-01-27  
**Issue:** Notifications POST webhook has no field mappings configured  
**Status:** ⚠️ **REQUIRES MANUAL CONFIGURATION IN n8n**

## Problem

The "Post Notifications" Airtable node in the n8n workflow has empty field mappings (`"value": {}`). This means when the backend calls `POST /webhook/notification`, the data is sent but not saved to Airtable because n8n doesn't know which fields to map.

## Solution

Configure all 15 field mappings in the "Post Notifications" Airtable node.

## Step-by-Step Instructions

### 1. Open n8n Workflow

1. Log into your n8n instance
2. Navigate to the workflow that contains the POST webhooks
3. Find the "Post Notifications" Airtable node (it should be connected to the `/webhook/notification` webhook node)

### 2. Edit the Airtable Node

1. Click on the "Post Notifications" Airtable node
2. The node configuration panel will open

### 3. Configure Operation Settings

1. **Operation**: Set to `upsert` (this allows both create and update)
2. **Base**: Select "Seven Dashboard" (or your Airtable base)
3. **Table**: Select "Notifications"
4. **Matching Columns**: Set to `["id"]` (this tells Airtable to match on the `id` field for upsert)

### 4. Configure Field Mappings

1. **Mapping Mode**: Select `"Define Below"` (not "Auto-map")
2. In the **Columns** section, add the following mappings:

| Airtable Field | n8n Expression |
|----------------|----------------|
| `id` | `={{ $json.body.id }}` |
| `Notification ID` | `={{ $json.body['Notification ID'] }}` |
| `Recipient User` | `={{ $json.body['Recipient User'] }}` |
| `Recipient Role` | `={{ $json.body['Recipient Role'] }}` |
| `Related File` | `={{ $json.body['Related File'] }}` |
| `Related Client` | `={{ $json.body['Related Client'] }}` |
| `Related Ledger Entry` | `={{ $json.body['Related Ledger Entry'] }}` |
| `Notification Type` | `={{ $json.body['Notification Type'] }}` |
| `Title` | `={{ $json.body['Title'] }}` |
| `Message` | `={{ $json.body['Message'] }}` |
| `Channel` | `={{ $json.body['Channel'] }}` |
| `Is Read` | `={{ $json.body['Is Read'] }}` |
| `Created At` | `={{ $json.body['Created At'] }}` |
| `Read At` | `={{ $json.body['Read At'] }}` |
| `Action Link` | `={{ $json.body['Action Link'] }}` |

### 5. Save and Activate

1. Click "Save" to save the node configuration
2. If the workflow is not active, click "Activate" to activate it
3. The webhook will now be live and ready to receive POST requests

## Verification

### Test the Webhook

You can test the webhook by making a POST request:

```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/notification \
  -H "Content-Type: application/json" \
  -d '{
    "id": "NOTIF-TEST-001",
    "Notification ID": "NOTIF-TEST-001",
    "Recipient User": "test@example.com",
    "Recipient Role": "KAM",
    "Related File": "FILE001",
    "Related Client": "CL001",
    "Related Ledger Entry": "",
    "Notification Type": "file_update",
    "Title": "Test Notification",
    "Message": "This is a test notification",
    "Channel": "In-App",
    "Is Read": "False",
    "Created At": "2026-01-27T12:00:00.000Z",
    "Read At": "",
    "Action Link": "/files/FILE001"
  }'
```

### Check Airtable

1. Open Airtable → "Notifications" table
2. Look for the test notification
3. Verify all 15 fields are populated correctly

## Expected Backend Payload

The backend sends the following payload structure (from `n8nClient.postNotification()`):

```typescript
{
  id: string,                          // for matching (upsert)
  'Notification ID': string,
  'Recipient User': string,
  'Recipient Role': string,
  'Related File': string,
  'Related Client': string,
  'Related Ledger Entry': string,
  'Notification Type': string,
  'Title': string,
  'Message': string,
  'Channel': string,
  'Is Read': string,
  'Created At': string,
  'Read At': string,
  'Action Link': string
}
```

All fields are sent in the webhook body, so the n8n expressions above will correctly extract them.

## Troubleshooting

### Issue: Notifications still not saving

**Check:**
1. Verify workflow is active
2. Verify field mappings are correct (check for typos in field names)
3. Check n8n execution logs for errors
4. Verify Airtable table schema matches field names exactly

### Issue: Some fields are empty

**Check:**
1. Verify backend is sending all fields (check backend logs)
2. Verify field names match exactly (case-sensitive)
3. Check n8n execution data to see what's being received

### Issue: Upsert not working

**Check:**
1. Verify `id` field is being sent by backend
2. Verify "Matching Columns" is set to `["id"]`
3. Check that `id` field exists in Airtable table schema

## Notes

- Field names in n8n expressions must match Airtable column names exactly (including spaces and capitalization)
- The `id` field is used for upsert matching - if `id` exists, record is updated; if not, new record is created
- All 15 fields should be mapped to ensure complete notification data is saved
