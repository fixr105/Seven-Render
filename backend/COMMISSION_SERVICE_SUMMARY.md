# Commission Ledger & Payout Workflow - Implementation Summary

**Date:** 2025-01-29  
**Purpose:** Build financial module logic for commission calculation, payout requests, and dispute management based on Commission Ledger and Payout Requests nodes in n8n flow.

## Implementation Overview

### Files Created

1. **`backend/src/services/commission/commission.service.ts`**
   - Main commission and payout service
   - Handles commission calculation on loan disbursement
   - Manages payout requests from clients
   - Handles dispute flagging and resolution

### Files Modified

1. **`backend/src/controllers/credit.controller.ts`**
   - Updated `markDisbursed()` to use `commissionService.calculateCommission()`
   - Updated `flagLedgerDispute()` to use `commissionService.flagDispute()`
   - Added `resolveLedgerDispute()` method

2. **`backend/src/controllers/ledger.controller.ts`**
   - Updated `createPayoutRequest()` to use `commissionService.createPayoutRequest()`
   - Updated `createLedgerQuery()` to use `commissionService.flagDispute()`

3. **`backend/src/routes/credit.routes.ts`**
   - Added route: `POST /credit/ledger/:ledgerEntryId/resolve-dispute`

## Key Features

### ✅ Commission Calculation

**Trigger**: When loan status is updated to 'Approved' or 'Disbursed'

**Function**: `calculateCommission(options)`

**Workflow**:
1. Fetches client's commission rate from Clients table (default: 1.5%)
2. Calculates commission: `(disbursedAmount * commissionRate) / 100`
3. Determines entry type: Payout (positive) or Payin (negative)
4. Creates Commission Ledger entry via n8n webhook
5. Returns commission calculation result

**Integration**:
- Called from `CreditController.markDisbursed()`
- Automatically creates ledger entry when loan is disbursed

### ✅ Payout Request

**Endpoint**: `POST /clients/me/payout-requests`

**Function**: `createPayoutRequest(user, options)`

**Workflow**:
1. Validates client has sufficient balance
2. Calculates current balance from ledger entries
3. Validates requested amount (must be ≤ balance)
4. Creates payout request entry in Commission Ledger
5. Logs to AdminActivityLog and FileAuditingLog
6. Returns request details

**Request Body**:
```json
{
  "amount": 5000,  // Optional: specific amount
  "full": true     // Optional: request full balance
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "LEDGER-...",
    "requestedAmount": 5000,
    "currentBalance": 10000
  }
}
```

### ✅ Dispute Flagging

**Endpoints**:
- `POST /clients/me/ledger/:ledgerEntryId/query` (Client)
- `POST /credit/ledger/:ledgerEntryId/flag-dispute` (Credit Team)

**Function**: `flagDispute(options)`

**Workflow**:
1. Validates ledger entry exists
2. Verifies access (clients can only flag their own entries)
3. Updates dispute status to `UNDER_QUERY`
4. Logs to AdminActivityLog and FileAuditingLog
5. Notifies Credit Team (if raised by client)

**Request Body**:
```json
{
  "message": "Commission amount seems incorrect",
  "reason": "Expected 1.5% but got 1.0%"
}
```

### ✅ Dispute Resolution

**Endpoint**: `POST /credit/ledger/:ledgerEntryId/resolve-dispute`

**Function**: `resolveDispute(user, ledgerEntryId, resolution)`

**Workflow**:
1. Validates user is Credit Team
2. Fetches ledger entry
3. Updates dispute status:
   - `RESOLVED` if dispute accepted
   - `NONE` if dispute rejected
4. Optionally adjusts payout amount if dispute accepted
5. Logs resolution to AdminActivityLog and FileAuditingLog
6. Notifies client

**Request Body**:
```json
{
  "resolved": true,           // true = accepted, false = rejected
  "adjustedAmount": 7500,     // Optional: new amount if accepted
  "notes": "Commission rate corrected to 1.5%"
}
```

## Service Methods

### `calculateCommission(options)`

Calculates and creates commission ledger entry:
- Fetches commission rate from client (or uses provided rate)
- Calculates commission amount
- Determines Payout vs Payin
- Creates ledger entry via n8n webhook
- Returns calculation result

**Parameters**:
- `loanFileId`: Loan file ID
- `clientId`: Client ID
- `disbursedAmount`: Disbursed loan amount
- `disbursedDate`: Optional disbursement date
- `commissionRate`: Optional commission rate (fetches from client if not provided)

**Returns**: `CommissionCalculationResult`

### `createPayoutRequest(user, options)`

Creates payout request for client:
- Validates balance availability
- Creates payout request entry
- Logs request

**Parameters**:
- `user`: AuthUser (must be CLIENT)
- `options`: CreatePayoutRequestOptions
  - `clientId`: Client ID
  - `amount`: Optional specific amount
  - `full`: Optional flag for full balance

**Returns**: `{ requestId, requestedAmount, currentBalance }`

### `flagDispute(options)`

Flags ledger entry for dispute:
- Validates entry exists and access
- Updates dispute status
- Logs dispute

**Parameters**:
- `ledgerEntryId`: Ledger entry ID
- `reason`: Dispute reason/message
- `raisedBy`: AuthUser raising dispute

### `resolveDispute(user, ledgerEntryId, resolution)`

Resolves dispute:
- Validates Credit Team access
- Updates dispute status
- Optionally adjusts amount
- Logs resolution

