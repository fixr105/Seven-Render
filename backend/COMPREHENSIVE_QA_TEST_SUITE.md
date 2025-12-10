# Comprehensive QA Test Suite - Seven Fincorp Dashboard

**Test Date:** 2025-01-27  
**Test Scope:** Full-stack end-to-end testing (Backend + Frontend Integration)  
**Test Method:** Automated + Manual verification  
**Status:** Ready for Execution

---

## Test Objectives

This comprehensive test suite validates:
1. ✅ All authentication and authorization flows
2. ✅ All API endpoints (GET, POST, PATCH, DELETE)
3. ✅ Role-based access control (RBAC) enforcement
4. ✅ Complete loan application workflow
5. ✅ Commission ledger and payout flows
6. ✅ Form builder and dynamic forms
7. ✅ Audit logging and reporting
8. ✅ Frontend API integration
9. ✅ Data filtering by role
10. ✅ Error handling and validation

---

## Prerequisites

### Test Users Setup

Create test users for each role:

```typescript
// CLIENT (DSA)
{
  email: "client@test.com",
  password: "Test@123",
  role: "client",
  clientId: "CLIENT001"
}

// KAM
{
  email: "kam@test.com",
  password: "Test@123",
  role: "kam",
  kamId: "KAM001"
}

// CREDIT TEAM
{
  email: "credit@test.com",
  password: "Test@123",
  role: "credit_team"
}

// NBFC
{
  email: "nbfc@test.com",
  password: "Test@123",
  role: "nbfc",
  nbfcId: "NBFC001"
}
```

### Test Data Setup

- At least 2 clients (one per KAM)
- At least 1 loan product
- At least 1 NBFC partner
- Form categories and fields configured

---

## Test Execution Plan

### Phase 1: Authentication & Authorization Tests

#### Test AUTH-1: Login with Valid Credentials

**Endpoint:** `POST /api/auth/login`

**Test Cases:**

| Test Case | Request | Expected Result | Status Code |
|-----------|---------|-----------------|-------------|
| AUTH-1.1 | Valid CLIENT credentials | Returns JWT token + user data with clientId | 200 |
| AUTH-1.2 | Valid KAM credentials | Returns JWT token + user data with kamId | 200 |
| AUTH-1.3 | Valid CREDIT credentials | Returns JWT token + user data | 200 |
| AUTH-1.4 | Valid NBFC credentials | Returns JWT token + user data with nbfcId | 200 |
| AUTH-1.5 | Invalid email | Error: "Invalid email or password" | 401 |
| AUTH-1.6 | Invalid password | Error: "Invalid email or password" | 401 |
| AUTH-1.7 | Missing credentials | Error: "Email and password required" | 400 |
| AUTH-1.8 | Inactive account | Error: "Account is not active" | 403 |

**Verification:**
- ✅ Token is valid JWT format
- ✅ Token contains correct role
- ✅ Token contains role-specific IDs (clientId, kamId, nbfcId)
- ✅ Token expires after configured time

---

#### Test AUTH-2: Get Current User

**Endpoint:** `GET /api/auth/me`

**Test Cases:**

| Test Case | Headers | Expected Result | Status Code |
|-----------|---------|-----------------|-------------|
| AUTH-2.1 | Valid CLIENT token | Returns CLIENT user data | 200 |
| AUTH-2.2 | Valid KAM token | Returns KAM user data | 200 |
| AUTH-2.3 | Valid CREDIT token | Returns CREDIT user data | 200 |
| AUTH-2.4 | Valid NBFC token | Returns NBFC user data | 200 |
| AUTH-2.5 | Missing token | Error: "Unauthorized" | 401 |
| AUTH-2.6 | Invalid token | Error: "Invalid token" | 401 |
| AUTH-2.7 | Expired token | Error: "Token expired" | 401 |

---

#### Test AUTH-3: Protected Endpoint Access

**Test Cases:**

| Test Case | Endpoint | Role | Token | Expected Result | Status Code |
|-----------|----------|------|-------|-----------------|-------------|
| AUTH-3.1 | `/api/client/dashboard` | CLIENT | Valid CLIENT token | Returns dashboard data | 200 |
| AUTH-3.2 | `/api/client/dashboard` | CLIENT | No token | Error: "Unauthorized" | 401 |
| AUTH-3.3 | `/api/client/dashboard` | KAM | Valid KAM token | Error: "Forbidden" | 403 |
| AUTH-3.4 | `/api/kam/dashboard` | KAM | Valid KAM token | Returns dashboard data | 200 |
| AUTH-3.5 | `/api/kam/dashboard` | CLIENT | Valid CLIENT token | Error: "Forbidden" | 403 |
| AUTH-3.6 | `/api/credit/dashboard` | CREDIT | Valid CREDIT token | Returns dashboard data | 200 |
| AUTH-3.7 | `/api/credit/dashboard` | KAM | Valid KAM token | Error: "Forbidden" | 403 |
| AUTH-3.8 | `/api/nbfc/dashboard` | NBFC | Valid NBFC token | Returns dashboard data | 200 |
| AUTH-3.9 | `/api/nbfc/dashboard` | CLIENT | Valid CLIENT token | Error: "Forbidden" | 403 |

---

### Phase 2: Client (DSA) Capability Tests

#### Test CLIENT-1: Client Dashboard

**Endpoint:** `GET /api/client/dashboard`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Expected Data | Verification |
|-----------|---------------|--------------|
| CLIENT-1.1 | Returns activeApplications array | ✅ Contains only client's applications |
| CLIENT-1.2 | Returns ledgerSummary | ✅ Shows correct totals (totalEarned, pending, paid, balance) |
| CLIENT-1.3 | Returns pendingQueries array | ✅ Contains only queries for client's files |
| CLIENT-1.4 | Returns payoutRequests array | ✅ Contains only client's payout requests |
| CLIENT-1.5 | Data filtered by clientId | ✅ No other client's data visible |

**Verification:**
- ✅ Response structure matches API spec
- ✅ All arrays are present (even if empty)
- ✅ Calculations are correct
- ✅ Data is filtered correctly

---

#### Test CLIENT-2: Form Configuration

**Endpoint:** `GET /api/client/form-config?productId=<id>`

