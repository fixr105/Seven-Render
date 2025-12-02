# Seven Fincorp Backend API Documentation

Complete API reference for the Seven Fincorp Loan Management & Credit Dashboard backend.

## Base URL

```
http://localhost:3000
```

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### POST /auth/login

Login and receive JWT token.

**Request Body:**
```json
{
  "email": "client@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "client@example.com",
      "role": "client",
      "clientId": "client-id",
      "name": "Client Name"
    },
    "token": "jwt-token-here"
  }
}
```

**Roles:** All

---

### GET /auth/me

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "client@example.com",
    "role": "client",
    "clientId": "client-id",
    "name": "Client Name"
  }
}
```

**Roles:** All authenticated users

---

## Client (DSA) Endpoints

### GET /client/dashboard

Get client dashboard overview with applications, ledger summary, queries, and payout requests.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "activeApplications": [
      {
        "id": "app-id",
        "fileId": "SF20250101001",
        "status": "under_kam_review",
        "applicantName": "John Doe",
        "requestedAmount": "5000000"
      }
    ],
    "ledgerSummary": {
      "totalEarned": 150000,
      "pending": 75000,
      "paid": 75000,
      "balance": 150000
    },
    "pendingQueries": [
      {
        "id": "query-id",
        "fileId": "SF20250101001",
        "message": "Please provide additional documents",
        "raisedBy": "KAM User",
        "timestamp": "2025-01-15T10:00:00Z"
      }
    ],
    "payoutRequests": [
      {
        "id": "request-id",
        "amount": 50000,
        "status": "Requested",
        "requestedDate": "2025-01-15"
      }
    ]
  }
}
```

**Roles:** CLIENT

---

### GET /client/form-config

Get form configuration for the client (categories, fields, required flags).

**Query Parameters:**
- `productId` (required): Loan product ID

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "cat-001",
      "categoryName": "Personal Information",
      "description": "Personal details",
      "displayOrder": 1,
      "fields": [
        {
          "fieldId": "field-001",
          "label": "Full Name",
          "type": "text",
          "placeholder": "Enter your full name",
          "options": "",
          "isRequired": true,
          "displayOrder": 1
        }
      ]
    }
  ]
}
```

**Roles:** CLIENT

---

## Loan Application Endpoints

### POST /loan-applications

Create a new draft loan application. **Always sends to applications webhook.**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": "product-001",
  "borrowerIdentifiers": {
    "pan": "ABCDE1234F",
    "name": "John Doe"
  }
}
```

**Fields sent to webhook:**
- `id` (for matching)
- `File ID`
- `Client`
- `Applicant Name`
- `Loan Product`
- `Requested Loan Amount`
- `Documents`
- `Status`
- `Assigned Credit Analyst`
- `Assigned NBFC`
- `Lender Decision Status`
- `Lender Decision Date`
- `Lender Decision Remarks`
- `Approved Loan Amount`
- `AI File Summary`
- `Form Data`
- `Creation Date`
- `Submitted Date`
- `Last Updated`

**Response:**
```json
{
  "success": true,
  "data": {
    "loanApplicationId": "app-id",
    "fileId": "SF20250101001"
  }
}
```

**Roles:** CLIENT

---

### POST /loan-applications/:id/form

Update draft application form data. **Always sends to applications webhook.**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "formData": {
    "field-001": "John Doe",
    "field-002": "ABCDE1234F"
  },
  "documentUploads": [
    {
      "fieldId": "field-001",
      "fileUrl": "https://example.com/doc.pdf",
      "fileName": "document.pdf",
      "mimeType": "application/pdf"
    }
  ]
}
```

**Fields sent to webhook:**
- All 19 exact fields (see POST /loan-applications above)

**Response:**
```json
{
  "success": true,
  "message": "Application form updated successfully"
}
```

**Roles:** CLIENT

---

### GET /loan-applications

List loan applications (filtered by user role).

**Query Parameters:**
- `status` (optional): Filter by status
- `dateFrom` (optional): Filter from date (YYYY-MM-DD)
- `dateTo` (optional): Filter to date (YYYY-MM-DD)
- `search` (optional): Search by file ID, applicant name, or client

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "app-id",
      "fileId": "SF20250101001",
      "client": "client-id",
      "applicantName": "John Doe",
      "product": "product-001",
      "requestedAmount": "5000000",
      "status": "under_kam_review",
      "creationDate": "2025-01-15"
    }
  ]
}
```

