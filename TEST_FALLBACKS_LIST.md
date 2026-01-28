# Test Fallbacks in the System

This document lists all test data fallbacks, mock data, and test user patterns found in the codebase.

## 🔴 Critical Production Fallbacks (Should be Removed/Disabled)

### 1. **Auth Controller - Validate Endpoint Test Data Detection**
**Location:** `backend/src/controllers/auth.controller.ts` (lines 763-835)

**Test Data Patterns Detected:**
- `profileData.id === 'test-user-123'`
- `profileData.email === 'test@example.com'`
- `profileData.username === 'test'`
- `profileData.name === 'Test User' && profileData.role === 'client'`

**Status:** ✅ **FIXED** - Now rejects test data instead of using it

**Previous Behavior:** When webhook returned test data, it would try to fetch real user from Airtable, but if not found, would continue with test data.

**Current Behavior:** Rejects test data completely and only allows users from User Accounts table with Active status.

---

### 2. **Auth Middleware - Test Token Authentication**
**Location:** `backend/src/middleware/auth.middleware.ts` (lines 70-119)

**Test Token Format:** `test-token-{role}@{timestamp}`

**Test Users Mapped:**
```typescript
{
  'client': { email: 'Sagar@gmail.com', role: 'client', clientId: 'TEST-CLIENT-001', name: 'Sagar' },
  'kam': { email: 'Sagar@gmail.com', role: 'kam', kamId: 'TEST-KAM-001', name: 'Sagar' },
  'credit_team': { email: 'Sagar@gmail.com', role: 'credit_team', name: 'Sagar' },
  'nbfc': { email: 'Sagar@gmail.com', role: 'nbfc', nbfcId: 'TEST-NBFC-001', name: 'Sagar' },
}
```

**Status:** ⚠️ **ACTIVE** - Only works with tokens starting with `test-token-`

**Recommendation:** 
- Keep for E2E testing, but ensure it's only enabled in test environments
- Add environment check: `if (process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1')`

---

### 3. **Auth Service - E2E Mock User Accounts**
**Location:** `backend/src/services/auth/auth.service.ts` (lines 102-112, 537-543)

**Environment Variable:** `E2E_USE_MOCK_USER_ACCOUNTS=1`

**Mock Users:**
```typescript
[
  { id: 'recE2EClient01', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: 'CLIENT', 'Account Status': 'ACTIVE' },
  { id: 'recE2EKAM01', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: 'KAM', 'Account Status': 'ACTIVE' },
  { id: 'recE2ECredit01', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: 'CREDIT', 'Account Status': 'ACTIVE' },
  { id: 'recE2ENBFC01', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: 'NBFC', 'Account Status': 'ACTIVE' },
]
```

**Placeholder IDs Set:**
- CLIENT: `E2E-CLIENT-01`
- KAM: `E2E-KAM-01`
- NBFC: `E2E-NBFC-01`
- CREDIT: `E2E-CREDIT-01`

**Status:** ⚠️ **ACTIVE** - Only when `E2E_USE_MOCK_USER_ACCOUNTS=1` is set

**Recommendation:** 
- Ensure this environment variable is NEVER set in production
- Add explicit check: `if (process.env.NODE_ENV !== 'production' && process.env.E2E_USE_MOCK_USER_ACCOUNTS === '1')`

---

## 🟡 Test User Patterns (For Cleanup)

### 4. **Test Email Patterns**
**Location:** `backend/scripts/delete-test-users.ts` (lines 15-31)

**Patterns Detected:**
- `/sagar@gmail\.com/i`
- `/rahul@gmail\.com/i`
- `/.*@test\.com/i`
- `/test.*@.*/i`
- `/.*@example\.com/i` (e.g., `test@example.com`)
- `/test@.*/i` (e.g., `test@anything`)

**Exact Matches:**
- `sagar@gmail.com`
- `rahul@gmail.com`
- `test@gmail.com`
- `test@example.com`
- `client@test.com`
- `kam@test.com`
- `credit@test.com`
- `nbfc@test.com`

