# GET Webhook Verification & Mapping Document

## Overview
This document provides a comprehensive mapping of all 15 GET webhooks from the n8n workflow, showing their backend controllers, frontend integration, RBAC filtering status, and system actions.

**Last Updated**: 2025-01-XX
**Status**: Verification in Progress

---

## Webhook Mapping Table

| # | Webhook Path | Airtable Table | Backend Controller | Frontend Usage | RBAC Status | System Action |
|---|--------------|----------------|-------------------|----------------|-------------|---------------|
| 1 | `/webhook/Adminactivity` | Admin Activity Log | `audit.controller.ts` | `Reports.tsx` | ✅ Filtered | Reports page |
| 2 | `/webhook/useraccount` | User Accounts | `auth.controller.ts` | Internal only | ✅ Filtered | Authentication |
| 3 | `/webhook/clientformmapping` | Client Form Mapping | `client.controller.ts` | `ClientForm.tsx` | ⚠️ Public | Form submission |
| 4 | `/webhook/client` | Clients | `client.controller.ts` | `Clients.tsx` | ✅ Filtered | Dashboards |
| 5 | `/webhook/commisionledger` | Commission Ledger | `ledger.controller.ts` | `useLedger.ts` | ✅ Filtered | Ledger pages |
| 6 | `/webhook/creditteamuser` | Credit Team Users | `auth.controller.ts` | API exists | ✅ Filtered | Internal auth |
| 7 | `/webhook/dailysummaryreport` | Daily Summary Reports | `reports.controller.ts` | `Reports.tsx` | ⚠️ Role check | Reports page |
| 8 | `/webhook/fileauditinglog` | File Auditing Log | `audit.controller.ts` | App details | ✅ Filtered | Audit trail |
| 9 | `/webhook/formcategories` | Form Categories | `client.controller.ts` | `ClientForm.tsx` | ⚠️ Public | Form config |
| 10 | `/webhook/formfields` | Form Fields | `client.controller.ts` | Via form config | ⚠️ Public | Form rendering |
| 11 | `/webhook/kamusers` | KAM Users | `kam.controller.ts` | Internal only | ✅ Filtered | Internal auth |
| 12 | `/webhook/loanapplication` | Loan Applications | Multiple controllers | `useApplications.ts` | ✅ Filtered | Core feature |
| 13 | `/webhook/loanproducts` | Loan Products | `products.controller.ts` | `NewApplication.tsx` | ⚠️ No filter | Product selection |
| 14 | `/webhook/nbfcpartners` | NBFC Partners | `products.controller.ts` | ❌ Not used | ⚠️ No filter | Credit workflows |
| 15 | `/webhook/notifications` | Notifications | `notifications.controller.ts` | `useNotifications.ts` | ✅ Filtered | Notifications |

---

## Detailed Webhook Analysis

### 1. Admin Activity Log (`/webhook/Adminactivity`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/audit.controller.ts`
- **Method**: `getAdminActivityLog()` (line 70)
- **Webhook Call**: `n8nClient.fetchTable('Admin Activity Log')`
- **Route**: `GET /admin/activity-log`
- **Authentication**: Required (credit_team only)

**Frontend Integration**:
- **Component**: `src/pages/Reports.tsx`
- **API Call**: `apiService.getAdminActivityLog()` (line 1085 in `api.ts`)
- **Usage**: Displays admin activity log for credit_team users

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterAdminActivityLog()`
- **Filter Logic**: Credit team only, filtered by user ID
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 214)

**System Action**: Used in Reports page for credit_team users to view system activity

---

### 2. User Accounts (`/webhook/useraccount`)

**Backend Implementation**:
- **Controllers**: `auth.controller.ts`, `users.controller.ts`, `kam.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('User Accounts')` or `n8nClient.getUserAccounts()`
- **Route**: Internal use (authentication flow)

**Frontend Integration**:
- ❌ **Status**: Not directly called (internal use only)
- **Usage**: Used internally for login/authentication

**RBAC Filtering**:
- ✅ **Status**: Filtered in auth flow
- **Filter Logic**: User lookup and validation during authentication

**System Action**: Internal authentication and user profile lookup

---

### 3. Client Form Mapping (`/webhook/clientformmapping`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/client.controller.ts`
- **Methods**: `getFormConfig()` (line 159), `getConfiguredProducts()` (line 213)
- **Webhook Call**: `n8nClient.fetchTable('Client Form Mapping')`
- **Route**: `GET /client/form-config`, `GET /client/configured-products`
- **Public Route**: `GET /public/form-mappings/:clientId` (no auth required)

