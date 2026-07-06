# B2C EV System Audit Report

Generated: 2026-07-05T20:10:39.289Z
Application ID: rec5bRIShnlquBZkA
File ID: SFMR885QTE
Product ID: LP012

## Summary

- Steps executed: 21
- Steps passed: 21
- Steps failed: 0
- Broken functions: 0

## Steps Executed

| Step | Actor | Action | Method | Endpoint | Success | GET Verified |
|------|-------|--------|--------|----------|---------|--------------|
| 1 | client | Login as Client | POST | /auth/login | Yes | N/A |
| 2 | client | GET assigned loan products | GET | /loan-products | Yes | Yes |
| 3 | client | Create B2C EV draft application | POST | /loan-applications | Yes | N/A |
| 4 | system | GET verify draft in n8n Loan Application table | GET | n8n: Loan Application | Yes | Yes |
| 5 | client | GET application detail (client) | GET | /loan-applications/rec5bRIShnlquBZkA | Yes | Yes |
| 6 | client | Request VKYC compliance (client query → audit log) | POST | /loan-applications/rec5bRIShnlquBZkA/queries | Yes | N/A |
| 7 | client | Persist VKYC request metadata to form_data (wizard parity) | POST | /loan-applications/rec5bRIShnlquBZkA/form | Yes | N/A |
| 8 | system | GET verify VKYC request persisted in form_data | GET | n8n: Loan Application form_data | Yes | Yes |
| 9 | client | Request Disbursement Order (DO) query | POST | /loan-applications/rec5bRIShnlquBZkA/queries | Yes | N/A |
| 10 | client | Persist DO request metadata to form_data (wizard parity) | POST | /loan-applications/rec5bRIShnlquBZkA/form | Yes | N/A |
| 11 | system | GET verify DO request persisted in form_data | GET | n8n: Loan Application form_data | Yes | Yes |
| 12 | client | Submit application to KAM review | POST | /loan-applications/rec5bRIShnlquBZkA/submit | Yes | N/A |
| 13 | system | GET verify status after submit | GET | n8n: Loan Application | Yes | Yes |
| 14 | kam | Login as KAM | POST | /auth/login | Yes | N/A |
| 15 | kam | GET KAM dashboard pendingB2cActions | GET | /kam/dashboard | Yes | Yes |
| 16 | kam | Mark VKYC compliance complete | POST | /kam/loan-applications/rec5bRIShnlquBZkA/b2c/compliance | Yes | N/A |
| 17 | system | GET verify VKYC marked complete in form_data | GET | n8n: Loan Application form_data | Yes | Yes |
| 18 | kam | Mark DO request processed | POST | /kam/loan-applications/rec5bRIShnlquBZkA/b2c/do-request | Yes | N/A |
| 19 | system | GET verify DO fulfilledAt in form_data | GET | n8n: Loan Application form_data | Yes | Yes |
| 20 | kam | Forward application to Credit (KAM approve path) | POST | /kam/loan-applications/rec5bRIShnlquBZkA/forward-to-credit | Yes | N/A |
| 21 | system | GET verify status after forward to credit | GET | n8n: Loan Application | Yes | Yes |

## Step Details

### Step 1: Login as Client
- **Actor:** client
- **Method:** POST `/auth/login`
- **Success:** true
- **Detail:** role=client, clientId=USER-1776170387391-a8k3m9p2x


### Step 2: GET assigned loan products
- **Actor:** client
- **Method:** GET `/loan-products`
- **Success:** true
- **Detail:** Found 1 products, selected=LP012


### Step 3: Create B2C EV draft application
- **Actor:** client
- **Method:** POST `/loan-applications`
- **Success:** true
- **Detail:** applicationId=rec5bRIShnlquBZkA, fileId=SFMR885QTE


### Step 4: GET verify draft in n8n Loan Application table
- **Actor:** system
- **Method:** GET `n8n: Loan Application`
- **Success:** true
- **Detail:** resolvedStatus=draft, template=b2c_ev_v1


### Step 5: GET application detail (client)
- **Actor:** client
- **Method:** GET `/loan-applications/rec5bRIShnlquBZkA`
- **Success:** true
- **Detail:** status=draft


