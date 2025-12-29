# Prisma Schema Documentation

## Overview

This Prisma schema defines the database structure for the Seven Fincorp Loan Management & Credit Dashboard, based on the Airtable schema from `SEVEN-DASHBOARD(2).json` and the PRD requirements.

## Core Tables

### 1. Clients
- **Purpose**: DSA Partners (clients who submit loan applications)
- **Key Fields**: `clientId`, `clientName`, `assignedKamId`, `commissionRate`
- **Relationships**:
  - Belongs to one `KAMUser` (via `assignedKamId`)
  - Has many `LoanFile` records
  - Has many `CommissionLedger` entries
  - Has many `ClientFormMapping` configurations

### 2. LoanFiles (Loan Applications)
- **Purpose**: Individual loan applications/files
- **Key Fields**: `fileId`, `clientId`, `status`, `assignedCreditAnalystId`, `assignedNbfcId`
- **Relationships**:
  - Belongs to one `Client`
  - Belongs to one `LoanProduct` (optional)
  - Assigned to one `CreditTeamUser` (optional)
  - Sent to one `NBFCPartner` (optional)
  - Has many `CommissionLedger` entries
  - Has many `FileAuditLog` entries (audit trail and queries)

### 3. AdminActivityLog
- **Purpose**: Track all administrative actions
- **Key Fields**: `activityId`, `performedById`, `actionType`, `description`, `targetEntity`
- **Relationships**:
  - Performed by one `UserAccount`

### 4. CommissionLedger
- **Purpose**: Track pay in/out transactions and commission calculations
- **Key Fields**: `ledgerEntryId`, `clientId`, `loanFileId`, `payoutAmount`, `disputeStatus`
- **Relationships**:
  - Belongs to one `Client`
  - Linked to one `LoanFile` (optional)

### 5. FileAuditingLog (includes WebhookQueries)
- **Purpose**: Audit trail and in-app query dialog
- **Key Fields**: `logEntryId`, `fileId`, `actorId`, `actionEventType`, `detailsMessage`, `resolved`
- **Query Threading**: Queries are stored in `detailsMessage` with embedded metadata:
  - Format: `[[parent:<id>]][[status:<open|resolved>]] message`
- **Relationships**:
  - Linked to one `LoanFile` (optional)
  - Created by one `UserAccount` (actor)

## User Management Tables

### UserAccount
- Central authentication table
- Links to role-specific profiles (Client, KAMUser, CreditTeamUser, NBFCPartner)

### KAMUser
- Key Account Managers who manage clients
- Can be assigned multiple clients

### CreditTeamUser
- Credit analysts who review loan applications
- Can be assigned multiple loan files

### NBFCPartner
- Lenders (NBFC partners)
- Receive loan applications for approval

## Form Configuration Tables

### FormCategory
- Categories for organizing form fields
- Examples: Personal Information, Financial Details, Documents

### FormField
- Individual form fields within categories
- Supports various types: text, file, date, number, select, checkbox, textarea

### ClientFormMapping
- Custom form configuration per client
- Maps categories to clients with required/optional settings
- Supports versioning

## Setup Instructions

### 1. Install Prisma

```bash
npm install prisma @prisma/client
```

### 2. Set Environment Variable

Create `.env` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/seven_dashboard?schema=public"
```

For SQLite (development):
```env
DATABASE_URL="file:./dev.db"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Create Database and Run Migrations

```bash
# Create database (PostgreSQL)
createdb seven_dashboard

# Run migrations
npx prisma migrate dev --name init
```

### 5. Seed Database (Optional)

Create `prisma/seed.ts` to populate initial data.

## Foreign Key Relationships

### Critical Relationships

1. **LoanFiles → Clients**: `loanFiles.clientId` → `clients.id`
   - Ensures every loan file belongs to a client
   - `onDelete: Restrict` prevents deleting clients with active files

2. **Clients → KAMUsers**: `clients.assignedKamId` → `kam_users.id`
   - Links clients to their assigned KAM
   - `onDelete: SetNull` allows reassignment if KAM is deleted

3. **LoanFiles → CreditTeamUsers**: `loan_files.assignedCreditAnalystId` → `credit_team_users.id`
   - Assigns credit analysts to loan files
   - `onDelete: SetNull` allows reassignment

4. **LoanFiles → NBFCPartners**: `loan_files.assignedNbfcId` → `nbfc_partners.id`
   - Links loan files to NBFC partners
   - `onDelete: SetNull` allows reassignment

5. **CommissionLedger → Clients**: `commission_ledger.clientId` → `clients.id`
   - Tracks commission per client
   - `onDelete: Restrict` prevents deleting clients with ledger entries

6. **FileAuditLog → LoanFiles**: `file_auditing_log.fileId` → `loan_files.id`
   - Creates audit trail for each loan file
   - `onDelete: SetNull` preserves audit logs even if file is deleted

## Indexes

All tables include strategic indexes on:
- Business IDs (e.g., `fileId`, `clientId`)
- Foreign keys
- Status fields (for filtering)
- Timestamps (for sorting)

## Enums

The schema uses Prisma enums for:
- `UserRole`: client, kam, credit_team, nbfc
- `LoanStatus`: draft, under_kam_review, approved, etc.
- `DisputeStatus`: None, UnderQuery, Resolved
- `AccountStatus`: Active, Locked, Disabled
- `PayoutRequestStatus`: Requested, Approved, Paid, etc.
- `NotificationChannel`: email, in_app, both

## Migration from Airtable

When migrating from Airtable:
1. Export all data from Airtable tables
2. Transform data to match Prisma schema
3. Map Airtable IDs to Prisma UUIDs
4. Handle relationships (foreign keys)
5. Import using Prisma Client or raw SQL

## Next Steps

1. Review and adjust field types as needed
2. Add additional indexes based on query patterns
3. Create seed data for development
4. Set up database connection pooling
5. Implement data migration scripts from Airtable