**Prerequisites:** Authenticated CLIENT user, productId exists

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| CLIENT-2.1 | productId provided | Returns form config for product | ✅ Categories, fields, mappings present |
| CLIENT-2.2 | No productId | Returns default form config | ✅ All active categories/fields |
| CLIENT-2.3 | Invalid productId | Returns default or error | ✅ Handles gracefully |
| CLIENT-2.4 | Client-specific mappings | Returns client's custom mappings | ✅ Is Required flags correct |
| CLIENT-2.5 | Display order | Categories/fields sorted by displayOrder | ✅ Correct ordering |

**Verification:**
- ✅ Categories include all required fields
- ✅ Fields have correct types and options
- ✅ Required fields marked correctly
- ✅ Client form mappings applied

---

#### Test CLIENT-3: Create Loan Application

**Endpoint:** `POST /api/loan-applications`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CLIENT-3.1 | Valid productId + borrowerIdentifiers | Creates application, returns fileId | 200 |
| CLIENT-3.2 | Missing productId | Error: "productId is required" | 400 |
| CLIENT-3.3 | Invalid productId | Error: "Product not found" | 404 |
| CLIENT-3.4 | Creates with status DRAFT | Status = DRAFT | 200 |
| CLIENT-3.5 | File ID generated | Unique File ID (e.g., SF12345678) | 200 |
| CLIENT-3.6 | Admin Activity Log created | Log entry created | 200 |
| CLIENT-3.7 | Client ID set correctly | Client = authenticated client's ID | 200 |

**Verification:**
- ✅ Application created in Airtable
- ✅ File ID is unique
- ✅ Status is DRAFT
- ✅ Client ID matches authenticated user
- ✅ Admin Activity Log entry created

---

#### Test CLIENT-4: Update Application Form

**Endpoint:** `POST /api/loan-applications/:id/form`

**Prerequisites:** Authenticated CLIENT user, application in DRAFT or QUERY_WITH_CLIENT status

**Test Cases:**

| Test Case | Application Status | Request Body | Expected Result | Status Code |
|-----------|-------------------|--------------|-----------------|-------------|
| CLIENT-4.1 | DRAFT | Valid formData | Updates form data | 200 |
| CLIENT-4.2 | QUERY_WITH_CLIENT | Valid formData | Updates form data | 200 |
| CLIENT-4.3 | UNDER_KAM_REVIEW | Valid formData | Error: "Cannot edit in current status" | 400 |
| CLIENT-4.4 | DRAFT | formData + documentUploads | Updates form and documents | 200 |
| CLIENT-4.5 | DRAFT | Invalid application ID | Error: "Application not found" | 404 |
| CLIENT-4.6 | DRAFT | Other client's application | Error: "Application not found" | 404 |
| CLIENT-4.7 | DRAFT | Updates File Audit Log | Log entry created | 200 |

**Verification:**
- ✅ Form Data stored as JSON string
- ✅ Documents stored correctly
- ✅ Status restrictions enforced
- ✅ File Audit Log entry created

---

#### Test CLIENT-5: Submit Application

**Endpoint:** `POST /api/loan-applications/:id/submit`

**Prerequisites:** Authenticated CLIENT user, application in DRAFT or QUERY_WITH_CLIENT

**Test Cases:**

| Test Case | Application Status | Required Fields | Expected Result | Status Code |
|-----------|-------------------|-----------------|-----------------|-------------|
| CLIENT-5.1 | DRAFT | All required fields present | Status → UNDER_KAM_REVIEW | 200 |
| CLIENT-5.2 | QUERY_WITH_CLIENT | All required fields present | Status → UNDER_KAM_REVIEW | 200 |
| CLIENT-5.3 | DRAFT | Missing required fields | Error: "Required fields missing" | 400 |
| CLIENT-5.4 | UNDER_KAM_REVIEW | N/A | Error: "Already submitted" | 400 |
| CLIENT-5.5 | DRAFT | Submitted Date set | Submitted Date = today | 200 |
| CLIENT-5.6 | DRAFT | Admin Activity Log created | Log entry created | 200 |
| CLIENT-5.7 | DRAFT | File Audit Log created | Log entry created | 200 |

**Verification:**
- ✅ Status transitions correctly
- ✅ Submitted Date set
- ✅ Required field validation works
- ✅ Audit logs created

---

#### Test CLIENT-6: Withdraw Application

**Endpoint:** `POST /api/loan-applications/:id/withdraw`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Application Status | Expected Result | Status Code |
|-----------|-------------------|-----------------|-------------|
| CLIENT-6.1 | DRAFT | Status → WITHDRAWN | 200 |
| CLIENT-6.2 | UNDER_KAM_REVIEW | Status → WITHDRAWN | 200 |
| CLIENT-6.3 | QUERY_WITH_CLIENT | Status → WITHDRAWN | 200 |
| CLIENT-6.4 | PENDING_CREDIT_REVIEW | Error: "Cannot withdraw in current status" | 400 |
| CLIENT-6.5 | DISBURSED | Error: "Cannot withdraw in current status" | 400 |
| CLIENT-6.6 | DRAFT | File Audit Log created | Log entry created | 200 |
| CLIENT-6.7 | DRAFT | Admin Activity Log created | Log entry created | 200 |
| CLIENT-6.8 | DRAFT | Excluded from active lists | Not in dashboard | 200 |

**Verification:**
- ✅ Status transitions to WITHDRAWN
- ✅ Status restrictions enforced
- ✅ Audit logs created
- ✅ Excluded from active lists

---

#### Test CLIENT-7: View Applications List

**Endpoint:** `GET /api/loan-applications`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| CLIENT-7.1 | None | Returns all client's applications | ✅ Only client's data |
| CLIENT-7.2 | status=draft | Returns only DRAFT applications | ✅ Filtered correctly |
| CLIENT-7.3 | status=withdrawn | Returns only WITHDRAWN applications | ✅ Filtered correctly |
| CLIENT-7.4 | dateFrom=2025-01-01 | Returns applications from date | ✅ Filtered correctly |
| CLIENT-7.5 | search=John | Returns matching applications | ✅ Search works |
| CLIENT-7.6 | No other client's data | Only client's applications | ✅ RBAC enforced |

**Verification:**
- ✅ Data filtered by clientId
- ✅ Filters work correctly
- ✅ Search works
- ✅ No other client's data visible

---

#### Test CLIENT-8: View Single Application

**Endpoint:** `GET /api/loan-applications/:id`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Application Owner | Expected Result | Status Code |
|-----------|------------------|-----------------|-------------|
| CLIENT-8.1 | Own application | Returns full application data | 200 |
| CLIENT-8.2 | Other client's application | Error: "Application not found" | 404 |
| CLIENT-8.3 | Valid ID | Returns formData, status, queries | 200 |
| CLIENT-8.4 | Invalid ID | Error: "Application not found" | 404 |

