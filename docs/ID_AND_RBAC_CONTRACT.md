# ID and RBAC Contract

This doc defines the **ID semantics**, **matcher rules**, and **data-flow conventions** that all RBAC, filtering, and "who sees what" logic must respect. When you touch RBAC, filtering, or listing: **"Does this respect the contract?"** — link to this doc in PRs.

---

## 1. ID semantics

| ID / Field | Meaning | Resolved by |
|------------|---------|-------------|
| **user.kamId** | KAM Users record id **or** KAM ID (from auth). `getKAMManagedClientIds` resolves to both. | `getKAMManagedClientIds`, KAM Users table |
| **Clients.Assigned KAM** | KAM Users record id **or** KAM ID. `getKAMManagedClientIds` matches both via KAM Users. | `getKAMManagedClientIds`, KAM Users |
| **Loan Application.Client** (app.Client) | **Always** Client (company) id from Clients table. **Never** User Account id. | `rbacFilterService.filterLoanApplications`, `getKAMManagedClientIds` for KAM |

---

## 2. matchIds

- **Rules:** Exact or case-insensitive only. **No** `includes`, `indexOf`, or substring matching.
- **Adversarial examples (must NOT match):**
  - `KAM1` vs `KAM10` → false  
  - `rec123` vs `rec1234` → false  
- **Allowed:** `KAM001` vs `KAM001` → true; `KAM1` vs `kam1` → true (case-insensitive).  
- **Implementation:** `backend/src/utils/idMatcher.ts`. Tests: `backend/src/utils/__tests__/idMatcher.test.ts`.

---

## 3. Table-to-table consistency

When adding or changing "Assigned KAM," "Client," "Managed by," etc., update this table and confirm code matches.

| Table | Field (our name) | Expected values | Check |
|-------|------------------|-----------------|-------|
| Clients | Assigned KAM | KAM Users record id or KAM ID | Matches `getKAMManagedClientIds` + KAM Users |
| Loan Application | Client | Clients.id / Client ID | Never User Account id |
| User Accounts | — | (none for managed clients) | Not used as `managedClientIds` for `app.Client` |

---

## 4. ID and data flow checklist

Use whenever you touch RBAC, filtering, or "who sees what":

- [ ] **ID source** — Which table/field does this ID come from? (User Account, Client, KAM User, etc.)
- [ ] **ID consumer** — What are we comparing it to? Same table/field or another?
- [ ] **Same ID kind?** — Record id (recXXX) vs business id (KAM001) vs email: are we mixing? If Assigned KAM can be either, does our logic handle both?
- [ ] **Matcher rules** — Exact, case-insensitive, or "contains"? Could that cause false positives (KAM1/KAM10, rec123/rec1234)?
- [ ] **When does it run?** — On every request? Only on full reload? Only when a query param is present? Is that what we want?

Apply to: `getKAMManagedClientIds`, `filterLoanApplications`, `matchIds`, `listApplications` (KAM), and any new filter.

---

## 5. "When does this run?" for list hooks

| Hook | Trigger | Intended behavior |
|------|---------|-------------------|
| useApplications | Mount (and refetch) | Fetch on mount; refetch on explicit `refetch()`. |
| useLedger | Mount (and refetch) | Fetch on mount when role is client or credit_team; refetch on `refetch()`. |
| useNotifications | **Only on full reload (F5)** | Intentional: avoid refetch on every SPA nav. Documented exception. |

**Convention:** List hooks and pages fetch on mount by default (including SPA navigation). Use explicit Refresh or Load form for manual refetch.

**Pages (Clients, Dashboards, FormConfiguration, NewApplication, Reports):** These pages and useNotifications now fetch on mount (and/or on Refresh or Load form); they no longer use `isPageReload()` for required data. When adding new pages, prefer fetch on mount for list views.

---

## 6. Application list endpoints and RBAC

| Endpoint | Controller | RBAC | Notes |
|----------|------------|------|-------|
| GET /loan-applications | loan.controller | `rbacFilterService.filterLoanApplications` | Role-based. |
| GET /kam/loan-applications | kam.controller | `rbacFilterService.filterLoanApplications` | **Same RBAC as GET /loan-applications.** Do not reintroduce User-Account–based filtering. |
| GET /credit/loan-applications | credit.controller | None (by design) | Credit sees all; `requireCredit`. Optional filters (clientId, etc.) are facets only. |

- No ad-hoc `managedClientIds.includes(app.Client)` or User-Account–based filtering.
- `getKAMLedger` uses `getKAMManagedClientIds` and `matchIds` for client membership.

---

## 7. Process

1. **ID contract** — All RBAC/filter work is checked against this doc.
2. **Single RBAC pipeline** — "List applications for role X" goes through `rbacFilterService`; no ad-hoc filters that reinvent "managed" with different IDs.
3. **Matchers** — `matchIds` and similar: adversarial "must not match" cases in tests; no `includes`/substring.
4. **List hooks** — Fetch on mount by default; "only on full reload" is documented and justified when used.
5. **Transforms** — API → UI: a few tests for "weird but valid" shapes (string, empty, alternative keys).
6. **Schema/ID audit** — When adding/changing "Assigned KAM," "Client," "Managed by," update the table in section 3 and confirm the code matches.
