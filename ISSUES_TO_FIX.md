# Issues to Fix - Prioritized List

**Generated:** 2025-01-27  
**Status:** Ready for Fixing

---

## ✅ COMPLETED

### 1. TypeScript Compilation Errors ✅ FIXED
- **Status:** All 25+ errors resolved
- **Files Fixed:**
  - `backend/src/controllers/users.controller.ts` - Removed invalid 'admin' role checks
  - `backend/src/controllers/credit.controller.ts` - Fixed undefined `loanAmount` variable
  - `backend/src/controllers/ledger.controller.ts` - Fixed missing parameter in `getKAMManagedClients`
  - `backend/src/controllers/loan.controller.ts` - Fixed variable redeclaration and type mismatches
  - `backend/src/controllers/nbfc.controller.ts` - Removed invalid 'admin' role checks
  - `backend/src/controllers/reports.controller.ts` - Removed invalid 'admin' role checks
  - `backend/src/controllers/ai.controller.ts` - Fixed ParsedRecord type mismatches
  - `backend/src/jobs/dailySummary.job.ts` - Fixed cron namespace and TaskOptions

---

## 🔴 PRIORITY 1: CRITICAL (Blocks Core Functionality)

### 2. Form Configuration Loading Issue
**Status:** ⚠️ Needs Testing & Fixing  
**Impact:** Clients may not see configured form fields when creating applications

**Files:**
- `backend/src/controllers/client.controller.ts` (line 131)
- `backend/src/services/formConfig/formConfig.service.ts` (line 96)
- `src/pages/NewApplication.tsx` (line 84)

**Action Required:**
1. Test form config API endpoint: `GET /client/form-config`
2. Verify Client Form Mapping table has entries for test client
3. Verify form categories and fields are properly linked
4. Test frontend renders fields correctly
5. Fix if data not loading or fields not displaying

---

### 3. Mandatory Field Validation (Blocking)
**Status:** ⚠️ Needs Implementation  
**Impact:** Users can submit applications without required fields (only warnings shown)

**Current Behavior:**
- Soft validation only (warnings, not blocking)
- Submission allowed even with missing required fields

**Required Fix:**
- Implement blocking validation before submission
- Return 400 error with missing fields list
- Prevent submission if required fields missing

**Files:**
- `backend/src/controllers/loan.controller.ts` (line 164-198)
- `backend/src/services/validation/mandatoryFieldValidation.service.ts`

**Action Required:**
1. Review current validation logic
2. Implement strict validation on submit (not draft save)
3. Return proper error response with missing fields
4. Update frontend to handle validation errors

---

### 4. Document Upload Storage in Airtable
**Status:** ⚠️ Needs Testing & Verification  
**Impact:** OneDrive links may not be stored correctly in Airtable

**Current Implementation:**
- Documents stored in format: `fieldId:url|fileName,fieldId:url|fileName`
- Stored in `Documents` field of Loan Applications table

**Files:**
- `backend/src/services/onedrive/onedriveUpload.service.ts`
- `backend/src/routes/documents.routes.ts`
- `backend/src/controllers/loan.controller.ts` (line 204-226)

**Action Required:**
1. Test OneDrive upload functionality
2. Verify links stored in correct format
3. Verify links persist in Airtable Documents field
4. Test document retrieval and display
5. Fix if links not storing or retrieving correctly

---

## 🟡 PRIORITY 2: HIGH (Affects User Experience)

### 5. Notification Delivery System
**Status:** ⚠️ Needs Testing & Fixing  
**Impact:** Notifications may not be delivered on status changes/queries

**Files:**
- `backend/src/services/notifications/notification.service.ts`
- `backend/src/controllers/loan.controller.ts`
- `backend/src/controllers/queries.controller.ts`

**Action Required:**
1. Test notification creation on status change
2. Test notification creation on query raise
3. Verify notification display in frontend
4. Test email notifications (if configured)
5. Fix if notifications not being created or delivered

---

### 6. Commission Auto-Calculation on Disbursement
**Status:** ⚠️ Needs Testing & Verification  
**Impact:** Commission may not be automatically calculated when loan is disbursed

**Current Implementation:**
- Commission service exists: `commissionService.calculateCommission()`
- Called in `credit.controller.ts` markDisbursed (line 578)

**Files:**
- `backend/src/services/commission/commission.service.ts`
- `backend/src/controllers/credit.controller.ts` (line 577-584)

**Action Required:**
1. Test commission calculation on disbursement
2. Verify ledger entry created automatically
3. Verify running balance updated correctly
4. Fix if commission not calculated or ledger entry not created

