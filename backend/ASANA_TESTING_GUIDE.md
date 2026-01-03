# Asana Integration Testing Guide

## Quick Start Testing

### Prerequisites

1. **Set up environment variable**:
   ```bash
   # In backend/.env
   ASANA_PAT=your_asana_personal_access_token
   ```

2. **Get Asana PAT**:
   - Go to https://app.asana.com/0/my-apps
   - Click "Create new token"
   - Copy the token

3. **Start backend server**:
   ```bash
   cd backend
   npm run dev
   ```

---

## Testing Methods

### Method 1: Test via Loan Submission (Recommended)

This tests the full integration flow automatically.

#### Steps:

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Submit a loan application** via frontend or API:
   
   **Via Frontend**:
   - Go to http://localhost:3000
   - Login as a client user
   - Create and submit a new loan application
   
   **Via API** (using curl or Postman):
   ```bash
   curl -X POST http://localhost:3001/loan-applications \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "productId": "LP009",
       "applicantName": "Test Client",
       "requestedLoanAmount": "500000",
       "formData": {},
       "saveAsDraft": false
     }'
   ```

3. **Check server logs** for Asana integration:
   ```
   [AsanaService] Creating Asana task: Loan – Test Client – ₹5,00,000
   [AsanaService] ✅ Created Asana task: 1234567890123456
   [AsanaService] ✅ Updated loan application SF36220522BRY3QF with Asana task 1234567890123456
   ```

4. **Verify in Asana**:
   - Go to your Asana workspace
   - Check the project mapped to the loan product (e.g., "Revenue Based Finance for EV")
   - Look for a new task: "Loan – Test Client – ₹5,00,000"

5. **Verify in Airtable**:
   - Open Loan Applications table
   - Find the application by File ID
   - Check that `Asana Task ID` and `Asana Task Link` fields are populated

---

### Method 2: Test Sync Script (For Existing Loans)

This tests the sync script for backfilling existing loans.

#### Steps:

1. **Run the sync script**:
   ```bash
   cd backend
   npm run sync:asana
   ```

2. **Check output**:
   ```
   🚀 Sync Loans to Asana Script
   ==============================
   
   📋 Fetching loan applications...
      ✅ Fetched 15 loan applications
   
   📊 Found 8 applications to sync (all status, no Asana Task ID)
   
   Processing 1/8: SF36220522BRY3QF
      ✅ Created Asana task: 1234567890123456
      ✅ Updated loan application with Asana task info
   
   ✅ Successful: 8
   ```

3. **Verify results**:
   - Check Asana for new tasks
   - Check Airtable for updated `Asana Task ID` fields

---

### Method 3: Test Individual Components

#### Test 1: User Fetch by Username

```bash
# Test the user account webhook with username query
curl "http://localhost:3001/webhook/useraccount?username=user@example.com"

# Or using n8n base URL directly
curl "https://fixrrahul.app.n8n.cloud/webhook/useraccount?username=user@example.com"
```

**Expected Response**:
```json
[
  {
    "id": "rec...",
    "fields": {
      "Username": "user@example.com",
      "Name": "John Doe",
      "Email": "user@example.com"
    }
  }
]
```

#### Test 2: Asana API Directly

```bash
# Test Asana API with your PAT
curl -X POST https://app.asana.com/api/1.0/tasks \
  -H "Authorization: Bearer YOUR_ASANA_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "Test Task",
      "notes": "Testing Asana integration",
      "projects": ["1211908004694493"]
    }
  }'
```

**Expected Response**:
```json
{
  "data": {
    "gid": "1234567890123456",
    "name": "Test Task",
    ...
  }
}
```

#### Test 3: Loan Application Update

```bash
# Test updating a loan application with Asana Task ID
curl -X POST http://localhost:3001/webhook/loanapplications \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rec...",
    "File ID": "SF36220522BRY3QF",
    "Asana Task ID": "1234567890123456",
    "Asana Task Link": "https://app.asana.com/0/1211908004694493/1234567890123456"
  }'
```

---

## Testing Checklist

### ✅ Pre-Testing Setup

- [ ] `ASANA_PAT` is set in `.env`
- [ ] Backend server is running
- [ ] You have a test loan product that's mapped to an Asana project
- [ ] You have a test client user account
- [ ] Asana project exists and you have access

### ✅ Test Scenarios

