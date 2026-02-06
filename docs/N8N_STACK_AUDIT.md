# n8n Stack Audit – Comparison to Built System

**Date:** 2026-02-03  
**Purpose:** Audit n8n webhooks and flows against backend usage; identify non-functioning or broken flows.

**Status update (verified):** Notification POST fixed and verified; all 15 fields mapped in n8n. Email flow (POST /webhook/email) confirmed for NBFC-assign and daily-summary. Commission Ledger path `commisionledger` confirmed. Admin Activity Log filtered in backend (Activity ID + Timestamp). All 15 GET webhooks working. Verified 2026-02-03.

---

## 1. Overview

The backend uses n8n as a proxy to Airtable: **GET** webhooks for reading tables, **POST** webhooks for creating/updating records. Configuration lives in [backend/src/services/airtable/n8nEndpoints.ts](backend/src/services/airtable/n8nEndpoints.ts) and [backend/src/config/webhookConfig.ts](backend/src/config/webhookConfig.ts). All requests use `N8N_BASE_URL` (e.g. `https://fixrrahul.app.n8n.cloud/webhook/`).

---

## 2. GET Webhooks (Read) – Status

Backend calls `n8nClient.fetchTable(tableName)` which uses [webhookConfig](backend/src/config/webhookConfig.ts) to resolve the GET URL per table. Parsing is handled by `N8nResponseParser` in [n8nClient.ts](backend/src/services/airtable/n8nClient.ts).

| Table Name             | n8n Path (from n8nEndpoints) | Status   | Notes |
|------------------------|------------------------------|----------|--------|
| Admin Activity Log     | Adminactivity                | Working  | Backend filters to rows with Activity ID + Timestamp (filter applied). |
| Client Form Mapping    | clientformmapping            | Working  | — |
| Clients                | client                       | Working  | — |
| Commission Ledger      | **commisionledger**          | Working  | Typo (one “m”); backend and docs use same spelling; ensure n8n path matches. |
| Credit Team Users      | creditteamuser               | Working  | — |
| Daily Summary Report   | dailysummaryreport           | Working  | — |
| File Auditing Log      | fileauditinglog              | Working  | — |
| Form Categories        | formcategories               | Working  | — |
| Form Fields            | formfields                   | Working  | — |
| KAM Users              | kamusers                     | Working  | — |
| Loan Application       | loanapplication              | Working  | — |
| Loan Products          | loanproducts                 | Working  | — |
| NBFC Partners          | nbfcpartners                 | Working  | — |
| Notifications          | notifications                | Working  | GET returns existing rows; new rows are not written if POST notification is broken (see below). |
| User Accounts          | useraccount                  | Working  | Used for login (auth.service.getUserAccounts()). |

**Conclusion:** All 15 GET webhooks are functional. Admin Activity has data quality issues (empty records); filtering in `audit.controller.ts` is recommended.

---

## 3. POST Webhooks (Write) – Status

Backend uses `n8nClient.post*(...)` for each entity. Field mapping and status are from [POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md](../POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md).

| Webhook Path (POST)   | Backend Method               | Status    | Notes |
|------------------------|------------------------------|-----------|--------|
| POSTLOG                | postAdminActivityLog         | Partial   | Optional fields (Related File ID, Related Client ID, Related User ID, Metadata) not mapped in n8n. |
| POSTCLIENTFORMMAPPING  | postClientFormMapping        | Complete  | — |
| COMISSIONLEDGER        | postCommissionLedger         | Complete  | Path spelling: one “m”. |
| CREDITTEAMUSERS        | postCreditTeamUser           | Complete  | — |
| DAILYSUMMARY           | postDailySummary             | Complete  | — |
| Fileauditinglog        | postFileAuditLog             | Complete  | — |
| FormCategory           | postFormCategory             | Complete  | — |
| FormFields             | postFormField                | Complete  | — |
| KAMusers               | postKamUser                  | Complete  | — |
| loanapplications       | postLoanApplication          | Complete  | — |
| loanproducts           | postLoanProduct              | Complete  | — |
| NBFCPartners           | postNBFCPartner               | Complete  | — |
| adduser                | postUserAccount              | Complete  | — |
| Client                 | postClient                   | Partial   | “Form Categories” sometimes not mapped in n8n. |
| **notification**       | **postNotification**         | **Complete (fixed)** | All 15 fields mapped in n8n; verified 2026-02-03. See Section 4 for original issue. |
| email                  | postEmail                    | Depends   | Used for NBFC assign and daily summary email; requires n8n workflow to send (e.g. Outlook/SMTP). |

---

## 4. Broken Flow: Notification POST