**Status:** ✅ **ACTIVE** - Used by cleanup script to identify test users

**Recommendation:** Run cleanup script periodically to mark test users as inactive.

---

## 🟢 E2E Test Helpers (Development Only)

### 5. **E2E Test User Credentials**
**Location:** `e2e/helpers/auth.ts` (lines 17-38)

**Test Users:**
```typescript
{
  client: { email: 'Sagar@gmail.com', password: 'pass@123', role: 'client' },
  kam: { email: 'Sagar@gmail.com', password: 'pass@123', role: 'kam' },
  credit: { email: 'Sagar@gmail.com', password: 'pass@123', role: 'credit_team' },
  nbfc: { email: 'Sagar@gmail.com', password: 'pass@123', role: 'nbfc' },
}
```

**Environment Variable Overrides:**
- `E2E_CLIENT_USERNAME` / `E2E_CLIENT_PASSWORD`
- `E2E_KAM_USERNAME` / `E2E_KAM_PASSWORD`
- `E2E_CREDIT_USERNAME` / `E2E_CREDIT_PASSWORD`
- `E2E_NBFC_USERNAME` / `E2E_NBFC_PASSWORD`

**Status:** ✅ **SAFE** - Only used in E2E tests, not in production code

---

### 6. **Mock N8n Client for Unit Tests**
**Location:** `backend/src/__tests__/helpers/mockN8nClient.ts`

**Purpose:** Provides mock data for unit tests without making real n8n webhook calls

**Mock Data Includes:**
- User Accounts
- KAM Users
- Credit Team Users
- Clients
- Loan Applications
- Form Fields
- Commission Ledger entries
- File Audit Logs

**Status:** ✅ **SAFE** - Only used in test files (`__tests__` directory)

---

## 📋 Summary of Recommendations

### Immediate Actions:
1. ✅ **DONE:** Fixed validate endpoint to reject test data
2. ⚠️ **TODO:** Add environment check to auth middleware test token authentication
3. ⚠️ **TODO:** Add environment check to E2E mock user accounts
4. ✅ **DONE:** Updated test user cleanup script to catch `test@example.com`

### Environment Variable Checks Needed:
- `E2E_USE_MOCK_USER_ACCOUNTS` - Should only work in test/development
- `NODE_ENV` - Should be checked before enabling test fallbacks

### Production Safety:
- All test fallbacks should check `NODE_ENV !== 'production'`
- Test tokens should only work in test environments
- Mock data should never be used in production

---

## 🔍 How to Verify No Test Fallbacks Are Active in Production

1. **Check Environment Variables:**
   ```bash
   # Should NOT be set in production
   echo $E2E_USE_MOCK_USER_ACCOUNTS  # Should be empty
   echo $NODE_ENV  # Should be 'production'
   ```

2. **Check for Test Tokens:**
   - Test tokens start with `test-token-`
   - These should only work in test environments

3. **Check for Test Email Patterns:**
   - Run `delete-test-users.ts` script to identify and disable test users
   - Verify no users with test email patterns exist with Active status

4. **Check Logs:**
   - Look for: "Using E2E mock user accounts"
   - Look for: "Test token authenticated"
   - These should never appear in production logs

---

## 📝 Files Modified to Fix Test Fallbacks

1. `backend/src/controllers/auth.controller.ts` - Reject test data in validate endpoint
2. `backend/src/services/auth/auth.service.ts` - Already has E2E check (but should add NODE_ENV check)
3. `backend/src/middleware/auth.middleware.ts` - Test token auth (should add NODE_ENV check)
4. `backend/scripts/delete-test-users.ts` - Updated to catch `test@example.com`

---

## 🚨 Critical: Production Deployment Checklist

Before deploying to production, verify:

- [ ] `E2E_USE_MOCK_USER_ACCOUNTS` is NOT set
- [ ] `NODE_ENV=production` is set
- [ ] No test users with Active status exist
- [ ] Test token authentication is disabled (or only works in test mode)
- [ ] All test data patterns are rejected in validate endpoint ✅
- [ ] Frontend localStorage/sessionStorage is cleared on logout ✅
