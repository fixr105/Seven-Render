# Regression Test Plan - Critical Fixes Release

## Overview

This test plan covers all fixes implemented for:
- Loan products loading and timeout handling
- Save draft functionality
- Client onboarding (KAM)
- Report generation (Credit)
- Phone number validation
- Footer functionality

## Test Environment Setup

### Prerequisites
1. Backend server running on `http://localhost:3001`
2. Frontend server running on `http://localhost:8000`
3. Test users created (run `node backend/scripts/ensure-test-users.js`)
4. At least 1 loan product exists in Airtable
5. n8n webhooks are accessible and configured

### Test Users
- `client@test.com` / `Test@123` (Client role)
- `kam@test.com` / `Test@123` (KAM role)
- `credit@test.com` / `Test@123` (Credit Team role)
- `nbfc@test.com` / `Test@123` (NBFC role)

---

## Test Suite 1: Loan Products Loading

### Test 1.1: Loan Products Load Successfully
**Role**: Client  
**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application" page
3. Wait for loan products to load

**Expected Results**:
- ✅ Loan products appear in dropdown within 10-20 seconds
- ✅ Loading indicator shows while fetching
- ✅ Dropdown is enabled after products load
- ✅ At least one product is selectable

**Failure Criteria**:
- ❌ Products don't appear after 20 seconds
- ❌ Dropdown remains disabled
- ❌ No loading indicator shown

---

### Test 1.2: Empty State Handling
**Role**: Client  
**Prerequisites**: No active loan products in Airtable (or all marked inactive)

**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application" page
3. Wait for products to load

**Expected Results**:
- ✅ Clear message: "No loan products available"
- ✅ Dropdown shows "No products available" option
- ✅ Dropdown is disabled
- ✅ Helper text: "Please contact your KAM to configure loan products"

**Failure Criteria**:
- ❌ Blank dropdown with no message
- ❌ Generic error without explanation
- ❌ Page crashes or shows undefined

---

### Test 1.3: Error State Handling
**Role**: Client  
**Prerequisites**: Simulate webhook failure (disable n8n or use invalid URL)

**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application" page
3. Wait for timeout

**Expected Results**:
- ✅ Error message displayed: "Failed to load loan products. Please try again."
- ✅ Retry mechanism available (or page refresh works)
- ✅ Application doesn't crash

**Failure Criteria**:
- ❌ Silent failure with no error message
- ❌ Page becomes unresponsive
- ❌ No way to recover

---

## Test Suite 2: Application Creation & Save Draft

### Test 2.1: Save Draft Successfully
**Role**: Client  
**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application"
3. Fill in:
   - Applicant Name: "Test Applicant"
   - Loan Product: Select any available product
   - Requested Amount: "500000"
4. Click "Save Draft"
5. Wait for response

**Expected Results**:
- ✅ No timeout error (completes within 60 seconds)
- ✅ Success message or navigation to applications list
- ✅ Draft appears in "Draft applications" list
- ✅ Status is "Draft"

**Failure Criteria**:
- ❌ "Request timed out after 30 seconds" error
- ❌ Draft not saved
- ❌ Application doesn't appear in list

---

### Test 2.2: Submit Application Successfully
**Role**: Client  
**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application"
3. Fill in all required fields
4. Click "Submit" (not Save Draft)
5. Wait for response

**Expected Results**:
- ✅ No timeout error (completes within 60 seconds)
- ✅ Success message or navigation
- ✅ Application appears in "New / In progress" list
- ✅ Status is "Under KAM Review" or similar

**Failure Criteria**:
- ❌ Timeout error
- ❌ Application not submitted
- ❌ Missing validation errors not shown

---

### Test 2.3: Save Draft with Partial Data
**Role**: Client  
**Steps**:
1. Login as `client@test.com`
2. Navigate to "New Application"
3. Fill in only Applicant Name (leave other required fields empty)
4. Click "Save Draft"

