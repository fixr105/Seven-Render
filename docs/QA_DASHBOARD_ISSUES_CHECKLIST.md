# QA Checklist - Dashboard Issues (PRD-Aligned)

This checklist validates the fixes for role-based data separation, onboarding, auth, and product access.

## Setup
- Use test users for Client, KAM A, KAM B, Credit Team, NBFC.
- Ensure KAM A and KAM B have distinct KAM IDs in `KAM Users`.
- Ensure NBFC and Credit Team users exist in `User Accounts` and their role tables.

## 1) Onboarding a new client causes existing clients to disappear / wrong KAM assignment
Steps:
1. Log in as KAM A.
2. Note current client list size.
3. Onboard a new client.
4. Verify list refreshes and still includes existing clients.
5. Inspect new client’s `Assigned KAM` field in Airtable.
Expected:
- Existing clients remain visible.
- New client appears immediately after onboarding.
- `Assigned KAM` matches KAM A record ID (not User Account ID).

## 2) Login succeeds with wrong password
Steps:
1. Attempt login with correct username + wrong password for each role.
Expected:
- 401 error with clear message.
- No token stored (localStorage/cookies).

## 3) Form mapping prevents loan products from being visible
Steps:
1. Log in as KAM A, map forms to client with no product selected.
2. Log in as that client and open New Application.
3. Confirm loan product list is populated.
4. Repeat with a specific product selected; only that product appears.
Expected:
- If no configured products exist, all active products show.
- If configured products exist, only those show.

## 4) Credit Team / NBFC login returns “Unexpected end of JSON input”
Steps:
1. Attempt valid Credit Team login.
2. Attempt valid NBFC login.
3. Attempt invalid credentials for each role.
Expected:
- Valid logins succeed.
- Invalid logins return JSON error, no JSON parse errors on frontend.

## 5) Cross-role lockout after failed NBFC/Credit logins
Steps:
1. Fail NBFC login 3–5 times from same IP.
2. Immediately log in as KAM A with valid credentials.
Expected:
- KAM login succeeds (rate limit is per user + IP).

## 6) Client appears under wrong KAM
Steps:
1. Onboard client under KAM A.
2. Log in as KAM B and view Clients list.
Expected:
- Client should not appear for KAM B.

## 7) Onboarding deletes old list
Steps:
1. Onboard client A, then client B.
2. Confirm list shows both clients.
Expected:
- No list truncation; new client appends or full list refreshes.

## Auditability checks

### Step-by-Step Instructions

#### 1. Verify Admin Activity Log for Client Creation
Steps:
1. Log in as KAM A.
2. Onboard a new client (record the client ID/name).
3. Navigate to Admin Activity Log in Airtable (or via API endpoint `/admin-activity-log`).
4. Search for entries with:
   - `Action Type`: `create_client`
   - `Performed By`: KAM A's email
   - `Target Entity`: `client`
   - `Related Client ID`: The newly created client's ID
5. Verify the log entry contains:
   - `Activity ID`: Unique identifier (format: `ACT-<timestamp>-<random>`)
   - `Timestamp`: Current timestamp when action was performed
   - `Description/Details`: Detailed description of the client creation
   - `Metadata`: JSON string with additional context (if applicable)

Expected:
- Entry appears within 1-2 seconds of client creation.
- All required fields are populated.
- `Performed By` matches the KAM user who created the client.

#### 2. Verify Admin Activity Log for Form Configuration
Steps:
1. Log in as KAM A.
2. Configure forms for a client (map forms to specific loan products).
3. Navigate to Admin Activity Log.
4. Search for entries with:
   - `Action Type`: `configure_form`
   - `Performed By`: KAM A's email
   - `Target Entity`: `form_configuration` or `client`
   - `Related Client ID`: The client ID for which forms were configured
5. Verify the log entry contains:
   - `Activity ID`: Unique identifier
   - `Timestamp`: When configuration was saved
   - `Description/Details`: Details about which forms/products were configured
   - `Metadata`: JSON with form mapping details (product IDs, form categories, etc.)

Expected:
- Entry appears immediately after form configuration is saved.
- Description includes which loan products were mapped.
- Related Client ID matches the configured client.

