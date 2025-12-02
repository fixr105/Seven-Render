# Notifications Service Implementation

**Date:** 2025-12-02  
**Status:** ✅ Complete

## Overview

Implemented email and in-app notification service using SendGrid for email delivery and Airtable for notification storage. Notifications are automatically triggered on:
- Loan status changes
- Query creation
- Payout approvals/rejections
- Disbursements
- Commission creation

## Architecture

### Components

1. **Notification Service** (`notification.service.ts`)
   - Creates notifications in Airtable
   - Sends emails via SendGrid
   - Provides helper methods for different notification types

2. **SendGrid Service** (`sendgrid.service.ts`)
   - Handles email sending via SendGrid API
   - Formats HTML emails with branding
   - Gracefully handles missing API key

3. **Notifications Controller** (`notifications.controller.ts`)
   - GET endpoints for retrieving notifications
   - Mark as read functionality
   - Unread count endpoint

4. **Integration Points**
   - Credit controller: Disbursement, payout notifications
   - KAM controller: Query notifications
   - Status change handlers: Status update notifications

## API Endpoints

### 1. GET /notifications

Get notifications for current user.

**Query Parameters:**
- `unreadOnly` (optional): Filter to unread only (`true`/`false`)
- `limit` (optional): Limit number of results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "NOTIF-123",
      "notificationId": "NOTIF-123",
      "title": "Loan Disbursed",
      "message": "Your loan application FILE-001 has been disbursed...",
      "notificationType": "disbursement",
      "channel": "both",
      "isRead": false,
      "createdAt": "2025-12-02T10:00:00.000Z",
      "actionLink": "/applications/FILE-001"
    }
  ],
  "count": 10,
  "unreadCount": 5
}
```

### 2. GET /notifications/unread-count

Get unread notification count.

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

### 3. POST /notifications/:id/read

Mark a notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### 4. POST /notifications/mark-all-read

Mark all notifications as read for current user.

**Response:**
```json
{
  "success": true,
  "message": "10 notifications marked as read",
  "count": 10
}
```

## Notification Types

### Status Change
- **Trigger:** Loan application status changes
- **Recipient:** Client
- **Channel:** Both (email + in-app)

### Query Created
- **Trigger:** KAM or Credit team raises query
- **Recipient:** Client or KAM (depending on who raised it)
- **Channel:** Both

### Query Reply
- **Trigger:** Reply to existing query
- **Recipient:** Original query author
- **Channel:** Both

### Payout Approved
- **Trigger:** Credit team approves payout request
- **Recipient:** Client
- **Channel:** Both

### Payout Rejected
- **Trigger:** Credit team rejects payout request
- **Recipient:** Client
- **Channel:** Both

### Disbursement
- **Trigger:** Loan marked as disbursed
- **Recipient:** Client
- **Channel:** Both

### Commission Created
- **Trigger:** Commission ledger entry created
- **Recipient:** Client
- **Channel:** Both

## Airtable Schema

### Notifications Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique record ID (for matching) |
| `Notification ID` | string | Unique notification identifier |
| `Recipient User` | string | User email or ID |
| `Recipient Role` | string | Role (client, kam, credit_team, nbfc) |
| `Related File` | string | Related loan application file ID |
| `Related Client` | string | Related client ID |
| `Related Ledger Entry` | string | Related ledger entry ID |
| `Notification Type` | string | Type of notification |
| `Title` | string | Notification title |
| `Message` | string | Notification message |
| `Channel` | string | 'email', 'in_app', or 'both' |
| `Is Read` | string | 'True' or 'False' |
| `Created At` | string | ISO timestamp |
| `Read At` | string | ISO timestamp (when read) |
| `Action Link` | string | Link to related resource |

## SendGrid Configuration

### Environment Variables

Add to `.env`:
```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@sevenfincorp.com
SENDGRID_FROM_NAME=Seven Fincorp
FRONTEND_URL=https://yourdomain.com
```

### Email Format

Emails are sent with:
- Branded header (Seven Fincorp)
- HTML-formatted message
- Action button (if action link provided)
- Footer with disclaimer

## Integration Points

### 1. Disbursement Notification

**File:** `backend/src/controllers/credit.controller.ts`

```typescript
// After marking as disbursed
await notificationService.notifyDisbursement(
  fileId,
  clientId,
  amount,
  clientEmail
);

await notificationService.notifyCommissionCreated(
  ledgerEntryId,
  clientId,
  commission,
  clientEmail
);
```

### 2. Payout Notifications

**File:** `backend/src/controllers/credit.controller.ts`

```typescript
// After approving payout
await notificationService.notifyPayoutApproved(
  ledgerEntryId,
  clientId,
  amount,
  clientEmail
);

// After rejecting payout
await notificationService.notifyPayoutRejected(
  ledgerEntryId,
  clientId,
  reason,
  clientEmail
);
```

### 3. Query Notifications

**File:** `backend/src/controllers/kam.controller.ts` and `credit.controller.ts`

```typescript
// After raising query
await notificationService.notifyQueryCreated(
  fileId,
  clientId,
  queryMessage,
  recipientEmail,
  recipientRole,
  raisedBy
);
```

## Usage Examples

### Creating Custom Notification

```typescript
import { notificationService } from '../services/notifications/notification.service';

await notificationService.createNotification({
  recipientUser: 'user@example.com',
  recipientRole: 'client',
  relatedFile: 'FILE-001',
  relatedClient: 'CLIENT-123',
  notificationType: 'status_change',
  title: 'Application Status Updated',
  message: 'Your application status has changed to Approved',
  channel: 'both',
  actionLink: '/applications/FILE-001',
});
```

### Frontend Integration

```typescript
// Get notifications
const response = await apiService.get('/notifications?unreadOnly=true');
const notifications = response.data;

// Get unread count
const countResponse = await apiService.get('/notifications/unread-count');
const unreadCount = countResponse.data.unreadCount;

// Mark as read
await apiService.post(`/notifications/${notificationId}/read`);

// Mark all as read
await apiService.post('/notifications/mark-all-read');
```

## Files Created

1. `backend/src/services/notifications/notification.service.ts` - Main notification service
2. `backend/src/services/notifications/sendgrid.service.ts` - SendGrid email service
3. `backend/src/controllers/notifications.controller.ts` - Notification endpoints
4. `backend/src/routes/notifications.routes.ts` - Notification routes
5. `backend/NOTIFICATIONS_IMPLEMENTATION.md` - This documentation

## Files Modified

1. `backend/src/config/airtable.ts` - Added `postNotificationUrl`
2. `backend/src/services/airtable/n8nClient.ts` - Added `postNotification()` method
3. `backend/src/routes/index.ts` - Added notifications routes
4. `backend/src/types/entities.ts` - Added `NotificationEntry` interface
5. `backend/src/controllers/credit.controller.ts` - Added notification triggers
6. `backend/src/controllers/kam.controller.ts` - Added notification triggers

## Testing

### Test Email Notification

1. Set `SENDGRID_API_KEY` in `.env`
2. Trigger a disbursement or payout approval
3. Check email inbox for notification
4. Verify notification appears in Airtable

### Test In-App Notification

1. Create a notification via API
2. Fetch notifications: `GET /notifications`
3. Verify notification appears
4. Mark as read: `POST /notifications/:id/read`
5. Verify `isRead` is true

## Notes

- Email notifications are sent asynchronously and won't fail the main request if email fails
- Notifications are filtered by user email and role
- Unread count is calculated in real-time
- SendGrid API key is optional (system works without it, just won't send emails)
- All notifications are stored in Airtable for audit trail

