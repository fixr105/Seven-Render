# NBFC Partners Webhook Verification

**Date:** 2025-12-02  
**Status:** ✅ Active and Working

## Webhook Details

- **URL:** `https://fixrrahul.app.n8n.cloud/webhook/NBFCPartners`
- **Method:** POST
- **Status:** ✅ Active (200 OK)

## Field Mapping

The webhook expects the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Used for matching/upserting records |
| `Lender ID` | string | Yes | Unique identifier for the NBFC partner |
| `Lender Name` | string | Yes | Name of the NBFC partner |
| `Contact Person` | string | No | Primary contact person name |
| `Contact Email/Phone` | string | No | Contact email and/or phone number |
| `Address/Region` | string | No | Address or region of the NBFC |
| `Active` | string | Yes | Status: 'True' or 'False' |

## Test Results

### Test Data Sent:
```json
{
  "id": "APP-TEST-1764691413960",
  "Lender ID": "NBFC-TEST-001",
  "Lender Name": "Test NBFC Partner",
  "Contact Person": "John Doe",
  "Contact Email/Phone": "john.doe@nbfc.com / +91-9876543210",
  "Address/Region": "Mumbai, Maharashtra",
  "Active": "True"
}
```

### Response Received:
```json
{
  "id": "recrckKlxhcF2MnDj",
  "createdTime": "2025-12-02T16:03:36.000Z",
  "fields": {
    "Lender ID": "NBFC-TEST-001",
    "Lender Name": "Test NBFC Partner",
    "Contact Person": "John Doe",
    "Contact Email/Phone": "john.doe@nbfc.com / +91-9876543210",
    "Address/Region": "Mumbai, Maharashtra",
    "Active": "True"
  }
}
```

### Result:
- ✅ **Status:** 200 OK
- ✅ **Record Created:** `recrckKlxhcF2MnDj`
- ✅ **All Fields Mapped Correctly**
- ✅ **Response Structure Valid**

## Backend Implementation

### Configuration
**File:** `backend/src/config/airtable.ts`
```typescript
postNBFCPartnersUrl: 'https://fixrrahul.app.n8n.cloud/webhook/NBFCPartners'
```

### Service Method
**File:** `backend/src/services/airtable/n8nClient.ts`
```typescript
async postNBFCPartner(data: Record<string, any>) {
  const nbfcPartnerData = {
    id: data.id,
    'Lender ID': data['Lender ID'] || data.lenderId || data.id,
    'Lender Name': data['Lender Name'] || data.lenderName || '',
    'Contact Person': data['Contact Person'] || data.contactPerson || '',
    'Contact Email/Phone': data['Contact Email/Phone'] || data.contactEmailPhone || '',
    'Address/Region': data['Address/Region'] || data.addressRegion || '',
    'Active': data['Active'] || data.active || 'True',
  };
  return this.postData(n8nConfig.postNBFCPartnersUrl, nbfcPartnerData);
}
```

## Usage in Backend

### Creating NBFC Partner
```typescript
import { n8nClient } from '../services/airtable/n8nClient';

const result = await n8nClient.postNBFCPartner({
  id: 'unique-id',
  'Lender ID': 'NBFC-001',
  'Lender Name': 'ABC Finance',
  'Contact Person': 'John Doe',
  'Contact Email/Phone': 'john@abcf.com / +91-9876543210',
  'Address/Region': 'Mumbai, Maharashtra',
  'Active': 'True',
});
```

## API Endpoints Using This Webhook

- `POST /credit/loan-applications/:id/assign-nbfcs` - Assigns NBFCs to applications
- `POST /credit/nbfc-partners` - Creates new NBFC partner (if implemented)
- Any endpoint that creates or updates NBFC partner records

## Verification Checklist

- [x] Webhook URL is correct (`/NBFCPartners`)
- [x] Webhook is active (200 OK response)
- [x] All 7 fields are correctly mapped
- [x] Response structure is valid (Airtable record format)
- [x] Backend configuration updated
- [x] Service method sends exact fields
- [x] Test script created and verified

## Notes

- The webhook uses the `id` field for matching/upserting records
- All fields except `id` and `Lender ID` are optional
- `Active` field defaults to 'True' if not provided
- Response includes Airtable record ID and created timestamp

## Next Steps

