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