**Roles:** All authenticated users (filtered by role)

---

### GET /loan-applications/:id

Get single loan application with full details and audit log.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "app-id",
    "File ID": "SF20250101001",
    "Client": "client-id",
    "Applicant Name": "John Doe",
    "Loan Product": "product-001",
    "Requested Loan Amount": "5000000",
    "Status": "under_kam_review",
    "Form Data": {
      "field-001": "John Doe",
      "field-002": "ABCDE1234F"
    },
    "auditLog": [
      {
        "id": "log-id",
        "timestamp": "2025-01-15T10:00:00Z",
        "actor": "client@example.com",
        "actionType": "status_change",
        "message": "Application submitted",
        "resolved": false
      }
    ]
  }
}
```

**Roles:** All authenticated users (filtered by role)

---

### POST /loan-applications/:id/submit

Submit a draft application for KAM review. **Always sends to applications webhook.**

**Headers:**
```
Authorization: Bearer <token>
```

**Fields sent to webhook:**
- All 19 exact fields (see POST /loan-applications above)

**Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully"
}
```

**Roles:** CLIENT

---

## Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Error Response Format

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Loan Status Values

- `draft` - Draft (not submitted)
- `under_kam_review` - Under KAM Review
- `query_with_client` - Query Raised to Client
- `pending_credit_review` - Pending Credit Review
- `credit_query_with_kam` - Credit Query Back to KAM
- `in_negotiation` - In Negotiation
- `sent_to_nbfc` - Sent to NBFC
- `approved` - Approved
- `rejected` - Rejected
- `disbursed` - Disbursed
- `closed` - Closed

---

## User Roles

- `client` - DSA/Client
- `kam` - Key Account Manager
- `credit_team` - Credit Team
- `nbfc` - NBFC Partner

---

---

## KAM Endpoints

### GET /kam/dashboard

Get KAM dashboard with managed clients, files by stage, pending questions, and ledger disputes.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "client-id",
        "name": "Client Name",
        "email": "client@example.com",
        "activeApplications": 5
      }
    ],
    "filesByStage": {
      "underReview": 3,
      "queryPending": 2,
      "readyForCredit": 1
    },
    "pendingQuestionsFromCredit": [
      {
        "id": "query-id",
        "fileId": "SF20250101001",
        "message": "Please clarify..."
      }
    ],
    "ledgerDisputes": [
      {
        "id": "dispute-id",
        "client": "client-id",
        "amount": 50000,
        "status": "Under Query"
      }
    ]
  }
}
```

**Roles:** KAM

---

### POST /kam/clients

Create new client.

**Request Body:**
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "phone": "+91 9876543210",
  "kamId": "kam-id",
  "enabledModules": ["M1", "M2", "M3"]
}
```

**Roles:** KAM, CREDIT

---

### PATCH /kam/clients/:id/modules

Update client enabled modules.

**Request Body:**
```json
{
  "enabledModules": ["M1", "M2", "M3", "M4"]
}
```

**Roles:** KAM

---

### GET /kam/clients/:id/form-mappings

Get form mappings for a client.

**Roles:** KAM

---

### POST /kam/clients/:id/form-mappings

Create/update form mapping for a client.

**Request Body:**
```json
{
  "productId": "product-001",
  "categoryId": "cat-001",
  "fieldId": "field-001",
  "isRequired": true,
  "displayOrder": 1
}
```

**Roles:** KAM

---

### GET /kam/loan-applications

List loan applications for KAM's managed clients.

**Query Parameters:**
- `status` (optional)
- `clientId` (optional)

**Roles:** KAM

---

### POST /kam/loan-applications/:id/edit

Edit application during KAM review.

**Request Body:**
```json
{
  "formData": { "field-001": "updated value" },
  "notes": "Minor corrections made"
}
```

**Roles:** KAM