**Verification:**
- ✅ Returns complete application data
- ✅ Includes formData, documents, status
- ✅ RBAC enforced

---

#### Test CLIENT-9: Respond to Query

**Endpoint:** `POST /api/loan-applications/:id/queries/:queryId/reply`

**Prerequisites:** Authenticated CLIENT user, query exists for application

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CLIENT-9.1 | Valid message | Creates reply in File Audit Log | 200 |
| CLIENT-9.2 | message + newDocs | Updates documents | 200 |
| CLIENT-9.3 | message + answers | Updates form data | 200 |
| CLIENT-9.4 | QUERY_WITH_CLIENT status | Status → UNDER_KAM_REVIEW | 200 |
| CLIENT-9.5 | Invalid queryId | Error: "Query not found" | 404 |
| CLIENT-9.6 | Other client's query | Error: "Query not found" | 404 |

**Verification:**
- ✅ Reply created in File Audit Log
- ✅ Form data updated if provided
- ✅ Documents updated if provided
- ✅ Status transitions if applicable

---

#### Test CLIENT-10: Commission Ledger

**Endpoint:** `GET /api/clients/me/ledger`

**Prerequisites:** Authenticated CLIENT user

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| CLIENT-10.1 | Returns ledger entries | ✅ Only client's entries |
| CLIENT-10.2 | Returns running balance | ✅ Balance calculated correctly |
| CLIENT-10.3 | Sorted by date (newest first) | ✅ Correct sorting |
| CLIENT-10.4 | No other client's data | ✅ RBAC enforced |

**Endpoint:** `GET /api/clients/me/ledger/:ledgerEntryId`

**Test Cases:**

| Test Case | Entry Owner | Expected Result | Status Code |
|-----------|------------|-----------------|-------------|
| CLIENT-10.5 | Own entry | Returns entry details | 200 |
| CLIENT-10.6 | Other client's entry | Error: "Access denied" | 403 |

**Endpoint:** `POST /api/clients/me/ledger/:ledgerEntryId/query`

**Test Cases:**

| Test Case | Expected Result | Status Code |
|-----------|-----------------|-------------|
| CLIENT-10.7 | Creates query, sets Dispute Status | 200 |
| CLIENT-10.8 | Creates File Audit Log entry | 200 |

---

#### Test CLIENT-11: Payout Requests

**Endpoint:** `POST /api/clients/me/payout-requests`

**Prerequisites:** Authenticated CLIENT user with positive balance

**Test Cases:**

| Test Case | Request Body | Balance | Expected Result | Status Code |
|-----------|--------------|---------|-----------------|-------------|
| CLIENT-11.1 | amountRequested=1000 | 5000 | Creates payout request | 200 |
| CLIENT-11.2 | full=true | 5000 | Creates full payout request | 200 |
| CLIENT-11.3 | amountRequested=10000 | 5000 | Error: "Amount exceeds balance" | 400 |
| CLIENT-11.4 | amountRequested=1000 | 0 | Error: "No balance available" | 400 |
| CLIENT-11.5 | Creates File Audit Log entry | N/A | Log entry created | 200 |

**Endpoint:** `GET /api/clients/me/payout-requests`

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| CLIENT-11.6 | Returns payout requests | ✅ Only client's requests |
| CLIENT-11.7 | Includes status | ✅ Status present |

---

### Phase 3: KAM Capability Tests

#### Test KAM-1: KAM Dashboard

**Endpoint:** `GET /api/kam/dashboard`

**Prerequisites:** Authenticated KAM user

**Test Cases:**

| Test Case | Expected Data | Verification |
|-----------|---------------|--------------|
| KAM-1.1 | Returns managed clients | ✅ Only KAM's clients |
| KAM-1.2 | Returns filesByStage counts | ✅ Correct counts |
| KAM-1.3 | Returns pendingQuestionsFromCredit | ✅ Only for KAM's files |
| KAM-1.4 | Returns ledgerDisputes | ✅ Only for KAM's clients |

**Verification:**
- ✅ Data filtered by KAM's managed clients
- ✅ All metrics correct
- ✅ No other KAM's data visible

---

#### Test KAM-2: Client Management

**Endpoint:** `POST /api/kam/clients`

**Prerequisites:** Authenticated KAM user

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| KAM-2.1 | Valid client data | Creates client + user account | 200 |
| KAM-2.2 | Missing required fields | Error: "Name and email required" | 400 |
| KAM-2.3 | Duplicate email | Error: "Email already exists" | 400 |
| KAM-2.4 | Sets Assigned KAM | Assigned KAM = authenticated KAM | 200 |
| KAM-2.5 | Creates Admin Activity Log | Log entry created | 200 |

**Endpoint:** `GET /api/kam/clients`

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| KAM-2.6 | Returns managed clients | ✅ Only KAM's clients |
| KAM-2.7 | Search filter works | ✅ Search by name/email |

**Endpoint:** `GET /api/kam/clients/:id`

**Test Cases:**

| Test Case | Client Owner | Expected Result | Status Code |
|-----------|-------------|-----------------|-------------|
| KAM-2.8 | Own client | Returns client details | 200 |
| KAM-2.9 | Other KAM's client | Error: "Access denied" | 403 |

**Endpoint:** `PATCH /api/kam/clients/:id/modules`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| KAM-2.10 | enabledModules=['M1','M2'] | Updates modules | 200 |
| KAM-2.11 | commissionRate=1.5 | Updates commission rate | 200 |
| KAM-2.12 | Creates Admin Activity Log | Log entry created | 200 |

---

#### Test KAM-3: Form Mappings

**Endpoint:** `GET /api/kam/clients/:id/form-mappings`

**Prerequisites:** Authenticated KAM user, client exists

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| KAM-3.1 | Returns form mappings | ✅ Only for specified client |
| KAM-3.2 | Includes categories and fields | ✅ Complete mapping data |

**Endpoint:** `POST /api/kam/clients/:id/form-mappings`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| KAM-3.3 | Single mapping | Creates mapping | 200 |
| KAM-3.4 | Bulk mappings (modules) | Creates multiple mappings | 200 |
| KAM-3.5 | Creates Admin Activity Log | Log entry created | 200 |

---

#### Test KAM-4: Loan Application Management

**Endpoint:** `GET /api/kam/loan-applications`

