# Prisma Schema Generation Summary

**Date:** 2025-01-29  
**Purpose:** Generate Prisma schema based on SEVEN-DASHBOARD(2).json and PRD requirements for Phase 2 database migration.

## Generated Schema

### Location
- **Schema File**: `backend/prisma/schema.prisma`
- **Documentation**: `backend/prisma/README.md`

## Core Tables Implemented

### ✅ 1. Clients
**Purpose**: DSA Partners who submit loan applications

**Key Fields**:
- `id` (UUID, primary key)
- `clientId` (String, unique business ID)
- `clientName` (String)
- `primaryContactName` (String?)
- `contactEmail` (String?)
- `contactPhone` (String?)
- `assignedKamId` (String?, FK to KAMUser)
- `enabledModules` (String[] - array of module IDs)
- `commissionRate` (Decimal, default 1.5%)
- `status` (String, default "Active")

**Relationships**:
- `assignedKam` → KAMUser (many-to-one)
- `loanFiles` → LoanFile[] (one-to-many)
- `commissionLedger` → CommissionLedger[] (one-to-many)
- `formMappings` → ClientFormMapping[] (one-to-many)

---

### ✅ 2. LoanFiles (Loan Applications)
**Purpose**: Individual loan applications/files

**Key Fields**:
- `id` (UUID, primary key)
- `fileId` (String, unique business ID)
- `clientId` (String, FK to Client)
- `applicantName` (String?)
- `loanProductId` (String?, FK to LoanProduct)
- `requestedLoanAmount` (Decimal?)
- `status` (LoanStatus enum)
- `assignedCreditAnalystId` (String?, FK to CreditTeamUser)
- `assignedNbfcId` (String?, FK to NBFCPartner)
- `lenderDecisionStatus` (LenderDecisionStatus enum?)
- `approvedLoanAmount` (Decimal?)
- `formData` (String? - JSON string)

**Relationships**:
- `client` → Client (many-to-one, required)
- `loanProduct` → LoanProduct (many-to-one, optional)
- `assignedCreditAnalyst` → CreditTeamUser (many-to-one, optional)
- `assignedNbfc` → NBFCPartner (many-to-one, optional)
- `commissionLedger` → CommissionLedger[] (one-to-many)
- `auditLog` → FileAuditLog[] (one-to-many)
- `queries` → FileAuditLog[] (one-to-many, via relation)

**Note**: KAM assignment is derived from `Client.assignedKamId`

---

### ✅ 3. AdminActivityLog
**Purpose**: Track all administrative actions

**Key Fields**:
- `id` (UUID, primary key)
- `activityId` (String, unique business ID)
- `timestamp` (DateTime, default now)
- `performedById` (String, FK to UserAccount)
- `actionType` (String - e.g., "create_client", "update_loan")
- `description` (String - detailed description)
- `targetEntity` (String? - entity type)

**Relationships**:
- `performedBy` → UserAccount (many-to-one, required)

---

### ✅ 4. CommissionLedger
**Purpose**: Track pay in/out transactions and commission calculations

**Key Fields**:
- `id` (UUID, primary key)
- `ledgerEntryId` (String, unique business ID)
- `clientId` (String, FK to Client)
- `loanFileId` (String?, FK to LoanFile)
- `date` (DateTime, default now)
- `disbursedAmount` (Decimal?)
- `commissionRate` (Decimal?)
- `payoutAmount` (Decimal - can be negative)
- `description` (String?)
- `disputeStatus` (DisputeStatus enum, default NONE)
- `payoutRequest` (PayoutRequestStatus enum?)

**Relationships**:
- `client` → Client (many-to-one, required)
- `loanFile` → LoanFile (many-to-one, optional)

---

### ✅ 5. FileAuditingLog (includes WebhookQueries)
**Purpose**: Audit trail and in-app query dialog

**Key Fields**:
- `id` (UUID, primary key)
- `logEntryId` (String, unique business ID)
- `fileId` (String?, FK to LoanFile)
- `timestamp` (DateTime, default now)
- `actorId` (String, FK to UserAccount)
- `actionEventType` (String - e.g., "query_raised", "status_change")
- `detailsMessage` (String - contains query content and metadata)
- `targetUserRole` (String? - target user/role for queries)
- `resolved` (Boolean, default false)

