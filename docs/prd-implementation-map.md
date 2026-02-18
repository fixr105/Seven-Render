# PRD Implementation Mapping

**Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Purpose:** Map PRD modules and flows to backend controllers/routes/services, frontend pages/components/hooks, and n8n webhook paths/Airtable tables

---

## Table of Contents

1. [M1: Pay In/Out Ledger](#m1-pay-inout-ledger)
2. [M2: Master Form Builder + New Application](#m2-master-form-builder--new-application)
3. [M3: Status Tracking + Listings](#m3-status-tracking--listings)
4. [M4: Audit Log/Queries](#m4-audit-logqueries)
5. [M5: Action Center](#m5-action-center)
6. [M6: Daily Summary Reports](#m6-daily-summary-reports)
7. [M7: AI File Summary](#m7-ai-file-summary)
8. [Authentication & User Management](#authentication--user-management)
9. [Cross-Module Services](#cross-module-services)

---

## M1: Pay In/Out Ledger

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **View Commission Ledger (CLIENT)** | `ledger.controller.ts` → `getClientLedger()`<br>`/api/clients/me/ledger` (GET) | `src/pages/Ledger.tsx`<br>`src/hooks/useLedger.ts` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **View Commission Ledger (KAM)** | `ledger.controller.ts` → `getKAMLedger()`<br>`/api/kam/ledger` (GET) | `src/pages/Ledger.tsx`<br>`src/hooks/useLedger.ts` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **View Commission Ledger (CREDIT)** | `ledger.controller.ts` → `getCreditLedger()`<br>`/api/credit/ledger` (GET) | `src/pages/Ledger.tsx`<br>`src/hooks/useLedger.ts` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **Get Ledger Entry Details** | `ledger.controller.ts` → `getLedgerEntry()`<br>`/api/clients/me/ledger/:ledgerEntryId` (GET) | `src/pages/Ledger.tsx` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **Raise Query on Ledger Entry** | `ledger.controller.ts` → `createLedgerQuery()`<br>`/api/clients/me/ledger/:ledgerEntryId/query` (POST) | `src/pages/Ledger.tsx` | POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/COMISSIONLEDGER` | `File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **Request Payout (CLIENT)** | `ledger.controller.ts` → `createPayoutRequest()`<br>`/api/clients/me/payout-requests` (POST) | `src/pages/Ledger.tsx` | POST: `/webhook/COMISSIONLEDGER`<br>POST: `/webhook/Fileauditinglog` | `Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **View Payout Requests (CLIENT)** | `ledger.controller.ts` → `getPayoutRequests()`<br>`/api/clients/me/payout-requests` (GET) | `src/pages/Ledger.tsx` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **Approve/Reject Payout (CREDIT)** | `credit.controller.ts` → `approvePayout()` / `rejectPayout()`<br>`/api/credit/payout-requests/:id/approve` (POST)<br>`/api/credit/payout-requests/:id/reject` (POST) | `src/pages/Ledger.tsx` | POST: `/webhook/COMISSIONLEDGER`<br>POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/notification` | `Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **View Payout Requests (CREDIT)** | `credit.controller.ts` → `getPayoutRequests()`<br>`/api/credit/payout-requests` (GET) | `src/pages/Ledger.tsx` | GET: `/webhook/commisionledger` | `Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **Create Manual Ledger Entry (CREDIT)** | `credit.controller.ts` → `createLedgerEntry()`<br>`/api/credit/ledger/entries` (POST) | `src/pages/Ledger.tsx` | POST: `/webhook/COMISSIONLEDGER`<br>POST: `/webhook/POSTLOG` | `Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |
| **Automatic Commission Entry on Disbursement** | `credit.controller.ts` → `markDisbursed()`<br>`/api/credit/loan-applications/:id/mark-disbursed` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/COMISSIONLEDGER`<br>POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog` | `Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |

**Backend Files:**
- `backend/src/controllers/ledger.controller.ts`
- `backend/src/routes/ledger.routes.ts`
- `backend/src/services/airtable/n8nClient.ts` (webhook calls)

**Frontend Files:**
- `src/pages/Ledger.tsx`
- `src/hooks/useLedger.ts`
- `src/services/api.ts` (API client methods)

---

## M2: Master Form Builder + New Application

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **Configure Form Templates (KAM)** | `kam.controller.ts` → `createFormMapping()`<br>`/api/kam/clients/:id/form-mappings` (POST) | `src/pages/FormConfiguration.tsx` | POST: `/webhook/POSTCLIENTFORMMAPPING`<br>POST: `/webhook/FormCategory`<br>POST: `/webhook/FormFields` | `Client Form Mapping` (tbl70C8uPKmoLkOQJ)<br>`Form Categories` (tblqCqXV0Hds0t0bH)<br>`Form Fields` (tbl5oZ6zI0dc5eutw) |
| **View Form Mappings (KAM)** | `kam.controller.ts` → `getFormMappings()`<br>`/api/kam/clients/:id/form-mappings` (GET) | `src/pages/FormConfiguration.tsx` | GET: `/webhook/clientformmapping`<br>GET: `/webhook/formcategories`<br>GET: `/webhook/formfields` | `Client Form Mapping` (tbl70C8uPKmoLkOQJ)<br>`Form Categories` (tblqCqXV0Hds0t0bH)<br>`Form Fields` (tbl5oZ6zI0dc5eutw) |
| **Get Form Config (CLIENT)** | `client.controller.ts` → `getFormConfig()`<br>`/api/client/form-config` (GET) | `src/pages/NewApplication.tsx`<br>`src/pages/ClientForm.tsx` | GET: `/webhook/clientformmapping`<br>GET: `/webhook/formcategories`<br>GET: `/webhook/formfields`<br>GET: `/webhook/client` | `Client Form Mapping` (tbl70C8uPKmoLkOQJ)<br>`Form Categories` (tblqCqXV0Hds0t0bH)<br>`Form Fields` (tbl5oZ6zI0dc5eutw)<br>`Clients` (tblK8mN3pQvR5sT7u) |
| **Create Loan Application (CLIENT)** | `loan.controller.ts` → `createApplication()`<br>`/api/loan-applications` (POST) | `src/pages/NewApplication.tsx`<br>`src/pages/ClientForm.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/POSTLOG` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |
| **Update Application Form Data (CLIENT)** | `loan.controller.ts` → `updateApplicationForm()`<br>`/api/loan-applications/:id/form` (POST) | `src/pages/NewApplication.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/POSTLOG` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |
| **Submit Application (CLIENT)** | `loan.controller.ts` → `submitApplication()`<br>`/api/loan-applications/:id/submit` (POST) | `src/pages/NewApplication.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/POSTLOG` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |
| **Upload Documents** | `documents.routes.ts` → `/api/documents/upload` (POST)<br>OneDrive service integration | `src/pages/NewApplication.tsx`<br>`src/components/ui/FileUpload.tsx` | POST: `/webhook/loanapplications` (updates Documents field) | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Mandatory Field Validation** | `loan.controller.ts` → `submitApplication()`<br>`mandatoryFieldValidation.service.ts` | `src/pages/NewApplication.tsx`<br>`src/services/validation/mandatoryFieldValidation.service.ts` | GET: `/webhook/formfields` (reads Is Mandatory flag) | `Form Fields` (tbl5oZ6zI0dc5eutw) |
| **Form Versioning** | `loan.controller.ts` → `submitApplication()`<br>`formConfigVersioning.ts` | `src/pages/NewApplication.tsx` | POST: `/webhook/loanapplications` (stores Form Config Version) | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Public Form Link (for external clients)** | `kam.controller.ts` → `getPublicFormMappings()`<br>`/api/public/clients/:id/form-mappings` (GET) | `src/pages/ClientForm.tsx` | GET: `/webhook/clientformmapping`<br>GET: `/webhook/formcategories`<br>GET: `/webhook/formfields` | `Client Form Mapping` (tbl70C8uPKmoLkOQJ)<br>`Form Categories` (tblqCqXV0Hds0t0bH)<br>`Form Fields` (tbl5oZ6zI0dc5eutw) |

**Backend Files:**
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/client.controller.ts`
- `backend/src/controllers/loan.controller.ts`
- `backend/src/routes/kam.routes.ts`
- `backend/src/routes/client.routes.ts`
- `backend/src/routes/loan.routes.ts`
- `backend/src/routes/documents.routes.ts`
- `backend/src/services/validation/mandatoryFieldValidation.service.ts`
- `backend/src/services/formConfigVersioning.ts`
- `backend/src/services/onedrive/onedriveUpload.service.ts`

**Frontend Files:**
- `src/pages/FormConfiguration.tsx`
- `src/pages/NewApplication.tsx`
- `src/pages/ClientForm.tsx`
- `src/components/ui/FileUpload.tsx`
- `src/services/api.ts` (API client methods)

---

## M3: Status Tracking + Listings

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **List Applications (CLIENT)** | `loan.controller.ts` → `listApplications()`<br>`/api/loan-applications` (GET) | `src/pages/Applications.tsx`<br>`src/hooks/useApplications.ts` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **List Applications (KAM)** | `kam.controller.ts` → `listApplications()`<br>`/api/kam/loan-applications` (GET) | `src/pages/Applications.tsx`<br>`src/hooks/useApplications.ts` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **List Applications (CREDIT)** | `credit.controller.ts` → `listApplications()`<br>`/api/credit/loan-applications` (GET) | `src/pages/Applications.tsx`<br>`src/hooks/useApplications.ts` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **List Applications (NBFC)** | `nbfc.controller.ts` → `listApplications()`<br>`/api/nbfc/loan-applications` (GET) | `src/pages/Applications.tsx`<br>`src/hooks/useApplications.ts` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Get Application Details** | `loan.controller.ts` → `getApplication()`<br>`/api/loan-applications/:id` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Status State Machine Validation** | `loan.controller.ts` → status transitions<br>`statusStateMachine.ts` | `src/pages/ApplicationDetail.tsx`<br>`src/components/StatusTimeline.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Status History Tracking** | `statusHistory.service.ts` | `src/pages/ApplicationDetail.tsx`<br>`src/components/StatusTimeline.tsx` | GET: `/webhook/fileauditinglog` | `File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Withdraw Application (CLIENT)** | `loan.controller.ts` → `withdrawApplication()`<br>`/api/loan-applications/:id/withdraw` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Forward to Credit (KAM)** | `kam.controller.ts` → `forwardToCredit()`<br>`/api/kam/loan-applications/:id/forward-to-credit` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/notification` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Mark In Negotiation (CREDIT)** | `credit.controller.ts` → `markInNegotiation()`<br>`/api/credit/loan-applications/:id/mark-in-negotiation` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Assign NBFCs (CREDIT)** | `credit.controller.ts` → `assignNBFCs()`<br>`/api/credit/loan-applications/:id/assign-nbfcs` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/notification` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Close Application (CREDIT)** | `credit.controller.ts` → `closeApplication()`<br>`/api/credit/loan-applications/:id/close` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |

**Backend Files:**
- `backend/src/controllers/loan.controller.ts`
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/credit.controller.ts`
- `backend/src/controllers/nbfc.controller.ts`
- `backend/src/routes/loan.routes.ts`
- `backend/src/routes/kam.routes.ts`
- `backend/src/routes/credit.routes.ts`
- `backend/src/routes/nbfc.routes.ts`
- `backend/src/services/statusTracking/statusStateMachine.ts`
- `backend/src/services/statusTracking/statusHistory.service.ts`

**Frontend Files:**
- `src/pages/Applications.tsx`
- `src/pages/ApplicationDetail.tsx`
- `src/components/StatusTimeline.tsx`
- `src/hooks/useApplications.ts`
- `src/services/api.ts` (API client methods)

---

## M4: Audit Log/Queries

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **Raise Query (KAM → CLIENT)** | `kam.controller.ts` → `raiseQuery()`<br>`/api/kam/loan-applications/:id/queries` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/loanapplications`<br>POST: `/webhook/notification` | `File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Raise Query (CREDIT → KAM)** | `credit.controller.ts` → `raiseQuery()`<br>`/api/credit/loan-applications/:id/queries` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/loanapplications`<br>POST: `/webhook/notification` | `File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Reply to Query (CLIENT)** | `client.controller.ts` → `respondToQuery()`<br>`/api/loan-applications/:id/queries/:queryId/reply` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/loanapplications`<br>POST: `/webhook/notification` | `File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Get Queries for Application** | `loan.controller.ts` → `getQueries()`<br>`/api/loan-applications/:id/queries` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/fileauditinglog` | `File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Resolve Query** | `loan.controller.ts` → `resolveQuery()`<br>`/api/loan-applications/:id/queries/:queryId/resolve` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/notification` | `File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Notifications` (tblmprms0l3yQjVdx) |
| **Threaded Query System** | `queries.controller.ts` → `postReply()`<br>`/api/queries/:parentId/replies` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/Fileauditinglog` | `File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Get Query Thread** | `queries.controller.ts` → `getThread()`<br>`/api/queries/thread/:id` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/fileauditinglog` | `File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Get File Audit Log** | `loan.controller.ts` → `getQueries()`<br>`/api/loan-applications/:id/audit-log` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/fileauditinglog` | `File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Get Admin Activity Log** | `audit.controller.ts` → `getAdminActivityLog()`<br>`/api/admin/activity-log` (GET) | (Admin only, no UI yet) | GET: `/webhook/adminactivity` | `Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |

**Backend Files:**
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/credit.controller.ts`
- `backend/src/controllers/client.controller.ts`
- `backend/src/controllers/loan.controller.ts`
- `backend/src/controllers/queries.controller.ts`
- `backend/src/controllers/audit.controller.ts`
- `backend/src/routes/queries.routes.ts`
- `backend/src/routes/audit.routes.ts`
- `backend/src/services/queries/query.service.ts`

**Frontend Files:**
- `src/pages/ApplicationDetail.tsx`
- `src/services/api.ts` (API client methods)

---

## M5: Action Center

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **Client Dashboard** | `client.controller.ts` → `getDashboard()`<br>`/api/client/dashboard` (GET) | `src/pages/Dashboard.tsx`<br>`src/pages/dashboards/ClientDashboard.tsx` | GET: `/webhook/loanapplication`<br>GET: `/webhook/commisionledger` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Commission Ledger` (tblrBWFuPYBI4WWtn) |
| **KAM Dashboard** | `kam.controller.ts` → `getDashboard()`<br>`/api/kam/dashboard` (GET) | `src/pages/Dashboard.tsx`<br>`src/pages/dashboards/KAMDashboard.tsx` | GET: `/webhook/loanapplication`<br>GET: `/webhook/client`<br>GET: `/webhook/fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Clients` (tblK8mN3pQvR5sT7u)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **Credit Dashboard** | `credit.controller.ts` → `getDashboard()`<br>`/api/credit/dashboard` (GET) | `src/pages/Dashboard.tsx`<br>`src/pages/dashboards/CreditDashboard.tsx` | GET: `/webhook/loanapplication`<br>GET: `/webhook/commisionledger`<br>GET: `/webhook/fileauditinglog` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **NBFC Dashboard** | `nbfc.controller.ts` → `getDashboard()`<br>`/api/nbfc/dashboard` (GET) | `src/pages/Dashboard.tsx`<br>`src/pages/dashboards/NBFCDashboard.tsx` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Notifications List** | `notifications.controller.ts` → `getNotifications()`<br>`/api/notifications` (GET) | `src/components/layout/TopBar.tsx`<br>`src/hooks/useNotifications.ts` | GET: `/webhook/notifications` | `Notifications` (tblmprms0l3yQjVdx) |
| **Unread Notifications Count** | `notifications.controller.ts` → `getUnreadCount()`<br>`/api/notifications/unread-count` (GET) | `src/components/layout/TopBar.tsx`<br>`src/hooks/useNotifications.ts` | GET: `/webhook/notifications` | `Notifications` (tblmprms0l3yQjVdx) |
| **Mark Notification as Read** | `notifications.controller.ts` → `markAsRead()`<br>`/api/notifications/:id/read` (POST) | `src/components/layout/TopBar.tsx` | POST: `/webhook/notification` | `Notifications` (tblmprms0l3yQjVdx) |

**Backend Files:**
- `backend/src/controllers/client.controller.ts`
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/credit.controller.ts`
- `backend/src/controllers/nbfc.controller.ts`
- `backend/src/controllers/notifications.controller.ts`
- `backend/src/routes/notifications.routes.ts`

**Frontend Files:**
- `src/pages/Dashboard.tsx`
- `src/pages/dashboards/ClientDashboard.tsx`
- `src/pages/dashboards/KAMDashboard.tsx`
- `src/pages/dashboards/CreditDashboard.tsx`
- `src/pages/dashboards/NBFCDashboard.tsx`
- `src/components/layout/TopBar.tsx`
- `src/hooks/useNotifications.ts`
- `src/services/api.ts` (API client methods)

---

## M6: Daily Summary Reports

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **Generate Daily Summary** | `reports.controller.ts` → `generateDailySummary()`<br>`/api/reports/daily/generate` (POST) | `src/pages/Reports.tsx` | POST: `/webhook/DAILYSUMMARY`<br>POST: `/webhook/email`<br>GET: `/webhook/loanapplication`<br>GET: `/webhook/commisionledger`<br>GET: `/webhook/fileauditinglog` | `Daily Summary Reports` (tbla3urDb8kCsO0Et)<br>`Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`Commission Ledger` (tblrBWFuPYBI4WWtn)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ) |
| **List Daily Summaries** | `reports.controller.ts` → `listDailySummaries()`<br>`/api/reports/daily/list` (GET) | `src/pages/Reports.tsx` | GET: `/webhook/dailysummaryreport` | `Daily Summary Reports` (tbla3urDb8kCsO0Et) |
| **Get Latest Daily Summary** | `reports.controller.ts` → `getLatestDailySummary()`<br>`/api/reports/daily/latest` (GET) | `src/pages/Reports.tsx` | GET: `/webhook/dailysummaryreport` | `Daily Summary Reports` (tbla3urDb8kCsO0Et) |
| **Get Daily Summary by Date** | `reports.controller.ts` → `getDailySummary()`<br>`/api/reports/daily/:date` (GET) | `src/pages/Reports.tsx` | GET: `/webhook/dailysummaryreport` | `Daily Summary Reports` (tbla3urDb8kCsO0Et) |

**Backend Files:**
- `backend/src/controllers/reports.controller.ts`
- `backend/src/routes/reports.routes.ts`

**Frontend Files:**
- `src/pages/Reports.tsx`
- `src/services/api.ts` (API client methods)

---

## M7: AI File Summary

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **Generate AI Summary** | `ai.controller.ts` → `generateSummary()`<br>`/api/loan-applications/:id/generate-summary` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |
| **Get AI Summary** | `ai.controller.ts` → `getSummary()`<br>`/api/loan-applications/:id/summary` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/loanapplication` | `Loan Applications` (tblN8oQ5sT0vX3yZ6) |

**Backend Files:**
- `backend/src/controllers/ai.controller.ts`
- `backend/src/routes/ai.routes.ts`
- `backend/src/services/ai/aiSummary.service.ts`

**Frontend Files:**
- `src/pages/ApplicationDetail.tsx`
- `src/services/api.ts` (API client methods)

---

## Authentication & User Management

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **User Login** | `auth.controller.ts` → `login()`<br>`/api/auth/login` (POST) | `src/pages/Login.tsx` | GET: `/webhook/useraccount`<br>GET: `/webhook/kamusers`<br>GET: `/webhook/creditteamuser`<br>GET: `/webhook/nbfcpartners`<br>GET: `/webhook/client` | `User Accounts` (tblQ1rT8wW3yA6cC9)<br>`KAM Users` (tblM7nP4rS9tU2vW5)<br>`Credit Team Users` (tblX9yZ2wV4nM6pQ8)<br>`NBFC Partners` (tblP0qS7vV2xZ5bB8)<br>`Clients` (tblK8mN3pQvR5sT7u) |
| **Get Current User** | `auth.controller.ts` → `getMe()`<br>`/api/auth/me` (GET) | `src/hooks/useAuthSafe.ts`<br>`src/contexts/UnifiedAuthProvider.tsx` | GET: `/webhook/useraccount` | `User Accounts` (tblQ1rT8wW3yA6cC9) |
| **List KAM Users** | `users.controller.ts` → `listKAMUsers()`<br>`/api/kam-users` (GET) | `src/pages/Clients.tsx` | GET: `/webhook/kamusers` | `KAM Users` (tblM7nP4rS9tU2vW5) |
| **List User Accounts** | `users.controller.ts` → `listUserAccounts()`<br>`/api/user-accounts` (GET) | (Admin only) | GET: `/webhook/useraccount` | `User Accounts` (tblQ1rT8wW3yA6cC9) |
| **Update User Account** | `users.controller.ts` → `updateUserAccount()`<br>`/api/user-accounts/:id` (PATCH) | (Admin only) | POST: `/webhook/adduser` | `User Accounts` (tblQ1rT8wW3yA6cC9) |

**Backend Files:**
- `backend/src/controllers/auth.controller.ts`
- `backend/src/controllers/users.controller.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/users.routes.ts`
- `backend/src/services/auth/auth.service.ts`

**Frontend Files:**
- `src/pages/Login.tsx`
- `src/hooks/useAuthSafe.ts`
- `src/contexts/UnifiedAuthProvider.tsx`
- `src/services/api.ts` (API client methods)

---

## Client Management

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **List Clients (KAM)** | `kam.controller.ts` → `listClients()`<br>`/api/kam/clients` (GET) | `src/pages/Clients.tsx` | GET: `/webhook/client` | `Clients` (tblK8mN3pQvR5sT7u) |
| **Create Client (KAM)** | `kam.controller.ts` → `createClient()`<br>`/api/kam/clients` (POST) | `src/pages/Clients.tsx` | POST: `/webhook/Client`<br>POST: `/webhook/adduser` | `Clients` (tblK8mN3pQvR5sT7u)<br>`User Accounts` (tblQ1rT8wW3yA6cC9) |
| **Get Client Details (KAM)** | `kam.controller.ts` → `getClient()`<br>`/api/kam/clients/:id` (GET) | `src/pages/Clients.tsx` | GET: `/webhook/client` | `Clients` (tblK8mN3pQvR5sT7u) |
| **Update Client Modules (KAM)** | `kam.controller.ts` → `updateClientModules()`<br>`/api/kam/clients/:id/modules` (PATCH) | `src/pages/Clients.tsx` | POST: `/webhook/Client`<br>POST: `/webhook/POSTLOG` | `Clients` (tblK8mN3pQvR5sT7u)<br>`Admin Activity Log` (tbl8qJ3xK5vF2hNpL) |
| **List Clients (CREDIT)** | `credit.controller.ts` → `listClients()`<br>`/api/credit/clients` (GET) | `src/pages/Clients.tsx` | GET: `/webhook/client` | `Clients` (tblK8mN3pQvR5sT7u) |
| **Get Client Details (CREDIT)** | `credit.controller.ts` → `getClient()`<br>`/api/credit/clients/:id` (GET) | `src/pages/Clients.tsx` | GET: `/webhook/client` | `Clients` (tblK8mN3pQvR5sT7u) |

**Backend Files:**
- `backend/src/controllers/kam.controller.ts`
- `backend/src/controllers/credit.controller.ts`
- `backend/src/routes/kam.routes.ts`
- `backend/src/routes/credit.routes.ts`

**Frontend Files:**
- `src/pages/Clients.tsx`
- `src/services/api.ts` (API client methods)

---

## Loan Products & NBFC Partners

| PRD Requirement | Backend Implementation | Frontend Implementation | n8n Webhook | Airtable Table |
|----------------|----------------------|----------------------|-------------|----------------|
| **List Loan Products** | `products.controller.ts` → `listLoanProducts()`<br>`/api/loan-products` (GET) | `src/pages/NewApplication.tsx`<br>`src/pages/FormConfiguration.tsx` | GET: `/webhook/loanproducts` | `Loan Products` (tblVukvj8kn5gWBta) |
| **Get Loan Product** | `products.controller.ts` → `getLoanProduct()`<br>`/api/loan-products/:id` (GET) | `src/pages/NewApplication.tsx` | GET: `/webhook/loanproducts` | `Loan Products` (tblVukvj8kn5gWBta) |
| **List NBFC Partners** | `products.controller.ts` → `listNBFCPartners()`<br>`/api/nbfc-partners` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/nbfcpartners` | `NBFC Partners` (tblP0qS7vV2xZ5bB8) |
| **Get NBFC Partner** | `products.controller.ts` → `getNBFCPartner()`<br>`/api/nbfc-partners/:id` (GET) | `src/pages/ApplicationDetail.tsx` | GET: `/webhook/nbfcpartners` | `NBFC Partners` (tblP0qS7vV2xZ5bB8) |
| **Create NBFC Partner (CREDIT)** | `nbfc.controller.ts` → `createPartner()`<br>`/api/nbfc-partners` (POST) | (Admin UI) | POST: `/webhook/NBFCPartners`<br>POST: `/webhook/adduser` | `NBFC Partners` (tblP0qS7vV2xZ5bB8)<br>`User Accounts` (tblQ1rT8wW3yA6cC9) |
| **Update NBFC Partner (CREDIT)** | `nbfc.controller.ts` → `updatePartner()`<br>`/api/nbfc-partners/:id` (PATCH) | (Admin UI) | POST: `/webhook/NBFCPartners` | `NBFC Partners` (tblP0qS7vV2xZ5bB8) |
| **Record NBFC Decision** | `nbfc.controller.ts` → `recordDecision()`<br>`/api/nbfc/loan-applications/:id/decision` (POST) | `src/pages/ApplicationDetail.tsx` | POST: `/webhook/loanapplications`<br>POST: `/webhook/Fileauditinglog`<br>POST: `/webhook/notification` | `Loan Applications` (tblN8oQ5sT0vX3yZ6)<br>`File Auditing Log` (tblL1XJnqW3Q15ueZ)<br>`Notifications` (tblmprms0l3yQjVdx) |

**Backend Files:**
- `backend/src/controllers/products.controller.ts`
- `backend/src/controllers/nbfc.controller.ts`
- `backend/src/routes/products.routes.ts`
- `backend/src/routes/nbfc.routes.ts`

**Frontend Files:**
- `src/pages/NewApplication.tsx`
- `src/pages/FormConfiguration.tsx`
- `src/pages/ApplicationDetail.tsx`
- `src/services/api.ts` (API client methods)

---

## Cross-Module Services

| Service/Component | Backend Files | Frontend Files | Purpose |
|------------------|---------------|----------------|---------|
| **n8n Webhook Client** | `backend/src/services/airtable/n8nClient.ts` | N/A | Centralized service for all n8n webhook calls |
| **n8n Endpoints Config** | `backend/src/services/airtable/n8nEndpoints.ts` | N/A | Defines all webhook paths and Airtable table IDs |
| **Data Filtering Service** | `backend/src/services/airtable/dataFilter.service.ts` | N/A | Role-based data filtering |
| **Cache Service** | `backend/src/services/airtable/cache.service.ts` | N/A | 30-minute cache for GET requests |
| **Authentication Middleware** | `backend/src/middleware/auth.middleware.ts` | N/A | JWT token validation |
| **RBAC Middleware** | `backend/src/middleware/rbac.middleware.ts` | N/A | Role-based access control |
| **API Service (Frontend)** | N/A | `src/services/api.ts` | Frontend API client with all endpoint methods |
| **Auth Context** | N/A | `src/contexts/UnifiedAuthProvider.tsx` | Global authentication state |
| **Role Access Hook** | N/A | `src/hooks/useRoleAccess.ts` | Role-based UI access control |
| **Protected Route** | N/A | `src/components/ProtectedRoute.tsx` | Route protection component |
| **Role Guard** | N/A | `src/components/RoleGuard.tsx` | Component-level role protection |

---

## Key Airtable Tables Reference

| Table Name | Table ID | Primary Use |
|------------|----------|-------------|
| **User Accounts** | `tblQ1rT8wW3yA6cC9` | Authentication and user management |
| **Clients** | `tblK8mN3pQvR5sT7u` | DSA partner/client information |
| **KAM Users** | `tblM7nP4rS9tU2vW5` | Key Account Manager profiles |
| **Credit Team Users** | `tblX9yZ2wV4nM6pQ8` | Credit team member profiles |
| **NBFC Partners** | `tblP0qS7vV2xZ5bB8` | NBFC/lender partner information |
| **Loan Applications** | `tblN8oQ5sT0vX3yZ6` | Loan application files with all data |
| **Loan Products** | `tblVukvj8kn5gWBta` | Available loan product configurations |
| **Form Categories** | `tblqCqXV0Hds0t0bH` | Form category groupings |
| **Form Fields** | `tbl5oZ6zI0dc5eutw` | Individual form field definitions |
| **Client Form Mapping** | `tbl70C8uPKmoLkOQJ` | Links clients to form categories/fields |
| **Commission Ledger** | `tblrBWFuPYBI4WWtn` | Commission payout/payin entries |
| **File Auditing Log** | `tblL1XJnqW3Q15ueZ` | Audit trail for all file actions |
| **Notifications** | `tblmprms0l3yQjVdx` | User notifications |
| **Daily Summary Reports** | `tbla3urDb8kCsO0Et` | Generated daily summary reports |
| **Admin Activity Log** | `tbl8qJ3xK5vF2hNpL` | System-wide activity audit log |

---

## n8n Webhook Paths Reference

### POST Webhooks (Create/Update)
- `POSTLOG` - Admin Activity Log
- `POSTCLIENTFORMMAPPING` - Client Form Mapping
- `COMISSIONLEDGER` - Commission Ledger
- `CREDITTEAMUSERS` - Credit Team Users
- `DAILYSUMMARY` - Daily Summary Reports
- `Fileauditinglog` - File Auditing Log
- `FormCategory` - Form Categories
- `FormFields` - Form Fields
- `KAMusers` - KAM Users
- `loanapplications` - Loan Applications (plural for POST)
- `loanproducts` - Loan Products
- `NBFCPartners` - NBFC Partners
- `adduser` - User Accounts
- `Client` - Clients
- `notification` - Notifications
- `email` - Email (Outlook Send a message)

### GET Webhooks (Search/Fetch)
- `adminactivity` - Admin Activity Log
- `clientformmapping` - Client Form Mapping
- `client` - Clients
- `commisionledger` - Commission Ledger
- `creditteamuser` - Credit Team Users
- `dailysummaryreport` - Daily Summary Reports
- `fileauditinglog` - File Auditing Log
- `formcategories` - Form Categories
- `formfields` - Form Fields
- `kamusers` - KAM Users
- `loanapplication` - Loan Applications (singular for GET)
- `loanproducts` - Loan Products
- `nbfcpartners` - NBFC Partners
- `notifications` - Notifications
- `useraccount` - User Accounts

**Base URL:** `https://fixrrahul.app.n8n.cloud/webhook/`

---

## Notes for QA Testing

1. **All endpoints require JWT authentication** except `/api/auth/login`
2. **Role-based filtering** is enforced at the backend level - verify users only see data they're permitted to access
3. **Webhook paths** differ between GET (singular) and POST (plural) for loan applications: `loanapplication` vs `loanapplications`
4. **Status transitions** are validated by state machine - invalid transitions return 400 errors
5. **Mandatory field validation** occurs on application submission - missing required fields return 400 with field list
6. **Commission calculation** is automatic on disbursement: `(disbursedAmount * commissionRate) / 100`
7. **Form versioning** - submitted applications freeze their form config version
8. **All mutating operations** create audit log entries in both File Auditing Log and Admin Activity Log

---

**Last Updated:** 2025-01-27  
**Maintained By:** Development Team