**Prerequisites:** Authenticated KAM user

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| KAM-4.1 | None | Returns managed clients' applications | ✅ Filtered correctly |
| KAM-4.2 | status=under_kam_review | Returns only UNDER_KAM_REVIEW | ✅ Filtered correctly |
| KAM-4.3 | clientId=<id> | Returns only that client's apps | ✅ Filtered correctly |

**Endpoint:** `POST /api/kam/loan-applications/:id/edit`

**Prerequisites:** Application in KAM stages

**Test Cases:**

| Test Case | Application Status | Expected Result | Status Code |
|-----------|-------------------|-----------------|-------------|
| KAM-4.4 | UNDER_KAM_REVIEW | Updates application | 200 |
| KAM-4.5 | QUERY_WITH_CLIENT | Updates application | 200 |
| KAM-4.6 | PENDING_CREDIT_REVIEW | Error: "Cannot edit in current status" | 400 |
| KAM-4.7 | Creates File Audit Log | Log entry with old→new values | 200 |

**Endpoint:** `POST /api/kam/loan-applications/:id/queries`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| KAM-4.8 | Valid query message | Creates query, status → QUERY_WITH_CLIENT | 200 |
| KAM-4.9 | Creates File Audit Log | Log entry created | 200 |
| KAM-4.10 | Creates Admin Activity Log | Log entry created | 200 |

**Endpoint:** `POST /api/kam/loan-applications/:id/forward-to-credit`

**Prerequisites:** Application in UNDER_KAM_REVIEW, all required fields complete

**Test Cases:**

| Test Case | Required Fields | Expected Result | Status Code |
|-----------|----------------|-----------------|-------------|
| KAM-4.11 | All complete | Status → PENDING_CREDIT_REVIEW | 200 |
| KAM-4.12 | Missing required fields | Error: "Required fields missing" | 400 |
| KAM-4.13 | Locks client editing | Client cannot edit | 200 |
| KAM-4.14 | Creates audit logs | File + Admin logs created | 200 |

---

#### Test KAM-5: KAM Ledger View

**Endpoint:** `GET /api/kam/ledger?clientId=<id>`

**Prerequisites:** Authenticated KAM user, clientId is managed by KAM

**Test Cases:**

| Test Case | Client Owner | Expected Result | Status Code |
|-----------|-------------|-----------------|-------------|
| KAM-5.1 | Own managed client | Returns client's ledger | 200 |
| KAM-5.2 | Other KAM's client | Error: "Access denied" | 403 |
| KAM-5.3 | Missing clientId | Error: "clientId required" | 400 |
| KAM-5.4 | Returns running balance | Balance calculated correctly | 200 |

---

### Phase 4: Credit Team Capability Tests

#### Test CREDIT-1: Credit Dashboard

**Endpoint:** `GET /api/credit/dashboard`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Expected Data | Verification |
|-----------|---------------|--------------|
| CREDIT-1.1 | Returns filesByStage | ✅ All statuses counted |
| CREDIT-1.2 | Returns aggregateMetrics | ✅ Today's metrics correct |
| CREDIT-1.3 | Shows all applications | ✅ No filtering (sees all) |

---

#### Test CREDIT-2: Application Management

**Endpoint:** `GET /api/credit/loan-applications`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| CREDIT-2.1 | None | Returns ALL applications | ✅ No filtering |
| CREDIT-2.2 | status=pending_credit_review | Returns filtered | ✅ Filter works |
| CREDIT-2.3 | kamId=<id> | Returns filtered | ✅ Filter works |

**Endpoint:** `GET /api/credit/loan-applications/:id`

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| CREDIT-2.4 | Returns full application | ✅ Includes AI summary if available |
| CREDIT-2.5 | Returns all data | ✅ Complete application data |

---

#### Test CREDIT-3: Query Management

**Endpoint:** `POST /api/credit/loan-applications/:id/queries`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-3.1 | Valid query message | Creates query, status → CREDIT_QUERY_WITH_KAM | 200 |
| CREDIT-3.2 | Creates File Audit Log | Log entry created | 200 |

---

#### Test CREDIT-4: Status Transitions

**Endpoint:** `POST /api/credit/loan-applications/:id/mark-in-negotiation`

**Test Cases:**

| Test Case | Expected Result | Status Code |
|-----------|-----------------|-------------|
| CREDIT-4.1 | Status → IN_NEGOTIATION | 200 |
| CREDIT-4.2 | Creates audit logs | File + Admin logs | 200 |

**Endpoint:** `POST /api/credit/loan-applications/:id/assign-nbfcs`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-4.3 | nbfcIds=['NBFC001'] | Status → SENT_TO_NBFC | 200 |
| CREDIT-4.4 | nbfcIds=['NBFC001','NBFC002'] | Multiple NBFCs assigned | 200 |
| CREDIT-4.5 | Creates Admin Activity Log | Log entry created | 200 |

**Endpoint:** `POST /api/credit/loan-applications/:id/nbfc-decision`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-4.6 | decision=APPROVED | Status → APPROVED | 200 |
| CREDIT-4.7 | decision=REJECTED | Status → REJECTED | 200 |
| CREDIT-4.8 | All NBFCs rejected | Status → REJECTED | 200 |
| CREDIT-4.9 | Any NBFC approved | Status → APPROVED | 200 |
| CREDIT-4.10 | Creates File Audit Log | Log entry created | 200 |

---

#### Test CREDIT-5: Disbursement & Commission

**Endpoint:** `POST /api/credit/loan-applications/:id/mark-disbursed`

**Prerequisites:** Authenticated CREDIT user, application in APPROVED status

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-5.1 | Valid disbursement data | Status → DISBURSED | 200 |
| CREDIT-5.2 | Creates Commission Ledger entry | Entry created automatically | 200 |
| CREDIT-5.3 | Commission calculated correctly | (amount * rate) / 100 | 200 |
| CREDIT-5.4 | Payout vs Payin determined | Positive/negative amount | 200 |
| CREDIT-5.5 | Creates audit logs | File + Admin logs | 200 |
| CREDIT-5.6 | Sends notification | Client notified | 200 |

**Verification:**
- ✅ Commission Ledger entry created
- ✅ Payout Amount calculated correctly
- ✅ Commission Rate fetched from Clients table
- ✅ Entry type (Payout/Payin) determined correctly

---

#### Test CREDIT-6: Loan Closure

**Endpoint:** `POST /api/credit/loan-applications/:id/close`

**Prerequisites:** Authenticated CREDIT user, application in DISBURSED status

**Test Cases:**

