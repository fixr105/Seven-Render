# Root Cause: Client Can Submit Application Without Completing Required Documents

**Defect:** Client can submit a loan application without providing the Documents Folder link and without completing the document checklist (e.g. only one document selected).

**Module:** Client Dashboard → Applications → New Loan Application

---

## Summary of Root Causes

| # | Root Cause | Location | Impact |
|---|------------|----------|--------|
| 1 | Document checklist fields are **hardcoded as non-required** in product form config | Backend + Frontend | No checklist item is ever mandatory; user can submit with 0 or 1 document selected |
| 2 | Folder link requirement is **bypassed by any HTTP URL** in any form field | Frontend | Any `http` link in any field satisfies “document link”; no real Drive/OneDrive link needed |
| 3 | **Empty form config** when product has no Section/Field keys | Backend | No document checklist validation at all; only folder link rule applies |

---

## 1. Document Checklist Never Required (Primary)

**Location:** `backend/src/services/formConfig/productFormConfig.service.ts`

In `parseProductFormConfig()`, every parsed field is created with **`isRequired: false`**:

```181:186:backend/src/services/formConfig/productFormConfig.service.ts
    const fields: ParsedFormField[] = fieldsForSection.map((e) => ({
      fieldId: e.key.replace(/\s+/g, '-').toLowerCase(),
      label: e.value,
      type: 'file',
      isRequired: false,
    }));
```

**Effect:**

- Backend `mandatoryFieldValidation.service.ts` builds mandatory fields from `f.isMandatory` (from config `isRequired`). So **no document checklist field is mandatory**.
- Frontend `NewApplication.tsx` uses the same config; `isRequired` is false for all checklist fields, so **no errors are added** for missing document selections.
- Result: User can submit with no document options selected or only one selected; validation never blocks on the checklist.

**Fix direction:** Make document checklist fields required by default, or derive `isRequired` from Loan Product / Form configuration (e.g. a “Required” column or convention) instead of hardcoding `false`.

---

## 2. Folder Link Bypassed by Any HTTP URL (Frontend)

**Location:** `src/pages/NewApplication.tsx`, `validateMandatoryFields()`

The code treats “has document link” as true if **any** value in `form_data` (other than `_documentsFolderLink`) is a non-empty string that **starts with `'http'`**:

```385:402:src/pages/NewApplication.tsx
    if (!hasDocumentLink && fd) {
      for (const key of Object.keys(fd)) {
        if (key === '_documentsFolderLink') continue;
        const v = fd[key];
        if (v && typeof v === 'string' && v.trim().length > 0) {
          const lower = v.toLowerCase();
          if (
            lower.includes('drive.google.com') ||
            lower.includes('onedrive.live.com') ||
            lower.includes('sharepoint.com') ||
            v.startsWith('http')
          ) {
            hasDocumentLink = true;
            break;
          }
        }
      }
    }
```

**Effect:** A value like `https://example.com` in any form field (e.g. a website URL) sets `hasDocumentLink = true`, so the **Documents Folder link is not required** even when the user never pasted a Google Drive / OneDrive folder link.

**Fix direction:** Remove the `v.startsWith('http')` fallback for “document link”. Only accept:

- A valid `_documentsFolderLink` (drive.google.com / onedrive.live.com / sharepoint.com), or  
- Other form_data values that explicitly contain drive.google.com / onedrive.live.com / sharepoint.com (if you still want to allow links in other fields to count).

---

## 3. Empty Form Config (No Checklist to Validate)

**Location:** `backend/src/services/formConfig/productFormConfig.service.ts`, `getFormConfigForProduct()`

When the Loan Product record has **no product-embedded section keys** (e.g. no “Section 1”, “Section 2”, etc.), the function returns **empty categories**:

```379:396:backend/src/services/formConfig/productFormConfig.service.ts
  if (product && Object.keys(product).some((k) => parseSectionKey(k) != null)) {
    const parsed = parseProductFormConfig(product as Record<string, unknown>);
    // ...
  }
  return { categories: [] };
```

