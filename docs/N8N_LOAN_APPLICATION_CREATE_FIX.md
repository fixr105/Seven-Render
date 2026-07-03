# n8n Loan Application Create Fix

## Problem

`POST /webhook/loanapplications` returned HTTP 200 with an **empty body** but **did not create** new Loan Application rows. Updates to existing `File ID` values worked.

Root cause: the n8n Airtable node (`Create or update a record11`) used `matchingColumns: ["id"]` and mapped `id` from the request body. New applications send a generated `File ID` but no Airtable record `id`, so upsert could not create rows.

## Fix (n8n workflow)

1. Open the **Seven Dashboard** workflow in n8n (`fixrrahul.app.n8n.cloud`).
2. Edit **Create or update a record11** (Loan Applications POST / `loanapplications`):
   - **matchingColumns**: `File ID` (not `id`)
   - **operation**: `upsert`
   - Map all payload fields (see updated `SEVEN-DASHBOARD(2).json` in this repo).
3. Edit **Respond to Webhook11** to return JSON on success, e.g.:
   ```json
   { "success": true, "fileId": "={{ $json['File ID'] }}" }
   ```
4. **Activate** the workflow and test:
   ```bash
   cd backend && npm run test:n8n-loan-create
   ```

Or re-import [`SEVEN-DASHBOARD(2).json`](../SEVEN-DASHBOARD(2).json) (record11 section already patched in repo).

## Application changes (this repo)

| Change | Purpose |
|--------|---------|
| [`src/services/loanApplicationWebhook.ts`](../src/services/loanApplicationWebhook.ts) | Frontend POST + GET verify against n8n directly |
| [`src/pages/NewApplication.tsx`](../src/pages/NewApplication.tsx) | Uses direct n8n when `VITE_N8N_LOAN_APPLICATIONS_URL` is set |
| [`backend/src/services/workflow/loanWorkflow.service.ts`](../backend/src/services/workflow/loanWorkflow.service.ts) | Lenient webhook ack on create; canonical status compare on verify |
| [`.env.production`](../.env.production) | Default n8n webhook URLs for production builds |

## Verify

```bash
# Direct n8n (no Express)
cd backend && npm run test:n8n-loan-create

# Unit tests
cd backend && npm test -- --testPathPattern="loanWorkflow|n8nClient.postLoanApplication"
```

Pass criteria: script prints `OK: n8n POST + GET persistence verified.` and application count increases by 1.
