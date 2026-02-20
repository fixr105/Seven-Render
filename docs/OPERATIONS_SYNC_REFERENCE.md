# Operations and Sync Reference

This document is the single reference for every mutating operation in the system: which tables/systems they touch and which notifications they trigger. Use it together with:

- [System-Wide Sync Actions Checklist](SYSTEM_SYNC_ACTIONS_CHECKLIST.md) – master verification checklist for implementing or auditing sync behavior
- [backend/API_ENDPOINTS_WEBHOOK_MAPPING.md](../backend/API_ENDPOINTS_WEBHOOK_MAPPING.md) – webhook-to-endpoint mapping and step-by-step flows

---

## Table 1 – Core 19 operations

| # | Operation | Endpoint | Primary tables | Secondary tables | Notifications |
|---|-----------|----------|----------------|------------------|---------------|
| 1 | Create Client | POST /kam/clients | Clients, User Accounts | Admin Activity Log | — |
| 2 | Create User Account | POST /user-accounts | User Accounts, (KAM Users if KAM) | Admin Activity Log | — |
| 3 | Create Loan Application | POST /loan-applications | Loan Applications | File Auditing Log, Admin Activity Log | KAM (if submitted, not draft) |
| 4 | Submit Application | POST /loan-applications/:id/submit | Loan Applications | File Auditing Log, Admin Activity Log | KAM |
| 5 | Forward to Credit | POST /kam/loan-applications/:id/forward-to-credit | Loan Applications | File Auditing Log, Admin Activity Log | Credit |
| 6 | Mark Disbursed | POST /credit/loan-applications/:id/mark-disbursed | Loan Applications, Commission Ledger | File Auditing Log, Admin Activity Log | Client (disbursement + commission) |
| 7 | Assign NBFCs | POST /credit/loan-applications/:id/assign-nbfcs | Loan Applications | File Auditing Log, Admin Activity Log | NBFC |
| 8 | KAM Raise Query | POST /kam/loan-applications/:id/queries | Loan Applications, File Auditing Log | Admin Activity Log | Client |
| 9 | Credit Raise Query | POST /credit/loan-applications/:id/queries | Loan Applications, File Auditing Log | Admin Activity Log | KAM |
| 10 | NBFC Decision | POST /nbfc/loan-applications/:id/decision | Loan Applications | File Auditing Log, Admin Activity Log | Credit |
| 11 | Payout Request | POST /clients/me/payout-requests | Commission Ledger | File Auditing Log | Credit |
| 12 | Approve Payout | POST /credit/payout-requests/:id/approve | Commission Ledger | File Auditing Log | Client |
| 13 | Reject Payout | POST /credit/payout-requests/:id/reject | Commission Ledger | File Auditing Log | Client |
| 14 | Ledger Dispute | POST /clients/me/ledger/:ledgerEntryId/query | Commission Ledger | File Auditing Log | Credit |
| 15 | Configure Client Modules | POST /kam/clients/:id/configure-modules (PATCH /kam/clients/:id/modules) | Clients, Client Form Mapping | Admin Activity Log | — |
| 16 | Create Form Link | POST /kam/clients/:id/form-links or POST /credit/clients/:id/form-links | Form Link | Admin Activity Log | — |
| 17 | Create Record Title | POST /kam/record-titles or POST /credit/record-titles | Record Titles | Admin Activity Log | — |
| 18 | Generate Daily Report | POST /reports/daily/generate | Daily Summary Reports | (read: Loan Applications, Commission Ledger, File Auditing Log, Admin Activity Log) | Email (optional) |
| 19 | Login | POST /auth/login | User Accounts (read), role profile (read) | User Accounts (background: Last Login) | — |

---

## Table 2 – Additional operations

Same columns. For Form Link, Record Title, and Product Document, **one resource link** (same path and `:id`) supports **both PATCH and DELETE**; both methods are listed.

