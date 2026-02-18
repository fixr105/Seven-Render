# n8n Product Documents Webhook Setup

**Purpose:** Handoff for tech person to create the Product Documents webhook. The backend returns 404 until this workflow exists.

## Required Webhook

| Method | Path | Full URL |
|--------|------|----------|
| GET | `productdocument` | `https://fixrrahul.app.n8n.cloud/webhook/productdocument` |
| POST | `productdocument` | `https://fixrrahul.app.n8n.cloud/webhook/productdocument` |
| PATCH | `productdocument` | `https://fixrrahul.app.n8n.cloud/webhook/productdocument` |
| DELETE | `productdocument` | `https://fixrrahul.app.n8n.cloud/webhook/productdocument` |

## Airtable Table: Product Documents

Columns (Airtable field names):

- `Product ID` – links to Loan Products
- `Record Title` – display label (e.g. "PAN Card", "Aadhaar")
- `Display Order` – number for ordering
- `Is Required` – boolean or "True"/"False"

## Payloads the Backend Sends

### GET

- No body. Returns array of records (Airtable format or flattened with fields on object).
- Backend expects: `[{ id, "Product ID", "Record Title", "Display Order", "Is Required", ... }]`

### POST (create)

```json
{
  "id": null,
  "Product ID": "LP001",
  "Record Title": "PAN Card",
  "Display Order": 0,
  "Is Required": true
}
```

- `id` may be omitted for create. Create new record in Airtable.

### PATCH (update)

```json
{
  "id": "recXXXXXXXXXXXXXX",
  "Product ID": "LP001",
  "Record Title": "PAN Card",
  "Display Order": 1,
  "Is Required": true
}
```

- `id` is required (Airtable record id). Update existing record.

### DELETE

```json
{
  "id": "recXXXXXXXXXXXXXX"
}
```

- `id` is required. Delete the record.

## Reference: Loan Products

Use the existing Loan Products workflow at `/webhook/loanproducts` as a template. It supports GET and PATCH. Product Documents needs GET, POST, PATCH, DELETE.

## Alternative Path

If n8n uses a different path (e.g. `product-documents`), set env overrides in backend:

```
N8N_GET_PRODUCT_DOCUMENTS_URL=https://fixrrahul.app.n8n.cloud/webhook/product-documents
N8N_POST_PRODUCT_DOCUMENTS_URL=https://fixrrahul.app.n8n.cloud/webhook/product-documents
N8N_PATCH_PRODUCT_DOCUMENTS_URL=https://fixrrahul.app.n8n.cloud/webhook/product-documents
N8N_DELETE_PRODUCT_DOCUMENTS_URL=https://fixrrahul.app.n8n.cloud/webhook/product-documents
```

## Verification

After creating and activating the workflow:

```bash
cd backend && npm run verify:product-documents
```

Or: `curl -s -o /dev/null -w "%{http_code}" "https://fixrrahul.app.n8n.cloud/webhook/productdocument"`

Expected: HTTP 200 for GET, JSON array (possibly empty).
