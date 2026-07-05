# KAM Application Management Checklist

Operational checklist for Key Account Managers from client setup through forwarding to Credit. Each action maps to implemented API/UI in Seven-Render.

## Phase 0 — Client setup (one-time)

| Action | UI / API | Verified |
|--------|----------|----------|
| Onboard client | Clients → Onboard Client → `POST /kam/clients` | Yes |
| Enable modules | Clients → Modules → `PATCH /kam/clients/:id/modules` | Yes |
| Assign loan products | Clients → Assign Products → `PUT /kam/clients/:id/assigned-products` | Yes |
| Form configuration | Credit Team owns `/form-configuration`; KAM uses product assignment | By design |
| Client login smoke | Client sees assigned products on New Application | Manual / e2e |

## Phase 1 — Triage & monitoring

| Action | UI / API | Verified |
|--------|----------|----------|
| Dashboard counts | `GET /kam/dashboard` | Yes |
| Pending review alerts | KAM Dashboard action center | Yes |
| Pending credit queries | Dashboard pending-queries card | Yes |
| Applications list + filters | Applications page + URL filters | Yes |
| Notifications | Bell + `useNotifications` | Depends on n8n webhook |
| Open application detail | List / dashboard links | Yes |

## Phase 2 — Initial review (Under KAM Review)

| Action | UI / API | Verified |
|--------|----------|----------|
| Application summary | Application detail | Yes |
| Form data / checklist | Application Information card | Yes |
| Documents | Documents list (view/download) | Yes |
| AI summary | Generate AI Summary button | Yes |
| Status history | Status timeline / audit log | Yes |
| Refresh | Refresh button | Yes |

## Phase 3 — Query the client

| Action | UI / API | Verified |
|--------|----------|----------|
| Raise query (detail) | Raise Query → `POST /kam/loan-applications/:id/queries` | Yes |
| Raise query (list) | Applications row action | Yes |
| Status → Query with Client | State machine enforced | Yes |
| Client notification | notification service + SendGrid | Depends on n8n |
| Edit own query (~15 min) | Query thread edit | Yes |
| Resolve own query | Resolve (author only) | Yes |
| Client reply → Under KAM Review | `POST /loan-applications/:id/queries/:queryId/reply` | Yes |
| Query badges on list | Applications unresolved count (KAM + Credit) | Yes |

## Phase 4 — Edit application

| Action | UI / API | Verified |
|--------|----------|----------|
| Edit form data | Edit Application modal → `POST .../edit` | Yes |
| Update remarks | Included in edit modal | Yes |
| Audit log | `edit_application` in File Auditing Log | Yes |
| Lock after forward | Backend rejects non-review statuses | Yes |

## Phase 5 — Forward to credit

| Action | UI / API | Verified |
|--------|----------|----------|
| Forward to Credit | Button (under_kam_review or query_with_client) | Yes |
| Optional notes | Prompt on forward | Yes |
| Status → Pending Credit Review | `loanWorkflow.forwardToCreditTeam` + state machine | Yes |
| Credit notified | `notifyCreditTeam` | Depends on n8n |

## Phase 6 — Respond to credit queries

| Action | UI / API | Verified |
|--------|----------|----------|
| Dashboard triage | `pendingQuestionsFromCredit` | Yes |
| Reply in thread | Query reply → credit | Yes |
| Status → Pending Credit Review | KAM reply on `credit_query_with_kam` | Yes |
| KAM action-required highlight | Query section alert | Yes |

## Phase 7 — Manual status updates

| Action | UI / API | Verified |
|--------|----------|----------|
| Update Status modal | Restricted to allowed KAM transitions | Yes |
| Invalid transitions rejected | `validateTransition` on backend | Yes |

## Phase 8 — Read-only tracking

| Action | UI / API | Verified |
|--------|----------|----------|
| Forwarded files count | Dashboard | Yes |
| Downstream status | Applications list | Yes |
| Client ledger | Ledger → `GET /kam/ledger?clientId=` | Yes |

## KAM cannot (Credit / NBFC only)

- Assign NBFC, mark in negotiation, approve/reject, disburse, close, approve payouts, withdraw

## Per-file sign-off (before Forward to Credit)

```
File #: ___________  Client: ___________  Date: ___________
[ ] Applicant & loan details verified
[ ] All mandatory form fields complete
[ ] All required documents reviewed
[ ] Edits logged in audit trail (if any)
[ ] No open client queries blocking forward
[ ] Notes for credit team added (if needed)
[ ] Forwarded — status = Pending Credit Review
```
