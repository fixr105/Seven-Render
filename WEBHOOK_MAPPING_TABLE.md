# n8n Webhook Mapping Table
**Generated:** 2025-01-27  
**Purpose:** Complete mapping of Frontend → Backend Controller → n8n Webhook → Airtable Table

---

## Webhook Paths from SEVEN-DASHBOARD-2.json

Based on the n8n workflow JSON, the following webhook paths are defined:

### GET Webhooks (Read Operations)
- `/loanapplication` (singular) - Get Loan Applications - Used for all list/fetch operations
- `/client` - Get Clients
- `/clientformmapping` - Get Client Form Mappings
- `/formcategories` - Get Form Categories
- `/formfields` - Get Form Fields
- `/notifications` - Get Notifications
- `/commisionledger` - Get Commission Ledger
- `/dailysummaryreport` - Get Daily Summary Reports
- `/fileauditinglog` - Get File Audit Log
- `/kamusers` - Get KAM Users
- `/creditteamuser` - Get Credit Team Users
- `/nbfcpartners` - Get NBFC Partners
- `/loanproducts` - Get Loan Products
- `/useraccount` - Get User Accounts

### POST Webhooks (Write Operations)
- `/loanapplications` - Create/Update Loan Applications
- `/Client` - Create/Update Clients
- `/POSTCLIENTFORMMAPPING` - Create/Update Client Form Mappings
- `/FormCategory` - Create/Update Form Categories
- `/FormFields` - Create/Update Form Fields
- `/notification` - Create Notifications
- `/COMISSIONLEDGER` - Create/Update Commission Ledger
- `/DAILYSUMMARY` - Create Daily Summary Reports
- `/Fileauditinglog` - Create File Audit Log entries
- `/KAMusers` - Create/Update KAM Users
- `/CREDITTEAMUSERS` - Create/Update Credit Team Users
- `/NBFCPartners` - Create/Update NBFC Partners
- `/loanproducts` - Create/Update Loan Products
- `/adduser` - Create/Update User Accounts
- `/POSTLOG` - Create Admin Activity Log entries
- `/email` - Send Email (via Microsoft Outlook)

---

## Complete Mapping Table

