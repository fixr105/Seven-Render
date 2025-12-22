# P0 Critical Features - Automated Test Plan

**Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Purpose:** Automated test plan for P0 CRITICAL features only, organized by module and user role

---

## Test Plan Overview

**Total Test Cases:** 65  
**Modules Covered:** M1-M7 + Cross-Module  
**User Roles:** CLIENT, KAM, CREDIT, NBFC  
**Test Types:** Backend (API), Frontend (UI), End-to-End (E2E)

---

## Test Case Format

Each test case includes:
- **Test ID:** Unique identifier (e.g., `M1-BE-001`)
- **Module:** M1-M7 or CROSS
- **Requirement:** P0.x reference
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Backend (BE), Frontend (FE), End-to-End (E2E)
- **Implementation:** Exact routes/components/functions to test
- **Steps:** Test execution steps
- **Expected Result:** Success criteria

---

## M1: Pay In/Out Ledger

### M1-BE-001: CLIENT View Commission Ledger
- **Module:** M1
- **Requirement:** P0.1
- **Role:** CLIENT
- **Type:** Backend
- **Implementation:**
  - Route: `GET /api/clients/me/ledger`
  - Controller: `ledger.controller.ts` → `getClientLedger()`
  - Service: `n8nClient.ts` → `getCommissionLedger()`
  - Webhook: `GET /webhook/commisionledger`
- **Steps:**
  1. Authenticate as CLIENT user
  2. Call `GET /api/clients/me/ledger` with JWT token
  3. Verify 200 response
  4. Verify response contains `entries` array
  5. Verify response contains `currentBalance` field (sum of Payout Amount)
- **Expected Result:** 200 OK with ledger entries and calculated balance

---

### M1-FE-001: CLIENT View Commission Ledger UI
- **Module:** M1
- **Requirement:** P0.1
- **Role:** CLIENT
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/Ledger.tsx`
  - Hook: `src/hooks/useLedger.ts` → `useLedger()`
  - API: `src/services/api.ts` → `getClientLedger()`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/ledger`
  3. Verify ledger table displays entries
  4. Verify balance is displayed correctly
  5. Verify entries are sorted by date (newest first)
- **Expected Result:** Ledger page displays all entries with correct balance

---

### M1-BE-002: CREDIT View Commission Ledger with Filters
- **Module:** M1
- **Requirement:** P0.1
- **Role:** CREDIT
- **Type:** Backend
- **Implementation:**
  - Route: `GET /api/credit/ledger?clientId=X&dateFrom=Y&dateTo=Z`
  - Controller: `ledger.controller.ts` → `getCreditLedger()`
  - Service: `n8nClient.ts` → `getCommissionLedger()`
  - Webhook: `GET /webhook/commisionledger`
- **Steps:**
  1. Authenticate as CREDIT user
  2. Call `GET /api/credit/ledger` without filters
  3. Verify 200 response with all entries
  4. Call with `clientId` filter
  5. Verify filtered results
  6. Call with `dateFrom` and `dateTo` filters
  7. Verify date-filtered results
- **Expected Result:** All filter combinations return correct filtered data

---

### M1-E2E-002: Automatic Commission Entry on Disbursement
- **Module:** M1
- **Requirement:** P0.2
- **Role:** CREDIT
- **Type:** End-to-End
- **Implementation:**
  - Route: `POST /api/credit/loan-applications/:id/mark-disbursed`
  - Controller: `credit.controller.ts` → `markDisbursed()`
  - Service: `n8nClient.ts` → `postCommissionLedger()`
  - Webhook: `POST /webhook/COMISSIONLEDGER`
  - Page: `src/pages/ApplicationDetail.tsx`
- **Steps:**
  1. Login as CREDIT
  2. Navigate to application in `APPROVED` status
  3. Click "Mark Disbursed" button
  4. Enter disbursed amount
  5. Submit
  6. Verify application status changes to `DISBURSED`
  7. Navigate to Ledger page
  8. Verify new commission entry exists
  9. Verify `Payout Amount = (disbursedAmount * commissionRate) / 100`
  10. Verify entry links to correct Loan File
