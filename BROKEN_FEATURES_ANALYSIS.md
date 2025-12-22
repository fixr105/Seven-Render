# Broken & Non-Functioning Features Analysis
**Generated:** 2025-01-27  
**Based on:** PRD Requirements vs Current Implementation

---

## 🔴 CRITICAL - Broken Features

### 1. **New Application Submission (Client Role) - PARTIALLY BROKEN**

**PRD Requirement:** Clients fill dynamic loan form, save draft, upload documents, submit with mandatory field validation

**Current Issues:**
- ✅ **Draft Save:** Implemented but may not persist correctly (status set to DRAFT)
- ⚠️ **POST Webhook:** Code references `postLoanApplication` but webhook URL may not match n8n backend JSON (`loanapplications` vs `loan-applications`)
- ⚠️ **Document Upload:** OneDrive integration exists but links may not be stored correctly in Airtable
- ❌ **Mandatory Field Validation:** Soft validation only (warnings, not blocking) - PRD requires blocking validation on submit
- ⚠️ **Form Submission:** `POST /loan-applications/:id/submit` endpoint exists but may not validate required fields before submission
- ⚠️ **Form Config Loading:** Client may not see configured fields if form config API fails silently

**Files Affected:**
- `src/pages/NewApplication.tsx` (lines 209-307)
- `backend/src/controllers/loan.controller.ts` (lines 19-200)
- `backend/src/services/airtable/n8nClient.ts` (webhook URL configuration)

**Evidence:**
- Line 209-307 in NewApplication.tsx: Validation warnings but no blocking
- Line 88-92 in loan.controller.ts: Soft validation only
- PROJECT_TODO_ISSUES.md confirms this issue

---

### 2. **Master Form Builder - Dynamic Fields Not Appearing**

**PRD Requirement:** KAM configures modules, client sees configured fields when creating application

**Current Issues:**
- ⚠️ **Form Config Retrieval:** `getFormConfig()` may return empty array if client mappings not found
- ⚠️ **Field Display:** NewApplication.tsx shows "No custom form configuration found" message (line 545-569)
- ⚠️ **Module Linking:** FormConfiguration.tsx creates mappings but client may not receive them correctly
- ❌ **Category/Field Filtering:** Backend may not properly filter fields by client's enabled modules

**Files Affected:**
- `src/pages/NewApplication.tsx` (lines 81-127, 422-570)
- `src/pages/FormConfiguration.tsx` (lines 254-300)
- `backend/src/controllers/client.controller.ts` (getFormConfig method)
- `backend/src/controllers/kam.controller.ts` (createFormMapping method)

**Evidence:**
- Line 114 in NewApplication.tsx: Warning logged if no form config
- Line 545-569: Fallback UI shown when no config found
- PROJECT_TODO_ISSUES.md line 52-79 confirms this

---

### 3. **Application Listing - Data Not Loading**

**PRD Requirement:** KAMs view/filter client submissions, Credit sees forwarded files, NBFC sees assigned files

**Current Issues:**
- ❌ **n8n GET Webhook:** May return table structure instead of actual data records
- ❌ **Data Parsing:** `n8nClient.fetchTable()` may not correctly extract records from webhook response
- ⚠️ **Filtering:** Role-based filtering may not work if data structure is incorrect
- ⚠️ **Status Filtering:** Applications may not filter correctly by status

**Files Affected:**
- `backend/src/services/airtable/n8nClient.ts` (fetchTable method)
- `backend/src/controllers/loan.controller.ts` (listApplications)
- `backend/src/controllers/kam.controller.ts` (listApplications)
- `backend/src/controllers/credit.controller.ts` (listApplications)

**Evidence:**
- PROJECT_TODO_ISSUES.md line 83-100 confirms this issue
- n8n backend JSON shows GET webhooks but response format unclear

---

### 4. **Status Update Functionality - State Machine Issues**

**PRD Requirement:** Status transitions follow logical workflow with proper role permissions

**Current Issues:**
- ✅ **State Machine:** Implemented in `statusStateMachine.ts` but may not be enforced everywhere
- ⚠️ **Status History:** Status changes may not be recorded in history table
- ⚠️ **Role Permissions:** Some status transitions may not check role permissions correctly
- ⚠️ **Status Timeline:** Frontend StatusTimeline component may not display history correctly

**Files Affected:**
- `backend/src/services/statusTracking/statusStateMachine.ts`
- `backend/src/services/statusTracking/statusHistory.service.ts`
- `src/components/StatusTimeline.tsx`
- `src/pages/ApplicationDetail.tsx` (status update modals)

**Evidence:**
- Status state machine exists but may not be called in all update paths
- ApplicationDetail.tsx line 134-148: Status history fetched from audit log, not dedicated history table

