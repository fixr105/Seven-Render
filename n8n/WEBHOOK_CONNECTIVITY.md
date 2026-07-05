# n8n Webhook Connectivity Guide

How the Seven-Render backend maps to your n8n workflows, what must stay active, and known gaps.

**Base URL:** `https://fixrrahul.app.n8n.cloud/webhook/`

**Backend config:** [`backend/src/services/airtable/n8nEndpoints.ts`](../backend/src/services/airtable/n8nEndpoints.ts)

---

## Two-workflow setup (production)

| Workflow | Purpose |
|----------|---------|
| **Dashboard main** | All GET webhooks, most POST/PATCH/DELETE, login user list |
| **LMS FIX** (or `n8n/standalone/*.json`) | Four POST `*1` paths for loan writes |

Both must be **active** for full app functionality.

---

## Connected and working

### LMS FIX — POST `*1` (backend default)

| Path | Backend | Table |
|------|---------|-------|
| `loanapplications1` | `post.loanApplications` | Loan Applications |
| `Fileauditinglog1` | `post.fileAuditLog` | File Auditing Log |
| `loanproducts1` | `post.loanProducts` | Loan Products |
| `NBFCPartners1` | `post.nbfcPartners` | NBFC Partners |

### Dashboard main — GET reads

| Path | Used for |
|------|----------|
| `useraccount` | Login (`getUserAccounts`) |
| `loanapplication` | Fetch applications |
| `fileauditinglog` | Audit log |
| `loanproducts` | Product catalog |
| `nbfcpartners` | NBFC list |
| `client`, `kamusers`, `creditteamuser` | Profile IDs at login |
| `formlink`, `Recordtitle`, `productdocument` | Form configuration |
| `getclientKYC` | B2C EV dealer autofill |
| `VehiclesGET` | Vehicle catalog |

### Dashboard main — other POST

`POSTLOG`, `COMISSIONLEDGER`, `CREDITTEAMUSERS`, `DAILYSUMMARY`, `adduser`, `Client`, `KAMusers`, `notification`, `email`, `Formlink`, `Recordtitle`, `productdocument`, `VehiclesPOST`, etc.

---

## Backend fixes (in repo)

### Loan application Status mapping

Airtable Loan Applications `Status` accepts only:

`Qualified`, `Submitted`, `Dealer Unresponsive`, `Under Finance Review`, `DO Issued`, `Disbursed`, `Rejected`

The backend maps internal slugs before POST via [`loanApplicationAirtableStatus.ts`](../backend/src/utils/loanApplicationAirtableStatus.ts):

| Internal slug | Airtable label |
|---------------|----------------|
| `draft` | *(omitted — not sent)* |
| `under_kam_review`, `submitted` | Submitted |
| `query_with_client` | Dealer Unresponsive |
| `pending_credit_review` | Under Finance Review |
| `in_negotiation`, `qualified` | Qualified |
| `sent_to_nbfc`, `approved` | DO Issued |
| `rejected` | Rejected |
| `disbursed` | Disbursed |

---

## Not connected / needs n8n attention

### 1. Superseded POST paths (Dashboard main)

Dashboard still exposes old paths without `1`. Backend no longer calls them:

- `loanapplications` → use `loanapplications1`
- `Fileauditinglog` → use `Fileauditinglog1`
- `loanproducts` → use `loanproducts1`
- `NBFCPartners` → use `NBFCPartners1`

Safe to deactivate those four nodes in Dashboard main if LMS FIX is active.

### 2. Test account filter (Dashboard main) — not wired

Workflow name says "Test Account Filter" but **GET `useraccount` does not use it**:

```
GET useraccount → User Accounts (search all) → Respond
```

The filter branch (`Filter Test Accounts`, excludes `test@`, `dummy@`, etc.) is **orphaned** — no webhook triggers it, and it incorrectly points at Record Titles respond node.

**Fix in n8n:** Insert filter between `User Accounts` and `Respond to Webhook16`, or delete the orphan branch.

Login filtering today happens in **Node** (`auth.service.ts`: Active + bcrypt).

### 3. POST `useraccount` (Webhook32) — stub

```
POST useraccount → Respond (echo only)
```

Backend login uses **GET** `useraccount`, not POST. User create/update uses **`adduser`**.

### 4. Duplicate `webhookId` on GET nodes

Many GET webhooks share `webhookId: 46a2b46b-3288-4970-bd13-99c2ba08d52d`. This can break GET routing. Each webhook should have a **unique** `webhookId` after re-import.

### 5. Workflows not in Dashboard or LMS FIX

| Path | Used for |
|------|----------|
| `postMMfrontPAN` | PAN / borrower autofill |
| `3212b705-b54a-4d4e-9648-e7a6bfb06d2b` | Client onboarding link |

Must exist as separate active workflows.

### 6. PATCH/DELETE extras in Dashboard

Dashboard defines PATCH/DELETE for many tables; backend only calls PATCH/DELETE for `formlink`, `recordtitle`, `productdocument`, `loanproducts`.

---

## Activation checklist

- [ ] **Dashboard main** active (GET + non-LMS POST)
- [ ] **LMS FIX** active (four `*1` POST paths)
- [ ] **PAN workflow** active (`postMMfrontPAN`)
- [ ] **Link workflow** active (UUID path)
- [ ] Unique `webhookId` per GET webhook (optional but recommended)
- [ ] Wire or remove orphaned test-account filter branch

---

## Smoke test

```bash
cd backend && node test-all-post-webhooks-complete.js
```

Expect **13/13 POST** passes when both workflows are active.

---

## Import standalone POST workflows

See [`standalone/README.md`](standalone/README.md).