#### Scenario 1: New Loan Submission
- [ ] Submit a new loan application (not draft)
- [ ] Check server logs for Asana task creation
- [ ] Verify task appears in Asana project
- [ ] Verify `Asana Task ID` is saved in Airtable
- [ ] Verify `Asana Task Link` is saved in Airtable

#### Scenario 2: Draft Submission
- [ ] Create a draft loan application
- [ ] Submit the draft
- [ ] Verify Asana task is created on submission
- [ ] Verify task details are correct

#### Scenario 3: Sync Existing Loans
- [ ] Run `npm run sync:asana`
- [ ] Verify all eligible loans get Asana tasks
- [ ] Verify no duplicate tasks are created
- [ ] Verify all loans are updated with Asana Task ID

#### Scenario 4: User Fetch
- [ ] Test with email/username: `/webhook/useraccount?username=user@example.com`
- [ ] Verify returns array with user object
- [ ] Verify `Name` field is returned

#### Scenario 5: Error Handling
- [ ] Test with missing `ASANA_PAT` (should warn, not crash)
- [ ] Test with invalid loan product (should skip, not crash)
- [ ] Test with missing client info (should use fallback)

---

## Debugging

### Check Server Logs

Look for these log messages:

**Success**:
```
[AsanaService] Creating Asana task: Loan – Client Name – ₹5,00,000
[AsanaService] ✅ Created Asana task: 1234567890123456
[AsanaService] ✅ Updated loan application SF36220522BRY3QF with Asana task 1234567890123456
```

**Warnings** (non-fatal):
```
[AsanaService] ASANA_PAT not configured, skipping Asana task creation
[AsanaService] No Asana project mapping found for loan product: LP999
[AsanaService] Failed to fetch user name for user@example.com
```

**Errors** (should be logged but not crash):
```
[AsanaService] Failed to create Asana task: 401 Unauthorized
[AsanaService] Failed to update loan application with Asana task: ...
```

### Common Issues

#### Issue: "ASANA_PAT not configured"
**Solution**: Add `ASANA_PAT=your_token` to `backend/.env`

#### Issue: "No Asana project mapping found"
**Solution**: Add mapping in `backend/src/services/asana/asana.service.ts`:
```typescript
const LOAN_PRODUCT_TO_ASANA_PROJECT = {
  'Your Product Name': 'your_asana_project_id',
  // ...
};
```

#### Issue: "Failed to create Asana task: 401"
**Solution**: 
- Verify Asana PAT is valid
- Check token hasn't expired
- Ensure token has permissions to create tasks

#### Issue: "Asana Task ID not saved in Airtable"
**Solution**:
- Verify n8n webhook accepts `Asana Task ID` and `Asana Task Link` fields
- Check Airtable table has these fields created
- Verify webhook can update existing records

---

## Quick Test Script

Create a simple test file to verify the integration:

```bash
# Create test file
cat > backend/test-asana.js << 'EOF'
import dotenv from 'dotenv';
dotenv.config();

import { createAsanaTaskForLoan } from './src/services/asana/asana.service.js';

// Test data
const testApplication = {
  id: 'test-app-001',
  'File ID': 'TEST-001',
  'Client': 'CL001',
  'Loan Product': 'LP009',
  'Requested Loan Amount': '500000',
  'Submitted By': 'test@example.com',
};

console.log('Testing Asana integration...');
createAsanaTaskForLoan(testApplication)
  .then(result => {
    if (result) {
      console.log('✅ Success!', result);
    } else {
      console.log('⚠️  Task creation skipped (check logs)');
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
  });
EOF

# Run test
cd backend
node test-asana.js
```

---

## Production Testing

Before deploying to production:

1. **Test in staging environment** first
2. **Verify environment variables** are set in production
3. **Test with real loan submission** (small test loan)
4. **Monitor logs** for any errors
5. **Verify Asana tasks** are created correctly
6. **Verify Airtable updates** are working

---

## Where to Test

### Local Development
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Logs**: Terminal running `npm run dev`

### Staging/Production
- **Backend**: Your deployed backend URL
- **Frontend**: Your deployed frontend URL
- **Logs**: Vercel logs, CloudWatch, or your logging service

---

## Next Steps After Testing

1. ✅ Verify all test scenarios pass
2. ✅ Check Asana tasks are created correctly
3. ✅ Verify Airtable fields are populated
4. ✅ Test error handling
5. ✅ Deploy to production
6. ✅ Monitor first few real submissions

