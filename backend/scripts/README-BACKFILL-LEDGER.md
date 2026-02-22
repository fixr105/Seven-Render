# Backfill Commission Ledger

Script to create Commission Ledger entries for Loan Applications that are already marked **disbursed** in Airtable but have no corresponding Commission Ledger row.

## When to use

- Files were marked disbursed in Airtable before commission automation was enabled
- Files were marked disbursed outside the app (e.g. bulk update in Airtable)
- One-time sync to ensure every disbursed file has a ledger entry

## What it does

1. Fetches Loan Application, Commission Ledger, and Clients tables via n8n webhooks
2. Finds applications with `Status = disbursed`
3. For each, checks if a Commission Ledger entry already exists with the same `Loan File` (File ID)
4. For missing entries: reads client Commission Rate from Clients, uses disbursed amount from the application (`Approved Loan Amount` or `Disbursed Amount`), computes commission (same formula as `commission.service`: rate × amount / 100), and creates one Commission Ledger record (Payout if positive, Payin if negative)
5. Idempotent: does not create duplicate entries for the same file

## Usage

**One-off:** Run when you need to backfill missing ledger entries (e.g. after enabling commission automation or after bulk updates in Airtable). Not intended for recurring/scheduled runs.

```bash
# From repo root (Node 18+ recommended)
node backend/scripts/backfill-commission-ledger.js
```

**Environment:** Set `N8N_BASE_URL` if your n8n instance is not the default (`https://fixrrahul.app.n8n.cloud`). Webhooks used: GET loanapplication, GET commisionledger, GET client, POST COMISSIONLEDGER.

## Edge cases

- Skips applications with no Client or no disbursed amount
- Uses default commission rate 1.5% if client has no Commission Rate
- Entry date is taken from application `Last Updated` or today
