# Dynamic Form E2E Test Suite

## Overview

This test suite validates the core internal logic of dynamic form creation, asset integration, and data persistence without requiring authentication. The tests are data-driven using JSON configuration files.

## Test Structure

### Test Files

- **`4-dynamic-form-e2e.spec.ts`**: Main test suite with 3 end-to-end tests
- **`pages/NewApplicationPage.ts`**: Page Object Model for form interactions
- **`helpers/roleSelection.ts`**: Helper for role selection (bypasses authentication)
- **`test-data/form-test-data.json`**: JSON test data file

## Test Cases

### Test 1: Dynamic Form Creation

**Objective**: Verify that forms can be created dynamically from JSON configuration and that the UI correctly reflects the JSON structure.

**Steps**:
1. Verify form structure matches JSON configuration
2. Fill core application fields from JSON
3. Fill dynamic form fields from JSON
4. Verify Create action returns success state

**Assertions**:
- All categories from JSON are visible in the UI
- All fields from JSON are present with correct labels
- Core fields (applicant name, loan product, amount) are filled correctly
- Dynamic fields are populated from JSON data
- Form submission/creation returns success state

### Test 2: Asset Integration

**Objective**: Verify file upload functionality and that files are correctly attached to forms with proper metadata.

**Steps**:
1. Upload file for first field
2. Upload file for second field
3. Verify metadata updates correctly
4. Verify files are attached to form

**Assertions**:
- Files are successfully uploaded
- Files appear in the "Attached" list
- Upload success indicators are visible
- File metadata (name, type) is correctly displayed
- Multiple files can be uploaded to different fields

### Test 3: Data Persistence & Submission

**Objective**: Verify that submitted form data persists after page reload and matches the original JSON input.

**Steps**:
1. Submit the finalized form
2. Perform page reload
3. Verify submitted data persists
4. Verify file references persist
5. Verify data matches original JSON input

**Assertions**:
- Form submission is successful
- Application ID is generated/extracted
- After reload, applicant name persists
- After reload, loan amount persists
- After reload, form data fields persist
- After reload, file references persist
- All persisted data matches original JSON input

## Running the Tests

### Prerequisites

1. Ensure the development servers are running:
   ```bash
   # Frontend (port 8000)
   npm run dev
   
   # Backend (port 3001)
   cd backend && npm run dev
   ```

2. Ensure test data file exists:
   - `e2e/test-data/form-test-data.json`

3. Test files will be auto-created in:
   - `e2e/test-files/`

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/4-dynamic-form-e2e.spec.ts
```

### Run in UI Mode

```bash
npm run test:e2e:ui
```

### Run in Headed Mode

```bash
npm run test:e2e:headed
```

## Test Data Structure

The test data JSON file (`form-test-data.json`) contains:

```json
{
  "formData": {
    "applicant_name": "John Doe",
    "loan_product_id": "",
    "requested_loan_amount": "5000000",
    "form_data": {
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      // ... more fields
    }
  },
  "fileUploads": [
    {
      "fieldId": "pan_document",
      "fileName": "pan-card.pdf",
      "fileType": "application/pdf"
    }
  ],
  "formConfig": {
    "categories": [
      {
        "categoryId": "CAT-PERSONAL-001",
        "categoryName": "Personal Information",
        "fields": [...]
      }
    ]
  }
}
```

## Page Object Model

The `NewApplicationPage` class provides clean methods for:

- **Navigation**: `goto()`
- **Form Filling**: `fillCoreFields()`, `fillDynamicFields()`
- **File Upload**: `uploadFile()`, `verifyFileAttached()`
- **Form Submission**: `submitForm()`
- **Verification**: `verifyFormStructure()`, `verifyPersistedData()`
- **Data Extraction**: `getApplicationId()`

## Key Features

1. **No Authentication**: Tests use role selection buttons to bypass login
2. **Data-Driven**: All test data comes from JSON files
3. **Clean Selectors**: Page Object Model pattern for maintainability
4. **Comprehensive Assertions**: Every step includes specific assertions
5. **File Handling**: Automatic test file creation and cleanup

## Troubleshooting

### Tests Fail with "Role button not found"

- Verify the login page has role selection buttons
- Check that button text matches `ROLE_SELECTORS` in `roleSelection.ts`
- Ensure page has loaded completely before selecting role

### Tests Fail with "File input not found"

- Verify form configuration includes file fields
- Check that file field IDs match those in test data
- Ensure form has loaded before attempting upload

### Tests Fail with "Form submission timeout"

- Verify backend is running on port 3001
- Check network tab for API errors
- Ensure all required fields are filled before submission

### Data Persistence Test Fails

- Verify application was successfully created (check application ID)
- Check that application detail page is accessible
- Verify backend is returning persisted data correctly

## Maintenance

When updating form structure or JSON schema:

1. Update `form-test-data.json` with new structure
2. Update `NewApplicationPage` selectors if UI changes
3. Update test assertions to match new requirements
4. Run tests to verify all assertions pass