**Query Threading**:
- Queries are stored in `detailsMessage` with embedded metadata
- Format: `[[parent:<id>]][[status:<open|resolved>]] message`
- Supports threaded conversations

**Relationships**:
- `file` → LoanFile (many-to-one, optional)
- `actor` → UserAccount (many-to-one, required)

---

## Supporting Tables

### User Management
- **UserAccount**: Central authentication table
- **KAMUser**: Key Account Managers
- **CreditTeamUser**: Credit analysts
- **NBFCPartner**: Lenders/NBFC partners

### Form Configuration
- **FormCategory**: Categories for organizing form fields
- **FormField**: Individual form fields
- **ClientFormMapping**: Custom form configuration per client

### Other
- **LoanProduct**: Available loan products
- **Notification**: In-app and email notifications

## Foreign Key Relationships

### Critical Relationships

1. **LoanFiles → Clients**
   - `loanFiles.clientId` → `clients.id`
   - `onDelete: Restrict` (prevents deleting clients with active files)

2. **Clients → KAMUsers**
   - `clients.assignedKamId` → `kam_users.id`
   - `onDelete: SetNull` (allows reassignment if KAM is deleted)

3. **LoanFiles → CreditTeamUsers**
   - `loan_files.assignedCreditAnalystId` → `credit_team_users.id`
   - `onDelete: SetNull` (allows reassignment)

4. **LoanFiles → NBFCPartners**
   - `loan_files.assignedNbfcId` → `nbfc_partners.id`
   - `onDelete: SetNull` (allows reassignment)

5. **CommissionLedger → Clients**
   - `commission_ledger.clientId` → `clients.id`
   - `onDelete: Restrict` (preserves financial records)

6. **FileAuditLog → LoanFiles**
   - `file_auditing_log.fileId` → `loan_files.id`
   - `onDelete: SetNull` (preserves audit trail)

## Enums Defined

- **UserRole**: `client`, `kam`, `credit_team`, `nbfc`
- **LoanStatus**: `draft`, `under_kam_review`, `query_with_client`, `pending_credit_review`, `credit_query_with_kam`, `in_negotiation`, `sent_to_nbfc`, `approved`, `rejected`, `disbursed`, `withdrawn`, `closed`
- **LenderDecisionStatus**: `Pending`, `Approved`, `Rejected`, `NeedsClarification`
- **DisputeStatus**: `None`, `UnderQuery`, `Resolved`
- **AccountStatus**: `Active`, `Locked`, `Disabled`
- **PayoutRequestStatus**: `Requested`, `Approved`, `PartiallyApproved`, `Rejected`, `Paid`
- **NotificationChannel**: `email`, `in_app`, `both`

## Indexes

All tables include strategic indexes on:
- Primary keys (automatic)
- Business IDs (e.g., `fileId`, `clientId`)
- Foreign keys
- Status fields (for filtering)
- Timestamps (for sorting)

## Database Support

- **Primary**: PostgreSQL (recommended for production)
- **Development**: SQLite (for local development)

## Next Steps

1. ✅ Schema generated
2. ⏳ Install Prisma: `npm install prisma @prisma/client`
3. ⏳ Set up `DATABASE_URL` in `.env`
4. ⏳ Generate Prisma Client: `npx prisma generate`
5. ⏳ Create database and run migrations: `npx prisma migrate dev --name init`
6. ⏳ Create seed data for development
7. ⏳ Implement data migration scripts from Airtable

## Validation

The schema has been validated against:
- ✅ SEVEN-DASHBOARD(2).json structure
- ✅ PRD requirements
- ✅ Existing TypeScript entity definitions
- ✅ Foreign key relationships
- ✅ Enum values from constants.ts

## Files Created

1. `backend/prisma/schema.prisma` - Main Prisma schema file
2. `backend/prisma/README.md` - Comprehensive documentation
3. `backend/PRISMA_SCHEMA_SUMMARY.md` - This summary document