| Frontend File | Frontend Method | Backend Route | Backend Controller Method | n8nClient Method | n8n Webhook Path (GET) | n8n Webhook Path (POST) | Airtable Table | Notes |
|--------------|----------------|---------------|---------------------------|------------------|------------------------|-------------------------|----------------|-------|
| **LOAN APPLICATIONS** |
| `src/pages/NewApplication.tsx` | `createApplication()` | `POST /loan-applications` | `LoanController.createApplication()` | `postLoanApplication()` | - | `/webhook/loanapplications` (plural) | `Loan Applications` | Line 250: Creates new application with draft/submit |
| `src/pages/NewApplication.tsx` | `fetchFormConfig()` | `GET /client/form-config` | `ClientController.getFormConfig()` | `fetchTable('Client Form Mapping')`<br>`fetchTable('Form Categories')`<br>`fetchTable('Form Fields')` | `/webhook/clientformmapping`<br>`/webhook/formcategories`<br>`/webhook/formfields` | - | `Client Form Mapping`<br>`Form Categories`<br>`Form Fields` | Line 100: Fetches form configuration for client |
| `src/pages/NewApplication.tsx` | `fetchLoanProducts()` | `GET /products/loan-products` | `ProductsController.listLoanProducts()` | `fetchTable('Loan Products')` | `/webhook/loanproducts` | - | `Loan Products` | Line 131: Lists active loan products |
| `src/pages/Applications.tsx` | `listApplications()` | `GET /loan-applications` | `LoanController.listApplications()` | `fetchTable('Loan Application')` | `/webhook/loanapplication` (singular) | - | `Loan Applications` | Lists applications filtered by role |
| `src/pages/ApplicationDetail.tsx` | `fetchApplicationDetails()` | `GET /loan-applications/:id` | `LoanController.getApplication()` | `fetchTable('Loan Application')` | `/webhook/loanapplication` (singular) | - | `Loan Applications` | Line 105: Gets single application |
| `src/pages/ApplicationDetail.tsx` | `fetchQueries()` | `GET /loan-applications/:id/audit-log` | `AuditController.getFileAuditLog()` | `fetchTable('File Auditing Log')` | `/webhook/fileauditinglog` | - | `File Auditing Log` | Line 121: Filters audit log for queries |
| `src/pages/ApplicationDetail.tsx` | `fetchStatusHistory()` | `GET /loan-applications/:id/audit-log` | `AuditController.getFileAuditLog()` | `fetchTable('File Auditing Log')` | `/webhook/fileauditinglog` | - | `File Auditing Log` | Line 137: Filters audit log for status changes |
| `src/pages/ApplicationDetail.tsx` | `handleRaiseQuery()` | `POST /kam/loan-applications/:id/queries`<br>`POST /credit/loan-applications/:id/queries` | `KAMController.raiseQuery()`<br>`CreditController.raiseQuery()` | `postFileAuditLog()` | - | `/webhook/Fileauditinglog` | `File Auditing Log` | Line 150: Creates query entry in audit log |
| `src/pages/ApplicationDetail.tsx` | `handleUpdateStatus()` | `POST /kam/loan-applications/:id/forward-to-credit`<br>`POST /credit/loan-applications/:id/mark-in-negotiation`<br>etc. | `KAMController.forwardToCredit()`<br>`CreditController.markInNegotiation()`<br>etc. | `postLoanApplication()`<br>`postFileAuditLog()` | - | `/webhook/loanapplications` (plural)<br>`/webhook/Fileauditinglog` | `Loan Applications`<br>`File Auditing Log` | Updates status and logs change |
| `src/hooks/useApplications.ts` | `listApplications()` | `GET /loan-applications` | `LoanController.listApplications()` | `fetchTable('Loan Application')` | `/webhook/loanapplication` (singular) | - | `Loan Applications` | Hook for listing applications |
| **CLIENTS** |
| `src/pages/Clients.tsx` | `fetchClients()` | `GET /kam/clients`<br>`GET /credit/clients` | `KAMController.listClients()`<br>`CreditController.listClients()` | `fetchTable('Clients')` | `/webhook/client` | - | `Clients` | Line 79-80: Lists clients based on role |
| `src/pages/Clients.tsx` | `handleCreateClient()` | `POST /kam/clients` | `KAMController.onboardClient()` | `postClient()`<br>`postUserAccount()` | - | `/webhook/Client`<br>`/webhook/adduser` | `Clients`<br>`User Accounts` | Line 161: Creates client and user account |
| `src/pages/FormConfiguration.tsx` | `fetchClients()` | `GET /kam/clients` | `KAMController.listClients()` | `fetchTable('Clients')` | `/webhook/client` | - | `Clients` | Line 165: Lists clients for form config |
| `src/pages/FormConfiguration.tsx` | `handleSaveForm()` | `POST /kam/clients/:id/form-mappings` | `KAMController.createFormMapping()` | `postFormCategory()`<br>`postFormField()`<br>`postClientFormMapping()` | - | `/webhook/FormCategory`<br>`/webhook/FormFields`<br>`/webhook/POSTCLIENTFORMMAPPING` | `Form Categories`<br>`Form Fields`<br>`Client Form Mapping` | Line 269: Creates form configuration |
| `src/pages/FormConfiguration.tsx` | `fetchLoanProducts()` | `GET /products/loan-products` | `ProductsController.listLoanProducts()` | `fetchTable('Loan Products')` | `/webhook/loanproducts` | - | `Loan Products` | Line 190: Lists loan products |
| **FORM CONFIGURATION** |
| `src/pages/ClientForm.tsx` | `fetchFormMappings()` | `GET /public/form-mappings/:clientId` | `ClientController.getPublicFormMappings()` | `fetchTable('Client Form Mapping')` | `/webhook/clientformmapping` | - | `Client Form Mapping` | Line 173: Gets public form mappings |
| `src/pages/ClientForm.tsx` | `fetchFormCategories()` | `GET /form-categories` | `FormCategoryController.listCategories()` | `fetchTable('Form Categories')` | `/webhook/formcategories` | - | `Form Categories` | Line 177: Lists form categories |
| `backend/src/controllers/kam.controller.ts` | `createFormMapping()` | `POST /kam/clients/:id/form-mappings` | `KAMController.createFormMapping()` | `postFormCategory()`<br>`postFormField()`<br>`postClientFormMapping()` | - | `/webhook/FormCategory`<br>`/webhook/FormFields`<br>`/webhook/POSTCLIENTFORMMAPPING` | `Form Categories`<br>`Form Fields`<br>`Client Form Mapping` | Line 841, 858, 883: Bulk form mapping creation |
| `backend/src/controllers/formCategory.controller.ts` | `createCategory()` | `POST /form-categories` | `FormCategoryController.createCategory()` | `postFormCategory()` | - | `/webhook/FormCategory` | `Form Categories` | Creates form category |
| `backend/src/controllers/formCategory.controller.ts` | `updateCategory()` | `PUT /form-categories/:id` | `FormCategoryController.updateCategory()` | `postFormCategory()` | - | `/webhook/FormCategory` | `Form Categories` | Updates form category |
| **COMMISSION LEDGER** |
| `src/pages/Ledger.tsx` | `useLedger()` hook | `GET /client/ledger` | `ClientController.getLedger()` | `fetchTable('Commission Ledger')` | `/webhook/commisionledger` | - | `Commission Ledger` | Gets client ledger (currently placeholder) |
| `src/hooks/useLedger.ts` | `getClientLedger()` | `GET /client/ledger` | `ClientController.getLedger()` | `fetchTable('Commission Ledger')` | `/webhook/commisionledger` | - | `Commission Ledger` | Line 26: Fetches ledger entries |
| `src/hooks/useLedger.ts` | `createPayoutRequest()` | `POST /client/payout-requests` | `ClientController.createPayoutRequest()` | `postCommissionLedger()` | - | `/webhook/COMISSIONLEDGER` | `Commission Ledger` | Line 64: Creates payout request entry |
| `backend/src/controllers/credit.controller.ts` | `markDisbursed()` | `POST /credit/loan-applications/:id/mark-disbursed` | `CreditController.markDisbursed()` | `postCommissionLedger()` | - | `/webhook/COMISSIONLEDGER` | `Commission Ledger` | Line 587: Creates ledger entry on disbursement |
| `backend/src/controllers/credit.controller.ts` | `approvePayoutRequest()` | `POST /credit/payout-requests/:id/approve` | `CreditController.approvePayoutRequest()` | `postCommissionLedger()` | - | `/webhook/COMISSIONLEDGER` | `Commission Ledger` | Line 805: Approves payout and creates entry |
| `backend/src/controllers/ledger.controller.ts` | `createLedgerEntry()` | `POST /ledger/entries` | `LedgerController.createEntry()` | `postCommissionLedger()` | - | `/webhook/COMISSIONLEDGER` | `Commission Ledger` | Creates manual ledger entry |
| **NOTIFICATIONS** |
| `src/hooks/useNotifications.ts` | `getNotifications()` | `GET /notifications` | `NotificationsController.getNotifications()` | `fetchTable('Notifications')` | `/webhook/notifications` | - | `Notifications` | Line 19: Fetches user notifications |
| `backend/src/services/notifications/notification.service.ts` | `createNotification()` | Internal | `NotificationService.createNotification()` | `postNotification()` | - | `/webhook/notification` | `Notifications` | Line 63: Creates notification |
| `backend/src/controllers/notifications.controller.ts` | `markAsRead()` | `PUT /notifications/:id/read` | `NotificationsController.markAsRead()` | `postNotification()` | - | `/webhook/notification` | `Notifications` | Updates notification read status |
| **AUDIT LOG** |
| `backend/src/controllers/audit.controller.ts` | `getFileAuditLog()` | `GET /loan-applications/:id/audit-log` | `AuditController.getFileAuditLog()` | `fetchTable('File Auditing Log')` | `/webhook/fileauditinglog` | - | `File Auditing Log` | Gets audit log for file |
| `backend/src/controllers/queries.controller.ts` | `raiseQuery()` | `POST /loan-applications/:id/queries` | `QueriesController.raiseQuery()` | `postFileAuditLog()` | - | `/webhook/Fileauditinglog` | `File Auditing Log` | Creates query entry |
| `backend/src/services/statusTracking/statusHistory.service.ts` | `recordStatusChange()` | Internal | `StatusHistoryService.recordStatusChange()` | `postFileAuditLog()` | - | `/webhook/Fileauditinglog` | `File Auditing Log` | Line 82: Records status change |
| **ADMIN ACTIVITY LOG** |
| `backend/src/utils/adminLogger.ts` | `logApplicationAction()` | Internal | `AdminLogger.logApplicationAction()` | `postAdminActivityLog()` | - | `/webhook/POSTLOG` | `Admin Activity log` | Line 124: Logs admin actions via POSTLOG |
| **DAILY SUMMARY REPORTS** |
| `backend/src/controllers/reports.controller.ts` | `generateDailySummary()` | `POST /reports/daily-summary` | `ReportsController.generateDailySummary()` | `postDailySummary()` | - | `/webhook/DAILYSUMMARY` | `Daily Summary Reports` | Line 97: Generates daily summary |
| `backend/src/controllers/reports.controller.ts` | `getDailySummaries()` | `GET /reports/daily-summary` | `ReportsController.getDailySummaries()` | `fetchTable('Daily Summary Report')` | `/webhook/dailysummaryreport` | - | `Daily Summary Reports` | Line 124: Lists daily summaries |
| **USER ACCOUNTS** |
| `src/pages/Login.tsx` | `handleLogin()` | `POST /auth/login` | `AuthController.login()` | `getUserAccounts()` | `/webhook/useraccount` | - | `User Accounts` | Authentication uses dedicated webhook |
| `backend/src/services/auth/auth.service.ts` | `authenticateUser()` | Internal | `AuthService.authenticateUser()` | `getUserAccounts()`<br>`fetchTable('Clients')`<br>`fetchTable('KAM Users')`<br>`fetchTable('Credit Team Users')`<br>`fetchTable('NBFC Partners')` | `/webhook/useraccount`<br>`/webhook/client`<br>`/webhook/kamusers`<br>`/webhook/creditteamuser`<br>`/webhook/nbfcpartners` | - | `User Accounts`<br>`Clients`<br>`KAM Users`<br>`Credit Team Users`<br>`NBFC Partners` | Line 29, 96, 118, 128, 137: Fetches user profile data |
| `backend/src/services/auth/auth.service.ts` | `createUserAccount()` | Internal | `AuthService.createUserAccount()` | `postUserAccount()` | - | `/webhook/adduser` | `User Accounts` | Line 150: Creates user account |
| `backend/src/controllers/kam.controller.ts` | `onboardClient()` | `POST /kam/clients` | `KAMController.onboardClient()` | `postUserAccount()` | - | `/webhook/adduser` | `User Accounts` | Line 386: Creates user for new client |
| `backend/src/controllers/users.controller.ts` | `createUser()` | `POST /users` | `UsersController.createUser()` | `postUserAccount()` | - | `/webhook/adduser` | `User Accounts` | Creates user account |
| `backend/src/controllers/users.controller.ts` | `updateUser()` | `PUT /users/:id` | `UsersController.updateUser()` | `postUserAccount()` | - | `/webhook/adduser` | `User Accounts` | Updates user account |
| **KAM USERS** |
| `backend/src/controllers/kam.controller.ts` | `listClients()` | `GET /kam/clients` | `KAMController.listClients()` | `fetchTable('KAM Users')` | `/webhook/kamusers` | - | `KAM Users` | Line 140: Fetches KAM user data |
| `backend/src/controllers/users.controller.ts` | `listKAMUsers()` | `GET /users/kam` | `UsersController.listKAMUsers()` | `fetchTable('KAM Users')` | `/webhook/kamusers` | - | `KAM Users` | Lists KAM users |
| **CREDIT TEAM USERS** |
| `backend/src/controllers/creditTeamUsers.controller.ts` | `createUser()` | `POST /credit-team-users` | `CreditTeamUsersController.createUser()` | `postCreditTeamUser()` | - | `/webhook/CREDITTEAMUSERS` | `Credit Team Users` | Line 116: Creates credit team user |
| `backend/src/controllers/creditTeamUsers.controller.ts` | `updateUser()` | `PUT /credit-team-users/:id` | `CreditTeamUsersController.updateUser()` | `postCreditTeamUser()` | - | `/webhook/CREDITTEAMUSERS` | `Credit Team Users` | Line 178: Updates credit team user |
| `backend/src/controllers/users.controller.ts` | `listCreditUsers()` | `GET /users/credit` | `UsersController.listCreditUsers()` | `fetchTable('Credit Team Users')` | `/webhook/creditteamuser` | - | `Credit Team Users` | Lists credit team users |
| **NBFC PARTNERS** |
| `src/pages/dashboards/NBFCDashboard.tsx` | `listNBFCApplications()` | `GET /nbfc/loan-applications` | `NBFController.listApplications()` | `fetchTable('Loan Application')` | `/webhook/loanapplication` | - | `Loan Applications` | Lists NBFC assigned applications |
| `backend/src/controllers/nbfc.controller.ts` | `recordDecision()` | `POST /nbfc/loan-applications/:id/decision` | `NBFController.recordDecision()` | `postLoanApplication()`<br>`postFileAuditLog()` | - | `/webhook/loanapplications`<br>`/webhook/Fileauditinglog` | `Loan Applications`<br>`File Auditing Log` | Line 191, 193: Records NBFC decision |
| `backend/src/controllers/nbfc.controller.ts` | `createPartner()` | `POST /nbfc/partners` | `NBFController.createPartner()` | `postNBFCPartner()` | - | `/webhook/NBFCPartners` | `NBFC Partners` | Line 281: Creates NBFC partner |
| `backend/src/controllers/nbfc.controller.ts` | `updatePartner()` | `PUT /nbfc/partners/:id` | `NBFController.updatePartner()` | `postNBFCPartner()` | - | `/webhook/NBFCPartners` | `NBFC Partners` | Line 340: Updates NBFC partner |
| `backend/src/controllers/products.controller.ts` | `listNBFCPartners()` | `GET /products/nbfc-partners` | `ProductsController.listNBFCPartners()` | `fetchTable('NBFC Partners')` | `/webhook/nbfcpartners` | - | `NBFC Partners` | Lists NBFC partners |
| **LOAN PRODUCTS** |
| `backend/src/controllers/products.controller.ts` | `listLoanProducts()` | `GET /products/loan-products` | `ProductsController.listLoanProducts()` | `fetchTable('Loan Products')` | `/webhook/loanproducts` | - | `Loan Products` | Lists loan products |
| `backend/src/controllers/products.controller.ts` | `createLoanProduct()` | `POST /products/loan-products` | `ProductsController.createLoanProduct()` | `postLoanProduct()` | - | `/webhook/loanproducts` | `Loan Products` | Creates loan product |
| `backend/src/controllers/products.controller.ts` | `updateLoanProduct()` | `PUT /products/loan-products/:id` | `ProductsController.updateLoanProduct()` | `postLoanProduct()` | - | `/webhook/loanproducts` | `Loan Products` | Updates loan product |
| **EMAIL** |
| `backend/src/controllers/reports.controller.ts` | `generateDailySummary()` | `POST /reports/daily-summary` | `ReportsController.generateDailySummary()` | (via n8n workflow) | - | `/webhook/email` | (Microsoft Outlook) | Email sent via n8n workflow after daily summary creation |

