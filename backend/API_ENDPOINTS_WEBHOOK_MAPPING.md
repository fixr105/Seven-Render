# API Endpoints & Webhook Mapping Documentation

This document provides a comprehensive list of all API endpoints, the n8n webhooks they call, and the step-by-step flow for each function.

**Base URL**: `https://fixrrahul.app.n8n.cloud/webhook/`

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Client Endpoints](#client-endpoints)
3. [Loan Application Endpoints](#loan-application-endpoints)
4. [KAM (Key Account Manager) Endpoints](#kam-endpoints)
5. [Credit Team Endpoints](#credit-team-endpoints)
6. [NBFC Endpoints](#nbfc-endpoints)
7. [Commission Ledger Endpoints](#commission-ledger-endpoints)
8. [Reports Endpoints](#reports-endpoints)
9. [Queries Endpoints](#queries-endpoints)
10. [Audit & Activity Log Endpoints](#audit--activity-log-endpoints)
11. [Products & Partners Endpoints](#products--partners-endpoints)
12. [Notifications Endpoints](#notifications-endpoints)
13. [Users & Accounts Endpoints](#users--accounts-endpoints)
14. [Form Categories Endpoints](#form-categories-endpoints)
15. [Documents Endpoints](#documents-endpoints)
16. [AI Endpoints](#ai-endpoints)
17. [Public Endpoints](#public-endpoints)

---

## Authentication Endpoints

### POST `/auth/login`
**Role**: Public (no authentication required)

**Webhooks Called**:
1. **GET** `/webhook/useraccount` → Airtable: `User Accounts`
   - Fetches all user accounts to validate credentials
   - Timeout: 5 seconds

**Steps**:
1. Validate email and password input using `loginSchema`
2. Fetch all user accounts via `n8nClient.fetchTable('User Accounts')` → GET `/webhook/useraccount`
3. Find user by email (case-insensitive match on `Username` field)
4. Validate account status is 'Active'
5. Validate password (supports both hashed bcrypt and plaintext)
6. Normalize and validate user role (client, kam, credit_team, nbfc)
7. **Background (non-blocking)**: Fetch role-specific data:
   - **Client**: GET `/webhook/client` → Find matching Client record
   - **KAM**: GET `/webhook/kamusers` → Find matching KAM User record
   - **Credit**: GET `/webhook/creditteamuser` → Find matching Credit Team User record
   - **NBFC**: GET `/webhook/nbfcpartners` → Find matching NBFC Partner record
8. **Background (non-blocking)**: POST `/webhook/adduser` → Update `Last Login` timestamp
9. Generate JWT token with user info (userId, email, role, clientId, kamId, nbfcId)
10. Return user object and token

**Response**:
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "role", "name", "clientId", "kamId", "nbfcId" },
    "token": "jwt_token_string"
  }
}
```

---

### GET `/auth/me`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/kamusers` → Airtable: `KAM Users` (if role is KAM)
2. **GET** `/webhook/creditteamuser` → Airtable: `Credit Team Users` (if role is Credit)

**Steps**:
1. Verify user is authenticated (from JWT token)
2. If role is KAM: Fetch KAM Users table to get name
3. If role is Credit: Fetch Credit Team Users table to get name
4. Return user info with name

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "kam",
    "clientId": null,
    "kamId": "kam_id",
    "nbfcId": null,
    "name": "User Name"
  }
}
```

---

## Client Endpoints

### GET `/client/dashboard`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
3. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Fetch Loan Applications table
3. Apply RBAC filter (only applications where `Client` matches user's `clientId`)
4. Fetch Commission Ledger table
5. Apply RBAC filter (only entries where `Client` matches user's `clientId`)
6. Calculate running balance from ledger entries
7. Fetch File Auditing Log table
8. Filter audit logs for client's files
9. Aggregate metrics:
   - Applications by status (Draft, Under Review, Query Pending, etc.)
   - Current commission balance
   - Pending queries count
   - Recent activity
10. Return dashboard data

**Response**:
```json
{
  "success": true,
  "data": {
    "applications": { "draft": 2, "underReview": 1, "queryPending": 0, ... },
    "commissionBalance": 50000.00,
    "pendingQueries": 1,
    "recentActivity": [...]
  }
}
```

---

### GET `/client/form-config`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/clientformmapping` → Airtable: `Client Form Mapping`
2. **GET** `/webhook/formcategories` → Airtable: `Form Categories`
3. **GET** `/webhook/formfields` → Airtable: `Form Fields`
4. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications` (if `applicationId` provided)

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. If `applicationId` query param provided:
   - Fetch Loan Applications to get `Form Config Version`
3. Fetch Client Form Mapping table
4. Filter mappings where `Client` matches user's `clientId`
5. Fetch Form Categories table
6. Fetch Form Fields table
7. Use `formConfigService.getClientDashboardConfig()` to:
   - Filter categories/fields based on client's enabled modules
   - Filter by product ID if provided
   - Filter by version if provided
8. Return filtered form configuration

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "CAT001",
      "categoryName": "Personal Information",
      "fields": [
        { "fieldId": "FIELD001", "label": "Full Name", "type": "text", "isRequired": true, ... }
      ]
    }
  ]
}
```

---

## Loan Application Endpoints

### POST `/loan-applications`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/clientformmapping` → Airtable: `Client Form Mapping`
2. **GET** `/webhook/formcategories` → Airtable: `Form Categories`
3. **GET** `/webhook/formfields` → Airtable: `Form Fields`
4. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications` (duplicate detection)
5. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (create record)
6. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (log creation)
7. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log` (log admin activity)

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Extract application data (productId, applicantName, requestedLoanAmount, formData, documentUploads)
3. **Duplicate Detection**: Check for existing applications with same PAN (if provided)
4. **Form Validation**: Fetch form config and validate form data (soft validation - warnings only)
5. Generate File ID: `SF{timestamp}`
6. Generate Application ID: `APP-{timestamp}-{random}`
7. Determine status: `DRAFT` if `saveAsDraft=true`, else `UNDER_KAM_REVIEW`
8. Use `loanWorkflowService.createLoanApplication()`:
   - Create loan application record via POST `/webhook/loanapplications`
   - Log to File Auditing Log via POST `/webhook/Fileauditinglog`
   - Log to Admin Activity Log via POST `/webhook/POSTLOG`
   - Send notification to assigned KAM (if not draft)
9. Return application ID, file ID, status, and any warnings

**Response**:
```json
{
  "success": true,
  "data": {
    "loanApplicationId": "APP-1234567890-abc123",
    "fileId": "SF12345678",
    "status": "DRAFT",
    "warnings": ["Warning: Similar application exists..."],
    "duplicateFound": null
  }
}
```

---

### GET `/loan-applications`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Applications table
3. Apply RBAC filtering:
   - **Client**: Only applications where `Client` matches user's `clientId`
   - **KAM**: Only applications for managed clients
   - **NBFC**: Only applications where `Assigned NBFC` matches user's `nbfcId`
   - **Credit**: All applications
4. Apply query filters (status, clientId, nbfcId, productId, dateFrom, dateTo)
5. Return filtered applications

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "app_id",
      "fileId": "SF12345678",
      "client": "client_id",
      "applicantName": "John Doe",
      "product": "product_id",
      "requestedAmount": "500000",
      "status": "UNDER_KAM_REVIEW",
      ...
    }
  ]
}
```

---

### GET `/loan-applications/:id`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access to this application)
5. Fetch File Auditing Log table
6. Filter audit logs for this file ID
7. Parse Documents field (format: `fieldId:url|fileName,fieldId:url|fileName`)
8. Return application details with audit log

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "app_id",
    "fileId": "SF12345678",
    "client": "client_id",
    "applicantName": "John Doe",
    "status": "UNDER_KAM_REVIEW",
    "documents": [
      { "fieldId": "FIELD001", "url": "https://...", "fileName": "document.pdf" }
    ],
    "auditLog": [...]
  }
}
```

---

### POST `/loan-applications/:id/form`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update record)

**Steps**:
1. Verify user role is 'client'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to user's clientId
5. Update `Form Data` field (JSON) with new form data
6. Update application via POST `/webhook/loanapplications`
7. Return success

---

### POST `/loan-applications/:id/submit`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'client'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to user's clientId
5. Verify status is `DRAFT`
6. Validate mandatory fields (strict validation for submission)
7. Update status to `UNDER_KAM_REVIEW`
8. Update `Submitted Date` to current timestamp
9. Update application via POST `/webhook/loanapplications`
10. Log to File Auditing Log and Admin Activity Log
11. Send notification to assigned KAM
12. Return success

---

### POST `/loan-applications/:id/withdraw`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'client'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to user's clientId
5. Verify status allows withdrawal (not already WITHDRAWN, CLOSED, or DISBURSED)
6. Update status to `WITHDRAWN`
7. Update application via POST `/webhook/loanapplications`
8. Log to File Auditing Log and Admin Activity Log
9. Return success

---

### GET `/loan-applications/:id/queries`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access)
5. Fetch File Auditing Log table
6. Filter logs where `File` matches application's File ID and `Action/Event Type` contains 'query'
7. Parse query content (extract message, status, parent ID from metadata)
8. Return query list

---

### POST `/loan-applications/:id/queries/:queryId/resolve`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (update resolved status)

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access)
5. Fetch File Auditing Log table
6. Find query entry by queryId
7. Update query content to mark as resolved (add `[[status:resolved]]` metadata)
8. Update `Resolved` field to 'True'
9. Update entry via POST `/webhook/Fileauditinglog`
10. Return success

---

### POST `/loan-applications/:id/queries/:queryId/reply`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (create reply)

**Steps**:
1. Verify user role is 'client'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to user's clientId
5. Fetch File Auditing Log table
6. Find parent query by queryId
7. Build reply content with parent reference (`[[parent:queryId]]`)
8. Create new audit log entry with reply message
9. POST to `/webhook/Fileauditinglog`
10. Return reply data

---

## KAM Endpoints

### GET `/kam/dashboard`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/useraccount` → Airtable: `User Accounts`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
4. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
5. **GET** `/webhook/client` → Airtable: `Clients` (via RBAC filter)

**Steps**:
1. Verify user role is 'kam' and has `kamId`
2. Fetch User Accounts, Loan Applications, Commission Ledger, File Auditing Log tables
3. Apply RBAC filtering:
   - Filter clients where `Assigned KAM` matches user's `kamId`
   - Filter applications for managed clients
   - Filter ledger entries for managed clients
   - Filter audit logs for managed clients' files
4. Aggregate metrics:
   - Files by stage (Under Review, Query Pending, Ready for Credit)
   - Pending questions from Credit Team
   - Ledger disputes for managed clients
5. Return dashboard data

---

### GET `/kam/clients`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **GET** `/webhook/kamusers` → Airtable: `KAM Users` (if kamId not set)

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. If `kamId` not set, fetch KAM Users table to find KAM ID by email
4. Filter clients where `Assigned KAM` matches user's `kamId`
5. Return filtered client list

---

### POST `/kam/clients`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients` (duplicate check)
2. **POST** `/webhook/Client` → Airtable: `Clients` (create record)
3. **POST** `/webhook/adduser` → Airtable: `User Accounts` (create user account)
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'kam'
2. Extract client data (clientName, contactEmailPhone, commissionRate, etc.)
3. Check for duplicate Client ID
4. Generate Client ID: `CLIENT-{timestamp}-{random}`
5. Create client record via POST `/webhook/Client`
6. Create user account for client via POST `/webhook/adduser`
7. Log to Admin Activity Log
8. Return created client data

---

### GET `/kam/clients/:id`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. Find client by ID
4. Verify client is assigned to user's KAM
5. Fetch Loan Applications table
6. Filter applications for this client
7. Return client details with application count

---

### PATCH `/kam/clients/:id/modules`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **POST** `/webhook/Client` → Airtable: `Clients` (update record)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. Find client by ID
4. Verify client is assigned to user's KAM
5. Extract enabledModules, commissionRate, formCategories from request body
6. Use `formConfigService.configureClientModules()` to update:
   - Client's `Enabled Modules` field
   - Client's `Form Categories` field
   - Client Form Mapping entries
7. Update commission rate if provided
8. Update client via POST `/webhook/Client`
9. Log to Admin Activity Log
10. Return success

---

### POST `/kam/clients/:id/configure-modules`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **POST** `/webhook/Client` → Airtable: `Clients` (update record)
3. **POST** `/webhook/POSTCLIENTFORMMAPPING` → Airtable: `Client Form Mapping` (create/update mappings)
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. Find client by ID
4. Verify client is assigned to user's KAM
5. Extract enabledModules, formCategories, productId from request body
6. Use `formConfigService.configureClientModules()` to:
   - Update client's `Enabled Modules` and `Form Categories` fields
   - Create/update Client Form Mapping entries for each enabled module
7. Log to Admin Activity Log
8. Return success

---

### GET `/kam/clients/:id/form-mappings`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/clientformmapping` → Airtable: `Client Form Mapping`
2. **GET** `/webhook/client` → Airtable: `Clients`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. Find client by ID
4. Verify client is assigned to user's KAM
5. Fetch Client Form Mapping table
6. Filter mappings where `Client` matches client ID
7. Return form mappings

---

### POST `/kam/clients/:id/form-mappings`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **POST** `/webhook/POSTCLIENTFORMMAPPING` → Airtable: `Client Form Mapping` (create record)

**Steps**:
1. Verify user role is 'kam'
2. Fetch Clients table
3. Find client by ID
4. Verify client is assigned to user's KAM
5. Extract form mapping data (category, field, productId, version)
6. Create Client Form Mapping entry via POST `/webhook/POSTCLIENTFORMMAPPING`
7. Return created mapping

---

### GET `/kam/loan-applications`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/client` → Airtable: `Clients` (via RBAC filter)

**Steps**:
1. Verify user role is 'kam'
2. Fetch Loan Applications table
3. Fetch Clients table
4. Apply RBAC filtering (only applications for managed clients)
5. Apply query filters (status, clientId, etc.)
6. Return filtered applications

---

### POST `/kam/loan-applications/:id/edit`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update record)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to a managed client
5. Extract edit data (applicantName, requestedLoanAmount, formData, etc.)
6. Update application via POST `/webhook/loanapplications`
7. Log to File Auditing Log and Admin Activity Log
8. Return success

---

### POST `/kam/loan-applications/:id/queries`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'kam'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to a managed client
5. Extract query message and target role (client or credit)
6. Create query entry in File Auditing Log via POST `/webhook/Fileauditinglog`
7. Update application status to `QUERY_WITH_CLIENT` if querying client
8. Log to Admin Activity Log
9. Send notification to target user/role
10. Return success

---

### POST `/kam/loan-applications/:id/forward-to-credit`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`
5. **GET** `/webhook/creditteamuser` → Airtable: `Credit Team Users` (for notifications)

**Steps**:
1. Verify user role is 'kam'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application belongs to a managed client
5. Verify status allows forwarding (must be `UNDER_KAM_REVIEW` or `QUERY_WITH_CLIENT`)
6. Use `loanWorkflowService.forwardToCreditTeam()`:
   - Validate status transition using state machine
   - Update status to `PENDING_CREDIT_REVIEW`
   - Record status change history
   - Log to File Auditing Log and Admin Activity Log
   - Send notification to all active Credit Team members
7. Return success

---

### GET `/kam/ledger`
**Role**: KAM only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **GET** `/webhook/client` → Airtable: `Clients` (via RBAC filter)

**Steps**:
1. Verify user role is 'kam'
2. Fetch Commission Ledger table
3. Fetch Clients table
4. Apply RBAC filtering (only entries for managed clients)
5. Return filtered ledger entries

---

## Credit Team Endpoints

### GET `/credit/dashboard`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table (Credit sees all)
3. Fetch File Auditing Log table
4. Aggregate metrics:
   - Files by stage (Pending Credit Review, Query with KAM, In Negotiation, Sent to NBFC, Approved, Rejected, Disbursed)
   - Today's metrics (files received, sent to lenders, approved, rejected, total disbursed)
   - Pending queries count
5. Return dashboard data

---

### GET `/credit/loan-applications`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table (Credit sees all)
3. Apply query filters (status, kamId, clientId, nbfcId, productId, dateFrom, dateTo)
4. Return filtered applications

---

### GET `/credit/loan-applications/:id`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Fetch File Auditing Log table
5. Filter audit logs for this file ID
6. Parse Documents field
7. Return application details with audit log

---

### POST `/credit/loan-applications/:id/queries`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`
4. **GET** `/webhook/kamusers` → Airtable: `KAM Users` (for notifications)

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Extract query message and target role (KAM or client)
5. Create query entry in File Auditing Log via POST `/webhook/Fileauditinglog`
6. Update application status to `CREDIT_QUERY_WITH_KAM` if querying KAM
7. Log to Admin Activity Log
8. Send notification to target user/role
9. Return success

---

### POST `/credit/loan-applications/:id/mark-in-negotiation`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Verify status allows transition to `IN_NEGOTIATION`
5. Update status to `IN_NEGOTIATION`
6. Update application via POST `/webhook/loanapplications`
7. Log to File Auditing Log and Admin Activity Log
8. Return success

---

### POST `/credit/loan-applications/:id/assign-nbfcs`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/nbfcpartners` → Airtable: `NBFC Partners`
3. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update Assigned NBFC)
4. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
5. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Extract nbfcIds array from request body
5. Fetch NBFC Partners table to validate NBFC IDs
6. Update `Assigned NBFC` field (comma-separated list of NBFC IDs)
7. Update application via POST `/webhook/loanapplications`
8. Log to File Auditing Log and Admin Activity Log
9. Send notification to assigned NBFCs
10. Return success

---

### POST `/credit/loan-applications/:id/nbfc-decision`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update lender decision)

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Extract lender decision data (decision, decisionDate, remarks, approvedAmount)
5. Update `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`, `Approved Loan Amount`
6. Update application via POST `/webhook/loanapplications`
7. If decision is APPROVED, update status to `APPROVED`
8. Return success

---

### POST `/credit/loan-applications/:id/mark-disbursed`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (create commission entry)
4. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
5. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`
6. **GET** `/webhook/client` → Airtable: `Clients` (for commission rate)

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Extract disbursedAmount and disbursedDate
5. Verify status allows transition to `DISBURSED`
6. Update status to `DISBURSED`
7. Update application via POST `/webhook/loanapplications`
8. Use `commissionService.calculateAndRecordCommission()`:
   - Fetch client to get commission rate
   - Calculate commission: `disbursedAmount * (commissionRate / 100)`
   - Create Commission Ledger entry via POST `/webhook/COMISSIONLEDGER`
   - Log to File Auditing Log and Admin Activity Log
   - Send notification to client
9. Return success with commission details

---

### POST `/credit/loan-applications/:id/close`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Loan Applications table
3. Find application by ID
4. Update status to `CLOSED`
5. Update application via POST `/webhook/loanapplications`
6. Log to File Auditing Log and Admin Activity Log
7. Return success

---

### GET `/credit/payout-requests`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table
3. Filter entries where `Payout Request` is 'Requested' or 'True'
4. Return payout requests list

---

### POST `/credit/payout-requests/:id/approve`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Payout Request status)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Update `Payout Request` to 'Approved'
5. Update entry via POST `/webhook/COMISSIONLEDGER`
6. Log to Admin Activity Log
7. Send notification to client
8. Return success

---

### POST `/credit/payout-requests/:id/reject`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Payout Request status)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Update `Payout Request` to 'Rejected'
5. Update entry via POST `/webhook/COMISSIONLEDGER`
6. Log to Admin Activity Log
7. Send notification to client
8. Return success

---

### GET `/credit/ledger`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table (Credit sees all)
3. Apply query filters if provided
4. Return ledger entries

---

### POST `/credit/ledger/entries`
**Role**: CREDIT only

**Webhooks Called**:
1. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (create record)
2. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Extract ledger entry data (clientId, loanFileId, date, disbursedAmount, commissionRate, payoutAmount, description)
3. Generate Ledger Entry ID
4. Create entry via POST `/webhook/COMISSIONLEDGER`
5. Log to Admin Activity Log
6. Return created entry

---

### POST `/credit/ledger/:ledgerEntryId/flag-dispute`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Dispute Status)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Use `commissionService.flagDispute()`:
   - Update `Dispute Status` to `UNDER_QUERY`
   - Update entry via POST `/webhook/COMISSIONLEDGER`
   - Log to Admin Activity Log
   - Send notification to client
5. Return success

---

### POST `/credit/ledger/:ledgerEntryId/resolve-dispute`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Dispute Status and Payout Amount)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Extract resolution data (resolution: 'accept' | 'reject', adjustedAmount, notes)
5. Use `commissionService.resolveDispute()`:
   - If resolution is 'accept': Update `Dispute Status` to `RESOLVED` and adjust `Payout Amount` if provided
   - If resolution is 'reject': Update `Dispute Status` to `NONE`
   - Update entry via POST `/webhook/COMISSIONLEDGER`
   - Log to Admin Activity Log
   - Send notification to client
6. Return success

---

### GET `/credit/clients`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Clients table (Credit sees all)
3. Return client list

---

### GET `/credit/clients/:id`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/client` → Airtable: `Clients`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Clients table
3. Find client by ID
4. Fetch Loan Applications table
5. Filter applications for this client
6. Return client details with application count

---

## NBFC Endpoints

### GET `/nbfc/dashboard`
**Role**: NBFC only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'nbfc' and has `nbfcId`
2. Fetch Loan Applications table
3. Apply RBAC filtering (only applications where `Assigned NBFC` matches user's `nbfcId`)
4. Return dashboard with assigned applications

---

### GET `/nbfc/loan-applications`
**Role**: NBFC only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'nbfc' and has `nbfcId`
2. Fetch Loan Applications table
3. Apply RBAC filtering (only applications assigned to this NBFC)
4. Apply query filters (status, etc.)
5. Return filtered applications

---

### GET `/nbfc/loan-applications/:id`
**Role**: NBFC only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'nbfc' and has `nbfcId`
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application is assigned to user's NBFC
5. Fetch File Auditing Log table
6. Filter audit logs for this file ID
7. Return application details with audit log

---

### POST `/nbfc/loan-applications/:id/decision`
**Role**: NBFC only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update lender decision)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`
4. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'nbfc' and has `nbfcId`
2. Fetch Loan Applications table
3. Find application by ID
4. Verify application is assigned to user's NBFC
5. Extract decision data (decision: APPROVED | REJECTED | NEEDS_CLARIFICATION, decisionDate, remarks, approvedAmount)
6. Update `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`, `Approved Loan Amount`
7. If decision is APPROVED, update status to `APPROVED`
8. If decision is REJECTED, update status to `REJECTED`
9. Update application via POST `/webhook/loanapplications`
10. Log to File Auditing Log and Admin Activity Log
11. Send notification to Credit Team
12. Return success

---

## Commission Ledger Endpoints

### GET `/clients/me/ledger`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Fetch Commission Ledger table
3. Apply RBAC filtering (only entries where `Client` matches user's `clientId`)
4. Sort by date (oldest first)
5. Calculate running balance
6. Reverse to show newest first
7. Return ledger entries with running balance

---

### GET `/clients/me/ledger/:ledgerEntryId`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Verify entry belongs to user's clientId
5. Return ledger entry details

---

### POST `/clients/me/ledger/:ledgerEntryId/query`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Dispute Status)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Extract query message from request body
3. Fetch Commission Ledger table
4. Find ledger entry by ID
5. Verify entry belongs to user's clientId
6. Use `commissionService.flagDispute()`:
   - Update `Dispute Status` to `UNDER_QUERY`
   - Update entry via POST `/webhook/COMISSIONLEDGER`
   - Log to File Auditing Log
   - Send notification to Credit Team
7. Return success

---

### POST `/clients/me/ledger/:ledgerEntryId/flag-payout`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Payout Request)
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Fetch Commission Ledger table
3. Find ledger entry by ID
4. Verify entry belongs to user's clientId
5. Verify entry has positive payout amount
6. Update `Payout Request` to 'Requested'
7. Update entry via POST `/webhook/COMISSIONLEDGER`
8. Log to File Auditing Log
9. Return success

---

### POST `/clients/me/payout-requests`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
2. **POST** `/webhook/COMISSIONLEDGER` → Airtable: `Commission Ledger` (update Payout Request)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Extract amount or full flag from request body
3. Fetch Commission Ledger table
4. Filter entries for user's clientId
5. Calculate current balance (sum of all payout amounts)
6. Use `commissionService.requestPayout()`:
   - Validate requested amount (must be <= current balance)
   - If `full=true`, request entire balance
   - Create/update payout request entry (set `Payout Request` to 'Requested')
   - Log to Admin Activity Log
   - Send notification to Credit Team
7. Return payout request details

---

### GET `/clients/me/payout-requests`
**Role**: CLIENT only

**Webhooks Called**:
1. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`

**Steps**:
1. Verify user role is 'client' and has `clientId`
2. Fetch Commission Ledger table
3. Filter entries for user's clientId where `Payout Request` is 'Requested' or 'True'
4. Return payout requests list

---

## Reports Endpoints

### POST `/reports/daily/generate`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/commisionledger` → Airtable: `Commission Ledger`
3. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
4. **GET** `/webhook/adminactivity` → Airtable: `Admin Activity Log`
5. **POST** `/webhook/DAILYSUMMARY` → Airtable: `Daily Summary Reports`
6. **POST** `/webhook/email` → Outlook Send a message (if emailRecipients provided)

**Steps**:
1. Verify user role is 'credit_team'
2. Extract reportDate from request body (defaults to today)
3. Use `dailySummaryService.generateDailySummary()`:
   - Fetch all tables (Loan Applications, Commission Ledger, File Auditing Log, Admin Activity Log)
   - Filter records by reportDate (last 24 hours)
   - Aggregate metrics:
     - Applications: total, new, submitted, by status, disbursed amount, pending queries
     - Commissions: total entries, payout/payin amounts, payout requests, disputes
     - Audit: total actions, queries raised/resolved, status changes, admin activities
   - Format summary content (text report)
4. Use `dailySummaryService.saveDailySummary()`:
   - Generate report ID
   - Create Daily Summary Report entry via POST `/webhook/DAILYSUMMARY`
   - If emailRecipients provided, send email via POST `/webhook/email`
5. Return report ID and summary data

---

### GET `/reports/daily/list`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/dailysummaryreport` → Airtable: `Daily Summary Reports`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Daily Summary Reports table
3. Sort by date (newest first)
4. Return report list

---

### GET `/reports/daily/latest`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/dailysummaryreport` → Airtable: `Daily Summary Reports`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Daily Summary Reports table
3. Sort by date (newest first)
4. Return latest report

---

### GET `/reports/daily/:date`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/dailysummaryreport` → Airtable: `Daily Summary Reports`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Daily Summary Reports table
3. Find report by date (YYYY-MM-DD format)
4. Return report details

---

## Queries Endpoints

### POST `/queries/:parentId/replies`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (create reply)

**Steps**:
1. Verify user is authenticated
2. Extract parentId, message, actor, targetUserRole from request body
3. Fetch File Auditing Log table
4. Find parent query by parentId
5. Fetch Loan Applications table
6. Apply RBAC check (verify user has access to the file)
7. Build reply content with parent reference (`[[parent:parentId]]`)
8. Create reply entry in File Auditing Log via POST `/webhook/Fileauditinglog`
9. Return reply data

---

### GET `/queries/thread/:id`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user is authenticated
2. Fetch File Auditing Log table
3. Find root query by ID
4. Fetch Loan Applications table
5. Apply RBAC check (verify user has access to the file)
6. Find all replies (entries with parent = root query ID)
7. Parse query content (extract message, status, parent ID from metadata)
8. Return root query and all replies (thread)

---

### POST `/queries/:id/resolve`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (update resolved status)

**Steps**:
1. Verify user is authenticated
2. Fetch File Auditing Log table
3. Find query entry by ID
4. Fetch Loan Applications table
5. Apply RBAC check (verify user has access to the file)
6. Update query content to mark as resolved (add `[[status:resolved]]` metadata)
7. Update `Resolved` field to 'True'
8. Update entry via POST `/webhook/Fileauditinglog`
9. Return success

---

### POST `/queries/:id/reopen`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`
2. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
3. **POST** `/webhook/Fileauditinglog` → Airtable: `File Auditing Log` (update resolved status)

**Steps**:
1. Verify user is authenticated
2. Fetch File Auditing Log table
3. Find query entry by ID
4. Fetch Loan Applications table
5. Apply RBAC check (verify user has access to the file)
6. Update query content to mark as open (remove `[[status:resolved]]` metadata)
7. Update `Resolved` field to 'False'
8. Update entry via POST `/webhook/Fileauditinglog`
9. Return success

---

## Audit & Activity Log Endpoints

### GET `/loan-applications/:id/audit-log`
**Role**: Authenticated (all roles, filtered by RBAC)

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **GET** `/webhook/fileauditinglog` → Airtable: `File Auditing Log`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access to this application)
5. Fetch File Auditing Log table
6. Filter audit logs for this file ID
7. Apply RBAC filtering (only logs for files user has access to)
8. Sort by timestamp (newest first)
9. Return audit log entries

---

### GET `/admin/activity-log`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/adminactivity` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch Admin Activity Log table (Credit sees all)
3. Apply query filters (dateFrom, dateTo, performedBy, actionType, targetEntity)
4. Sort by timestamp (newest first)
5. Return activity log entries

---

## Products & Partners Endpoints

### GET `/loan-products`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/loanproducts` → Airtable: `Loan Products`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Products table
3. Filter active products if `activeOnly=true` query param provided
4. Return product list

---

### GET `/loan-products/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/loanproducts` → Airtable: `Loan Products`

**Steps**:
1. Verify user is authenticated
2. Fetch Loan Products table
3. Find product by ID
4. Return product details

---

### GET `/nbfc-partners`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/nbfcpartners` → Airtable: `NBFC Partners`

**Steps**:
1. Verify user is authenticated
2. Fetch NBFC Partners table
3. Return partner list

---

### GET `/nbfc-partners/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/nbfcpartners` → Airtable: `NBFC Partners`

**Steps**:
1. Verify user is authenticated
2. Fetch NBFC Partners table
3. Find partner by ID
4. Return partner details

---

### POST `/nbfc-partners`
**Role**: CREDIT only

**Webhooks Called**:
1. **POST** `/webhook/NBFCPartners` → Airtable: `NBFC Partners` (create record)
2. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Extract partner data (lenderName, contactEmailPhone, etc.)
3. Generate Partner ID
4. Create partner record via POST `/webhook/NBFCPartners`
5. Log to Admin Activity Log
6. Return created partner

---

### PATCH `/nbfc-partners/:id`
**Role**: CREDIT only

**Webhooks Called**:
1. **GET** `/webhook/nbfcpartners` → Airtable: `NBFC Partners`
2. **POST** `/webhook/NBFCPartners` → Airtable: `NBFC Partners` (update record)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team'
2. Fetch NBFC Partners table
3. Find partner by ID
4. Extract update data from request body
5. Update partner record via POST `/webhook/NBFCPartners`
6. Log to Admin Activity Log
7. Return updated partner

---

## Notifications Endpoints

### GET `/notifications`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/notifications` → Airtable: `Notifications`

**Steps**:
1. Verify user is authenticated
2. Fetch Notifications table
3. Filter notifications for user (by userId or role)
4. Sort by timestamp (newest first)
5. Return notification list

---

### GET `/notifications/unread-count`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/notifications` → Airtable: `Notifications`

**Steps**:
1. Verify user is authenticated
2. Fetch Notifications table
3. Filter notifications for user where `Read` is 'False'
4. Return unread count

---

### POST `/notifications/:id/read`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/notifications` → Airtable: `Notifications`
2. **POST** `/webhook/notification` → Airtable: `Notifications` (update Read status)

**Steps**:
1. Verify user is authenticated
2. Fetch Notifications table
3. Find notification by ID
4. Verify notification belongs to user
5. Update `Read` field to 'True'
6. Update notification via POST `/webhook/notification`
7. Return success

---

### POST `/notifications/mark-all-read`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/notifications` → Airtable: `Notifications`
2. **POST** `/webhook/notification` → Airtable: `Notifications` (update multiple records)

**Steps**:
1. Verify user is authenticated
2. Fetch Notifications table
3. Filter unread notifications for user
4. Update all to `Read = 'True'` via POST `/webhook/notification` (batch update)
5. Return success

---

## Users & Accounts Endpoints

### GET `/kam-users`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/kamusers` → Airtable: `KAM Users`

**Steps**:
1. Verify user is authenticated
2. Fetch KAM Users table
3. Return KAM user list

---

### GET `/kam-users/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/kamusers` → Airtable: `KAM Users`

**Steps**:
1. Verify user is authenticated
2. Fetch KAM Users table
3. Find KAM user by ID
4. Return KAM user details

---

### POST `/user-accounts`
**Role**: Credit team or Admin only

**Webhooks Called**:
1. **POST** `/webhook/adduser` → Airtable: `User Accounts`
2. **POST** `/webhook/KAMusers` → Airtable: `KAM Users` (only when creating a KAM user)

**Steps**:
1. Verify user role is credit_team or admin
2. Create user account via POST `/webhook/adduser`
3. If role is `kam`, create KAM profile via n8n "KAM Users" POST webhook (with retries). **Requirement:** Creating a KAM user requires the n8n "KAM Users" POST webhook to be enabled and correctly configured. Set `N8N_POST_KAM_USERS_URL` in the environment; without it, KAM creation returns 502 and the new user cannot log in as KAM.
4. Log to Admin Activity Log
5. Return 201 with created user data (or 502 if KAM profile creation fails after retries)

---

### GET `/user-accounts`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/useraccount` → Airtable: `User Accounts`

**Steps**:
1. Verify user is authenticated
2. Fetch User Accounts table
3. Return user account list

---

### GET `/user-accounts/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/useraccount` → Airtable: `User Accounts`

**Steps**:
1. Verify user is authenticated
2. Fetch User Accounts table
3. Find user account by ID
4. Return user account details

---

### PATCH `/user-accounts/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/useraccount` → Airtable: `User Accounts`
2. **POST** `/webhook/adduser` → Airtable: `User Accounts` (update record)

**Steps**:
1. Verify user is authenticated
2. Fetch User Accounts table
3. Find user account by ID
4. Extract update data from request body
5. Update user account via POST `/webhook/adduser`
6. Return updated user account

---

## Form Categories Endpoints

### GET `/form-categories`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/formcategories` → Airtable: `Form Categories`

**Steps**:
1. Verify user is authenticated
2. Fetch Form Categories table
3. Return category list

---

### GET `/form-categories/:id`
**Role**: Authenticated (all roles)

**Webhooks Called**:
1. **GET** `/webhook/formcategories` → Airtable: `Form Categories`

**Steps**:
1. Verify user is authenticated
2. Fetch Form Categories table
3. Find category by ID
4. Return category details

---

### POST `/form-categories`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **POST** `/webhook/FormCategory` → Airtable: `Form Categories` (create record)
2. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Extract category data (categoryName, description, displayOrder, active)
3. Generate Category ID
4. Create category via POST `/webhook/FormCategory`
5. Log to Admin Activity Log
6. Return created category

---

### PATCH `/form-categories/:id`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/formcategories` → Airtable: `Form Categories`
2. **POST** `/webhook/FormCategory` → Airtable: `Form Categories` (update record)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Form Categories table
3. Find category by ID
4. Extract update data from request body
5. Update category via POST `/webhook/FormCategory`
6. Log to Admin Activity Log
7. Return updated category

---

### DELETE `/form-categories/:id`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/formcategories` → Airtable: `Form Categories`
2. **POST** `/webhook/FormCategory` → Airtable: `Form Categories` (delete record - set Active to False)
3. **POST** `/webhook/POSTLOG` → Airtable: `Admin Activity Log`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Form Categories table
3. Find category by ID
4. Soft delete: Update `Active` to 'False' via POST `/webhook/FormCategory`
5. Log to Admin Activity Log
6. Return success

---

## Documents Endpoints

### POST `/documents/upload`
**Role**: CLIENT only

**Webhooks Called**: None (OneDrive API only)

**Steps**:
1. Verify user role is 'client'
2. Extract file from request (multer middleware)
3. Extract fileName, fieldId, folderPath from request body
4. Upload file to OneDrive via `uploadToOneDrive()` service
5. Return OneDrive share link, fileId, and webUrl

**Response**:
```json
{
  "success": true,
  "data": {
    "fieldId": "FIELD001",
    "fileName": "document.pdf",
    "shareLink": "https://onedrive.live.com/...",
    "fileId": "onedrive_file_id",
    "webUrl": "https://onedrive.live.com/..."
  }
}
```

---

### POST `/documents/upload-multiple`
**Role**: CLIENT only

**Webhooks Called**: None (OneDrive API only)

**Steps**:
1. Verify user role is 'client'
2. Extract files array from request (multer middleware)
3. Extract fieldIds array and folderPath from request body
4. Upload all files to OneDrive in parallel via `uploadToOneDrive()`
5. Return array of upload results

---

## AI Endpoints

### POST `/loan-applications/:id/generate-summary`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`
2. **POST** `/webhook/loanapplications` → Airtable: `Loan Applications` (update AI File Summary)

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access)
5. Generate AI summary from application data (form data, documents, etc.)
6. Update `AI File Summary` field via POST `/webhook/loanapplications`
7. Return generated summary

---

### GET `/loan-applications/:id/summary`
**Role**: CREDIT or KAM

**Webhooks Called**:
1. **GET** `/webhook/loanapplication` → Airtable: `Loan Applications`

**Steps**:
1. Verify user role is 'credit_team' or 'kam'
2. Fetch Loan Applications table
3. Find application by ID
4. Apply RBAC check (verify user has access)
5. Return `AI File Summary` field value

---

## Public Endpoints

### GET `/public/clients/:id/form-mappings`
**Role**: Public (no authentication required)

**Webhooks Called**:
1. **GET** `/webhook/clientformmapping` → Airtable: `Client Form Mapping`
2. **GET** `/webhook/client` → Airtable: `Clients`

**Steps**:
1. Extract client ID from URL params
2. Fetch Clients table
3. Find client by ID
4. Fetch Client Form Mapping table
5. Filter mappings where `Client` matches client ID
6. Return form mappings (for public form links)

---

## Health Check

### GET `/health`
**Role**: Public (no authentication required)

**Webhooks Called**: None

**Steps**:
1. Return simple success response

**Response**:
```json
{
  "success": true,
  "message": "API is running"
}
```

---

## Notes

1. **RBAC Filtering**: All data retrieval endpoints apply role-based access control (RBAC) filtering using `rbacFilterService` to ensure users only see data they're authorized to access.

2. **Caching**: GET webhook calls use caching (5-minute TTL by default) to reduce n8n webhook load. Cache can be bypassed with `forceRefresh=true` query parameter.

3. **Error Handling**: All endpoints return standardized error responses:
   ```json
   {
     "success": false,
     "error": "Error message"
   }
   ```

4. **Webhook Retries**: POST webhook calls include retry logic (3 attempts with exponential backoff) to handle transient failures.

5. **Timeouts**: 
   - GET webhooks: 5 seconds default timeout
   - POST webhooks: 30 seconds default timeout with retries
   - Login endpoint: 30 seconds frontend timeout

6. **Status Transitions**: Loan application status changes are validated using a state machine to ensure only valid transitions are allowed.

7. **Query Threading**: Queries support threading via parent references in the `Details/Message` field using metadata format: `[[parent:parentId]]` and `[[status:resolved]]`.

---

**Last Updated**: 2025-01-29
**Version**: 1.0