1. ✅ Webhook validated and activated
2. ✅ Backend configuration updated
3. ✅ Documentation created
4. ⚠️ Verify all endpoints using this webhook work correctly
5. ⚠️ Test integration with loan application assignment flow

---

## Troubleshooting: NBFC Partner not appearing in "NBFC Partners" table

If a user is created with role **NBFC Partner** and the record appears in **User Accounts** (UI and Airtable) but **not** in the **"NBFC Partners"** table, the backend has already received a successful response from the n8n POST webhook. The issue is almost always in the n8n workflow or Airtable configuration.

### 1. Confirm POST webhook URL

- Backend uses `N8N_POST_NBFC_PARTNERS_URL` (or `N8N_BASE_URL` + `/webhook/NBFCPartners`).
- In n8n, ensure the Webhook node that receives the POST is the one configured at that URL and that it is triggered by the same path (e.g. `/webhook/NBFCPartners`).

### 2. Confirm Airtable destination is the correct table

- The n8n workflow must write to the **same** Airtable base and **same** table that the GET webhook uses for "NBFC Partners".
- Login and `fetchTable('NBFC Partners')` both read from the GET webhook; that GET must return data from the same table the POST creates records in.
- In n8n: open the Airtable "Create record" (or "Update record") node that runs after the POST webhook. Verify:
  - **Base** is the same as the GET workflow’s Airtable node.
  - **Table** name or ID is exactly the one you use for "NBFC Partners" (e.g. same as in your GET workflow).
- If the POST writes to a different base or table, the record will exist in Airtable but will not appear in the app’s NBFC Partners list or in login resolution.

### 3. Check field names in the Airtable node

- Backend sends: `id`, `Lender ID`, `Lender Name`, `Contact Person`, `Contact Email/Phone`, `Address/Region`, `Active`.
- In the Airtable node, map these to the correct Airtable field names (they may differ by spelling or spaces, e.g. "Contact Email/Phone" vs "Contact Email / Phone"). Mismatched names can cause the create to fail or to write to the wrong fields.

### 4. Optional: Debug endpoint to verify table and lookup

When `NODE_ENV=development` and `DEBUG_ROUTES_ENABLED=true`, a GET endpoint is available:

- **GET** `/debug/nbfc-partners-check?email=user@example.com`
- It calls the same GET used for NBFC Partners and returns:
  - `totalRecords`: number of records in the response (confirms the table is read).
  - `queryEmail`: the email you passed.
  - `found`: if a record exists with matching Contact Email/Phone, its id, Lender ID, Lender Name, Contact Email/Phone; otherwise `null`.

Use this to confirm the "NBFC Partners" table is populated and that a given user email has a corresponding NBFC Partner record (e.g. after creating an NBFC user).

---

## Assigned NBFC and Loan Applications (NBFC dashboard visibility)

For an assigned application to appear on the **NBFC Partner dashboard**:

1. **NBFC Partner record must exist** (see Troubleshooting above). Login sets `nbfcId` from the NBFC Partners table (Lender ID) by matching Contact Email/Phone to the user’s email.
2. **Assignment must be persisted:** After `POST /credit/loan-applications/:id/assign-nbfcs`, the n8n workflow must update the Loan Application row so that the **Assigned NBFC** field is set (text or linked record).
3. **GET Loan Application must return a comparable value:** The NBFC dashboard filters applications where `Assigned NBFC` matches the logged-in user’s `nbfcId` (Lender ID). So either:
   - **Assigned NBFC** in Airtable is a **text** field and the workflow stores the Lender ID (e.g. `NBFC-xxx`), and the GET returns that string; or
   - **Assigned NBFC** is a **linked record** and the GET returns Airtable record id(s). The backend can resolve those to Lender IDs via the NBFC Partners table and match against `user.nbfcId`. If your n8n GET returns linked records as an array of record ids, ensure the backend RBAC filter resolves them to Lender ID (see `rbacFilter.service.ts`) so that matching works.

**n8n workflow (assign-nbfcs):** If the Airtable "Assigned NBFC" field is a **linked record** to the NBFC Partners table, the workflow must either:
- Accept Lender ID from the backend and look up the NBFC Partners record by Lender ID, then set the link using the Airtable record id, or
- Accept the backend payload as-is if the field is text and stores Lender ID.

**Manual test:** Create an NBFC user (with NBFC Partner record in the table), assign an application to that NBFC via Credit UI, log in as the NBFC user, open the NBFC dashboard, and confirm the application appears.

