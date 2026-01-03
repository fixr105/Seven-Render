# Asana Integration

## Overview

The Asana integration automatically creates tasks in Asana when loan applications are submitted. Each task is linked to the corresponding loan application and includes all relevant details.

## Features

- ✅ **Automatic Task Creation**: Creates Asana tasks when loans are submitted
- ✅ **Product Mapping**: Maps loan products to Asana projects
- ✅ **Task Linking**: Stores Asana Task ID and Link in loan application
- ✅ **Sync Script**: Backfill script to sync existing loans to Asana

## Configuration

### Option 1: Personal Access Token (PAT) - **Recommended**

**Why use PAT?**
- ✅ Simpler setup (no OAuth flow)
- ✅ Perfect for server-to-server integration
- ✅ No token expiration

**Setup:**
1. Go to [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Click "Create new token"
3. Give it a name (e.g., "Seven Fincorp Integration")
4. Copy the token

**Add to `.env`:**
```env
ASANA_PAT=your_personal_access_token_here
```

### Option 2: OAuth 2.0 (For user-facing applications)

**OAuth Credentials (provided):**
- Client ID: `1212642476076052`
- Client Secret: `5ab9fe0e0ecf7d33b39d60b7abbfd252`

**Add to `.env`:**
```env
ASANA_CLIENT_ID=1212642476076052
ASANA_CLIENT_SECRET=5ab9fe0e0ecf7d33b39d60b7abbfd252
ASANA_OAUTH_ACCESS_TOKEN=your_oauth_access_token_here
```

**Note:** For server-to-server integration, PAT is recommended. OAuth is only needed if you're building a user-facing app where users need to authorize.

See `ASANA_OAUTH_SETUP.md` for detailed OAuth setup instructions.

### 3. Loan Product to Asana Project Mapping

The mapping is configured in `backend/src/services/asana/asana.service.ts`:

```typescript
const LOAN_PRODUCT_TO_ASANA_PROJECT: Record<string, string> = {
  'Revenue Based Finance for EV': '1211908004694493',
  'HL / LAP': '1211887051020596',
  'Porter': '1211908004694478',
  'Rapido': '1212391754448240',
  'Money Multiplier': '1211908004694490',
  'Numerous': '1211908004853949',
  // Product IDs
  'LP009': '1211908004694493',
  'LP010': '1211908004694490',
  // ... more mappings
};
```

To add new mappings, edit this object in `asana.service.ts`.

## How It Works

### Automatic Task Creation

When a loan application is submitted:

1. **Trigger**: Loan submission via `POST /loan-applications/:id/submit` or `POST /loan-applications` (with `saveAsDraft=false`)
2. **Data Extraction**: 
   - Client Name
   - Loan Product
   - Loan Amount
   - Submitted By (user)
   - Client Code (CL00X)
3. **Asana Task Creation**:
   - Task Name: `Loan – {Client Name} – {Amount}`
   - Notes: Submission date, submitted by, product, client code, file ID
   - Project: Mapped from loan product
   - Assignee: "me" (current user)
4. **Update Loan Application**:
   - `Asana Task ID`: Task ID from Asana
   - `Asana Task Link`: Direct link to task

### Task Format

**Task Name:**
```
Loan – Fluxx Electric – ₹5,00,000
```

**Task Notes:**
```
Submitted on Jan 3, 2026 by Archi.
Product: Revenue Based Finance for EV (CL001)
File ID: SF36220522BRY3QF
```

**Task Link:**
```
https://app.asana.com/0/1211908004694493/1234567890123456
```

## Sync Script

### Usage

Sync all existing loans without Asana Task ID:

```bash
cd backend
npm run sync:asana
```

Sync only submitted loans:

```bash
npm run sync:asana -- --status=submitted
```

### What It Does

1. Fetches all loan applications
2. Filters out applications that already have Asana Task ID
3. Optionally filters by status (submitted only)
4. Creates Asana tasks for each application
5. Updates loan applications with Asana Task ID and Link

### Example Output

```
🚀 Sync Loans to Asana Script
==============================

📋 Fetching loan applications...
   ✅ Fetched 15 loan applications

📊 Found 8 applications to sync (all status, no Asana Task ID)

============================================================
Processing 1/8: SF36220522BRY3QF
   Client: CL001
   Product: LP009
   Amount: 500000
   Client Name: Fluxx Electric
   Product Name: Revenue Based Finance for EV
   Submitted By: Archi
   ✅ Created Asana task: 1234567890123456
   🔗 Task Link: https://app.asana.com/0/1211908004694493/1234567890123456
   ✅ Updated loan application with Asana task info

============================================================
📊 SUMMARY
============================================================

✅ Successful: 8
   - SF36220522BRY3QF: 1234567890123456
   - SF36225402KBU7DF: 1234567890123457
   ...

✨ Script completed!
```

## API Integration

### Service Functions

**Create Asana Task:**
```typescript
import { createAsanaTaskForLoan } from '../services/asana/asana.service.js';

const asanaTask = await createAsanaTaskForLoan(application);
// Returns: { taskId: string, taskLink: string } | null
```

**Update Loan Application:**
```typescript
import { updateLoanApplicationWithAsanaTask } from '../services/asana/asana.service.js';

await updateLoanApplicationWithAsanaTask(
  applicationId,
  fileId,
  asanaTaskId,
  asanaTaskLink
);
```

## Airtable Fields

The following fields are added to loan applications:

- **Asana Task ID**: The Asana task ID (e.g., `1234567890123456`)
- **Asana Task Link**: Direct link to the task in Asana

## Troubleshooting

### Asana Task Not Created

**Check:**
1. `ASANA_PAT` is set in `.env`
2. Token is valid (not expired)
3. Loan product has a mapping in `LOAN_PRODUCT_TO_ASANA_PROJECT`
4. Application has required fields: File ID, Client, Loan Product

**Logs:**
Check server logs for:
```
[AsanaService] Creating Asana task: ...
[AsanaService] ✅ Created Asana task: ...
[AsanaService] ❌ Failed to create Asana task: ...
```

### Task Created But Not Linked

**Check:**
1. Loan application update webhook is working
2. Application ID is correct
3. File ID matches

**Fix:**
Run the sync script to update existing tasks:
```bash
npm run sync:asana
```

### Product Not Mapped

**Solution:**
1. Get the Asana Project ID from Asana
2. Add mapping to `LOAN_PRODUCT_TO_ASANA_PROJECT` in `asana.service.ts`
3. Restart the server

## Next Steps

### Asana → Back Sync

To sync status changes from Asana back to loan applications:
1. Set up Asana webhook to notify on task status changes
2. Create endpoint to receive webhook
3. Update loan application status based on Asana task status

### Document Uploads + OCR

To integrate document uploads with OCR:
1. Upload documents to OneDrive/SharePoint
2. Trigger OCR processing
3. Extract text and metadata
4. Store in loan application

## Related Files

- `backend/src/services/asana/asana.service.ts` - Asana service
- `backend/src/controllers/loan.controller.ts` - Loan controller (integration points)
- `backend/scripts/sync-loans-to-asana.js` - Sync script

