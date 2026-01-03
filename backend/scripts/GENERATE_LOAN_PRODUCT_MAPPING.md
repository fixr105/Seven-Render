# Generate Loan Product Field Mapping Script

This script generates a JSON mapping of loan products (clients) to their required form fields.

## Purpose

The script creates a mapping structure that can be used to populate Loan Products with their required documents/fields during creation via `/webhook/loanproducts`.

## How It Works

1. **Fetches Client Form Mapping table** - Gets all form category mappings per client
2. **Fetches Form Fields table** - Gets all form field definitions
3. **Processes the data**:
   - Groups mappings by Client (loan product)
   - Filters to only include mappings where "Is Required" = "True" or "Yes"
   - Finds all form fields in those categories where "Is Mandatory" = "True" or "Yes"
   - Sorts fields by Display Order
4. **Outputs JSON mapping** - Format: `{ "CL001": ["FLD-...", "FLD-..."] }`

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
  "CL001": [
    "FLD-1765189508834-1-0-ldnelyzjy",
    "FLD-1765188239809-0-0-6eacx39tu"
  ],
  "CL002": [
    "FLD-1765189508834-2-0-abc123xyz",
    "FLD-1765188239809-1-0-def456uvw"
  ]
}
```

## Requirements

For the script to generate mappings, you need:

1. **Client Form Mapping table** must have entries with:
   - `Client` field populated (e.g., "CL001")
   - `Category` field populated (links to Form Category)
   - `Is Required` = "True" or "Yes"
   - `Display Order` (optional, for sorting)

2. **Form Fields table** must have entries with:
   - `Field ID` populated (e.g., "FLD-...")
   - `Category` field matching categories in Client Form Mapping
   - `Is Mandatory` = "True" or "Yes"
   - `Active` = "True" or "Yes" (or null/undefined)
   - `Display Order` (optional, for sorting)

## Field Matching Logic

1. For each Client in Client Form Mapping:
   - Find all categories where "Is Required" = "True"/"Yes"
   - Sort categories by Display Order

2. For each required category:
   - Find all Form Fields where:
     - `Category` matches
     - `Is Mandatory` = "True"/"Yes"
     - `Active` = "True"/"Yes" (or null/undefined)

3. Sort fields by Display Order within each category

4. Collect all Field IDs into an array for that Client

## Using the Mapping

The generated mapping can be used when creating/updating Loan Products:

```javascript
const mapping = require('./loan-product-field-mapping.json');

// When creating a loan product for CL001
const productData = {
  'Product ID': 'LP001',
  'Product Name': 'Personal Loan',
  'Required Documents/Fields': mapping['CL001'].join(', '), // Comma-separated field IDs
  // ... other fields
};
```

## Troubleshooting

### Empty Mapping Generated

If the script generates an empty mapping `{}`, check:

1. **Client Form Mapping table**:
   - Does it have any records?
   - Are there records with "Is Required" = "True" or "Yes"?
   - Is the `Client` field populated?

2. **Form Fields table**:
   - Does it have any records?
   - Are there records with "Is Mandatory" = "True" or "Yes"?
   - Do the `Category` values match those in Client Form Mapping?

3. **Webhook connectivity**:
   - Can you access `/webhook/clientformmapping`?
   - Can you access `/webhook/formfields`?

### No Client Form Mapping Records Found

This means the Client Form Mapping webhook returned empty. Possible causes:
- Table is empty
- Webhook not configured
- Webhook URL incorrect

The script will still generate an empty mapping structure that can be populated later.

## Notes

- The script dynamically loads data from Airtable, so it always reflects the latest state
- Field IDs are sorted by Display Order for consistent ordering
- Only active, mandatory fields in required categories are included
- The mapping is saved to a JSON file for easy integration into other scripts