| Test Case | Application Status | Expected Result | Status Code |
|-----------|-------------------|-----------------|-------------|
| CREDIT-6.1 | DISBURSED | Status → CLOSED | 200 |
| CREDIT-6.2 | APPROVED | Status → CLOSED | 200 |
| CREDIT-6.3 | Creates audit logs | File + Admin logs | 200 |
| CREDIT-6.4 | Excluded from active lists | Not in dashboard | 200 |
| CREDIT-6.5 | Accessible via status filter | Can retrieve with status=CLOSED | 200 |

---

#### Test CREDIT-7: Payout Management

**Endpoint:** `GET /api/credit/payout-requests`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| CREDIT-7.1 | Returns all pending requests | ✅ All clients' requests |
| CREDIT-7.2 | Filters by status | ✅ Only "Requested" status |

**Endpoint:** `POST /api/credit/payout-requests/:id/approve`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-7.3 | approvedAmount provided | Creates negative ledger entry | 200 |
| CREDIT-7.4 | Updates original entry | Payout Request → "Paid" | 200 |
| CREDIT-7.5 | Creates File Audit Log | Log entry created | 200 |
| CREDIT-7.6 | Sends notification | Client notified | 200 |

**Endpoint:** `POST /api/credit/payout-requests/:id/reject`

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| CREDIT-7.7 | reason provided | Updates entry to "Rejected" | 200 |
| CREDIT-7.8 | Creates File Audit Log | Log entry with reason | 200 |
| CREDIT-7.9 | Sends notification | Client notified | 200 |

---

#### Test CREDIT-8: Credit Ledger View

**Endpoint:** `GET /api/credit/ledger`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| CREDIT-8.1 | None | Returns ALL ledger entries | ✅ No filtering |
| CREDIT-8.2 | clientId=<id> | Returns filtered entries | ✅ Filter works |
| CREDIT-8.3 | dateFrom + dateTo | Returns filtered entries | ✅ Date filter works |
| CREDIT-8.4 | Returns aggregated stats | totalPayable, totalPaid | ✅ Stats correct |

---

### Phase 5: NBFC Partner Capability Tests

#### Test NBFC-1: NBFC Dashboard

**Endpoint:** `GET /api/nbfc/dashboard`

**Prerequisites:** Authenticated NBFC user

**Test Cases:**

| Test Case | Expected Result | Verification |
|-----------|-----------------|--------------|
| NBFC-1.1 | Returns assigned applications | ✅ Only NBFC's applications |
| NBFC-1.2 | No other NBFC's data | ✅ RBAC enforced |

---

#### Test NBFC-2: Application Viewing

**Endpoint:** `GET /api/nbfc/loan-applications`

**Prerequisites:** Authenticated NBFC user

**Test Cases:**

| Test Case | Query Params | Expected Result | Verification |
|-----------|--------------|-----------------|--------------|
| NBFC-2.1 | None | Returns assigned applications | ✅ Filtered by NBFC |
| NBFC-2.2 | status=sent_to_nbfc | Returns filtered | ✅ Filter works |
| NBFC-2.3 | No other NBFC's data | Only assigned applications | ✅ RBAC enforced |

**Endpoint:** `GET /api/nbfc/loan-applications/:id`

**Test Cases:**

| Test Case | Application Assignment | Expected Result | Status Code |
|-----------|----------------------|-----------------|-------------|
| NBFC-2.4 | Assigned to NBFC | Returns application details | 200 |
| NBFC-2.5 | Not assigned | Error: "Application not found" | 404 |

---

#### Test NBFC-3: Record Decision

**Endpoint:** `POST /api/nbfc/loan-applications/:id/decision`

**Prerequisites:** Authenticated NBFC user, application assigned to NBFC

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| NBFC-3.1 | decision=APPROVED, approvedAmount | Status → APPROVED | 200 |
| NBFC-3.2 | decision=REJECTED, reason | Status → REJECTED | 200 |
| NBFC-3.3 | decision=NEEDS_CLARIFICATION | Status updated | 200 |
| NBFC-3.4 | Updates Lender Decision fields | Fields updated | 200 |
| NBFC-3.5 | Creates File Audit Log | Log entry created | 200 |
| NBFC-3.6 | Not assigned to NBFC | Error: "Access denied" | 403 |

---

### Phase 6: Audit & Reporting Tests

#### Test AUDIT-1: File Audit Log

**Endpoint:** `GET /api/loan-applications/:id/audit-log`

**Prerequisites:** Authenticated user with access to application

**Test Cases:**

| Test Case | User Role | Application Owner | Expected Result | Status Code |
|-----------|----------|------------------|-----------------|-------------|
| AUDIT-1.1 | CLIENT | Own application | Returns audit log | 200 |
| AUDIT-1.2 | CLIENT | Other client's | Error: "Access denied" | 403 |
| AUDIT-1.3 | KAM | Managed client's | Returns audit log | 200 |
| AUDIT-1.4 | KAM | Other KAM's client | Error: "Access denied" | 403 |
| AUDIT-1.5 | CREDIT | Any application | Returns audit log | 200 |
| AUDIT-1.6 | NBFC | Assigned application | Returns audit log | 200 |
| AUDIT-1.7 | NBFC | Not assigned | Error: "Access denied" | 403 |

**Verification:**
- ✅ Returns all audit entries for file
- ✅ Sorted by timestamp
- ✅ RBAC enforced correctly

---

#### Test AUDIT-2: Admin Activity Log

**Endpoint:** `GET /api/admin/activity-log`

**Prerequisites:** Authenticated CREDIT user (admin)

**Test Cases:**

| Test Case | User Role | Expected Result | Status Code |
|-----------|----------|-----------------|-------------|
| AUDIT-2.1 | CREDIT | Returns activity log | 200 |
| AUDIT-2.2 | CLIENT | Error: "Forbidden" | 403 |
| AUDIT-2.3 | KAM | Error: "Forbidden" | 403 |
| AUDIT-2.4 | Query params work | Filtered results | 200 |

**Query Parameters:**
- `dateFrom` - Filter from date
- `dateTo` - Filter to date
- `performedBy` - Filter by user
- `actionType` - Filter by action
- `targetEntity` - Filter by entity

---

#### Test REPORTS-1: Daily Summary Reports

**Endpoint:** `POST /api/reports/daily/generate`

**Prerequisites:** Authenticated CREDIT user

**Test Cases:**