#### 3. Verify Audit Trail for Major Workflow Actions

**Application Creation:**
- `Action Type`: `create_application` or `save_draft`
- `Target Entity`: `loan_application`
- `Related File ID`: The created application's file ID
- `Related Client ID`: The client who created the application

**Status Changes:**
- `Action Type`: `status_change`, `forward_to_credit`, `assign_nbfc`, `mark_disbursed`, `mark_rejected`, `close_file`
- `Target Entity`: `loan_application`
- `Related File ID`: The application file ID
- `Description/Details`: Should include old status → new status transition
- `Metadata`: JSON with `oldStatus`, `newStatus`, and optional `reason`

**Query Actions:**
- `Action Type`: `raise_query`, `reply_to_query`, `resolve_query`
- `Target Entity`: `loan_application` or `query`
- `Related File ID`: The application file ID
- `Description/Details`: Query content and context

**Ledger Actions:**
- `Action Type`: `create_ledger_entry`, `create_payout_request`, `approve_payout`, `reject_payout`
- `Target Entity`: `commission_ledger` or `payout_request`
- `Related Client ID`: The client associated with the ledger entry
- `Related File ID`: The loan file ID (if applicable)

### Specific Audit Fields to Verify

For each audit log entry, verify these fields are present and accurate:

**Required Fields:**
- `Activity ID` (String, unique): Format `ACT-<timestamp>-<random>`
- `Timestamp` (DateTime): ISO 8601 format, accurate to the second
- `Performed By` (String): Email address of the user who performed the action
- `Action Type` (String): One of the predefined action types (see AdminActionType enum)
- `Description/Details` (String): Human-readable description of the action
- `Target Entity` (String): Entity type affected (e.g., `client`, `loan_application`, `form_configuration`)

**Optional Fields (when applicable):**
- `Related File ID` (String): For loan application-related actions
- `Related Client ID` (String): For client-related actions
- `Related User ID` (String): For user-related actions
- `Metadata` (String, JSON): Additional structured data about the action

### Workflow Actions to Audit

Test and verify audit logs for these specific workflow actions:

1. **Client Management:**
   - `create_client`: Client onboarding
   - `update_client`: Client information updates

2. **Form Configuration:**
   - `configure_form`: Mapping forms to clients/products

3. **Application Lifecycle:**
   - `create_application`: New application creation
   - `submit_application`: Application submission (not draft)
   - `save_draft`: Saving application as draft
   - `update_application`: Updating existing application

4. **Status Transitions:**
   - `status_change`: Generic status change
   - `forward_to_credit`: Forwarding to credit team
   - `assign_nbfc`: Assigning to NBFC
   - `mark_disbursed`: Marking as disbursed
   - `mark_rejected`: Rejecting application
   - `close_file`: Closing the file

5. **Commission & Payouts:**
   - `create_ledger_entry`: Creating ledger entry
   - `create_payout_request`: Requesting payout
   - `approve_payout`: Approving payout request
   - `reject_payout`: Rejecting payout request

6. **Queries:**
   - `raise_query`: Raising a query
   - `reply_to_query`: Replying to a query
   - `resolve_query`: Resolving a query

7. **System Actions:**
   - `login`: User login (optional, may be logged separately)
   - `logout`: User logout (optional)
   - `generate_report`: Report generation
   - `generate_ai_summary`: AI summary generation

## Security checks

### Route Access Control

#### Step-by-Step Instructions for Route Access Testing

**1. Test Client Route Access:**
Steps:
1. Log in as a Client user.
2. Attempt to access these routes (should succeed):
   - `GET /api/loan-applications` (own applications only)
   - `GET /api/loan-applications/:id` (own applications only)
   - `POST /api/loan-applications` (create own application)
   - `GET /api/loan-products` (view available products)
   - `GET /api/clients/:id` (own client record only)
3. Attempt to access these routes (should fail with 403):
   - `GET /api/kam/clients` (KAM-only route)
   - `GET /api/kam/users` (KAM-only route)
   - `POST /api/kam/clients` (KAM-only route)
   - `GET /api/credit/applications` (Credit Team-only route)
   - `GET /api/nbfc/applications` (NBFC-only route)
   - `GET /api/nbfc-partners` (Credit/NBFC-only route)

