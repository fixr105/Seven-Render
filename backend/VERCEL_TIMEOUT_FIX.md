# Vercel Function Timeout Fix

## Problem

Vercel serverless functions have execution time limits:
- **Hobby Plan**: 10 seconds maximum
- **Pro Plan**: 60 seconds maximum (configurable)

The error `FUNCTION_INVOCATION_TIMEOUT` occurs when a function exceeds these limits.

## Root Cause

The login flow was making multiple sequential webhook calls:
1. `getUserAccounts()` - Fetch user accounts from Airtable
2. `fetchTable('Clients'/'KAM Users'/'Credit Team Users'/'NBFC Partners')` - Fetch role-specific data
3. `postUserAccount()` - Update last login timestamp

Each webhook call could take 2-5 seconds, easily exceeding the 10-second limit on Hobby plan.

## Solution Implemented

### 1. Timeout on User Accounts Fetch
- Added 8-second timeout to `getUserAccounts()` call
- Prevents hanging on slow webhook responses

### 2. Non-Blocking Role Data Fetch
- Role-specific data fetching now has 5-second timeout per table
- Overall 6-second timeout for all role data fetching
- Login continues even if role data fetch fails (graceful degradation)

### 3. Async Last Login Update
- `postUserAccount()` is now non-blocking
- Login completes immediately, last login updates in background
- Failure to update last login doesn't block login

### 4. Overall Login Timeout
- Added 8-second timeout wrapper in auth controller
- Returns clear error message if login takes too long

## Timeout Breakdown

```
getUserAccounts:     8 seconds max
Role data fetch:     6 seconds max (with 5s per table)
Last login update:   Non-blocking (async)
Overall login:       8 seconds max
```

**Total: ~8 seconds** (well under 10-second Hobby plan limit)

## Error Handling

### Timeout Errors
- Returns HTTP 504 (Gateway Timeout) status
- Clear error message: "Login request timed out. Please check your connection and try again."

### Webhook Errors
- Returns HTTP 504 for webhook timeouts
- Message: "Unable to connect to authentication service. Please try again in a moment."

## Vercel Configuration

The `vercel.json` has `maxDuration: 60` configured, but:
- **Hobby Plan**: Limited to 10 seconds regardless of config
- **Pro Plan**: Can use up to 60 seconds

### To Use 60-Second Timeout

1. Upgrade to Vercel Pro plan
2. Or ensure all operations complete within 10 seconds (already implemented)

## Testing

To test timeout handling:

1. **Slow Webhook Simulation**: Add delay in n8n workflow
2. **Network Issues**: Temporarily block webhook URLs
3. **Monitor Logs**: Check Vercel function logs for timeout errors

## Monitoring

Watch for these in Vercel logs:
- `[AuthService] Role data fetch timed out` - Non-critical, login still succeeds
- `[AuthService] Failed to update last login` - Non-critical, login still succeeds
- `Login request timed out` - Critical, login fails

## Future Optimizations

1. **Caching**: Cache user accounts and role data more aggressively
2. **Parallel Requests**: Fetch role data in parallel instead of sequential
3. **Webhook Optimization**: Optimize n8n workflows to respond faster
4. **CDN Caching**: Cache static user data at CDN level

## Related Files

- `backend/src/services/auth/auth.service.ts` - Login logic with timeouts
- `backend/src/services/airtable/n8nClient.ts` - Webhook client with timeout
- `backend/src/controllers/auth.controller.ts` - Controller with timeout wrapper
- `vercel.json` - Vercel function configuration