---

### 7. AI Summary Generation
**Status:** ⚠️ Needs Testing & Fixing  
**Impact:** AI summary generation may not work

**Files:**
- `backend/src/controllers/ai.controller.ts`
- `backend/src/services/ai/aiSummary.service.ts`

**Action Required:**
1. Test OpenAI/n8n integration
2. Test summary generation endpoint: `POST /loan-applications/:id/generate-summary`
3. Verify summary stored in Airtable
4. Test summary refresh functionality
5. Fix if generation fails or summary not stored

---

### 8. Daily Summary Reports Generation & Email
**Status:** ⚠️ Needs Testing & Fixing  
**Impact:** Daily summary reports may not generate or email correctly

**Files:**
- `backend/src/controllers/reports.controller.ts`
- `backend/src/services/reports/dailySummary.service.ts`
- `backend/src/jobs/dailySummary.job.ts`

**Action Required:**
1. Test report generation: `POST /reports/daily/generate`
2. Verify aggregation logic correct
3. Test email integration
4. Test cron job scheduling
5. Fix if reports not generating or emails not sending

---

## 🟢 PRIORITY 3: MEDIUM (Enhancements)

### 9. Error Messages Improvement
**Status:** ⚠️ Needs Enhancement  
**Impact:** Error messages may not be user-friendly

**Action Required:**
1. Review all error messages
2. Make error messages more descriptive
3. Add troubleshooting tips where appropriate

---

### 10. Retry Logic for Failed Requests
**Status:** ⚠️ Needs Implementation  
**Impact:** Failed webhook requests may not retry automatically

**Action Required:**
1. Add automatic retry with exponential backoff
2. Implement retry logic for critical operations
3. Add retry configuration

---

### 11. Webhook Timeout Optimization
**Status:** ⚠️ Needs Optimization  
**Impact:** Some webhook requests may timeout

**Action Required:**
1. Review timeout settings
2. Optimize webhook calls
3. Add timeout handling

---

### 12. Audit Logging Enhancement
**Status:** ⚠️ Needs Enhancement  
**Impact:** Audit logs may not capture all necessary information

**Action Required:**
1. Review audit log coverage
2. Add missing audit log entries
3. Enhance log detail level

---

## 📋 TESTING CHECKLIST

### Authentication & Core Infrastructure
- [ ] Login for all roles (Client, KAM, Credit, NBFC)
- [ ] JWT token storage and refresh
- [ ] Protected route access
- [ ] Logout functionality
- [ ] CORS configuration
- [ ] API health endpoints

### Client Role
- [ ] Dashboard loading
- [ ] Create new loan application
- [ ] Save draft application
- [ ] Submit application with validation
- [ ] View own applications list
- [ ] View commission ledger
- [ ] Create payout request
- [ ] Respond to queries
- [ ] Upload documents
- [ ] Withdraw application

### KAM Role
- [ ] Dashboard with assigned clients
- [ ] View client list
- [ ] Configure form templates for clients
- [ ] Review submitted applications
- [ ] Raise queries to clients
- [ ] Forward applications to credit
- [ ] View client commission ledgers
- [ ] View form mappings

### Credit Role
- [ ] Dashboard with pending reviews
- [ ] Review forwarded applications
- [ ] Raise queries to KAM
- [ ] Assign applications to NBFC
- [ ] Mark applications approved/rejected
- [ ] Mark disbursed
- [ ] Close files
- [ ] Approve/reject payout requests
- [ ] View all commission ledgers
- [ ] Generate daily summary reports

### NBFC Role
- [ ] Dashboard with assigned applications
- [ ] View assigned applications
- [ ] Record NBFC decision
- [ ] View application details

### Cross-Module Integration
- [ ] End-to-end loan application workflow
- [ ] Commission calculation on disbursement
- [ ] Query/response threading
- [ ] Notification delivery
- [ ] Audit log creation
- [ ] Status transition validation

---

## 📊 SUMMARY

**Total Issues:** 12  
**Completed:** 1 ✅  
**Priority 1 (Critical):** 3 ⚠️  
**Priority 2 (High):** 4 ⚠️  
**Priority 3 (Medium):** 4 ⚠️

**Next Steps:**
1. Test and fix Priority 1 issues (form config, validation, document upload)
2. Test and fix Priority 2 issues (notifications, commission, AI, reports)
3. Enhance Priority 3 items (error messages, retry logic, timeouts, audit logs)
4. Complete all testing checklists
5. Create final verification report

---

**Last Updated:** 2025-01-27