Expected:
- Client routes return 200/201 for authorized access.
- KAM/Credit/NBFC routes return 403 Forbidden.
- Error response includes: `{ success: false, error: 'Insufficient permissions', requiredRoles: [...], userRole: 'client' }`

**2. Test KAM Route Access:**
Steps:
1. Log in as a KAM user.
2. Attempt to access these routes (should succeed):
   - `GET /api/kam/clients` (own assigned clients only)
   - `GET /api/kam/clients/:id` (own assigned clients only)
   - `POST /api/kam/clients` (create client, assigned to self)
   - `GET /api/loan-applications` (applications for own clients)
   - `GET /api/form-categories` (form configuration)
   - `POST /api/form-categories/:id/configure` (configure forms for clients)
3. Attempt to access these routes (should fail with 403):
   - `GET /api/credit/applications` (Credit Team-only)
   - `GET /api/nbfc/applications` (NBFC-only)
   - `POST /api/nbfc-partners` (Credit-only)
   - `PATCH /api/nbfc-partners/:id` (Credit-only)

Expected:
- KAM routes return 200/201 for authorized access.
- Credit/NBFC routes return 403 Forbidden.
- Client data is filtered to only show KAM's assigned clients.

**3. Test Credit Team Route Access:**
Steps:
1. Log in as a Credit Team user.
2. Attempt to access these routes (should succeed):
   - `GET /api/credit/applications` (all applications in credit review)
   - `GET /api/credit/applications/:id` (application details)
   - `POST /api/loan-applications/:id/forward` (forward to NBFC)
   - `GET /api/nbfc-partners` (view NBFC partners)
   - `POST /api/nbfc-partners` (create NBFC partner)
   - `PATCH /api/nbfc-partners/:id` (update NBFC partner)
3. Attempt to access these routes (should fail with 403):
   - `GET /api/kam/clients` (KAM-only)
   - `POST /api/kam/clients` (KAM-only)
   - `GET /api/nbfc/applications` (NBFC-only, though Credit may have read access)

Expected:
- Credit routes return 200/201 for authorized access.
- KAM client management routes return 403 Forbidden.

**4. Test NBFC Route Access:**
Steps:
1. Log in as an NBFC user.
2. Attempt to access these routes (should succeed):
   - `GET /api/nbfc/applications` (assigned applications only)
   - `GET /api/nbfc/applications/:id` (assigned application details)
   - `GET /api/nbfc-partners` (view NBFC partners)
   - `PATCH /api/loan-applications/:id/status` (update status for assigned applications)
3. Attempt to access these routes (should fail with 403):
   - `GET /api/kam/clients` (KAM-only)
   - `POST /api/kam/clients` (KAM-only)
   - `GET /api/credit/applications` (Credit Team-only)
   - `POST /api/nbfc-partners` (Credit-only)
   - `PATCH /api/nbfc-partners/:id` (Credit-only)

Expected:
- NBFC routes return 200/201 for authorized access.
- KAM and Credit management routes return 403 Forbidden.

**5. Test Unauthenticated Access:**
Steps:
1. Do not log in (or clear authentication token).
2. Attempt to access any protected route:
   - `GET /api/loan-applications`
   - `GET /api/kam/clients`
   - `GET /api/credit/applications`
   - `POST /api/loan-applications`

Expected:
- All routes return 401 Unauthorized.
- Error response: `{ success: false, error: 'No token provided' }` or `{ success: false, error: 'Authentication required' }`
- No data is returned.

### Token Validation

#### Step-by-Step Instructions for Token Validation Testing

**1. Verify Token Structure:**
Steps:
1. Log in as each role (Client, KAM, Credit Team, NBFC).
2. Inspect the JWT token stored in localStorage (or cookies).
3. Decode the token (using jwt.io or similar) and verify it contains:
   - `id`: User ID
   - `email`: User email address
   - `role`: User role (`client`, `kam`, `credit_team`, `nbfc`)
   - `clientId`: Client ID (for Client role only, should match Airtable Client record ID)
   - `kamId`: KAM ID (for KAM role only, should match Airtable KAM Users record ID)
   - `nbfcId`: NBFC ID (for NBFC role only, should match Airtable NBFC Partners record ID)
   - `iat`: Issued at timestamp
   - `exp`: Expiration timestamp

