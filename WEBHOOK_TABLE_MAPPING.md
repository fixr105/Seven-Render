# Webhook Table Mapping - Function to Tables

This document maps each function/component to the specific tables it needs from individual GET webhooks.

## Table Names (as provided):
1. Admin Activity Log
2. Client Form Mapping
3. Clients
4. Commission Ledger
5. Credit Team Users
6. Daily Summary Report
7. File Auditing Log
8. Form Categories
9. Form Fields
10. KAM Users
11. Loan Application
12. Loan Products
13. NBFC Partners
14. Notifications
15. User Accounts

---

## Frontend Hooks & Components

### 1. `useWebhookApplications()` 
**Location**: `src/hooks/useWebhookData.ts`
**Current**: Fetches all data, filters for Loan Applications
**Needs**:
- ✅ **Loan Application**

### 2. `useUnifiedApplications()`
**Location**: `src/hooks/useUnifiedApplications.ts`
**Current**: Combines webhook + database data for applications
**Needs**:
- ✅ **Loan Application**
- ✅ **Clients** (for client name/company_name)
- ✅ **Loan Products** (for loan product name/details)

### 3. `useApplications()` 
**Location**: `src/hooks/useApplications.ts`
**Current**: Uses API service (backend), which may use webhook
**Needs** (via backend):
- ✅ **Loan Application**
- ✅ **Clients** (for client info)
- ✅ **Loan Products** (for product info)

### 4. `useLedger()`
**Location**: `src/hooks/useLedger.ts`
**Current**: Uses API service for ledger data
**Needs** (via backend):
- ✅ **Commission Ledger**

### 5. `useNotifications()`
**Location**: `src/hooks/useNotifications.ts`
**Current**: Uses API service for notifications
**Needs** (via backend):
- ✅ **Notifications**

### 6. `ClientDashboard`
**Location**: `src/pages/dashboards/ClientDashboard.tsx`
**Current**: Uses `useApplications()` and `useLedger()`
**Needs**:
- ✅ **Loan Application** (via useApplications)
- ✅ **Commission Ledger** (via useLedger)

### 7. `KAMDashboard`
**Location**: `src/pages/dashboards/KAMDashboard.tsx`
**Current**: Uses `useApplications()` and `apiService.listClients()`
**Needs**:
- ✅ **Loan Application** (via useApplications)
- ✅ **Clients** (via apiService)

### 8. `CreditDashboard`
**Location**: `src/pages/dashboards/CreditDashboard.tsx`
**Current**: Uses `useApplications()` and `useLedger()`
**Needs**:
- ✅ **Loan Application** (via useApplications)
- ✅ **Commission Ledger** (via useLedger - for payout requests)

### 9. `NBFCDashboard`
**Location**: `src/pages/dashboards/NBFCDashboard.tsx`
**Current**: Uses `apiService.listNBFCApplications()`
**Needs**:
- ✅ **Loan Application** (filtered by assigned NBFC)

### 10. `Applications` Page
**Location**: `src/pages/Applications.tsx`
**Current**: Uses `useUnifiedApplications()`
**Needs**:
- ✅ **Loan Application**
- ✅ **Clients**
- ✅ **Loan Products**

### 11. `ApplicationDetail` Page
**Location**: `src/pages/ApplicationDetail.tsx`
**Current**: Uses Supabase directly, but may need webhook data
**Needs**:
- ✅ **Loan Application**
- ✅ **File Auditing Log** (for audit trail)
- ✅ **Clients** (for client info)
- ✅ **Loan Products** (for product info)

### 12. `Clients` Page
**Location**: `src/pages/Clients.tsx`
**Current**: Uses Supabase directly
**Needs**:
- ✅ **Clients**
- ✅ **KAM Users** (for KAM assignment)
- ✅ **Loan Application** (for application count per client)

### 13. `Ledger` Page
**Location**: `src/pages/Ledger.tsx`
**Current**: Uses `useLedger()`
**Needs**:
- ✅ **Commission Ledger**

### 14. `Reports` Page
**Location**: `src/pages/Reports.tsx`
**Needs**:
- ✅ **Daily Summary Report**
- ✅ **Loan Application** (for statistics)
- ✅ **Commission Ledger** (for financial reports)

### 15. `Settings` Page
**Location**: `src/pages/Settings.tsx`
**Needs**:
- ✅ **Form Categories**
- ✅ **Form Fields**
- ✅ **Client Form Mapping**

---

## Backend Controllers & Services

### 1. `auth.service.ts` - Login
**Location**: `backend/src/services/auth/auth.service.ts`
**Current**: Uses `getUserAccounts()` (dedicated webhook)
**Needs**:
- ✅ **User Accounts** (already using dedicated webhook - keep as is)

### 2. `users.controller.ts` - User Management
**Location**: `backend/src/controllers/users.controller.ts`
**Current**: Uses `getAllData()` to get User Accounts
**Needs**:
- ✅ **User Accounts**

