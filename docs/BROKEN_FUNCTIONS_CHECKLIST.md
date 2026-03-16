# Broken Function Checklist – Seven Dashboard

**Created:** 2025-03-16  
**Source:** Consolidated from PROJECT_TODO_ISSUES.md, FUNCTIONAL_ISSUES_ANALYSIS.md, POST_WEBHOOK_ANALYSIS.md, docs/AUDIT-BROKEN-LOGIC-AND-SYSTEMS.md, QUICK_START_GUIDE.md, lint/test outputs

---

## Priority Overview

| Level | Count | Focus |
|-------|-------|--------|
| **P0 – Critical** | 10 | Auth, data, webhooks, core flows |
| **P1 – High** | 8 | Profile, settings, reports, notifications |
| **P2 – Medium** | 7 | UX, flows, validation |
| **P3 – Low** | 6 | Type safety, lint, polish |

---

## P0 – Critical (Fix First)

### 1. KAM/Credit Team Login Broken
**Issue:** Login fails – Airtable `Email` fields contain names instead of emails.  
**Evidence:** `QUICK_START_GUIDE.md`

**Steps to fix:**
1. Airtable **KAM Users** table: change `Email = "Sagar"` → valid email (e.g. `sagar@example.com`)
2. Airtable **Credit Team Users** table: change `Email = "Rahul"` → valid email
3. Airtable **User Accounts** table: set `Username` = same email as KAM Users / Credit Team Users
4. Restart backend; test login for KAM and Credit users

---

### 2. Notifications Webhook Not Saving
**Issue:** POST notifications webhook has no n8n field mappings – notifications never saved.  
**Evidence:** `POST_WEBHOOK_ANALYSIS.md`, `TEST_RESULTS.md`

**Steps to fix:**
1. Open n8n "Post Notifications" Airtable node
2. Set Mapping Mode = "Define Below"
3. Add all 15 field mappings (see `N8N_NOTIFICATIONS_WEBHOOK_FIX.md`)
4. Save and activate workflow
5. Trigger a notification (e.g. raise query) and verify it appears in Airtable

---

### 3. Application Listing – No Data Returned
**Issue:** n8n GET webhook returns table structure instead of records; lists show empty.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #3

**Steps to fix:**
1. Inspect `backend/src/services/airtable/n8nClient.ts` – `fetchTable` and response format
2. Verify n8n GET workflow returns array of records, not table schema
3. Add logging/error handling for malformed responses
4. Verify `GET /loan-applications`, `/kam/loan-applications`, `/credit/loan-applications`, `/nbfc/loan-applications` return arrays
5. Test each role: CLIENT, KAM, CREDIT, NBFC

---

### 4. Commission Ledger – "Loading..." Indefinitely
**Issue:** Ledger page never finishes loading.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #5

**Steps to fix:**
1. Verify `GET /clients/me/ledger` returns data
2. Check Commission Ledger webhook response format and field names
3. Add logging in `backend/src/controllers/ledger.controller.ts`
4. Ensure `src/hooks/useLedger.ts` handles loading/error states correctly

---

### 5. New Application POST Webhook Not Configured
**Issue:** POST webhook for loan applications not configured; save/submit fails.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #1

**Steps to fix:**
1. Verify `backend/src/config/webhookConfig.ts` has correct n8n webhook URL
2. Ensure `POST /loan-applications` calls correct n8n endpoint
3. Test webhook manually with curl
4. Verify n8n workflow maps all required Airtable fields

---

### 6. Profile Update – Not Connected to Backend
**Issue:** Profile save button shows alert instead of calling backend API.  
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #1, `src/pages/Profile.tsx`

**Steps to fix:**
1. Implement `PATCH /user-accounts/:id` (or equivalent) in backend
2. Add `apiService.updateProfile(userId, data)` method
3. Replace alert in `Profile.tsx` with actual API call and success/error handling

---

### 7. Client Onboarding – "No Token Provided" for Credit Team
**Issue:** Credit team "Client Management" shows "No token provided" error.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #4

**Steps to fix:**
1. Verify `requireCredit` middleware is applied to credit client endpoints
2. Ensure `GET /credit/clients` and related routes exist and accept token
3. Update `src/pages/Clients.tsx` to pass auth headers for credit team
4. Test credit user can view and manage clients

---

### 8. Master Form Configuration – Fields Not Appearing to Client
**Issue:** KAM configures modules but client doesn't see configured fields.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #2

**Steps to fix:**
1. Verify `GET /client/form-config` returns client-specific mappings
2. Ensure Client Form Mapping table is queried correctly by client ID
3. Update `NewApplication.tsx` to consume `getFormConfig` and render fields from response
4. End-to-end test: KAM configures modules → client sees fields when creating application