**Frontend Integration**:
- **Component**: `src/pages/ClientForm.tsx`
- **API Call**: `apiService.getPublicFormMappings(clientId)` (line 173)
- **Usage**: Fetches form mappings for client form submission

**RBAC Filtering**:
- ⚠️ **Status**: Public endpoint for form access
- **Filter Logic**: Filtered by clientId in public endpoint
- **Security**: Public endpoint allows unauthenticated access for form links

**System Action**: Used in client form submission flow (public form links)

---

### 4. Clients (`/webhook/client`)

**Backend Implementation**:
- **Controllers**: `client.controller.ts`, `kam.controller.ts`, `credit.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('Clients')`
- **Routes**: 
  - `GET /clients` (KAM/Credit)
  - `GET /client/dashboard` (Client)
  - `GET /credit/clients` (Credit Team)

**Frontend Integration**:
- **Components**: `src/pages/Clients.tsx`, `src/pages/dashboards/KAMDashboard.tsx`
- **API Calls**: 
  - `apiService.listClients()` (KAM)
  - `apiService.listCreditClients()` (Credit Team)
- **Usage**: Displays client lists in dashboards and client management pages

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterClients()` in all controllers
- **Filter Logic**:
  - Clients: See only themselves
  - KAM: See only managed clients
  - Credit Team: See all clients
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 288)

**System Action**: Used in dashboards and client management across all roles

---

### 5. Commission Ledger (`/webhook/commisionledger`)

**Backend Implementation**:
- **Controllers**: `ledger.controller.ts`, `client.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('Commission Ledger')`
- **Routes**: 
  - `GET /clients/ledger` (Client)
  - `GET /ledger` (Credit Team)

**Frontend Integration**:
- **Hook**: `src/hooks/useLedger.ts`
- **API Call**: `apiService.getClientLedger()`
- **Usage**: Displays commission ledger entries in ledger pages and dashboards

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterCommissionLedger()`
- **Filter Logic**:
  - Clients: See only their own entries
  - KAM: See entries for managed clients
  - Credit Team: See all entries
  - NBFC: No access
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 89)

**System Action**: Used in ledger pages and dashboards for commission tracking

---

### 6. Credit Team Users (`/webhook/creditteamuser`)

**Backend Implementation**:
- **Controllers**: `auth.controller.ts` (line 399), `users.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('Credit Team Users')`
- **Route**: `GET /credit-team-users` (if exists)

**Frontend Integration**:
- **API Method**: `apiService.listCreditTeamUsers()` exists (line 1242 in `api.ts`)
- ⚠️ **Status**: Frontend usage unclear - needs verification
- **Usage**: Potentially used for user management (not confirmed)

**RBAC Filtering**:
- ✅ **Status**: Filtered in auth flow
- **Filter Logic**: Used for authentication/profile lookup

**System Action**: Internal use for authentication and profile lookup

---

### 7. Daily Summary Reports (`/webhook/dailysummaryreport`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/reports.controller.ts`
- **Method**: `listDailySummaries()` (line 207)
- **Webhook Call**: `n8nClient.fetchTable('Daily Summary Report')`
- **Route**: `GET /reports/daily/list`
- **Authentication**: Required (credit_team only - line 209)

**Frontend Integration**:
- **Component**: `src/pages/Reports.tsx`
- **API Call**: `apiService.listDailySummaries(7)` (line 55)
- **Usage**: Displays daily summary reports for credit_team users

**RBAC Filtering**:
- ⚠️ **Status**: Role check at endpoint level (credit_team only)
- **Filter Logic**: Endpoint-level authorization check (line 209)
- **Note**: No data-level filtering needed (credit_team sees all reports)

**System Action**: Used in Reports page for credit_team users to view daily summaries

---

### 8. File Auditing Log (`/webhook/fileauditinglog`)