---

### 5. **Query/Audit Log System - Incomplete**

**PRD Requirement:** Threaded query conversations, role-based visibility, query resolution

**Current Issues:**
- ⚠️ **Query Threading:** Queries fetched from audit log but may not be properly threaded
- ⚠️ **Response Handling:** Query responses may not update query status correctly
- ⚠️ **Role Visibility:** Query visibility filtering may not work correctly
- ⚠️ **Query Resolution:** Mark as resolved functionality may not update audit log correctly

**Files Affected:**
- `src/pages/ApplicationDetail.tsx` (lines 118-132, 150-200)
- `backend/src/controllers/kam.controller.ts` (raiseQuery)
- `backend/src/controllers/credit.controller.ts` (raiseQuery)

**Evidence:**
- ApplicationDetail.tsx line 121-127: Queries filtered from audit log by action type
- No dedicated query table - using audit log as proxy

---

### 6. **Commission Ledger - Not Implemented**

**PRD Requirement:** M1 - Pay In/Out Ledger with running balance, payout requests, query on entries

**Current Issues:**
- ❌ **Ledger Display:** Ledger.tsx shows placeholder only (line 44-46)
- ❌ **Running Balance:** Not calculated or displayed
- ❌ **Payout Requests:** No UI for clients to request payouts
- ❌ **Query on Entries:** No functionality to raise queries on ledger entries
- ❌ **Credit Team Approval:** No UI for credit team to approve/reject payout requests

**Files Affected:**
- `src/pages/Ledger.tsx` (completely empty implementation)
- `src/hooks/useLedger.ts` (may not fetch ledger data)
- `backend/src/controllers/credit.controller.ts` (payout management missing)

**Evidence:**
- Ledger.tsx line 44-46: Only shows balance, no transaction list
- No ledger entry listing, no payout request UI

---

### 7. **Document Management - OneDrive Integration Issues**

**PRD Requirement:** Document upload, preview, download, linked to loan files

**Current Issues:**
- ⚠️ **Upload:** OneDrive upload exists but links may not be stored correctly
- ❌ **Document Preview:** No preview functionality in ApplicationDetail
- ❌ **Document Download:** No download functionality
- ⚠️ **Document Links:** Links stored in `Document Uploads` field but may not be parsed correctly for display

**Files Affected:**
- `src/pages/NewApplication.tsx` (lines 150-196)
- `src/pages/ApplicationDetail.tsx` (no document display section)
- `backend/src/services/onedrive/onedriveUpload.service.ts`

**Evidence:**
- NewApplication.tsx uploads to OneDrive but ApplicationDetail doesn't show documents
- No document preview/download UI

---

### 8. **Daily Summary Reports (M6) - Not Implemented**

**PRD Requirement:** AI-generated daily summary reports emailed to management

**Current Issues:**
- ❌ **Report Generation:** No automated report generation
- ❌ **Email Delivery:** No email sending functionality
- ❌ **KAM Activity Summary:** Not implemented
- ❌ **Credit Team Summary:** Not implemented
- ⚠️ **Backend Endpoint:** `reports.controller.ts` may exist but not functional

**Files Affected:**
- `backend/src/controllers/reports.controller.ts` (if exists)
- No frontend UI for reports

**Evidence:**
- PRD requires daily automated reports - no evidence of implementation

---

### 9. **File Summary Insights (M7) - Not Implemented**

**PRD Requirement:** AI-generated file summary with applicant profile, loan details, strengths/risks

**Current Issues:**
- ❌ **AI Summary Generation:** No AI summary generation
- ❌ **Summary Display:** No summary shown in ApplicationDetail
- ⚠️ **Backend Endpoint:** `ai.controller.ts` may exist but not functional

**Files Affected:**
- `backend/src/controllers/ai.controller.ts` (if exists)
- `src/pages/ApplicationDetail.tsx` (no summary section)

**Evidence:**
- ApplicationDetail.tsx doesn't show AI summary section
- PRD requires AI-generated insights - not visible in UI

---

### 10. **NBFC Partner Portal - Limited Functionality**

**PRD Requirement:** NBFC users view assigned applications, record decisions (Approve/Reject/Needs Clarification)

**Current Issues:**
- ⚠️ **Application Listing:** May not filter correctly to show only assigned applications
- ⚠️ **Decision Recording:** Decision recording may not update status correctly
- ⚠️ **Document Access:** NBFC may not be able to download documents
- ❌ **Decision Reasons:** Rejection reason may not be required/validated

**Files Affected:**
- `backend/src/controllers/nbfc.controller.ts`
- `src/pages/Applications.tsx` (NBFC view)
- `src/pages/ApplicationDetail.tsx` (NBFC decision modal)