| Test Case | Request Body | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| REPORTS-1.1 | date provided | Generates report for date | 200 |
| REPORTS-1.2 | No date | Generates report for today | 200 |
| REPORTS-1.3 | Aggregates metrics | Correct counts/amounts | 200 |
| REPORTS-1.4 | Creates Daily Summary entry | Entry in Airtable | 200 |
| REPORTS-1.5 | CLIENT role | Error: "Forbidden" | 403 |

**Endpoint:** `GET /api/reports/daily/:date`

**Test Cases:**

| Test Case | Date | Expected Result | Status Code |
|-----------|------|-----------------|-------------|
| REPORTS-1.6 | Valid date with report | Returns report | 200 |
| REPORTS-1.7 | Valid date, no report | Error: "Report not found" | 404 |

**Endpoint:** `GET /api/reports/daily/latest`

**Test Cases:**

| Test Case | Query Params | Expected Result | Status Code |
|-----------|--------------|-----------------|-------------|
| REPORTS-1.8 | None | Returns latest report | 200 |
| REPORTS-1.9 | before=2025-01-01 | Returns latest before date | 200 |
| REPORTS-1.10 | No reports exist | Error: "No report found" | 404 |

---

### Phase 7: AI Summary Tests

#### Test AI-1: Generate AI Summary

**Endpoint:** `POST /api/loan-applications/:id/generate-summary`

**Prerequisites:** Authenticated CREDIT or KAM user

**Test Cases:**

| Test Case | User Role | Expected Result | Status Code |
|-----------|----------|-----------------|-------------|
| AI-1.1 | CREDIT | Generates summary | 200 |
| AI-1.2 | KAM | Generates summary | 200 |
| AI-1.3 | CLIENT | Error: "Forbidden" | 403 |
| AI-1.4 | Updates AI File Summary field | Field updated | 200 |
| AI-1.5 | Creates File Audit Log | Log entry created | 200 |

**Endpoint:** `GET /api/loan-applications/:id/summary`

**Test Cases:**

| Test Case | Summary Exists | Expected Result | Status Code |
|-----------|---------------|-----------------|-------------|
| AI-1.6 | Yes | Returns cached summary | 200 |
| AI-1.7 | No | Error: "Summary not generated" | 404 |

---

### Phase 8: RBAC Enforcement Tests

#### Test RBAC-1: Cross-Role Access Denial

**Test Cases:**

| Test Case | Endpoint | Role | Expected Result | Status Code |
|-----------|----------|------|-----------------|-------------|
| RBAC-1.1 | `/api/client/dashboard` | KAM | Error: "Forbidden" | 403 |
| RBAC-1.2 | `/api/kam/clients` | CLIENT | Error: "Forbidden" | 403 |
| RBAC-1.3 | `/api/credit/dashboard` | KAM | Error: "Forbidden" | 403 |
| RBAC-1.4 | `/api/nbfc/dashboard` | CLIENT | Error: "Forbidden" | 403 |
| RBAC-1.5 | `/api/admin/activity-log` | CLIENT | Error: "Forbidden" | 403 |
| RBAC-1.6 | `/api/reports/daily/generate` | KAM | Error: "Forbidden" | 403 |
| RBAC-1.7 | `/api/loan-applications` (POST) | KAM | Error: "Forbidden" | 403 |
| RBAC-1.8 | `/api/credit/payout-requests/:id/approve` | CLIENT | Error: "Forbidden" | 403 |

---

#### Test RBAC-2: Data Isolation

**Test Cases:**

| Test Case | Endpoint | Role | Expected Result | Verification |
|-----------|----------|------|-----------------|--------------|
| RBAC-2.1 | `/api/loan-applications` | CLIENT | Only own applications | ✅ Filtered |
| RBAC-2.2 | `/api/loan-applications` | KAM | Only managed clients' apps | ✅ Filtered |
| RBAC-2.3 | `/api/loan-applications` | CREDIT | All applications | ✅ No filtering |
| RBAC-2.4 | `/api/loan-applications` | NBFC | Only assigned applications | ✅ Filtered |
| RBAC-2.5 | `/api/clients/me/ledger` | CLIENT | Only own ledger | ✅ Filtered |
| RBAC-2.6 | `/api/kam/ledger?clientId=<id>` | KAM | Only if client managed | ✅ Validated |
| RBAC-2.7 | `/api/credit/ledger` | CREDIT | All ledger entries | ✅ No filtering |

---

#### Test RBAC-3: Action Restrictions

**Test Cases:**

| Test Case | Action | Role | Expected Result | Status Code |
|-----------|--------|------|-----------------|-------------|
| RBAC-3.1 | Create client | KAM | Success | 200 |
| RBAC-3.2 | Create client | CLIENT | Error: "Forbidden" | 403 |
| RBAC-3.3 | Mark disbursed | CREDIT | Success | 200 |
| RBAC-3.4 | Mark disbursed | KAM | Error: "Forbidden" | 403 |
| RBAC-3.5 | Approve payout | CREDIT | Success | 200 |
| RBAC-3.6 | Approve payout | CLIENT | Error: "Forbidden" | 403 |
| RBAC-3.7 | Record NBFC decision | NBFC | Success | 200 |
| RBAC-3.8 | Record NBFC decision | CLIENT | Error: "Forbidden" | 403 |

---

### Phase 9: Error Handling & Validation Tests

#### Test VALID-1: Input Validation

**Test Cases:**

| Test Case | Endpoint | Invalid Input | Expected Result | Status Code |
|-----------|----------|---------------|-----------------|-------------|
| VALID-1.1 | `/api/loan-applications` | Missing productId | Error: "productId required" | 400 |
| VALID-1.2 | `/api/loan-applications/:id/form` | Invalid application ID | Error: "Application not found" | 404 |
| VALID-1.3 | `/api/kam/clients` | Missing name | Error: "Name required" | 400 |
| VALID-1.4 | `/api/credit/loan-applications/:id/mark-disbursed` | Missing disbursedAmount | Error: "disbursedAmount required" | 400 |
| VALID-1.5 | `/api/clients/me/payout-requests` | Negative amount | Error: "Amount must be positive" | 400 |
| VALID-1.6 | `/api/clients/me/payout-requests` | Amount > balance | Error: "Amount exceeds balance" | 400 |

---

#### Test VALID-2: Status Transition Validation

**Test Cases:**