- **Expected Result:** Commission entry automatically created with correct calculation

---

### M1-BE-003: CLIENT Request Payout
- **Module:** M1
- **Requirement:** P0.3
- **Role:** CLIENT
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/clients/me/payout-requests`
  - Controller: `ledger.controller.ts` → `createPayoutRequest()`
  - Service: `n8nClient.ts` → `postCommissionLedger()`
  - Webhook: `POST /webhook/COMISSIONLEDGER`
- **Steps:**
  1. Authenticate as CLIENT with positive balance
  2. Call `POST /api/clients/me/payout-requests` with `{ amount: 1000 }`
  3. Verify 200 response
  4. Verify ledger entry created with `Payout Request = 'Requested'`
  5. Call with `{ full: true }`
  6. Verify entry created with full balance amount
  7. Call with amount > balance
  8. Verify 400 error
- **Expected Result:** Payout requests created correctly, validation enforced

---

### M1-E2E-003: Payout Request Workflow (CLIENT → CREDIT)
- **Module:** M1
- **Requirement:** P0.3
- **Role:** CLIENT, CREDIT
- **Type:** End-to-End
- **Implementation:**
  - CLIENT Route: `POST /api/clients/me/payout-requests`
  - CREDIT Route: `POST /api/credit/payout-requests/:id/approve`
  - Controller: `ledger.controller.ts` → `createPayoutRequest()`
  - Controller: `credit.controller.ts` → `approvePayout()`
  - Page: `src/pages/Ledger.tsx`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to Ledger, verify balance > 0
  3. Click "Request Payout"
  4. Enter amount, submit
  5. Verify payout request appears in list
  6. Logout, login as CREDIT
  7. Navigate to Ledger
  8. Verify payout request appears in pending list
  9. Click "Approve"
  10. Verify negative ledger entry created
  11. Verify original entry updated to `Payout Request = 'Paid'`
  12. Logout, login as CLIENT
  13. Verify balance decreased by payout amount
- **Expected Result:** Complete payout workflow functions correctly

---

## M2: Master Form Builder + New Application

### M2-BE-001: KAM Configure Form Templates
- **Module:** M2
- **Requirement:** P0.4
- **Role:** KAM
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/kam/clients/:id/form-mappings`
  - Controller: `kam.controller.ts` → `createFormMapping()`
  - Service: `n8nClient.ts` → `postClientFormMapping()`, `postFormCategory()`, `postFormFields()`
  - Webhooks: `POST /webhook/POSTCLIENTFORMMAPPING`, `POST /webhook/FormCategory`, `POST /webhook/FormFields`
- **Steps:**
  1. Authenticate as KAM
  2. Call `POST /api/kam/clients/:id/form-mappings` with `{ modules: ['personal_kyc', 'company_kyc'] }`
  3. Verify 200 response
  4. Query `GET /webhook/clientformmapping` with clientId
  5. Verify Client Form Mapping records created
  6. Query `GET /webhook/formcategories`
  7. Verify Form Categories created
  8. Query `GET /webhook/formfields`
  9. Verify Form Fields created
- **Expected Result:** All form mapping records created in Airtable

---

