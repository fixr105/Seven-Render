# Role Enforcement with Admin Override

## Overview

The Role Enforcement Middleware provides fine-grained access control for sensitive operations with support for admin override tokens. This ensures role integrity while allowing emergency access when needed.

## Features

- ✅ **Role-Based Access Control**: Enforces permissions based on user roles
- ✅ **Admin Override**: Allows admins to bypass restrictions with tokens
- ✅ **Violation Logging**: Logs all access violations and overrides
- ✅ **Email Alerts**: Optional email notifications for violations
- ✅ **Audit Trail**: Complete traceability of all access attempts

## Permission Rules

| Action | Allowed Roles | Admin Override | Override Token Required |
|--------|--------------|----------------|------------------------|
| Approve/Reject Loan | Credit Team | ✅ Yes | ❌ No |
| Disburse Loan | None (Admin only) | ✅ Yes | ✅ **Yes** |
| Edit Commission Post-Disbursal | None | ✅ Yes | ✅ **Yes** |
| Update Loan Status | Credit Team | ❌ No | N/A |
| Post Admin Activity Log | Credit Team, KAM | ✅ Yes | ❌ No |
| Post Commission Ledger | Credit Team | ✅ Yes | ❌ No |

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Admin Override Tokens (comma-separated)
ADMIN_OVERRIDE_TOKENS=token1,token2,token3

# Admin Emails (comma-separated) - for identifying admin users
ADMIN_EMAILS=admin@sevenfincorp.com,superadmin@sevenfincorp.com

# Enable email alerts for violations (true/false)
ENABLE_ADMIN_ALERTS=true

# Admin alert email recipients (comma-separated)
ADMIN_ALERT_EMAILS=security@sevenfincorp.com,admin@sevenfincorp.com

# N8N Base URL (for email webhook)
N8N_BASE_URL=https://your-n8n-instance.app.n8n.cloud
N8N_POST_EMAIL_URL=${N8N_BASE_URL}/webhook/email
```

### Generating Override Tokens

Generate secure random tokens:

```bash
# Generate a secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the generated token to `ADMIN_OVERRIDE_TOKENS` in your `.env` file.

## Usage

### Using Admin Override

When making a request that requires admin override, include the `X-Admin-Override-Token` header:

```bash
curl -X POST https://api.example.com/credit/loan-applications/APP-001/mark-disbursed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Admin-Override-Token: YOUR_OVERRIDE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disbursedAmount": "500000",
    "disbursedDate": "2026-01-03"
  }'
```

### JavaScript/TypeScript Example

```typescript
const response = await fetch('/credit/loan-applications/APP-001/mark-disbursed', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Admin-Override-Token': process.env.ADMIN_OVERRIDE_TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    disbursedAmount: '500000',
    disbursedDate: '2026-01-03',
  }),
});
```

## Protected Endpoints

The following endpoints are protected by role enforcement:

### Credit Team Routes

- `POST /credit/loan-applications/:id/mark-disbursed` - **Requires override token**
- `POST /credit/loan-applications/:id/nbfc-decision` - Approve/Reject (Credit Team)
- `POST /credit/ledger/entries` - **Requires override token** (Edit commission)

### Webhook Endpoints

- `POST /webhook/adminactivitylog` - Post admin activity (Credit Team, KAM)
- `POST /webhook/commissionledger` - Post commission ledger (Credit Team)

## Access Violation Response

When access is denied, the API returns:

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "details": "User user@example.com (kam) does not have permission for disburse_loan",
  "action": "disburse_loan",
  "requiredRoles": [],
  "userRole": "kam",
  "adminOverrideAvailable": true,
  "overrideTokenRequired": true
}
```

## Violation Logging

All access violations and overrides are logged to the Admin Activity Log with:

- **Reference Type**: "Access Violation"
- **Reference ID**: Request path
- **Updated Status**: "Blocked" or "Override Used"
- **Remarks**: Detailed reason for violation/override

### Example Violation Log Entry

```json
{
  "Activity ID": "VIOLATION-1704295800000-abc123",
  "Timestamp": "2026-01-03T10:00:00Z",
  "Performed By": "kam@example.com",
  "Action Type": "access_violation",
  "Description/Details": "Access violation: disburse_loan. User: kam@example.com (kam). Reason: User kam@example.com (kam) does not have permission for disburse_loan. Status: Blocked",
  "Reference Type": "Access Violation",
  "Reference ID": "/credit/loan-applications/APP-001/mark-disbursed",
  "Updated Status": "Blocked",
  "Remarks": "User kam@example.com (kam) does not have permission for disburse_loan"
}
```

## Email Alerts

When `ENABLE_ADMIN_ALERTS=true`, email alerts are sent to `ADMIN_ALERT_EMAILS` for:

- **Access Violations**: When unauthorized access is attempted
- **Admin Overrides**: When an admin override token is used

### Email Format

**Subject**: `[Access Violation] disburse_loan blocked for kam@example.com`

**Body**:
```
Access violation detected and blocked:

Action: disburse_loan
User: kam@example.com (kam)
Reason: User kam@example.com (kam) does not have permission for disburse_loan
Time: 2026-01-03T10:00:00Z

This action was blocked due to insufficient permissions.
```

## Admin Identification

Admins are identified by:

1. **Role**: Users with role `admin` or `administrator`
2. **Email**: Users whose email is in `ADMIN_EMAILS` environment variable

## Testing

### Test Admin Override

```bash
# Test with valid override token
curl -X POST http://localhost:3001/credit/loan-applications/APP-001/mark-disbursed \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Admin-Override-Token: YOUR_OVERRIDE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disbursedAmount": "500000"}'

# Should return 200 OK with override logged
```

### Test Access Violation

```bash
# Test without override token (should be blocked)
curl -X POST http://localhost:3001/credit/loan-applications/APP-001/mark-disbursed \
  -H "Authorization: Bearer KAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disbursedAmount": "500000"}'

# Should return 403 Forbidden with violation logged
```

## Security Best Practices

1. **Rotate Override Tokens**: Regularly rotate admin override tokens
2. **Limit Token Distribution**: Only share tokens with trusted administrators
3. **Monitor Logs**: Regularly review Admin Activity Log for violations
4. **Enable Email Alerts**: Keep `ENABLE_ADMIN_ALERTS=true` in production
5. **Audit Override Usage**: Review all override usage to ensure legitimate need

## Troubleshooting

### Override Token Not Working

- Verify token is in `ADMIN_OVERRIDE_TOKENS` environment variable
- Check token is passed in `X-Admin-Override-Token` header (case-sensitive)
- Ensure user is identified as admin (role or email)

### Email Alerts Not Sending

- Verify `ENABLE_ADMIN_ALERTS=true`
- Check `ADMIN_ALERT_EMAILS` is set
- Verify email webhook is configured in n8n (`/webhook/email`)
- Check server logs for email sending errors

### Middleware Not Triggering

- Verify middleware is added to routes (see `credit.routes.ts`)
- Check request path matches endpoint patterns
- Ensure `authenticate` middleware runs before `enforceRolePermissions`

## Integration

The middleware is automatically applied to all credit team routes:

```typescript
// backend/src/routes/credit.routes.ts
router.use(authenticate);
router.use(requireCredit);
router.use(enforceRolePermissions); // Role enforcement with admin override
```

## Related Files

- `backend/src/middleware/roleEnforcement.middleware.ts` - Main middleware
- `backend/src/routes/credit.routes.ts` - Routes with enforcement
- `backend/src/services/airtable/n8nClient.ts` - Admin Activity Log posting

