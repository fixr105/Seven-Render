# Webhook Data Fetch Status

## Current Status

The webhook data fetching is now implemented and active. The Applications page automatically fetches data from the webhook when it loads.

## Webhook URL
```
https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d
```

## Current Response

The webhook is currently returning **table structure metadata** instead of actual records:

```json
{
  "id": "tblz0e59ULgBcUvrY",
  "name": "Admin Activity log",
  "primaryFieldId": "fldX94b7K5y1SZzvH",
  "fields": [...],
  "views": [...]
}
```

This is table schema information, not actual data records.

## What Needs to Be Done

### In n8n Workflow:
1. The "Respond to Webhook" node needs to be configured to return **actual records** from the Airtable table
2. The response should include a `records` array with actual data, not just table structure
3. Expected format:
   ```json
   {
     "records": [
       {
         "id": "recXXX",
         "fields": {
           "File ID": "SF12345",
           "Applicant Name": "John Doe",
           "Requested Loan Amount": 500000,
           "Status": "Pending KAM Review",
           ...
         }
       }
     ]
   }
   ```

## Current Implementation

### Files Updated:
- `src/hooks/useWebhookData.ts` - Enhanced to handle various response formats and provide better error messages
- `src/pages/Applications.tsx` - Shows loading, error, and success states with data count

### Features:
- ✅ Automatic fetch on page load
- ✅ Loading state indicator
- ✅ Error handling with retry button
- ✅ Success message showing data count
- ✅ Manual refresh button
- ✅ Console logging for debugging

### How to Test:
1. Navigate to `/applications` page
2. Check the browser console for webhook response details
3. The page will show:
   - Loading spinner while fetching
   - Error message if webhook returns structure instead of records
   - Success message with count if records are found
   - Empty state if no records found

## Next Steps

Once the n8n workflow is configured to return actual records:
1. The Applications page will automatically display the data
2. Data will be transformed from Airtable format to application format
3. Status values will be mapped to system status codes
4. All fields will be displayed in the table

## Field Mapping

The hook maps Airtable fields to application fields:
- `File ID` → `file_number`
- `Applicant Name` → `applicant_name`
- `Requested Loan Amount` → `requested_loan_amount`
- `Status` → `status` (with status mapping)
- `Client` → `client.company_name`
- `Loan Product` → `loan_product.name`

## Debugging

To debug webhook responses:
1. Open browser console (F12)
2. Navigate to Applications page
3. Look for console logs:
   - "Fetching webhook data from: ..."
   - "Webhook response: ..."
   - "Found X records from webhook"
   - "Transformed X applications"

