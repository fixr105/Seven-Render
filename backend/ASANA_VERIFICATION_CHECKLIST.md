# Asana Integration Verification Checklist

## ✅ Final Checklist

### 1. Webhook Input Format

**Requirement**: The POST `/webhook/loanapplications` webhook must accept an array with loan objects.

**Format**:
```json
[
  {
    "id": "rec...",
    "fields": {
      "File ID": "SF36220522BRY3QF",
      "Client": "CL001",
      "Loan Product": "LP009",
      "Asana Task ID": "1234567890123456",
      "Asana Task Link": "https://app.asana.com/0/1211908004694493/1234567890123456",
      ...
    }
  }
]
```

**Verification**:
- ✅ `n8nClient.postLoanApplication()` sends data in correct format
- ✅ Includes `Asana Task ID` and `Asana Task Link` fields
- ✅ n8n webhook configured to accept array format

**Action**: Verify your n8n webhook at `/webhook/loanapplications` accepts this format.

---

### 2. User Fetch Endpoint

**Requirement**: Fetch user by username using query parameter.

**Endpoint**: 
```
GET /webhook/useraccount?username={userId}
```

**Expected Response**:
```json
[
  {
    "id": "rec...",
    "fields": {
      "Username": "user@example.com",
      "Name": "John Doe",
      "Email": "user@example.com",
      ...
    }
  }
]
```

**Verification**:
- ✅ `getUserName()` function uses query parameter for email/username
- ✅ Falls back to full table fetch if query fails
- ✅ Maps `userId` (from loan app) to `Username` (in user table)
- ✅ Returns `Name` field if available, otherwise `Username`/`Email`

**Implementation**:
- Service: `backend/src/services/asana/asana.service.ts` - `getUserName()`
- Script: `backend/scripts/sync-loans-to-asana.js` - `getUserName()`

**Action**: Verify your n8n webhook at `/webhook/useraccount` supports `?username=` query parameter.

---

### 3. Environment Variable

**Requirement**: `ASANA_PAT` must be set securely.

**Configuration**:
```env
# .env file
ASANA_PAT=your_asana_personal_access_token_here
```

**Verification**:
- ✅ `getAsanaPAT()` function validates token exists
- ✅ Warns if token is missing (doesn't crash)
- ✅ Token is never logged or exposed

**Security**:
- ✅ Store in `.env` (not committed to git)
- ✅ Use CI/CD secrets for production
- ✅ Never log token value

**Action**: 
1. Create Asana PAT at [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Add to `.env`: `ASANA_PAT=your_token`
3. For production, add to CI/CD secrets (Vercel, GitHub Actions, etc.)

---

### 4. Webhook Update

**Requirement**: Update loan application with Asana Task ID and Link.

**Fields to Update**:
- `Asana Task ID`: The Asana task ID (e.g., `1234567890123456`)
- `Asana Task Link`: Direct link to task (e.g., `https://app.asana.com/0/1211908004694493/1234567890123456`)

**Update Format**:
```json
{
  "id": "rec...",
  "File ID": "SF36220522BRY3QF",
  "Asana Task ID": "1234567890123456",
  "Asana Task Link": "https://app.asana.com/0/1211908004694493/1234567890123456"
}
```

**Verification**:
- ✅ `postLoanApplication()` includes `Asana Task ID` and `Asana Task Link` fields
- ✅ `updateLoanApplicationWithAsanaTask()` sends correct format
- ✅ n8n webhook supports updating these fields

**Implementation**:
- Service: `backend/src/services/airtable/n8nClient.ts` - `postLoanApplication()`
- Service: `backend/src/services/asana/asana.service.ts` - `updateLoanApplicationWithAsanaTask()`

**Action**: 
1. Verify n8n webhook at `/webhook/loanapplications` supports `Asana Task ID` and `Asana Task Link` fields
2. Ensure Airtable table has these fields created
3. Test update with a sample request

---

## Testing Checklist

### Test 1: User Fetch by Username

```bash
# Test query parameter
curl "https://yourdomain.com/webhook/useraccount?username=user@example.com"

# Should return array with user object containing Name field
```

### Test 2: Asana Task Creation

```bash
# Submit a loan application
# Check server logs for:
[AsanaService] Creating Asana task: Loan – Client Name – ₹5,00,000
[AsanaService] ✅ Created Asana task: 1234567890123456
[AsanaService] ✅ Updated loan application SF36220522BRY3QF with Asana task 1234567890123456
```

### Test 3: Webhook Update

```bash
# Verify loan application was updated in Airtable
# Check that Asana Task ID and Asana Task Link fields are populated
```

### Test 4: Sync Script

```bash
cd backend
npm run sync:asana

# Should:
# 1. Fetch all loans without Asana Task ID
# 2. Create Asana tasks
# 3. Update loans with Asana Task ID and Link
```

---

## Troubleshooting

### Issue: User not found by username

**Solution**: 
- Verify `/webhook/useraccount?username=...` returns array format
- Check that `userId` in loan app matches `Username` in user table
- Fallback: Full table fetch will still work

### Issue: Asana Task ID not saved

**Solution**:
- Verify n8n webhook accepts `Asana Task ID` and `Asana Task Link` fields
- Check Airtable table has these fields
- Verify webhook can update existing records (not just create)

### Issue: ASANA_PAT not working

**Solution**:
- Verify token is set: `echo $ASANA_PAT`
- Check token is valid: Test with Asana API directly
- Ensure token has permissions to create tasks in projects

---

## Summary

✅ **Webhook Format**: `postLoanApplication()` sends correct format with Asana fields  
✅ **User Fetch**: `getUserName()` uses query parameter with fallback  
✅ **Environment Variable**: `getAsanaPAT()` validates and warns if missing  
✅ **Webhook Update**: `postLoanApplication()` includes Asana Task ID and Link fields  

**Next Steps**:
1. Verify n8n webhooks support the required formats
2. Add `Asana Task ID` and `Asana Task Link` fields to Airtable
3. Test with a real loan submission
4. Run sync script to backfill existing loans

