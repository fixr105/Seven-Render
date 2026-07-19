# Test Fallbacks

Auth uses **real User Accounts** (see [TEST_USERS.md](TEST_USERS.md)). Local `E2E_USE_MOCK_USER_ACCOUNTS` / `recE2E*` mock account tables are **not** used in the current backend.

## Still present (by design)

### Test-email rejection patterns
Login / n8n flows may reject addresses matching patterns such as `test@`, `dummy@`, `example.com` so junk webhook payloads cannot become sessions. That is a **filter**, not a set of login accounts.

### Unit-test fixtures
Vitest helpers (`src/test/helpers.ts`) export in-memory user objects for React tests. Emails align with real test users; IDs (`user-1`, `CLIENT001`, etc.) exist only inside the test runner and are never returned by production auth.

### Playwright
E2E logs in with the real credentials in `e2e/helpers/auth.ts` (overridable via env). No mock User Accounts switch is required.

## Removed / obsolete

- Dummy Supabase seed users (`client@test.com`, …)
- Documented `E2E_USE_MOCK_USER_ACCOUNTS=1` + `recE2EClient01`-style accounts (no longer in `backend/src`)
