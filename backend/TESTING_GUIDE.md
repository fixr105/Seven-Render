# Testing Guide for Functionality Fixes

This guide provides instructions for testing all the fixes implemented for:
1. Login/authentication webhook triggering
2. Data fetching for logged-in users (ID extraction)
3. File uploads
4. All API endpoints

## Prerequisites

1. **Backend server running**
   ```bash
   cd backend
   npm run dev
   ```

2. **Environment variables set**
   - `N8N_BASE_URL` - n8n instance URL
   - `ONEDRIVE_UPLOAD_URL` - OneDrive upload webhook URL (for file upload tests)
   - `API_BASE_URL` - Backend API URL (default: http://localhost:3001/api)

3. **Test users available**
   - `Sagar` / `pass@123` (KAM user)
   - Other test users as needed

## Quick Start

Run the comprehensive test suite:

```bash
cd backend
npm run test:fixes
```

This will run all test phases and generate a report.

## Individual Test Phases

### Phase 1: Test Login/Authentication Webhook

#### 1.1 Test Validate Endpoint Directly

```bash
cd backend
npm run test:webhook
```

This tests the n8n validate webhook directly.

**Expected Results:**
- Status: 200 OK
- Response format: `[{ "output": "{\"username\": \"Sagar\", \"role\": \"kam\", \"Associated profile\": \"Sagar\"}" }]`
- Duration: < 45 seconds

#### 1.2 Test Login via Backend API

Use the comprehensive test suite or test manually:

```bash
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"Sagar","passcode":"pass@123"}'
```

**Expected Results:**
- Status: 200 OK
- Response contains: `success: true`, `token`, `user` object
- User object includes: `id`, `email`, `role`, `name`, `clientId`/`kamId`/`nbfcId`

#### 1.3 Verify Backend Logs

```bash
cd backend
npx tsx scripts/verify-backend-logs.ts
```

**Expected Results:**
- All required log entries present:
  - `VALIDATE_N8N_WEBHOOK_CALL_STARTED`
  - `VALIDATE_HTTP_POST_CALL`
  - `VALIDATE_HTTP_POST_SUCCESS`
  - `VALIDATE_PARSED_OUTPUT`
  - `VALIDATE_TOKEN_GENERATION`
  - `VALIDATE_SUCCESS`

### Phase 2: Test Data Fetching for Logged-In Users

#### 2.1 Test Data Filtering

```bash
cd backend
npx tsx scripts/test-data-filtering.ts
```

**Expected Results:**
- JWT token contains correct IDs (clientId, kamId, or nbfcId)
- Data endpoints return filtered data based on user role
- Only authorized data is visible

#### 2.2 Test JWT Token Contains IDs

Decode the JWT token from login response (use jwt.io or similar) and verify:
- `userId`: User identifier
- `email`: User email
- `role`: User role
- `name`: User display name
- `clientId`: Client ID (if role is client)
- `kamId`: KAM ID (if role is kam)
- `nbfcId`: NBFC ID (if role is nbfc)

#### 2.3 Test Data Fetching Endpoints

Test each endpoint with authentication:

```bash
# Get token first
TOKEN=$(curl -X POST http://localhost:3001/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"Sagar","passcode":"pass@123"}' | jq -r '.token')

# Test endpoints
curl -X GET http://localhost:3001/api/loans \
  -H "Authorization: Bearer $TOKEN"

curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results:**
- All endpoints return 200 OK
- Data is filtered correctly based on user role
- User data includes all required fields

### Phase 3: Test File Uploads

#### 3.1 Test Upload Configuration

```bash
echo $ONEDRIVE_UPLOAD_URL
```

**Expected Results:**
- Environment variable is set
- URL points to n8n webhook

#### 3.2 Test Upload Endpoints

```bash
cd backend
npx tsx scripts/test-file-uploads.ts
```

**Expected Results:**
- Upload endpoint is accessible
- Single file upload succeeds
- Response contains OneDrive share link
- File is accessible via share link

### Phase 4: Test All API Endpoints

Run the comprehensive test suite which includes endpoint testing:

```bash
cd backend
npm run test:fixes
```

Or test manually using the endpoints listed in the test plan.

## Test Results

After running tests, results are saved to:
- `backend/test-functionality-fixes-results.json` - Detailed JSON results

## Troubleshooting

### Webhook Not Triggering

1. Check `N8N_BASE_URL` is set correctly
2. Verify webhook URL: `{N8N_BASE_URL}/webhook/validate`
3. Check n8n workflow is active
4. Review backend logs for errors

### Data Not Filtered

1. Verify JWT token contains IDs (clientId, kamId, nbfcId)
2. Check user exists in appropriate table (Clients, KAM Users, etc.)
3. Verify data filtering logic in `dataFilter.service.ts`

### File Upload Fails

1. Check `ONEDRIVE_UPLOAD_URL` is set
2. Verify n8n OneDrive webhook is active
3. Check file size limits (10MB max)
4. Review error messages in response

## Manual Testing Checklist

- [ ] Login with valid credentials
- [ ] Verify token is returned
- [ ] Verify user data includes IDs
- [ ] Test data fetching endpoints
- [ ] Verify data is filtered correctly
- [ ] Test file upload
- [ ] Verify upload returns share link
- [ ] Check backend logs for errors

## Success Criteria

All tests should pass:
- ✅ Login/authentication works
- ✅ Webhook is triggered
- ✅ JWT contains correct IDs
- ✅ Data is filtered correctly
- ✅ File uploads work
- ✅ All endpoints return expected responses