### M2-FE-001: KAM Configure Form Templates UI
- **Module:** M2
- **Requirement:** P0.4
- **Role:** KAM
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/FormConfiguration.tsx`
  - API: `src/services/api.ts` → `createFormMapping()`
- **Steps:**
  1. Login as KAM
  2. Navigate to `/form-configuration`
  3. Select client from dropdown
  4. Select modules (checkboxes)
  5. Click "Save Form Configuration"
  6. Verify success message
  7. Verify form configuration saved
- **Expected Result:** Form configuration UI works correctly

---

### M2-BE-002: CLIENT Get Form Config
- **Module:** M2
- **Requirement:** P0.5
- **Role:** CLIENT
- **Type:** Backend
- **Implementation:**
  - Route: `GET /api/client/form-config`
  - Controller: `client.controller.ts` → `getFormConfig()`
  - Service: `n8nClient.ts` → `getClientFormMapping()`, `getFormCategories()`, `getFormFields()`
  - Webhooks: `GET /webhook/clientformmapping`, `GET /webhook/formcategories`, `GET /webhook/formfields`, `GET /webhook/client`
- **Steps:**
  1. Authenticate as CLIENT
  2. Call `GET /api/client/form-config`
  3. Verify 200 response
  4. Verify response contains `categories` array
  5. Verify response contains `fields` array
  6. Verify categories filtered by client's Enabled Modules
  7. Verify fields filtered by Client Form Mapping
  8. Verify display order is correct
- **Expected Result:** Form config returned with correct filtering and ordering

---

### M2-FE-002: CLIENT Dynamic Form Loading
- **Module:** M2
- **Requirement:** P0.5
- **Role:** CLIENT
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/NewApplication.tsx`
  - API: `src/services/api.ts` → `getFormConfig()`
  - Hook: `useEffect` in `NewApplication.tsx`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/new-application`
  3. Verify form fields render
  4. Verify fields match client's form configuration
  5. Verify fields are in correct order (by Display Order)
  6. Verify categories are grouped correctly
- **Expected Result:** Form renders with correct fields and order

---

### M2-BE-003: CLIENT Create Application with Validation
- **Module:** M2
- **Requirement:** P0.6
- **Role:** CLIENT
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/loan-applications`
  - Controller: `loan.controller.ts` → `createApplication()`
  - Service: `mandatoryFieldValidation.service.ts` → `validateMandatoryFields()`
  - Webhook: `GET /webhook/formfields` (to read Is Mandatory flag)
- **Steps:**
  1. Authenticate as CLIENT
  2. Call `POST /api/loan-applications` with missing mandatory field
  3. Verify 400 response
  4. Verify error message lists missing fields
  5. Call with all mandatory fields filled
  6. Verify 201 response with application ID
  7. Verify application created in Airtable
- **Expected Result:** Mandatory field validation works correctly

---

### M2-FE-003: CLIENT Create Application UI Validation
- **Module:** M2
- **Requirement:** P0.6
- **Role:** CLIENT
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/NewApplication.tsx`
  - Component: Form validation in `NewApplication.tsx`
  - API: `src/services/api.ts` → `createApplication()`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/new-application`
  3. Fill form, leave mandatory field empty
  4. Click "Submit"
  5. Verify inline error appears for mandatory field
  6. Fill all mandatory fields
  7. Click "Submit"
  8. Verify success message
  9. Verify redirect to application detail or list
- **Expected Result:** Frontend validation prevents submission with missing fields

---

