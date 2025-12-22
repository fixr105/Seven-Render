# P0 Critical Functional Requirements for MVP

**Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Purpose:** Define the minimum viable functionality that MUST work for production deployment

---

## Overview

This document lists all P0 (CRITICAL) functional requirements grouped by module. Each requirement is directly testable via UI or API calls. These are the absolute minimum features required for a viable MVP.

---

## (a) M1: Pay In/Out Ledger

### P0.1: Commission Ledger Viewing
- **CLIENT role** can view their own commission ledger entries via `GET /api/clients/me/ledger`; response includes running balance calculation (sum of all Payout Amount fields)
- **CREDIT role** can view all commission ledger entries via `GET /api/credit/ledger` with optional filters (clientId, dateFrom, dateTo)

**Test:** 
- API: Call endpoint with valid JWT token, verify 200 response with ledger entries array and `currentBalance` field
- UI: Navigate to Ledger page, verify table displays entries with correct balance

---

### P0.2: Automatic Commission Entry Creation
- When CREDIT marks a loan application as disbursed via `POST /api/credit/loan-applications/:id/mark-disbursed`, system automatically creates a Commission Ledger entry with calculated `Payout Amount = (disbursedAmount * commissionRate) / 100` where commissionRate comes from the Client's record

**Test:**
- API: Call mark-disbursed endpoint, then query Commission Ledger via GET webhook, verify new entry exists with correct calculation
- UI: Mark application as disbursed, navigate to ledger, verify new entry appears

---

### P0.3: Payout Request Workflow
- **CLIENT role** can request payout via `POST /api/clients/me/payout-requests` with `amount` or `full: true` flag; system validates balance >= requested amount and creates ledger entry with `Payout Request = 'Requested'`
- **CREDIT role** can approve/reject payout requests via `POST /api/credit/payout-requests/:id/approve` or `/reject`; approve creates negative ledger entry (deducts balance) and updates original entry to `Payout Request = 'Paid'`

**Test:**
- API: Client creates payout request, verify 200 response and ledger entry created; Credit approves, verify negative entry created and original entry updated
- UI: Client requests payout, Credit sees request in pending list, approves, verify balance decreases

---

## (b) M2: Master Form Builder + New Application

### P0.4: Form Configuration by KAM
- **KAM role** can configure form templates for managed clients via `POST /api/kam/clients/:id/form-mappings` with `modules` array; system creates Form Categories, Form Fields, and Client Form Mapping records in Airtable via POST webhooks

**Test:**
- API: KAM calls endpoint with clientId and modules array, verify 200 response; query Client Form Mapping via GET webhook, verify records created
- UI: KAM navigates to Form Configuration page, selects client and modules, clicks Save, verify success message

---

### P0.5: Dynamic Form Loading for Client
- **CLIENT role** can fetch their configured form template via `GET /api/client/form-config`; response includes ordered categories and fields filtered by client's Enabled Modules and Form Categories from Client Form Mapping table

**Test:**
- API: Client calls endpoint, verify 200 response with form structure matching their Client Form Mapping records
- UI: Client navigates to New Application page, verify form fields render in correct order matching their configuration

---

### P0.6: Application Creation with Form Data
- **CLIENT role** can create loan application via `POST /api/loan-applications` with `formData` object; system validates mandatory fields (where `Is Mandatory = 'True'` in Form Fields table) and returns 400 with missing fields list if validation fails

**Test:**
- API: Submit application with missing mandatory field, verify 400 response with error message listing missing fields; submit with all mandatory fields, verify 201 response with application ID
- UI: Fill form, leave mandatory field empty, click Submit, verify inline error; fill all mandatory fields, verify submission succeeds

---

### P0.7: Document Upload and Storage
- **CLIENT role** can upload documents during application creation; system uploads to OneDrive and stores document links in Loan Applications `Documents` field as comma-separated `fieldId:url|fileName` format

**Test:**
- API: Create application with documentUploads array, verify Documents field in Airtable contains formatted string
- UI: Upload document in New Application form, verify file appears in document list; submit application, verify document persists in Application Detail view

