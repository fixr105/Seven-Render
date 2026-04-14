# Support runbook: documents folder (Google Drive / OneDrive)

Use this when an applicant says documents were uploaded but Credit/KAM cannot open the folder or files.

## Symptoms

- Folder link opens but shows "Request access" or permission errors.
- Link opens a single file instead of a folder.
- Empty folder or wrong applicant content.
- Applicant insists they "shared the link" but no team address appears in sharing settings.

## Correct share addresses (applicants see these on New Application)

| Product      | Email to invite                    |
| ------------ | ---------------------------------- |
| Google Drive | `automation.sevenfincorp@gmail.com` |
| OneDrive     | `automation@sevenfincorp.email`    |

Confirm which product they used and that the **matching** address appears on the folder’s **Share** / **Manage access** list with at least **Viewer** (or **Editor** if your process requires it).

## Quick checks (support)

1. **URL shape**  
   - Prefer a **folder** URL (e.g. Google Drive `.../drive/folders/...` or equivalent OneDrive folder link).  
   - Reject bare file links when the process expects a folder; ask them to use **Get link** from the folder root.

2. **Sharing model**  
   - **Preferred:** named invite to the email above.  
   - **Avoid:** relying only on "Anyone with the link" unless policy explicitly allows it; it’s easy to misconfigure and harder to audit.

3. **Applicant confirmation flag**  
   In application form data, `Folder sharing confirmed` (field `_documentsFolderShareAcknowledged`) should be **Yes** for new submissions. If **No** or missing, treat as higher risk that sharing was skipped.

4. **Multiple accounts**  
   Applicant may share from a personal account while the link is under a workspace account (or vice versa). Ask which account owns the folder and re-verify sharing on that account.

## Sample message to applicant (edit as needed)

> Thanks for your application. We’re unable to open your documents folder yet. Please open the folder in Google Drive (or OneDrive), use **Share**, and add **[correct email]** with access to the folder. Then send us the **folder** link again (the one that opens the folder, not a single PDF). If you use both products, only the matching email is needed for the one you use.

## Escalation

- Repeated access failures after clear instructions: consider phone walkthrough or screenshot of their **Share** dialog (redact unrelated emails if they send a screenshot).  
- Suspected wrong applicant or fraud: follow your standard KYC / ops procedure.

## Related code (engineering)

- New application UI: `src/pages/NewApplication.tsx` (`_documentsFolderLink`, `_documentsFolderShareAcknowledged`).  
- Server validation: `backend/src/services/validation/mandatoryFieldValidation.service.ts` (non-draft submit).