**Flow:** Backend creates in-app notifications via `notificationService.createNotification()` → `n8nClient.postNotification()` → POST `/webhook/notification`.

**Problem:** Per [POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md](../POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md), the n8n workflow for `/notification` has **no field mappings** (`"value": {}`). The backend sends 15 fields (id, Notification ID, Recipient User, Recipient Role, Related File, Related Client, Related Ledger Entry, Notification Type, Title, Message, Channel, Is Read, Created At, Read At, Action Link), but n8n does not map them to Airtable.

**Impact:**

- **In-app notifications:** New notifications are **not** stored in Airtable. `GET /notifications` reads from Airtable via `fetchTable('Notifications')`, so newly “created” notifications never appear in the app.
- **Email:** Unaffected. `createNotification` also calls `sendGridService.sendEmail()` when channel is `email` or `both`; query-created and other emails are sent via SendGrid, not n8n.

**Fix (n8n):** In the n8n workflow that handles POST `/webhook/notification`, configure the Airtable (or downstream) node to map all 15 fields sent by the backend to the Notifications table columns.

---

## 5. Email Flow (POST /webhook/email)

**Usage:**

- **Assign NBFC:** [credit.controller.ts](backend/src/controllers/credit.controller.ts) `assignNBFCs` calls `n8nClient.postEmail()` to notify assigned NBFCs (application link).
- **Daily summary:** [reports.controller.ts](backend/src/controllers/reports.controller.ts) calls `n8nClient.postEmail()` when `emailRecipients` is provided; [Reports.tsx](../src/pages/Reports.tsx) has an optional “Email to” field.

**Payload:** `{ to, subject, body, cc?, bcc? }`.

**Risk:** If the n8n workflow for `/webhook/email` is not set up (e.g. no Outlook/SMTP node or wrong path), these emails will not be sent. Query-created emails are sent by the backend via SendGrid, not this webhook (see [docs/NOTIFICATIONS_EMAIL_FLOWS.md](NOTIFICATIONS_EMAIL_FLOWS.md)).

**Recommendation:** Verify in n8n that the `email` webhook path exists and that the workflow sends the request body to the intended mail provider.

---

## 6. Commission Ledger Path Spelling

Backend and existing docs use:

- POST path: `COMISSIONLEDGER` → `/webhook/COMISSIONLEDGER` (one “m”)
- GET path: `commisionledger` → `/webhook/commisionledger` (one “m”)

[GET_WEBHOOK_GAP_ANALYSIS.md](../GET_WEBHOOK_GAP_ANALYSIS.md) confirms Commission Ledger GET works. Ensure n8n workflow paths use the same spelling; do not “fix” only one side or the flow will break.

---

## 7. Login / User Accounts

Login does **not** use a separate n8n “validate” webhook. [auth.service.ts](backend/src/auth/auth.service.ts) uses `getUserAccounts()` (GET User Accounts webhook), then validates credentials in memory. Any standalone `/webhook/validate` flow is legacy; the critical path is GET User Accounts.

---

## 8. Summary: Non-Functioning and Broken Flows

| Flow                    | Type | Status     | Action |
|-------------------------|------|------------|--------|
| **POST /notification**  | POST | **Complete (fixed)** | All 15 fields mapped in n8n; verified 2026-02-03. |
| POST /email             | POST | Verified   | n8n workflow confirmed for NBFC assign and daily summary. |
| POST POSTLOG            | POST | Partial    | Optional; map optional fields if filtering/linking by file/client/user is needed. |
| POST Client             | POST | Partial    | Map “Form Categories” in n8n if backend sends it. |
| GET Admin Activity      | GET  | Working    | Backend filters to Activity ID + Timestamp (filter applied in audit.controller). |

---

## 9. References

- [backend/src/services/airtable/n8nEndpoints.ts](../backend/src/services/airtable/n8nEndpoints.ts) – All GET/POST paths and env overrides
- [backend/src/services/airtable/n8nClient.ts](../backend/src/services/airtable/n8nClient.ts) – fetchTable, postData, postNotification, postEmail, etc.
- [GET_WEBHOOK_GAP_ANALYSIS.md](../GET_WEBHOOK_GAP_ANALYSIS.md) – GET webhook test results and Admin Activity data quality
- [POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md](../POST_WEBHOOK_FIELD_MAPPING_COMPARISON.md) – Field-level POST comparison (notification = 0 mappings)
- [docs/NOTIFICATIONS_EMAIL_FLOWS.md](NOTIFICATIONS_EMAIL_FLOWS.md) – Query email (SendGrid) vs NBFC/daily summary (n8n postEmail)
- [docs/N8N_TEST_CHECKLIST.md](N8N_TEST_CHECKLIST.md) – Verification checklist for testers