### M2-E2E-003: Document Upload and Storage
- **Module:** M2
- **Requirement:** P0.7
- **Role:** CLIENT
- **Type:** End-to-End
- **Implementation:**
  - Route: `POST /api/documents/upload`
  - Service: `onedriveUpload.service.ts` → `uploadToOneDrive()`
  - Route: `POST /api/loan-applications` (with documentUploads)
  - Controller: `loan.controller.ts` → `createApplication()`
  - Component: `src/components/ui/FileUpload.tsx`
  - Page: `src/pages/NewApplication.tsx`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/new-application`
  3. Select document field
  4. Upload file via FileUpload component
  5. Verify file appears in document list
  6. Submit application
  7. Verify application created
  8. Navigate to application detail
  9. Verify document link appears
  10. Verify Documents field in Airtable contains `fieldId:url|fileName` format
- **Expected Result:** Documents uploaded and stored correctly

---

## M3: Status Tracking + Listings

### M3-BE-001: Role-Based Application Listings
- **Module:** M3
- **Requirement:** P0.9
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Backend
- **Implementation:**
  - CLIENT: `GET /api/loan-applications` → `loan.controller.ts` → `listApplications()`
  - KAM: `GET /api/kam/loan-applications` → `kam.controller.ts` → `listApplications()`
  - CREDIT: `GET /api/credit/loan-applications` → `credit.controller.ts` → `listApplications()`
  - NBFC: `GET /api/nbfc/loan-applications` → `nbfc.controller.ts` → `listApplications()`
  - Service: `dataFilter.service.ts` → `filterApplicationsByRole()`
  - Webhook: `GET /webhook/loanapplication`
- **Steps:**
  1. Authenticate as CLIENT
  2. Call `GET /api/loan-applications`
  3. Verify only applications with `Client = req.user.clientId` are returned
  4. Authenticate as KAM
  5. Call `GET /api/kam/loan-applications`
  6. Verify only applications for managed clients are returned
  7. Authenticate as CREDIT
  8. Call `GET /api/credit/loan-applications`
  9. Verify all applications are returned
  10. Authenticate as NBFC
  11. Call `GET /api/nbfc/loan-applications`
  12. Verify only applications with `Assigned NBFC = req.user.nbfcId` are returned
- **Expected Result:** Each role sees only appropriate applications

---

### M3-FE-001: Role-Based Application Listings UI
- **Module:** M3
- **Requirement:** P0.9
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/Applications.tsx`
  - Hook: `src/hooks/useApplications.ts` → `useApplications()`
  - API: `src/services/api.ts` → `listApplications()`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/applications`
  3. Verify table shows only CLIENT's applications
  4. Logout, login as KAM
  5. Navigate to `/applications`
  6. Verify table shows only managed clients' applications
  7. Logout, login as CREDIT
  8. Navigate to `/applications`
  9. Verify table shows all applications
  10. Logout, login as NBFC
  11. Navigate to `/applications`
  12. Verify table shows only assigned applications
- **Expected Result:** UI displays correct applications per role

---

### M3-BE-002: Status State Machine Validation
- **Module:** M3
- **Requirement:** P0.8
- **Role:** CLIENT, KAM, CREDIT
- **Type:** Backend
- **Implementation:**
  - Service: `statusStateMachine.ts` → `isValidTransition()`
  - Controller: `loan.controller.ts` → status transitions
  - Route: Various status change endpoints
- **Steps:**
  1. Create application in DRAFT status
  2. Attempt invalid transition: `DRAFT → APPROVED`
  3. Verify 400 error with message about invalid transition
  4. Perform valid transition: `DRAFT → UNDER_KAM_REVIEW`
  5. Verify 200 response
  6. Verify status updated in Airtable
  7. Test all valid transitions from each status
  8. Test invalid transitions return 400
- **Expected Result:** State machine enforces valid transitions only

---

### M3-FE-002: Status State Machine UI
- **Module:** M3
- **Requirement:** P0.8
- **Role:** CLIENT, KAM, CREDIT
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/ApplicationDetail.tsx`
  - Component: `src/components/StatusTimeline.tsx`
  - API: `src/services/api.ts` → status change methods
- **Steps:**
  1. Login as CLIENT
  2. Navigate to application in DRAFT status
  3. Verify only valid action buttons are visible (e.g., "Submit")
  4. Verify invalid actions are disabled/hidden
  5. Change status via valid action
  6. Verify status timeline updates
  7. Verify only new valid actions are available
- **Expected Result:** UI only allows valid status transitions

---

### M3-BE-003: Status History Tracking
- **Module:** M3
- **Requirement:** P0.10
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - Service: `statusHistory.service.ts` → `recordStatusChange()`
  - Controller: All status change endpoints
  - Webhook: `POST /webhook/Fileauditinglog`
- **Steps:**
  1. Change application status
  2. Query `GET /webhook/fileauditinglog` with File ID
  3. Verify new entry exists with:
     - `Action/Event Type = 'Status Change'`
     - `Actor = user email`
     - `Details/Message = status transition description`
     - `File = application File ID`
  4. Verify timestamp is current
