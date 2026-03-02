# Loan Products Webhook Verification

**Date:** 2026-02-18  
**Status:** ✅ Active and Working

## Webhook Details

- **Post Loan Products:** `https://fixrrahul.app.n8n.cloud/webhook/loanproducts`
- **Get Loan Products:** `https://fixrrahul.app.n8n.cloud/webhook/loanproducts`
- **Methods:** GET (list/fetch), POST (create/update), PATCH (form config)
- **Status:** ✅ Active (200 OK)

Both GET and POST use the same webhook URL; the HTTP method determines the operation.

## PATCH (form config) – single record only

When the backend sends **PATCH** to update form config (sections/fields), the body includes:

- **`id`** (required): Airtable record id of the Loan Product to update.
- Section/Field keys (e.g. `Section 1A`, `Field 1A.5`) with values (`Y`/`N`, label, or `Empty`).

The n8n workflow **must** update only the single record whose id matches `payload.id`. If the workflow applies the payload to all records, then unselecting a document field in one product would incorrectly clear it for all products. Document fields are product-specific; each product has its own mapping.