---

### POST /kam/loan-applications/:id/queries

Raise query to client.

**Request Body:**
```json
{
  "message": "Please provide additional documents",
  "fieldsRequested": ["field-001"],
  "documentsRequested": ["PAN", "Aadhar"],
  "allowsClientToEdit": true
}
```

**Roles:** KAM

---

### POST /kam/loan-applications/:id/forward-to-credit

Forward application to credit team.

**Roles:** KAM

---

## Credit Team Endpoints

### GET /credit/dashboard

Get credit dashboard with files by stage and aggregate metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "filesByStage": {
      "pendingCreditReview": 10,
      "queryWithKAM": 2,
      "inNegotiation": 3,
      "sentToNBFC": 5,
      "approved": 8,
      "rejected": 2,
      "disbursed": 6
    },
    "aggregateMetrics": {
      "filesReceivedToday": 5,
      "filesSentToLendersToday": 3,
      "filesApprovedToday": 2,
      "filesRejectedToday": 1,
      "totalDisbursedToday": 5000000,
      "pendingQueries": 5
    }
  }
}
```

**Roles:** CREDIT

---

### GET /credit/loan-applications

List all loan applications (with filters).

**Query Parameters:**
- `status`, `clientId`, `nbfcId`, `productId`, `dateFrom`, `dateTo`

**Roles:** CREDIT

---

### GET /credit/loan-applications/:id

Get single application with full details and AI summary.

**Roles:** CREDIT

---

### POST /credit/loan-applications/:id/queries

Raise credit query back to KAM.

**Request Body:**
```json
{
  "message": "Need clarification on...",
  "requestedDocs": ["Bank Statement"],
  "clarifications": ["Income verification"]
}
```

**Roles:** CREDIT

---

### POST /credit/loan-applications/:id/mark-in-negotiation

Mark application as in negotiation.

**Roles:** CREDIT

---

### POST /credit/loan-applications/:id/assign-nbfcs

Assign application to NBFC(s).

**Request Body:**
```json
{
  "nbfcIds": ["nbfc-001", "nbfc-002"]
}
```

**Roles:** CREDIT

---

### POST /credit/loan-applications/:id/nbfc-decision

Capture NBFC decision (for offline decisions).

**Request Body:**
```json
{
  "nbfcId": "nbfc-001",
  "decision": "Approved",
  "approvedAmount": 4500000,
  "terms": "12% interest, 5 years tenure"
}
```

**Roles:** CREDIT

---

### POST /credit/loan-applications/:id/mark-disbursed

Mark application as disbursed and create commission entry.

**Request Body:**
```json
{
  "disbursedAmount": 5000000,
  "disbursedDate": "2025-01-15",
  "lenderId": "nbfc-001"
}
```

**Roles:** CREDIT

---

### GET /credit/payout-requests

Get all pending payout requests.

**Roles:** CREDIT

---

### POST /credit/payout-requests/:id/approve

Approve payout request.

**Request Body:**
```json
{
  "approvedAmount": 50000,
  "note": "Approved for full amount"
}
```

**Roles:** CREDIT

---

### POST /credit/payout-requests/:id/reject

Reject payout request.

**Request Body:**
```json
{
  "reason": "Insufficient documentation"
}
```

**Roles:** CREDIT

---

## NBFC Endpoints

### GET /nbfc/dashboard

Get NBFC dashboard with assigned applications.

**Roles:** NBFC

---

### GET /nbfc/loan-applications

List applications assigned to this NBFC.

**Query Parameters:**
- `status`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`

**Roles:** NBFC

---

### GET /nbfc/loan-applications/:id

Get application details for underwriting.

**Roles:** NBFC

---

### POST /nbfc/loan-applications/:id/decision

Record NBFC decision.

**Request Body:**
```json
{
  "decision": "Approved",
  "approvedAmount": 4500000,
  "terms": "12% interest, 5 years tenure"
}
```

**Roles:** NBFC

---

## Commission Ledger Endpoints

### GET /clients/me/ledger

Get client's commission ledger with running balance.

**Roles:** CLIENT

---

### POST /clients/me/ledger/:ledgerEntryId/query