- **Expected Result:** All status changes logged to File Auditing Log

---

### M3-FE-003: Status History Display
- **Module:** M3
- **Requirement:** P0.10
- **Role:** All
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/ApplicationDetail.tsx`
  - Component: `src/components/StatusTimeline.tsx`
  - API: `src/services/api.ts` → `getFileAuditLog()`
- **Steps:**
  1. Navigate to application detail
  2. Scroll to Audit Log section
  3. Verify status changes appear in chronological order
  4. Verify each entry shows actor, timestamp, and details
  5. Verify StatusTimeline component displays status progression
- **Expected Result:** Status history displayed correctly in UI

---

## M4: Audit Log/Queries

### M4-E2E-001: Query Raise and Response (KAM → CLIENT)
- **Module:** M4
- **Requirement:** P0.11
- **Role:** KAM, CLIENT
- **Type:** End-to-End
- **Implementation:**
  - KAM Route: `POST /api/kam/loan-applications/:id/queries`
  - Controller: `kam.controller.ts` → `raiseQuery()`
  - CLIENT Route: `POST /api/loan-applications/:id/queries/:queryId/reply`
  - Controller: `client.controller.ts` → `respondToQuery()`
  - Webhook: `POST /webhook/Fileauditinglog`
  - Page: `src/pages/ApplicationDetail.tsx`
- **Steps:**
  1. Login as KAM
  2. Navigate to application in `UNDER_KAM_REVIEW` status
  3. Click "Raise Query" button
  4. Enter query message
  5. Submit
  6. Verify application status changes to `QUERY_WITH_CLIENT`
  7. Verify File Auditing Log entry created with:
     - `Action/Event Type = 'Query Raised'`
     - `Target User/Role = 'CLIENT'`
     - `Resolved = false`
  8. Logout, login as CLIENT
  9. Navigate to application
  10. Verify query appears in queries section
  11. Enter response message
  12. Submit reply
  13. Verify File Auditing Log entry created with:
     - `Action/Event Type = 'Query Resolved'`
     - `Resolved = true`
  14. Verify application status changes back to `UNDER_KAM_REVIEW`
- **Expected Result:** Complete query workflow functions correctly

---

### M4-BE-001: Comprehensive Audit Logging
- **Module:** M4
- **Requirement:** P0.12
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - All mutating endpoints
  - Service: `n8nClient.ts` → `postFileAuditLog()`, `postAdminActivityLog()`
  - Webhooks: `POST /webhook/Fileauditinglog`, `POST /webhook/POSTLOG`
- **Steps:**
  1. Perform mutating operation (e.g., create application)
  2. Query `GET /webhook/fileauditinglog` with File ID
  3. Verify entry exists in File Auditing Log
  4. Query `GET /webhook/adminactivity`
  5. Verify entry exists in Admin Activity Log
  6. Verify both entries contain:
     - Actor (user email)
     - Action type
     - Timestamp
     - Details
- **Expected Result:** All mutating operations logged to both audit tables

---

### M4-BE-002: Notification Creation
- **Module:** M4
- **Requirement:** P0.13
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - Controller: `notifications.controller.ts`
  - Service: `notification.service.ts` → `createNotification()`
  - Webhook: `POST /webhook/notification`
- **Steps:**
  1. Raise query or change status
  2. Query `GET /webhook/notifications` with target user
  3. Verify notification created with:
     - `Read = false`
     - Correct target user
     - Linked to action
  4. Verify notification appears in user's notification list
- **Expected Result:** Notifications created for relevant actions

---

### M4-FE-001: Notification Display
- **Module:** M4
- **Requirement:** P0.13
- **Role:** All
- **Type:** Frontend
- **Implementation:**
  - Component: `src/components/layout/TopBar.tsx`
  - Hook: `src/hooks/useNotifications.ts` → `useNotifications()`
  - API: `src/services/api.ts` → `getNotifications()`
- **Steps:**
  1. Trigger action that creates notification (e.g., query raised)
  2. Verify notification bell shows unread count
  3. Click notification bell
  4. Verify notification list displays
  5. Verify notification appears in list
  6. Click notification
  7. Verify notification marked as read
  8. Verify unread count decreases
- **Expected Result:** Notifications displayed and managed correctly in UI

---

## M5: Action Center

### M5-BE-001: Role-Based Dashboard Data
- **Module:** M5
- **Requirement:** P0.14
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Backend
- **Implementation:**
  - CLIENT: `GET /api/client/dashboard` → `client.controller.ts` → `getDashboard()`
  - KAM: `GET /api/kam/dashboard` → `kam.controller.ts` → `getDashboard()`
  - CREDIT: `GET /api/credit/dashboard` → `credit.controller.ts` → `getDashboard()`
  - NBFC: `GET /api/nbfc/dashboard` → `nbfc.controller.ts` → `getDashboard()`
- **Steps:**
  1. Authenticate as CLIENT
  2. Call `GET /api/client/dashboard`
  3. Verify 200 response with:
     - `activeApplications` array
     - `ledgerSummary` with balance
  4. Authenticate as KAM
  5. Call `GET /api/kam/dashboard`
  6. Verify response with:
     - Managed clients count
     - Pending reviews
  7. Authenticate as CREDIT
  8. Call `GET /api/credit/dashboard`
  9. Verify response with:
     - Pending reviews
     - Payout requests
  10. Authenticate as NBFC
  11. Call `GET /api/nbfc/dashboard`
  12. Verify response with assigned applications count
- **Expected Result:** Each role receives appropriate dashboard metrics

---

### M5-FE-001: Role-Based Dashboard UI
- **Module:** M5
- **Requirement:** P0.14
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/Dashboard.tsx`
  - Components:
    - `src/pages/dashboards/ClientDashboard.tsx`
    - `src/pages/dashboards/KAMDashboard.tsx`
    - `src/pages/dashboards/CreditDashboard.tsx`
    - `src/pages/dashboards/NBFCDashboard.tsx`
  - API: `src/services/api.ts` → `getDashboard()`
