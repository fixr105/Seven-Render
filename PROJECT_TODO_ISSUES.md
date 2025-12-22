# Seven Dashboard - Project TODO: Issues & Missing Features

**Created:** 2025-01-27  
**Status:** Active  
**Priority:** Critical

---

## Overview

This document lists all issues and missing features identified from comparing the current implementation with the PRD requirements. Items are organized by priority and category.

---

## 🔴 CRITICAL PRIORITY - Partially Built Features (Need Fixing)

### 1. New Application Submission & Draft Saves (DSA Role)

**Issue:** POST webhook not configured, saving/submitting fails  
**PRD Requirement:** Clients must fill dynamic loan form, save draft, upload documents, submit with mandatory field validation

**TODO:**
- [ ] **Fix POST webhook configuration** for loan application creation
  - [ ] Verify `POST /loan-applications` endpoint calls correct n8n webhook
  - [ ] Ensure webhook URL is configured in `backend/src/config/webhookConfig.ts`
  - [ ] Test webhook receives data correctly
- [ ] **Implement draft save functionality**
  - [ ] Add `POST /loan-applications/:id/form` endpoint validation
  - [ ] Ensure draft status is set correctly (DRAFT)
  - [ ] Allow saving without all required fields
- [ ] **Implement document upload**
  - [ ] Wire document upload to backend endpoint
  - [ ] Store document links in `Form Data` or `Document Uploads` field
  - [ ] Add document preview functionality
- [ ] **Add mandatory field validation**
  - [ ] Validate required fields on submit (not on draft save)
  - [ ] Return clear error messages for missing fields
  - [ ] Use form configuration to determine required fields
- [ ] **Fix form submission**
  - [ ] Ensure `POST /loan-applications/:id/submit` works
  - [ ] Transition status from DRAFT → UNDER_KAM_REVIEW
  - [ ] Create audit log entry on submission

**Files to Update:**
- `backend/src/controllers/loan.controller.ts`
- `backend/src/routes/loan.routes.ts`
- `src/pages/NewApplication.tsx`
- `src/services/api.ts`

---

### 2. Master Form Configuration - Dynamic Fields Not Appearing

**Issue:** KAM configures modules but client doesn't see configured fields  
**PRD Requirement:** KAM selects fields/documents per client, client sees tailored form

**TODO:**
- [ ] **Fix form configuration retrieval**
  - [ ] Verify `GET /client/form-config` returns client-specific mappings
  - [ ] Ensure `Client Form Mapping` table is queried correctly
  - [ ] Filter form fields by client's enabled modules
- [ ] **Link KAM configuration to client form**
  - [ ] When KAM creates form mapping, ensure it's linked to client
  - [ ] When client requests form config, include their mappings
  - [ ] Apply `isRequired` flags from mappings
- [ ] **Display dynamic fields in New Application form**
  - [ ] Update `NewApplication.tsx` to use form config API
  - [ ] Render fields based on `Client Form Mapping`
  - [ ] Show "Additional Info" section with configured fields
- [ ] **Test end-to-end flow**
  - [ ] KAM configures modules for client
  - [ ] Client sees configured fields when creating application
  - [ ] Fields are saved correctly

**Files to Update:**
- `backend/src/controllers/client.controller.ts` (getFormConfig)
- `backend/src/controllers/kam.controller.ts` (form mappings)
- `src/pages/NewApplication.tsx`
- `src/hooks/useFormConfig.ts` (if exists)

---

### 3. Application Listing - No Data Returned

**Issue:** n8n webhooks return table structure, not data. Lists show no records  
**PRD Requirement:** KAMs view/filter client submissions, Credit sees forwarded files, NBFC sees assigned files

**TODO:**
- [ ] **Fix n8n GET webhook to return actual data**
  - [ ] Configure n8n workflow to return records, not table structure
  - [ ] Verify webhook response format matches expected structure
  - [ ] Test webhook returns array of records
