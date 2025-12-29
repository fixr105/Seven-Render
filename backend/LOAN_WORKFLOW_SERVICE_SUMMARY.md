# Loan Workflow & Status Transitions - Implementation Summary

**Date:** 2025-01-29  
**Purpose:** Integrate Loan Files webhook logic, handle new loan submissions with proper status transitions, and implement 'Forward to Credit Team' function with notifications.

## Implementation Overview

### Files Created

1. **`backend/src/services/workflow/loanWorkflow.service.ts`**
   - Main loan workflow service
   - Handles loan application creation with proper status setting
   - Implements forward to credit team with notifications
   - Integrates with status state machine
   - Logs all workflow actions

### Files Modified

1. **`backend/src/controllers/loan.controller.ts`**
   - Updated `createApplication()` to use `loanWorkflowService`
   - Ensures status is set to 'Under KAM Review' when submitted

2. **`backend/src/controllers/kam.controller.ts`**
   - Updated `forwardToCredit()` to use `loanWorkflowService`
   - Ensures proper notifications to Credit Team

## Key Features

### ✅ New Loan Submission

**Endpoint**: `POST /loan-applications`

**Workflow**:
1. Client creates/submits loan application
2. If `saveAsDraft=false`: Status set to **'Under KAM Review'**
3. If `saveAsDraft=true`: Status set to **'Draft'**
4. Application created via Loan Files webhook (`postLoanApplication`)
5. Logged to AdminActivityLog and FileAuditingLog
6. Notification sent to assigned KAM (if submitted)

**Status Flow**:
```
Draft → Under KAM Review (when submitted)
```

### ✅ Forward to Credit Team

**Endpoint**: `POST /kam/loan-applications/:id/forward-to-credit`

**Workflow**:
1. KAM forwards application
2. Status transitions: **'Under KAM Review' → 'Pending Credit Review'**
3. Validates transition using status state machine
4. Updates application via Loan Files webhook
5. Records status change in history
6. Logs to AdminActivityLog and FileAuditingLog
7. **Notifies all active Credit Team members**

**Status Flow**:
```
Under KAM Review → Pending Credit Review
```

**Notifications**:
- Creates in-app notifications for all active Credit Team users
- Notification includes file ID, client ID, and optional notes
- Action link points to application detail page

## Service Methods

### `createLoanApplication(user, options)`

Creates a new loan application with proper status setting:
- Generates File ID (format: `SF{timestamp}`)
- Sets status based on `saveAsDraft` flag
- Creates application via Loan Files webhook
- Logs application creation
- Sends notification to assigned KAM (if submitted)

**Parameters**:
- `user`: AuthUser (must be CLIENT)
- `options`: CreateLoanApplicationOptions
  - `clientId`: Client ID
  - `productId`: Optional product ID
  - `applicantName`: Applicant name
  - `requestedLoanAmount`: Loan amount
  - `formData`: Form field data
  - `documents`: Document URLs
  - `saveAsDraft`: Boolean flag

**Returns**: `{ applicationId, fileId, status }`

### `forwardToCreditTeam(user, options)`

Forwards application to Credit Team:
- Validates status transition
- Updates application status
- Records status change
- Logs workflow action
- Notifies all active Credit Team members

**Parameters**:
- `user`: AuthUser (must be KAM)
- `options`: ForwardToCreditOptions
  - `fileId`: Application File ID
  - `notes`: Optional notes
  - `assignedCreditAnalystId`: Optional credit analyst assignment

### `getWorkflowInfo(fileId, userRole)`

Returns workflow information for an application:
- Current status
- Allowed next statuses for the user role
- Status display name

## Integration with Loan Files Webhook

The service uses `n8nClient.postLoanApplication()` which:
- Calls `/webhook/loanapplications` (POST)
- Updates Airtable: Loan Applications table
- Handles all required fields
- Supports versioning and document tracking

## Status Transitions

### Valid Transitions (from Under KAM Review)

- **KAM can**:
  - `UNDER_KAM_REVIEW` → `QUERY_WITH_CLIENT` (raise query)
  - `UNDER_KAM_REVIEW` → `PENDING_CREDIT_REVIEW` (forward to credit) ✅
  - `UNDER_KAM_REVIEW` → `WITHDRAWN` (client withdraws)