- **Steps:**
  1. Login as CLIENT
  2. Navigate to `/dashboard`
  3. Verify ClientDashboard component renders
  4. Verify metrics displayed (applications, balance)
  5. Logout, login as KAM
  6. Navigate to `/dashboard`
  7. Verify KAMDashboard component renders
  8. Verify metrics displayed (clients, reviews)
  9. Repeat for CREDIT and NBFC roles
- **Expected Result:** Correct dashboard component renders per role

---

### M5-FE-002: Quick Action Buttons
- **Module:** M5
- **Requirement:** P0.15
- **Role:** CLIENT, KAM, CREDIT, NBFC
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/Dashboard.tsx`
  - Page: `src/pages/ApplicationDetail.tsx`
  - Component: Action buttons based on role and status
- **Steps:**
  1. Login as CLIENT
  2. Navigate to dashboard
  3. Verify "New Application" button visible
  4. Navigate to application in DRAFT status
  5. Verify "Submit" and "Withdraw" buttons visible
  6. Logout, login as KAM
  7. Navigate to application in `UNDER_KAM_REVIEW`
  8. Verify "Forward to Credit" and "Raise Query" buttons visible
  9. Logout, login as CREDIT
  10. Navigate to application in `PENDING_CREDIT_REVIEW`
  11. Verify "Approve", "Reject", "Assign NBFC", "Mark Disbursed" buttons visible
  12. Logout, login as NBFC
  13. Navigate to application in `SENT_TO_NBFC`
  14. Verify "Record Decision" button visible
- **Expected Result:** Action buttons appear based on role and status

---

## M6: Daily Summary Reports

### M6-BE-001: Generate Daily Summary
- **Module:** M6
- **Requirement:** P0.16
- **Role:** CREDIT
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/reports/daily/generate`
  - Controller: `reports.controller.ts` → `generateDailySummary()`
  - Service: Aggregates from Loan Applications, Commission Ledger, File Auditing Log
  - Webhook: `POST /webhook/DAILYSUMMARY`