Create query/dispute on ledger entry.

**Request Body:**
```json
{
  "message": "Dispute this entry amount"
}
```

**Roles:** CLIENT

---

### POST /clients/me/payout-requests

Create payout request.

**Request Body:**
```json
{
  "amountRequested": 50000,
  "full": false
}
```

**Roles:** CLIENT

---

### GET /clients/me/payout-requests

Get client's payout requests.

**Roles:** CLIENT

---

## Reports Endpoints

### POST /reports/daily/generate

Generate daily summary report.

**Request Body:**
```json
{
  "date": "2025-01-15"
}
```

**Roles:** CREDIT

---

### GET /reports/daily/:date

Get daily summary report for a specific date.

**Roles:** CREDIT, KAM

---

## Audit & Activity Log Endpoints

### GET /loan-applications/:id/audit-log

Get file audit log for a loan application.

**Roles:** All authenticated users (filtered by role)

---

### GET /admin/activity-log

Get admin activity log.

**Query Parameters:**
- `dateFrom`, `dateTo`, `performedBy`, `actionType`, `targetEntity`

**Roles:** CREDIT

---

## AI Endpoints

### POST /loan-applications/:id/generate-summary

Generate AI file summary.

**Roles:** CREDIT, KAM

---

### GET /loan-applications/:id/summary

Get cached AI file summary.

**Roles:** All authenticated users (filtered by role)

---

---

## Credit Team User Management Endpoints

### GET /credit-team-users

List all credit team users.

**Roles:** CREDIT

---

### GET /credit-team-users/:id

Get single credit team user.

**Roles:** CREDIT

---

### POST /credit-team-users

Create new credit team user. **Always sends to CREDITTEAMUSERS webhook.**

**Request Body:**
```json
{
  "name": "John Credit Analyst",
  "email": "john.credit@example.com",
  "phone": "+91 9876543210",
  "role": "credit_team",
  "status": "Active"
}
```

**Fields sent to webhook:**
- `id` (for matching)
- `Credit User ID`
- `Name`
- `Email`
- `Phone`
- `Role`
- `Status`

**Roles:** CREDIT

---

### PATCH /credit-team-users/:id

Update credit team user. **Always sends to CREDITTEAMUSERS webhook.**

**Request Body:**
```json
{
  "name": "John Credit Analyst Updated",
  "email": "john.updated@example.com",
  "phone": "+91 9876543211",
  "status": "Active"
}
```

**Fields sent to webhook:**
- `id` (for matching)
- `Credit User ID`
- `Name`
- `Email`
- `Phone`
- `Role`
- `Status`

**Roles:** CREDIT

---

### DELETE /credit-team-users/:id

Deactivate credit team user (sets status to Disabled). **Always sends to CREDITTEAMUSERS webhook.**

**Roles:** CREDIT

---

## Form Category Endpoints

### GET /form-categories

List all form categories.

**Roles:** All authenticated users

---

### GET /form-categories/:id

Get single form category.

**Roles:** All authenticated users

---

### POST /form-categories

Create new form category. **Always sends to FormCategory webhook.**

**Request Body:**
```json
{
  "categoryName": "Personal Information",
  "description": "Category for personal information fields",
  "displayOrder": 1,
  "active": true
}
```

**Fields sent to webhook:**
- `id` (for matching)
- `Category ID`
- `Category Name`
- `Description`
- `Display Order`
- `Active`

**Roles:** CREDIT, KAM

---

### PATCH /form-categories/:id

Update form category. **Always sends to FormCategory webhook.**

**Request Body:**
```json
{
  "categoryName": "Personal Information Updated",
  "description": "Updated description",
  "displayOrder": 2,
  "active": true
}
```

**Fields sent to webhook:**
- `id` (for matching)
- `Category ID`
- `Category Name`
- `Description`
- `Display Order`
- `Active`

**Roles:** CREDIT, KAM

---

### DELETE /form-categories/:id

Deactivate form category (sets Active to False). **Always sends to FormCategory webhook.**

**Roles:** CREDIT, KAM

---

*All endpoints are fully implemented and ready for use.*

