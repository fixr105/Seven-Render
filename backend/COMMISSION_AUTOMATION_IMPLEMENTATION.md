# Commission Automation Implementation

**Date:** 2025-12-02  
**Status:** ✅ Complete

## Overview

Implemented automatic commission calculation and ledger entry creation when a loan is marked as disbursed. The system now:

1. ✅ Fetches client's `commission_rate` from the Clients table
2. ✅ Calculates commission (commission_rate * loan_amount)
3. ✅ Creates Payout entry if commission is positive
4. ✅ Creates Payin entry (negative) if commission is negative
5. ✅ Links entry to loan application ID and disbursement timestamp
6. ✅ Makes entry available in `/clients/me/ledger`

## Backend Implementation

### 1. Updated `markDisbursed` Endpoint

**File:** `backend/src/controllers/credit.controller.ts`

**Changes:**
- Fetches client's `commission_rate` from Clients table in Airtable
- Calculates commission: `(loan_amount * commission_rate) / 100`
- Determines entry type:
  - **Payout**: Commission is positive (client earns money)
  - **Payin**: Commission is negative (client owes money) - stored as negative amount
- Creates ledger entry with:
  - Loan application reference (`Loan File`)
  - Disbursement date and timestamp
  - Commission rate used
  - Calculated commission amount
  - Entry type (Payout/Payin) in description

**Code Flow:**
```typescript
// 1. Fetch client commission_rate
const clients = allData['Clients'] || [];
const client = clients.find(c => c.id === application.Client);
const commissionRate = client?.['Commission Rate'] 
  ? parseFloat(client['Commission Rate']) 
  : 1.5; // Default fallback

// 2. Calculate commission
const commission = (loanAmount * commissionRate) / 100;

// 3. Determine Payout vs Payin
const payoutAmount = commission >= 0 ? commission : -Math.abs(commission);
const entryType = commission >= 0 ? 'Payout' : 'Payin';

// 4. Create ledger entry
await n8nClient.postCommissionLedger({
  Client: application.Client,
  'Loan File': application['File ID'],
  'Disbursed Amount': disbursedAmount,
  'Commission Rate': commissionRate.toString(),
  'Payout Amount': payoutAmount.toString(), // Positive for Payout, negative for Payin
  Description: `${entryType} for loan disbursement...`,
  // ... other fields
});
```

### 2. Updated Client Creation

**File:** `backend/src/controllers/kam.controller.ts`

**Changes:**
- `createClient` now accepts `commissionRate` parameter
- Creates Client record in Airtable with `Commission Rate` field
- Default commission rate: 1.5% if not provided

**Request Body:**
```typescript
{
  name: string;
  email: string;
  phone?: string;
  kamId: string;
  enabledModules: string[];
  commissionRate?: number | string; // e.g., "1.5" for 1.5%
}
```

### 3. Updated Client Update

**File:** `backend/src/controllers/kam.controller.ts`

**Changes:**
- `updateClientModules` now accepts `commissionRate` parameter
- Can update commission rate independently or with modules
- Updates Client record in Airtable

**Request Body:**
```typescript
{
  enabledModules?: string[];
  commissionRate?: number | string; // e.g., "1.5" for 1.5%
}
```

### 4. Added Client Entity Type

**File:** `backend/src/types/entities.ts`

**Added:**
```typescript
export interface ClientEntity {
  id: string;
  'Client ID': string;
  'Client Name': string;
  'Primary Contact Name'?: string;
  'Contact Email / Phone'?: string;
  'Assigned KAM'?: string;
  'Enabled Modules'?: string;
  'Commission Rate'?: string; // e.g., "1.5" for 1.5%
  'Status'?: string;
  'Form Categories'?: string;
}

// Added to AllAirtableData
export interface AllAirtableData {
  // ...
  'Clients'?: ClientEntity[];
  // ...
}
```

## Frontend Implementation

### Commission Rate Field in Client Form

**File:** `src/pages/Clients.tsx`

**Status:** ✅ Already implemented

The frontend form already includes:
- Commission Rate input field (number type)
- Default value: "1.0" (1%)
- Help text: "Default commission rate for this client (e.g., 1.0 for 1%)"
- Field is included in `newClient` state
- Field is sent when creating client (via Supabase currently)

**Note:** When migrating to API service, the field will automatically work since it's already in the form.

## API Endpoints

### 1. Mark Disbursed (with Commission Automation)

**Endpoint:** `POST /credit/loan-applications/:id/mark-disbursed`

**Request:**
```json
{
  "disbursedAmount": "5000000",
  "disbursedDate": "2025-12-02"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Application marked as disbursed",
    "commissionEntry": {
      "id": "LEDGER-...",
      "Ledger Entry ID": "LEDGER-...",
      "Client": "client-id",
      "Loan File": "FILE-001",
      "Date": "2025-12-02",
      "Disbursed Amount": "5000000",
      "Commission Rate": "1.5",
      "Payout Amount": "75000",
      "Description": "Payout for loan disbursement...",
      "entryType": "Payout",
      "commissionCalculated": 75000,
      "commissionRate": 1.5,
      "loanAmount": "5000000",
      "disbursementTimestamp": "2025-12-02T16:00:00.000Z"
    }
  }
}
```