- **Steps:**
  1. Authenticate as CREDIT
  2. Call `POST /api/reports/daily/generate`
  3. Verify 200 response
  4. Query `GET /webhook/dailysummaryreport` with today's date
  5. Verify report entry exists with:
     - `Report Date = today`
     - `Summary Content = formatted text`
     - `Generated Timestamp = now`
  6. Verify report contains sections:
     - New applications
     - Status changes
     - Commission transactions
     - Queries raised/resolved
- **Expected Result:** Daily summary generated and stored correctly

---

### M6-FE-001: Generate Daily Summary UI
- **Module:** M6
- **Requirement:** P0.16
- **Role:** CREDIT
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/Reports.tsx`
  - API: `src/services/api.ts` → `generateDailySummary()`
- **Steps:**
  1. Login as CREDIT
  2. Navigate to `/reports`
  3. Click "Generate Report" button
  4. Verify loading state
  5. Verify success message
  6. Verify report appears in list
  7. Verify report shows today's date
- **Expected Result:** Report generation UI works correctly

---

### M6-BE-002: Report Email Delivery
- **Module:** M6
- **Requirement:** P0.17
- **Role:** CREDIT
- **Type:** Backend
- **Implementation:**
  - Controller: `reports.controller.ts` → `generateDailySummary()`
  - Service: Triggers email webhook
  - Webhook: `POST /webhook/email`
- **Steps:**
  1. Generate daily summary
  2. Verify n8n webhook `/webhook/email` is called
  3. Verify email payload contains report content
  4. Check email service logs
  5. Verify email sent to configured addresses
- **Expected Result:** Email sent with report content

---

## M7: AI File Summary

### M7-BE-001: Generate AI Summary
- **Module:** M7
- **Requirement:** P0.18
- **Role:** CREDIT, KAM
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/loan-applications/:id/generate-summary`
  - Controller: `ai.controller.ts` → `generateSummary()`
  - Service: `aiSummary.service.ts` → `generateSummary()`
  - Webhook: `POST /webhook/loanapplications`
- **Steps:**
  1. Authenticate as CREDIT
  2. Call `POST /api/loan-applications/:id/generate-summary`
  3. Verify 200 response
  4. Query `GET /webhook/loanapplication` with File ID
  5. Verify `AI File Summary` field populated
  6. Verify summary contains sections:
     - Applicant Profile
     - Loan Details
     - Strengths
     - Risks
- **Expected Result:** AI summary generated and stored correctly

---