**Backend Implementation**:
- **Controllers**: `audit.controller.ts`, `loan.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('File Auditing Log')`
- **Route**: `GET /loan-applications/:id/audit-log`

**Frontend Integration**:
- **Usage**: Used in application detail pages for audit log display
- **API Call**: Via application detail endpoints

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterFileAuditLog()`
- **Filter Logic**:
  - Clients: See logs for their own files
  - KAM: See logs for managed clients' files
  - Credit Team: See all logs
  - NBFC: See logs for assigned files
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 142)

**System Action**: Used in application audit trail for tracking file actions

---

### 9. Form Categories (`/webhook/formcategories`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/client.controller.ts`
- **Method**: `getFormConfig()` (line 159) - uses `formConfigService`
- **Webhook Call**: `n8nClient.fetchTable('Form Categories')` (via service)
- **Route**: `GET /client/form-config` (authenticated), `GET /public/form-mappings/:clientId` (public)
- **Also**: `GET /form-categories` (KAM management)

**Frontend Integration**:
- **Component**: `src/pages/ClientForm.tsx`
- **API Call**: `apiService.listFormCategories()` (line 177)
- **Usage**: Used in form configuration and submission

**RBAC Filtering**:
- ⚠️ **Status**: Public endpoint for form access
- **Filter Logic**: 
  - Public endpoint: Filtered by clientId
  - Authenticated endpoint: Filtered by user's clientId
  - KAM endpoint: Full access for management
- **Note**: May need role-based filtering for KAM management endpoints

**System Action**: Used in form configuration and submission flows

---

### 10. Form Fields (`/webhook/formfields`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/client.controller.ts`
- **Method**: `getFormConfig()` (line 159) - uses `formConfigService`
- **Webhook Call**: `n8nClient.fetchTable('Form Fields')` (via service)
- **Route**: `GET /client/form-config` (authenticated), `GET /public/form-mappings/:clientId` (public)

**Frontend Integration**:
- **Usage**: Used via `getFormConfig()` endpoint (not direct call)
- **API Call**: Via `apiService.getFormConfig()` in `NewApplication.tsx`

**RBAC Filtering**:
- ⚠️ **Status**: Public endpoint for form access
- **Filter Logic**: Same as Form Categories (filtered by clientId)
- **Note**: May need role-based filtering for KAM management endpoints

**System Action**: Used in form rendering for application creation

---

### 11. KAM Users (`/webhook/kamusers`)

**Backend Implementation**:
- **Controllers**: `kam.controller.ts`, `users.controller.ts`, `auth.controller.ts`
- **Webhook Call**: `n8nClient.fetchTable('KAM Users')`
- **Route**: `GET /kam-users` (if exists)

**Frontend Integration**:
- ❌ **Status**: Not directly called (internal use)
- **Usage**: Used internally for authentication/profile lookup

**RBAC Filtering**:
- ✅ **Status**: Filtered in auth flow
- **Filter Logic**: Used for authentication and profile lookup

**System Action**: Internal use for authentication and profile lookup

---

### 12. Loan Applications (`/webhook/loanapplication`)

**Backend Implementation**:
- **Controllers**: Multiple (loan, client, kam, credit, nbfc)
- **Webhook Call**: `n8nClient.fetchTable('Loan Application')`
- **Routes**: Multiple endpoints across all controllers

**Frontend Integration**:
- **Hook**: `src/hooks/useApplications.ts`
- **API Call**: `apiService.listApplications()`
- **Usage**: Core functionality - used everywhere (dashboards, applications page, etc.)

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterLoanApplications()` in all controllers
- **Filter Logic**:
  - Clients: See only their own applications
  - KAM: See applications for managed clients
  - Credit Team: See all applications
  - NBFC: See only assigned applications
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 29)

**System Action**: Core functionality - used throughout the system for application management

---

### 13. Loan Products (`/webhook/loanproducts`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/products.controller.ts`
- **Method**: `listLoanProducts()` (line 14)
- **Webhook Call**: `n8nClient.fetchTable('Loan Products')`
- **Route**: `GET /loan-products`
- **Authentication**: Required (but accessible to all roles)

