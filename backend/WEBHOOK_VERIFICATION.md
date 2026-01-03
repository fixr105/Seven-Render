# Webhook Path Verification

## Webhook Paths Configuration

All webhook paths have been verified to match the n8n configuration provided:

| Table Name | Webhook Path | Status |
|------------|--------------|--------|
| Admin Activity Log | `adminactivity` | ✅ Verified |
| User Accounts | `useraccount` | ✅ Verified |
| Client Form Mapping | `clientformmapping` | ✅ Verified |
| Clients | `client` | ✅ Verified |
| Commission Ledger | `commisionledger` | ✅ Verified |
| Credit Team Users | `creditteamuser` | ✅ Verified |
| Daily Summary Reports | `dailysummaryreport` | ✅ Verified |
| File Auditing Log | `fileauditinglog` | ✅ Verified |
| Form Categories | `formcategories` | ✅ Verified |
| Form Fields | `formfields` | ✅ Verified |
| KAM Users | `kamusers` | ✅ Verified |
| Loan Applications | `loanapplication` | ✅ Verified |
| Loan Products | `loanproducts` | ✅ Verified |
| NBFC Partners | `nbfcpartners` | ✅ Verified |
| Notifications | `notifications` | ✅ Verified |

## Base URL

All webhooks use the base URL: `https://fixrrahul.app.n8n.cloud/webhook/`

## Verification Script

Run the verification script to test all webhook endpoints and test user configuration:

```bash
cd backend
node scripts/verify-webhooks-and-users.js
```

This script will:
1. Test all 15 webhook GET endpoints
2. Verify all 4 test users exist in User Accounts
3. Check if profile records exist for each role:
   - Client → Clients table
   - KAM → KAM Users table
   - Credit Team → Credit Team Users table
   - NBFC → NBFC Partners table

## Test Users Configuration

### Required Test Users

| Email | Password | Role | Profile Table |
|-------|----------|------|---------------|
| `client@test.com` | `Test@123` | client | Clients |
| `kam@test.com` | `Test@123` | kam | KAM Users |
| `credit@test.com` | `Test@123` | credit_team | Credit Team Users |
| `nbfc@test.com` | `Test@123` | nbfc | NBFC Partners |

### Setting Up Test Users

**Option 1: Automatic Setup (Recommended)**
```bash
cd backend
node scripts/ensure-test-users.js
```

This script will:
- Check if each test user exists
- Create missing user accounts
- Create missing profile records for each role
- Verify all users are properly configured

**Option 2: Manual Setup**
1. Create user accounts via n8n webhook: `POST /webhook/adduser`
2. Create profile records:
   - Client: `POST /webhook/Client`
   - KAM: `POST /webhook/KAMusers`
   - Credit Team: `POST /webhook/CREDITTEAMUSERS`
   - NBFC: `POST /webhook/NBFCPartners`

### Profile Record Requirements

Each test user needs:
1. **User Account** in `User Accounts` table with:
   - `Username`: email address
   - `Password`: `Test@123` (plaintext or hashed, backend handles both)
   - `Role`: role name (client, kam, credit_team, nbfc)
   - `Account Status`: `Active`

2. **Profile Record** in the appropriate table:
   - **Client**: `Clients` table with `Client ID` matching User Account ID
   - **KAM**: `KAM Users` table with `Email` matching user email
   - **Credit Team**: `Credit Team Users` table with `Email` matching user email
   - **NBFC**: `NBFC Partners` table with `Contact Email/Phone` matching user email

### Why Profile Records Are Important

Profile records are required for:
- **RBAC Filtering**: The system uses profile records to filter data by role
- **KAM Assignment**: Clients need `Assigned KAM` field populated
- **Data Access**: Users can only see data associated with their profile

## Troubleshooting

### Webhook Not Responding

1. Check n8n workflow is active
2. Verify webhook path matches exactly (case-sensitive)
3. Check n8n logs for errors
4. Verify base URL is correct

### Test User Login Fails

1. Run verification script: `node scripts/verify-webhooks-and-users.js`
2. Check if user exists: `GET /webhook/useraccount` and search for email
3. Verify password is correct: `Test@123`
4. Check account status is `Active`
5. Verify profile record exists for the role

### RBAC Filtering Issues

1. Ensure profile record exists in the correct table
2. For KAM users, verify `KAM ID` matches User Account ID
3. For Credit Team, verify `Credit User ID` matches User Account ID
4. For Clients, verify `Client ID` matches User Account ID

## Configuration Files

- Webhook paths: `backend/src/services/airtable/n8nEndpoints.ts`
- Test user setup: `backend/scripts/ensure-test-users.js`
- Verification script: `backend/scripts/verify-webhooks-and-users.js`