### 3. `loan.controller.ts` - Loan Applications
**Location**: `backend/src/controllers/loan.controller.ts`
**Current**: Uses `getAllData()` to get Loan Applications
**Needs**:
- ✅ **Loan Application**
- ✅ **Clients** (for client info)
- ✅ **Loan Products** (for product info)

### 4. `client.controller.ts` - Client Management
**Location**: `backend/src/controllers/client.controller.ts`
**Current**: Uses `getAllData()` to get Clients
**Needs**:
- ✅ **Clients**
- ✅ **KAM Users** (for KAM assignment)
- ✅ **Loan Application** (for stats)

### 5. `ledger.controller.ts` - Commission Ledger
**Location**: `backend/src/controllers/ledger.controller.ts`
**Current**: Uses `getAllData()` to get Commission Ledger
**Needs**:
- ✅ **Commission Ledger**

### 6. `notifications.controller.ts` - Notifications
**Location**: `backend/src/controllers/notifications.controller.ts`
**Current**: Uses `getAllData()` to get Notifications
**Needs**:
- ✅ **Notifications**

### 7. `kam.controller.ts` - KAM Management
**Location**: `backend/src/controllers/kam.controller.ts`
**Current**: Uses `getAllData()` to get KAM Users and Clients
**Needs**:
- ✅ **KAM Users**
- ✅ **Clients** (for managed clients)
- ✅ **Loan Application** (for client stats)

### 8. `credit.controller.ts` - Credit Team
**Location**: `backend/src/controllers/credit.controller.ts`
**Current**: Uses `getAllData()` to get Credit Team Users
**Needs**:
- ✅ **Credit Team Users**

### 9. `nbfc.controller.ts` - NBFC Partners
**Location**: `backend/src/controllers/nbfc.controller.ts`
**Current**: Uses `getAllData()` to get NBFC Partners
**Needs**:
- ✅ **NBFC Partners**
- ✅ **Loan Application** (for assigned applications)

### 10. `products.controller.ts` - Loan Products
**Location**: `backend/src/controllers/products.controller.ts`
**Current**: Uses `getAllData()` to get Loan Products
**Needs**:
- ✅ **Loan Products**

### 11. `formCategory.controller.ts` - Form Configuration
**Location**: `backend/src/controllers/formCategory.controller.ts`
**Current**: Uses `getAllData()` to get Form Categories and Fields
**Needs**:
- ✅ **Form Categories**
- ✅ **Form Fields**
- ✅ **Client Form Mapping**

### 12. `reports.controller.ts` - Reports
**Location**: `backend/src/controllers/reports.controller.ts`
**Current**: Uses `getAllData()` to get Daily Summary Reports
**Needs**:
- ✅ **Daily Summary Report**
- ✅ **Loan Application** (for statistics)
- ✅ **Commission Ledger** (for financial data)

### 13. `audit.controller.ts` - Audit Logs
**Location**: `backend/src/controllers/audit.controller.ts`
**Current**: Uses `getAllData()` to get File Audit Log and Admin Activity Log
**Needs**:
- ✅ **File Auditing Log**
- ✅ **Admin Activity Log**

### 14. `creditTeamUsers.controller.ts` - Credit Team Users
**Location**: `backend/src/controllers/creditTeamUsers.controller.ts`
**Current**: Uses `getAllData()` to get Credit Team Users
**Needs**:
- ✅ **Credit Team Users**

---

## Summary by Table Usage

### Most Used Tables:
1. **Loan Application** - Used by: Applications, Dashboards, Backend loan controller, Reports
2. **Clients** - Used by: Applications, Dashboards, Client management, KAM management
3. **Commission Ledger** - Used by: Ledger pages, Credit dashboard, Reports
4. **Loan Products** - Used by: Applications (for product info)

### Medium Usage:
5. **User Accounts** - Used by: Auth service, User management
6. **Notifications** - Used by: Notifications hook
7. **KAM Users** - Used by: Client management, KAM controller
8. **Credit Team Users** - Used by: Credit controller
9. **NBFC Partners** - Used by: NBFC dashboard, NBFC controller

### Specialized Tables:
10. **Form Categories** - Used by: Settings, Form configuration
11. **Form Fields** - Used by: Settings, Form configuration
12. **Client Form Mapping** - Used by: Settings, Form configuration
13. **File Auditing Log** - Used by: Application Detail, Audit controller
14. **Admin Activity Log** - Used by: Audit controller
15. **Daily Summary Report** - Used by: Reports page, Reports controller

---

## Next Steps

1. ✅ **Mapping Complete** - All functions mapped to required tables
2. ⏳ **Wait for Webhook URLs** - User will provide individual webhook URLs for each table
3. ⏳ **Wait for Field Mappings** - User will provide field names for each table
4. ⏳ **Implementation** - Replace single GET webhook with individual table webhooks