Expected:
- Token contains all required fields for the user's role.
- Role-specific IDs (`clientId`, `kamId`, `nbfcId`) are present only for the corresponding role.
- Token expiration is set appropriately (typically 24 hours or as configured).

**2. Verify Role-Specific IDs in Token:**
Steps:
1. Log in as Client user.
2. Verify token contains `clientId` that matches the Client record ID in Airtable.
3. Verify token does NOT contain `kamId` or `nbfcId`.
4. Log in as KAM user.
5. Verify token contains `kamId` that matches the KAM Users record ID in Airtable.
6. Verify token does NOT contain `clientId` or `nbfcId`.
7. Log in as NBFC user.
8. Verify token contains `nbfcId` that matches the NBFC Partners record ID in Airtable.
9. Verify token does NOT contain `clientId` or `kamId`.

Expected:
- Each role's token contains only the relevant role-specific ID.
- Role-specific IDs match the corresponding Airtable record IDs (not User Account IDs).

**3. Verify Token Expiration:**
Steps:
1. Log in and note the token expiration time.
2. Wait until token expires (or manually expire it).
3. Attempt to make an API request with the expired token.

Expected:
- Request returns 401 Unauthorized.
- Error response: `{ success: false, error: 'Invalid token' }` or `{ success: false, error: 'Token expired' }`
- User is redirected to login page (frontend behavior).

**4. Verify Invalid Token Handling:**
Steps:
1. Manually modify the JWT token (corrupt signature or payload).
2. Attempt to make an API request with the invalid token.

Expected:
- Request returns 401 Unauthorized.
- Error response: `{ success: false, error: 'Invalid token' }`
- No user data is attached to the request.

**5. Verify Missing Token Handling:**
Steps:
1. Clear authentication token from localStorage/cookies.
2. Attempt to make an API request without Authorization header.

Expected:
- Request returns 401 Unauthorized.
- Error response: `{ success: false, error: 'No token provided' }`
- Frontend redirects to login page.

### Middleware Enforcement Points

The following middleware enforce security at different layers:

1. **Authentication Middleware** (`authenticate`):
   - Validates JWT token from `Authorization: Bearer <token>` header
   - Attaches `req.user` object with user details
   - Returns 401 if token is missing, invalid, or expired

2. **RBAC Middleware** (`requireRole`):
   - Checks if `req.user.role` matches allowed roles for the route
   - Returns 403 if user role is not in the allowed roles list
   - Used for route-level protection

3. **Role Enforcement Middleware** (`enforceRolePermissions`):
   - Checks action-level permissions based on user role
   - Supports admin override tokens (for testing/debugging)
   - Returns 403 if action is not allowed for the user's role
   - Used for fine-grained permission control

### Route Protection Summary

| Route Pattern | Client | KAM | Credit Team | NBFC | Notes |
|--------------|--------|-----|-------------|------|-------|
| `/api/loan-applications` (GET) | ✅ Own only | ✅ Own clients | ✅ All in review | ✅ Assigned only | Filtered by role |
| `/api/loan-applications` (POST) | ✅ | ❌ | ❌ | ❌ | Clients create applications |
| `/api/kam/clients` | ❌ | ✅ Own assigned | ❌ | ❌ | KAM-only |
| `/api/kam/clients` (POST) | ❌ | ✅ | ❌ | ❌ | KAM creates clients |
| `/api/credit/applications` | ❌ | ❌ | ✅ | ❌ | Credit Team-only |
| `/api/nbfc/applications` | ❌ | ❌ | ❌ | ✅ Assigned only | NBFC-only |
| `/api/nbfc-partners` (GET) | ❌ | ❌ | ✅ | ✅ | Credit & NBFC can view |
| `/api/nbfc-partners` (POST/PATCH) | ❌ | ❌ | ✅ | ❌ | Credit-only for create/update |
| `/api/form-categories` | ❌ | ✅ | ❌ | ❌ | KAM configures forms |
| `/api/loan-products` (GET) | ✅ | ✅ | ✅ | ✅ | All roles can view |