### Step 6: Request VKYC compliance (client query → audit log)
- **Actor:** client
- **Method:** POST `/loan-applications/rec5bRIShnlquBZkA/queries`
- **Success:** true
- **Detail:** queryId=QUERY-1783282179421-v61v40ftu


### Step 7: Persist VKYC request metadata to form_data (wizard parity)
- **Actor:** client
- **Method:** POST `/loan-applications/rec5bRIShnlquBZkA/form`
- **Success:** true
- **Detail:** requestedAt=2026-07-05T20:09:44.932Z


### Step 8: GET verify VKYC request persisted in form_data
- **Actor:** system
- **Method:** GET `n8n: Loan Application form_data`
- **Success:** true
- **Detail:** requestedAt=2026-07-05T20:09:44.932Z


### Step 9: Request Disbursement Order (DO) query
- **Actor:** client
- **Method:** POST `/loan-applications/rec5bRIShnlquBZkA/queries`
- **Success:** true
- **Detail:** queryId=QUERY-1783282189070-oms2z778s


### Step 10: Persist DO request metadata to form_data (wizard parity)
- **Actor:** client
- **Method:** POST `/loan-applications/rec5bRIShnlquBZkA/form`
- **Success:** true
- **Detail:** requestedAt=2026-07-05T20:09:53.684Z


### Step 11: GET verify DO request persisted in form_data
- **Actor:** system
- **Method:** GET `n8n: Loan Application form_data`
- **Success:** true
- **Detail:** doRequest.requestedAt=2026-07-05T20:09:53.684Z


### Step 12: Submit application to KAM review
- **Actor:** client
- **Method:** POST `/loan-applications/rec5bRIShnlquBZkA/submit`
- **Success:** true
- **Detail:** status=under_kam_review


### Step 13: GET verify status after submit
- **Actor:** system
- **Method:** GET `n8n: Loan Application`
- **Success:** true
- **Detail:** resolvedStatus=under_kam_review


### Step 14: Login as KAM
- **Actor:** kam
- **Method:** POST `/auth/login`
- **Success:** true
- **Detail:** role=kam, kamId=USER-1767430965768-xkughnmb6


### Step 15: GET KAM dashboard pendingB2cActions
- **Actor:** kam
- **Method:** GET `/kam/dashboard`
- **Success:** true
- **Detail:** pendingB2cActions=1, includesAuditApp=true


### Step 16: Mark VKYC compliance complete
- **Actor:** kam
- **Method:** POST `/kam/loan-applications/rec5bRIShnlquBZkA/b2c/compliance`
- **Success:** true



### Step 17: GET verify VKYC marked complete in form_data
- **Actor:** system
- **Method:** GET `n8n: Loan Application form_data`
- **Success:** true
- **Detail:** compliance.vkycDone=true


### Step 18: Mark DO request processed
- **Actor:** kam
- **Method:** POST `/kam/loan-applications/rec5bRIShnlquBZkA/b2c/do-request`
- **Success:** true



### Step 19: GET verify DO fulfilledAt in form_data
- **Actor:** system
- **Method:** GET `n8n: Loan Application form_data`
- **Success:** true
- **Detail:** fulfilledAt=2026-07-05T20:10:21.494Z


### Step 20: Forward application to Credit (KAM approve path)
- **Actor:** kam
- **Method:** POST `/kam/loan-applications/rec5bRIShnlquBZkA/forward-to-credit`
- **Success:** true



### Step 21: GET verify status after forward to credit
- **Actor:** system
- **Method:** GET `n8n: Loan Application`
- **Success:** true
- **Detail:** resolvedStatus=pending_credit_review, fileId=SFMR885QTE



## Broken Functions

_None identified — all steps passed._

## Root Cause Analysis

### 1. Draft Status not round-tripped (CRITICAL — blocks entire Client flow)

`mapLoanStatusForAirtablePost()` intentionally **omits** `Status` when internal status is `draft` (Airtable has no "Draft" option). New applications are created without a `Status` column value. However, `updateApplicationForm` and `submitApplication` compare `application.Status !== LoanStatus.DRAFT` — when `Status` is `undefined`, edits and submit are **rejected** with "Application cannot be edited/submitted in current status".

**Impact:** Client cannot persist DO/compliance metadata, cannot submit, KAM never receives `under_kam_review` files.

