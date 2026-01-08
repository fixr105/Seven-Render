# Functionality Fix Plan - Critical User-Facing Features

## Overview
This plan addresses the critical issues identified:
1. **Login/authentication** - Webhook not triggered
2. **Data fetching** - Works for dummy user but not actual logged-in user
3. **File uploads** - Not working
4. **Data creation/updates** - Working (posted to webhook properly)

## Phase 1: Fix Login/Authentication Webhook Issue

### 1.1 Diagnose Webhook Not Triggering
**Status**: In Progress
**Tasks**:
- [ ] Verify `N8N_BASE_URL` environment variable is set correctly in production
- [ ] Check webhook URL construction in `backend/src/controllers/auth.controller.ts`
- [ ] Add detailed logging to trace webhook call (URL, payload, response)
- [ ] Verify webhook URL format: `{N8N_BASE_URL}/webhook/validate`
- [ ] Test webhook directly using `backend/scripts/test-validate-webhook.ts`
- [ ] Check if webhook is active in n8n instance
- [ ] Verify CORS settings in n8n (if applicable)
- [ ] Check network connectivity from backend to n8n instance

**Files to Check**:
- `backend/src/controllers/auth.controller.ts` - validate endpoint
- `backend/src/utils/httpClient.ts` - HTTP client configuration
- `backend/src/config/webhookConfig.ts` - Webhook URL configuration
- `backend/src/services/airtable/n8nEndpoints.ts` - n8n endpoint definitions

### 1.2 Fix Webhook Call Implementation
**Status**: Pending
**Tasks**:
- [ ] Ensure webhook URL is correctly constructed
- [ ] Verify request payload format matches n8n webhook expectations
- [ ] Add retry logic with exponential backoff (if needed)
- [ ] Increase timeout if webhook is slow (currently 45s)
- [ ] Add circuit breaker to prevent cascading failures
- [ ] Handle webhook timeout gracefully with clear error messages
- [ ] Remove any redundant webhook calls (already fixed in validate endpoint)

**Expected Outcome**: Login should successfully trigger n8n validate webhook and return user data

---

## Phase 2: Fix Data Fetching for Logged-In Users

### 2.1 Diagnose Data Filtering Issues
**Status**: Pending
**Tasks**:
- [ ] Verify JWT token contains correct `clientId`, `kamId`, `nbfcId` fields
- [ ] Check if `auth.middleware.ts` correctly extracts user data from JWT
- [ ] Verify `dataFilterService` receives correct user object with IDs
- [ ] Add logging to trace filtering logic for each role
- [ ] Test data fetching for each role (client, kam, credit_team, nbfc)
- [ ] Compare dummy user vs actual logged-in user data structure

**Files to Check**:
- `backend/src/middleware/auth.middleware.ts` - Token verification
- `backend/src/services/auth/auth.service.ts` - JWT token generation/verification
- `backend/src/services/airtable/dataFilter.service.ts` - Data filtering logic
- `backend/src/controllers/loan.controller.ts` - Application listing
- `backend/src/controllers/client.controller.ts` - Client dashboard