---

### 9. Credit Team Client Management Endpoints
**Issue:** Credit team client management endpoints missing or broken.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #4

**Steps to fix:**
1. Implement `GET /credit/clients`, `GET /credit/clients/:id`, `PATCH /credit/clients/:id` (per PRD)
2. Add routes in `backend/src/routes/credit.routes.ts` with `requireCredit` middleware
3. Add corresponding API methods in `src/services/api.ts`
4. Update `Clients.tsx` to use backend API when user is credit team

---

### 10. Vitest Run Failing (EPERM Sandbox)
**Issue:** `npm run test` fails with `EPERM` on temp file writes.  
**Evidence:** Test run output.

**Steps to fix:**
1. Run tests outside sandbox: `npm run test` in unrestricted terminal/Agent mode
2. If using Cursor sandbox, add write permissions for test directory
3. Consider excluding vitest temp files from restrictive env

---

## P1 – High Priority

### 11. Settings Save – localStorage Only
**Issue:** Settings saved to localStorage only; not synced with backend.  
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #2, `src/pages/Settings.tsx`

**Steps to fix:**
1. Implement `PATCH /user-accounts/:id/settings` endpoint
2. Add `apiService.updateSettings(userId, settings)` method
3. Update `Settings.tsx` to call API on save; optionally sync with localStorage as cache

---

### 12. Forgot Passcode – Does Nothing
**Issue:** "Forgot passcode?" link does nothing.  
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #5, `Login.tsx`

**Steps to fix:**
1. Implement password reset flow (email-based or admin-assisted)
2. Or replace with "Contact administrator" message
3. Or remove link until feature is implemented

---

### 13. Query Dialog – Not Wired to Backend
**Issue:** Query modal opens but messages not stored.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #6

**Steps to fix:**
1. Wire query form to `POST /loan-applications/:id/queries`
2. Wire reply form to `POST /queries/:parentId/replies`
3. Ensure queries stored in File Auditing Log
4. Implement `POST /queries/:id/resolve` and `POST /queries/:id/reopen`
5. Refetch application detail after query actions in `ApplicationDetail.tsx`

---

### 14. Action Centre – Wrong Role Visibility
**Issue:** Wrong actions shown for roles; missing actions.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #7

**Steps to fix:**
1. Hide "New Application" for KAM/Credit/NBFC; show only for CLIENT
2. Show "Onboard Client" and "Configure Forms" only for KAM
3. Show "View Ledger" and "Request Payout" for CLIENT
4. Show "Approve Payout" and "Generate Report" for CREDIT
5. Show "View Assigned Files" for NBFC
6. Audit `ClientDashboard`, `KAMDashboard`, `CreditDashboard`, `NBFCDashboard`, Sidebar

---

### 15. Reports Page – Placeholder Only
**Issue:** "Reports Coming Soon" placeholder; no actual reports.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #8

**Steps to fix:**
1. Verify backend `GET /reports/daily/latest`, `GET /reports/daily/:date`, `POST /reports/daily/generate` work
2. Replace placeholder in `Reports.tsx` with reports list and filters
3. Add date range filter; add report generation for CREDIT users
4. Ensure backend `reports.controller.ts` returns expected data shape

---

### 16. Payout Request/Approval Flow
**Issue:** Payout creation and approval not fully implemented.  
**Evidence:** `PROJECT_TODO_ISSUES.md` #5, #16

**Steps to fix:**
1. Verify `POST /clients/me/payout-requests` works and creates ledger entry
2. Implement `POST /credit/payout-requests/:id/approve` and `/reject`
3. Add payout request UI for CLIENT
4. Add payout approval UI for CREDIT
5. Ensure ledger updates after payout actions

---

### 17. ApplicationDetail – Manual Refresh Required After Actions
**Issue:** Data requires manual refresh after actions (queries, status changes).  
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #6

**Steps to fix:**
1. Call `getApplication` / refetch after `raiseQuery`, `replyToQuery`, `markResolved`, status transitions
2. Remove "Please refresh the page" messaging; use automatic refetch
3. Consider optimistic updates where appropriate

---

### 18. ClientForm/FormConfiguration – Non-SPA Navigation
**Issue:** Uses `window.location.href` or `<a href>` instead of React Router.  
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #4, #7

**Steps to fix:**
1. In `ClientForm.tsx` replace `window.location.href = '/dashboard'` with `navigate('/dashboard')`
2. In `FormConfiguration.tsx` replace `<a href="/clients">` with `<Link to="/clients">`
3. Verify no full page reloads

---

## P2 – Medium Priority

### 19. Missing Error Boundaries
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #8  
**Steps:** Add ErrorBoundary component around page components; show friendly fallback instead of blank screen.

