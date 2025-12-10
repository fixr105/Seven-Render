# Running the Comprehensive QA Test Suite

## Quick Start

### Prerequisites

1. **Backend server running**
   ```bash
   cd backend
   npm run dev
   ```

2. **Test users created** in Airtable User Accounts table:
   - `client@test.com` / `Test@123` (role: client)
   - `kam@test.com` / `Test@123` (role: kam)
   - `credit@test.com` / `Test@123` (role: credit_team)
   - `nbfc@test.com` / `Test@123` (role: nbfc)

3. **Test data available:**
   - At least 1 loan product
   - At least 1 NBFC partner
   - Form categories and fields configured

### Option 1: Manual Testing (Recommended)

Follow the test cases in `COMPREHENSIVE_QA_TEST_SUITE.md`:

1. Use Postman, Insomnia, or curl to execute each test case
2. Record results in the test report template
3. Generate bug report for failures

### Option 2: Automated Testing

#### Using the Test Runner Script

```bash
cd backend

# Install axios if not already installed
npm install axios

# Set API base URL (default: http://localhost:3001/api)
export API_BASE_URL=http://localhost:3001/api

# Run the test suite
node test-suite-runner.js
```

The script will:
- Execute all test phases
- Record pass/fail results
- Generate `test-results.json` with detailed results
- Print summary to console

#### Using curl Scripts

Create individual test scripts for each phase:

```bash
# Example: test-auth.sh
#!/bin/bash

BASE_URL="http://localhost:3001/api"

# Test AUTH-1.1: CLIENT login
echo "Testing CLIENT login..."
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"Test@123"}' \
  -w "\nStatus: %{http_code}\n"

# Test AUTH-1.2: KAM login
echo "Testing KAM login..."
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"kam@test.com","password":"Test@123"}' \
  -w "\nStatus: %{http_code}\n"

# ... continue for all test cases
```

### Option 3: Postman Collection

1. Import the test suite into Postman
2. Create environment variables:
   - `base_url`: `http://localhost:3001/api`
   - `client_token`: (will be set after login)
   - `kam_token`: (will be set after login)
   - `credit_token`: (will be set after login)
   - `nbfc_token`: (will be set after login)
3. Run collection with test scripts

---

## Test Execution Checklist

### Pre-Test

- [ ] Backend server is running
- [ ] Test users exist in Airtable
- [ ] Test data is seeded
- [ ] Webhook URLs are configured
- [ ] Database/Airtable is accessible

### During Test

- [ ] Execute Phase 1: Authentication (20 tests)
- [ ] Execute Phase 2: Client Capabilities (50 tests)
- [ ] Execute Phase 3: KAM Capabilities (30 tests)
- [ ] Execute Phase 4: Credit Capabilities (40 tests)
- [ ] Execute Phase 5: NBFC Capabilities (15 tests)
- [ ] Execute Phase 6: Audit & Reports (20 tests)
- [ ] Execute Phase 7: AI Summary (10 tests)
- [ ] Execute Phase 8: RBAC (25 tests)
- [ ] Execute Phase 9: Validation (20 tests)
- [ ] Execute Phase 10: Workflows (15 tests)
- [ ] Execute Phase 11: Frontend Integration (15 tests)
- [ ] Execute Phase 12: Performance (10 tests)

### Post-Test

- [ ] All results recorded
- [ ] Bug report generated
- [ ] Coverage report calculated
- [ ] Recommendations documented

---

## Expected Results

### Success Criteria

- **100% Pass Rate** for critical tests (Authentication, RBAC, Data Filtering)
- **≥95% Pass Rate** for all other tests
- **Zero RBAC violations**
- **Zero data leakage** (users seeing other users' data)

### Test Coverage

| Phase | Tests | Critical |
|-------|-------|----------|
| Authentication | 20 | ✅ Yes |
| Client Capabilities | 50 | ✅ Yes |
| KAM Capabilities | 30 | ✅ Yes |
| Credit Capabilities | 40 | ✅ Yes |
| NBFC Capabilities | 15 | ✅ Yes |
| Audit & Reports | 20 | ✅ Yes |
| AI Summary | 10 | ✅ Yes |
| RBAC | 25 | ✅ Yes |
| Validation | 20 | ✅ Yes |
| Workflows | 15 | ✅ Yes |
| Frontend Integration | 15 | ✅ Yes |
| Performance | 10 | ✅ Yes |
| **TOTAL** | **270** | **100%** |

---

## Bug Report Template

When a test fails, document it using this template:

```markdown
## Test Failure: [TEST-CASE-ID]

**Feature:** [Feature Name]
**Endpoint:** [HTTP Method] [Endpoint Path]
**Test Case:** [Test Case Description]

**Expected:**
- Status Code: [Expected]
- Response: [Expected Response]

**Actual:**
- Status Code: [Actual]
- Response: [Actual Response]

**Issue Type:**
- [ ] Missing Endpoint
- [ ] Wrong Status Code
- [ ] RBAC Violation
- [ ] Data Filtering Issue
- [ ] Validation Missing
- [ ] Error Handling Issue
- [ ] Response Format Issue
- [ ] Performance Issue

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Suggested Fix:**
[Description of fix needed]

**Priority:** [High/Medium/Low]
```

---

## Troubleshooting

### Common Issues

1. **"Unauthorized" errors**
   - Check if test users exist
   - Verify login endpoint works
   - Check token format

2. **"Forbidden" errors**
   - Verify RBAC middleware is working
   - Check user roles in Airtable
   - Verify endpoint requires correct role

3. **"Not Found" errors**
   - Check if test data exists (applications, clients, etc.)
   - Verify IDs are correct
   - Check if endpoints are registered

4. **"Validation Error"**
   - Check request body format
   - Verify required fields are present
   - Check data types match expected format

5. **Webhook timeouts**
   - Check n8n webhook URLs are configured
   - Verify Airtable base is accessible
   - Check network connectivity

---

## Next Steps

After running tests:

1. **Fix Critical Issues** (Priority: High)
   - Authentication failures
   - RBAC violations
   - Missing endpoints
   - Data filtering issues

2. **Fix Medium Priority Issues**
   - Validation improvements
   - Error message clarity
   - Response format consistency

3. **Optimize Performance** (Priority: Low)
   - Cache optimization
   - Query optimization
   - Response time improvements

4. **Retest**
   - Re-run failed tests
   - Verify fixes
   - Update test report

---

**Last Updated:** 2025-01-27