### 2.2 Fix User ID Extraction from JWT
**Status**: Pending
**Tasks**:
- [ ] Ensure `validate` endpoint includes `clientId`, `kamId`, `nbfcId` in JWT payload
- [ ] Verify `verifyToken()` extracts all user fields correctly
- [ ] Add fallback logic if IDs are missing (log warning, don't fail silently)
- [ ] Test with actual user accounts from Airtable
- [ ] Verify user account data structure in Airtable matches expected format

**Expected Outcome**: Logged-in users should see filtered data based on their role and IDs

### 2.3 Fix Data Filtering Logic
**Status**: Pending
**Tasks**:
- [ ] Fix client filtering to match by `Client ID` field correctly
- [ ] Fix KAM filtering to use `Assigned KAM` field from Clients table
- [ ] Fix NBFC filtering to match assigned applications
- [ ] Add logging to show why records are filtered out
- [ ] Test filtering with real data from Airtable
- [ ] Handle edge cases (missing IDs, null values, etc.)

**Expected Outcome**: Each role should see only their authorized data

---

## Phase 3: Fix File Upload Functionality

### 3.1 Diagnose File Upload Issues
**Status**: Pending
**Tasks**:
- [ ] Verify `ONEDRIVE_UPLOAD_URL` environment variable is set
- [ ] Check if n8n OneDrive upload webhook is active
- [ ] Test file upload endpoint directly: `POST /api/documents/upload`
- [ ] Verify file size limits (currently 10MB)
- [ ] Check OneDrive authentication/access token
- [ ] Verify multer configuration for file handling
- [ ] Check error messages from upload service

**Files to Check**:
- `backend/src/routes/documents.routes.ts` - Upload endpoints
- `backend/src/services/onedrive/onedriveUpload.service.ts` - Upload service
- `backend/src/middleware/rateLimit.middleware.ts` - Upload rate limiting

### 3.2 Fix File Upload Implementation
**Status**: Pending
**Tasks**:
- [ ] Ensure `ONEDRIVE_UPLOAD_URL` is configured in production
- [ ] Verify webhook accepts file uploads in expected format
- [ ] Add proper error handling for upload failures
- [ ] Add file type validation (if needed)
- [ ] Add progress tracking (if needed)
- [ ] Test with various file types and sizes
- [ ] Verify OneDrive share links are returned correctly

**Expected Outcome**: Users should be able to upload files successfully

---

## Phase 4: Test All API Endpoints

### 4.1 Authentication Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `POST /api/auth/login` - Should call n8n validate webhook
- [ ] Test `POST /api/auth/validate` - Should return JWT token
- [ ] Test `POST /api/auth/refresh` - Should refresh token
- [ ] Test `POST /api/auth/logout` - Should invalidate token
- [ ] Test `GET /api/auth/me` - Should return current user

### 4.2 Loan Application Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `GET /api/loans` - Should return filtered applications
- [ ] Test `GET /api/loans/:id` - Should return single application
- [ ] Test `POST /api/loans` - Should create new application
- [ ] Test `POST /api/loans/:id/submit` - Should submit application
- [ ] Test `POST /api/loans/:id/withdraw` - Should withdraw application
- [ ] Test `GET /api/loans/:id/queries` - Should return queries
- [ ] Test `POST /api/loans/:id/queries/:queryId/resolve` - Should resolve query

### 4.3 Client Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `GET /api/client/dashboard` - Should return client dashboard data
- [ ] Test `GET /api/client/form-config` - Should return form configuration
- [ ] Test `GET /api/client/configured-products` - Should return configured products

### 4.4 KAM Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `GET /api/kam/dashboard` - Should return KAM dashboard
- [ ] Test `GET /api/kam/clients` - Should return managed clients
- [ ] Test `POST /api/kam/clients` - Should create new client
- [ ] Test `GET /api/kam/clients/:id` - Should return client details
- [ ] Test `GET /api/kam/loan-applications` - Should return applications
- [ ] Test `POST /api/kam/loan-applications/:id/forward-to-credit` - Should forward application

### 4.5 Credit Team Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `GET /api/credit/dashboard` - Should return credit dashboard
- [ ] Test `GET /api/credit/loan-applications` - Should return applications
- [ ] Test `POST /api/credit/loan-applications/:id/mark-disbursed` - Should mark disbursed
- [ ] Test `POST /api/credit/loan-applications/:id/close` - Should close application

### 4.6 NBFC Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `GET /api/nbfc/dashboard` - Should return NBFC dashboard
- [ ] Test `GET /api/nbfc/loan-applications` - Should return assigned applications
- [ ] Test `POST /api/nbfc/loan-applications/:id/decision` - Should record decision

### 4.7 Document Upload Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test `POST /api/documents/upload` - Should upload single file
- [ ] Test `POST /api/documents/upload-multiple` - Should upload multiple files

### 4.8 Other Endpoints
**Status**: Pending
**Tasks**:
- [ ] Test all product endpoints
- [ ] Test all query endpoints
- [ ] Test all notification endpoints
- [ ] Test all report endpoints
- [ ] Test all ledger endpoints
- [ ] Test all audit endpoints

---

## Phase 5: Verify n8n Webhook Integrations

### 5.1 Validate Webhook
**Status**: Pending
**Tasks**:
- [ ] Verify webhook URL: `{N8N_BASE_URL}/webhook/validate`
- [ ] Test webhook with sample credentials (Sagar, pass@123)
- [ ] Verify response format matches expected structure
- [ ] Check webhook response time (should be < 45s)
- [ ] Verify webhook is active and not paused in n8n

### 5.2 GET Webhooks (Data Fetching)
**Status**: Pending
**Tasks**:
- [ ] Verify all GET webhook URLs are correct
- [ ] Test each GET webhook returns data in expected format
- [ ] Verify caching is working (should prevent excessive calls)
- [ ] Check webhook response parsing handles all formats
- [ ] Test with filters/parameters if applicable

### 5.3 POST Webhooks (Data Creation/Updates)
**Status**: Pending
**Tasks**:
- [ ] Verify all POST webhook URLs are correct
- [ ] Test each POST webhook accepts data in expected format
- [ ] Verify webhook returns success/error responses
- [ ] Check data is correctly written to Airtable
- [ ] Test with various data formats

### 5.4 OneDrive Upload Webhook
**Status**: Pending
**Tasks**:
- [ ] Verify `ONEDRIVE_UPLOAD_URL` points to correct n8n webhook
- [ ] Test webhook accepts file uploads
- [ ] Verify webhook returns OneDrive share links
- [ ] Check file is actually uploaded to OneDrive
- [ ] Test with various file types

---

## Phase 6: Check Error Handling

### 6.1 Webhook Error Handling
**Status**: Pending
**Tasks**:
- [ ] Add proper error handling for webhook timeouts
- [ ] Add proper error handling for webhook failures
- [ ] Return user-friendly error messages
- [ ] Log all webhook errors with context
- [ ] Add retry logic where appropriate
- [ ] Add circuit breaker for failing webhooks

### 6.2 Authentication Error Handling
**Status**: Pending
**Tasks**:
- [ ] Handle invalid credentials gracefully
- [ ] Handle missing token errors
- [ ] Handle expired token errors
- [ ] Return appropriate HTTP status codes
- [ ] Add clear error messages for users

### 6.3 Data Fetching Error Handling
**Status**: Pending
**Tasks**:
- [ ] Handle empty data gracefully
- [ ] Handle filtering errors
- [ ] Handle missing user IDs
- [ ] Return appropriate error messages
- [ ] Log all data fetching errors

### 6.4 File Upload Error Handling
**Status**: Pending
**Tasks**:
- [ ] Handle file size limit errors
- [ ] Handle file type errors
- [ ] Handle upload service errors
- [ ] Handle OneDrive API errors
- [ ] Return user-friendly error messages

---

## Phase 7: Validate Data Flows

### 7.1 Login Flow
**Status**: Pending
**Tasks**:
- [ ] User enters credentials → Frontend sends to `/api/auth/validate`
- [ ] Backend calls n8n validate webhook
- [ ] n8n webhook queries Airtable and returns user data
- [ ] Backend generates JWT token with user data
- [ ] Frontend stores token and redirects to dashboard
- [ ] Verify user data is correct in JWT

### 7.2 Data Fetching Flow
**Status**: Pending
**Tasks**:
- [ ] User requests data → Frontend sends authenticated request
- [ ] Backend verifies JWT token and extracts user
- [ ] Backend calls n8n GET webhook (or uses cache)
- [ ] Backend filters data based on user role/IDs
- [ ] Backend returns filtered data to frontend
- [ ] Frontend displays data
- [ ] Verify data is correctly filtered

### 7.3 File Upload Flow
**Status**: Pending
**Tasks**:
- [ ] User selects file → Frontend sends to `/api/documents/upload`
- [ ] Backend validates file and calls OneDrive upload webhook
- [ ] n8n webhook uploads to OneDrive and returns share link
- [ ] Backend returns share link to frontend
- [ ] Frontend stores share link in form data
- [ ] Verify file is uploaded and link is valid

### 7.4 Data Creation/Update Flow
**Status**: Pending
**Tasks**:
- [ ] User submits form → Frontend sends to backend
- [ ] Backend validates data and calls n8n POST webhook
- [ ] n8n webhook writes data to Airtable
- [ ] n8n webhook returns success/error
- [ ] Backend returns response to frontend
- [ ] Verify data is correctly written to Airtable

---

## Phase 8: Fix Identified Issues

### 8.1 Immediate Fixes
**Status**: Pending
**Tasks**:
- [ ] Fix login webhook triggering issue
- [ ] Fix data filtering for logged-in users
- [ ] Fix file upload functionality
- [ ] Add missing error handling
- [ ] Fix any broken endpoints

### 8.2 Testing
**Status**: Pending
**Tasks**:
- [ ] Test all fixes with real user accounts
- [ ] Test all fixes with dummy/test accounts
- [ ] Verify no regressions
- [ ] Test error scenarios
- [ ] Test edge cases

### 8.3 Deployment
**Status**: Pending
**Tasks**:
- [ ] Deploy backend fixes to Fly.io
- [ ] Deploy frontend fixes to Vercel
- [ ] Verify environment variables are set
- [ ] Test in production environment
- [ ] Monitor for errors

---

## Success Criteria

1. ✅ Login successfully triggers n8n validate webhook and authenticates users
2. ✅ Logged-in users see correctly filtered data based on their role and IDs
3. ✅ File uploads work and return valid OneDrive share links
4. ✅ All API endpoints work correctly for all user roles
5. ✅ All n8n webhooks are properly integrated and working
6. ✅ Error handling is robust and user-friendly
7. ✅ Data flows are validated end-to-end

---

## Notes

- Focus on critical user-facing features first
- Test with real user accounts from Airtable
- Verify all environment variables are set in production
- Add comprehensive logging for debugging
- Monitor webhook response times and errors
- Ensure backward compatibility where possible