**Effect:** With `categories: []`, both backend and frontend have **no document checklist fields** to validate. Only the global “documents or folder link” rule applies. If that is also bypassed (e.g. via #2), submission succeeds with no documents.

**Fix direction:** Ensure Loan Products that require a document checklist have the correct Section/Field configuration in Airtable. Optionally, add a fallback (e.g. simple form config by client/product) so a checklist still exists when product-embedded config is missing.

---

## Data Flow (Submit Path)

1. **Frontend:** User clicks “Submit Application” → `handleSubmit(e, false)` → `validateMandatoryFields(false)`:
   - Validates core fields (applicant name, loan product, amount, business type).
   - Validates **required** form fields from `displayCategories` (from form config). Because `isRequired` is false for all checklist fields, no checklist errors.
   - Validates folder link: if `_documentsFolderLink` is invalid but any other field has `v.startsWith('http')`, validation passes.
2. **API:** `POST /loan-applications` with `saveAsDraft: false`, `formData`, etc.
3. **Backend:** `createApplication()`:
   - For `!saveAsDraft`, calls `validateMandatoryFields()` in `mandatoryFieldValidation.service.ts`.
   - Mandatory fields come from `getFormConfigForProduct(productId)`; all fields have `isRequired: false`, so mandatory list is empty for checklist.
   - Only global rule “documents or folder link” can block; backend’s `hasDocumentsOrFolderLink()` does not use `v.startsWith('http')`, so backend is stricter than frontend here.

So:

- **Checklist never blocks** because of #1 (and #3 when config is empty).
- **Folder link can be bypassed on frontend** because of #2; backend may still enforce folder/link if no other document link is present.

---

## Expected Behavior (from defect)

- Block submission until:
  - **Condition 1:** A valid Google Drive / OneDrive folder link is provided.
  - **Condition 2:** For the document checklist, the client has selected a status for **each required document** (e.g. “Yes, Added to Folder”, “Awaiting, Will Update Folder”, “Not Available”).
- Show a single validation message such as:  
  *“Please provide the document folder link and update the document checklist before submitting the application.”*

---

## Recommended Fixes (in order)

1. **Require document checklist items**
   - In `productFormConfig.service.ts`, stop hardcoding `isRequired: false`. Either set `isRequired: true` for all file-type fields in the product-embedded config or derive it from Airtable/configuration (e.g. “Required” column or product-level setting).
   - Ensure frontend and backend both use this so mandatory validation includes every required document.

2. **Tighten folder link validation on frontend**
   - In `NewApplication.tsx`, remove the `v.startsWith('http')` condition when determining `hasDocumentLink`. Only treat as “has document link” when:
     - `_documentsFolderLink` is a valid Drive/OneDrive/SharePoint link, or
     - (If desired) another form field’s value explicitly contains drive.google.com / onedrive.live.com / sharepoint.com.
   - Optionally align the exact rules with the backend’s `hasDocumentsOrFolderLink()` so behavior is consistent.

3. **Optional: Fallback when form config is empty**
   - If a product should always have a document checklist, consider a fallback (e.g. default sections/fields or client-specific config) when `getFormConfigForProduct` returns empty categories, so checklist validation still runs.

4. **User-facing message**
   - When validation fails due to missing folder link and/or incomplete checklist, show the single message:  
     *“Please provide the document folder link and update the document checklist before submitting the application.”*

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/services/formConfig/productFormConfig.service.ts` | Set or derive `isRequired: true` (or from config) for document/file fields instead of `false`. |
| `src/pages/NewApplication.tsx` | Remove `v.startsWith('http')` from folder-link check; optionally unify message with backend. |
| Backend `mandatoryFieldValidation.service.ts` | No logic change needed for checklist once config has correct `isRequired`; optional: refine error message to match spec. |
