# Seven-Render: Complete Dealer Flow (Engine Tools)

## READ THIS FIRST — WHERE THE NEW FLOW SITS

The app already has an **8-step wizard** (untouched):

1. Loan Product  
2. Borrower  
3. Loan Details  
4. Dealer  
5. Co-applicant  
6. Geo-tagged Photos  
7. Insurance  
8. Vehicle Details  

After step 8 **final submit**, **before** any congratulations / navigate-away screen, insert the Engine qualify + offer flow. **Do not change steps 1–8.** The new screens come after the wizard completes.

Full path:

```
Steps 1–8 (existing wizard, untouched)
  ↓ final submit
[NEW] Qualify loading screen → /engine/qualify
  ↓ pass → Documents upload (file-to-url)
  ↓ fail → "Not eligible" dead end
  ↓
[NEW] Lender rank → /engine/multi_lender_rank
  ↓
[NEW] Offer screen (Seven Fincorp, 2+ options)
  ↓ accept
[NEW] Approved screen (Phase 1 stop)
```

Base ID: `appzbyi8q7pJRl1cd`  
Engine: `https://n8n-fvmj.srv1499064.hstgr.cloud/webhook`

Client-role users use `/applications/new` (and `/dealer/new` redirects there). Post-submit Engine screens call `/engine/*` only.

---

## PART 0: ENVIRONMENT SETUP

### 0.1 — `.env`
```
VITE_BASE_ID=appzbyi8q7pJRl1cd
VITE_ENGINE_BASE=https://n8n-fvmj.srv1499064.hstgr.cloud/webhook
```

### 0.2 — `vite.config.ts` — `/engine` proxy alongside `/api`

### 0.3 — `vercel.json` — `/engine/:path*` rewrite before SPA catch-all

### 0.4 — `src/services/engineClient.ts` — `enginePost` / `engineUpload`; base_id from env only

---

## PART 1: QUALIFY — `/engine/qualify` (after wizard submit)

Replace any `postMMfrontPAN` / raw bureau Dump / `cibil_score` / `SCORE-VALUE` / “Qualification is waiting on bureau data” pending path for this dealer post-submit gate.

```js
const result = await enginePost('qualify', {
  mobile, pan, name, email: email || "",
  consent_bureau: true,
  consent_bureau_at: new Date().toISOString(),
  application_id: fileId,
  product_code: "ev_dealer"
})
```

- `ok && pass === true` → store result, Status `Qualified`, continue to documents  
- `ok && pass === false` → Status `Rejected`, dead-end screen, Back to Home only  
- else → error + retry (no bureau details)

No waiting/pending bureau state.

---

## PART 2: DOCUMENTS

Load Product Document for product (fallback set if empty). Upload via `engineUpload` → save `Documents` string `docName:url|filename,...` via `airtable_write`. Continue when required docs done.

---

## PART 3: CO-APPLICANT QUALIFY (non-blocking)

If co-applicant pan + mobile present, second `qualify` with `application_id: fileId + "-CO"`. Fail does **not** block. Store for rank.

---

## PART 4: MULTI-LENDER RANK (after documents)

`enginePost('multi_lender_rank', { application_id, applicant, co_applicant, loan })`

---

## PART 5–6: OFFER + APPROVED

Seven Fincorp labels only. Always 2+ options (Value/Standard fallback). Consent required. Write Approved Loan Amount / Lender Decision* / Assigned NBFC (real id). Status stays `Qualified`. Phase 1 approved confirmation screen.

---

## PART 7: FORM DATA JSON

Every Loan Applications create/update also writes `"Form Data": JSON.stringify(allFormFields)`.

---

## WHAT NOT TO CHANGE

Login; non-dealer client pages kept in repo; KAM/Credit/NBFC; Express `backend/`; existing n8n from Express; Airtable schemas; state machine / audit / commission; OneDrive paths used elsewhere; Lato on non-dealer pages.

## SECURITY

Never show score, kill codes, NBFC brand names on offers, PF split, FLDG, Seven economics. Engine via `/engine/` proxy only. No console.log of PAN/Aadhaar/score/bureau in production.
