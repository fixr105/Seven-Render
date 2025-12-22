# Module 2: New Application Submission (Client/DSA) - Implementation Complete

## Overview

Module 2 implements the complete loan application submission flow for clients, including stepper UI, draft saves, OneDrive document uploads, soft validation, and duplicate detection.

## Deliverables

### ✅ 1. Stepper/Sectioned Form (`NewApplication.tsx`)

**Location:** `src/pages/NewApplication.tsx`

**Features:**
- Stepper component showing form progress
- Sectioned form based on client template (from Module 1)
- Each category from form config is a separate section
- Navigation between sections

**Stepper Steps:**
1. Application Details (core fields)
2. Each configured category (from KAM form configuration)

### ✅ 2. Manual Save Draft

**Implementation:**
- "Save as Draft" button (manual only, no autosave)
- Drafts saved with `Status: DRAFT`
- Form config version stored for drafts
- Can be edited later

**API:**
```
POST /loan-applications
{
  saveAsDraft: true,
  ...
}
```

### ✅ 3. Soft Validation (`formValidation.service.ts`)

**Location:** `backend/src/services/validation/formValidation.service.ts`

**Features:**
- Validates required fields (warnings, not errors)
- Validates data formats (email, phone, PAN, Aadhaar)
- Returns warnings array
- **Still allows submission** even with warnings
- Missing required fields create warnings, not blocking errors

**Validation Rules:**
- Email format validation
- Phone number validation (10-15 digits)
- PAN format validation (ABCDE1234F)
- Aadhaar format validation (12 digits)
- Required field checks (warnings only)

### ✅ 4. OneDrive Document Upload (`onedriveUpload.service.ts`)

**Location:** `backend/src/services/onedrive/onedriveUpload.service.ts`

**Features:**
- Uploads files to OneDrive (primary storage)
- Returns OneDrive share links
- Links stored in Airtable `Document Uploads` field
- No Airtable attachments (links only)

**API:**
```
POST /documents/upload
Content-Type: multipart/form-data
{
  file: File,
  fieldId: string,
  fileName?: string
}

Response: {
  shareLink: string,
  fileId: string,
  webUrl: string
}
```

**Integration:**
- Frontend uploads files immediately when selected
- OneDrive links stored in `documentLinks` state
- Links sent to backend in `documentUploads` array
- Backend stores links in application record

### ✅ 5. Document Links Storage

**Implementation:**
- Document links stored in `Loan Application.Document Uploads` field (JSON)
- Format: `{ fieldId: "onedrive-share-link" }`
- Also stored in `Form Data` for easy access
- Links accessible via application detail view

### ✅ 6. Auto-Create Query/Task Marker

**Implementation:**
- When application submitted with warnings/issues
- System creates File Auditing Log entry with `Action/Event Type: 'query'`
- Message: "Application submitted with validation warnings. Please review: [warnings]"
- Target: KAM
- Status: Unresolved
- KAM sees this in their "needs attention" list

**Location:** `backend/src/controllers/loan.controller.ts` - `createApplication()`

### ✅ 7. Duplicate Detection (`duplicateDetection.service.ts`)

**Location:** `backend/src/services/validation/duplicateDetection.service.ts`

**Features:**
- Checks for duplicate applications by PAN (primary key)
- Normalizes PAN (uppercase, remove spaces)
- Checks various PAN field names: `pan`, `pan_card`, `pan_number`
- **Warns but allows submission** (soft validation)
- Returns duplicate application details if found

**API Response:**
```json
{
  "success": true,
  "data": {
    "loanApplicationId": "...",
    "fileId": "...",
    "warnings": ["Warning: A similar application exists..."],
    "duplicateFound": {
      "fileId": "SF12345678",
      "status": "under_kam_review"
    }
  }
}
```

### ✅ 8. Frontend Enhancements

**NewApplication.tsx Enhancements:**
- Stepper UI for form navigation
- OneDrive upload integration (automatic on file select)
- Soft validation warnings display
- Duplicate detection warning display
- Confirmation dialog when submitting with warnings
- Upload progress indicators

## n8n Integration

### POST Webhooks
- `POST applications` - Create/update loan application
- `POST Fileauditinglog` - Create query/task marker for KAM attention
- `POST POSTLOG` - Admin activity logging (via Module 0)

### GET Webhooks
- `GET loanapplication` - Read applications (for duplicate check)
- `GET clientformmapping` - Read form config (for validation)

**Minimized Executions:**
- Duplicate check: 1 webhook call (Loan Application table)
- Form config: 1 webhook call (Client Form Mapping)
- Application creation: 1 webhook call (POST applications)
- Query creation: 1 webhook call (POST Fileauditinglog) - only if warnings

## Testing

### Unit Tests

**Location:** `backend/src/services/validation/__tests__/duplicateDetection.test.runner.ts`

**Test coverage:**
- ✅ PAN normalization (spaces, case)
- ✅ Duplicate detection by exact PAN match
- ✅ Handling different PAN field names
- ✅ No match found scenario

**Run tests:**
```bash
tsx src/services/validation/__tests__/duplicateDetection.test.runner.ts
```

## Acceptance Criteria

### ✅ Draft Saved Only on Explicit Click

**Verification:**
- "Save as Draft" button triggers save
- No network calls on field changes
- No autosave functionality
- Draft status set correctly

### ✅ Submit Works with Missing Non-Critical Items

**Verification:**
- Submit button works even with validation warnings
- Warnings displayed to user
- Confirmation dialog shown
- Application submitted with `Needs Attention: True` flag
- Query/task marker created for KAM

### ✅ Duplicate Detection (PAN Warn + Allow)

**Verification:**
- PAN duplicate check runs on submit
- Warning shown if duplicate found
- Submission still allowed
- Duplicate details displayed

## Files Created/Modified

### New Files
- `backend/src/services/onedrive/onedriveUpload.service.ts` - OneDrive upload service
- `backend/src/services/validation/duplicateDetection.service.ts` - Duplicate detection
- `backend/src/services/validation/formValidation.service.ts` - Soft validation
- `backend/src/routes/documents.routes.ts` - Document upload routes
- `src/components/ui/Stepper.tsx` - Stepper component
- `backend/src/services/validation/__tests__/duplicateDetection.test.runner.ts` - Unit tests
- `backend/MODULE_2_APPLICATION_SUBMISSION.md` - This document

### Modified Files
- `backend/src/controllers/loan.controller.ts` - Enhanced with duplicate detection, soft validation, document handling
- `src/pages/NewApplication.tsx` - Enhanced with stepper, OneDrive upload, soft validation UI
- `src/services/api.ts` - Added `uploadDocument()` method
- `backend/package.json` - Added multer dependency

## Definition of Done ✅

- ✅ UI complete + RBAC correct
- ✅ Mock mode works for module (via Module 0)
- ✅ n8n integration performed (POST applications, POST Fileauditinglog)
- ✅ Each meaningful user action triggers at most 1 webhook call
- ✅ POSTLOG is emitted for all critical actions (via Module 0)
- ✅ Required unit tests added (duplicate detection)

## Next Steps

Module 2 is complete. Proceed to **Module 3: M3 Status Tracking + Timeline (State Machine)**.

---

**Status:** ✅ Module 2 Complete - Ready for Module 3