---

## Webhook URL Configuration

All webhook URLs are configured in `backend/src/config/airtable.ts`:

| Webhook Type | Config Key | Default URL | n8n Path |
|-------------|------------|-------------|----------|
| GET - All Tables | `getWebhookUrl` | `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52` | Generic webhook |
| GET - User Accounts | `getUserAccountsUrl` | `https://fixrrahul.app.n8n.cloud/webhook/useraccount` | `/useraccount` |
| POST - Admin Log | `postLogUrl` | `https://fixrrahul.app.n8n.cloud/webhook/POSTLOG` | `/POSTLOG` |
| POST - Client Form Mapping | `postClientFormMappingUrl` | `https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENTFORMMAPPING` | `/POSTCLIENTFORMMAPPING` |
| POST - Commission Ledger | `postCommissionLedgerUrl` | `https://fixrrahul.app.n8n.cloud/webhook/COMISSIONLEDGER` | `/COMISSIONLEDGER` |
| POST - Credit Team Users | `postCreditTeamUsersUrl` | `https://fixrrahul.app.n8n.cloud/webhook/CREDITTEAMUSERS` | `/CREDITTEAMUSERS` |
| POST - Daily Summary | `postDailySummaryUrl` | `https://fixrrahul.app.n8n.cloud/webhook/DAILYSUMMARY` | `/DAILYSUMMARY` |
| POST - File Audit Log | `postFileAuditLogUrl` | `https://fixrrahul.app.n8n.cloud/webhook/Fileauditinglog` | `/Fileauditinglog` |
| POST - Form Category | `postFormCategoryUrl` | `https://fixrrahul.app.n8n.cloud/webhook/FormCategory` | `/FormCategory` |
| POST - Form Fields | `postFormFieldsUrl` | `https://fixrrahul.app.n8n.cloud/webhook/FormFields` | `/FormFields` |
| POST - KAM Users | `postKamUsersUrl` | `https://fixrrahul.app.n8n.cloud/webhook/KAMusers` | `/KAMusers` |
| POST - Loan Applications | `postApplicationsUrl` | `https://fixrrahul.app.n8n.cloud/webhook/loanapplications` | `/loanapplications` (plural) |
| POST - Loan Products | `postLoanProductsUrl` | `https://fixrrahul.app.n8n.cloud/webhook/loanproducts` | `/loanproducts` |
| POST - NBFC Partners | `postNBFCPartnersUrl` | `https://fixrrahul.app.n8n.cloud/webhook/NBFCPartners` | `/NBFCPartners` |
| POST - Add User | `postAddUserUrl` | `https://fixrrahul.app.n8n.cloud/webhook/adduser` | `/adduser` |
| POST - Client | `postClientUrl` | `https://fixrrahul.app.n8n.cloud/webhook/Client` | `/Client` |
| POST - Notification | `postNotificationUrl` | `https://fixrrahul.app.n8n.cloud/webhook/notification` | `/notification` |

