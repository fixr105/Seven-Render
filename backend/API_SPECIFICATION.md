# Seven Fincorp Loan Management & Credit Dashboard - Complete API Specification

**Version:** 1.0.0  
**Base URL:** `/api`  
**Authentication:** JWT Bearer Token  
**Date:** 2025-01-27

---

## Table of Contents

1. [Authentication & User Session](#1-authentication--user-session)
2. [Client (DSA) Capabilities](#2-client-dsa-capabilities)
3. [KAM Capabilities](#3-kam-capabilities)
4. [Credit Team Capabilities](#4-credit-team-capabilities)
5. [NBFC Partner Capabilities](#5-nbfc-partner-capabilities)
6. [Audit Log & Activity Log](#6-audit-log--activity-log)
7. [Daily Summary Reports](#7-daily-summary-reports)
8. [AI File Summary](#8-ai-file-summary)
9. [Common Types & Enums](#9-common-types--enums)

---

## 1. Authentication & User Session

### POST `/auth/login`

**Purpose:** Authenticate user and return JWT token

**Role:** Public (no authentication required)

**Request Body:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      role: 'client' | 'kam' | 'credit_team' | 'nbfc';
      clientId?: string;
      kamId?: string;
      nbfcId?: string;
      name?: string;
    };
    token: string; // JWT
  };
}
```

**Airtable Mapping:**
- Reads from `User Accounts` table
- For KAM: Also reads `KAM Users` table
- For Credit: Also reads `Credit Team Users` table
- For NBFC: Also reads `NBFC Partners` table

---

### GET `/auth/me`

**Purpose:** Get current authenticated user and access context

**Role:** Any authenticated user

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    email: string;
    role: 'client' | 'kam' | 'credit_team' | 'nbfc';
    clientId?: string;
    kamId?: string;
    nbfcId?: string;
    name?: string;
  };
}
```

---

## 2. Client (DSA) Capabilities

### GET `/client/dashboard`

**Purpose:** Get client dashboard overview

**Role:** CLIENT

**Response:**
```typescript
{
  success: boolean;
  data: {
    activeApplications: Array<{
      id: string;
      fileId: string;
      status: string;
      applicantName?: string;
      requestedAmount?: string;
    }>;
    ledgerSummary: {
      totalEarned: number;
      pending: number;
      paid: number;
      balance: number;
    };
    pendingQueries: Array<{
      id: string;
      fileId: string;
      message: string;
      raisedBy: string;
      timestamp: string;
    }>;
    payoutRequests: Array<{
      id: string;
      amount: number;
      status: string;
      requestedDate: string;
    }>;
  };
}
```

**Airtable Mapping:**
- `Loan Applications` - filtered by Client
- `Commission Ledger` - filtered by Client
- `File Auditing Log` - filtered by Client's files

---

### GET `/client/form-config`

**Purpose:** Get form configuration for client/product

**Role:** CLIENT

**Query Parameters:**
- `productId` (optional): Filter by product

**Response:**
```typescript
{
  success: boolean;
  data: {
    categories: Array<{
      id: string;
      categoryId: string;
      categoryName: string;
      description?: string;
      displayOrder: string;
      active: string;
    }>;
    fields: Array<{
      id: string;
      fieldId: string;
      category: string;
      fieldLabel: string;
      fieldType: string;
      fieldPlaceholder?: string;
      fieldOptions?: string;
      isMandatory: string;
      displayOrder: string;
      active: string;
    }>;
    mappings: Array<{
      id: string;
      mappingId: string;
      client: string;
      category: string;
      isRequired: string;
      displayOrder: string;
    }>;
  };
}
```

**Airtable Mapping:**
- `Client Form Mapping` - filtered by Client
- `Form Categories` - all active categories
- `Form Fields` - all active fields

---

### POST `/loan-applications`

**Purpose:** Create draft loan application

**Role:** CLIENT

**Request Body:**
```typescript
{
  productId: string;
  borrowerIdentifiers?: {
    pan?: string;
    name?: string;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    loanApplicationId: string;
    fileId: string;
  };
}
```

**Airtable Mapping:**
- Creates row in `Loan Applications` table
- Status = `DRAFT`
- Sets `Client` = authenticated client's ID
- Sets `Loan Product` = productId
- Logs to `Admin Activity log`

---

### POST `/loan-applications/:id/form`

**Purpose:** Update draft application form data

**Role:** CLIENT

**Request Body:**
```typescript
{
  formData: Record<string, any>; // { [fieldId]: value }
  documentUploads?: Array<{
    fieldId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
  }>;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Updates `Form Data` field (JSON string)
- Updates `Documents` field (comma-separated URLs)
- Only allowed if status = `DRAFT` or `QUERY_WITH_CLIENT`
- Logs to `File Auditing Log`

---

### POST `/loan-applications/:id/submit`

**Purpose:** Submit application for review

**Role:** CLIENT

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `UNDER_KAM_REVIEW`
- Sets `Submitted Date`
- Validates required fields + documents
- Logs to `Admin Activity log` + `File Auditing Log`

---

### GET `/loan-applications`

**Purpose:** List applications (filtered by role)

**Role:** CLIENT (sees only own), KAM, CREDIT, NBFC

**Query Parameters:**
- `status` (optional): Filter by status
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date
- `search` (optional): Search by borrower name/PAN

**Response:**
```typescript
{
  success: boolean;
  data: Array<LoanApplication>;
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Filters by role (CLIENT sees only own, KAM sees managed clients, etc.)

---

### GET `/loan-applications/:id`

**Purpose:** Get single application details

**Role:** CLIENT (own only), KAM, CREDIT, NBFC

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    fileId: string;
    client: string;
    applicantName: string;
    loanProduct: string;
    requestedLoanAmount: string;
    documents: string;
    status: string;
    formData: Record<string, any>;
    statusHistory: Array<StatusHistoryEntry>;
    queries: Array<QueryEntry>;
    ledgerEntry?: CommissionLedgerEntry;
    // ... all other fields
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Reads from `File Auditing Log` for status history and queries
- Reads from `Commission Ledger` if disbursed

---

### POST `/loan-applications/:id/queries/:queryId/reply`

**Purpose:** Reply to query from KAM/Credit

**Role:** CLIENT

**Request Body:**
```typescript
{
  message: string;
  newDocs?: Array<{
    fieldId: string;
    fileUrl: string;
  }>;
  updatedFields?: Record<string, any>;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Creates entry in `File Auditing Log` (linked to parent query)
- Updates `Loan Applications` if fields/docs updated
- May transition status back to `UNDER_KAM_REVIEW` when KAM acknowledges

---

### POST `/loan-applications/:id/withdraw`

**Purpose:** Withdraw application

**Role:** CLIENT

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    applicationId: string;
    fileId: string;
    previousStatus: string;
    newStatus: 'withdrawn';
  };
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `WITHDRAWN`
- Only allowed if status = `DRAFT`, `UNDER_KAM_REVIEW`, or `QUERY_WITH_CLIENT`
- Logs to `File Auditing Log` + `Admin Activity log`

---

### GET `/clients/me/ledger`

**Purpose:** View commission ledger

**Role:** CLIENT

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```typescript
{
  success: boolean;
  data: {
    entries: Array<CommissionLedgerEntry & { balance: number }>;
    currentBalance: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Filters by Client = authenticated client
- Calculates running balance

---

### GET `/clients/me/ledger/:ledgerEntryId`

**Purpose:** Get specific ledger entry detail

**Role:** CLIENT

**Response:**
```typescript
{
  success: boolean;
  data: CommissionLedgerEntry;
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Validates entry belongs to authenticated client

---

### POST `/clients/me/ledger/:ledgerEntryId/query`

**Purpose:** Raise query on ledger entry

**Role:** CLIENT

**Request Body:**
```typescript
{
  message: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Commission Ledger` row
- Sets `Dispute Status` = `UNDER_QUERY`
- Creates entry in `File Auditing Log` tagged with ledger entry

---

### POST `/clients/me/payout-requests`

**Purpose:** Create payout request

**Role:** CLIENT

**Request Body:**
```typescript
{
  amountRequested?: number;
  full?: boolean; // Request full balance
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    requestId: string;
    requestedAmount: number;
    currentBalance: number;
  };
}
```

**Airtable Mapping:**
- Validates against current positive balance
- Updates `Commission Ledger` row
- Sets `Payout Request` = "Requested"
- Creates entry in `File Auditing Log`

---

### GET `/clients/me/payout-requests`

**Purpose:** Get payout requests

**Role:** CLIENT

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    amount: number;
    status: string;
    requestedDate: string;
    description?: string;
  }>;
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Filters where `Payout Request` exists and !== 'False'

---

## 3. KAM Capabilities

### GET `/kam/dashboard`

**Purpose:** Get KAM dashboard overview

**Role:** KAM

**Response:**
```typescript
{
  success: boolean;
  data: {
    clients: Array<{
      id: string;
      name: string;
      email: string;
      activeApplications: number;
    }>;
    filesByStage: {
      underReview: number;
      queryPending: number;
      readyForCredit: number;
    };
    pendingQuestionsFromCredit: Array<{
      id: string;
      fileId: string;
      message: string;
    }>;
    ledgerDisputes: Array<{
      id: string;
      client: string;
      amount: number;
      status: string;
    }>;
  };
}
```

**Airtable Mapping:**
- `User Accounts` - clients with Role=client
- `Loan Applications` - filtered by managed clients
- `File Auditing Log` - queries from Credit
- `Commission Ledger` - disputes for managed clients

---

### POST `/kam/clients`

**Purpose:** Create new client

**Role:** KAM / CREDIT admin

**Request Body:**
```typescript
{
  name: string;
  contactPerson?: string;
  email: string;
  phone: string;
  commissionRate?: string;
  enabledModules?: string[]; // ['M1', 'M2', ...]
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    clientId: string;
    userId: string;
  };
}
```

**Airtable Mapping:**
- Creates row in `User Accounts` table (Role=client)
- Creates row in `Clients` table
- Links via `Associated Profile` field
- Sets `Assigned KAM` = authenticated KAM's ID
- Logs to `Admin Activity log`

---

### GET `/kam/clients`

**Purpose:** List clients managed by KAM

**Role:** KAM

**Query Parameters:**
- `search` (optional): Search by name/email
- `bypassCache` (optional): Force fresh fetch

**Response:**
```typescript
{
  success: boolean;
  data: Array<ClientEntity>;
}
```

**Airtable Mapping:**
- Reads from `Clients` table
- Filters where `Assigned KAM` = authenticated KAM's ID

---

### GET `/kam/clients/:id`

**Purpose:** Get client details

**Role:** KAM

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: string;
    clientId: string;
    clientName: string;
    primaryContactName?: string;
    contactEmailPhone?: string;
    assignedKAM?: string;
    enabledModules?: string[];
    commissionRate?: string;
    status?: string;
  };
}
```

**Airtable Mapping:**
- Reads from `Clients` table
- Validates client is managed by authenticated KAM

---

### PATCH `/kam/clients/:id/modules`

**Purpose:** Update client enabled modules

**Role:** KAM

**Request Body:**
```typescript
{
  enabledModules?: string[];
  commissionRate?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Clients` row
- Updates `Enabled Modules` field
- Logs to `Admin Activity log`

---

### GET `/kam/clients/:id/form-mappings`

**Purpose:** Get form mappings for client

**Role:** KAM

**Response:**
```typescript
{
  success: boolean;
  data: Array<ClientFormMapping>;
}
```

**Airtable Mapping:**
- Reads from `Client Form Mapping` table
- Filters by Client = clientId

---

### POST `/kam/clients/:id/form-mappings`

**Purpose:** Create/update form mappings

**Role:** KAM

**Request Body:**
```typescript
{
  category?: string;
  isRequired?: boolean;
  displayOrder?: number;
  modules?: string[]; // For bulk creation
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Creates/updates rows in `Client Form Mapping` table
- Logs to `Admin Activity log`

---

### GET `/kam/loan-applications`

**Purpose:** List applications for KAM's clients

**Role:** KAM

**Query Parameters:**
- `status` (optional): Filter by status
- `clientId` (optional): Filter by client
- `search` (optional): Search by file ID/applicant name

**Response:**
```typescript
{
  success: boolean;
  data: Array<LoanApplication>;
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Filters by managed clients

---

### POST `/kam/loan-applications/:id/edit`

**Purpose:** Edit application (minor corrections)

**Role:** KAM

**Request Body:**
```typescript
{
  formData?: Record<string, any>;
  notes?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Only allowed while in KAM stages
- Logs change details to `File Auditing Log` (old value → new value)

---

### POST `/kam/loan-applications/:id/queries`

**Purpose:** Raise query to client

**Role:** KAM

**Request Body:**
```typescript
{
  query: string;
  requestedFields?: string[];
  requestedDocuments?: string[];
  allowClientEdit?: boolean;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    queryId: string;
  };
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `QUERY_WITH_CLIENT`
- Creates entry in `File Auditing Log`
- Creates entry in `Admin Activity log`

---

### POST `/kam/loan-applications/:id/forward-to-credit`

**Purpose:** Approve and forward to Credit

**Role:** KAM

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `PENDING_CREDIT_REVIEW`
- Validates required fields + docs are complete
- Locks client editing
- Logs to `File Auditing Log` + `Admin Activity log`

---

### GET `/kam/ledger`

**Purpose:** View ledger for specific client

**Role:** KAM

**Query Parameters:**
- `clientId` (required): Client ID

**Response:**
```typescript
{
  success: boolean;
  data: {
    entries: Array<CommissionLedgerEntry & { balance: number }>;
    currentBalance: number;
    clientId: string;
  };
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Filters by clientId
- Validates client is managed by authenticated KAM

---

## 4. Credit Team Capabilities

### GET `/credit/dashboard`

**Purpose:** Get credit dashboard overview

**Role:** CREDIT

**Response:**
```typescript
{
  success: boolean;
  data: {
    filesByStage: {
      pendingCreditReview: number;
      queryWithKAM: number;
      inNegotiation: number;
      sentToNBFC: number;
      approved: number;
      rejected: number;
      disbursed: number;
    };
    aggregateMetrics: {
      filesReceivedToday: number;
      filesSentToLendersToday: number;
      filesApprovedToday: number;
      totalDisbursedToday: number;
      pendingQueries: number;
    };
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Aggregates by status and date

---

### GET `/credit/loan-applications`

**Purpose:** List all applications

**Role:** CREDIT

**Query Parameters:**
- `status` (optional): Filter by status
- `kamId` (optional): Filter by KAM
- `clientId` (optional): Filter by client
- `nbfcId` (optional): Filter by NBFC
- `productId` (optional): Filter by product
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date

**Response:**
```typescript
{
  success: boolean;
  data: Array<LoanApplication>;
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- No filtering (Credit sees all)

---

### GET `/credit/loan-applications/:id`

**Purpose:** Get application details with AI summary

**Role:** CREDIT

**Response:**
```typescript
{
  success: boolean;
  data: {
    ...LoanApplication;
    aiFileSummary?: string;
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Includes `AI File Summary` field if available

---

### POST `/credit/loan-applications/:id/queries`

**Purpose:** Raise query back to KAM

**Role:** CREDIT

**Request Body:**
```typescript
{
  query: string;
  requestedDocs?: string[];
  clarifications?: string[];
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    queryId: string;
  };
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `CREDIT_QUERY_WITH_KAM`
- Creates entry in `File Auditing Log`

---

### POST `/credit/loan-applications/:id/mark-in-negotiation`

**Purpose:** Mark application in negotiation

**Role:** CREDIT

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `IN_NEGOTIATION`
- Logs to `File Auditing Log` + `Admin Activity log`

---

### POST `/credit/loan-applications/:id/assign-nbfcs`

**Purpose:** Allocate to NBFC(s)

**Role:** CREDIT

**Request Body:**
```typescript
{
  nbfcIds: string[];
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets `Assigned NBFC` = nbfcIds (comma-separated if multiple)
- Sets status = `SENT_TO_NBFC`
- Logs to `Admin Activity log`
- Triggers email notifications (via n8n)

---

### POST `/credit/loan-applications/:id/nbfc-decision`

**Purpose:** Capture NBFC decision (for offline decisions or overrides)

**Role:** CREDIT

**Request Body:**
```typescript
{
  nbfcId: string;
  decision: 'Approved' | 'Rejected' | 'Needs Clarification';
  approvedAmount?: string;
  terms?: string;
  reason?: string;
  clarificationMessage?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Updates `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`
- Updates `Approved Loan Amount` if approved
- Updates status:
  - If any APPROVED → `APPROVED`
  - If all REJECTED → `REJECTED`
- Logs to `File Auditing Log`

---

### POST `/credit/loan-applications/:id/mark-disbursed`

**Purpose:** Mark application as disbursed and create commission entry

**Role:** CREDIT

**Request Body:**
```typescript
{
  disbursedAmount: string;
  disbursedDate: string;
  lenderId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    message: string;
    commissionEntry: {
      ledgerEntryId: string;
      payoutAmount: number;
      commissionRate: number;
      entryType: 'Payout' | 'Payin';
    };
  };
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `DISBURSED`
- Sets `Approved Loan Amount` = disbursedAmount
- Reads client's `Commission Rate` from `Clients` table
- Calculates commission: `(disbursedAmount * commissionRate) / 100`
- Creates row in `Commission Ledger`:
  - `Payout Amount` = commission (positive for Payout, negative for Payin)
  - `Disbursed Amount` = disbursedAmount
  - `Commission Rate` = commissionRate
  - `Description` = "Payout/Payin for loan disbursement..."
- Logs to `Admin Activity log` + `File Auditing Log`
- Sends notification to client

---

### POST `/credit/loan-applications/:id/close`

**Purpose:** Close/archive loan application

**Role:** CREDIT

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    applicationId: string;
    fileId: string;
    previousStatus: string;
    newStatus: 'closed';
  };
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Sets status = `CLOSED`
- Excludes from active lists
- Logs to `File Auditing Log` + `Admin Activity log`

---

### GET `/credit/payout-requests`

**Purpose:** Get all pending payout requests

**Role:** CREDIT

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    ledgerEntryId: string;
    client: string;
    amount: number;
    status: string;
    requestedDate: string;
  }>;
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Filters where `Payout Request` = "Requested" or !== 'False' and !== 'Paid'

---

### POST `/credit/payout-requests/:requestId/approve`

**Purpose:** Approve payout request

**Role:** CREDIT

**Request Body:**
```typescript
{
  approvedAmount?: number;
  note?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Creates new row in `Commission Ledger`:
  - `Payout Amount` = -approvedAmount (negative, reduces balance)
  - `Description` = "Payout approved: {note}"
  - `Payout Request` = "Paid"
- Updates original entry's `Payout Request` = "Completed"
- Logs to `File Auditing Log`
- Sends notification to client

---

### POST `/credit/payout-requests/:requestId/reject`

**Purpose:** Reject payout request

**Role:** CREDIT

**Request Body:**
```typescript
{
  reason: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Commission Ledger` row
- Sets `Payout Request` = "Rejected"
- Logs reason to `File Auditing Log`
- Sends notification to client

---

### GET `/credit/ledger`

**Purpose:** Get all ledger entries with optional filters

**Role:** CREDIT

**Query Parameters:**
- `clientId` (optional): Filter by client
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date

**Response:**
```typescript
{
  success: boolean;
  data: {
    entries: Array<CommissionLedgerEntry>;
    stats: {
      totalPayable: number;
      totalPaid: number;
      totalEntries: number;
    };
  };
}
```

**Airtable Mapping:**
- Reads from `Commission Ledger` table
- Applies filters
- Calculates aggregated stats

---

## 5. NBFC Partner Capabilities

### GET `/nbfc/dashboard`

**Purpose:** Get NBFC dashboard overview

**Role:** NBFC

**Response:**
```typescript
{
  success: boolean;
  data: {
    assignedApplications: Array<{
      id: string;
      fileId: string;
      client: string;
      amount: string;
      product: string;
      dateSent: string;
      status: string;
    }>;
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Filters where `Assigned NBFC` = authenticated NBFC's ID

---

### GET `/nbfc/loan-applications`

**Purpose:** List assigned applications

**Role:** NBFC

**Query Parameters:**
- `status` (optional): Filter by status
- `date` (optional): Filter by date
- `amountMin` (optional): Minimum amount
- `amountMax` (optional): Maximum amount

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    fileId: string;
    client: string;
    applicantName: string;
    product: string;
    requestedAmount: string;
    status: string;
    lenderDecision: string;
  }>;
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Filters where `Assigned NBFC` = authenticated NBFC's ID

---

### GET `/nbfc/loan-applications/:id`

**Purpose:** Get application details

**Role:** NBFC

**Response:**
```typescript
{
  success: boolean;
  data: {
    ...LoanApplication;
    // Summary form fields, key docs via OneDrive URLs
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Validates application is assigned to authenticated NBFC

---

### POST `/nbfc/loan-applications/:id/decision`

**Purpose:** Record NBFC decision via portal

**Role:** NBFC

**Request Body:**
```typescript
{
  decision: 'Approved' | 'Rejected' | 'Needs Clarification';
  approvedAmount?: string;
  terms?: string;
  rejectionReason?: string;
  clarificationMessage?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Airtable Mapping:**
- Updates `Loan Applications` row
- Updates `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`
- Updates `Approved Loan Amount` if approved
- Updates status accordingly
- Logs to `File Auditing Log`

---

## 6. Audit Log & Activity Log

### GET `/loan-applications/:id/audit-log`

**Purpose:** Get file audit log

**Role:** CLIENT (own only), KAM (managed clients), CREDIT, NBFC (assigned only)

**Response:**
```typescript
{
  success: boolean;
  data: Array<FileAuditLogEntry>;
}
```

**Airtable Mapping:**
- Reads from `File Auditing Log` table
- Filters by File = application's File ID
- Filters by role access

---

### GET `/admin/activity-log`

**Purpose:** Get admin activity log

**Role:** CREDIT admin / super admin

**Query Parameters:**
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date
- `performedBy` (optional): Filter by user
- `actionType` (optional): Filter by action type
- `targetEntity` (optional): Filter by entity

**Response:**
```typescript
{
  success: boolean;
  data: Array<AdminActivityLogEntry>;
}
```

**Airtable Mapping:**
- Reads from `Admin Activity log` table
- Applies filters

---

## 7. Daily Summary Reports

### POST `/reports/daily/generate`

**Purpose:** Generate daily summary report

**Role:** CREDIT admin

**Request Body:**
```typescript
{
  date?: string; // Default = today (YYYY-MM-DD)
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    reportId: string;
    reportDate: string;
    summary: string;
    metrics: {
      filesReceived: number;
      filesSentToLenders: number;
      filesApproved: number;
      filesRejected: number;
      totalDisbursed: number;
      pendingQueries: number;
    };
  };
}
```

**Airtable Mapping:**
- Aggregates from `Loan Applications` table
- Creates row in `Daily summary Reports` table:
  - `Report Date` = date
  - `Summary Content` = generated summary text
  - `Generated Timestamp` = current timestamp
  - `Delivered To` = email addresses or user IDs

---

### GET `/reports/daily/:date`

**Purpose:** Get daily summary for specific date

**Role:** CREDIT / KAM

**Response:**
```typescript
{
  success: boolean;
  data: DailySummaryReport;
}
```

**Airtable Mapping:**
- Reads from `Daily summary Reports` table
- Filters by `Report Date` = date

---

### GET `/reports/daily/latest`

**Purpose:** Get latest daily summary

**Role:** CREDIT / KAM

**Query Parameters:**
- `before` (optional): Get latest before this date

**Response:**
```typescript
{
  success: boolean;
  data: DailySummaryReport;
}
```

**Airtable Mapping:**
- Reads from `Daily summary Reports` table
- Sorts by `Report Date` descending
- Returns first entry (optionally filtered by `before` date)

---

## 8. AI File Summary

### POST `/loan-applications/:id/generate-summary`

**Purpose:** Generate AI file summary

**Role:** CREDIT / KAM

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    summary: string;
  };
}
```

**Airtable Mapping:**
- Calls AI service (stub implementation)
- Updates `Loan Applications` row
- Sets `AI File Summary` field
- Logs to `File Auditing Log`

---

### GET `/loan-applications/:id/summary`

**Purpose:** Get cached AI summary

**Role:** Any role with access to file

**Response:**
```typescript
{
  success: boolean;
  data: {
    summary: string;
  };
}
```

**Airtable Mapping:**
- Reads from `Loan Applications` table
- Returns `AI File Summary` field

---

## 9. Common Types & Enums

### Status Enums

```typescript
enum LoanStatus {
  DRAFT = 'draft';
  UNDER_KAM_REVIEW = 'under_kam_review';
  QUERY_WITH_CLIENT = 'query_with_client';
  PENDING_CREDIT_REVIEW = 'pending_credit_review';
  CREDIT_QUERY_WITH_KAM = 'credit_query_with_kam';
  IN_NEGOTIATION = 'in_negotiation';
  SENT_TO_NBFC = 'sent_to_nbfc';
  APPROVED = 'approved';
  REJECTED = 'rejected';
  DISBURSED = 'disbursed';
  WITHDRAWN = 'withdrawn';
  CLOSED = 'closed';
}

enum LenderDecisionStatus {
  PENDING = 'Pending';
  APPROVED = 'Approved';
  REJECTED = 'Rejected';
  NEEDS_CLARIFICATION = 'Needs Clarification';
}

enum DisputeStatus {
  NONE = 'None';
  UNDER_QUERY = 'Under Query';
  RESOLVED = 'Resolved';
}

enum PayoutRequestStatus {
  REQUESTED = 'Requested';
  APPROVED = 'Approved';
  PARTIALLY_APPROVED = 'Partially Approved';
  REJECTED = 'Rejected';
  PAID = 'Paid';
}
```

### Role Enums

```typescript
enum UserRole {
  CLIENT = 'client';
  KAM = 'kam';
  CREDIT = 'credit_team';
  NBFC = 'nbfc';
}
```

### Module Enums

```typescript
enum Module {
  M1 = 'M1'; // Pay In/Out Ledger
  M2 = 'M2'; // Master Form Builder
  M3 = 'M3'; // File Status Tracking
  M4 = 'M4'; // Audit Log & Query Dialog
  M5 = 'M5'; // Action Center
  M6 = 'M6'; // Daily Summary Reports
  M7 = 'M7'; // File Summary Insights
}
```

---

## Error Responses

All endpoints return errors in this format:

```typescript
{
  success: false;
  error: string; // Human-readable error message
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (wrong role or access denied)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained via `POST /auth/login` and contain:
- User ID
- Role
- Client ID (if CLIENT)
- KAM ID (if KAM)
- NBFC ID (if NBFC)

---

## Airtable Table Mappings

| API Entity | Airtable Table | Key Fields |
|-----------|---------------|------------|
| User Account | `User Accounts` | Username, Password, Role, Associated Profile |
| Client | `Clients` | Client ID, Client Name, Assigned KAM, Enabled Modules |
| KAM User | `KAM Users` | KAM ID, Name, Email, Managed Clients |
| Credit Team User | `Credit Team Users` | Credit User ID, Name, Email, Role |
| NBFC Partner | `NBFC Partners` | Lender ID, Lender Name, Contact Email/Phone |
| Loan Application | `Loan Applications` | File ID, Client, Status, Form Data, Documents |
| Commission Ledger | `Commission Ledger` | Ledger Entry ID, Client, Loan File, Payout Amount |
| Form Category | `Form Categories` | Category ID, Category Name, Display Order |
| Form Field | `Form Fields` | Field ID, Category, Field Label, Field Type |
| Client Form Mapping | `Client Form Mapping` | Mapping ID, Client, Category, Is Required |
| File Audit Log | `File Auditing Log` | Log Entry ID, File, Actor, Action/Event Type |
| Admin Activity Log | `Admin Activity log` | Activity ID, Performed By, Action Type |
| Daily Summary | `Daily summary Reports` | Report Date, Summary Content, Generated Timestamp |
| Loan Product | `Loan Products` | Product ID, Product Name, Active |

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Maintained By:** Backend Development Team
