# 🛠️ Cursor Prompts to Fix QA Issues

## Priority 1: Frontend Integration (CRITICAL)

### 1. Create API Client Service

**Cursor, create a new file `src/services/api.ts` that:**
- Exports a class `ApiClient` with methods for all backend endpoints
- Uses `fetch` to call backend API at `process.env.VITE_API_URL || 'http://localhost:3000'`
- Stores JWT token in `localStorage` with key `'auth_token'`
- Automatically adds `Authorization: Bearer <token>` header to all authenticated requests
- Handles token refresh if needed
- Provides typed methods for:
  - `login(email: string, password: string): Promise<LoginResponse>`
  - `getMe(): Promise<UserContext>`
  - `getClientDashboard(): Promise<DashboardSummary>`
  - `getFormConfig(): Promise<FormConfigResponse>`
  - `createApplication(data: CreateApplicationRequest): Promise<LoanApplicationResponse>`
  - `listApplications(): Promise<LoanApplicationResponse[]>`
  - `getApplication(id: string): Promise<LoanApplicationResponse>`
  - And all other endpoints from `API_DOCUMENTATION.md`
- Handles errors and returns proper error messages
- Uses TypeScript types from backend `types/responses.ts`

### 2. Update Login Page

**Cursor, update `src/pages/Login.tsx` to:**
- Import and use the `ApiClient` from `src/services/api.ts`
- Replace Supabase `signIn` with `apiClient.login(email, password)`
- Store the returned JWT token in localStorage
- Update `AuthContext` to use the token instead of Supabase session
- Handle authentication errors and display them to the user
- Redirect to dashboard on successful login
- Remove all Supabase imports and dependencies

### 3. Update Auth Context

**Cursor, update `src/contexts/AuthContext.tsx` to:**
- Remove Supabase auth dependencies
- Use `ApiClient` from `src/services/api.ts`
- Check for JWT token in localStorage on mount
- Call `apiClient.getMe()` to validate token and get user data
- Store user data in context state
- Provide `signIn(email, password)` method that calls `apiClient.login()`
- Provide `signOut()` method that clears token from localStorage
- Remove all Supabase-related code

### 4. Update Client Dashboard

**Cursor, update the Client Dashboard page to:**
- Import `ApiClient` from `src/services/api.ts`
- Replace Supabase queries with `apiClient.getClientDashboard()`
- Display data from backend response structure
- Handle loading and error states
- Remove all Supabase imports

### 5. Update Loan Application Form

**Cursor, update the loan application form to:**
- Call `apiClient.getFormConfig()` to fetch dynamic form fields
- Render form fields dynamically based on the response
- Submit form data to `apiClient.createApplication(data)`
- Handle validation errors from backend
- Show success message and redirect on success
- Remove all Supabase insert operations

### 6. Update Commission Ledger Page

**Cursor, update the commission ledger page to:**
- Call `apiClient.getClientLedger()` instead of Supabase query
- Display ledger entries from backend response
- Call `apiClient.createPayoutRequest(data)` for payout requests
- Call `apiClient.getPayoutRequests()` to list payout requests
- Remove all Supabase queries

### 7. Update Status Transition Buttons

**Cursor, update all status transition buttons (e.g., "Forward to Credit", "Approve", "Reject") to:**
- Call appropriate backend POST endpoints via `ApiClient`
- Use correct endpoint paths (e.g., `/kam/loan-applications/:id/forward-to-credit`)
- Handle success/error responses
- Refresh data after status change
- Remove all Supabase update operations

### 8. Update All Dashboard Pages

**Cursor, update all dashboard pages (KAM, Credit, NBFC) to:**
- Use `ApiClient` methods instead of Supabase queries
- Call appropriate backend GET endpoints (e.g., `getKAMDashboard()`, `getCreditDashboard()`)
- Display data from backend responses
- Handle loading and error states
- Remove all Supabase dependencies

### 9. Update Application List Pages

**Cursor, update all application list pages to:**
- Use `apiClient.listApplications()` instead of Supabase queries
- Apply role-based filtering (handled by backend)
- Display applications from backend response
- Remove all Supabase queries

### 10. Update Query/Reply System

**Cursor, update the query and reply system to:**
- Use backend endpoints for creating queries and replies
- Call `apiClient.replyToQuery(applicationId, queryId, reply)` for client replies
- Call `apiClient.raiseQuery(applicationId, query)` for KAM/Credit queries
- Display queries from backend response
- Remove all Supabase query operations

## Priority 2: Missing Endpoints (Optional Enhancements)

### 11. Create Loan Products Endpoints

**Cursor, create new routes file `backend/src/routes/loanProducts.routes.ts` with:**
- `GET /loan-products` - List all loan products (all authenticated users)
- `GET /loan-products/:id` - Get single product (all authenticated users)
- `POST /loan-products` - Create product (CREDIT only)
- `PATCH /loan-products/:id` - Update product (CREDIT only)
- `DELETE /loan-products/:id` - Delete product (CREDIT only)
- Use `n8nClient.postLoanProduct()` for POST/PATCH
- Use GET webhook to fetch products
- Add controller methods in `loanProducts.controller.ts`
- Mount routes in `routes/index.ts`

### 12. Create NBFC Partners Endpoints