**✅ Fixed:** POST webhook for loan applications now uses `/webhook/loanapplications` (plural) for all create/update operations. GET operations use `/webhook/loanapplication` (singular) for all list/fetch operations.

---

## GET Webhook URLs (from webhookConfig.ts)

Individual GET webhooks are configured in `backend/src/config/webhookConfig.ts`:

| Table Name | GET Webhook URL | n8n Path |
|-----------|----------------|----------|
| Admin Activity Log | `https://fixrrahul.app.n8n.cloud/webhook/Adminactivity` | `/Adminactivity` |
| Client Form Mapping | `https://fixrrahul.app.n8n.cloud/webhook/clientformmapping` | `/clientformmapping` |
| Clients | `https://fixrrahul.app.n8n.cloud/webhook/client` | `/client` |
| Commission Ledger | `https://fixrrahul.app.n8n.cloud/webhook/commisionledger` | `/commisionledger` |
| Credit Team Users | `https://fixrrahul.app.n8n.cloud/webhook/creditteamuser` | `/creditteamuser` |
| Daily Summary Report | `https://fixrrahul.app.n8n.cloud/webhook/dailysummaryreport` | `/dailysummaryreport` |
| File Auditing Log | `https://fixrrahul.app.n8n.cloud/webhook/fileauditinglog` | `/fileauditinglog` |
| Form Categories | `https://fixrrahul.app.n8n.cloud/webhook/formcategories` | `/formcategories` |
| Form Fields | `https://fixrrahul.app.n8n.cloud/webhook/formfields` | `/formfields` |
| KAM Users | `https://fixrrahul.app.n8n.cloud/webhook/kamusers` | `/kamusers` |
| Loan Application | `https://fixrrahul.app.n8n.cloud/webhook/loanapplication` | `/loanapplication` |
| Loan Products | `https://fixrrahul.app.n8n.cloud/webhook/loanproducts` | `/loanproducts` |
| NBFC Partners | `https://fixrrahul.app.n8n.cloud/webhook/nbfcpartners` | `/nbfcpartners` |
| Notifications | `https://fixrrahul.app.n8n.cloud/webhook/notifications` | `/notifications` |
| User Accounts | `https://fixrrahul.app.n8n.cloud/webhook/useraccount` | `/useraccount` |

