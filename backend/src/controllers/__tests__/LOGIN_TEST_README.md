# Login Flow Test Suite

This test suite comprehensively tests the login flow, including webhook interactions, Client ID extraction, JWT token creation, cookie setting, and error handling.

## Test Files

### 1. `auth.controller.test.ts` (Jest Test)
   - Full Jest test suite with mocking
   - Can be run with `npm test` or `jest`
   - Uses Jest's mocking framework

### 2. `login.test.runner.ts` (Standalone Test Runner)
   - Standalone test script using supertest
   - Can be run independently with `npm run test:login`
   - More detailed logging and step-by-step verification

## Running the Tests

### Option 1: Jest Test Suite
```bash
cd backend
npm test auth.controller.test.ts
```

### Option 2: Standalone Test Runner (Recommended)
```bash
cd backend
npm run test:login
```

Or directly:
```bash
cd backend
tsx src/controllers/__tests__/login.test.runner.ts
```

## What the Tests Verify

### ✅ Test 1: Successful Login Flow
- **Webhook Call**: Verifies webhook is called exactly once
- **Client ID Extraction**: Verifies Client ID is extracted from webhook response and mapped to user
- **JWT Token**: Verifies JWT token is created and included in response
- **HTTP-only Cookie**: Verifies `auth_token` cookie is set with `HttpOnly` flag
- **Response Structure**: Verifies 200 status with valid user data
- **Timeout**: Verifies request completes within 3 seconds

### ✅ Test 2: Error Handling - Empty Webhook Response
- **Empty Response**: Verifies empty webhook response returns 401
- **Error Message**: Verifies user-friendly error message

### ✅ Test 3: Error Handling - Incorrect Password
- **Wrong Password**: Verifies incorrect password returns 401
- **Error Message**: Verifies appropriate error message

### ✅ Test 4: Timeout Handling
- **Performance**: Verifies request completes within 3 seconds
- **No Hanging**: Ensures no requests hang indefinitely

## Mock Webhook Response Format

The test mocks the webhook response in the following format:

```json
[
  {
    "id": "recRUcnoAhb3oiPme",
    "createdTime": "2025-01-29T12:00:00.000Z",
    "fields": {
      "Username": "test@example.com",
      "Password": "<bcrypt-hashed-password>",
      "Role": "client",
      "Account Status": "Active",
      "Associated Profile": "TEST-CLIENT-1767006333410"
    }
  }
]
```

## Test Output

The standalone test runner provides detailed logging:

```
🚀 ========== LOGIN FLOW TEST RUNNER ==========

📋 Test 1: Successful Login with Client ID Extraction
  [WEBHOOK] Call #1: https://test-webhook.example.com/webhook/useraccount
  ✅ Webhook called exactly once
  ✅ Response status: 200 OK
  ✅ Client ID extracted correctly: TEST-CLIENT-1767006333410
  ✅ User ID mapped correctly: recRUcnoAhb3oiPme
  ✅ User email mapped correctly: test@example.com
  ✅ User role mapped correctly: client
  ✅ JWT token created
  Token preview: eyJhbGciOiJIUzI1NiIs...
  ✅ HTTP-only cookie set
  Cookie preview: auth_token=eyJhbGciOiJIUzI1NiIs...; Path=/; HttpOnly
  ✅ Cookie path set to /
  ✅ Request completed in 234ms (under 3 second limit)
  ✅ Response structure valid

✅ Test 1 PASSED
```

## Key Features

1. **Webhook Mocking**: Mocks `global.fetch` to intercept webhook calls
2. **Call Tracking**: Tracks webhook call count and URLs
3. **Response Validation**: Validates response structure, status codes, and data
4. **Cookie Verification**: Checks HTTP-only cookie is set correctly
5. **Timeout Verification**: Ensures requests complete within 3 seconds
6. **Error Handling**: Tests various error scenarios (empty response, wrong password, etc.)

## Troubleshooting

### Test Fails: "Webhook called X times, expected 1"
- Check if background role data fetching is making additional webhook calls
- Verify webhook mocking is set up correctly

### Test Fails: "Client ID not extracted"
- Verify webhook response format matches expected structure
- Check if Client lookup is working correctly

### Test Fails: "HTTP-only cookie not set"
- Verify CORS configuration allows credentials
- Check cookie options in auth controller

### Test Fails: "Request exceeded 3 second limit"
- Check network delays in mock fetch
- Verify no blocking operations in login flow

## Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Login Tests
  run: |
    cd backend
    npm run test:login
```

## Notes

- The test uses `bcryptjs` to hash passwords for realistic testing
- Webhook responses are mocked to avoid actual API calls during testing
- The test verifies the exact webhook response format from the user query
- All sensitive data (passwords, tokens) are redacted in logs