| # | Operation | Endpoint | Primary tables | Secondary tables | Notifications |
|---|-----------|----------|----------------|------------------|---------------|
| 20 | Close Application | POST /credit/loan-applications/:id/close | Loan Applications | File Auditing Log, Admin Activity Log | Client |
| 21 | Withdraw Application | POST /loan-applications/:id/withdraw | Loan Applications | File Auditing Log, Admin Activity Log | KAM |
| 22 | KAM Edit Application | POST /kam/loan-applications/:id/edit | Loan Applications | File Auditing Log, Admin Activity Log | — |
| 23 | Client Raise Query | POST /loan-applications/:id/queries (client) | File Auditing Log | Admin Activity Log | KAM |
| 24 | Reply to Query | POST /loan-applications/:id/queries/:queryId/reply | Loan Applications (if form/docs updated), File Auditing Log | Admin Activity Log | Target role (KAM/Client/Credit) |
| 25 | Resolve Query | POST /loan-applications/:id/queries/:queryId/resolve | File Auditing Log | Admin Activity Log | — |
| 26 | Mark In Negotiation | POST /credit/loan-applications/:id/mark-in-negotiation | Loan Applications | File Auditing Log, Admin Activity Log | KAM |
| 27 | Credit Update Status | POST /credit/loan-applications/:id/status | Loan Applications | File Auditing Log, Admin Activity Log | Target role per status |
| 28 | Assign KAM to Client | POST /credit/clients/:id/assign-kam | Clients | Admin Activity Log | — |
| 29 | Create Form Link (Credit) | POST /credit/clients/:id/form-links | Form Link | Admin Activity Log | — |
| 30 | Create Record Title (Credit) | POST /credit/record-titles | Record Titles | Admin Activity Log | — |
| 31 | **Form Link – same link, both methods** | PATCH /credit/form-links/:id | Form Link | Admin Activity Log | — |
| 32 | | DELETE /credit/form-links/:id | Form Link | Admin Activity Log | — |
| 33 | **Record Title – same link, both methods** | PATCH /credit/record-titles/:id | Record Titles | Admin Activity Log | — |
| 34 | | DELETE /credit/record-titles/:id | Record Titles | Admin Activity Log | — |
| 35 | **Product Document – same link, both methods** | PATCH /credit/product-documents/:id | Product Documents | Admin Activity Log | — |
| 36 | | DELETE /credit/product-documents/:id | Product Documents | Admin Activity Log | — |
| 37 | Credit Manual Ledger Entry | POST /credit/ledger/entries | Commission Ledger | File Auditing Log (if applicable) | — |
| 38 | Flag/Resolve Ledger Dispute (Credit) | POST /credit/ledger/:ledgerEntryId/flag-dispute, resolve-dispute | Commission Ledger | File Auditing Log | Client (on resolve) |
| 39 | Create/Update User Account | POST /user-accounts, PATCH /user-accounts/:id | User Accounts, (KAM Users if KAM) | Admin Activity Log | — |
| 40 | Credit Team Users CRUD | Credit Team Users controller | Credit Team Users | Admin Activity Log | — |
| 41 | NBFC Partners CRUD | POST /nbfc-partners, PATCH /nbfc-partners/:id | NBFC Partners | Admin Activity Log | — |
| 42 | KAM Update Client Modules | PATCH /kam/clients/:id/modules | Clients, Client Form Mapping | Admin Activity Log | — |

---

## Cross-cutting actions

- **Cache invalidation:** Handled inside `n8nClient` per table after every POST/PATCH/DELETE (e.g. Loan Application, File Auditing Log, Clients, Form Link, Record Titles, Product Documents). No controller-level cache calls required for the operations above.
- **Status transitions:** Any status change must be validated via `statusStateMachine.validateTransition()` and respect role permissions.
- **Frontend refetch:** After each mutation, refetch the list/detail/dashboard that displays the updated data (e.g. `listApplications`, `getApplication(id)`, `getClientLedger()`, `listClients()`). Handle loading and error states.
- **Error handling:** Notifications and admin logging are wrapped in try/catch so failures do not fail the main request. User-facing errors and optional retries (e.g. 3× exponential backoff for webhooks) should be considered elsewhere.

---

## Quick matrix: Trigger → Webhooks | Cache | Notify | Refetch

| Trigger | Webhooks | Cache invalidate | Notify | Frontend refetch |
|---------|----------|------------------|--------|------------------|
| Create application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM (if submit) | listApplications |
| Submit application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM | listApplications |
| Forward to credit | loanapplications, Fileauditinglog, POSTLOG | Loan Application | Credit | listApplications |
| Mark disbursed | loanapplications, COMISSIONLEDGER, Fileauditinglog, POSTLOG | Loan Application, Commission Ledger | Client | listApplications, getClientLedger |
| Close application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | Client | listApplications |
| Withdraw application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM | listApplications |
| Create client | Client, adduser, POSTLOG | Clients, User Accounts | — | listClients |
| Create form link | Form Link, POSTLOG | Form Link | — | form config |
| PATCH/DELETE form link (same :id) | Form Link (PATCH/DELETE), POSTLOG | Form Link | — | form config |
| PATCH/DELETE record title (same :id) | Record Titles (PATCH/DELETE), POSTLOG | Record Titles | — | form config |
| PATCH/DELETE product document (same :id) | Product Documents (PATCH/DELETE), POSTLOG | Product Documents | — | product config |
| Payout request | COMISSIONLEDGER, Fileauditinglog | Commission Ledger | Credit | getClientLedger |
| Approve/Reject payout | COMISSIONLEDGER, Fileauditinglog | Commission Ledger | Client | getClientLedger, getPayoutRequests |
| NBFC decision | loanapplications, Fileauditinglog, POSTLOG | Loan Application | Credit | listApplications |
| Assign NBFCs | loanapplications, Fileauditinglog, POSTLOG | Loan Application | NBFC | listApplications |
| Mark in negotiation | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM | listApplications |
| Credit update status | loanapplications, Fileauditinglog, POSTLOG | Loan Application | Target role per status | listApplications |