### M7-FE-001: Generate AI Summary UI
- **Module:** M7
- **Requirement:** P0.18
- **Role:** CREDIT, KAM
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/ApplicationDetail.tsx`
  - API: `src/services/api.ts` → `generateAISummary()`
- **Steps:**
  1. Login as CREDIT
  2. Navigate to application detail
  3. Scroll to AI Summary section
  4. Click "Generate AI Summary" button
  5. Verify loading state
  6. Verify summary appears in panel
  7. Verify summary is formatted correctly
- **Expected Result:** AI summary generation UI works correctly

---

### M7-FE-002: AI Summary Display
- **Module:** M7
- **Requirement:** P0.19
- **Role:** All
- **Type:** Frontend
- **Implementation:**
  - Page: `src/pages/ApplicationDetail.tsx`
  - API: `src/services/api.ts` → `getApplication()`
- **Steps:**
  1. Navigate to application with AI summary
  2. Verify summary panel displays formatted text
  3. Navigate to application without AI summary
  4. Verify "Generate Summary" button appears
  5. Click button, generate summary
  6. Verify summary appears
- **Expected Result:** AI summary displays correctly based on existence

---

## Cross-Module: Authentication & Authorization

### CROSS-BE-001: JWT Authentication
- **Module:** CROSS
- **Requirement:** P0.20
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - Route: `POST /api/auth/login`
  - Controller: `auth.controller.ts` → `login()`
  - Middleware: `auth.middleware.ts` → `authenticate()`
- **Steps:**
  1. Call protected endpoint without token
  2. Verify 401 response
  3. Call with invalid token
  4. Verify 401 response
  5. Call `POST /api/auth/login` with valid credentials
  6. Verify 200 response with JWT token
  7. Call protected endpoint with valid token
  8. Verify 200 response
- **Expected Result:** JWT authentication enforced correctly

---

### CROSS-BE-002: Role-Based Access Control
- **Module:** CROSS
- **Requirement:** P0.20
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - Middleware: `rbac.middleware.ts` → `requireClient()`, `requireKAM()`, `requireCredit()`, `requireNBFC()`
- **Steps:**
  1. Authenticate as CLIENT
  2. Call KAM-only endpoint (e.g., `GET /api/kam/dashboard`)
  3. Verify 403 response
  4. Call CLIENT endpoint
  5. Verify 200 response
  6. Repeat for all role combinations
- **Expected Result:** RBAC enforced correctly

---

### CROSS-FE-001: Protected Routes
- **Module:** CROSS
- **Requirement:** P0.20
- **Role:** All
- **Type:** Frontend
- **Implementation:**
  - Component: `src/components/ProtectedRoute.tsx`
  - Component: `src/components/RoleGuard.tsx`
- **Steps:**
  1. Attempt to access protected page without login
  2. Verify redirect to `/login`
  3. Login as CLIENT
  4. Attempt to access KAM-only page
  5. Verify access denied or redirect
  6. Access CLIENT-allowed page
  7. Verify page loads
- **Expected Result:** Frontend route protection works correctly

---

### CROSS-BE-003: Data Persistence via n8n Webhooks
- **Module:** CROSS
- **Requirement:** P0.21
- **Role:** All
- **Type:** Backend
- **Implementation:**
  - Service: `n8nClient.ts` → all webhook methods
  - Webhooks: All GET and POST webhooks
- **Steps:**
  1. Perform CREATE operation
  2. Verify POST webhook called (check logs)
  3. Query Airtable directly
  4. Verify record created
  5. Perform UPDATE operation
  6. Verify POST webhook called
  7. Query Airtable
  8. Verify record updated
  9. Perform READ operation
  10. Verify GET webhook called
  11. Simulate webhook failure
  12. Verify 500 error returned
- **Expected Result:** All operations go through n8n webhooks correctly

---

## Test Execution Summary

### Test Distribution

| Module | Backend | Frontend | End-to-End | Total |
|--------|---------|----------|------------|-------|
| M1: Pay In/Out Ledger | 3 | 1 | 2 | 6 |
| M2: Master Form Builder | 3 | 2 | 1 | 6 |
| M3: Status Tracking | 3 | 3 | 0 | 6 |
| M4: Audit Log/Queries | 2 | 1 | 1 | 4 |
| M5: Action Center | 1 | 2 | 0 | 3 |
| M6: Daily Summary | 2 | 1 | 0 | 3 |
| M7: AI File Summary | 1 | 2 | 0 | 3 |
| CROSS: Auth & Data | 3 | 1 | 0 | 4 |
| **TOTAL** | **18** | **13** | **4** | **35** |

### Test Priority

All tests in this plan are **P0 CRITICAL** and must pass before production deployment.

### Test Automation Recommendations

1. **Backend Tests:** Use Jest/Supertest for API endpoint testing
2. **Frontend Tests:** Use React Testing Library + Jest for component testing
3. **End-to-End Tests:** Use Playwright or Cypress for full workflow testing
4. **Test Data:** Use test fixtures and database seeding for consistent test data
5. **Mocking:** Mock n8n webhook calls for isolated testing

---

**Last Updated:** 2025-01-27  
**Maintained By:** QA Team

