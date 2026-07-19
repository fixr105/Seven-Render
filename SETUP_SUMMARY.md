# Setup Summary — Real Test Users

This project authenticates against **Airtable User Accounts via n8n**, not local Supabase dummy users.

## Test logins

See **[TEST_USERS.md](TEST_USERS.md)** (same defaults as [`e2e/helpers/auth.ts`](e2e/helpers/auth.ts)):

| Role | Email | Password |
|------|--------|----------|
| Client | `vadukavsk@gmail.com` | `pass@123` |
| KAM | `Anya@sevenfincorp.email` | `pass@123` |
| Credit | `sagar@sevenfincorp.email` | `pass@123` |
| NBFC | `sagar@sevenfincorp.email` | `pass@123` |

## Local development

```bash
npm run dev          # frontend
cd backend && npm run dev
```

App: typically http://localhost:5173 (see your Vite config).

## Do not use

Legacy “dummy” Supabase accounts (`client@test.com`, `kam@test.com`, etc.) and `scripts/setup-dummy-users.js` / old SQL seed guides are **obsolete**. They are not the auth source for this LMS.
