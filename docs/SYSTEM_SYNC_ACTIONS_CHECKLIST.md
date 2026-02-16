# System-Wide Sync Actions Checklist

Use this as a prompt for planning and implementing concurrent sync actions across the system. Paste the Master Checklist or a specific template into a planning doc, ticket, or AI prompt when designing or reviewing sync behavior for a given action.

**Canonical references:**
- [backend/API_ENDPOINTS_WEBHOOK_MAPPING.md](../backend/API_ENDPOINTS_WEBHOOK_MAPPING.md) – webhook → endpoint mapping
- [backend/src/services/statusTracking/statusStateMachine.ts](../backend/src/services/statusTracking/statusStateMachine.ts) – status transitions
- [backend/src/services/airtable/n8nClient.ts](../backend/src/services/airtable/n8nClient.ts) – cache invalidation patterns

---

## Master Checklist

When implementing or auditing system sync for a user action, verify **ALL** of the following:

### 1. BACKEND POST WEBHOOKS (Airtable Sync)

- [ ] Primary entity webhook called (e.g., `loanapplications`, `Client`, `COMISSIONLEDGER`)
- [ ] File Auditing Log webhook called (`/webhook/Fileauditinglog`) for application/file/ledger changes
- [ ] Admin Activity Log webhook called (`/webhook/POSTLOG`) for admin/audit actions
- [ ] User Account webhook called (`/webhook/adduser`) when creating/updating users
- [ ] Notification webhook called (`/webhook/notification` via `n8nClient.postNotification()`) when notifications are required

### 2. CACHE INVALIDATION

- [ ] Primary table cache invalidated (e.g., Loan Application, Clients)
- [ ] Related table caches invalidated (e.g., Client Form Mapping, Form Categories, Form Fields when Form Category changes)
- [ ] Force-refresh flag passed where needed for immediate consistency

### 3. STATUS TRANSITIONS (if applicable)

- [ ] Status change validated against state machine (`statusStateMachine.ts`)
- [ ] Role has permission for the transition (`ROLE_STATUS_PERMISSIONS`)
- [ ] All dependent fields updated (e.g., Submitted Date, Assigned NBFC)

### 4. CASCADE ACTIONS (if applicable)

- [ ] Commission Ledger entry created on DISBURSED
- [ ] Commission calculated from client rate
- [ ] Notifications sent to correct roles (KAM, Credit, NBFC, Client)

### 5. FRONTEND REFETCH

- [ ] List views refetched after create (e.g., `listApplications`, `listClients`)
- [ ] Detail views refetched after update (e.g., `getApplication`, `getClientLedger`)
- [ ] Dashboard data refetched if affected
- [ ] Loading/error states handled during refetch

### 6. ERROR HANDLING

- [ ] Partial failure: rollback or compensating action considered
- [ ] User notified on failure
- [ ] Retry logic for transient webhook failures (3 attempts, exponential backoff)

---

## Per-Action Checklist Templates

### Loan Application Create/Update

**ACTION:** Create/Update Loan Application

- [ ] POST `loanapplications` webhook
- [ ] POST `Fileauditinglog` webhook
- [ ] POST `POSTLOG` (Admin Activity Log)
- [ ] Invalidate: Loan Application cache
- [ ] If create + !draft: Notify assigned KAM via `/webhook/notification`
- [ ] Frontend: refetch `listApplications()` or `getApplication(id)`

---

### Status Change (Forward, Disburse, etc.)

**ACTION:** Status Change (e.g., Forward to Credit, Mark Disbursed)

- [ ] Validate transition in `statusStateMachine.ts`
- [ ] POST `loanapplications` (status update)
- [ ] POST `Fileauditinglog` (status change entry)
- [ ] POST `POSTLOG`
- [ ] If DISBURSED: POST `COMISSIONLEDGER`, fetch client commission rate
- [ ] Invalidate: Loan Application, Commission Ledger (if disbursed)
- [ ] Notify: target role per transition via `/webhook/notification`
- [ ] Frontend: refetch `getApplication(id)`, `listApplications()`, `getClientLedger()` if disbursed

---

### Client Onboard

**ACTION:** Create Client (Onboard)

- [ ] POST `Client` webhook
- [ ] POST `adduser` webhook (User Account)
- [ ] POST `POSTLOG`
- [ ] Invalidate: Clients, User Accounts
- [ ] Frontend: refetch `listClients()`

---

### Form Mapping Create

**ACTION:** Create Form Mapping

- [ ] POST `POSTCLIENTFORMMAPPING` webhook
- [ ] POST `POSTLOG`
- [ ] Invalidate: Client Form Mapping, Form Categories, Form Fields
- [ ] Frontend: refetch form config, `listClients()` if on Form Configuration page

---

### Commission/Payout

**ACTION:** Payout Request / Approve / Reject / Dispute

- [ ] POST `COMISSIONLEDGER` webhook
- [ ] POST `Fileauditinglog` (for disputes)
- [ ] POST `POSTLOG`
- [ ] Invalidate: Commission Ledger
- [ ] Notify: Client (approve/reject), Credit (dispute) via `/webhook/notification`
- [ ] Frontend: refetch `getClientLedger()`, `getPayoutRequests()`

---

## Deployment Verification Checklist

Before deploying sync changes:

- [ ] All POST endpoints call required webhooks (see [API_ENDPOINTS_WEBHOOK_MAPPING.md](../backend/API_ENDPOINTS_WEBHOOK_MAPPING.md))
- [ ] Cache invalidation runs after every POST
- [ ] Status transitions use `statusStateMachine.ts`
- [ ] Frontend refetches after mutations (no stale UI)
- [ ] Notifications sent for: forward, assign, disbursed, query, payout
- [ ] Error paths: user feedback, retries, no silent failures
- [ ] Tests cover: success path, partial failure, cache invalidation

---

## Quick Reference: Action → Sync Matrix

| Trigger | Webhooks | Cache Invalidate | Notify | Frontend Refetch |
|---------|----------|------------------|--------|------------------|
| Create application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM | listApplications |
| Submit application | loanapplications, Fileauditinglog, POSTLOG | Loan Application | KAM | listApplications |
| Forward to credit | loanapplications, Fileauditinglog, POSTLOG | Loan Application | Credit | listApplications |
| Mark disbursed | loanapplications, COMISSIONLEDGER, Fileauditinglog, POSTLOG | Loan Application, Commission Ledger | Client | listApplications, getClientLedger |
| Create client | Client, adduser, POSTLOG | Clients, User Accounts | — | listClients |
| Create form mapping | POSTCLIENTFORMMAPPING, POSTLOG | Client Form Mapping, Form Categories, Form Fields | — | form config |
| Payout request | COMISSIONLEDGER, POSTLOG | Commission Ledger | Credit | getClientLedger |
| NBFC decision | loanapplications | Loan Application | — | listApplications |
| Assign NBFCs | loanapplications, Fileauditinglog, POSTLOG | Loan Application | NBFC | listApplications |

---

## Related Checklists

- [Form Input Flow Checklist](FORM_INPUT_FLOW_CHECKLIST.md) – form submit phases and validation
- [GET and Page Load Checklist](GET_AND_PAGE_LOAD_CHECKLIST.md) – data dependencies and timeouts
