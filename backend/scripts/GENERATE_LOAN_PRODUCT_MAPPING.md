# Generate Loan Product Field Mapping Script

This script generates a JSON mapping of clients/products to required form field IDs using **Form Link + Record Titles** tables.

## Purpose

The script creates a mapping structure that can be used to populate Loan Products with their required documents/fields during creation via `/webhook/loanproducts`.

## How It Works

1. **Fetches Form Link table** - Gets Client ID, Product ID, Mapping ID rows
2. **Fetches Record Titles table** - Gets Mapping ID, Record Title, Display Order, Is Required
3. **Processes the data**:
   - For each Form Link row: Client ID + Product ID → Mapping ID
   - For each Mapping ID: Get Record Titles, sorted by Display Order
   - Keys: Client ID or Product ID (when product-specific). Values: Record Title ids (Airtable record ids)
4. **Outputs JSON mapping** - Format: `{ "CL001": ["recXXX", "recYYY"], "LP009": ["recXXX", ...] }`

## Usage

```bash
cd backend
node scripts/generate-loan-product-field-mapping.js
```

Or add to package.json:
```json
"generate:mapping": "node scripts/generate-loan-product-field-mapping.js"
```

## Output

The script:
- Prints the mapping to console
- Saves to `loan-product-field-mapping.json` in the backend directory

## Example Output

```json
{
  "CL001": ["recXXX123", "recYYY456"],
  "LP009": ["recXXX123", "recYYY456"]
}
```

## Requirements

1. **Form Link table** must have entries with:
   - `Client ID` populated (e.g., "CL001")
   - `Mapping ID` populated
   - `Product ID` optional (empty = any product)

2. **Record Titles table** must have entries with:
   - `Mapping ID` matching Form Link rows
   - `Record Title` (document name, e.g. "PAN Card")
   - `Display Order` (optional, for sorting)
   - `Is Required` (optional)

## Field Matching Logic

1. For each Form Link row:
   - Get Client ID, Product ID, Mapping ID
   - Find Record Titles where Mapping ID matches
   - Sort by Display Order
   - Collect Record Title ids (Airtable record ids)

2. Key by Product ID if present, else Client ID

3. Output mapping: `{ key: [id1, id2, ...] }`

## Using the Mapping

The generated mapping can be used when creating/updating Loan Products (see `create-loan-products.js`):

```javascript
const mapping = require('./loan-product-field-mapping.json');

// When creating a loan product for CL001
const productData = {
  'Product ID': 'LP001',
  'Product Name': 'Personal Loan',
  'Required Documents/Fields': mapping['CL001']?.join(', ') || '',
  // ... other fields
};
```

## Troubleshooting

### Empty Mapping Generated

If the script generates an empty mapping `{}`, check:

1. **Form Link table**:
   - Does it have any records?
   - Are Client ID and Mapping ID populated?

2. **Record Titles table**:
   - Does it have any records?
   - Do Mapping ID values match Form Link rows?

3. **Webhook connectivity**:
   - Can you access `/webhook/formlink`?
   - Can you access `/webhook/Recordtitle`?

### No Form Link Records Found

Configure Form Links in the Form Configuration page (Credit Team). Form config now uses Form Link + Record Titles instead of the deprecated Client Form Mapping, Form Categories, and Form Fields.

## Notes

- Form config is served by Form Link + Record Titles. Client Form Mapping, Form Categories, Form Fields are deprecated.
- Record Title ids (Airtable record ids) are used as field identifiers.
- The script dynamically loads data from Airtable via n8n webhooks.