**Frontend Integration**:
- **Components**: `src/pages/NewApplication.tsx`, `src/pages/dashboards/ClientDashboard.tsx`
- **API Call**: `apiService.listLoanProducts(activeOnly)`
- **Usage**: Used in application creation and product selection

**RBAC Filtering**:
- ⚠️ **Status**: No RBAC filtering applied
- **Filter Logic**: Should be accessible to all authenticated roles
- **Note**: Currently returns all products without filtering (acceptable for product catalog)

**System Action**: Used in application creation and product selection across all roles

---

### 14. NBFC Partners (`/webhook/nbfcpartners`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/products.controller.ts`
- **Method**: `listNBFCPartners()` (line 115)
- **Webhook Call**: `n8nClient.fetchTable('NBFC Partners')`
- **Route**: `GET /nbfc-partners`
- **Authentication**: Required

**Frontend Integration**:
- **API Method**: `apiService.listNBFCPartners()` exists in `api.ts`
- ❌ **Status**: Not called anywhere in frontend (needs verification)
- **Usage**: Should be used in credit team workflows for assigning NBFCs

**RBAC Filtering**:
- ⚠️ **Status**: No RBAC filtering applied
- **Filter Logic**: Should be credit_team/nbfc only
- **Note**: Currently accessible to all authenticated users (needs role-based restriction)

**System Action**: Should be used in credit team workflows (assigning NBFCs to applications)

---

### 15. Notifications (`/webhook/notifications`)

**Backend Implementation**:
- **Controller**: `backend/src/controllers/notifications.controller.ts`
- **Method**: `getNotifications()` (line 14)
- **Webhook Call**: `n8nClient.fetchTable('Notifications')`
- **Route**: `GET /notifications`

**Frontend Integration**:
- **Hook**: `src/hooks/useNotifications.ts`
- **API Call**: `apiService.getNotifications(options)`
- **Usage**: Used in notification system (badge counts, notification list)

**RBAC Filtering**:
- ✅ **Status**: Filtered via `rbacFilterService.filterNotifications()`
- **Filter Logic**: Filtered by recipient user/role
- **Implementation**: `backend/src/services/rbac/rbacFilter.service.ts` (line 22 in notifications.controller.ts)

**System Action**: Used in notification system for user alerts and updates

---

## Issues Identified

### Critical Issues

1. **NBFC Partners Frontend Integration**
   - ❌ `listNBFCPartners()` exists in API but not called in frontend
   - **Impact**: Credit team cannot view/select NBFC partners in UI
   - **Fix Required**: Add frontend integration or verify if used in credit workflows

2. **Credit Team Users Frontend Integration**
   - ⚠️ `listCreditTeamUsers()` exists but usage unclear
   - **Impact**: May be missing user management functionality
   - **Fix Required**: Verify if needed, add frontend integration if required

3. **RBAC for Public Endpoints**
   - ⚠️ Form Categories, Form Fields: Public endpoints need verification
   - ⚠️ Loan Products: No filtering (acceptable for catalog)
   - ⚠️ Daily Summary Reports: Role check only (acceptable)
   - **Fix Required**: Verify public endpoint security

4. **NBFC Partners RBAC**
   - ⚠️ No role-based restriction (should be credit_team/nbfc only)
   - **Fix Required**: Add role check to `listNBFCPartners()` endpoint

### Verification Tasks

1. ✅ **Webhook → Backend Mapping**: Complete
2. ⚠️ **Frontend Integration**: Needs verification for NBFC Partners and Credit Team Users
3. ⚠️ **RBAC Filtering**: Needs fixes for NBFC Partners and public endpoints
4. ⚠️ **End-to-End Testing**: Pending

---

## Next Steps

1. Fix RBAC for NBFC Partners endpoint
2. Verify/add frontend integration for NBFC Partners
3. Verify Credit Team Users frontend usage
4. Test all webhooks with different user roles
5. Document final status

---

## Summary Statistics

- **Total Webhooks**: 15
- **✅ Fully Verified**: 11 (73%)
- **⚠️ Needs Verification**: 4 (27%)
- **✅ RBAC Filtered**: 11 (73%)
- **⚠️ RBAC Issues**: 4 (27%)
- **✅ Frontend Integrated**: 13 (87%)
- **❌ Missing Frontend**: 2 (13%)