### 2. Create Client (with Commission Rate)

**Endpoint:** `POST /kam/clients`

**Request:**
```json
{
  "name": "ABC Corporation",
  "email": "abc@example.com",
  "phone": "+91-9876543210",
  "kamId": "kam-id",
  "enabledModules": ["M1", "M2", "M3"],
  "commissionRate": "1.5"
}
```

### 3. Update Client (Commission Rate)

**Endpoint:** `PATCH /kam/clients/:id/modules`

**Request:**
```json
{
  "commissionRate": "2.0"
}
```

## Commission Calculation Logic

### Formula
```
commission = (loan_amount * commission_rate) / 100
```

### Examples

**Example 1: Positive Commission (Payout)**
- Loan Amount: ₹5,000,000
- Commission Rate: 1.5%
- Commission: ₹75,000
- Entry Type: **Payout**
- Ledger Amount: `+75000`

**Example 2: Negative Commission (Payin)**
- Loan Amount: ₹5,000,000
- Commission Rate: -0.5% (negative rate)
- Commission: -₹25,000
- Entry Type: **Payin**
- Ledger Amount: `-25000`

## Ledger Entry Structure

### Fields Created
- `id`: Unique ledger entry ID
- `Ledger Entry ID`: Same as id
- `Client`: Client ID (from loan application)
- `Loan File`: File ID (from loan application)
- `Date`: Disbursement date
- `Disbursed Amount`: Loan amount disbursed
- `Commission Rate`: Commission rate used (as percentage)
- `Payout Amount`: Calculated commission (positive for Payout, negative for Payin)
- `Description`: Entry description with entry type and details
- `Dispute Status`: "None" (default)
- `Payout Request`: "False" (default)

## Data Flow

1. **Loan Disbursement Triggered**
   - Credit team calls `POST /credit/loan-applications/:id/mark-disbursed`
   - Provides `disbursedAmount` and `disbursedDate`

2. **Fetch Client Commission Rate**
   - System fetches all Clients from Airtable
   - Finds client by ID (from loan application)
   - Extracts `Commission Rate` field
   - Falls back to 1.5% if not found

3. **Calculate Commission**
   - Formula: `(disbursedAmount * commissionRate) / 100`
   - Determines if positive (Payout) or negative (Payin)

4. **Create Ledger Entry**
   - Creates entry in Commission Ledger table
   - Links to loan application via `Loan File` field
   - Includes disbursement timestamp

5. **Log Activities**
   - Creates Admin Activity Log entry
   - Creates File Audit Log entry
   - Both include commission details

6. **Available in Client Ledger**
   - Entry automatically appears in `/clients/me/ledger`
   - Client can view, query, and request payout

## Testing

### Test Scenario 1: Positive Commission (Payout)
```bash
POST /credit/loan-applications/{id}/mark-disbursed
{
  "disbursedAmount": "5000000",
  "disbursedDate": "2025-12-02"
}

# Expected:
# - Commission Rate: 1.5% (from client)
# - Commission: ₹75,000
# - Entry Type: Payout
# - Ledger Amount: +75000
```

### Test Scenario 2: Negative Commission (Payin)
```bash
# First, update client commission rate to negative
PATCH /kam/clients/{id}/modules
{
  "commissionRate": "-0.5"
}

# Then mark disbursed
POST /credit/loan-applications/{id}/mark-disbursed
{
  "disbursedAmount": "5000000"
}

# Expected:
# - Commission Rate: -0.5%
# - Commission: -₹25,000
# - Entry Type: Payin
# - Ledger Amount: -25000
```

## Files Modified

1. `backend/src/controllers/credit.controller.ts`
   - Updated `markDisbursed` method

2. `backend/src/controllers/kam.controller.ts`
   - Updated `createClient` method
   - Updated `updateClientModules` method

3. `backend/src/types/entities.ts`
   - Added `ClientEntity` interface
   - Added `Clients` to `AllAirtableData`

4. `backend/src/types/requests.ts`
   - Added `commissionRate` to `CreateClientRequest`
   - Added `commissionRate` to `UpdateClientModulesRequest`

5. `src/pages/Clients.tsx`
   - Commission rate field already present
   - Updated reset function to include commission_rate

## Next Steps

1. ✅ Commission automation implemented
2. ✅ Client commission_rate editable in frontend
3. ⚠️ Test with real disbursements
4. ⚠️ Verify ledger entries appear in `/clients/me/ledger`
5. ⚠️ Test Payout vs Payin logic with negative rates

## Notes

- Commission rate is stored as string in Airtable (e.g., "1.5" for 1.5%)
- Default commission rate: 1.5% if not specified
- Commission calculation: `(amount * rate) / 100`
- Payout entries have positive amounts
- Payin entries have negative amounts
- All entries are linked to loan application via `Loan File` field
- Disbursement timestamp is included in audit logs