| Test Case | Action | Current Status | Expected Result | Status Code |
|-----------|--------|----------------|-----------------|-------------|
| VALID-2.1 | Submit | DRAFT | Success | 200 |
| VALID-2.2 | Submit | UNDER_KAM_REVIEW | Error: "Already submitted" | 400 |
| VALID-2.3 | Edit (KAM) | UNDER_KAM_REVIEW | Success | 200 |
| VALID-2.4 | Edit (KAM) | PENDING_CREDIT_REVIEW | Error: "Cannot edit" | 400 |
| VALID-2.5 | Withdraw | DRAFT | Success | 200 |
| VALID-2.6 | Withdraw | DISBURSED | Error: "Cannot withdraw" | 400 |
| VALID-2.7 | Forward to Credit | UNDER_KAM_REVIEW | Success | 200 |
| VALID-2.8 | Forward to Credit | DRAFT | Error: "Invalid status" | 400 |
| VALID-2.9 | Mark Disbursed | APPROVED | Success | 200 |
| VALID-2.10 | Mark Disbursed | DRAFT | Error: "Invalid status" | 400 |

---

#### Test VALID-3: Error Response Format

**Test Cases:**

| Test Case | Error Type | Expected Response Format |
|-----------|-----------|---------------------------|
| VALID-3.1 | Validation error | `{ success: false, error: "message" }` |
| VALID-3.2 | Not found | `{ success: false, error: "message" }`, 404 |
| VALID-3.3 | Unauthorized | `{ success: false, error: "message" }`, 401 |
| VALID-3.4 | Forbidden | `{ success: false, error: "message" }`, 403 |
| VALID-3.5 | Server error | `{ success: false, error: "message" }`, 500 |

**Verification:**
- ✅ All errors return consistent format
- ✅ HTTP status codes correct
- ✅ Error messages are human-readable

---

### Phase 10: Integration & Workflow Tests

#### Test WORKFLOW-1: Complete Loan Application Flow

**End-to-End Test:**

1. **CLIENT creates application**
   - `POST /api/loan-applications` → Status: DRAFT ✅

2. **CLIENT updates form data**
   - `POST /api/loan-applications/:id/form` → Form data saved ✅

3. **CLIENT submits application**
   - `POST /api/loan-applications/:id/submit` → Status: UNDER_KAM_REVIEW ✅

4. **KAM reviews and raises query**
   - `POST /api/kam/loan-applications/:id/queries` → Status: QUERY_WITH_CLIENT ✅

5. **CLIENT responds to query**
   - `POST /api/loan-applications/:id/queries/:queryId/reply` → Status: UNDER_KAM_REVIEW ✅

6. **KAM forwards to Credit**
   - `POST /api/kam/loan-applications/:id/forward-to-credit` → Status: PENDING_CREDIT_REVIEW ✅

7. **Credit assigns NBFCs**
   - `POST /api/credit/loan-applications/:id/assign-nbfcs` → Status: SENT_TO_NBFC ✅

8. **NBFC records decision**
   - `POST /api/nbfc/loan-applications/:id/decision` → Status: APPROVED ✅

9. **Credit marks disbursed**
   - `POST /api/credit/loan-applications/:id/mark-disbursed` → Status: DISBURSED, Commission entry created ✅

10. **Credit closes application**
    - `POST /api/credit/loan-applications/:id/close` → Status: CLOSED ✅

**Verification:**
- ✅ All status transitions work
- ✅ Audit logs created at each step
- ✅ Notifications sent (if implemented)
- ✅ Commission calculated correctly

---

#### Test WORKFLOW-2: Commission Payout Flow

**End-to-End Test:**

1. **Loan disbursed** → Commission Ledger entry created ✅

2. **CLIENT views ledger**
   - `GET /api/clients/me/ledger` → Shows commission entry ✅

3. **CLIENT creates payout request**
   - `POST /api/clients/me/payout-requests` → Request created ✅

4. **CREDIT views payout requests**
   - `GET /api/credit/payout-requests` → Shows request ✅

5. **CREDIT approves payout**
   - `POST /api/credit/payout-requests/:id/approve` → Negative entry created, balance reduced ✅

6. **CLIENT views updated ledger**
   - `GET /api/clients/me/ledger` → Balance updated ✅

**Verification:**
- ✅ Commission calculated correctly
- ✅ Payout request workflow works
- ✅ Balance calculations correct
- ✅ Audit logs created

---

#### Test WORKFLOW-3: Withdrawal Flow

**End-to-End Test:**

1. **CLIENT creates application** → Status: DRAFT ✅

2. **CLIENT submits** → Status: UNDER_KAM_REVIEW ✅

3. **CLIENT withdraws**
   - `POST /api/loan-applications/:id/withdraw` → Status: WITHDRAWN ✅

4. **Verify exclusion from active lists**
   - `GET /api/loan-applications?status=under_kam_review` → Not in results ✅
   - `GET /api/loan-applications?status=withdrawn` → In results ✅

**Verification:**
- ✅ Withdrawal works in allowed statuses
- ✅ Excluded from active lists
- ✅ Accessible via status filter
- ✅ Audit logs created

---

### Phase 11: Frontend Integration Tests

#### Test FRONTEND-1: API Response Format

**Test Cases:**

| Test Case | Endpoint | Expected Response Structure | Verification |
|-----------|----------|----------------------------|--------------|
| FRONTEND-1.1 | All GET endpoints | `{ success: true, data: ... }` | ✅ Consistent format |
| FRONTEND-1.2 | All POST endpoints | `{ success: true, data: ..., message: ... }` | ✅ Consistent format |
| FRONTEND-1.3 | Error responses | `{ success: false, error: "..." }` | ✅ Consistent format |
| FRONTEND-1.4 | Array responses | `{ success: true, data: [...] }` | ✅ Arrays wrapped in data |
| FRONTEND-1.5 | Object responses | `{ success: true, data: {...} }` | ✅ Objects wrapped in data |

---

#### Test FRONTEND-2: Required Fields for Forms

**Test Cases:**

| Test Case | Endpoint | Expected Fields | Verification |
|-----------|----------|----------------|--------------|
| FRONTEND-2.1 | `/api/client/form-config` | categories, fields, mappings | ✅ All present |
| FRONTEND-2.2 | Form fields | fieldId, label, type, isRequired | ✅ All present |
| FRONTEND-2.3 | Form categories | categoryId, categoryName, displayOrder | ✅ All present |
| FRONTEND-2.4 | Client mappings | isRequired, displayOrder | ✅ All present |

---

#### Test FRONTEND-3: Dashboard Data Structure

**Test Cases:**

