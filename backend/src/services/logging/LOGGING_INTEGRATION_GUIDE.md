# Centralized Logging Service Integration Guide

## Overview

The Centralized Logging Service intercepts all major state changes and logs them to:
1. **AdminActivityLog** - Administrative actions
2. **FileAuditingLog** - File-specific audit trail and queries

This service ensures proper RBAC tracking by capturing user roles correctly (Client, KAM, Credit Team, NBFC).

## Service Location

- **Main Service**: `backend/src/services/logging/centralizedLogger.service.ts`
- **Middleware**: `backend/src/services/logging/loggingMiddleware.ts`
- **Export**: `centralizedLogger` (singleton instance)

## Usage Examples

### 1. Log Status Changes

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// In your controller
await centralizedLogger.logStatusChange(
  req.user!,
  fileId,
  oldStatus,
  newStatus,
  'Forwarded to credit team for review'
);
```

### 2. Log File Uploads

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// After successful file upload
await centralizedLogger.logFileUpload(
  req.user!,
  fileId,
  'PAN Card',
  documentUrl
);
```

### 3. Log Query Raised

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// When raising a query
await centralizedLogger.logQueryRaised(
  req.user!,
  fileId,
  'Please provide updated bank statements',
  'client', // target user role
  parentQueryId // optional, for threading
);
```

### 4. Log Query Reply

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// When replying to a query
await centralizedLogger.logQueryReply(
  req.user!,
  fileId,
  parentQueryId,
  'Bank statements have been uploaded'
);
```

### 5. Log Application Creation

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// After creating a new application
await centralizedLogger.logApplicationCreated(
  req.user!,
  fileId,
  clientId,
  applicantName
);
```

### 6. Log Application Submission

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// After submitting an application
await centralizedLogger.logApplicationSubmitted(
  req.user!,
  fileId
);
```

### 7. Log Client Creation

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// After creating a client
await centralizedLogger.logClientCreated(
  req.user!,
  clientId,
  clientName
);
```

### 8. Custom Admin Activity

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';
import { AdminActionType } from '../../utils/adminLogger.js';

// For custom actions
await centralizedLogger.logAdminActivity(req.user!, {
  actionType: AdminActionType.ASSIGN_NBFC,
  description: 'Assigned NBFC partner for loan application',
  targetEntity: 'loan_application',
  relatedFileId: fileId,
  relatedClientId: clientId,
  metadata: { nbfcId, nbfcName },
});
```

### 9. Custom File Audit

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// For custom file audit events
await centralizedLogger.logFileAudit(req.user!, {
  fileId,
  actionEventType: 'document_verified',
  detailsMessage: 'PAN card verified by credit team',
  targetUserRole: 'credit_team',
  resolved: true,
});
```

## Integration Points

### Controllers to Update

1. **LoanController** (`backend/src/controllers/loan.controller.ts`)
   - ✅ `createApplication()` - Log application creation
   - ✅ `submitApplication()` - Log submission
   - ✅ `updateApplicationForm()` - Log form updates
   - ✅ File upload handlers - Log document uploads

2. **KAMController** (`backend/src/controllers/kam.controller.ts`)
   - ✅ `forwardToCredit()` - Log status change
   - ✅ `editApplication()` - Log edits
   - ✅ `createClient()` - Log client creation

3. **CreditController** (`backend/src/controllers/credit.controller.ts`)
   - ✅ `markInNegotiation()` - Log status change
   - ✅ `assignNBFCs()` - Log NBFC assignment
   - ✅ `captureNBFCDecision()` - Log NBFC decision
   - ✅ `markDisbursed()` - Log disbursement

4. **QueryService** (`backend/src/services/queries/query.service.ts`)
   - ✅ `createQuery()` - Log query raised
   - ✅ `createQueryReply()` - Log query reply
   - ✅ `resolveQuery()` - Log query resolved

5. **DocumentsController** (`backend/src/controllers/documents.controller.ts`)
   - ✅ File upload handlers - Log document uploads

## RBAC Role Tracking

The service automatically captures user roles correctly:

- **Client (DSA Partner)**: `user.role === 'client'`
- **Key Account Manager (KAM)**: `user.role === 'kam'`
- **Credit Team**: `user.role === 'credit_team'`
- **NBFC Partner**: `user.role === 'nbfc'`

The logger formats user identifiers as: `email (Role Display Name)`

Example: `client@test.com (Client (DSA Partner))`

## Migration Strategy

### Phase 1: Parallel Logging (Current)
- Centralized logger logs to console and falls back to n8n webhooks
- Existing n8n-based logging continues to work
- No breaking changes

### Phase 2: Database Integration
- Uncomment Prisma code in `centralizedLogger.service.ts`
- Install Prisma: `npm install prisma @prisma/client`
- Generate Prisma client: `npx prisma generate`
- Update `DATABASE_URL` in `.env`
- Centralized logger writes directly to database

### Phase 3: Full Migration
- Remove n8n webhook fallbacks
- All logging goes through centralized service
- Database becomes single source of truth

## Error Handling

The centralized logger **never throws errors**. If logging fails:
1. Error is logged to console
2. Operation continues normally
3. Fallback to n8n webhook (during migration)

This ensures logging failures don't break business operations.

## Query Threading

Queries support threading via embedded metadata in `detailsMessage`:

- **New Query**: `[[status:open]] Query message`
- **Reply**: `[[parent:<queryId>]][[status:open]] Reply message`
- **Resolved**: `[[parent:<queryId>]][[status:resolved]] Query resolved`

The service automatically formats query messages with this metadata.

## Best Practices

1. **Always log after successful operations** - Don't log before validation
2. **Include relevant context** - Add metadata for debugging
3. **Use appropriate action types** - Use `AdminActionType` enum values
4. **Don't log sensitive data** - Exclude passwords, tokens, etc.
5. **Log asynchronously** - Use `await` but don't block on errors

## Testing

To test the logging service:

```typescript
import { centralizedLogger } from '../services/logging/centralizedLogger.service.js';

// Test admin activity logging
await centralizedLogger.logAdminActivity(testUser, {
  actionType: 'test_action',
  description: 'Test logging',
  targetEntity: 'test',
});

// Test file audit logging
await centralizedLogger.logFileAudit(testUser, {
  fileId: 'TEST-FILE-001',
  actionEventType: 'test_event',
  detailsMessage: 'Test audit log',
});
```

## Monitoring

Check logs for:
- `[CentralizedLogger] Admin Activity:` - Admin activity logs
- `[CentralizedLogger] File Audit:` - File audit logs
- `[CentralizedLogger] Failed to log` - Logging errors

## Future Enhancements

1. **Batch Logging** - Queue logs and batch insert
2. **Log Retention** - Automatic cleanup of old logs
3. **Log Analytics** - Query and analyze logs
4. **Real-time Notifications** - Trigger notifications based on logs
5. **Audit Reports** - Generate audit reports from logs