- [ ] **Fix backend data parsing**
  - [ ] Update `n8nClient.fetchTable()` to handle actual data format
  - [ ] Ensure records are extracted correctly from response
  - [ ] Add error handling for malformed responses
- [ ] **Fix application listing endpoints**
  - [ ] Verify `GET /loan-applications` returns data
  - [ ] Verify `GET /kam/loan-applications` returns filtered data
  - [ ] Verify `GET /credit/loan-applications` returns all data
  - [ ] Verify `GET /nbfc/loan-applications` returns assigned files
- [ ] **Test data filtering by role**
  - [ ] CLIENT sees only their applications
  - [ ] KAM sees only managed clients' applications
  - [ ] CREDIT sees all applications
  - [ ] NBFC sees only assigned applications

**Files to Update:**
- `backend/src/services/airtable/n8nClient.ts` (fetchTable method)
- `backend/src/controllers/loan.controller.ts`
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/credit.controller.ts`
- `backend/src/controllers/nbfc.controller.ts`

---

### 4. Client Onboarding & Credit Team Client Management

**Issue:** Credit team "Client Management" shows "No token provided" error  
**PRD Requirement:** Credit admins manage clients and see payout requests

**TODO:**
- [ ] **Fix authentication for credit team client endpoints**
  - [ ] Verify `requireCredit` middleware is applied
  - [ ] Check token is passed correctly from frontend
  - [ ] Ensure credit team role is recognized
- [ ] **Create/verify credit team client management endpoints**
  - [ ] `GET /credit/clients` - List all clients
  - [ ] `GET /credit/clients/:id` - Get client details
  - [ ] `PATCH /credit/clients/:id` - Update client (if needed)
- [ ] **Fix frontend client management page**
  - [ ] Update `src/pages/Clients.tsx` to use backend API
  - [ ] Add authentication headers to API calls
  - [ ] Handle error responses correctly
- [ ] **Test credit team access**
  - [ ] Credit user can view client list
  - [ ] Credit user can see payout requests
  - [ ] Credit user can approve/reject payouts

**Files to Update:**
- `backend/src/controllers/credit.controller.ts` (add client endpoints)
- `backend/src/routes/credit.routes.ts`
- `src/pages/Clients.tsx`
- `src/services/api.ts`

---

### 5. Commission Ledger & Payout Requests (M1)

**Issue:** Ledger page shows "Loading..." indefinitely  
**PRD Requirement:** Pay-In/Out Ledger with entries, queries, payout requests, approval/rejection

**TODO:**
- [ ] **Fix commission ledger data retrieval**
  - [ ] Verify `GET /clients/me/ledger` returns data
  - [ ] Ensure Commission Ledger webhook returns records
  - [ ] Fix data parsing in `ledger.controller.ts`
- [ ] **Implement payout request creation**
  - [ ] Verify `POST /clients/me/payout-requests` works
  - [ ] Create ledger entry with negative amount
  - [ ] Update payout request status
- [ ] **Implement payout approval/rejection**
  - [ ] Verify `POST /credit/payout-requests/:id/approve` works
  - [ ] Verify `POST /credit/payout-requests/:id/reject` works
  - [ ] Update ledger entries correctly
  - [ ] Send notifications
- [ ] **Fix frontend ledger display**
  - [ ] Update ledger page to use backend API
  - [ ] Display running balance correctly
  - [ ] Show payout request buttons/forms
- [ ] **Test complete payout flow**
  - [ ] Client creates payout request
  - [ ] Credit team sees request
  - [ ] Credit team approves/rejects
  - [ ] Ledger updates correctly

**Files to Update:**
- `backend/src/controllers/ledger.controller.ts`
- `backend/src/controllers/credit.controller.ts` (payout approval)
- `src/pages/dashboards/ClientDashboard.tsx` (ledger section)
- `src/services/api.ts`

---

### 6. Query Dialog & Audit Log (M4)

**Issue:** Query modal opens but no confirmation, messages not stored  
**PRD Requirement:** Threaded audit log with queries, attachments, resolution, notifications

**TODO:**
- [ ] **Wire query modal to backend**
  - [ ] Connect query form to `POST /loan-applications/:id/queries`
  - [ ] Connect reply form to `POST /queries/:parentId/replies`
  - [ ] Store queries in File Auditing Log
- [ ] **Implement query storage**
  - [ ] Ensure queries are saved with correct format
  - [ ] Link queries to parent (threading)
  - [ ] Store attachments/document links
- [ ] **Add query resolution**
  - [ ] Implement `POST /queries/:id/resolve`
  - [ ] Implement `POST /queries/:id/reopen`
  - [ ] Update query status in audit log
- [ ] **Add notifications**
  - [ ] Send notification when query is raised
  - [ ] Send notification when query is replied
  - [ ] Send notification when query is resolved
- [ ] **Display query history**
  - [ ] Show queries in application detail page
  - [ ] Display threaded conversation
  - [ ] Show query status (open/resolved)

**Files to Update:**
- `backend/src/controllers/queries.controller.ts`
- `backend/src/controllers/kam.controller.ts` (raiseQuery)
- `backend/src/controllers/credit.controller.ts` (raiseQuery)
- `src/pages/ApplicationDetail.tsx` (query modal)
- `src/services/api.ts`

---

### 7. Action Centre - Role-Based Visibility

**Issue:** Wrong actions shown, missing actions, actions appear for wrong roles  
**PRD Requirement:** Dynamic Action Centre with context-aware tasks per role

**TODO:**
- [ ] **Fix role-based action visibility**
  - [ ] Hide "New Application" for KAM/Credit/NBFC
  - [ ] Show "New Application" only for CLIENT
  - [ ] Show "Onboard Client" only for KAM
  - [ ] Show "Configure Forms" only for KAM
- [ ] **Add missing actions**
  - [ ] "View Ledger" for CLIENT
  - [ ] "Request Payout" for CLIENT
  - [ ] "Approve Payout" for CREDIT
  - [ ] "Generate Report" for CREDIT
  - [ ] "View Assigned Files" for NBFC
- [ ] **Implement action logic**
  - [ ] Actions navigate to correct pages
  - [ ] Actions trigger correct API calls
  - [ ] Actions show correct modals/forms
- [ ] **Update all dashboards**
  - [ ] Client Dashboard action centre
  - [ ] KAM Dashboard action centre
  - [ ] Credit Dashboard action centre
  - [ ] NBFC Dashboard action centre

**Files to Update:**
- `src/pages/dashboards/ClientDashboard.tsx`
- `src/pages/dashboards/KAMDashboard.tsx`
- `src/pages/dashboards/CreditDashboard.tsx`
- `src/pages/dashboards/NBFCDashboard.tsx`
- `src/components/layout/Sidebar.tsx` (navigation)

---

### 8. Reports Page - Placeholder Only

**Issue:** "Reports Coming Soon" placeholder for all roles  
**PRD Requirement:** Daily AI-generated summary reports in Reports section

**TODO:**
- [ ] **Implement reports page UI**
  - [ ] Replace placeholder with actual reports list
  - [ ] Show daily summary reports
  - [ ] Add filters (date range, type)
- [ ] **Wire to backend endpoints**
  - [ ] `GET /reports/daily/latest` - Latest report
  - [ ] `GET /reports/daily/:date` - Specific date report
  - [ ] `POST /reports/daily/generate` - Generate report (CREDIT only)
- [ ] **Display report content**
  - [ ] Show report summary
  - [ ] Display metrics and statistics
  - [ ] Format report nicely
- [ ] **Add report generation**
  - [ ] CREDIT can generate daily reports
  - [ ] Reports are stored in Daily Summary Report table
  - [ ] Reports include KAM and credit activity summaries

**Files to Update:**
- `src/pages/Reports.tsx` (create if missing)
- `backend/src/controllers/reports.controller.ts` (verify endpoints)
- `src/services/api.ts`

---

## 🟠 HIGH PRIORITY - Missing Features (Need Building)

### 9. Full Dynamic Form Builder (M2)

**Issue:** Only module selection exists, no full form builder  
**PRD Requirement:** Master Form Builder for templates, validation, document uploads, duplicate prevention

**TODO:**
- [ ] **Create form builder UI**
  - [ ] Form template creation page
  - [ ] Field configuration interface
  - [ ] Drag-and-drop field ordering
  - [ ] Field type selection (text, number, date, file, etc.)
- [ ] **Implement form template management**
  - [ ] `POST /form-templates` - Create template
  - [ ] `GET /form-templates` - List templates
  - [ ] `GET /form-templates/:id` - Get template
  - [ ] `PATCH /form-templates/:id` - Update template
  - [ ] `DELETE /form-templates/:id` - Delete template
- [ ] **Add field validation configuration**
  - [ ] Mandatory field flag
  - [ ] Input type validation (email, phone, PAN, etc.)
  - [ ] Min/max length, min/max values
  - [ ] Custom validation rules
- [ ] **Implement duplicate application prevention**
  - [ ] Check for existing application with same PAN
  - [ ] Check for existing application with same borrower details
  - [ ] Show warning/error if duplicate found
  - [ ] Allow override with reason (if needed)
- [ ] **Link templates to loan products**
  - [ ] Assign form template to loan product
  - [ ] Client sees product-specific form
  - [ ] Form fields based on product template

**Files to Create/Update:**
- `src/pages/FormBuilder.tsx` (new)
- `backend/src/controllers/formTemplate.controller.ts` (new)
- `backend/src/routes/formTemplate.routes.ts` (new)
- `backend/src/services/validation.service.ts` (new)

---

### 10. File Status Tracking (M3)

**Issue:** No status timeline, no standardized status values, no status transitions  
**PRD Requirement:** Unified status model with transitions and historical timeline

**TODO:**
- [ ] **Implement status timeline component**
  - [ ] Visual timeline showing status history
  - [ ] Status change dates and actors
  - [ ] Status transition arrows/flow
- [ ] **Standardize status values**
  - [ ] Use `LoanStatus` enum consistently
  - [ ] Map all status values correctly
  - [ ] Ensure status transitions are valid
- [ ] **Add status transition logic**
  - [ ] Validate status transitions (e.g., DRAFT → UNDER_KAM_REVIEW)
  - [ ] Prevent invalid transitions
  - [ ] Log all status changes in audit log
- [ ] **Create status transition endpoints**
  - [ ] Verify all status change endpoints exist
  - [ ] Ensure proper role-based access
  - [ ] Add validation for transitions
- [ ] **Display status in UI**
  - [ ] Show current status on application card
  - [ ] Show status timeline in application detail
  - [ ] Color-code statuses
  - [ ] Show status change history

**Files to Update:**
- `backend/src/config/constants.ts` (LoanStatus enum)
- `backend/src/controllers/loan.controller.ts` (status transitions)
- `src/components/StatusTimeline.tsx` (new)
- `src/pages/ApplicationDetail.tsx` (add timeline)

---

### 11. Comprehensive Audit Log & Visibility Rules (M4)

**Issue:** No comprehensive audit log with role-based visibility  
**PRD Requirement:** Threaded audit log with role-based views, attachments, permanent record, notifications

**TODO:**
- [ ] **Enhance audit log storage**
  - [ ] Store all queries in File Auditing Log
  - [ ] Store all status changes
  - [ ] Store all actions (edit, approve, reject, etc.)
  - [ ] Link entries to parent (threading)
- [ ] **Implement role-based visibility**
  - [ ] CLIENT sees: their queries, KAM queries to them, status changes
  - [ ] KAM sees: client queries, their queries, credit queries, status changes
  - [ ] CREDIT sees: all queries, all status changes, all actions
  - [ ] NBFC sees: queries about their assigned files, status changes
- [ ] **Add query threading**
  - [ ] Link replies to parent query
  - [ ] Display threaded conversation
  - [ ] Show query hierarchy
- [ ] **Implement attachment handling**
  - [ ] Store document links in audit log
  - [ ] Allow attaching documents to queries
  - [ ] Display attachments in audit log
- [ ] **Add notification system**
  - [ ] Send notification on query creation
  - [ ] Send notification on query reply
  - [ ] Send notification on status change
  - [ ] Send notification on payout approval/rejection

**Files to Update:**
- `backend/src/controllers/audit.controller.ts`
- `backend/src/controllers/queries.controller.ts`
- `backend/src/services/notifications/notification.service.ts`
- `src/pages/ApplicationDetail.tsx` (audit log section)

---

### 12. Loan Workflow Actions (KAM & Credit Team)

**Issue:** No mechanism for workflow actions  
**PRD Requirement:** Edit, query, approve, forward, mark status, allocate, capture decisions, process payouts

**TODO:**
- [ ] **KAM Workflow Actions**
  - [ ] Edit application data (`POST /kam/loan-applications/:id/edit`)
  - [ ] Raise query (`POST /kam/loan-applications/:id/queries`)
  - [ ] Forward to credit (`POST /kam/loan-applications/:id/forward-to-credit`)
  - [ ] Mark as renegotiated (if needed)
- [ ] **Credit Team Workflow Actions**
  - [ ] Mark in negotiation (`POST /credit/loan-applications/:id/mark-in-negotiation`)
  - [ ] Assign to NBFC (`POST /credit/loan-applications/:id/assign-nbfcs`)
  - [ ] Capture NBFC decision (`POST /credit/loan-applications/:id/nbfc-decision`)
  - [ ] Mark disbursed (`POST /credit/loan-applications/:id/mark-disbursed`)
  - [ ] Mark rejected (`POST /credit/loan-applications/:id/reject`)
  - [ ] Close file (`POST /credit/loan-applications/:id/close`)
  - [ ] Approve payout (`POST /credit/payout-requests/:id/approve`)
  - [ ] Reject payout (`POST /credit/payout-requests/:id/reject`)
- [ ] **Verify all endpoints work**
  - [ ] Test each action endpoint
  - [ ] Ensure status transitions correctly
  - [ ] Ensure audit logs are created
  - [ ] Ensure notifications are sent
- [ ] **Add UI for workflow actions**
  - [ ] Action buttons in application detail page
  - [ ] Confirmation modals for critical actions
  - [ ] Status change forms (e.g., disbursement form)

**Files to Update:**
- `backend/src/controllers/kam.controller.ts` (verify all actions)
- `backend/src/controllers/credit.controller.ts` (verify all actions)
- `src/pages/ApplicationDetail.tsx` (add action buttons)
- `src/components/WorkflowActions.tsx` (new)

---

### 13. NBFC Portal Functions

**Issue:** NBFC users cannot open files, download documents, record decisions  
**PRD Requirement:** Simplified portal to view files, download docs, record approvals/rejections, input amounts, provide reasons

**TODO:**
- [ ] **Implement NBFC file viewing**
  - [ ] `GET /nbfc/loan-applications/:id` - View application
  - [ ] Display all application data
  - [ ] Show document links
- [ ] **Add document download**
  - [ ] Download button for each document
  - [ ] Handle OneDrive links
  - [ ] Handle other document storage
- [ ] **Implement decision recording**
  - [ ] `POST /nbfc/loan-applications/:id/decision` - Record decision
  - [ ] Decision form (Approve/Reject/Needs Clarification)
  - [ ] Approved amount input (if approved)
  - [ ] Rejection reason input (if rejected)
  - [ ] Clarification request (if needed)
- [ ] **Create NBFC dashboard**
  - [ ] Show assigned applications
  - [ ] Filter by status
  - [ ] Show pending decisions
- [ ] **Add NBFC-specific restrictions**
  - [ ] Can only view assigned files
  - [ ] Can only record decisions for assigned files
  - [ ] Cannot edit application data

**Files to Update:**
- `backend/src/controllers/nbfc.controller.ts` (verify all endpoints)
- `src/pages/dashboards/NBFCDashboard.tsx`
- `src/pages/ApplicationDetail.tsx` (NBFC view)
- `src/components/NBFCDecisionForm.tsx` (new)

---

## 🟡 MEDIUM PRIORITY - Missing Features

### 14. AI Modules (M6 & M7)

**Issue:** No AI-powered modules  
**PRD Requirement:** Daily summary reports (M6) and AI-generated file summaries (M7)

**TODO:**
- [ ] **AI File Summary (M7)**
  - [ ] `POST /loan-applications/:id/generate-summary` - Generate summary
  - [ ] `GET /loan-applications/:id/summary` - Get summary
  - [ ] Integrate AI service (OpenAI, etc.)
  - [ ] Generate applicant profile summary
  - [ ] Highlight strengths and risks
  - [ ] Compare to loan criteria
  - [ ] Display summary in application detail page
- [ ] **Daily Summary Reports (M6)**
  - [ ] Enhance `POST /reports/daily/generate` with AI
  - [ ] Summarize KAM activities
  - [ ] Summarize credit team activities
  - [ ] Generate insights and trends
  - [ ] Include AI-generated recommendations

**Files to Update:**
- `backend/src/controllers/ai.controller.ts` (implement AI integration)
- `backend/src/services/ai/ai.service.ts` (new)
- `backend/src/controllers/reports.controller.ts` (add AI summarization)

---

### 15. Historical File Archive & Search

**Issue:** No archive, no filtering  
**PRD Requirement:** Retain closed files, filter by date/client/status

**TODO:**
- [ ] **Implement file archiving**
  - [ ] Mark closed files as archived
  - [ ] Exclude from active lists
  - [ ] Include in archive search
- [ ] **Add search functionality**
  - [ ] Search by file ID
  - [ ] Search by client name
  - [ ] Search by borrower name/PAN
  - [ ] Search by date range
  - [ ] Search by status
- [ ] **Add filtering**
  - [ ] Filter by date range
  - [ ] Filter by client
  - [ ] Filter by status
  - [ ] Filter by product
  - [ ] Filter by KAM
- [ ] **Create archive view**
  - [ ] Archive page/component
  - [ ] Show archived files
  - [ ] Allow viewing archived file details

**Files to Update:**
- `backend/src/controllers/loan.controller.ts` (add search/filter)
- `src/pages/Applications.tsx` (add search/filter UI)
- `src/pages/Archive.tsx` (new)

---

### 16. Payout Management Interface

**Issue:** No interface for payout requests/approvals  
**PRD Requirement:** DSA requests payouts, credit admins approve/reject

**TODO:**
- [ ] **DSA Payout Request Interface**
  - [ ] Payout request form
  - [ ] Show current balance
  - [ ] Input amount or "Full Balance"
  - [ ] Submit request
- [ ] **Credit Payout Management Interface**
  - [ ] List all payout requests
  - [ ] Show request details
  - [ ] Approve button (with amount input)
  - [ ] Reject button (with reason input)
  - [ ] Show payout history
- [ ] **Wire to backend**
  - [ ] `POST /clients/me/payout-requests` - Create request
  - [ ] `GET /clients/me/payout-requests` - List requests
  - [ ] `POST /credit/payout-requests/:id/approve` - Approve
  - [ ] `POST /credit/payout-requests/:id/reject` - Reject

**Files to Update:**
- `src/pages/PayoutRequests.tsx` (new for CLIENT)
- `src/pages/PayoutManagement.tsx` (new for CREDIT)
- `src/services/api.ts`

---

### 17. Input Validation & Duplicate Prevention

**Issue:** No validation, no duplicate prevention  
**PRD Requirement:** Validate data types, enforce mandatory fields, prevent duplicates by PAN

**TODO:**
- [ ] **Implement input validation**
  - [ ] Email format validation
  - [ ] Phone number validation
  - [ ] PAN format validation
  - [ ] Aadhaar format validation
  - [ ] Date validation
  - [ ] Number range validation
- [ ] **Add mandatory field enforcement**
  - [ ] Check required fields on submit
  - [ ] Show error messages
  - [ ] Highlight missing fields
- [ ] **Implement duplicate detection**
  - [ ] Check for existing application with same PAN
  - [ ] Check for existing application with same borrower details
  - [ ] Show warning if duplicate found
  - [ ] Allow override with reason (optional)
- [ ] **Add validation service**
  - [ ] Create `validation.service.ts`
  - [ ] Reusable validation functions
  - [ ] Form-specific validation rules

**Files to Update:**
- `backend/src/services/validation.service.ts` (new)
- `backend/src/controllers/loan.controller.ts` (add validation)
- `src/pages/NewApplication.tsx` (add client-side validation)

---

### 18. Notifications System

**Issue:** Settings exist but no actual notifications  
**PRD Requirement:** In-app and email notifications for queries, approvals, rejections, payouts

**TODO:**
- [ ] **Implement notification storage**
  - [ ] Store notifications in Notifications table
  - [ ] Link notifications to users
  - [ ] Mark as read/unread
- [ ] **Add notification triggers**
  - [ ] Query created → notify target user
  - [ ] Query replied → notify original user
  - [ ] Status changed → notify relevant users
  - [ ] Payout approved/rejected → notify client
  - [ ] Application submitted → notify KAM
- [ ] **Create notification UI**
  - [ ] Notification bell/icon
  - [ ] Notification dropdown/list
  - [ ] Mark as read functionality
  - [ ] Notification detail view
- [ ] **Add email notifications** (optional)
  - [ ] Send email on important events
  - [ ] Email template system
  - [ ] Email service integration

**Files to Update:**
- `backend/src/services/notifications/notification.service.ts`
- `backend/src/controllers/notifications.controller.ts`
- `src/components/NotificationBell.tsx` (new)
- `src/pages/Notifications.tsx` (new)

---

## 🟢 LOW PRIORITY - Enhancements

### 19. AI-Generated File Strengths/Risks

**Issue:** No AI insights  
**PRD Requirement:** Summarize profiles, highlight strengths/risks, compare to criteria

**TODO:**
- [ ] Integrate with AI service
- [ ] Generate strengths analysis
- [ ] Generate risks analysis
- [ ] Compare to loan product criteria
- [ ] Display in application detail page

---

### 20. Settings Enhancements

**Issue:** Basic settings work, but could be enhanced  
**PRD Requirement:** Notification preferences, language/timezone, session security

**TODO:**
- [ ] Verify all settings work correctly
- [ ] Add language selection
- [ ] Add timezone selection
- [ ] Add session timeout settings
- [ ] Store settings in backend

---

## 📋 Summary

### Critical (Must Fix Immediately)
1. New Application Submission & Draft Saves
2. Master Form Configuration
3. Application Listing (No Data)
4. Client Onboarding & Credit Team Access
5. Commission Ledger & Payout Requests
6. Query Dialog & Audit Log
7. Action Centre Visibility
8. Reports Page

### High Priority (Build Next)
9. Full Dynamic Form Builder
10. File Status Tracking
11. Comprehensive Audit Log
12. Loan Workflow Actions
13. NBFC Portal Functions

### Medium Priority
14. AI Modules
15. Historical File Archive & Search
16. Payout Management Interface
17. Input Validation & Duplicate Prevention
18. Notifications System

### Low Priority
19. AI-Generated Strengths/Risks
20. Settings Enhancements

---

## 🎯 Next Steps

1. **Start with Critical items** - Fix partially-built features first
2. **Test each fix** - Verify functionality works end-to-end
3. **Move to High Priority** - Build missing core features
4. **Complete Medium Priority** - Add enhancements
5. **Polish Low Priority** - Final touches

---

**Last Updated:** 2025-01-27