| Test Case | Dashboard | Expected Structure | Verification |
|-----------|-----------|-------------------|--------------|
| FRONTEND-3.1 | Client Dashboard | activeApplications, ledgerSummary, pendingQueries, payoutRequests | ✅ All present |
| FRONTEND-3.2 | KAM Dashboard | clients, filesByStage, pendingQuestionsFromCredit, ledgerDisputes | ✅ All present |
| FRONTEND-3.3 | Credit Dashboard | filesByStage, aggregateMetrics | ✅ All present |
| FRONTEND-3.4 | NBFC Dashboard | assignedApplications | ✅ All present |

---

### Phase 12: Performance & Cache Tests

#### Test PERF-1: Cache Effectiveness

**Test Cases:**

| Test Case | Action | Expected Result | Verification |
|-----------|--------|-----------------|--------------|
| PERF-1.1 | First GET request | Webhook called | ✅ Webhook executed |
| PERF-1.2 | Second GET request (within 30 min) | Cache used | ✅ No webhook call |
| PERF-1.3 | POST operation | Cache invalidated | ✅ Cache cleared |
| PERF-1.4 | GET after POST | Fresh webhook call | ✅ Webhook executed |

---

#### Test PERF-2: Concurrent Requests

**Test Cases:**

| Test Case | Scenario | Expected Result | Verification |
|-----------|----------|-----------------|--------------|
| PERF-2.1 | Multiple simultaneous GETs | Single webhook call | ✅ Deduplication works |
| PERF-2.2 | Parallel table fetches | All tables fetched | ✅ Parallel execution |

---

## Test Execution Script

### Automated Test Runner

Create a test script that executes all test cases:

```typescript
// test-suite.ts
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

interface TestResult {
  testCase: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  error?: string;
}

async function runTestSuite() {
  const results: TestResult[] = [];
  
  // Phase 1: Authentication
  // ... execute all AUTH tests
  
  // Phase 2: Client Capabilities
  // ... execute all CLIENT tests
  
  // ... continue for all phases
  
  // Generate report
  generateReport(results);
}
```

---

## Expected Test Results Summary

### Success Criteria

| Phase | Test Cases | Expected Pass | Critical |
|-------|-----------|---------------|----------|
| Phase 1: Authentication | 20 | 20 | ✅ Yes |
| Phase 2: Client | 50 | 50 | ✅ Yes |
| Phase 3: KAM | 30 | 30 | ✅ Yes |
| Phase 4: Credit | 40 | 40 | ✅ Yes |
| Phase 5: NBFC | 15 | 15 | ✅ Yes |
| Phase 6: Audit & Reports | 20 | 20 | ✅ Yes |
| Phase 7: AI Summary | 10 | 10 | ✅ Yes |
| Phase 8: RBAC | 25 | 25 | ✅ Yes |
| Phase 9: Validation | 20 | 20 | ✅ Yes |
| Phase 10: Workflows | 15 | 15 | ✅ Yes |
| Phase 11: Frontend | 15 | 15 | ✅ Yes |
| Phase 12: Performance | 10 | 10 | ✅ Yes |
| **TOTAL** | **270** | **270** | **100%** |

---

## Bug Report Template

### Test Failure Report

```markdown
## Test Failure: [TEST-CASE-ID]

**Feature:** [Feature Name]
**Endpoint:** [HTTP Method] [Endpoint Path]
**Test Case:** [Test Case Description]

**Expected:**
- Status Code: [Expected]
- Response: [Expected Response]

**Actual:**
- Status Code: [Actual]
- Response: [Actual Response]

**Issue Type:**
- [ ] Missing Endpoint
- [ ] Wrong Status Code
- [ ] RBAC Violation
- [ ] Data Filtering Issue
- [ ] Validation Missing
- [ ] Error Handling Issue
- [ ] Response Format Issue
- [ ] Performance Issue

**Suggested Fix:**
[Description of fix needed]

**Priority:** [High/Medium/Low]
```

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test users created for all roles
- [ ] Test data seeded (clients, products, NBFCs)
- [ ] Form categories and fields configured
- [ ] Backend server running
- [ ] Database/Airtable accessible
- [ ] Webhook URLs configured correctly

### Test Execution

- [ ] Phase 1: Authentication tests executed
- [ ] Phase 2: Client capability tests executed
- [ ] Phase 3: KAM capability tests executed
- [ ] Phase 4: Credit capability tests executed
- [ ] Phase 5: NBFC capability tests executed
- [ ] Phase 6: Audit & reporting tests executed
- [ ] Phase 7: AI summary tests executed
- [ ] Phase 8: RBAC tests executed
- [ ] Phase 9: Validation tests executed
- [ ] Phase 10: Workflow tests executed
- [ ] Phase 11: Frontend integration tests executed
- [ ] Phase 12: Performance tests executed

### Post-Test

- [ ] All test results recorded
- [ ] Bug report generated
- [ ] Coverage report generated
- [ ] Recommendations documented

---

## Test Report Output Format

### Summary Table

| Category | Total Tests | Passed | Failed | Pass Rate |
|----------|-------------|--------|--------|-----------|
| Authentication | 20 | X | Y | Z% |
| Client Capabilities | 50 | X | Y | Z% |
| KAM Capabilities | 30 | X | Y | Z% |
| Credit Capabilities | 40 | X | Y | Z% |
| NBFC Capabilities | 15 | X | Y | Z% |
| Audit & Reports | 20 | X | Y | Z% |
| AI Summary | 10 | X | Y | Z% |
| RBAC | 25 | X | Y | Z% |
| Validation | 20 | X | Y | Z% |
| Workflows | 15 | X | Y | Z% |
| Frontend Integration | 15 | X | Y | Z% |
| Performance | 10 | X | Y | Z% |
| **TOTAL** | **270** | **X** | **Y** | **Z%** |

### Failed Tests Detail

| Test ID | Feature | Endpoint | Issue Type | Priority | Suggested Fix |
|---------|---------|----------|------------|----------|---------------|
| [ID] | [Feature] | [Endpoint] | [Type] | [Priority] | [Fix] |

---

## Next Steps After Testing

1. **Fix Critical Issues** (Priority: High)
   - Authentication failures
   - RBAC violations
   - Missing endpoints
   - Data filtering issues

2. **Fix Medium Priority Issues**
   - Validation improvements
   - Error message clarity
   - Response format consistency

3. **Optimize Performance** (Priority: Low)
   - Cache optimization
   - Query optimization
   - Response time improvements

4. **Retest**
   - Re-run failed tests
   - Verify fixes
   - Update test report

---

**Test Suite Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Status:** Ready for Execution
