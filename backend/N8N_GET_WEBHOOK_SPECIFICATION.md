# n8n GET Webhook Specification

## Overview

The GET webhook (`https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52`) is used by the backend to fetch all data from Airtable in a single request.

## Current Issue

**Problem**: The GET webhook currently returns arrays directly (one table per request), which causes:
- Login failures (can't find User Accounts)
- Incomplete data for endpoints that need multiple tables
- Multiple requests needed to get all data

**Example of Current Response**:
```json
[
  {
    "id": "rec...",
    "Notification ID": "NOTIF001",
    "Recipient User": "user@example.com",
    ...
  }
]
```

## Expected Response Format

The GET webhook **must return ALL tables in a single structured response**:

```json
{
  "User Accounts": [
    {
      "id": "rec...",
      "Username": "client@test.com",
      "Password": "password123",
      "Role": "client",
      "Associated Profile": "Test Client",
      "Account Status": "Active"
    }
  ],
  "Notifications": [
    {
      "id": "rec...",
      "Notification ID": "NOTIF001",
      "Recipient User": "user@example.com",
      "Recipient Role": "Client",
      "Related File": "FILE001",
      "Notification Type": "File Status",
      "Title": "New Loan File Submitted",
      "Message": "Client CL001 submitted FILE001 for Home Loan.",
      "Channel": "In-App",
      "Is Read": "False",
      "Created At": "2025-01-10T10:12:00.000Z",
      "Action Link": "/files/FILE001"
    }
  ],
  "Clients": [
    {
      "id": "rec...",
      "Client ID": "CL001",
      "Client Name": "Test Client",
      "Primary Contact Name": "John Doe",
      "Contact Email / Phone": "client@test.com",
      "Assigned KAM": "KAM001",
      "Enabled Modules": "Module1,Module2",
      "Commission Rate": "1.5",
      "Status": "Active",
      "Form Categories": "Category1,Category2"
    }
  ],
  "Loan Applications": [
    {
      "id": "rec...",
      "File ID": "FILE001",
      "Client": "CL001",
      "Applicant Name": "John Doe",
      "Loan Product": "PROD001",
      "Requested Loan Amount": "500000",
      "Documents": "doc1.pdf,doc2.pdf",
      "Status": "pending_kam_review",
      "Assigned Credit Analyst": "CREDIT001",
      "Assigned NBFC": "NBFC001",
      "Lender Decision Status": "Pending",
      "Lender Decision Date": "",
      "Lender Decision Remarks": "",
      "Approved Loan Amount": "",
      "AI File Summary": "",
      "Form Data": "{\"field1\":\"value1\"}",
      "Creation Date": "2025-01-10T10:00:00.000Z",
      "Submitted Date": "2025-01-10T10:12:00.000Z",
      "Last Updated": "2025-01-10T10:12:00.000Z"
    }
  ],
  "KAM Users": [
    {
      "id": "rec...",
      "KAM ID": "KAM001",
      "Name": "John KAM",
      "Email": "kam@test.com",
      "Phone": "+1234567890",
      "Managed Clients": "CL001,CL002",
      "Role": "KAM",
      "Status": "Active"
    }
  ],
  "Credit Team Users": [
    {
      "id": "rec...",
      "Credit User ID": "CREDIT001",
      "Name": "Jane Credit",
      "Email": "credit@test.com",
      "Phone": "+1234567890",
      "Role": "Credit",
      "Status": "Active"
    }
  ],
  "NBFC Partners": [
    {
      "id": "rec...",
      "Lender ID": "NBFC001",
      "Lender Name": "Test NBFC",
      "Contact Person": "NBFC Contact",
      "Contact Email/Phone": "nbfc@test.com",
      "Address/Region": "Mumbai",
      "Active": "True"
    }
  ],
  "Loan Products": [
    {
      "id": "rec...",
      "Product ID": "PROD001",
      "Product Name": "Home Loan",
      "Description": "Home loan product",
      "Active": "True",
      "Required Documents/Fields": "doc1,doc2"
    }
  ],
  "Form Categories": [
    {
      "id": "rec...",
      "Category ID": "CAT001",
      "Category Name": "Personal Information",
      "Description": "Personal details",
      "Display Order": "1",
      "Active": "True"
    }
  ],
  "Form Fields": [
    {
      "id": "rec...",
      "Field ID": "FIELD001",
      "Category": "Personal Information",
      "Field Label": "Full Name",
      "Field Type": "text",
      "Field Placeholder": "Enter your full name",
      "Field Options": "",
      "Is Mandatory": "True",
      "Display Order": "1",
      "Active": "True"
    }
  ],
  "File Audit Log": [
    {
      "id": "rec...",
      "Log Entry ID": "LOG001",
      "File": "FILE001",
      "Timestamp": "2025-01-10T10:12:00.000Z",
      "Actor": "user@example.com",
      "Action/Event Type": "File Submitted",
      "Details/Message": "File submitted for review",
      "Target User/Role": "KAM",
      "Resolved": "False"
    }
  ],
  "Admin Activity log": [
    {
      "id": "rec...",
      "Activity ID": "ACT001",
      "Timestamp": "2025-01-10T10:12:00.000Z",
      "Performed By": "admin@example.com",
      "Action Type": "User Created",
      "Description/Details": "Created new user",
      "Target Entity": "User Accounts"
    }
  ],
  "COMISSIONLEDGER": [
    {
      "id": "rec...",
      "Entry ID": "ENTRY001",
      "Client": "CL001",
      "Transaction Type": "Payout",
      "Amount": "5000",
      "Date": "2025-01-10T10:12:00.000Z",
      "Related File": "FILE001",
      "Status": "Pending",
      "Dispute Status": "None"
    }
  ],
  "Daily Summary Reports": [
    {
      "id": "rec...",
      "Report Date": "2025-01-10",
      "Summary Content": "Daily summary report",
      "Generated Timestamp": "2025-01-10T18:00:00.000Z",
      "Delivered To": "admin@example.com"
    }
  ],
  "Client Form Mapping": [
    {
      "id": "rec...",
      "Mapping ID": "MAP001",
      "Client": "CL001",
      "Category": "Personal Information",
      "Is Required": "True",
      "Display Order": "1"
    }
  ]
}
```

## Required Tables

The GET webhook **must** return all of these tables in a single response:

1. **User Accounts** - Required for authentication/login
2. **Clients** - Required for client management
3. **Loan Applications** - Required for loan workflow
4. **KAM Users** - Required for KAM operations
5. **Credit Team Users** - Required for credit operations
6. **NBFC Partners** - Required for NBFC operations
7. **Loan Products** - Required for product selection
8. **Form Categories** - Required for form configuration
9. **Form Fields** - Required for form rendering
10. **Notifications** - Required for notification system
11. **File Audit Log** - Required for audit trail
12. **Admin Activity log** - Required for admin tracking
13. **COMISSIONLEDGER** - Required for commission tracking
14. **Daily Summary Reports** - Required for reporting
15. **Client Form Mapping** - Required for form customization

## Field Mappings

### Table Detection Logic

The backend automatically detects table types based on unique identifier fields:

| Table | Detection Field(s) |
|-------|-------------------|
| User Accounts | `Username` |
| Notifications | `Notification ID` or `Recipient User` |
| Loan Applications | `File ID` or `Client` |
| Clients | `Client ID` or `Client Name` |
| KAM Users | `KAM ID` or (`Email` + `Name` + `Role === 'KAM'`) |
| Credit Team Users | `Credit User ID` or (`Email` + `Name` + `Role === 'Credit'`) |
| NBFC Partners | `Lender ID` or `Lender Name` |
| Loan Products | `Product ID` or `Product Name` |
| Form Categories | `Category ID` or `Category Name` |
| Form Fields | `Field ID` or `Field Label` |
| File Audit Log | `Log Entry ID` or `Action/Event Type` |
| Admin Activity Log | `Activity ID` or `Performed By` |
| Commission Ledger | `Entry ID` or `Transaction Type` |
| Daily Summary Reports | `Report Date` or `Summary Content` |

## Implementation in n8n

### Recommended Workflow Structure

1. **Trigger**: Webhook node (GET method)
2. **Query All Tables**: Use Airtable "List Records" nodes for each table
3. **Combine Results**: Use "Merge" or "Set" node to combine all tables into one object
4. **Format Response**: Structure the response as shown above
5. **Respond to Webhook**: Return the structured JSON

### Example n8n Workflow

```
Webhook (GET) 
  ↓
Airtable: List Records (User Accounts)
  ↓
Airtable: List Records (Clients)
  ↓
Airtable: List Records (Loan Applications)
  ↓
... (all other tables)
  ↓
Merge/Set Node: Combine all into structured object
  ↓
Respond to Webhook: Return JSON
```

### Response Structure Code (JavaScript)

```javascript
// In n8n "Code" node or "Set" node
return {
  json: {
    "User Accounts": $input.item.json.records || [],
    "Clients": $input.item.json.records || [],
    "Loan Applications": $input.item.json.records || [],
    // ... all other tables
  }
};
```

## Testing

After updating the GET webhook, test with:

```bash
curl https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52
```

Expected response should be a JSON object with all table keys, not an array.

## Benefits

Once the GET webhook returns all tables:
- ✅ Login will work (User Accounts available)
- ✅ All endpoints will have access to required data
- ✅ Single request instead of multiple requests
- ✅ Better performance and reliability
- ✅ Consistent data structure across the application

## Migration Notes

If the current GET webhook returns arrays, the backend will attempt to detect and map them, but this is a **temporary workaround**. The proper solution is to update the n8n workflow to return all tables in the structured format shown above.

## Support

If you need help updating the n8n workflow, refer to:
- n8n documentation: https://docs.n8n.io/
- Airtable API documentation: https://airtable.com/api
- Backend code: `backend/src/services/airtable/n8nClient.ts`