### State Machine Validation

All status transitions are validated using:
- `validateTransition()` from `statusStateMachine.ts`
- Checks if transition is allowed in state machine
- Checks if role has permission for transition
- Throws error if invalid

## Notification Flow

### When Application is Submitted

1. Application created with status `UNDER_KAM_REVIEW`
2. Get client's assigned KAM from Clients table
3. Create notification for assigned KAM:
   - Type: `application_submitted`
   - Title: "New Application Submitted"
   - Message: Includes file ID and applicant name
   - Channel: `in_app`
   - Action Link: `/applications/{fileId}`

### When Forwarded to Credit Team

1. Status updated to `PENDING_CREDIT_REVIEW`
2. Fetch all active Credit Team users
3. Create notifications for each active credit user:
   - Type: `application_forwarded`
   - Title: "Application Forwarded to Credit"
   - Message: Includes file ID and optional notes
   - Channel: `in_app`
   - Action Link: `/applications/{fileId}`

## Logging

All workflow actions are logged to:

1. **AdminActivityLog**:
   - Application creation
   - Status changes
   - Forward to credit actions

2. **FileAuditingLog**:
   - Status transitions
   - Application submission
   - Forward to credit

Uses `centralizedLogger` service for consistent logging.

## Error Handling

- **Validation Errors**: Returns 400 with clear error message
- **Not Found Errors**: Returns 404
- **Permission Errors**: Returns 403
- **Notification Failures**: Logged but don't break workflow
- **Webhook Failures**: Thrown and handled by controller

## Usage Examples

### Create Application

```typescript
import { loanWorkflowService } from '../services/workflow/loanWorkflow.service.js';

const result = await loanWorkflowService.createLoanApplication(user, {
  clientId: 'CLIENT-001',
  productId: 'PROD-001',
  applicantName: 'John Doe',
  requestedLoanAmount: '500000',
  formData: { pan: 'ABCDE1234F' },
  documents: 'field1:url1,field2:url2',
  saveAsDraft: false, // Will set status to UNDER_KAM_REVIEW
});
```

### Forward to Credit

```typescript
import { loanWorkflowService } from '../services/workflow/loanWorkflow.service.js';

await loanWorkflowService.forwardToCreditTeam(kamUser, {
  fileId: 'SF12345678',
  notes: 'Application looks good, ready for credit review',
  assignedCreditAnalystId: 'CREDIT-001', // Optional
});
```

## PRD Section 3.2 Compliance

The implementation mirrors PRD Section 3.2 workflow:

1. ✅ **Client Submission**: Status set to 'Under KAM Review'
2. ✅ **KAM Review**: KAM can review, edit, or forward
3. ✅ **Forward to Credit**: Status changes to 'Pending Credit Review'
4. ✅ **Credit Team Notification**: All active credit users notified
5. ✅ **Status Tracking**: All transitions logged and tracked
6. ✅ **State Machine**: Validates all transitions

## Testing

### Test Application Creation

```bash
# Create application (submitted)
curl -X POST "http://localhost:3001/api/loan-applications" \
  -H "Authorization: Bearer <client_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "applicantName": "John Doe",
    "requestedLoanAmount": "500000",
    "formData": {},
    "saveAsDraft": false
  }'
```

### Test Forward to Credit

```bash
# Forward application to credit
curl -X POST "http://localhost:3001/api/kam/loan-applications/{id}/forward-to-credit" \
  -H "Authorization: Bearer <kam_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Application ready for credit review",
    "assignedCreditAnalystId": "CREDIT-001"
  }'
```

## Next Steps

1. ✅ Service created
2. ✅ Loan creation integrated
3. ✅ Forward to credit integrated
4. ✅ Notifications implemented
5. ⏳ Test with real data
6. ⏳ Verify notifications are received
7. ⏳ Add email notifications (optional)
8. ⏳ Add workflow visualization

## Files Summary

- **Service**: `backend/src/services/workflow/loanWorkflow.service.ts`
- **Loan Controller**: Updated `createApplication()` method
- **KAM Controller**: Updated `forwardToCredit()` method
- **Documentation**: `backend/LOAN_WORKFLOW_SERVICE_SUMMARY.md`

