# Test Users for Seven Fincorp

Real User Accounts used for manual QA and automated E2E. These live in Airtable / n8n (not local mock auth).

Source of truth for Playwright defaults: [`e2e/helpers/auth.ts`](e2e/helpers/auth.ts). Override with `E2E_*_USERNAME` / `E2E_*_PASSWORD` env vars when needed.

---

## Role credentials

| Role | Email | Password |
|------|--------|----------|
| **Client** (DSA Partner) | `vadukavsk@gmail.com` | `pass@123` |
| **KAM** | `Anya@sevenfincorp.email` | `pass@123` |
| **Credit Team** | `sagar@sevenfincorp.email` | `pass@123` |
| **NBFC Partner** | `sagar@sevenfincorp.email` | `pass@123` |

Same password for all roles unless your environment overrides it.

---

## Using these accounts

1. Ensure each email exists in **User Accounts** with the correct **Role** and **Account Status = Active**.
2. Log in at `/login` with the email and password above.
3. For E2E: `npx playwright test` uses the table above unless env vars are set.

---

## What each role should see

### Client
- Own dashboard, applications, calculator, commission ledger (if M1 enabled)
- New application from product tiles on the dashboard

### KAM
- Managed clients, applications, ledger (per client), reports, calculator

### Credit Team
- Global applications, clients, form configuration, ledger, reports, admin pages, calculator

### NBFC
- Assigned applications, NBFC tools, calculator

---

## Do not use

These are **not** valid logins for this product (legacy doc leftovers or filtered patterns):

- `client@test.com`, `kam@test.com`, `credit@test.com`, `nbfc@test.com`
- `test@example.com`, `dummy@…`, generic `example.com` addresses
- Local-only mock User Account IDs (`recE2E…`) — the app authenticates against real User Accounts / n8n
