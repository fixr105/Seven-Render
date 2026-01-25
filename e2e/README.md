# End-to-End (E2E) Tests

This directory contains Playwright E2E tests for P0 critical user journeys.

## Test Suites

### 1. Application Workflow (`1-application-workflow.spec.ts`)
Tests the complete application lifecycle:
- Client creates new application with mandatory validation
- Document upload functionality
- KAM reviews and forwards to Credit
- Credit moves status to "Sent to NBFC"
- NBFC records a decision (Approved/Rejected)

### 2. Commission Payout Workflow (`2-commission-payout-workflow.spec.ts`)
Tests the commission payout process:
- Automatic ledger entry creation when loan is disbursed
- Client viewing ledger with running balance
- Client requesting payout
- Credit team approving payout request

### 3. Form Configuration Workflow (`3-form-configuration-workflow.spec.ts`)
Tests dynamic form configuration:
- KAM configures form mappings for clients
- Client sees correct dynamic form based on configuration
- Client submits application with configured mandatory fields

## Prerequisites

1. **Test Users**: For tests always use **Sagar@gmail.com** / **pass@123**. Ensure this user exists in Airtable (User Accounts) with the role needed for the test (client, kam, credit_team, or nbfc). See `TEST_USERS.md` in the project root.

2. **Running Servers**: The Playwright config automatically starts:
   - Frontend dev server on `http://localhost:8000`
   - Backend API server on `http://localhost:3001`

   If servers are already running, Playwright will reuse them.

3. **Sample Data**: Some tests may require existing data:
   - At least one loan product configured
   - At least one NBFC partner configured
   - Client-KAM relationship established

## Running Tests

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Run Specific Test File
```bash
npx playwright test e2e/1-application-workflow.spec.ts
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Helpers

### `helpers/auth.ts`
- `loginAs(page, userRole)`: Login as a specific user role
- `logout(page)`: Logout from the application
- `waitForAPIResponse(page, urlPattern)`: Wait for specific API call

### `helpers/navigation.ts`
- `navigateToPage(page, pageName)`: Navigate to a page via sidebar or URL
- `clickApplication(page, fileNumber)`: Click on a specific application
- `waitForPageLoad(page)`: Wait for page to fully load

## Test Data

Tests use **Sagar@gmail.com** / **pass@123** (defined in `helpers/auth.ts`). All roles (Client, KAM, Credit, NBFC) use the same credentials; the role is determined by the User Account in Airtable.

## Configuration

Tests are configured in `playwright.config.ts`:
- **Base URL**: `http://localhost:8000` (or `PLAYWRIGHT_TEST_BASE_URL` env var)
- **Test Directory**: `./e2e`
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshots**: On failure only
- **Traces**: On first retry

## Debugging

### View Test Report
After running tests, view the HTML report:
```bash
npx playwright show-report
```

### Debug a Specific Test
```bash
npx playwright test --debug e2e/1-application-workflow.spec.ts
```

### Run Tests with Trace
```bash
npx playwright test --trace on
```

Then view trace:
```bash
npx playwright show-trace trace.zip
```

## Troubleshooting

### Tests Fail with "User not found"
- Ensure test users are created in the database
- Check `TEST_USERS.md` for setup instructions
- Verify users have correct roles assigned

### Tests Fail with "Element not found"
- Check if the UI has changed (selectors may need updating)
- Verify the page has loaded completely (add more wait time)
- Check browser console for JavaScript errors

### Tests Timeout
- Ensure both frontend and backend servers are running
- Check network connectivity
- Increase timeout in test if needed: `await page.waitForSelector(selector, { timeout: 30000 })`

### Port Already in Use
- Stop existing servers on ports 8000 and 3001
- Or set `reuseExistingServer: false` in `playwright.config.ts`

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Tests should clean up any data they create (if possible)
3. **Wait Strategies**: Use `waitForLoadState('networkidle')` and explicit waits instead of fixed timeouts
4. **Selectors**: Prefer stable selectors (data-testid, role, text) over CSS classes
5. **Error Handling**: Use try-catch for optional elements that may not exist

## CI/CD Integration

For CI/CD pipelines, set environment variables:
```bash
CI=true npm run test:e2e
```

This will:
- Run tests in headless mode
- Retry failed tests twice
- Generate HTML report
- Take screenshots on failure

## Notes

- Tests assume the application is in a clean state or can handle existing data
- Some tests may require manual setup (e.g., creating a disbursed application)
- Tests use realistic but minimal data to avoid conflicts
- File uploads are skipped in some tests (can be added if needed)