**Cursor, create new routes file `backend/src/routes/nbfcPartners.routes.ts` with:**
- `GET /nbfc-partners` - List all NBFC partners (all authenticated users)
- `GET /nbfc-partners/:id` - Get single partner (all authenticated users)
- `POST /nbfc-partners` - Create partner (CREDIT only)
- `PATCH /nbfc-partners/:id` - Update partner (CREDIT only)
- `DELETE /nbfc-partners/:id` - Delete partner (CREDIT only)
- Use `n8nClient.postNBFCPartner()` for POST/PATCH
- Use GET webhook to fetch partners
- Add controller methods in `nbfcPartners.controller.ts`
- Mount routes in `routes/index.ts`

### 13. Create KAM Users Management Endpoints

**Cursor, create new routes file `backend/src/routes/kamUsers.routes.ts` with:**
- `GET /kam-users` - List KAM users (CREDIT only)
- `GET /kam-users/:id` - Get single KAM user (CREDIT only)
- `POST /kam-users` - Create KAM user (CREDIT only)
- `PATCH /kam-users/:id` - Update KAM user (CREDIT only)
- `DELETE /kam-users/:id` - Deactivate KAM user (CREDIT only)
- Use `n8nClient.postKamUser()` for POST/PATCH
- Use GET webhook to fetch KAM users
- Add controller methods in `kamUsers.controller.ts`
- Mount routes in `routes/index.ts`

### 14. Create Form Fields Management Endpoints

**Cursor, create new routes file `backend/src/routes/formFields.routes.ts` with:**
- `GET /form-fields` - List form fields (all authenticated users)
- `GET /form-fields/:id` - Get single field (all authenticated users)
- `POST /form-fields` - Create field (CREDIT/KAM only)
- `PATCH /form-fields/:id` - Update field (CREDIT/KAM only)
- `DELETE /form-fields/:id` - Delete field (CREDIT/KAM only)
- Use `n8nClient.postFormField()` for POST/PATCH
- Use GET webhook to fetch form fields
- Add controller methods in `formFields.controller.ts`
- Mount routes in `routes/index.ts`

## Priority 3: Enhancements

### 15. Add Password Hashing to User Creation

**Cursor, update all controllers that create users to:**
- Import `authService` from `services/auth/auth.service.ts`
- Hash passwords using `await authService.hashPassword(password)` before sending to n8n
- Ensure passwords are never sent as plaintext
- Update `kam.controller.ts` (already fixed, verify)
- Update `creditTeamUsers.controller.ts` if it creates User Accounts
- Update any other controllers that create users

### 16. Add Request Validation

**Cursor, ensure all POST/PATCH endpoints have:**
- Zod schema validation using schemas from `utils/validators.ts`
- Return 400 Bad Request with error details on validation failure
- Validate all required fields
- Add validation to any endpoints missing it

### 17. Add Error Logging

**Cursor, add error logging to all controllers:**
- Log errors to console or error tracking service
- Include request details (endpoint, user, body)
- Don't expose sensitive data in logs
- Use structured logging format

### 18. Add API Documentation

**Cursor, update `API_DOCUMENTATION.md` to:**
- Include all new endpoints (Loan Products, NBFC Partners, KAM Users, Form Fields)
- Document request/response formats
- Include example requests and responses
- Document error codes and messages

## Priority 4: Testing

### 19. Create Integration Tests

**Cursor, create integration tests in `backend/tests/integration/` that:**
- Test authentication flow
- Test all GET endpoints with proper roles
- Test all POST endpoints with proper roles
- Test RBAC enforcement
- Test data filtering by role
- Use test database or mock n8n responses

### 20. Create Frontend API Tests

**Cursor, create frontend tests in `src/__tests__/api.test.ts` that:**
- Test API client methods
- Test token storage and retrieval
- Test error handling
- Mock fetch responses
- Test authentication flow

---

## Quick Reference: Endpoint Mapping

| Frontend Feature | Old (Supabase) | New (Backend API) |
|-----------------|----------------|-------------------|
| Login | `supabase.auth.signIn()` | `apiClient.login()` |
| Get User | `supabase.auth.getUser()` | `apiClient.getMe()` |
| Client Dashboard | `supabase.from('dsa_clients')` | `apiClient.getClientDashboard()` |
| List Applications | `supabase.from('loan_applications')` | `apiClient.listApplications()` |
| Create Application | `supabase.from('loan_applications').insert()` | `apiClient.createApplication()` |
| Get Ledger | `supabase.from('commission_ledger')` | `apiClient.getClientLedger()` |
| Create Payout | `supabase.from('payout_requests').insert()` | `apiClient.createPayoutRequest()` |
| Get Form Config | `supabase.from('form_templates')` | `apiClient.getFormConfig()` |
| Update Status | `supabase.from('loan_applications').update()` | `apiClient.updateApplicationStatus()` |

---

## Implementation Order

1. **Week 1:** Create API client service and update authentication
2. **Week 2:** Update all dashboard pages and application forms
3. **Week 3:** Update commission ledger and payout requests
4. **Week 4:** Update status transitions and query system
5. **Week 5:** Add optional endpoints (Loan Products, NBFC Partners, etc.)
6. **Week 6:** Testing and bug fixes

---

## Notes

- All backend endpoints are already implemented and working
- Frontend just needs to be updated to use the backend API
- No backend changes needed except for optional endpoints
- Test each change incrementally
- Keep Supabase code commented out initially for rollback

