# Webhook to Database Sync System

## Overview

The system now has a unified data flow that:
1. **Fetches data from webhook** - Gets data from n8n webhook
2. **Maps webhook fields to database** - Converts webhook format to Supabase schema
3. **Syncs to database automatically** - Saves webhook data to Supabase
4. **Combines both sources** - Shows data from both webhook and database
5. **Dashboard creates directly to DB** - New applications from dashboard go straight to database

## Architecture

### Data Flow

```
┌─────────────┐
│   Webhook   │ (n8n)
│   (GET)     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ useWebhookData  │ (Fetches from webhook)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  webhookSync    │ (Maps & converts)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Supabase DB   │ (Stores data)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ useUnifiedApps  │ (Combines webhook + DB)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Applications   │ (Displays unified data)
│     Page        │
└─────────────────┘

┌─────────────────┐
│ NewApplication  │ (Dashboard form)
│     Page        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Supabase DB   │ (Direct insert)
└─────────────────┘
```

## Field Mapping

### Webhook → Database Mapping

| Webhook Field | Database Column | Notes |
|---------------|----------------|-------|
| `File ID` / `File Number` | `file_number` | Primary identifier |
| `Mapping ID` | `file_number` | Fallback mapping |
| `Applicant Name` | `applicant_name` | Direct mapping |
| `Requested Loan Amount` | `requested_loan_amount` | Parsed as number |
| `Status` | `status` | Mapped via statusMap |
| `Client` / `Client Name` | `client_id` | Resolved via lookup |
| `Loan Product` / `Loan Type` | `loan_product_id` | Resolved via lookup |
| `Category` | `form_data.category` | Additional field |
| `Creation Date` / `Timestamp` | `created_at` | ISO format |
| `Last Updated` | `updated_at` | ISO format |
| `Assigned Credit Analyst` | `assigned_credit_analyst` | Direct mapping |
| `Assigned NBFC` | `assigned_nbfc_id` | Resolved via lookup |
| `Lender Decision Status` | `lender_decision_status` | Direct mapping |
| `Lender Decision Date` | `lender_decision_date` | Date format |
| `Lender Decision Remarks` | `lender_decision_remarks` | Text |
| `Approved Loan Amount` | `approved_loan_amount` | Number |
| `AI File Summary` | `ai_file_summary` | Text |
| Other fields | `form_data.*` | Stored in JSONB |

## Status Mapping

Webhook status values are mapped to database status codes:

| Webhook Status | Database Status |
|----------------|----------------|
| `Draft` | `draft` |
| `Pending KAM Review` | `pending_kam_review` |
| `KAM Query Raised` | `kam_query_raised` |
| `Forwarded to Credit` | `forwarded_to_credit` |
| `Credit Query Raised` | `credit_query_raised` |
| `In Negotiation` | `in_negotiation` |
| `Sent to NBFC` | `sent_to_nbfc` |
| `Approved` / `NBFC Approved` | `approved` |
| `Rejected` / `NBFC Rejected` | `rejected` |
| `Disbursed` | `disbursed` |
| `Closed` / `Closed/Archived` | `closed` |

## Automatic Sync

### When Sync Happens

1. **On Page Load** - When Applications page loads, webhook data is automatically synced
2. **On Refresh** - When user clicks refresh button
3. **Manual Sync** - Can be triggered programmatically

### Sync Behavior

- **Upsert Mode**: Updates existing records, creates new ones
- **Deduplication**: Uses `file_number` or `webhook_id` to identify duplicates
- **Error Handling**: Failed syncs are logged but don't block the UI
- **Background Sync**: Happens automatically without user intervention

## Dashboard → Database Flow

### New Application Creation

When a user creates an application from the dashboard (`NewApplication` page):

1. **Form Submission** → Data collected from form
2. **File Number Generation** → Auto-generated (e.g., `SF12345678`)
3. **Direct DB Insert** → Saved directly to `loan_applications` table
4. **Audit Log** → Entry created in `audit_logs` table
5. **Immediate Display** → Appears in Applications list immediately

**No webhook involved** - Dashboard creations go straight to database.

## Unified Data Display

### Data Sources

The Applications page shows data from:
1. **Database** (Primary source) - All applications stored in Supabase
2. **Webhook** (Secondary source) - Data fetched from n8n, synced to DB

### Merging Logic

- Database records are shown as-is (source: `database`)
- Webhook records that exist in DB are marked as `synced`
- Webhook records not yet in DB are shown temporarily (source: `webhook`)
- Duplicates are merged based on `file_number` or `id`

## Files Created/Modified

### New Files
- `src/lib/webhookSync.ts` - Webhook to database sync utility
- `src/hooks/useUnifiedApplications.ts` - Unified data hook

### Modified Files
- `src/pages/Applications.tsx` - Now uses unified hook
- `src/hooks/useWebhookData.ts` - Enhanced field mapping

## Usage

### In Applications Page

```typescript
const { 
  applications,      // Unified list (webhook + DB)
  loading,          // Loading state
  error,            // Error messages
  syncing,          // Sync in progress
  lastSyncTime,     // When last sync happened
  refetch,          // Manual refresh
  webhookCount,     // Number from webhook
  dbCount          // Number from database
} = useUnifiedApplications({
  autoSync: true,      // Auto-sync on mount
  syncOnMount: true   // Sync when component loads
});
```

### Manual Sync

```typescript
import { syncWebhookRecordsToDB } from '../lib/webhookSync';

const results = await syncWebhookRecordsToDB(webhookRecords, {
  upsert: true,           // Update existing
  updateExisting: true    // Update if exists
});

console.log(`Synced: ${results.success}, Failed: ${results.failed}`);
```

## Benefits

1. **Single Source of Truth** - Database is the primary source
2. **Automatic Sync** - Webhook data automatically saved to DB
3. **Real-time Updates** - Dashboard creations appear immediately
4. **Data Integrity** - Deduplication prevents duplicates
5. **Flexible Mapping** - Handles various webhook field formats
6. **Error Resilience** - Failed syncs don't break the UI

## Current Webhook Data

The webhook currently returns:
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

This will be:
- Mapped to database format
- Synced to `loan_applications` table
- Displayed in Applications page
- Stored with `file_number: "MAP002"`

## Next Steps

1. **Configure n8n** to return loan application records with proper fields
2. **Test sync** with actual loan application data
3. **Monitor sync logs** in browser console
4. **Verify data** appears correctly in Applications table

