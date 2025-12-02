# Webhook Compatibility Analysis

## Webhook Details
- **URL**: `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d`
- **Method**: GET only
- **Status**: ✅ Active (returns "Workflow was started")

## Current Response
```json
{
  "message": "Workflow was started"
}
```

## Compatibility Analysis

### Current System Data Structure

The existing system uses Supabase as the database with the following main tables:

#### 1. **Loan Applications** (`loan_applications`)
```typescript
{
  id: string (uuid)
  file_number: string
  client_id: string (FK → dsa_clients)
  applicant_name: string
  loan_product_id: string (FK → loan_products)
  requested_loan_amount: number
  status: string
  assigned_credit_analyst: string (FK → user_roles)
  assigned_nbfc_id: string (FK → nbfc_partners)
  lender_decision_status: string
  lender_decision_date: date
  lender_decision_remarks: text
  approved_loan_amount: number
  ai_file_summary: text
  form_data: jsonb
  created_at: timestamptz
  submitted_at: timestamptz
  updated_at: timestamptz
}
```

#### 2. **Clients** (`dsa_clients`)
```typescript
{
  id: string (uuid)
  user_id: string (FK → user_roles)
  company_name: string
  contact_person: string
  email: string
  phone: string
  kam_id: string (FK → user_roles)
  is_active: boolean
  commission_rate: number
  modules_enabled: string[]
  created_at: timestamptz
}
```

#### 3. **User Roles** (`user_roles`)
```typescript
{
  id: string (uuid)
  user_id: string (FK → auth.users)
  role: 'client' | 'kam' | 'credit_team' | 'nbfc'
  last_login: timestamptz
  account_status: 'Active' | 'Locked' | 'Disabled'
}
```

#### 4. **Commission Ledger** (`commission_ledger`)
```typescript
{
  id: string (uuid)
  client_id: string (FK → dsa_clients)
  loan_file_id: string (FK → loan_applications)
  date: date
  disbursed_amount: number
  commission_rate: number
  payout_amount: number
  description: text
  dispute_status: 'None' | 'Under Query' | 'Resolved'
  payout_request_flag: boolean
}
```

#### 5. **Queries** (`queries`)
```typescript
{
  id: string (uuid)
  application_id: string (FK → loan_applications)
  raised_by: string (FK → user_roles)
  raised_to_role: string
  query_text: text
  response_text: text
  responded_by: string (FK → user_roles)
  status: 'open' | 'responded' | 'resolved'
  created_at: timestamptz
  responded_at: timestamptz
}
```

#### 6. **Audit Logs** (`audit_logs`)
```typescript
{
  id: string (uuid)
  application_id: string (FK → loan_applications)
  user_id: string (FK → user_roles)
  action_type: string
  message: text
  metadata: jsonb
  target_user_role: string
  resolved: boolean
  created_at: timestamptz
}
```

## Expected Webhook Data Structure

Based on the JSON specification provided, the webhook should return data matching these tables. Here's what we expect:

### Expected Response Format

The webhook should return data in one of these formats:

#### Option 1: Single Entity
```json
{
  "table": "loan_applications",
  "data": {
    "file_number": "SF12345678",
    "applicant_name": "John Doe",
    "requested_loan_amount": 5000000,
    ...
  }
}
```

#### Option 2: Multiple Entities
```json
{
  "loan_applications": [...],
  "clients": [...],
  "commission_ledger": [...],
  ...
}
```

#### Option 3: Full System Export
```json
{
  "tables": {
    "Clients": [...],
    "Loan Applications": [...],
    "Commission Ledger": [...],
    "Queries": [...],
    ...
  }
}
```

## Field Mapping Requirements

