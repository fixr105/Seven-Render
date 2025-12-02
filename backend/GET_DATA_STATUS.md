# GET Data Webhook Status

## Current Status

**GET Webhook URL:**
```
https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d
```

**Status:** ⚠️ **NOT ACTIVE**

**Error Message:**
```
{
  "code": 404,
  "message": "The requested webhook \"GET 46a2b46b-3288-4970-bd13-99c2ba08d52d\" is not registered.",
  "hint": "The workflow must be active for a production URL to run successfully. You can activate the workflow using the toggle in the top-right of the editor."
}
```

## Expected Response Structure

Based on the `N8nGetResponse` interface in `backend/src/types/entities.ts`, the GET webhook should return a JSON object with the following structure:

```json
{
  "Admin Activity log": [...],
  "Client Form Mapping": [...],
  "Commission Ledger": [...],
  "Credit Team Users": [...],
  "Daily summary Reports": [...],
  "File Auditing Log": [...],
  "Form Categories": [...],
  "Form Fields": [...],
  "KAM Users": [...],
  "Loan Applications": [...],
  "Loan Products": [...],
  "NBFC Partners": [...],
  "User Accounts": [...]
}
```

Each key contains an array of records from that table.

## Expected Tables (13 total)

1. **Admin Activity log** - Array of `AdminActivityLogEntry[]`
2. **Client Form Mapping** - Array of `ClientFormMapping[]`
3. **Commission Ledger** - Array of `CommissionLedgerEntry[]`
4. **Credit Team Users** - Array of `CreditTeamUser[]`
5. **Daily summary Reports** - Array of `DailySummaryReport[]`
6. **File Auditing Log** - Array of `FileAuditLogEntry[]`
7. **Form Categories** - Array of `FormCategory[]`
8. **Form Fields** - Array of `FormField[]`
9. **KAM Users** - Array of `KAMUser[]`
10. **Loan Applications** - Array of `LoanApplication[]`
11. **Loan Products** - Array of `LoanProduct[]`
12. **NBFC Partners** - Array of `NBFCPartner[]`
13. **User Accounts** - Array of `UserAccount[]`

## Backend Implementation

The GET webhook is used by:
- `backend/src/services/airtable/n8nClient.ts` → `getAllData()` method
- Called by all controllers to fetch data before filtering by role

**Code Location:**
```typescript
async getAllData(): Promise<N8nGetResponse> {
  const response = await fetch(n8nConfig.getWebhookUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  // ...
}
```

## Next Steps

1. **Activate the GET webhook workflow** in n8n
   - The workflow with webhook ID `46a2b46b-3288-4970-bd13-99c2ba08d52d` needs to be activated
   - Toggle should be in the top-right of the n8n editor

2. **Verify the response structure** matches `N8nGetResponse` interface

3. **Test data fetching** once the webhook is active

## Notes

- The GET webhook is critical for the backend to function
- All data operations depend on this webhook being active
- The webhook should return all 13 tables in a single response
- Each table should be an array of records