**Expected Results**:
- ✅ Draft saves successfully (drafts don't require all fields)
- ✅ No validation errors for missing required fields
- ✅ Draft appears in list

**Failure Criteria**:
- ❌ Validation errors for draft save
- ❌ Draft not saved

---

## Test Suite 3: KAM Client Onboarding

### Test 3.1: Onboard New Client Successfully
**Role**: KAM  
**Steps**:
1. Login as `kam@test.com`
2. Navigate to "Clients" page
3. Click "Onboard New Client"
4. Fill in:
   - Company Name: "Test Company Ltd"
   - Contact Person: "John Doe"
   - Email: `testclient-${Date.now()}@example.com`
   - Phone: "+91 9876543210"
   - Commission Rate: "1.5"
5. Click "Create Client"
6. Wait for response

**Expected Results**:
- ✅ No timeout error (completes within 60 seconds)
- ✅ Success message displayed
- ✅ Client appears in clients list
- ✅ User account created in User Accounts table
- ✅ Client record created in Clients table

**Failure Criteria**:
- ❌ Timeout error
- ❌ Client not created
- ❌ Silent failure with no error message
- ❌ Client doesn't appear in list

---

### Test 3.2: Onboard Client with Existing Email
**Role**: KAM  
**Prerequisites**: Client with email `existing@test.com` already exists

**Steps**:
1. Login as `kam@test.com`
2. Navigate to "Clients" page
3. Click "Onboard New Client"
4. Fill in with email: `existing@test.com`
5. Click "Create Client"

**Expected Results**:
- ✅ Clear error message: "Client with this email already exists"
- ✅ No duplicate created
- ✅ Form remains filled for correction

**Failure Criteria**:
- ❌ Duplicate client created
- ❌ Generic error message
- ❌ Silent failure

---

## Test Suite 4: Credit Report Generation

### Test 4.1: Generate Report Successfully
**Role**: Credit Team  
**Steps**:
1. Login as `credit@test.com`
2. Navigate to "Reports" page
3. Click "Generate Daily Summary"
4. Wait for report generation

**Expected Results**:
- ✅ No timeout error (completes within 60 seconds)
- ✅ Report generated successfully
- ✅ Report appears in reports list
- ✅ Report contains metrics and summary

**Failure Criteria**:
- ❌ "Request timed out after 30 seconds" error
- ❌ Report not generated
- ❌ Application crashes

---

### Test 4.2: Report Generation with Partial Failures
**Role**: Credit Team  
**Prerequisites**: Simulate one table fetch failure (e.g., disable one webhook)

**Steps**:
1. Login as `credit@test.com`
2. Navigate to "Reports" page
3. Click "Generate Daily Summary"
4. Wait for report generation

**Expected Results**:
- ✅ Report still generates (within 60 seconds)
- ✅ Report contains data from available tables
- ✅ Warning logged for failed table (in console/logs)
- ✅ No complete failure

**Failure Criteria**:
- ❌ Complete failure if one table fails
- ❌ No report generated
- ❌ Timeout error

---

## Test Suite 5: Phone Number Validation

### Test 5.1: Reject Alphabetic Characters
**Role**: Any  
**Steps**:
1. Login as any user
2. Navigate to "Profile" page
3. Click on "Phone Number" field
4. Type: "abc123def"

**Expected Results**:
- ✅ Only numbers, +, -, spaces, parentheses are accepted
- ✅ Alphabetic characters are automatically filtered out
- ✅ Field shows only: "+123" (or similar valid format)

**Failure Criteria**:
- ❌ Alphabetic characters appear in field
- ❌ No filtering occurs

---

### Test 5.2: Phone Validation on Blur
**Role**: Any  
**Steps**:
1. Login as any user
2. Navigate to "Profile" page
3. Enter phone number: "123" (less than 10 digits)
4. Click outside field (blur event)

**Expected Results**:
- ✅ Validation error: "Phone number must contain at least 10 digits"
- ✅ Error message displayed below field
- ✅ Field highlighted in error state

**Failure Criteria**:
- ❌ No validation error shown
- ❌ Invalid phone accepted

---

### Test 5.3: Valid Phone Number Accepted
**Role**: Any  
**Steps**:
1. Login as any user
2. Navigate to "Profile" page
3. Enter phone number: "+91 9876543210"
4. Click outside field

**Expected Results**:
- ✅ No validation error
- ✅ Phone number accepted
- ✅ Can save profile

**Failure Criteria**:
- ❌ Valid phone rejected
- ❌ False validation error

---

## Test Suite 6: Footer Functionality

### Test 6.1: Footer Links Show Alert
**Role**: Any  
**Steps**:
1. Login as any user
2. Navigate to any page (Dashboard, Applications, etc.)
3. Scroll to footer
4. Click "Privacy Policy" link
5. Click "Terms of Service" link
6. Click "Support" link

**Expected Results**:
- ✅ Each link click shows alert: "[Link Name] - Coming soon!"
- ✅ No page navigation occurs
- ✅ No console errors

**Failure Criteria**:
- ❌ Links do nothing
- ❌ Page navigates to "#" (blank)
- ❌ Console errors

---

## Automated Test Scripts

### Running E2E Tests

```bash
# Install dependencies
npm install

# Run Playwright tests
npm run test:e2e

# Run specific test suite
npx playwright test e2e/4-dynamic-form-e2e.spec.ts
```

### Running Backend Tests

```bash
cd backend

# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

---

## Test Results Template

| Test ID | Test Name | Status | Notes | Timestamp |
|---------|-----------|--------|-------|-----------|
| 1.1 | Loan Products Load | ✅/❌ | | |
| 1.2 | Empty State Handling | ✅/❌ | | |
| 1.3 | Error State Handling | ✅/❌ | | |
| 2.1 | Save Draft Success | ✅/❌ | | |
| 2.2 | Submit Application | ✅/❌ | | |
| 2.3 | Save Draft Partial Data | ✅/❌ | | |
| 3.1 | Onboard New Client | ✅/❌ | | |
| 3.2 | Onboard Existing Email | ✅/❌ | | |
| 4.1 | Generate Report | ✅/❌ | | |
| 4.2 | Report Partial Failures | ✅/❌ | | |
| 5.1 | Reject Alphabets | ✅/❌ | | |
| 5.2 | Phone Validation Blur | ✅/❌ | | |
| 5.3 | Valid Phone Accepted | ✅/❌ | | |
| 6.1 | Footer Links Alert | ✅/❌ | | |

---

## Regression Test Checklist

Before marking tests as complete, verify:

- [ ] All 14 test cases executed
- [ ] All expected results confirmed
- [ ] No new errors introduced
- [ ] Performance acceptable (timeouts respected)
- [ ] Error messages are user-friendly
- [ ] No console errors in browser
- [ ] No backend errors in logs
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness (if applicable)

---

## Known Issues / Limitations

1. **Timeout Limits**:
   - Save draft: Up to 55 seconds
   - Report generation: Up to 60 seconds
   - Loan products: Up to 20 seconds (with retry)

2. **Partial Failures**:
   - Report generation may show partial data if some tables fail
   - This is intentional to prevent complete failure

3. **Phone Validation**:
   - Currently accepts international formats
   - Minimum 10 digits required
   - Maximum 15 digits

---

## Next Steps After Testing

1. Document any failures in bug tracker
2. Share test results with development team
3. If all tests pass, proceed to production deployment
4. Re-run critical tests in production environment