---

## Issues & Discrepancies

### 1. **POST Webhook Path Mismatch**
- **Code uses:** `/webhook/applications` (from `postApplicationsUrl`)
- **n8n JSON shows:** `/loanapplications` (from Webhook11 node)
- **Action:** Verify which path is correct in n8n workflow

### 2. **GET Webhook Path Variations**
- **Code uses:** `/loanapplication` (singular) for GET
- **n8n JSON shows:** `/loanapplications` (plural) for POST
- **Status:** This is intentional - different paths for GET vs POST

### 3. **Email Webhook**
- **n8n JSON shows:** `/email` webhook connected to Microsoft Outlook
- **Code:** No direct email webhook call - email sent via n8n workflow after daily summary POST
- **Status:** Working as designed - email is triggered by n8n workflow, not backend code

### 4. **Case Sensitivity**
- Some webhook paths have inconsistent casing:
  - `/Fileauditinglog` (POST) vs `/fileauditinglog` (GET)
  - `/COMISSIONLEDGER` (POST) vs `/commisionledger` (GET)
  - `/CREDITTEAMUSERS` (POST) vs `/creditteamuser` (GET)
- **Status:** This appears intentional - POST webhooks use uppercase, GET use lowercase

---

## Summary Statistics

- **Total Webhook Paths:** 16 unique paths
- **GET Webhooks:** 15 (one per table)
- **POST Webhooks:** 15 (one per table/operation)
- **Frontend Files Using Webhooks:** 12
- **Backend Controllers:** 15
- **n8nClient Methods:** 15 POST methods + 2 GET methods (fetchTable, getUserAccounts)
- **Airtable Tables:** 15

---

## Notes

1. **Caching:** All GET operations use caching via `cacheService` to reduce webhook calls
2. **Cache Invalidation:** POST operations automatically invalidate relevant caches
3. **Error Handling:** All webhook calls include error handling and logging
4. **Field Mapping:** POST methods ensure only exact fields are sent to match n8n/Airtable schema
5. **Authentication:** User Accounts webhook is used for login authentication
6. **Status Tracking:** Status changes are logged to both Loan Applications and File Auditing Log

---

**Last Updated:** 2025-01-27  
**Maintained By:** Development Team

