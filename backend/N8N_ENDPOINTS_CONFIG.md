# n8n Endpoints Configuration

This document describes the centralized n8n webhook endpoints configuration that ensures all backend paths match the n8n webhooks exactly as per `SEVEN-DASHBOARD-2.json`.

## Centralized Configuration

All n8n webhook endpoints are defined in `backend/src/services/airtable/n8nEndpoints.ts`. This file provides:

1. **Airtable Table IDs** - Table identifiers from SEVEN-DASHBOARD-2.json
2. **Airtable Table Names** - Table names as used in `fetchTable()` calls
3. **POST Webhook Paths** - Paths for creating/updating records
4. **GET Webhook Paths** - Paths for searching/fetching records
5. **Helper Functions** - Utilities to build full URLs
6. **Complete Endpoint Configuration** - `n8nEndpoints` object with all URLs

## POST Webhook Paths

These are used for creating/updating records in Airtable:

| Table | n8n Path | Full URL |
|-------|----------|----------|
| Admin Activity Log | `POSTLOG` | `/webhook/POSTLOG` |
| Client Form Mapping | `POSTCLIENTFORMMAPPING` | `/webhook/POSTCLIENTFORMMAPPING` |
| Commission Ledger | `COMISSIONLEDGER` | `/webhook/COMISSIONLEDGER` |
| Credit Team Users | `CREDITTEAMUSERS` | `/webhook/CREDITTEAMUSERS` |
| Daily Summary Reports | `DAILYSUMMARY` | `/webhook/DAILYSUMMARY` |
| File Auditing Log | `Fileauditinglog` | `/webhook/Fileauditinglog` |
| Form Categories | `FormCategory` | `/webhook/FormCategory` |
| Form Fields | `FormFields` | `/webhook/FormFields` |
| KAM Users | `KAMusers` | `/webhook/KAMusers` |
| Loan Applications | `loanapplications` | `/webhook/loanapplications` |
| Loan Products | `loanproducts` | `/webhook/loanproducts` |
| NBFC Partners | `NBFCPartners` | `/webhook/NBFCPartners` |
| User Accounts (Add) | `adduser` | `/webhook/adduser` |
| Clients | `Client` | `/webhook/Client` |
| Notifications | `notification` | `/webhook/notification` |
| Email | `email` | `/webhook/email` |

## GET Webhook Paths

These are used for searching/fetching records from Airtable:

| Table | n8n Path | Full URL |
|-------|----------|----------|
| Admin Activity Log | `adminactivity` | `/webhook/adminactivity` |
| Client Form Mapping | `clientformmapping` | `/webhook/clientformmapping` |
| Clients | `client` | `/webhook/client` |
| Commission Ledger | `commisionledger` | `/webhook/commisionledger` |
| Credit Team Users | `creditteamuser` | `/webhook/creditteamuser` |
| Daily Summary Reports | `dailysummaryreport` | `/webhook/dailysummaryreport` |
| File Auditing Log | `fileauditinglog` | `/webhook/fileauditinglog` |
| Form Categories | `formcategories` | `/webhook/formcategories` |
| Form Fields | `formfields` | `/webhook/formfields` |
| KAM Users | `kamusers` | `/webhook/kamusers` |
| Loan Applications | `loanapplication` | `/webhook/loanapplication` |
| Loan Products | `loanproducts` | `/webhook/loanproducts` |
| NBFC Partners | `nbfcpartners` | `/webhook/nbfcpartners` |
| Notifications | `notifications` | `/webhook/notifications` |
| User Accounts | `useraccount` | `/webhook/useraccount` |

## Important Notes

### Loan Applications Path Difference

- **POST** operations use `/webhook/loanapplications` (plural)
- **GET** operations use `/webhook/loanapplication` (singular)

This matches the n8n workflow configuration in SEVEN-DASHBOARD-2.json.

### Case Sensitivity

n8n webhook paths are case-sensitive. The configuration file preserves the exact case as defined in SEVEN-DASHBOARD-2.json:
- `POSTLOG` (uppercase)
- `COMISSIONLEDGER` (uppercase)
- `Fileauditinglog` (mixed case)
- `adminactivity` (lowercase)
- `commisionledger` (lowercase)

## Usage

### In Controllers

```typescript
import { n8nEndpoints } from '../services/airtable/n8nEndpoints.js';

// POST example
await n8nClient.postData(n8nEndpoints.post.loanApplications, data);

// GET example (via fetchTable)
const applications = await n8nClient.fetchTable('Loan Application');
// Internally uses: n8nEndpoints.get.loanApplication
```

### Environment Variable Overrides

All endpoints support environment variable overrides:

```bash
# POST endpoints
N8N_POST_LOAN_APPLICATIONS_URL=https://custom.n8n.cloud/webhook/loanapplications
N8N_POST_CLIENT_URL=https://custom.n8n.cloud/webhook/Client

# GET endpoints
N8N_GET_LOAN_APPLICATION_URL=https://custom.n8n.cloud/webhook/loanapplication
N8N_GET_CLIENT_URL=https://custom.n8n.cloud/webhook/client
```

### Base URL Configuration

The base URL can be configured via:

```bash
N8N_BASE_URL=https://your-n8n-instance.com
```

Default: `https://fixrrahul.app.n8n.cloud`

## Migration from Old Config

The old configuration files (`airtable.ts` and `webhookConfig.ts`) are maintained for backward compatibility but now re-export from the centralized `n8nEndpoints.ts`. Existing code will continue to work, but new code should use `n8nEndpoints` directly.

### Before (Old Way)

```typescript
import { n8nConfig } from '../../config/airtable.js';
await n8nClient.postData(n8nConfig.postApplicationsUrl, data);
```

### After (New Way)

```typescript
import { n8nEndpoints } from '../services/airtable/n8nEndpoints.js';
await n8nClient.postData(n8nEndpoints.post.loanApplications, data);
```

## Airtable Table IDs

The configuration also includes Airtable table IDs from SEVEN-DASHBOARD-2.json:

```typescript
import { AIRTABLE_TABLE_IDS } from '../services/airtable/n8nEndpoints.js';

// Example: Loan Applications table ID
const tableId = AIRTABLE_TABLE_IDS.LOAN_APPLICATIONS; // 'tblN8oQ5sT0vX3yZ6'
```

## Validation

All paths in this configuration match exactly with SEVEN-DASHBOARD-2.json. Any changes to n8n webhook paths should be updated in `n8nEndpoints.ts` to maintain consistency across the codebase.