### 20. Draft Save Functionality
**Evidence:** `PROJECT_TODO_ISSUES.md` #1  
**Steps:** Ensure `POST /loan-applications/:id/form` accepts drafts, sets DRAFT status, allows saving without all required fields; validate only on submit.

### 21. Document Upload Wiring
**Evidence:** `PROJECT_TODO_ISSUES.md` #1  
**Steps:** Wire document upload to backend endpoint; store links in Form Data or Document Uploads field.

### 22. POSTLOG Optional Fields Not Mapped
**Evidence:** `POST_WEBHOOK_ANALYSIS.md`  
**Steps:** Add n8n mappings for `Related File ID`, `Related Client ID`, `Related User ID`, `Metadata` if backend sends them.

### 23. KAM Users/Credit Team Users – Invalid Email Overwrite
**Evidence:** `POST_WEBHOOK_ANALYSIS.md`  
**Steps:** Add validation before POST so Email field cannot be overwritten with invalid values.

### 24. Mandatory Field Validation – File vs PAN
**Evidence:** `mandatoryFieldValidation.service.test.ts`, `mandatoryFieldValidation.service.ts`  
**Steps:** Ensure PAN format validation is skipped for file-type fields with file-option values; run tests.

### 25. NBFC Portal – Limited Functionality
**Evidence:** `PROJECT_TODO_ISSUES.md` #13  
**Steps:** Implement `GET /nbfc/loan-applications/:id`, document download, `POST /nbfc/loan-applications/:id/decision`; add decision recording UI.

---

## P3 – Low Priority (Tech Debt)

### 26. 246 ESLint Warnings – `no-explicit-any`
**Evidence:** Lint output. Focus: `ApplicationDetail.tsx`, `api.ts`, `Applications.tsx`, test files.

### 27. React Hook exhaustive-deps Warnings
**Evidence:** Lint output. Files: `useApplications.ts`, `ApplicationDetail.tsx`, `ClientDashboard.tsx`, `NBFCDashboard.tsx`.  
**Steps:** Add correct dependencies or restructure `useEffect` logic.

### 28. Button Loading/Disabled States
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #10  
**Steps:** Add loading and disabled states to async actions (submit, upload, save).

### 29. Status Query Parameters in Applications
**Evidence:** `FUNCTIONAL_ISSUES_ANALYSIS.md` #9  
**Steps:** Verify `Applications.tsx` handles `status` query param for filters; test all status links.

### 30. Full Dynamic Form Builder (M2)
**Evidence:** `PROJECT_TODO_ISSUES.md` #9  
**Steps:** Implement form builder UI, template management, validation config, duplicate prevention.

### 31. AI Modules (M6 & M7)
**Evidence:** `PROJECT_TODO_ISSUES.md` #14, `TEST_REPORT.md`  
**Steps:** Integrate AI summary for applications and daily reports; wire to actual AI service.

---

## Suggested Execution Order

1. **Week 1 – Critical Auth & Data**
   - Fix KAM/Credit login (#1)
   - Fix notifications webhook (#2)
   - Fix application listing (#3)
   - Fix commission ledger (#4)

2. **Week 2 – Core Flows**
   - Fix new application POST (#5)
   - Fix profile update (#6)
   - Fix credit client management (#7, #9)
   - Fix form configuration (#8)

3. **Week 3 – UX & Features**
   - Fix settings save (#11)
   - Fix Forgot passcode (#12)
   - Fix query dialog (#13)
   - Fix action centre (#14)
   - Fix reports page (#15)

4. **Week 4 – Polish**
   - Fix ApplicationDetail refresh (#17)
   - Fix navigation (#18)
   - Add error boundaries (#19)
   - Start reducing `any` types (#26)

---

## Quick Verification Commands

```bash
# Frontend typecheck
npm run typecheck

# Backend typecheck
cd backend && npm run typecheck

# Frontend lint (246 warnings)
npm run lint

# Tests (run outside sandbox)
npm run test
cd backend && npm run test

# Mandatory field validation
cd backend && npm run test -- mandatoryFieldValidation
```

---

## References

- `PROJECT_TODO_ISSUES.md` – Full PRD gap analysis
- `FUNCTIONAL_ISSUES_ANALYSIS.md` – CodeRabbit-style functional issues
- `POST_WEBHOOK_ANALYSIS.md` – Webhook mapping audit
- `docs/AUDIT-BROKEN-LOGIC-AND-SYSTEMS.md` – Architecture and fixes
- `QUICK_START_GUIDE.md` – Critical data fixes
- `N8N_NOTIFICATIONS_WEBHOOK_FIX.md` – Notifications webhook mappings