### Loan Applications Mapping
| Webhook Field | System Field | Type | Notes |
|--------------|--------------|------|-------|
| File ID | `file_number` | text | Must be unique |
| Client | `client_id` | uuid FK | Link to dsa_clients |
| Applicant Name | `applicant_name` | text | Required |
| Loan Product | `loan_product_id` | uuid FK | Link to loan_products |
| Requested Loan Amount | `requested_loan_amount` | number | Currency format |
| Status | `status` | text | Must match status enum |
| Assigned Credit Analyst | `assigned_credit_analyst` | uuid FK | Optional |
| Assigned NBFC | `assigned_nbfc_id` | uuid FK | Optional |
| Lender Decision Status | `lender_decision_status` | text | Optional |
| Lender Decision Date | `lender_decision_date` | date | Optional |
| Lender Decision Remarks | `lender_decision_remarks` | text | Optional |
| Approved Loan Amount | `approved_loan_amount` | number | Optional |
| AI File Summary | `ai_file_summary` | text | Optional |
| Creation Date | `created_at` | timestamptz | Auto-set if not provided |
| Submitted Date | `submitted_at` | timestamptz | Optional |
| Last Updated | `updated_at` | timestamptz | Auto-updated |

### Clients Mapping
| Webhook Field | System Field | Type | Notes |
|--------------|--------------|------|-------|
| Client ID | `id` | uuid | Auto-generated if not provided |
| Client Name | `company_name` | text | Required |
| Primary Contact Name | `contact_person` | text | Required |
| Contact Email | `email` | text | Required |
| Contact Phone | `phone` | text | Optional |
| Assigned KAM | `kam_id` | uuid FK | Link to user_roles |
| Enabled Modules | `modules_enabled` | string[] | Array of module codes |
| Commission Rate | `commission_rate` | number | Decimal (0.01 = 1%) |
| Status | `is_active` | boolean | Active/Inactive |

## Integration Points

### 1. Data Import Function
```typescript
// When webhook returns actual data, we'll need:
async function importWebhookData(webhookData: WebhookData) {
  // Map webhook fields to system fields
  // Handle relationships (FKs)
  // Validate data
  // Insert/update in Supabase
}
```

### 2. Field Validation
- **Required fields**: Must be present
- **Foreign keys**: Must reference existing records
- **Enums**: Must match allowed values
- **Data types**: Must match expected types

### 3. Relationship Handling
- Client → KAM (via `kam_id`)
- Application → Client (via `client_id`)
- Application → Loan Product (via `loan_product_id`)
- Application → Credit Analyst (via `assigned_credit_analyst`)
- Application → NBFC (via `assigned_nbfc_id`)

## Status Compatibility

### System Status Values
- `draft`
- `pending_kam_review`
- `kam_query_raised`
- `forwarded_to_credit`
- `credit_query_raised`
- `in_negotiation`
- `sent_to_nbfc`
- `approved`
- `rejected`
- `disbursed`
- `closed`

### JSON Specification Status Values
- "Draft"
- "Submitted / Pending KAM Review"
- "KAM Query Raised"
- "Approved by KAM / Forwarded to Credit"
- "Credit Query Raised"
- "In Negotiation"
- "Sent to NBFC"
- "NBFC Approved"
- "NBFC Rejected"
- "Disbursed"
- "Closed/Archived"

**Mapping Required**: Convert JSON status labels to system status codes.

## Next Steps

1. **Wait for actual data**: The webhook currently only returns "Workflow was started"
2. **Analyze data structure**: Once real data is returned, analyze the structure
3. **Create mapping function**: Map webhook fields to system fields
4. **Handle relationships**: Resolve foreign key relationships
5. **Validate data**: Ensure data integrity
6. **Import logic**: Create import function (if needed, though requirement says "do nothing")

## Current Implementation

The webhook utility (`src/lib/webhook.ts`) is ready to:
- ✅ Fetch data from webhook (GET request)
- ✅ Handle errors gracefully
- ✅ Log data without processing (as per requirements)
- ⏳ Wait for actual data structure to be returned

## Testing

To test the webhook in the browser console:
```javascript
import { testWebhook } from './lib/webhook';
testWebhook();
```

Or in a React component:
```typescript
import { fetchWebhookData } from './lib/webhook';

useEffect(() => {
  fetchWebhookData().then(data => {
    console.log('Webhook data:', data);
    // Do nothing with it - just fetched
  });
}, []);
```