---

## (c) M3: Status Tracking + Listings

### P0.8: Status State Machine Validation
- System enforces valid status transitions using state machine rules; invalid transitions return 400 error; valid transitions: `DRAFT → UNDER_KAM_REVIEW → PENDING_CREDIT_REVIEW → SENT_TO_NBFC → APPROVED → DISBURSED → CLOSED` (plus query paths)

**Test:**
- API: Attempt invalid transition (e.g., DRAFT → APPROVED), verify 400 response; perform valid transition, verify 200 response and status updated in Airtable
- UI: Change status via dropdown/button, verify only valid transitions are allowed; verify status timeline updates correctly

---

### P0.9: Role-Based Application Listings
- **CLIENT role** sees only their own applications via `GET /api/loan-applications` (filtered by `Client` field matching `req.user.clientId`)
- **KAM role** sees applications for managed clients via `GET /api/kam/loan-applications` (filtered by `Client` field matching KAM's managed clients)
- **CREDIT role** sees all applications via `GET /api/credit/loan-applications`
- **NBFC role** sees only applications assigned to them via `GET /api/nbfc/loan-applications` (filtered by `Assigned NBFC` field matching `req.user.nbfcId`)

**Test:**
- API: Call endpoint with different role tokens, verify response contains only appropriate applications
- UI: Login as different roles, navigate to Applications page, verify table shows only relevant applications

---

### P0.10: Status History Tracking
- All status changes are logged to File Auditing Log table with `Action/Event Type = 'Status Change'`, `Actor = user email`, `Details/Message = status transition description`, and `File = application File ID`

**Test:**
- API: Change application status, query File Auditing Log via GET webhook, verify new entry exists with correct fields
- UI: View Application Detail page, check Audit Log section, verify status changes appear in chronological order

---

## (d) M4: Audit Log/Queries

### P0.11: Query Raise and Response
- **KAM role** can raise query with CLIENT via `POST /api/kam/loan-applications/:id/queries` with `message`; system creates File Auditing Log entry with `Action/Event Type = 'Query Raised'`, `Target User/Role = 'CLIENT'`, `Resolved = false`, and changes application status to `QUERY_WITH_CLIENT`
- **CLIENT role** can respond to query via `POST /api/loan-applications/:id/queries/:queryId/reply` with `response`; system creates File Auditing Log entry with `Action/Event Type = 'Query Resolved'`, `Resolved = true`, and changes status back to `UNDER_KAM_REVIEW`

**Test:**
- API: KAM raises query, verify File Auditing Log entry created and status changed; Client responds, verify resolution entry created and status reverted
- UI: KAM clicks "Raise Query" button, enters message, submits; Client sees query notification, responds; verify query marked as resolved

---

### P0.12: Comprehensive Audit Logging
- All mutating operations (POST/PATCH/DELETE) create entries in both File Auditing Log (for file-specific actions) and Admin Activity Log (for system-wide actions) with actor, action type, timestamp, and details

**Test:**
- API: Perform any mutating operation (e.g., create application, change status), query both audit log tables via GET webhooks, verify entries exist
- UI: Perform actions in UI, navigate to audit log views, verify all actions are logged

---

### P0.13: Notification Creation
- When queries are raised or status changes occur, system creates Notification records linked to target users with `Read = false`; notifications are fetched via `GET /api/notifications` (role-filtered)

**Test:**
- API: Raise query or change status, query Notifications table via GET webhook, verify notification created for target user
- UI: Trigger action that should create notification, verify notification appears in user's notification list

---

## (e) M5: Action Center Core Actions

### P0.14: Role-Based Dashboard Data
- Each role has a dashboard endpoint (`GET /api/{role}/dashboard`) that returns role-specific metrics: CLIENT (pending applications, ledger balance), KAM (managed clients count, pending reviews), CREDIT (pending reviews, payout requests), NBFC (assigned applications count)

**Test:**
- API: Call dashboard endpoint for each role, verify 200 response with appropriate metrics
- UI: Login as each role, verify dashboard displays correct metrics and action items

---

### P0.15: Quick Action Buttons
- Dashboard and Application Detail pages provide quick action buttons based on role and status: CLIENT (Submit, Withdraw), KAM (Forward to Credit, Raise Query), CREDIT (Approve, Reject, Assign NBFC, Mark Disbursed), NBFC (Record Decision)

**Test:**
- UI: Navigate to dashboard/application detail, verify action buttons appear based on role and current status; click action, verify appropriate modal/form appears

---

## (f) M6: Daily Summary

### P0.16: Daily Report Generation
- **CREDIT role** (or scheduled job) can generate daily summary via `POST /api/reports/daily/generate`; system aggregates data from Loan Applications (new applications, status changes), Commission Ledger (transactions), and File Auditing Log (queries raised/resolved), writes formatted report to Daily Summary Reports table with `Report Date = today`, `Summary Content = formatted text`, `Generated Timestamp = now`

**Test:**
- API: Call generate endpoint, verify 200 response; query Daily Summary Reports table via GET webhook, verify new entry exists with today's date
- UI: Navigate to Reports page, click "Generate Report", verify report appears in list

---

### P0.17: Report Email Delivery
- After report generation, system triggers n8n `/webhook/email` endpoint with report content; email is sent via Outlook to configured management email addresses

**Test:**
- API: Generate report, check n8n webhook logs/email service, verify email sent with report content
- UI: Generate report, verify success message indicates email sent

---

## (g) M7: File Summary

### P0.18: AI Summary Generation
- **CREDIT/KAM role** can generate AI summary for application via `POST /api/loan-applications/:id/generate-summary`; system fetches application data and documents, calls OpenAI API (or n8n AI node), generates summary with sections (Applicant Profile, Loan Details, Strengths, Risks), and writes to Loan Applications `AI File Summary` field via POST webhook

**Test:**
- API: Call generate-summary endpoint, verify 200 response; query Loan Applications table, verify `AI File Summary` field populated with structured text
- UI: Navigate to Application Detail, click "Generate AI Summary" button, verify loading state, then summary appears in dedicated panel

---

### P0.19: AI Summary Display
- Application Detail page displays AI File Summary in dedicated panel; if summary exists, shows formatted text; if not, shows "Generate Summary" button; summary can be refreshed via generate endpoint

**Test:**
- UI: Open Application Detail for application with AI summary, verify summary panel displays formatted text; open application without summary, verify "Generate Summary" button appears; click to generate, verify summary appears

---

## Cross-Module P0 Requirements

### P0.20: Authentication and Authorization
- All endpoints (except `/auth/login`) require valid JWT token in `Authorization: Bearer <token>` header; invalid/missing token returns 401; role-based access control enforced via middleware; users can only access data permitted by their role

**Test:**
- API: Call protected endpoint without token, verify 401; call with invalid token, verify 401; call with valid token but wrong role, verify 403; call with correct role, verify 200
- UI: Attempt to access protected page without login, verify redirect to login; login with different roles, verify appropriate access

---

### P0.21: Data Persistence via n8n Webhooks
- All data operations (create/update/read) go through n8n webhooks to Airtable; POST operations use POST webhooks (e.g., `/webhook/loanapplications`), GET operations use GET webhooks (e.g., `/webhook/loanapplication`); webhook failures return 500 error

**Test:**
- API: Perform CRUD operations, verify n8n webhook calls succeed (check logs or Airtable directly); simulate webhook failure, verify 500 error returned
- UI: Perform actions that modify data, verify changes persist after page refresh

---

## Summary

**Total P0 Requirements: 21**

- M1 (Pay In/Out Ledger): 3 requirements
- M2 (Master Form Builder + New Application): 4 requirements
- M3 (Status Tracking + Listings): 3 requirements
- M4 (Audit Log/Queries): 3 requirements
- M5 (Action Center): 2 requirements
- M6 (Daily Summary): 2 requirements
- M7 (File Summary): 2 requirements
- Cross-Module: 2 requirements

All requirements are directly testable via API calls or UI interactions. These represent the absolute minimum functionality required for a viable MVP.

