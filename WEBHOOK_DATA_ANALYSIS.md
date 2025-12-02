# Webhook Data Analysis

## Current Webhook Response

**URL**: `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d`

**HTTP Status**: 200 OK

**Response Format**: Single record in flat format (fields directly on object)

## Raw Data Structure

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

## Data Fields Breakdown

| Field Name | Value | Type | Description |
|------------|-------|------|-------------|
| `id` | `recAyM1n2jsx5e7RD` | string | Airtable record ID |
| `createdTime` | `2025-12-01T07:03:53.000Z` | ISO 8601 timestamp | Record creation timestamp |
| `Mapping ID` | `MAP002` | string | Mapping identifier |
| `Client` | `CL001` | string | Client code/identifier |
| `Category` | `C002` | string | Category code |
| `Is Required` | `True` | string | Required flag (as string) |
| `Display Order` | `2` | string | Display order (as string) |

## How the Code Processes This Data

### 1. Detection
The code detects this as a **single record in flat format** because:
- It has an `id` field
- It does NOT have a `fields` property
- It's not an array

### 2. Transformation
The code transforms it to Airtable record format:
```javascript
{
  id: "recAyM1n2jsx5e7RD",
  fields: {
    "Mapping ID": "MAP002",
    "Client": "CL001",
    "Category": "C002",
    "Is Required": "True",
    "Display Order": "2"
  },
  createdTime: "2025-12-01T07:03:53.000Z"
}
```

### 3. Application Mapping
The transformed record is then mapped to `LoanApplicationFromWebhook` format:
```javascript
{
  id: "recAyM1n2jsx5e7RD",
  file_number: "MAP002",        // from "Mapping ID"
  applicant_name: "CL001",      // from "Client" (fallback)
  status: "draft",              // default (no Status field)
  created_at: "2025-12-01T07:03:53.000Z",
  updated_at: "2025-12-01T07:03:53.000Z",
  client: {
    company_name: "CL001"       // from "Client"
  },
  category: "C002",             // additional field
  is_required: "True",          // additional field
  display_order: "2"            // additional field
}
```

### 4. Display in Applications Table
The Applications page will display:
- **Client**: CL001
- **Applicant**: CL001
- **Loan Type**: C002 (from Category)
- **File Number**: MAP002
- **Amount**: N/A (no amount field)
- **Status**: Draft
- **Last Update**: 01-Dec-2025

## Data Type Notes

1. **String vs Boolean**: `Is Required` is returned as string `"True"` not boolean `true`
2. **String vs Number**: `Display Order` is returned as string `"2"` not number `2`
3. **Timestamp Format**: `createdTime` is in ISO 8601 format (UTC)

## What This Data Represents

This appears to be a **mapping/configuration record** rather than a loan application record. It contains:
- Mapping configuration (Mapping ID)
- Client reference (Client)
- Category classification (Category)
- Display settings (Is Required, Display Order)

## Expected Loan Application Fields

If this were a loan application, we would expect fields like:
- `File ID` or `File Number`
- `Applicant Name`
- `Requested Loan Amount`
- `Status`
- `Loan Product`
- `Client Name` (full name, not code)

## Current Status

✅ **Webhook is working** - Returns HTTP 200 with data
✅ **Code handles the format** - Correctly processes flat format records
✅ **Data is transformed** - Maps to application structure
⚠️ **Data type mismatch** - This is mapping data, not loan application data

## Next Steps

1. **If you want loan applications**: Configure n8n to return records from the "Loan Applications" table with fields like:
   - File ID / File Number
   - Applicant Name
   - Requested Loan Amount
   - Status
   - Client (full name)
   - Loan Product

2. **If you want to use this mapping data**: The code will display it, but you may want to create a separate page/component for mapping/configuration data.

