# Database Remapping Plan

## Overview
This document outlines the plan to remap webhook data (from Airtable via n8n) to our Supabase database schema.

## Webhook Analysis

### Current Webhook Response
The webhook at `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d` returns Airtable table structures.

**Example Response:**
```json
{
  "id": "tblz0e59ULgBcUvrY",
  "name": "Admin Activity log",
  "primaryFieldId": "fldX94b7K5y1SZzvH",
  "fields": [
    {"type": "multilineText", "id": "fldX94b7K5y1SZzvH", "name": "Activity ID"},
    {"type": "multilineText", "id": "fldtu6frxUpgVRM6M", "name": "Timestamp"},
    {"type": "multilineText", "id": "fld9NaFsqqz6yp0aj", "name": "Performed By"},
    {"type": "multilineText", "id": "fldiPxCTOSTCO3NkM", "name": "Action Type"},
    {"type": "multilineText", "id": "fldTLIgZbvBO6XfTY", "name": "Description/Details"},
    {"type": "multilineText", "id": "fldDLRIFnwbgyDMop", "name": "Target Entity"}
  ]
}
```

## Table Mapping

### 1. Admin Activity Log

| Airtable Field | Supabase Column | Type | Notes |
|---------------|----------------|------|-------|
| Activity ID | `id` | uuid | Auto-generated or use provided ID |
| Timestamp | `timestamp` | timestamptz | Parse date string |
| Performed By | `performed_by` | uuid FK | Link to user_roles.id |
| Action Type | `action_type` | text | Must match enum values |
| Description/Details | `description` | text | Direct mapping |
| Target Entity | `target_entity` | text | Direct mapping |

**Supabase Table:** `admin_activity_log`

### 2. Clients (Expected)

| Airtable Field | Supabase Column | Type | Notes |
|---------------|----------------|------|-------|
| Client ID | `id` | uuid | Auto-generated |
| Client Name | `company_name` | text | Required |
| Primary Contact Name | `contact_person` | text | Required |
| Contact Email / Phone | `email`, `phone` | text | Split if combined |
| Assigned KAM | `kam_id` | uuid FK | Link to user_roles |
| Enabled Modules | `modules_enabled` | jsonb | Convert array to JSON |
| Commission Rate | `commission_rate` | numeric | Convert % to decimal |
| Status | `is_active` | boolean | Active = true, Inactive = false |

**Supabase Table:** `dsa_clients`

### 3. Loan Applications (Expected)

| Airtable Field | Supabase Column | Type | Notes |
|---------------|----------------|------|-------|
| File ID | `file_number` | text | Required, unique |
| Client | `client_id` | uuid FK | Link to dsa_clients |
| Applicant Name | `applicant_name` | text | Required |
| Loan Product | `loan_product_id` | uuid FK | Link to loan_products |
| Requested Loan Amount | `requested_loan_amount` | numeric | Parse currency |
| Status | `status` | text | Map to system status codes |
| Assigned Credit Analyst | `assigned_credit_analyst` | uuid FK | Link to user_roles |
| Assigned NBFC | `assigned_nbfc_id` | uuid FK | Link to nbfc_partners |
| Lender Decision Status | `lender_decision_status` | text | Optional |
| Lender Decision Date | `lender_decision_date` | date | Parse date |
| Lender Decision Remarks | `lender_decision_remarks` | text | Optional |
| Approved Loan Amount | `approved_loan_amount` | numeric | Optional |
| AI File Summary | `ai_file_summary` | text | Optional |
| Creation Date | `created_at` | timestamptz | Parse timestamp |
| Submitted Date | `submitted_at` | timestamptz | Optional |
| Last Updated | `updated_at` | timestamptz | Parse timestamp |

**Supabase Table:** `loan_applications`

## Status Mapping

### Loan Application Status
| Airtable Value | Supabase Value |
|---------------|----------------|
| Draft | `draft` |
| Submitted / Pending KAM Review | `pending_kam_review` |
| KAM Query Raised | `kam_query_raised` |
| Approved by KAM / Forwarded to Credit | `forwarded_to_credit` |
| Credit Query Raised | `credit_query_raised` |
| In Negotiation | `in_negotiation` |
| Sent to NBFC | `sent_to_nbfc` |
| NBFC Approved | `approved` |
| NBFC Rejected | `rejected` |
| Disbursed | `disbursed` |
| Closed/Archived | `closed` |

## Implementation Steps

### Phase 1: Cleanup ✅
- [x] Remove placeholder data from Applications.tsx
- [x] Create SQL script to clean test data
- [x] Update Applications page to use real data

### Phase 2: Webhook Integration
- [ ] Fetch actual data records from webhook (not just table structure)
- [ ] Create data transformation functions
- [ ] Map Airtable fields to Supabase columns
- [ ] Handle foreign key relationships
- [ ] Validate data before import

### Phase 3: Data Import
- [ ] Create import utility function
- [ ] Handle batch imports
- [ ] Create audit trail for imports
- [ ] Handle errors and rollbacks

### Phase 4: Testing
- [ ] Test with sample data
- [ ] Verify all mappings work correctly
- [ ] Test foreign key relationships
- [ ] Verify data integrity

## Files Created

1. **`src/lib/webhookImporter.ts`** - Webhook data fetching and mapping utilities
2. **`scripts/clean-placeholder-data.sql`** - SQL script to remove test data
3. **`DATA_MAPPING_PLAN.md`** - This document

## Next Steps

1. **Get actual data records**: The webhook currently returns table structure. We need to configure n8n to return actual records.

2. **Test webhook with real data**: Once n8n returns actual records, test the mapping functions.

3. **Create import function**: Build the actual import logic once we see the data structure.

4. **Run cleanup script**: Execute `clean-placeholder-data.sql` in Supabase before importing.

## Notes

- The webhook currently returns table metadata, not actual records
- Need to configure n8n to return actual data rows
- Foreign key relationships need to be resolved during import
- Status values need to be normalized to match system enums
- Date/timestamp fields need proper parsing

