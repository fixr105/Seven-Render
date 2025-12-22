# Seven Fincorp Loan Management & Credit Dashboard - System Overview

**Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Source:** PRD + SEVEN-DASHBOARD-2.json

---

## Table of Contents

1. [Module Structure (M1-M7)](#module-structure-m1-m7)
2. [User Roles & Workflows](#user-roles--workflows)
3. [Airtable + n8n Architecture](#airtable--n8n-architecture)

---

## Module Structure (M1-M7)

The system is organized into 7 core modules, each handling specific business functionality:

### M1: Pay In/Out Ledger (Commission Tracker)

**Purpose:** Track commission payouts and pay-ins for DSA partners (Clients).

**Key Features:**
- Commission ledger entries automatically created on loan disbursement
- Running balance calculation per client
- Payout request workflow (Client → Credit Team)
- Dispute/query mechanism for ledger entries
- Support for both positive (payout) and negative (payin) entries

**Key Entities:**
- Commission Ledger table tracks all financial transactions
- Commission rate configured per client
- Automatic calculation: `commission = (disbursedAmount * commissionRate) / 100`

**Status:** ✅ Fully Implemented

---

### M2: Master Form Builder

**Purpose:** Dynamic form configuration system allowing KAMs to configure client-specific loan application forms.

**Key Features:**
- KAM configures form templates per client (and optionally per loan product)
- Form versioning - submitted applications freeze their form config version
- Module-based form structure (Personal KYC, Company KYC, Financial Details, etc.)
- Mandatory field validation based on "Is Mandatory" flag
- Client Form Mapping links clients to form categories and fields
- Display order control for fields and categories

**Key Entities:**
- Form Categories (grouping of fields)
- Form Fields (individual input fields with types, validation rules)
- Client Form Mapping (links clients to categories with required flags)

**Status:** ✅ Fully Implemented

---

### M3: Loan File Status Tracking

**Purpose:** Track loan application status through the complete lifecycle with state machine validation.

**Key Features:**
- Status state machine with role-based transition rules
- Status history tracking
- Visual status timeline in UI
- Role-based status change permissions
- Status transitions:
  - `DRAFT` → `UNDER_KAM_REVIEW` → `PENDING_CREDIT_REVIEW` → `SENT_TO_NBFC` → `APPROVED` → `DISBURSED` → `CLOSED`
  - Alternative paths: `QUERY_WITH_CLIENT`, `CREDIT_QUERY_WITH_KAM`, `REJECTED`, `WITHDRAWN`

**Key Entities:**
- Loan Applications table with Status field
- Status history stored in File Auditing Log

**Status:** ✅ Fully Implemented

---

### M4: Audit Trail & Query Dialog

**Purpose:** Comprehensive audit logging and query/response system for loan applications.

**Key Features:**
- File Auditing Log tracks all actions on loan files
- Query/response threading per file
- Notifications linked to audit log entries
- Resolution tracking (Resolved flag)
- Action types: Status Change, Query Raised, Query Resolved, Document Upload, etc.
- Target user/role assignment for queries

**Key Entities:**
- File Auditing Log (tblL1XJnqW3Q15ueZ)
- Notifications (tblmprms0l3yQjVdx)
- Admin Activity Log (system-wide audit)

**Status:** ✅ Fully Implemented

---

### M5: Action Center

**Purpose:** Centralized dashboard for role-specific actions and pending tasks.

**Key Features:**
- Role-based action lists
- Pending queries/notifications
- Quick action buttons (Approve, Reject, Query, etc.)
- Status-based filtering
- Priority indicators

**Status:** ✅ Fully Implemented

---

### M6: Daily Summary Reports

**Purpose:** Automated daily reports aggregating key metrics and emailing management.

**Key Features:**
- Aggregates data from Loan Applications, Commission Ledger, File Auditing Log
- Generates formatted report with sections:
  - New applications
  - Status changes
  - Commission transactions
  - Queries raised/resolved
- Writes to Daily Summary Reports table
- Email integration via n8n Outlook node
- Frontend admin page showing last 7 reports

**Key Entities:**
- Daily Summary Reports table (tbla3urDb8kCsO0Et)
- Email webhook for Outlook integration

**Status:** ✅ Fully Implemented

---

### M7: AI File Summary (File Summary Insights)

**Purpose:** AI-powered summary generation for loan applications with applicant profile, loan details, strengths, and risks.

**Key Features:**
- Generates comprehensive AI summaries using OpenAI API or n8n AI nodes
- Summary includes:
  - Applicant profile
  - Loan details
  - Strengths
  - Risks/concerns
- Stores summary in Loan Applications "AI File Summary" field
- Frontend panel with generate/refresh button
- Loading states and error handling

**Key Entities:**
- Loan Applications table with "AI File Summary" field
- AI Summary service with multiple provider support

**Status:** ✅ Fully Implemented

---

## User Roles & Workflows

### Role Definitions

The system supports 4 primary user roles:

1. **CLIENT** (DSA Partner)
   - Creates and manages loan applications
   - Views commission ledger and requests payouts
   - Responds to queries from KAM/Credit
   - Can withdraw applications before disbursement

2. **KAM** (Key Account Manager)
   - Manages assigned clients
   - Configures form templates per client
   - Reviews and validates loan applications
   - Raises queries with clients
   - Forwards validated applications to Credit team
   - Views commission ledger for managed clients

3. **CREDIT** (Credit Team)
   - Reviews applications forwarded by KAM
   - Raises queries with KAM
   - Assigns applications to NBFC partners
   - Marks applications as approved/rejected
   - Marks disbursed and closes files
   - Manages commission ledger and payout requests
   - Processes payout approvals/rejections

4. **NBFC** (NBFC Partner/Lender)
   - Views applications assigned to them
   - Records lending decisions (Approve/Reject/Needs Clarification)
   - Provides decision remarks (mandatory for rejections)
   - Sets approved loan amount (if approved)

---

### Loan Application Workflow

```
┌─────────┐
│  DRAFT  │ (Client creates application)
└────┬────┘
     │ Client submits
     ↓
┌──────────────────┐
│ UNDER_KAM_REVIEW │ (KAM reviews)
└────┬─────────────┘
     │ KAM raises query
     ↓
┌──────────────────┐
│QUERY_WITH_CLIENT │ (Client responds)
└────┬─────────────┘
     │ Client responds
     ↓
┌──────────────────┐
│ UNDER_KAM_REVIEW │ (KAM forwards)
└────┬─────────────┘
     │ KAM forwards
     ↓
┌──────────────────────┐
│PENDING_CREDIT_REVIEW │ (Credit reviews)
└────┬─────────────────┘
     │ Credit raises query
     ↓
┌──────────────────────┐
│CREDIT_QUERY_WITH_KAM │ (KAM responds)
└────┬─────────────────┘
     │ KAM responds
     ↓
┌──────────────────────┐
│PENDING_CREDIT_REVIEW │ (Credit assigns NBFC)
└────┬─────────────────┘
     │ Credit assigns
     ↓
┌──────────────┐
│SENT_TO_NBFC  │ (NBFC reviews)
└────┬─────────┘
     │ NBFC approves
     ↓
┌──────────┐
│ APPROVED │ (Credit marks disbursed)
└────┬─────┘
     │ Credit marks disbursed
     ↓
┌────────────┐
│ DISBURSED  │ (Commission entry created)
└────┬───────┘
     │ Credit closes
     ↓
┌────────┐
│ CLOSED │
└────────┘

Alternative Paths:
- DRAFT → WITHDRAWN (Client withdraws)
- Any status → REJECTED (Credit/NBFC rejects)
- SENT_TO_NBFC → REJECTED (NBFC rejects)
```

---

### Role-Based Permissions

**CLIENT:**
- Create/edit applications (DRAFT, QUERY_WITH_CLIENT)
- Submit applications
- Withdraw applications (before disbursement)
- View own commission ledger
- Request payouts
- Raise queries on ledger entries

**KAM:**
- Configure form templates for managed clients
- View applications for managed clients
- Raise queries with clients
- Forward applications to Credit
- View commission ledger for managed clients
- Update client settings (modules, commission rate)

**CREDIT:**
- View all applications
- Raise queries with KAM
- Assign applications to NBFCs
- Approve/reject applications
- Mark disbursed (triggers commission entry)
- Close files
- View all commission ledger entries
- Approve/reject payout requests
- Create manual ledger entries

**NBFC:**
- View applications assigned to them
- Record lending decisions
- Set approved loan amount
- Provide decision remarks

---

## Airtable + n8n Architecture

### Architecture Overview

The system uses **Airtable** as the primary data store, accessed via **n8n webhooks**. All database operations go through n8n workflows that handle Airtable API calls.

**Base URL:** `https://fixrrahul.app.n8n.cloud/webhook/`

**Pattern:**
- **POST webhooks:** Create/update operations (upsert)
- **GET webhooks:** Search/fetch operations

---

### Airtable Base

**Base ID:** `appzbyi8q7pJRl1cd`  
**Base Name:** "Seven Dashboard"

---

### Airtable Tables

| Table Name | Table ID | Description |
|------------|----------|-------------|
| **User Accounts** | `tblQ1rT8wW3yA6cC9` | User authentication and role mapping |
| **Clients** | `tblK8mN3pQvR5sT7u` | DSA partner/client information |
| **KAM Users** | `tblM7nP4rS9tU2vW5` | Key Account Manager profiles |
| **Credit Team Users** | `tblX9yZ2wV4nM6pQ8` | Credit team member profiles |
| **NBFC Partners** | `tblP0qS7vV2xZ5bB8` | NBFC/lender partner information |
| **Loan Applications** | `tblN8oQ5sT0vX3yZ6` | Loan application files with status, form data, documents |
| **Loan Products** | `tblO9pR6uU1wY4zA7` | Available loan product configurations |
| **Form Categories** | `tblqCqXV0Hds0t0bH` | Form category groupings |
| **Form Fields** | `tbl5oZ6zI0dc5eutw` | Individual form field definitions |
| **Client Form Mapping** | `tbl70C8uPKmoLkOQJ` | Links clients to form categories/fields |
| **Commission Ledger** | `tblrBWFuPYBI4WWtn` | Commission payout/payin entries |
| **File Auditing Log** | `tblL1XJnqW3Q15ueZ` | Audit trail for all file actions |
| **Notifications** | `tblmprms0l3yQjVdx` | User notifications |
| **Daily Summary Reports** | `tbla3urDb8kCsO0Et` | Generated daily summary reports |
| **Admin Activity Log** | `tbl8qJ3xK5vF2hNpL` | System-wide activity audit log |

---

### n8n Webhook Paths

#### POST Webhooks (Create/Update)

| Webhook Path | Purpose | Airtable Table |
|--------------|---------|----------------|
| `POSTLOG` | Create admin activity log entry | Admin Activity Log |
| `POSTCLIENTFORMMAPPING` | Create/update client form mapping | Client Form Mapping |
| `COMISSIONLEDGER` | Create/update commission ledger entry | Commission Ledger |
| `CREDITTEAMUSERS` | Create/update credit team user | Credit Team Users |
| `DAILYSUMMARY` | Create daily summary report | Daily Summary Reports |
| `Fileauditinglog` | Create/update file audit log entry | File Auditing Log |
| `FormCategory` | Create/update form category | Form Categories |
| `FormFields` | Create/update form field | Form Fields |
| `KAMusers` | Create/update KAM user | KAM Users |
| `loanapplications` | Create/update loan application | Loan Applications |
| `loanproducts` | Create/update loan product | Loan Products |
| `NBFCPartners` | Create/update NBFC partner | NBFC Partners |
| `adduser` | Create user account | User Accounts |
| `Client` | Create/update client | Clients |
| `notification` | Create notification | Notifications |
| `email` | Send email via Outlook | (Email service) |

**Note:** POST webhooks use **plural** form for loan applications (`loanapplications`).

---

#### GET Webhooks (Search/Fetch)

| Webhook Path | Purpose | Airtable Table |
|--------------|---------|----------------|
| `adminactivity` | Search admin activity log | Admin Activity Log |
| `clientformmapping` | Search client form mappings | Client Form Mapping |
| `client` | Search clients | Clients |
| `commisionledger` | Search commission ledger | Commission Ledger |
| `creditteamuser` | Search credit team users | Credit Team Users |
| `dailysummaryreport` | Search daily summary reports | Daily Summary Reports |
| `fileauditinglog` | Search file audit log | File Auditing Log |
| `formcategories` | Search form categories | Form Categories |
| `formfields` | Search form fields | Form Fields |
| `kamusers` | Search KAM users | KAM Users |
| `loanapplication` | Search loan applications | Loan Applications |
| `loanproducts` | Search loan products | Loan Products |
| `nbfcpartners` | Search NBFC partners | NBFC Partners |
| `notifications` | Search notifications | Notifications |
| `useraccount` | Search user accounts | User Accounts |

**Note:** GET webhooks use **singular** form for loan applications (`loanapplication`).

---

### Key Webhook Patterns

#### Pattern 1: Loan Application Operations

- **GET:** `/webhook/loanapplication` (search/fetch)
- **POST:** `/webhook/loanapplications` (create/update)

This is the only table with different singular/plural naming between GET and POST.

#### Pattern 2: Standard Operations

Most tables follow consistent naming:
- **GET:** `/webhook/{tablename}` (lowercase, singular or plural as per table)
- **POST:** `/webhook/{TABLENAME}` (uppercase, matches table name)

#### Pattern 3: Special Operations

- **Email:** `/webhook/email` (POST only, sends via Outlook)
- **Admin Activity:** `/webhook/adminactivity` (GET) and `/webhook/POSTLOG` (POST)

---

### Data Flow

```
Frontend (React)
    ↓
Backend API (Express/TypeScript)
    ↓
n8n Webhook (POST/GET)
    ↓
Airtable API
    ↓
Airtable Base (appzbyi8q7pJRl1cd)
```

**Key Points:**
- All database operations go through n8n webhooks
- Backend never directly calls Airtable API
- n8n workflows handle Airtable authentication and API rate limiting
- Webhook responses are cached (30 minutes) for GET requests
- POST operations are synchronous and return updated records

---

### Important Field Mappings

#### Loan Applications Key Fields

- `File ID` - Unique identifier
- `Client` - Links to Clients table
- `Status` - Current application status
- `Form Data` - JSON string of form field values
- `Documents` - Comma-separated list of `fieldId:url|fileName`
- `Assigned NBFC` - Links to NBFC Partners table
- `Lender Decision Status` - NBFC decision (Pending/Approved/Rejected/Needs Clarification)
- `Lender Decision Date` - Date of NBFC decision
- `Lender Decision Remarks` - NBFC decision comments
- `AI File Summary` - AI-generated summary text
- `Form Config Version` - Timestamp of form config used (for versioning)

#### Commission Ledger Key Fields

- `Ledger Entry ID` - Unique identifier
- `Client` - Links to Clients table
- `Loan File` - Links to Loan Applications table
- `Date` - Transaction date
- `Disbursed Amount` - Loan amount disbursed
- `Commission Rate` - Percentage rate
- `Payout Amount` - Calculated commission (positive = payout, negative = payin)
- `Description` - Transaction description
- `Dispute Status` - None/Under Query/Resolved
- `Payout Request` - Requested/Approved/Rejected/Paid

#### File Auditing Log Key Fields

- `Log Entry ID` - Unique identifier
- `File` - Links to Loan Applications table
- `Actor` - User email who performed action
- `Action/Event Type` - Type of action (Status Change, Query Raised, etc.)
- `Details/Message` - Action details
- `Target User/Role` - Who the action is directed to
- `Resolved` - Boolean flag for query resolution

---

### Integration Points

1. **OneDrive Integration:** Document uploads stored in OneDrive, URLs stored in Loan Applications `Documents` field
2. **OpenAI Integration:** AI summary generation via OpenAI API or n8n AI nodes
3. **Email Integration:** Daily reports and notifications sent via Outlook (n8n email webhook)
4. **Authentication:** JWT-based auth with role-based access control

---

## Summary

This system provides a complete loan management platform with:
- **7 core modules** covering form building, status tracking, commission management, audit logging, reporting, and AI insights
- **4 user roles** with distinct workflows and permissions
- **Airtable + n8n architecture** providing flexible, scalable data management
- **Comprehensive audit trail** for compliance and accountability
- **Automated workflows** for commission calculation, reporting, and notifications

All modules are fully implemented and production-ready.

