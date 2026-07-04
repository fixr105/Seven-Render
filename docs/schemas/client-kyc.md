# Client KYC table

Dealer profile data for B2C EV application form auto-fill.

## Webhook

| Method | URL |
|--------|-----|
| GET | https://fixrrahul.app.n8n.cloud/webhook/getclientKYC |

Backend resolves via `n8nClient.fetchTable('Client KYC')` and filters by logged-in client.

## API

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/client/kyc` | client | Returns dealer KYC for JWT client; includes `formDataPatch` for `form_data` merge |

## Lookup

1. **Client ID** — matches `Clients.Client ID` from login (`resolveClientRecord`)
2. **Login Email** — fallback match on `Login Email` column
3. Only rows with `Status = Active` (or blank) are returned

## CSV templates

- `docs/schemas/client-kyc-import.csv` — Airtable import with sample row
- `docs/schemas/client-kyc-columns.csv` — column types and `form_data` key mapping

## n8n note

The GET webhook must return all Client KYC columns (not only `id` / `createdTime`). Map every Airtable field in the n8n workflow response node.

## Response when KYC missing

```json
{
  "success": false,
  "error": "No active Client KYC record found for your account...",
  "code": "CLIENT_KYC_NOT_FOUND"
}
```
