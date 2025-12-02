# Complete Webhook Data Remapping

## Webhook Response (Current)

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

## Complete Field Remapping

### 1. Core Application Fields

| Webhook Field | → | Database Field | Value | Notes |
|---------------|---|----------------|-------|-------|
| `Mapping ID` | → | `file_number` | `"MAP002"` | Primary identifier |
| `Client` | → | `client_id` | `null` or resolved ID | Will try to resolve "CL001" |
| `Client` | → | `form_data.client_identifier` | `"CL001"` | Stored if can't resolve |
| `Client` | → | `form_data.client_code` | `"CL001"` | Also stored as code |
| `Category` | → | `form_data.category` | `"C002"` | Stored in form_data |
| `Category` | → | `form_data.category_original` | `"C002"` | Original value preserved |
| `Category` | → | `loan_product_id` | `null` or resolved ID | Will try to resolve as product |
| `Is Required` | → | `form_data.is_required` | `"True"` | String value |
| `Is Required` | → | `form_data.is_required_bool` | `true` | Boolean conversion |
| `Display Order` | → | `form_data.display_order` | `"2"` | String value |
| `Display Order` | → | `form_data.display_order_num` | `2` | Number conversion |
| `id` | → | `form_data.webhook_id` | `"recAyM1n2jsx5e7RD"` | For deduplication |
| `createdTime` | → | `created_at` | `"2025-12-01T07:03:53.000Z"` | Timestamp |

### 2. Default/Computed Fields

| Field | Value | Source |
|-------|-------|--------|
| `applicant_name` | `"CL001"` | Fallback from Client field |
| `status` | `"draft"` | Default (no Status field) |
| `requested_loan_amount` | `null` | No amount field |
| `updated_at` | `"2025-12-01T07:03:53.000Z"` | From createdTime |
| `form_data.webhook_synced_at` | Current timestamp | When synced |

## Complete Database Record Structure

```javascript
{
  // Core Fields
  id: "<generated-uuid>",
  file_number: "MAP002",
  applicant_name: "CL001",  // Fallback from Client
  requested_loan_amount: null,
  status: "draft",  // Default
  client_id: null,  // If CL001 can't be resolved
  loan_product_id: null,  // If C002 can't be resolved as product
  
  // Timestamps
  created_at: "2025-12-01T07:03:53.000Z",
  updated_at: "2025-12-01T07:03:53.000Z",
  
  // All Additional Data in form_data (JSONB)
  form_data: {
    // Webhook Metadata
    webhook_id: "recAyM1n2jsx5e7RD",
    webhook_synced_at: "2025-12-01T10:15:30.000Z",
    
    // Client Information
    client_identifier: "CL001",
    client_code: "CL001",
    client_identifier_original: "CL001",
    
    // Category Information
    category: "C002",
    category_original: "C002",
    loan_product_identifier: "C002",  // If tried to resolve as product
    
    // Required Flag
    is_required: "True",
    is_required_bool: true,
    is_required_original: "True",
    
    // Display Order
    display_order: "2",
    display_order_num: 2,
    display_order_original: "2",
    
    // Mapping Information
    mapping_id: "MAP002",
    mapping_id_original: "MAP002"
  }
}
```

## Field Mapping Logic

### 1. Direct Mappings
- `Mapping ID` → `file_number` (primary identifier)
- `createdTime` → `created_at` and `updated_at`

### 2. Resolved Mappings
- `Client` → Tries to resolve "CL001" to `client_id`:
  - Searches `dsa_clients` by `company_name` (ILIKE)
  - Searches `dsa_clients` by `contact_person` (ILIKE)
  - If not found, stores in `form_data.client_identifier`

- `Category` → Tries to resolve "C002" to `loan_product_id`:
  - Searches `loan_products` by `name` (ILIKE)
  - If not found, stores in `form_data.category` and `form_data.loan_product_identifier`

### 3. Type Conversions
- `Is Required`: `"True"` → `true` (boolean)
- `Display Order`: `"2"` → `2` (number)

### 4. Fallback Values
- `applicant_name`: Falls back to `Client` value if no `Applicant Name` field
- `status`: Defaults to `"draft"` if no `Status` field
- `file_number`: Uses `Mapping ID` or generates `WEBHOOK_<id>`

### 5. Original Value Preservation
- All fields stored with `_original` suffix to preserve webhook format
- Both normalized and original keys available in `form_data`

## Display in Applications Table

The Applications page will show:

| Column | Value | Source |
|--------|-------|--------|
| **File Number** | MAP002 | `file_number` |
| **Client** | CL001 | `form_data.client_code` or `applicant_name` |
| **Applicant** | CL001 | `applicant_name` (fallback) |
| **Loan Type** | C002 | `form_data.category` |
| **Amount** | N/A | `requested_loan_amount` (null) |
| **Status** | Draft | `status` (default) |
| **Last Update** | 01-Dec-2025 | `updated_at` |

## Benefits of Complete Remapping

1. **All Fields Captured** - Every webhook field is stored
2. **Original Values Preserved** - `_original` keys maintain webhook format
3. **Type Conversions** - Strings converted to appropriate types
4. **Deduplication** - `webhook_id` prevents duplicates
5. **Flexible Lookup** - Can search by any field in `form_data`
6. **Future-Proof** - New fields automatically stored

## Testing

To test the remapping:

1. Navigate to `/applications` page
2. Check browser console for:
   - "Syncing X webhook records to database..."
   - "Sync complete: X succeeded, Y failed"
3. Verify in database:
   ```sql
   SELECT file_number, applicant_name, status, form_data 
   FROM loan_applications 
   WHERE form_data->>'webhook_id' = 'recAyM1n2jsx5e7RD';
   ```
4. Check Applications table displays all fields correctly

## Next Steps

1. **Test Sync** - Verify data syncs correctly
2. **Verify Display** - Check Applications table shows all data
3. **Configure n8n** - If needed, update webhook to return loan application fields
4. **Monitor** - Check sync logs and error messages

The remapping is now complete and handles ALL fields from the webhook!

