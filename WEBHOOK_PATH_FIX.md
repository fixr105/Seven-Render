# Webhook Path Fix for Loan Applications

**Date:** 2025-01-27  
**Issue:** Mismatch between POST and GET webhook paths for loan applications  
**Status:** ✅ Fixed

---

## Problem

The n8n workflow JSON (`SEVEN-DASHBOARD-2.json`) defines:
- **POST webhook:** `/loanapplications` (plural) - for create/update operations
- **GET webhook:** `/loanapplication` (singular) - for search/list operations

However, the backend code was using:
- **POST webhook:** `/webhook/applications` (incorrect path)
- **GET webhook:** `/webhook/loanapplication` (correct)

This mismatch would cause POST operations to fail or hit the wrong webhook endpoint.

---

## Solution

### 1. Updated POST Webhook URL

**File:** `backend/src/config/airtable.ts`

**Before:**
```typescript
postApplicationsUrl: process.env.N8N_POST_APPLICATIONS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/applications',
```

**After:**
```typescript
postApplicationsUrl: process.env.N8N_POST_APPLICATIONS_URL || 'https://fixrrahul.app.n8n.cloud/webhook/loanapplications',
```

**Change:** Updated from `/webhook/applications` to `/webhook/loanapplications` (plural) to match n8n JSON Webhook11 node.

### 2. Verified GET Webhook URL

**File:** `backend/src/config/webhookConfig.ts`

**Current (Correct):**
```typescript
'Loan Application': {
  url: 'https://fixrrahul.app.n8n.cloud/webhook/loanapplication',
  tableName: 'Loan Application',
},
```

**Status:** ✅ Already correct - uses `/webhook/loanapplication` (singular)

### 3. Updated Documentation

**Files Updated:**
- `backend/src/services/airtable/n8nClient.ts` - Updated `postLoanApplication()` method documentation
- `backend/src/controllers/loan.controller.ts` - Updated webhook mapping comments
- `WEBHOOK_MAPPING_TABLE.md` - Updated all references to reflect correct paths

---

## Webhook Path Summary

### POST Operations (Create/Update)
- **Path:** `/webhook/loanapplications` (plural)
- **Method:** `n8nClient.postLoanApplication()`
- **Config:** `n8nConfig.postApplicationsUrl`
- **Used by:**
  - `LoanController.createApplication()`
  - `LoanController.updateApplicationForm()`
  - `LoanController.submitApplication()`
  - `KAMController.editApplication()`
  - `KAMController.forwardToCredit()`
  - `CreditController.markInNegotiation()`
  - `CreditController.assignNBFCs()`
  - `CreditController.captureNBFCDecision()`
  - `CreditController.markDisbursed()`
  - `NBFController.recordDecision()`
  - And other update operations

### GET Operations (List/Fetch)
- **Path:** `/webhook/loanapplication` (singular)
- **Method:** `n8nClient.fetchTable('Loan Application')`
- **Config:** `webhookConfig.ts` → `WEBHOOK_CONFIG['Loan Application'].url`
- **Used by:**
  - `LoanController.listApplications()`
  - `LoanController.getApplication()`
  - `KAMController.listApplications()`
  - `CreditController.listApplications()`
  - `CreditController.getApplication()`
  - `NBFController.listApplications()`
  - `NBFController.getApplication()`
  - And other read operations

---

## Verification

### All Controllers Use Correct Methods

✅ **GET Operations:**
- All controllers use `n8nClient.fetchTable('Loan Application')`
- This automatically uses `/webhook/loanapplication` (singular) from `webhookConfig.ts`

✅ **POST Operations:**
- All controllers use `n8nClient.postLoanApplication()`
- This now uses `/webhook/loanapplications` (plural) from `airtable.ts`

### Files Verified

```bash
# GET operations (all use fetchTable)
grep -r "fetchTable.*Loan Application" backend/src/controllers/*.ts
# Result: All use fetchTable('Loan Application') ✅

# POST operations (all use postLoanApplication)
grep -r "postLoanApplication" backend/src/controllers/*.ts
# Result: All use postLoanApplication() ✅
```

---

## Environment Variables

If you need to override the webhook URLs via environment variables:

```bash
# POST webhook (create/update)
N8N_POST_APPLICATIONS_URL=https://fixrrahul.app.n8n.cloud/webhook/loanapplications

# GET webhook is configured in webhookConfig.ts
# No environment variable override available (uses hardcoded config)
```

---

## Testing Recommendations

1. **Test POST Operations:**
   - Create new loan application
   - Update existing application
   - Submit application
   - Update status (forward to credit, mark in negotiation, etc.)
   - Verify all POST calls hit `/webhook/loanapplications` (plural)

2. **Test GET Operations:**
   - List applications
   - Get single application
   - Filter applications
   - Verify all GET calls hit `/webhook/loanapplication` (singular)

3. **Monitor n8n Workflow:**
   - Check n8n workflow execution logs
   - Verify POST operations trigger Webhook11 node (`/loanapplications`)
   - Verify GET operations trigger search node (`/loanapplication`)

---

## Breaking Changes

**None** - This is a bug fix that aligns the code with the n8n workflow configuration.

---

## Related Files

1. `backend/src/config/airtable.ts` - POST webhook URLs
2. `backend/src/config/webhookConfig.ts` - GET webhook URLs
3. `backend/src/services/airtable/n8nClient.ts` - Webhook client implementation
4. `backend/src/controllers/loan.controller.ts` - Loan application controller
5. `backend/src/controllers/kam.controller.ts` - KAM controller
6. `backend/src/controllers/credit.controller.ts` - Credit controller
7. `backend/src/controllers/nbfc.controller.ts` - NBFC controller
8. `WEBHOOK_MAPPING_TABLE.md` - Complete webhook mapping documentation

---

**Status:** ✅ Complete  
**Breaking Changes:** None  
**Backward Compatible:** Yes (fixes existing bug)


