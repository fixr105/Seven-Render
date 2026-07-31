# n8n execution budget (place / submit)

After the aggressive cut (2026-07-31):

| Scope | Expected n8n HTTP calls |
|-------|-------------------------|
| B2C **Next** step | **0** (local only) |
| B2C / classic **Save draft** | ~2–4 (loan POST + create audit; optional idempotency GET) |
| **Submit** with existing draft | **~3–5**: 1× GET loanapplication (ownership) + 1× POST loanapplications1 + 1× Fileauditinglog1 + 1× POSTLOG (+ optional cached Loan Products for classic mandatory) |
| **Submit** with no draft (`saveAsDraft:false` create) | **~3–5**: optional idempotency GET + POST loan + Fileaudit + POSTLOG (+ optional Clients cache for KAM notify) |

Removed amplifiers: per-step `persistDraft`, validateOnly preflight, update+submit double write, dual status loggers, `verifyLoanApplicationPersisted` GET×1–5, File Auditing cache bust on every loan POST.

Ops: deactivate duplicate n8n workflows on the same webhook path or each HTTP still shows as multiple executions in n8n UI.
