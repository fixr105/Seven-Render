# Standalone n8n POST Webhooks

Minimal importable workflows for the four POST endpoints that returned **404** in the smoke test (wrong paths in `backend/test-all-post-webhooks-complete.js`). Paths match [`backend/src/services/airtable/n8nEndpoints.ts`](../../backend/src/services/airtable/n8nEndpoints.ts).

| File | Webhook path | Airtable table |
|------|--------------|----------------|
| `n8n-post-loanapplications.json` | `loanapplications1` | Loan Applications |
| `n8n-post-fileauditinglog.json` | `Fileauditinglog1` | File Auditing Log |
| `n8n-post-loanproducts.json` | `loanproducts1` | Loan Products |
| `n8n-post-nbfcpartners.json` | `NBFCPartners1` | NBFC Partners |

You can import the four files separately, or use your combined single-workflow export (all four paths in one workflow).

Base URL: `https://fixrrahul.app.n8n.cloud/webhook/`

## Import

1. Open [n8n](https://fixrrahul.app.n8n.cloud) → **Workflows**.
2. **⋯** menu → **Import from File** → choose one JSON from this folder (or your combined export).
3. Open the workflow → click each **Airtable** node → select your **Personal Access Token** credential.
4. **Activate** the workflow (toggle top-right). A 404 means inactive or wrong path.

## Test (after activate)

```bash
# Loan Applications — use a valid Airtable Status label, not "draft"
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/loanapplications1 \
  -H "Content-Type: application/json" \
  -d '{"File ID":"TEST-001","Status":"Submitted","Applicant Name":"Test"}'

# File Audit Log
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/Fileauditinglog1 \
  -H "Content-Type: application/json" \
  -d '{"id":"TEST-AUDIT-1","Log Entry ID":"LOG-1","File":"SF001","Timestamp":"2026-07-05T12:00:00Z","Actor":"test","Action/Event Type":"test"}'

# Loan Products
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/loanproducts1 \
  -H "Content-Type: application/json" \
  -d '{"id":"LP-TEST","Product ID":"LP-TEST","Product Name":"Test Product","Active":"True"}'

# NBFC Partners
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/NBFCPartners1 \
  -H "Content-Type: application/json" \
  -d '{"id":"NBFC-TEST","Lender ID":"NBFC-TEST","Lender Name":"Test Lender","Active":"True"}'
```

## Notes

- Extracted from [`SEVEN-DASHBOARD(2).json`](../../SEVEN-DASHBOARD(2).json) (Webhook7/11/12/13 + Airtable upsert nodes).
- Live n8n paths use the `1` suffix to avoid clashing with inactive SEVEN-DASHBOARD routes.
- Loan Applications upserts on **File ID** (required for new creates).
- Airtable `Status` on Loan Applications accepts: `Qualified`, `Submitted`, `Dealer Unresponsive`, `Under Finance Review`, `DO Issued`, `Disbursed`, `Rejected` — not internal slugs like `draft`.
- Backend maps slugs → Airtable labels in [`loanApplicationAirtableStatus.ts`](../../backend/src/utils/loanApplicationAirtableStatus.ts) before POST; draft saves omit `Status`.
- Full connectivity guide: [`WEBHOOK_CONNECTIVITY.md`](../WEBHOOK_CONNECTIVITY.md).