**Affected code:** `backend/src/utils/loanApplicationAirtableStatus.ts`, `loan.controller.ts` (`updateApplicationForm`, `submitApplication`).

### 2. B2C query metadata requires two-step Client write (design gap)

`POST /loan-applications/:id/queries` creates a File Auditing Log entry only. `_meta.kamRequests.*` and `_meta.doRequest.*` are written by the **frontend** via `POST /loan-applications/:id/form` (`persistDraft`). If the form update fails (see #1), KAM `pendingB2cActions` stays empty even though queries exist in audit log.

**Impact:** KAM dashboard B2C card shows 0 actions; compliance/DO triage broken.

### 3. E2C test credentials misconfigured

| Account | Documented default | Actual role | Issue |
|---------|-------------------|-------------|-------|
| `sagar@sevenfincorp.email` | Client (E2E default) | **kam** | Cannot create applications as client |
| `anyaaa@gmail.com` | — | client | `clientId=null` after login — not linked |
| `vadukavsk@gmail.com` | — | client | Works; linked to Meghasri (`USER-1776170387391-a8k3m9p2x`) |
| `sagar@sevenfincorp.email` | KAM (E2E default) | kam | Does **not** manage Meghasri — assigned KAM is **Anya** (`USER-176743096...`) |

**Impact:** KAM actions return 403 Access denied for Meghasri B2C files when using Sagar.

### 4. GET webhook missing Status on many records

n8n GET `/webhook/loanapplication` returns records without `Status` for draft-era files. Backend normalizes empty status to `''`, not `draft`.

### 5. sessionStorage continuity (Client-only)

| Key | Storage | Scope | Cross-profile? |
|-----|---------|-------|----------------|
| `seven_used_client_webhook_links` | sessionStorage | Current browser tab | No — KAM/Credit never read this |
| Bearer token (`apiService`) | sessionStorage | Per tab | No — must re-login per role |
| `_meta.documentsFolderLink.*` | form_data (DB) | Persistent | Yes — all roles see via GET application |

Folder link confirmation **must** be in form_data for KAM review continuity; sessionStorage alone is insufficient across profiles.

## Unit Test Status

Backend B2C EV unit tests: **23/23 passed** (logic correct in isolation).

Integration failures are at n8n/Airtable boundary and draft-status handling, not in pure B2C extraction/fulfillment logic.

## Local Storage / Session Continuity Notes

- `sessionStorage` key `seven_used_client_webhook_links` tracks consumed document folder links per browser tab (Client only). KAM/Credit do not read this key — folder link confirmation is persisted in `form_data._meta.documentsFolderLink.*`.
- Bearer tokens are stored in `sessionStorage` per tab (`apiService`). Switching Client→KAM requires separate login; tokens do not cross roles automatically.
- `clientSubmissionId` provides idempotent create/submit across retries.

## Application Form Data Snapshot (final)

```json
{
  "applicantName": "AUDIT TESTUSER",
  "requestedLoanAmount": "500000",
  "productId": "LP012",
  "_meta.formTemplate": "b2c_ev_v1",
  "_meta.loginDate": "2026-07-05",
  "_meta.supportPersonType": "co_applicant",
  "_meta.panLookup.status": "completed",
  "_meta.panLookup.inputHash": "",
  "_meta.panLookup.completedAt": "2026-07-05T20:09:25.645Z",
  "_meta.supportPanLookup.status": "pending",
  "_meta.supportPanLookup.inputHash": "",
  "_meta.supportPanLookup.completedAt": "",
  "_meta.supportPanLookup.phase": "input",
  "compliance.vkycDone": "true",
  "compliance.loanAgreementSigned": "true",
  "compliance.enachDone": "true",
  "_meta.kamRequests.vkyc.requestedAt": "",
  "_meta.kamRequests.vkyc.queryId": "QUERY-1783282179421-v61v40ftu",
  "_meta.kamRequests.loanAgreement.requestedAt": "",
  "_meta.kamRequests.loanAgreement.queryId": "",
  "_meta.kamRequests.enach.requestedAt": "",
  "_meta.kamRequests.enach.queryId": "",
  "_meta.doRequest.requestedAt": "2026-07-05T20:09:53.684Z",
  "_meta.doRequest.queryId": "QUERY-1783282189070-oms2z778s",
  "_meta.doRequest.fulfilledAt": "2026-07-05T20:10:21.494Z",
  "geoPhotos.withSupportPerson.url": "https://example.com/geo-withSupportPerson.jpg",
  "geoPhotos.withSupportPerson.fileName": "withSupportPerson.jpg",
  "geoPhotos.withSupportPerson.latitude": "19.0760",
  "geoPhotos.withSupportPerson.longitude": "72.8777",
  "geoPhotos.withSupportPerson.capturedAt": "2026-07-05T20:09:25.645Z",
  "geoPhotos.withVehicle.url": "https://example.com/geo-withVehicle.jpg",
  "geoPhotos.withVehicle.fileName": "withVehicle.jpg",
  "geoPhotos.withVehicle.latitude": "19.0760",
  "geoPhotos.withVehicle.longitude": "72.8777",
  "geoPhotos.withVehicle.capturedAt": "2026-07-05T20:09:25.645Z",
  "geoPhotos.atResidence.url": "https://example.com/geo-atResidence.jpg",
  "geoPhotos.atResidence.fileName": "atResidence.jpg",
  "geoPhotos.atResidence.latitude": "19.0760",
  "geoPhotos.atResidence.longitude": "72.8777",
  "geoPhotos.atResidence.capturedAt": "2026-07-05T20:09:25.645Z",
  "borrower.firstName": "AUDIT",
  "borrower.lastName": "TESTUSER",
  "borrower.customerName": "AUDIT TESTUSER",
  "borrower.gender": "Male",
  "borrower.dob": "1990-01-15",
  "borrower.fatherName": "FATHER TEST",
  "borrower.mobile": "9876543210",
  "borrower.email": "audit.test@example.com",
  "borrower.pan": "ABCDE1234F",
  "borrower.address.line1": "123 Audit Street",
  "borrower.address.village": "Test Village",
  "borrower.address.pincode": "400001",
  "borrower.address.district": "Mumbai",
  "borrower.address.state": "Maharashtra",
  "loan.amount": 500000,
  "loan.interestRate": 12,
  "loan.tenureMonths": 36,
  "loan.processingFee": 5000,
  "loan.gpsCharges": 3000,
  "loan.processingFeePercent": 1,
  "loan.disbursalAmount": 492000,
  "dealer.displayLabel": "Audit Dealer",
  "dealer.id": "DEALER-AUDIT",
  "dealer.tradeName": "Audit Motors",
  "dealer.name": "Audit Motors Pvt Ltd",
  "dealer.contact": "9876543211",
  "dealer.email": "dealer@audit.com",
  "dealer.gstNumber": "27AAAAA0000A1Z5",
  "dealer.pan": "AAAAA1234A",
  "dealer.ifscCode": "HDFC0001234",
  "coApplicant.name": "CO APPLICANT TEST",
  "coApplicant.dob": "1992-06-01",
  "coApplicant.email": "coapplicant@audit.com",
  "coApplicant.pan": "FGHIJ5678K",
  "coApplicant.address.line1": "456 Co Street",
  "coApplicant.address.village": "Co Village",
  "coApplicant.address.pincode": "400002",
  "coApplicant.address.district": "Mumbai",
  "coApplicant.address.state": "Maharashtra",
  "coApplicant.mobile": "9876543212",
  "coApplicant.relationship": "Spouse",
  "insurance.cost": 15000,
  "insurance.provider": "Audit Insurance",
  "insurance.policyNumber": "POL-AUDIT-001",
  "insurance.issuedDate": "2026-01-01",
  "insurance.periodMonths": 12,
  "vehicle.cost": 600000,
  "vehicle.manufacturingYear": 2025,
  "vehicle.invoiceDate": "2026-01-15",
  "vehicle.downpayment": 100000,
  "vehicle.registrationCost": 5000,
  "_documentsFolderLink": "https://drive.google.com/drive/folders/audit-test-folder",
  "_meta.documentsFolderLink.consumedLink": "https://drive.google.com/drive/folders/audit-test-folder",
  "_meta.documentsFolderLink.consumedAt": "2026-07-05T20:09:25.645Z",
  "_meta.doRequest.fulfillmentNotes": "DO processed in audit test"
}
```