**Evidence:**
- nbfc.controller.ts exists but decision flow may be incomplete

---

## ⚠️ PARTIALLY WORKING - Needs Fixes

### 11. **Client Onboarding (KAM Role)**

**PRD Requirement:** KAM creates client accounts, assigns modules, configures forms

**Current Issues:**
- ✅ **Client Creation:** Implemented in Clients.tsx
- ⚠️ **Module Assignment:** Module enabling may not work correctly
- ⚠️ **User Account Creation:** May not create user accounts automatically
- ⚠️ **Form Configuration Link:** Form config may not link to client correctly

**Files Affected:**
- `src/pages/Clients.tsx`
- `backend/src/controllers/kam.controller.ts` (onboardClient)

---

### 12. **KAM File Review & Editing**

**PRD Requirement:** KAM reviews files, edits form data, raises queries, forwards to credit

**Current Issues:**
- ✅ **Forward to Credit:** Implemented with state machine validation
- ⚠️ **Edit Application:** `editApplication` endpoint exists but may not log changes properly
- ⚠️ **Query Raising:** Works but query visibility may be incorrect
- ⚠️ **File Locking:** Files may not be locked after forwarding to credit

**Files Affected:**
- `backend/src/controllers/kam.controller.ts` (editApplication, raiseQuery, forwardToCredit)

---

### 13. **Credit Team Workflow**

**PRD Requirement:** Review files, raise queries, mark in negotiation, assign to NBFC, capture decisions, mark disbursed

**Current Issues:**
- ✅ **Status Updates:** Implemented with state machine
- ⚠️ **NBFC Assignment:** May not send email notifications with OneDrive links
- ⚠️ **Decision Capture:** Manual decision entry may not validate required fields
- ⚠️ **Disbursement Entry:** May not create ledger entry automatically

**Files Affected:**
- `backend/src/controllers/credit.controller.ts` (all methods)

---

## 🟡 UNNECESSARY CODE - Can Be Removed

### 1. **Deprecated Hooks**
- `src/hooks/useQueries.ts` - Deleted but may be referenced
- `src/hooks/useUnifiedApplications.ts` - Deleted but may be referenced

### 2. **Old Context Files**
- `src/contexts/AuthContext.tsx` - Deleted, replaced by UnifiedAuthProvider

### 3. **Legacy Storage/Sync**
- `src/lib/storage.ts` - Deleted
- `src/lib/supabase.ts` - Deleted
- `src/lib/syncCreditTeamUser.ts` - Deleted
- `src/lib/webhookSync.ts` - Deleted

### 4. **Test/Debug Files**
- `check-inconsistencies.js` - Debug script, not needed in production
- `macha-test.js` - Test file
- `test-*.js` files - Multiple test files in root
- `test-*.json` files - Test data files

### 5. **Old Documentation**
- Multiple `*_FIX.md` files already deleted
- `QUICK_*.md` files already deleted
- `SETUP_*.md` files already deleted

### 6. **Unused Scripts**
- `scripts/check-setup.sql` - Deleted
- `scripts/create-*.sql` - Deleted
- `scripts/setup-*.js` - Deleted
- `scripts/webhook-post.js` - Deleted

### 7. **Migration Files**
- `supabase/migrations/20251127125915_align_schema_with_json_specification.sql` - Deleted

---

## 📋 SUMMARY BY PRIORITY

### **P0 - Critical (Blocks Core Functionality)**
1. Application listing data not loading
2. Commission Ledger completely missing
3. Mandatory field validation not blocking
4. Form configuration not appearing for clients

### **P1 - High (Major Features Broken)**
5. Document preview/download missing
6. Daily Summary Reports not implemented
7. AI File Summary not implemented
8. Query threading/resolution incomplete

### **P2 - Medium (Partially Working)**
9. Status history display
10. NBFC decision workflow
11. Payout request system
12. Email notifications

### **P3 - Low (Nice to Have)**
13. Document preview enhancements
14. Advanced filtering
15. Report customization

---

## 🔧 RECOMMENDATIONS

1. **Fix n8n Webhook Responses:** Ensure GET webhooks return actual data, not table structure
2. **Implement Ledger UI:** Complete M1 module with full ledger display and payout requests
3. **Add Blocking Validation:** Make mandatory field validation block submission (not just warn)
4. **Fix Form Config:** Ensure client form configuration is properly retrieved and displayed
5. **Complete Query System:** Implement proper query threading and resolution
6. **Add Document Management:** Implement document preview and download
7. **Implement Reports:** Add M6 and M7 modules (Daily Summary, AI Insights)
8. **Clean Up Code:** Remove all deleted files and unused test scripts

---

**Note:** This analysis is based on code review and PRD comparison. Actual testing may reveal additional issues.