**Parameters**:
- `user`: AuthUser (must be CREDIT)
- `ledgerEntryId`: Ledger entry ID
- `resolution`: Resolution details
  - `resolved`: Boolean (accepted/rejected)
  - `adjustedAmount`: Optional new amount
  - `notes`: Optional resolution notes

### `getClientBalance(clientId)`

Gets client balance summary:
- Current balance
- Total payouts
- Total payins
- Pending payout requests
- Disputed entries count

## Integration Points

### Credit Controller

**`POST /credit/loan-applications/:id/mark-disbursed`**
- Uses `commissionService.calculateCommission()`
- Automatically creates commission ledger entry
- Sends notifications to client

**`POST /credit/ledger/:ledgerEntryId/flag-dispute`**
- Uses `commissionService.flagDispute()`
- Allows Credit Team to flag disputes

**`POST /credit/ledger/:ledgerEntryId/resolve-dispute`**
- Uses `commissionService.resolveDispute()`
- Allows Credit Team to resolve disputes

### Ledger Controller

**`POST /clients/me/payout-requests`**
- Uses `commissionService.createPayoutRequest()`
- Validates balance and creates request

**`POST /clients/me/ledger/:ledgerEntryId/query`**
- Uses `commissionService.flagDispute()`
- Allows clients to raise disputes

## Commission Calculation Logic

### Formula

```
commissionAmount = (disbursedAmount * commissionRate) / 100
```

### Entry Types

- **Payout**: Commission is positive (client earns money)
  - `payoutAmount = commissionAmount`
  - Stored as positive value

- **Payin**: Commission is negative (client owes money)
  - `payoutAmount = -Math.abs(commissionAmount)`
  - Stored as negative value

### Commission Rate

- Fetched from Client's `Commission Rate` field
- Default: 1.5% if not specified
- Stored as percentage (e.g., "1.5" for 1.5%)

## Dispute Workflow

### Client Raises Dispute

1. Client flags ledger entry for dispute
2. Status changes to `UNDER_QUERY`
3. Notification sent to Credit Team
4. Logged to AdminActivityLog and FileAuditingLog

### Credit Team Reviews

1. Credit Team can view all disputed entries
2. Can flag additional entries for dispute
3. Can resolve disputes

### Dispute Resolution

**Accepted (resolved = true)**:
- Status changes to `RESOLVED`
- Payout amount can be adjusted
- Client notified

**Rejected (resolved = false)**:
- Status changes to `NONE`
- Original entry remains unchanged
- Client notified

## Payout Request Workflow

### Client Creates Request

1. Client requests payout (specific amount or full balance)
2. System validates balance availability
3. Creates payout request entry
4. Status: `Requested`
5. Notification sent to Credit Team

### Credit Team Reviews

1. Credit Team views all payout requests
2. Can approve or reject requests

### Payout Approval

1. Credit Team approves request
2. Creates negative ledger entry (payout)
3. Updates request status to `Paid`
4. Client notified

### Payout Rejection

1. Credit Team rejects request
2. Updates request status to `Rejected`
3. Client notified with reason

## Logging

All commission and payout actions are logged to:

1. **AdminActivityLog**:
   - Commission calculation
   - Payout request creation
   - Dispute flagging
   - Dispute resolution

2. **FileAuditingLog**:
   - Commission entries (if linked to loan file)
   - Payout requests
   - Disputes

Uses `centralizedLogger` service for consistent logging.

## Testing

### Test Commission Calculation

```bash
# Mark loan as disbursed (triggers commission calculation)
curl -X POST "http://localhost:3001/api/credit/loan-applications/{id}/mark-disbursed" \
  -H "Authorization: Bearer <credit_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "disbursedAmount": 500000,
    "disbursedDate": "2025-01-29"
  }'
```

### Test Payout Request

```bash
# Create payout request
curl -X POST "http://localhost:3001/api/clients/me/payout-requests" \
  -H "Authorization: Bearer <client_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000
  }'
```

### Test Dispute Flagging

```bash
# Flag dispute (Client)
curl -X POST "http://localhost:3001/api/clients/me/ledger/{ledgerEntryId}/query" \
  -H "Authorization: Bearer <client_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Commission amount seems incorrect"
  }'
```

### Test Dispute Resolution

```bash
# Resolve dispute (Credit Team)
curl -X POST "http://localhost:3001/api/credit/ledger/{ledgerEntryId}/resolve-dispute" \
  -H "Authorization: Bearer <credit_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resolved": true,
    "adjustedAmount": 7500,
    "notes": "Commission rate corrected to 1.5%"
  }'
```

## Next Steps

1. ✅ Service created
2. ✅ Commission calculation integrated
3. ✅ Payout request integrated
4. ✅ Dispute flagging integrated
5. ✅ Dispute resolution integrated
6. ⏳ Test with real data
7. ⏳ Verify notifications
8. ⏳ Add balance validation in payout approval
9. ⏳ Add dispute statistics dashboard

## Files Summary

- **Service**: `backend/src/services/commission/commission.service.ts`
- **Credit Controller**: Updated `markDisbursed()`, `flagLedgerDispute()`, added `resolveLedgerDispute()`
- **Ledger Controller**: Updated `createPayoutRequest()`, `createLedgerQuery()`
- **Routes**: Added `POST /credit/ledger/:ledgerEntryId/resolve-dispute`
- **Documentation**: `backend/COMMISSION_SERVICE_SUMMARY.md`

