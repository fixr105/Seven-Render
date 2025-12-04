# Operations Logic Documentation

This document describes the logic flow of every operation (API endpoint) in the backend system.

**Last Updated:** After individual webhook migration

---

## Table of Contents

1. [Authentication Operations](#authentication-operations)
2. [Loan Application Operations](#loan-application-operations)
3. [Client Operations](#client-operations)
4. [KAM Operations](#kam-operations)
5. [Credit Team Operations](#credit-team-operations)
6. [NBFC Operations](#nbfc-operations)
7. [Ledger Operations](#ledger-operations)
8. [Notification Operations](#notification-operations)
9. [Audit Operations](#audit-operations)
10. [AI Operations](#ai-operations)
11. [Query Operations](#query-operations)
12. [Report Operations](#report-operations)
13. [User Management Operations](#user-management-operations)
14. [Product Operations](#product-operations)
15. [Form Category Operations](#form-category-operations)
16. [Credit Team Users Operations](#credit-team-users-operations)

---

## Authentication Operations

### POST /auth/login

**Purpose:** Authenticate user and return JWT token

**Logic Flow:**
1. Validate input (email, password) using `loginSchema`
2. Call `authService.login(email, password)`
   - Fetch `User Accounts` table via individual webhook
   - Find user by email (Username field)
   - Check account status (must be 'Active')
   - Validate password (supports both hashed and plaintext)
   - Fetch role-specific data:
     - **KAM**: Fetch `KAM Users` table, find by email, set `kamId` and `name`
     - **Credit Team**: Fetch `Credit Team Users` table, find by email, set `name`
     - **NBFC**: Fetch `NBFC Partners` table, find by email in Contact Email/Phone, set `nbfcId` and `name`
     - **Client**: Use `Associated Profile` as name, set `clientId` to user account id
   - Update `Last Login` timestamp in User Accounts
   - Generate JWT token with user info
3. Return `{ user, token }` on success
4. Return 401 error on failure

**Tables Used:**
- `User Accounts` (via `getUserAccounts()`)
- `KAM Users` (if role is KAM)
- `Credit Team Users` (if role is credit_team)
- `NBFC Partners` (if role is nbfc)

---

### GET /auth/me

**Purpose:** Get current authenticated user information

**Logic Flow:**
1. Check if user is authenticated (req.user exists)
2. Default name to email prefix (before @)
3. Fetch role-specific table to get name:
   - **KAM**: Fetch `KAM Users` table, find by `kamId`, get `Name`
   - **Credit Team**: Fetch `Credit Team Users` table, find by email, get `Name`
4. Return user object with id, email, role, clientId, kamId, nbfcId, name

**Tables Used:**
- `KAM Users` (if role is kam)
- `Credit Team Users` (if role is credit_team)

---

## Loan Application Operations

### POST /loan-applications

**Purpose:** Create draft loan application (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `productId` and `borrowerIdentifiers` from request body
3. Generate File ID: `SF{timestamp}`
4. Generate application ID: `APP-{timestamp}-{random}`
5. Create application data object:
   - Set Status to `DRAFT`
   - Set Client to `req.user.clientId`
   - Set Creation Date to today
   - Set Last Updated to now
6. POST to `Loan Application` webhook via `n8nClient.postLoanApplication()`
7. Log admin activity via `postAdminActivityLog()`:
   - Action Type: `create_application`
   - Description: "Created draft loan application {fileId}"
8. Return `{ loanApplicationId, fileId }`

**Tables Used:**
- `Loan Application` (POST)
- `Admin Activity Log` (POST)

---

### GET /loan-applications

**Purpose:** List loan applications (filtered by role)

**Logic Flow:**
1. Extract query parameters: `status`, `dateFrom`, `dateTo`, `search`
2. Fetch `Loan Application` table via individual webhook
3. Filter by role using `dataFilterService.filterLoanApplications()`:
   - **Client**: Only their own applications (Client === clientId)
   - **KAM**: Applications for managed clients
   - **Credit**: All applications
   - **NBFC**: Only assigned applications (Assigned NBFC === nbfcId)
4. Apply additional filters:
   - Filter by status if provided
   - Filter by date range (Creation Date) if provided
   - Filter by search term (File ID, Applicant Name, Client) if provided
5. Map results to response format
6. Return filtered applications

**Tables Used:**
- `Loan Application` (GET)

---

### GET /loan-applications/:id

**Purpose:** Get single loan application with audit log

**Logic Flow:**
1. Extract application `id` from params
2. Fetch `Loan Application` and `File Auditing Log` tables in parallel
3. Find application by id
4. Check access permissions using `dataFilterService.filterLoanApplications()`
5. Filter audit logs for this file (File === application['File ID'])
6. Map audit logs to response format
7. Parse Form Data JSON if present
8. Return application with audit log

**Tables Used:**
- `Loan Application` (GET)
- `File Auditing Log` (GET)

---

### POST /loan-applications/:id/form

**Purpose:** Update draft application form data (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `id` from params, `formData` and `documentUploads` from body
3. Fetch `Loan Application` table
4. Find application by id
5. Verify application belongs to user (Client === clientId)
6. Check status allows editing (must be DRAFT or QUERY_WITH_CLIENT)
7. Update Form Data (stringify if object)
8. Handle document uploads:
   - Parse existing Documents (comma-separated)
   - Append new documents as `{fieldId}:{fileUrl}`
   - Join back to comma-separated string
9. POST updated application to `Loan Application` webhook
10. Log to File Auditing Log:
    - Action Type: `update_form_data`
    - Details: "Application form data updated"
11. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)

---

### POST /loan-applications/:id/submit

**Purpose:** Submit application for review (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `id` from params
3. Fetch `Loan Application` table
4. Find application by id
5. Verify application belongs to user
6. Check status allows submission (must be DRAFT or QUERY_WITH_CLIENT)
7. TODO: Validate required fields and documents
8. Update application:
   - Status: `UNDER_KAM_REVIEW`
   - Submitted Date: today
   - Last Updated: now
9. POST updated application to `Loan Application` webhook
10. Log admin activity:
    - Action Type: `submit_application`
11. Log file audit:
    - Action Type: `status_change`
    - Details: "Application submitted and moved to KAM review"
    - Target: 'kam'
12. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `Admin Activity Log` (POST)
- `File Auditing Log` (POST)

---

## Client Operations

### GET /client/dashboard

**Purpose:** Get client dashboard data

**Logic Flow:**
1. Verify user role is 'client'
2. Fetch `Loan Application`, `Commission Ledger`, and `File Auditing Log` tables in parallel
3. Filter applications by client (Client === clientId)
4. Filter ledger entries by client
5. Calculate ledger summary:
   - Total Earned: Sum of positive Payout Amounts
   - Paid: Sum where Payout Request === 'Paid' or 'True'
   - Pending: Total Earned - Paid
   - Balance: Total Earned
6. Get pending queries:
   - Filter audit logs where:
     - File matches client's application File IDs
     - Resolved === 'False'
7. Get payout requests:
   - Filter ledger entries where Payout Request exists and !== 'False'
8. Return dashboard data:
   - Active applications (excluding CLOSED/REJECTED)
   - Ledger summary
   - Pending queries
   - Payout requests

**Tables Used:**
- `Loan Application` (GET)
- `Commission Ledger` (GET)
- `File Auditing Log` (GET)

---

### GET /client/form-config

**Purpose:** Get form configuration for client's product

**Logic Flow:**
1. Extract `productId` from query params (required)
2. Fetch `Client Form Mapping`, `Form Categories`, and `Form Fields` tables in parallel
3. Filter mappings for this client (Client === clientId)
4. Build form config:
   - Filter categories where Active === 'True'
   - For each category:
     - Filter fields where Category === categoryId and Active === 'True'
     - Find client mapping for this category
     - Map fields with:
       - isRequired: mapping['Is Required'] === 'True' OR field['Is Mandatory'] === 'True'
       - displayOrder: mapping['Display Order'] OR field['Display Order']
     - Sort fields by displayOrder
   - Sort categories by displayOrder
5. Return form configuration

**Tables Used:**
- `Client Form Mapping` (GET)
- `Form Categories` (GET)
- `Form Fields` (GET)

---

### POST /loan-applications/:id/queries/:queryId/reply

**Purpose:** Respond to query (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `id` (application), `queryId`, `message`, `newDocs`, `answers` from request
3. Fetch `Loan Application` and `File Auditing Log` tables in parallel
4. Find application and verify ownership
5. Find query in audit logs and verify it belongs to this file
6. Update form data if answers provided:
   - Parse existing Form Data JSON
   - Merge with new answers
   - Stringify and update
7. Update documents if new docs provided:
   - Parse existing Documents (comma-separated)
   - Append new documents
   - Update application
8. Log query response to File Auditing Log:
   - Action Type: `query_response`
   - Target: query.Actor
9. If status is QUERY_WITH_CLIENT, change to UNDER_KAM_REVIEW
10. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (GET, POST)

---

## KAM Operations

### GET /kam/dashboard

**Purpose:** Get KAM dashboard data

**Logic Flow:**
1. Verify user role is 'kam'
2. Fetch `User Accounts`, `Loan Application`, `Commission Ledger`, and `File Auditing Log` tables in parallel
3. Get managed clients:
   - Filter User Accounts where Role === 'client'
   - Get their IDs
4. Filter applications for managed clients
5. Calculate files by stage:
   - Under Review: Status === UNDER_KAM_REVIEW
   - Query Pending: Status === QUERY_WITH_CLIENT
   - Ready for Credit: Status === PENDING_CREDIT_REVIEW
6. Get pending questions from Credit:
   - Filter audit logs where:
     - Target User/Role === 'kam'
     - Resolved === 'False'
     - File matches managed client applications
7. Get ledger disputes for managed clients
8. Return dashboard data

**Tables Used:**
- `User Accounts` (GET)
- `Loan Application` (GET)
- `Commission Ledger` (GET)
- `File Auditing Log` (GET)

---

### POST /kam/clients

**Purpose:** Create new client

**Logic Flow:**
1. Extract client data: `name`, `email`, `phone`, `kamId`, `enabledModules`, `commissionRate`
2. Hash password using `authService.hashPassword()` (default: 'TempPassword123!')
3. Create User Account:
   - Generate ID: `USER-{timestamp}-{random}`
   - Username: email
   - Password: hashed
   - Role: 'client'
   - Associated Profile: name
   - Account Status: 'Active'
4. POST to `User Accounts` webhook
5. Create Client record:
   - Generate Client ID: `CLIENT-{timestamp}-{random}`
   - Set Assigned KAM
   - Set Enabled Modules (comma-separated if array)
   - Set Commission Rate (default: 1.5%)
   - Status: 'Active'
6. POST to `Clients` webhook
7. Log admin activity:
   - Action Type: `create_client`
8. Return client ID

**Tables Used:**
- `User Accounts` (POST)
- `Clients` (POST)
- `Admin Activity Log` (POST)

---

### PATCH /kam/clients/:id/modules

**Purpose:** Update client enabled modules and commission rate

**Logic Flow:**
1. Extract `id` from params, `enabledModules`, `commissionRate` from body
2. Fetch `Clients` table
3. Find client by id or Client ID
4. Update data:
   - enabledModules: Convert array to comma-separated string if needed
   - commissionRate: Convert to string
5. POST updated client to `Clients` webhook
6. Log admin activity:
   - Action Type: `update_client`
7. Return success message

**Tables Used:**
- `Clients` (GET, POST)
- `Admin Activity Log` (POST)

---

### GET /kam/clients/:id/form-mappings

**Purpose:** Get form mappings for a client

**Logic Flow:**
1. Extract client `id` from params
2. Fetch `Client Form Mapping` table
3. Filter mappings where Client === id
4. Return client mappings

**Tables Used:**
- `Client Form Mapping` (GET)

---

### POST /kam/clients/:id/form-mappings

**Purpose:** Create/update form mapping for a client

**Logic Flow:**
1. Extract `id` (client), `productId`, `categoryId`, `fieldId`, `isRequired`, `displayOrder` from body
2. Generate mapping ID: `MAP-{timestamp}-{random}`
3. Create mapping data:
   - Client: id
   - Category: categoryId
   - Is Required: 'True' or 'False'
   - Display Order: string
4. POST to `Client Form Mapping` webhook
5. Log admin activity:
   - Action Type: `create_form_mapping`
6. Return mapping data

**Tables Used:**
- `Client Form Mapping` (POST)
- `Admin Activity Log` (POST)

---

### GET /kam/loan-applications

**Purpose:** List loan applications for KAM's managed clients

**Logic Flow:**
1. Extract query params: `status`, `clientId`
2. Fetch `User Accounts` and `Loan Application` tables in parallel
3. Get managed clients (Role === 'client')
4. Filter applications for managed clients
5. Apply filters:
   - Filter by status if provided
   - Filter by clientId if provided
6. Return filtered applications

**Tables Used:**
- `User Accounts` (GET)
- `Loan Application` (GET)

---

### POST /kam/loan-applications/:id/edit

**Purpose:** Edit application during KAM review

**Logic Flow:**
1. Extract `id` from params, `formData`, `notes` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Check status allows editing (must be UNDER_KAM_REVIEW or QUERY_WITH_CLIENT)
5. Update application:
   - Form Data: stringify if provided
   - Last Updated: now
6. POST updated application
7. Log to File Auditing Log:
   - Action Type: `edit_application`
   - Details: notes or "Application edited by KAM"
   - Target: 'client'
8. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)

---

### POST /kam/loan-applications/:id/queries

**Purpose:** Raise query to client

**Logic Flow:**
1. Extract `id` from params, `message`, `fieldsRequested`, `documentsRequested`, `allowsClientToEdit` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Update application status to `QUERY_WITH_CLIENT`
5. Build query message:
   - Combine message, fields requested, documents requested
6. Log query to File Auditing Log:
   - Action Type: `query_raised`
   - Target: 'client'
7. Log admin activity:
   - Action Type: `raise_query`
8. Send notification to client:
   - Fetch `Clients` table
   - Find client by Client ID
   - Extract email from Contact Email / Phone
   - Call `notificationService.notifyQueryCreated()`
9. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)
- `Admin Activity Log` (POST)
- `Clients` (GET)

---

### POST /kam/loan-applications/:id/forward-to-credit

**Purpose:** Forward application to credit team

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` table
3. Find application by id
4. Check preconditions (must be UNDER_KAM_REVIEW or QUERY_WITH_CLIENT)
5. Update application status to `PENDING_CREDIT_REVIEW`
6. Log to File Auditing Log:
   - Action Type: `forward_to_credit`
   - Details: "Application forwarded to credit team for review"
   - Target: 'credit_team'
7. Log admin activity:
   - Action Type: `forward_to_credit`
8. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)
- `Admin Activity Log` (POST)

---

## Credit Team Operations

### GET /credit/dashboard

**Purpose:** Get credit team dashboard data

**Logic Flow:**
1. Fetch `Loan Application` and `File Auditing Log` tables in parallel
2. Calculate files by stage:
   - Pending Credit Review
   - Query with KAM
   - In Negotiation
   - Sent to NBFC
   - Approved
   - Rejected
   - Disbursed
3. Calculate aggregate metrics for today:
   - Files received today
   - Files sent to lenders today
   - Files approved today
   - Files rejected today
   - Total disbursed today (sum of Approved Loan Amount)
   - Pending queries (unresolved audit logs)
4. Return dashboard data

**Tables Used:**
- `Loan Application` (GET)
- `File Auditing Log` (GET)

---

### GET /credit/loan-applications

**Purpose:** List loan applications with filters

**Logic Flow:**
1. Extract query params: `status`, `kamId`, `clientId`, `nbfcId`, `productId`, `dateFrom`, `dateTo`
2. Fetch `Loan Application` table
3. Apply filters:
   - Filter by status if provided
   - Filter by clientId if provided
   - Filter by nbfcId if provided
   - Filter by productId if provided
   - Filter by date range if provided
4. Return filtered applications

**Tables Used:**
- `Loan Application` (GET)

---

### GET /credit/loan-applications/:id

**Purpose:** Get single loan application with audit log

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` and `File Auditing Log` tables in parallel
3. Find application by id
4. Filter audit logs for this file
5. Parse Form Data JSON if present
6. Return application with audit log and AI summary

**Tables Used:**
- `Loan Application` (GET)
- `File Auditing Log` (GET)

---

### POST /credit/loan-applications/:id/queries

**Purpose:** Raise credit query back to KAM

**Logic Flow:**
1. Extract `id` from params, `message`, `requestedDocs`, `clarifications` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Update application status to `CREDIT_QUERY_WITH_KAM`
5. Build query message from message, requested docs, clarifications
6. Log query to File Auditing Log:
   - Action Type: `credit_query`
   - Target: 'kam'
7. Send notification to KAM:
   - Fetch `KAM Users` and `Clients` tables
   - Find client by Client ID
   - Get KAM ID from client's Assigned KAM
   - Find KAM user by KAM ID
   - Extract email
   - Call `notificationService.notifyQueryCreated()`
8. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)
- `KAM Users` (GET)
- `Clients` (GET)

---

### POST /credit/loan-applications/:id/mark-in-negotiation

**Purpose:** Mark application as in negotiation

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` table
3. Find application by id
4. Update application status to `IN_NEGOTIATION`
5. Log to File Auditing Log:
   - Action Type: `status_change`
   - Details: "Application marked as in negotiation"
6. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)

---

### POST /credit/loan-applications/:id/assign-nbfcs

**Purpose:** Assign NBFCs to application

**Logic Flow:**
1. Extract `id` from params, `nbfcIds` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Update application:
   - Assigned NBFC: Join nbfcIds array with comma-space
   - Status: `SENT_TO_NBFC`
5. Log admin activity:
   - Action Type: `assign_nbfc`
6. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `Admin Activity Log` (POST)

---

### POST /credit/loan-applications/:id/nbfc-decision

**Purpose:** Capture NBFC decision (for offline decisions)

**Logic Flow:**
1. Extract `id` from params, `nbfcId`, `decision`, `approvedAmount`, `terms`, `rejectionReason`, `clarificationMessage` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Update application based on decision:
   - **APPROVED**: Set Approved Loan Amount, Lender Decision Remarks (terms), Status to APPROVED if currently SENT_TO_NBFC
   - **REJECTED**: Set Lender Decision Remarks (rejectionReason), Status to REJECTED
   - **NEEDS_CLARIFICATION**: Set Lender Decision Remarks (clarificationMessage)
   - Always set Lender Decision Date and Last Updated
5. POST updated application
6. Log to File Auditing Log:
   - Action Type: `nbfc_decision`
   - Details: Include decision and amount if approved
7. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)

---

### POST /credit/loan-applications/:id/mark-disbursed

**Purpose:** Mark application as disbursed and create commission entry

**Logic Flow:**
1. Extract `id` from params, `disbursedAmount`, `disbursedDate` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Fetch `Clients` table to get commission rate
5. Find client by Client ID
6. Get commission rate from client (default: 1.5%)
7. Calculate commission: `(loanAmount * commissionRate) / 100`
8. Determine entry type:
   - **Payout**: commission >= 0 (positive amount)
   - **Payin**: commission < 0 (negative amount)
9. Update application:
   - Status: `DISBURSED`
   - Approved Loan Amount: disbursedAmount
10. Create commission ledger entry:
    - Generate Ledger Entry ID
    - Set Client, Loan File, Date
    - Set Disbursed Amount, Commission Rate
    - Set Payout Amount (positive for Payout, negative for Payin)
    - Description includes entry type and commission details
11. POST ledger entry to `Commission Ledger` webhook
12. Log admin activity:
    - Action Type: `mark_disbursed`
13. Log file audit:
    - Action Type: `disbursed`
14. Send notifications:
    - Notify client about disbursement
    - Notify client about commission (if positive)
15. Return success with commission entry details

**Tables Used:**
- `Loan Application` (GET, POST)
- `Clients` (GET)
- `Commission Ledger` (POST)
- `Admin Activity Log` (POST)
- `File Auditing Log` (POST)

---

### GET /credit/payout-requests

**Purpose:** Get all payout requests

**Logic Flow:**
1. Fetch `Commission Ledger` table
2. Filter entries where:
   - Payout Request exists
   - Payout Request !== 'False'
   - Payout Request !== 'Paid'
3. Map to response format
4. Return payout requests

**Tables Used:**
- `Commission Ledger` (GET)

---

### POST /credit/payout-requests/:id/approve

**Purpose:** Approve payout request

**Logic Flow:**
1. Extract `id` from params, `approvedAmount`, `note` from body
2. Fetch `Commission Ledger` table
3. Find entry by id
4. Create payout entry (negative amount):
   - Generate new Ledger Entry ID
   - Set Payout Amount to negative approvedAmount
   - Set Payout Request to 'Paid'
   - Description: "Payout approved: {note}"
5. POST payout entry to `Commission Ledger` webhook
6. Update original entry:
   - Set Payout Request to 'Paid'
7. POST updated entry
8. Log to File Auditing Log:
   - Action Type: `payout_approved`
9. Send notification to client:
   - Fetch `Clients` table
   - Find client by Client ID
   - Extract email
   - Call `notificationService.notifyPayoutApproved()`
10. Return success message

**Tables Used:**
- `Commission Ledger` (GET, POST)
- `File Auditing Log` (POST)
- `Clients` (GET)

---

### POST /credit/payout-requests/:id/reject

**Purpose:** Reject payout request

**Logic Flow:**
1. Extract `id` from params, `reason` from body
2. Fetch `Commission Ledger` table
3. Find entry by id
4. Update entry:
   - Set Payout Request to 'Rejected'
5. POST updated entry
6. Log to File Auditing Log:
   - Action Type: `payout_rejected`
7. Send notification to client:
   - Fetch `Clients` table
   - Find client by Client ID
   - Extract email
   - Call `notificationService.notifyPayoutRejected()`
8. Return success message

**Tables Used:**
- `Commission Ledger` (GET, POST)
- `File Auditing Log` (POST)
- `Clients` (GET)

---

## NBFC Operations

### GET /nbfc/dashboard

**Purpose:** Get NBFC dashboard data

**Logic Flow:**
1. Verify user role is 'nbfc'
2. Fetch `Loan Application` table
3. Filter applications where Assigned NBFC === nbfcId
4. Map to response format
5. Return assigned applications

**Tables Used:**
- `Loan Application` (GET)

---

### GET /nbfc/loan-applications

**Purpose:** List applications assigned to NBFC

**Logic Flow:**
1. Extract query params: `status`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`
2. Fetch `Loan Application` table
3. Filter by assigned NBFC (Assigned NBFC === nbfcId)
4. Apply filters:
   - Filter by status if provided
   - Filter by date range if provided
   - Filter by amount range if provided
5. Return filtered applications

**Tables Used:**
- `Loan Application` (GET)

---

### GET /nbfc/loan-applications/:id

**Purpose:** Get single application for underwriting

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` table
3. Find application by id
4. Verify assigned to this NBFC
5. Parse Form Data JSON if present
6. Return minimal info for underwriting (no audit log)

**Tables Used:**
- `Loan Application` (GET)

---

### POST /nbfc/loan-applications/:id/decision

**Purpose:** Record NBFC decision

**Logic Flow:**
1. Extract `id` from params, `decision`, `approvedAmount`, `terms`, `rejectionReason`, `clarificationMessage` from body
2. Fetch `Loan Application` table
3. Find application by id
4. Verify assigned to this NBFC
5. Update application based on decision:
   - **APPROVED**: Set Approved Loan Amount, Lender Decision Remarks (terms)
   - **REJECTED**: Set Lender Decision Remarks (rejectionReason)
   - **NEEDS_CLARIFICATION**: Set Lender Decision Remarks (clarificationMessage)
   - Always set Lender Decision Status, Lender Decision Date, Last Updated
6. POST updated application
7. Log to File Auditing Log:
   - Action Type: `nbfc_decision`
   - Details: Include decision and amount if approved
8. Return success message

**Tables Used:**
- `Loan Application` (GET, POST)
- `File Auditing Log` (POST)

---

## Ledger Operations

### GET /clients/me/ledger

**Purpose:** Get client's commission ledger (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Fetch `Commission Ledger` table
3. Filter entries by client (Client === clientId)
4. Sort by date (newest first)
5. Calculate running balance:
   - Iterate through entries
   - Add Payout Amount to balance
   - Include balance in each entry
6. Return entries with balance and current balance

**Tables Used:**
- `Commission Ledger` (GET)

---

### POST /clients/me/ledger/:ledgerEntryId/query

**Purpose:** Create query/dispute on ledger entry (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `ledgerEntryId` from params, `message` from body
3. Fetch `Commission Ledger` table
4. Find entry by id
5. Verify entry belongs to client
6. Update entry:
   - Set Dispute Status to `UNDER_QUERY`
7. POST updated entry
8. Log to File Auditing Log:
   - Action Type: `ledger_dispute`
   - Details: "Ledger dispute: {message}"
   - Target: 'credit_team'
9. Return success message

**Tables Used:**
- `Commission Ledger` (GET, POST)
- `File Auditing Log` (POST)

---

### POST /clients/me/payout-requests

**Purpose:** Create payout request (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Extract `amountRequested`, `full` from body
3. Fetch `Commission Ledger` table
4. Filter entries by client
5. Calculate current balance (sum of Payout Amounts)
6. Validate balance > 0
7. Determine requested amount:
   - If `full` is true: use current balance
   - Otherwise: use amountRequested or current balance
8. Validate requested amount <= current balance
9. Create payout request entry:
   - Generate Ledger Entry ID
   - Set Client
   - Set Payout Amount to '0' (request entry, not actual payout)
   - Set Payout Request to 'Requested'
   - Description: "Payout request: {requestedAmount}"
10. POST entry to `Commission Ledger` webhook
11. Log to File Auditing Log:
    - Action Type: `payout_request`
    - Target: 'credit_team'
12. Return request details

**Tables Used:**
- `Commission Ledger` (GET, POST)
- `File Auditing Log` (POST)

---

### GET /clients/me/payout-requests

**Purpose:** Get client's payout requests (CLIENT only)

**Logic Flow:**
1. Verify user role is 'client'
2. Fetch `Commission Ledger` table
3. Filter entries where:
   - Client === clientId
   - Payout Request exists
   - Payout Request !== 'False'
4. Map to response format
5. Return payout requests

**Tables Used:**
- `Commission Ledger` (GET)

---

## Notification Operations

### GET /notifications

**Purpose:** Get notifications for current user

**Logic Flow:**
1. Extract query params: `unreadOnly`, `limit`
2. Fetch `Notifications` table
3. Filter by user:
   - Match by Recipient User === email OR
   - Match by Recipient Role === role
4. Filter unread only if requested (Is Read === 'False')
5. Sort by Created At (newest first)
6. Apply limit if specified
7. Return notifications with count and unread count

**Tables Used:**
- `Notifications` (GET)

---

### GET /notifications/unread-count

**Purpose:** Get unread notification count

**Logic Flow:**
1. Fetch `Notifications` table
2. Filter by user (same logic as GET /notifications)
3. Count where Is Read === 'False'
4. Return unread count

**Tables Used:**
- `Notifications` (GET)

---

### POST /notifications/:id/read

**Purpose:** Mark notification as read

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Notifications` table
3. Find notification by id
4. Verify user has access (same logic as GET /notifications)
5. Update notification:
   - Set Is Read to 'True'
   - Set Read At to now
6. POST updated notification
7. Return success message

**Tables Used:**
- `Notifications` (GET, POST)

---

### POST /notifications/mark-all-read

**Purpose:** Mark all notifications as read for current user

**Logic Flow:**
1. Fetch `Notifications` table
2. Filter user's unread notifications
3. Update all in parallel:
   - Set Is Read to 'True'
   - Set Read At to now
4. POST all updated notifications
5. Return success with count

**Tables Used:**
- `Notifications` (GET, POST)

---

## Audit Operations

### GET /loan-applications/:id/audit-log

**Purpose:** Get file audit log for a loan application

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` and `File Auditing Log` tables in parallel
3. Find application by id
4. Check access permissions using `dataFilterService.filterLoanApplications()`
5. Filter audit logs for this file (File === application['File ID'])
6. Filter by role using `dataFilterService.filterFileAuditLog()`
7. Sort by timestamp (newest first)
8. Map to response format
9. Return audit log

**Tables Used:**
- `Loan Application` (GET)
- `File Auditing Log` (GET)

---

### GET /admin/activity-log

**Purpose:** Get admin activity log (CREDIT admin only)

**Logic Flow:**
1. Verify user role is 'credit_team'
2. Extract query params: `dateFrom`, `dateTo`, `performedBy`, `actionType`, `targetEntity`
3. Fetch `Admin Activity Log` table
4. Apply filters:
   - Filter by date range if provided
   - Filter by performedBy if provided (case-insensitive contains)
   - Filter by actionType if provided
   - Filter by targetEntity if provided
5. Sort by timestamp (newest first)
6. Map to response format
7. Return activity logs

**Tables Used:**
- `Admin Activity Log` (GET)

---

## AI Operations

### POST /loan-applications/:id/generate-summary

**Purpose:** Generate AI summary for a loan application

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` table
3. Find application by id
4. Check access using `dataFilterService.filterLoanApplications()`
5. Parse Form Data JSON if present
6. Generate basic summary (TODO: Call actual AI service):
   - Include File ID, Applicant Name, Loan Product, Requested Amount, Status
   - Include key information from form data
7. Update application:
   - Set AI File Summary to generated summary
   - Set Last Updated to now
8. POST updated application
9. Return summary with generatedAt timestamp

**Tables Used:**
- `Loan Application` (GET, POST)

---

### GET /loan-applications/:id/summary

**Purpose:** Get cached AI summary for a loan application

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Application` table
3. Find application by id
4. Check access using `dataFilterService.filterLoanApplications()`
5. Check if AI File Summary exists
6. Return summary with fileId

**Tables Used:**
- `Loan Application` (GET)

---

## Query Operations

### POST /queries/:parentId/replies

**Purpose:** Post a reply to a query (creates child query)

**Logic Flow:**
1. Extract `parentId` from params, `message`, `fileId`, `actor`, `targetUserRole` from body
2. Validate message is not empty
3. Fetch `File Auditing Log` table
4. Filter for query action types (Action/Event Type includes 'query')
5. Find parent query by id
6. Parse parent content to get file ID if not provided
7. Build reply content with parent reference using `buildQueryContent()`:
   - Embed metadata: `[[parent:{parentId}]]`, `[[status:open]]`
8. Generate reply ID: `QUERY-{timestamp}-{random}`
9. POST to File Auditing Log:
   - Action Type: `query_reply`
   - Details/Message: replyContent (with embedded metadata)
   - Target: targetUserRole or parent's Target User/Role
10. Return reply data

**Tables Used:**
- `File Auditing Log` (GET, POST)

---

### GET /queries/thread/:id

**Purpose:** Get root query and all replies (thread)

**Logic Flow:**
1. Extract `id` from params
2. Fetch `File Auditing Log` table
3. Filter for query-related entries:
   - Action/Event Type includes 'query' OR
   - Details/Message includes '[[parent:' OR '[[status:'
4. Find root query by id
5. Parse root query content using `parseQueryContent()`
6. Find all replies:
   - Filter entries where parent ID === id (using `getParentId()`)
   - Parse each reply's content
   - Map to response format
7. Sort replies by timestamp
8. Build thread response:
   - Root query with metadata
   - Replies array
   - Total replies count
   - Is resolved flag
9. Return thread

**Tables Used:**
- `File Auditing Log` (GET)

---

### POST /queries/:id/resolve

**Purpose:** Mark query as resolved

**Logic Flow:**
1. Extract `id` from params
2. Fetch `File Auditing Log` table
3. Find query entry by id
4. Parse current content using `parseQueryContent()`
5. Update content status to 'resolved' using `updateQueryStatus()`
6. Update entry:
   - Set Details/Message to updated content
   - Set Resolved to 'True'
7. POST updated entry
8. Return resolved query data

**Tables Used:**
- `File Auditing Log` (GET, POST)

---

### POST /queries/:id/reopen

**Purpose:** Reopen a resolved query

**Logic Flow:**
1. Extract `id` from params
2. Fetch `File Auditing Log` table
3. Find query entry by id
4. Parse current content using `parseQueryContent()`
5. Update content status to 'open' using `updateQueryStatus()`
6. Update entry:
   - Set Details/Message to updated content
   - Set Resolved to 'False'
7. POST updated entry
8. Return reopened query data

**Tables Used:**
- `File Auditing Log` (GET, POST)

---

## Report Operations

### POST /reports/daily/generate

**Purpose:** Generate daily summary report (CREDIT admin only)

**Logic Flow:**
1. Verify user role is 'credit_team'
2. Extract `date` from body (default: today)
3. Fetch `Loan Application` table
4. Filter applications for report date:
   - Creation Date === reportDate OR
   - Submitted Date === reportDate OR
   - Last Updated starts with reportDate
5. Calculate metrics:
   - Files received (Creation Date === reportDate)
   - Files sent to lenders (Status === SENT_TO_NBFC, Last Updated starts with reportDate)
   - Files approved (Status === APPROVED, Last Updated starts with reportDate)
   - Files rejected (Status === REJECTED, Last Updated starts with reportDate)
   - Total disbursed (Status === DISBURSED, sum of Approved Loan Amount)
   - Pending queries (Status === QUERY_WITH_CLIENT or CREDIT_QUERY_WITH_KAM)
6. Generate summary content with metrics and highlights
7. Create daily summary report:
   - Generate ID: `SUMMARY-{date}`
   - Set Report Date, Summary Content, Generated Timestamp
   - Set Delivered To: "Email to Management, Dashboard" (comma-separated)
8. POST to `Daily Summary Report` webhook
9. Return report data with metrics

**Tables Used:**
- `Loan Application` (GET)
- `Daily Summary Report` (POST)

---

### GET /reports/daily/:date

**Purpose:** Get daily summary report for a specific date

**Logic Flow:**
1. Extract `date` from params
2. Fetch `Daily Summary Report` table
3. Find report where Report Date === date
4. Return report data

**Tables Used:**
- `Daily Summary Report` (GET)

---

## User Management Operations

### GET /kam-users

**Purpose:** List all KAM users

**Logic Flow:**
1. Verify user role is 'credit_team' or 'admin'
2. Fetch `KAM Users` table
3. Map to response format (exclude sensitive data)
4. Return KAM users

**Tables Used:**
- `KAM Users` (GET)

---

### GET /kam-users/:id

**Purpose:** Get single KAM user

**Logic Flow:**
1. Extract `id` from params
2. Fetch `KAM Users` table
3. Find user by id or KAM ID
4. Return user data

**Tables Used:**
- `KAM Users` (GET)

---

### GET /user-accounts

**Purpose:** List all user accounts (admin only)

**Logic Flow:**
1. Verify user role is 'admin' or 'credit_team'
2. Fetch `User Accounts` table
3. Map to response format (exclude password)
4. Return user accounts

**Tables Used:**
- `User Accounts` (GET)

---

### GET /user-accounts/:id

**Purpose:** Get single user account

**Logic Flow:**
1. Extract `id` from params
2. Fetch `User Accounts` table
3. Find account by id
4. Verify access (admin or own account)
5. Return account data (exclude password)

**Tables Used:**
- `User Accounts` (GET)

---

### PATCH /user-accounts/:id

**Purpose:** Update user account (admin only)

**Logic Flow:**
1. Verify user role is 'admin'
2. Extract `id` from params, `accountStatus`, `role`, `associatedProfile` from body
3. Fetch `User Accounts` table
4. Find account by id
5. Update data:
   - Set Account Status if provided
   - Set Role if provided
   - Set Associated Profile if provided
6. POST updated account
7. Log admin activity:
   - Action Type: `update_user_account`
8. Return success message

**Tables Used:**
- `User Accounts` (GET, POST)
- `Admin Activity Log` (POST)

---

## Product Operations

### GET /loan-products

**Purpose:** List all loan products

**Logic Flow:**
1. Extract query param: `activeOnly`
2. Fetch `Loan Products` table
3. Filter active products if activeOnly === 'true' (Active === 'True')
4. Map to response format
5. Return products

**Tables Used:**
- `Loan Products` (GET)

---

### GET /loan-products/:id

**Purpose:** Get single loan product

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Loan Products` table
3. Find product by id or Product ID
4. Return product data

**Tables Used:**
- `Loan Products` (GET)

---

### GET /nbfc-partners

**Purpose:** List all NBFC partners

**Logic Flow:**
1. Extract query param: `activeOnly`
2. Fetch `NBFC Partners` table
3. Filter active partners if activeOnly === 'true' (Active === 'True')
4. Map to response format
5. Return partners

**Tables Used:**
- `NBFC Partners` (GET)

---

### GET /nbfc-partners/:id

**Purpose:** Get single NBFC partner

**Logic Flow:**
1. Extract `id` from params
2. Fetch `NBFC Partners` table
3. Find partner by id or Lender ID
4. Return partner data

**Tables Used:**
- `NBFC Partners` (GET)

---

## Form Category Operations

### GET /form-categories

**Purpose:** List all form categories

**Logic Flow:**
1. Fetch `Form Categories` table
2. Map to response format
3. Return categories

**Tables Used:**
- `Form Categories` (GET)

---

### GET /form-categories/:id

**Purpose:** Get single form category

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Form Categories` table
3. Find category by id
4. Return category data

**Tables Used:**
- `Form Categories` (GET)

---

### POST /form-categories

**Purpose:** Create new form category

**Logic Flow:**
1. Verify user role is 'credit_team' or 'kam'
2. Extract `categoryName`, `description`, `displayOrder`, `active` from body
3. Generate IDs: `CAT-{timestamp}-{random}`
4. Create category data:
   - Category ID: generated id
   - Category Name: categoryName
   - Description: description
   - Display Order: displayOrder or '0'
   - Active: 'True' or 'False' (default: 'True')
5. POST to `Form Categories` webhook
6. Log admin activity:
   - Action Type: `create_form_category`
7. Return category data

**Tables Used:**
- `Form Categories` (POST)
- `Admin Activity Log` (POST)

---

### PATCH /form-categories/:id

**Purpose:** Update form category

**Logic Flow:**
1. Verify user role is 'credit_team' or 'kam'
2. Extract `id` from params, `categoryName`, `description`, `displayOrder`, `active` from body
3. Fetch `Form Categories` table
4. Find category by id
5. Update data (use provided values or existing values)
6. POST updated category to `Form Categories` webhook
7. Log admin activity:
   - Action Type: `update_form_category`
8. Return updated category data

**Tables Used:**
- `Form Categories` (GET, POST)
- `Admin Activity Log` (POST)

---

### DELETE /form-categories/:id

**Purpose:** Delete/Deactivate form category

**Logic Flow:**
1. Verify user role is 'credit_team' or 'kam'
2. Extract `id` from params
3. Fetch `Form Categories` table
4. Find category by id
5. Update category:
   - Set Active to 'False' (soft delete)
   - Keep all other fields
6. POST updated category to `Form Categories` webhook
7. Log admin activity:
   - Action Type: `delete_form_category`
8. Return success message

**Tables Used:**
- `Form Categories` (GET, POST)
- `Admin Activity Log` (POST)

---

## Credit Team Users Operations

### GET /credit-team-users

**Purpose:** List all credit team users

**Logic Flow:**
1. Fetch `Credit Team Users` table
2. Map to response format
3. Return credit team users

**Tables Used:**
- `Credit Team Users` (GET)

---

### GET /credit-team-users/:id

**Purpose:** Get single credit team user

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Credit Team Users` table
3. Find user by id
4. Return user data

**Tables Used:**
- `Credit Team Users` (GET)

---

### POST /credit-team-users

**Purpose:** Create new credit team user

**Logic Flow:**
1. Extract user data from body: `name`, `email`, `phone`, `role`, `status`
2. Generate Credit User ID: `CREDIT-{timestamp}-{random}`
3. Create user data:
   - Credit User ID: generated id
   - Name: name
   - Email: email
   - Phone: phone
   - Role: role or 'credit_team'
   - Status: status or 'Active'
4. POST to `Credit Team Users` webhook
5. Log admin activity:
   - Action Type: `create_credit_team_user`
6. Return user data

**Tables Used:**
- `Credit Team Users` (POST)
- `Admin Activity Log` (POST)

---

### PATCH /credit-team-users/:id

**Purpose:** Update credit team user

**Logic Flow:**
1. Extract `id` from params, update data from body
2. Fetch `Credit Team Users` table
3. Find user by id
4. Update data (merge with existing)
5. POST updated user to `Credit Team Users` webhook
6. Log admin activity:
   - Action Type: `update_credit_team_user`
7. Return updated user data

**Tables Used:**
- `Credit Team Users` (GET, POST)
- `Admin Activity Log` (POST)

---

### DELETE /credit-team-users/:id

**Purpose:** Delete/Deactivate credit team user

**Logic Flow:**
1. Extract `id` from params
2. Fetch `Credit Team Users` table
3. Find user by id
4. Update user:
   - Set Status to 'Inactive' (soft delete)
5. POST updated user to `Credit Team Users` webhook
6. Log admin activity:
   - Action Type: `delete_credit_team_user`
7. Return success message

**Tables Used:**
- `Credit Team Users` (GET, POST)
- `Admin Activity Log` (POST)

---

## Summary

This document covers **80+ operations** across **16 controllers**, each with detailed logic flow including:

- **Input validation**
- **Data fetching** (using individual table webhooks)
- **Business logic**
- **Data updates** (POST operations)
- **Audit logging**
- **Notifications**
- **Error handling**

All operations now use individual table webhooks instead of fetching all data, resulting in:
- **Reduced webhook calls**
- **Faster response times**
- **Better scalability**
- **Clearer code structure**

