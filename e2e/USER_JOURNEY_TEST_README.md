# PRD User Journey E2E Tests

End-to-end Playwright tests covering the full loan application lifecycle across Client, KAM, Credit, and NBFC roles.

## Prerequisites

- **Backend and frontend running:** Playwright `webServer` in `playwright.config.ts` starts both automatically. For local runs, ensure:
  - Frontend: `npm run dev` (or Playwright starts it)
  - Backend: `cd backend && npm run dev` (or Playwright starts it)
- **Test user:** `sagar@sevenfincorp.email` / `pass@123` with access to all four roles (Client, KAM, Credit, NBFC)
- **Environment:** Override credentials via `E2E_CLIENT_USERNAME`, `E2E_CLIENT_PASSWORD`, etc. (see [e2e/helpers/auth.ts](helpers/auth.ts))

## Running the Tests

```bash
# Run all user journey scenarios (A, B, C, D)
npx playwright test e2e/prd-user-journey.spec.ts

# Run a single scenario
npx playwright test e2e/prd-user-journey.spec.ts -g "Scenario A"
npx playwright test e2e/prd-user-journey.spec.ts -g "Scenario B"
npx playwright test e2e/prd-user-journey.spec.ts -g "Scenario C"
npx playwright test e2e/prd-user-journey.spec.ts -g "Scenario D"

# Run with UI mode (for debugging)
npx playwright test e2e/prd-user-journey.spec.ts --ui

# Run with headed browser
npx playwright test e2e/prd-user-journey.spec.ts --headed
```

## Test Scenarios

| Scenario | Description |
|----------|-------------|
| **A: Happy Path** | Client creates draft → submits → KAM raises query → Client responds → KAM resolves and forwards → Credit marks In Negotiation → assigns NBFC → NBFC approves → Credit marks Disbursed |
| **B: Rejection Path** | Client submits → KAM forwards → Credit assigns NBFC → NBFC rejects with reason → verify Rejected/Closed |
| **C: Query Resolution** | Client submits → KAM raises query → Client responds → KAM resolves → verify query thread |
| **D: Withdrawal Path** | Client creates draft → Client withdraws → verify Withdrawn/Closed |

Scenarios run **sequentially** (A → B → C → D). Each scenario creates its own test applications with distinct applicant names to avoid collisions.

## Known Limitations

1. **Assign NBFC UI:** Credit has no dedicated "Assign NBFC" UI. The status modal's "Sent to NBFC" option uses the KAM edit route. Tests use `assignNBFCViaAPI` (direct API call with auth token) when Credit needs to assign NBFCs. If no NBFC partners exist or the API fails, the test skips.

2. **Ledger (M1):** Scenario A step A14 verifies commission in Ledger. If M1 is not enabled for the client (`enabledModules`), the step skips.

3. **Form configuration:** New application form requires KAM-configured form mapping for the client. If no form config exists, tests skip with "New application form not available".

4. **Test data dependency:** Tests create applications via the UI. They depend on:
   - At least one loan product configured for the client
   - At least one NBFC partner for assign-nbfcs
   - n8n/Airtable connectivity for backend operations

## Interpreting Results

- **Passed:** All steps completed; status transitions and UI flows behaved as expected.
- **Skipped:** A step called `test.skip()` because required data or UI was missing (e.g. no applications for NBFC, no form config).
- **Failed:** Assertion failed or a step threw (e.g. selector not found, API error).

## Troubleshooting

1. **"Application with applicant X not found"** – Applications list may be empty or filtered. Ensure the client has created applications and the status filter is "All".

2. **"Assign NBFC via API failed"** – Check that NBFC partners exist (`GET /api/nbfc-partners`) and the Credit user has a valid token.

3. **"New application form not available"** – KAM must configure form mapping for the client. See [FormConfiguration](src/pages/FormConfiguration.tsx).

4. **Login failures** – Verify credentials in [TEST_USERS.md](../TEST_USERS.md) and [e2e/helpers/auth.ts](helpers/auth.ts). Ensure backend auth and n8n webhooks are reachable.

5. **Timeout errors** – Increase `test.setTimeout` in the spec or use `--timeout=120000` for slower environments.

## Cleanup

Test applications use applicant names:
- `E2E User Journey Happy Path`
- `E2E User Journey Rejection`
- `E2E User Journey Query`
- `E2E User Journey Withdrawal`

These can be manually archived or filtered in the Applications list. No automated cleanup is performed.
