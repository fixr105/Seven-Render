# Backend P0 Tests

This directory contains backend tests for P0 critical features as defined in `docs/test-plan-P0.md`.

## Test Files

### `helpers/mockN8nClient.ts`
- Provides mock n8n client with realistic data matching SEVEN-DASHBOARD-2.json structure
- Includes mock data for:
  - Loan Applications
  - Commission Ledger
  - Form Fields, Form Categories, Client Form Mapping
  - File Auditing Log
  - Notifications
  - Clients

### `controllers/loan.controller.test.ts`
- **M3-BE-001**: Role-based application listings (CLIENT, KAM, CREDIT, NBFC)
- **M2-BE-003**: Mandatory field validation on submit

### `controllers/ledger.controller.test.ts`
- **M1-BE-001**: CLIENT view commission ledger with balance calculation
- **M1-BE-002**: CREDIT view commission ledger with filters
- **M1-BE-003**: CLIENT payout request creation and validation
- **M1-BE-003**: CREDIT approve/reject payout requests

### `controllers/queries.controller.test.ts`
- **M4-E2E-001**: Query raise and response workflow (KAM → CLIENT)
- **M4-BE-001**: Comprehensive audit logging
- **M4-BE-002**: Notification creation

## Running Tests

```bash
cd backend
npm test
```

## Test Structure

All tests:
- Mock n8n webhook calls using `mockN8nClient`
- Use realistic data matching Airtable table structures
- Test role-based access control
- Verify webhook calls are made correctly
- Check data persistence via posted data tracking

## Mocking Strategy

- `n8nClient` is mocked at the module level
- `fetchTable()` returns predefined mock data
- `post*()` methods track posted data for verification
- Services (queryService, notificationService) are mocked
- Admin logger is mocked to avoid side effects

## Test Data

Mock data matches the structure from SEVEN-DASHBOARD-2.json:
- Field names match Airtable column names exactly
- Data types match expected formats (strings, dates, etc.)
- Relationships between tables are maintained (Client IDs, File IDs, etc.)

