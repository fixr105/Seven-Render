# Dynamic Processing Fee & Interest Rate — System Handoff

> **Purpose of this document.** This is a self-contained brief for any LLM/engineer tasked with making **Processing Fee (PF)** and **Interest Rate** *dynamic* (user/admin-editable) inside the **B2C EV loan application form**, while leaving the **calculation engine untouched**. It documents the entire loan-math subsystem end-to-end: files, data flow, formulas, persistence, validation, edit paths, current hardcoding, and the exact change plan with gotchas and acceptance criteria.
>
> Read this top-to-bottom before writing code. Everything you need to reason about is here; file paths and line refs are current as of this writing.

---

## 1. Feature goal

Today the loan EMI, processing fee, and interest rate are computed from **hardcoded constants** (`INTEREST_RATE = 35%`, `PF_PCT = 8%`). The goal:

- Let the **interest rate** and **processing-fee percentage** be **dynamic inputs** in the B2C EV wizard's **Loan Details** step (instead of frozen constants).
- The **computed EMI / processing-fee ₹ / disbursal** must react live to those inputs and be persisted correctly.
- **The calculation engine stays untouched** (see scope below).

### Scope & constraints — what "calculator stays untouched" means

There are **three** distinct things people call "the calculator". Be precise:

| Layer | File | Touch? |
|---|---|---|
| **Pure calc engine** (formulas/constants) | `src/lib/loanCalculator.ts` | **DO NOT change formulas.** The functions are already parameterized (`interestRate`, `processingFeePct` are arguments). You may add/adjust the thin *default-only* wrapper `calculateB2cLoanPreview`, but do not alter any math in `calculateEmi`, `resolveB2cLoanAmount`, `calculateB2cLoanScenarioPreview`, GST helpers, etc. |
| **Standalone EMI-range page** (`/calculator`) | `src/components/calculator/EmiRangeCalculator.tsx` | **Leave untouched.** It shows a low/high 30–35% & 6–8% range and is a separate feature. |
| **Wizard loan-stage UI** | `src/components/applications/LoanCalculator.tsx` | **This is where the dynamic inputs go.** This is the "form" the request refers to. Editing this component is expected and in-scope. |

> **Interpretation used by this doc:** "calculator untouched" = *the pure engine `loanCalculator.ts` math and the standalone `/calculator` page stay untouched.* The dynamic PF/interest inputs are added to the **wizard loan stage** (`LoanCalculator.tsx`) and its form-schema/validation/persistence wiring. If the intent was that `LoanCalculator.tsx` itself must not change either, stop and confirm — the feature is not achievable without changing *some* UI.

---

## 2. High-level architecture

The loan subsystem is a **freeze-snapshot** pipeline. The user fills a calculator, clicks **Freeze**, and the computed numbers are copied into the application's `form_data` JSON blob. Nothing about rate/fee is recomputed server-side; the backend only *validates presence* of the fields and forwards `form_data` to Airtable via n8n.

```
[Loan calculator UI]  →  freeze()  →  [LoanFrozenValues]  →  frozenValuesToFormDataPatch()
   (LoanCalculator.tsx)                (in-memory object)      ↓
                                                        form_data["loan.*"] keys
                                                                ↓
                                            B2CEvApplicationWizard (setFormState)
                                                                ↓
                                     persistDraft() → apiService → backend → Prisma + n8n → Airtable
```

Key property: **`form_data` is the source of truth.** Reloading a draft calls `formDataToFrozenValues(form_data)` to rehydrate the calculator.

### File inventory

| File | Role |
|---|---|
| `src/lib/loanCalculator.ts` | **Pure engine.** All constants, formulas (EMI, loan amount, PF, GST), freeze/patch/rehydrate helpers. **No React.** |
| `src/components/applications/LoanCalculator.tsx` | **Wizard loan-stage UI.** Stage 1 = editable calculator; Stage 2 = read-only mirror of frozen values + invoice. Calls `calculateB2cLoanPreview` + `freezeB2cLoanPreview`. |
| `src/components/calculator/EmiRangeCalculator.tsx` | Standalone `/calculator` low/high range page. Out of scope. |
| `src/components/applications/LoanDraftInvoiceBreakdown.tsx` | "Value Breakup" invoice card rendered from `LoanFrozenValues`. |
| `src/config/forms/b2cEvFormSchema.ts` | Declarative field list for the wizard. Loan stage fields at lines ~146–159. **No interest-rate or PF-% field today.** |
| `src/lib/b2cEvFormValidation.ts` | **Frontend** validation + `syncB2cEvComputedFields` (recomputes disbursal). |
| `backend/src/services/validation/b2cEvFormValidation.service.ts` | **Backend** required-field validation. **Requires `loan.interestRate` (percent).** |
| `src/components/applications/B2CEvApplicationWizard.tsx` | Orchestrator. Wires `LoanCalculator`, maps frozen values → `form_data`, promotes `loan.amount` → `requested_loan_amount`, autosaves. |
| `src/components/applications/review/B2cEvKamEditModal.tsx` | Post-submission KAM edit; already exposes `loan.interestRate` & `loan.processingFee` as free-text edits. |
| `backend/prisma/schema.prisma` | Only `requestedLoanAmount` / `approvedLoanAmount` columns exist. Rate/PF/tenure live only in `form_data`. |
| `docs/loan-details-calculator-logic.md` | Older design doc — **partly stale** (old function names & formula). |

---

## 3. The calculation engine (`src/lib/loanCalculator.ts`)

### 3.1 Constants (the values to make dynamic)

```1:17:src/lib/loanCalculator.ts
export const INTEREST_RATE_MIN = 30;
export const INTEREST_RATE_MAX = 35;
export const FEE_PCT_MIN = 0.06;
export const FEE_PCT_MAX = 0.08;
export const INTEREST_RATE = INTEREST_RATE_MAX;
/** @deprecated Legacy EMI range calculator — B2C wizard uses PF_PCT */
export const FEE_PCT = FEE_PCT_MAX;
export const PF_PCT = 0.08;
export const LOAN_GROSSUP_FACTOR = 1.09;
export const MIN_CUSTOMER_PAYMENT_OF_TAX_INVOICE_PCT = 0.1;
export const GST_RATE_OPTIONS = [0.05, 0.18] as const;
export type VehicleGstRate = (typeof GST_RATE_OPTIONS)[number];
export const GST_PCT = 0.05;
export const GPS_CHARGES: Record<12 | 18, number> = {
  12: 2000,
  18: 2500,
};
```

- `INTEREST_RATE` (= 35) — annual %, used by the wizard.
- `PF_PCT` (= 0.08) — processing-fee fraction, used by the wizard.
- `INTEREST_RATE_MIN/MAX`, `FEE_PCT_MIN/MAX` — only for the standalone range page.
- Tenure is restricted to **12 or 18 months** (`LoanTenureMonths`).
- `GPS_CHARGES` is tenure-tiered (₹2,000 / ₹2,500).

### 3.2 EMI formula (reducing balance) — **already takes `interestRate`**

```198:211:src/lib/loanCalculator.ts
export function calculateEmi(
  loanAmount: number,
  tenureMonths: LoanTenureMonths,
  interestRate: number = INTEREST_RATE
): number {
  if (loanAmount <= 0 || tenureMonths <= 0) return 0;

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) return roundRupee(loanAmount / tenureMonths);

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (loanAmount * monthlyRate * factor) / (factor - 1);
  return roundRupee(emi);
}
```

`EMI = P·r·(1+r)^n / ((1+r)^n − 1)`, `r = annualRate/100/12`.

### 3.3 Loan-amount derivation — **two modes** (already takes `processingFeePct`)

```248:261:src/lib/loanCalculator.ts
function resolveB2cLoanAmount(
  assumedDisbursement: number,
  processingFeePct: number,
  loanAmountMode: B2cLoanAmountMode
): number {
  if (assumedDisbursement <= 0) return 0;

  if (loanAmountMode === 'feeInverse') {
    if (processingFeePct <= 0 || processingFeePct >= 1) return 0;
    return roundRupee(assumedDisbursement / (1 - processingFeePct));
  }

  return roundRupee(assumedDisbursement * LOAN_GROSSUP_FACTOR);
}
```

- `wizardGrossUp` (default in wizard): `loanAmount = assumedDisbursement × 1.09` — **independent of PF%.**
- `feeInverse` (range page only): `loanAmount = assumedDisbursement / (1 − feePct)`.

⚠️ **Consequence for this feature:** In `wizardGrossUp` mode the loan amount does **not** depend on PF%; only `processingFee = loanAmount × PF%` and `disbursalAmount = loanAmount − processingFee` change with PF. Interest rate only affects EMI. Decide whether dynamic PF should also switch the wizard to `feeInverse` (so PF% actually reshapes the loan). Default recommendation: keep `wizardGrossUp` unless the product owner wants PF% to change the principal.

### 3.4 The scenario function the UI should call (fully parameterized — untouched)

```263:310:src/lib/loanCalculator.ts
export function calculateB2cLoanScenarioPreview(
  inputs: B2cLoanCalculatorInputs,
  interestRate: number = INTEREST_RATE,
  processingFeePct: number = PF_PCT,
  loanAmountMode: B2cLoanAmountMode = 'wizardGrossUp'
): B2cLoanLivePreview {
  ...
  const loanAmount = resolveB2cLoanAmount(assumedDisbursement, processingFeePct, loanAmountMode);
  const processingFee = roundRupee(loanAmount * processingFeePct);
  const disbursalAmount = roundRupee(loanAmount - processingFee);
  const emiAmount = calculateEmi(loanAmount, tenureMonths, interestRate);
  ...
}

export function calculateB2cLoanPreview(inputs: B2cLoanCalculatorInputs): B2cLoanLivePreview {
  return calculateB2cLoanScenarioPreview(inputs, INTEREST_RATE, PF_PCT);
}
```

> **This is the crux.** `calculateB2cLoanScenarioPreview` already accepts `interestRate` and `processingFeePct`. Making the form dynamic = **feeding user-entered values into these existing arguments** rather than the hardcoded defaults. No formula change required.

### 3.5 Freeze / patch / rehydrate helpers

**Freeze** (`freezeB2cLoanPreview`) — **⚠ hardcodes interest rate**:

```438:454:src/lib/loanCalculator.ts
export function freezeB2cLoanPreview(preview: B2cLoanLivePreview): LoanFrozenValues {
  return {
    ...
    interestRate: INTEREST_RATE,   // ⚠ IGNORES preview.interestRate
    ...
  };
}
```

This is a **primary blocker**: even if the preview is computed with a dynamic rate, freeze overwrites it back to 35. It must use `preview.interestRate`. (Contrast: `b2cPreviewToFrozenValues` at lines 331–347 correctly copies `preview.interestRate` — the range page already does the right thing.)

**Patch to form_data** (`frozenValuesToFormDataPatch`, lines 467–492) writes `loan.interestRate`, `loan.processingFee`, etc. It does **not** currently write a `loan.processingFeePct` key.

**Rehydrate** (`formDataToFrozenValues`, lines 494–521): reads `loan.interestRate` back, falling back to `INTEREST_RATE` if absent. It does **not** read PF% (only the ₹ `loan.processingFee`).

---

## 4. Data model / persisted keys

`form_data` is a flat `Record<string, string>`. Loan keys written on freeze:

| `form_data` key | Meaning | Written by |
|---|---|---|
| `loan.vehiclePrice` | Vehicle price (excl GST) | patch |
| `loan.gstRate` | `0.05` / `0.18` | patch |
| `loan.insurance`, `loan.registration`, `loan.accessories` | Add-on costs | patch |
| `loan.calculator.customerPayment` | Downpayment from customer | patch |
| `loan.taxInvoiceValue` | Computed tax invoice | patch |
| `loan.amount` | Loan principal | patch → also promoted to `requested_loan_amount` |
| `loan.interestRate` | Annual % (**currently always "35"**) | patch |
| `loan.tenureMonths` | 12 / 18 | patch |
| `loan.processingFee` | PF in ₹ | patch |
| `loan.gpsCharges` | GPS/IOT ₹ | patch |
| `loan.disbursalAmount` | Net disbursal ₹ | patch + `syncB2cEvComputedFields` |
| `loan.emiAmount` | Monthly EMI (from snapshot only) | patch (if snapshot) |
| **`loan.processingFeePct`** | **Does not exist yet** — add if PF% must persist | — |

**Database** (`backend/prisma/schema.prisma`): only `requestedLoanAmount` and `approvedLoanAmount` are columns. Rate/PF/tenure/EMI are **not** columns — they live in the `form_data` JSON and go to Airtable through n8n. So making PF/rate dynamic requires **no DB migration**.

---

## 5. Wizard wiring (`B2CEvApplicationWizard.tsx`)

The loan stage renders `LoanCalculator`. On freeze it wipes all `loan.*` keys, applies the patch, syncs computed fields, and promotes `loan.amount` → `requested_loan_amount`:

```1643:1679:src/components/applications/B2CEvApplicationWizard.tsx
    if (stage.id === 'loan') {
      const frozenValues = formDataToFrozenValues(formState.form_data);
      return (
        <LoanCalculator
          frozenValues={frozenValues}
          onFrozenValuesChange={(values, snapshot) => {
            setFormState((prev) => {
              const nextFormData = { ...prev.form_data };
              for (const key of Object.keys(nextFormData)) {
                if (key.startsWith('loan.')) delete nextFormData[key];
              }
              if (values) {
                Object.assign(nextFormData, frozenValuesToFormDataPatch(values, snapshot));
              }
              const synced = syncB2cEvComputedFields(nextFormData);
              const loanAmount = readFieldValue(synced, 'loan.amount').replace(/,/g, '');
              return { ...prev, requested_loan_amount: loanAmount || '0', form_data: synced };
            });
            ...
            scheduleAutoSave();
          }}
        />
      );
    }
```

`syncB2cEvComputedFields` recomputes disbursal as a safety net (frontend):

```69:73:src/lib/b2cEvFormValidation.ts
  const loanAmount = Number(String(next['loan.amount'] ?? '').replace(/,/g, '')) || 0;
  const processingFee = Number(String(next['loan.processingFee'] ?? '').replace(/,/g, '')) || 0;
  if (loanAmount > 0) {
    next['loan.disbursalAmount'] = String(Math.max(loanAmount - processingFee, 0));
  }
```

---

## 6. Validation — frontend vs backend (IMPORTANT mismatch)

### Frontend (`src/lib/b2cEvFormValidation.ts`, loan stage, lines 176–197)
Required loan fields: `loan.vehiclePrice`, `loan.gstRate`, `loan.insurance`, `loan.registration`, `loan.accessories`, `loan.calculator.customerPayment`, `loan.amount`, `loan.processingFee`, `loan.tenureMonths`. **`loan.interestRate` is NOT required and NOT surfaced.**

### Backend (`backend/src/services/validation/b2cEvFormValidation.service.ts`, lines 76–80)

```76:80:backend/src/services/validation/b2cEvFormValidation.service.ts
  { key: 'loan.amount', label: 'Loan Amount', type: 'currency', required: true },
  { key: 'loan.interestRate', label: 'Interest Rate', type: 'percent', required: true },
  { key: 'loan.tenureMonths', label: 'Tenure (months)', type: 'number', required: true },
  { key: 'loan.processingFee', label: 'Processing Fee', type: 'currency', required: true },
  { key: 'loan.gpsCharges', label: 'GPS Charges / IOT', type: 'currency', required: true },
```

**Backend requires `loan.interestRate`; frontend never collects it.** Today this "works" only because freeze silently writes `"35"`. Any dynamic-rate change **must keep `loan.interestRate` populated**, and this doc recommends aligning the two validators (make interest rate an explicit, validated field on both sides).

---

## 7. Post-submission edit (KAM)

`B2cEvKamEditModal.tsx` already lets a KAM edit rate & PF after submission (free-text, no recompute):

```14:18:src/components/applications/review/B2cEvKamEditModal.tsx
  { key: 'loan.amount', label: 'Loan Amount' },
  { key: 'loan.interestRate', label: 'Interest Rate (%)' },
  { key: 'loan.tenureMonths', label: 'Tenure (months)' },
  { key: 'loan.processingFee', label: 'Processing Fee' },
  { key: 'loan.gpsCharges', label: 'GPS Charges' },
```

⚠ This edits raw `form_data` values and does **not** recompute EMI/disbursal. If dynamic rate/PF matter downstream, consider recomputing here too (via the engine), or document that KAM edits are manual overrides.

---

## 8. Where interest rate & PF are "hardcoded" today (change map)

| # | Location | Current behavior | Needed for dynamic |
|---|---|---|---|
| 1 | `loanCalculator.ts:8,5` constants | `PF_PCT=0.08`, `INTEREST_RATE=35` | Keep as **defaults**; do not delete. |
| 2 | `loanCalculator.ts:308-310` `calculateB2cLoanPreview` | Hardcodes both into the scenario call | Either pass values in, or have UI call `calculateB2cLoanScenarioPreview` directly with dynamic args. |
| 3 | `LoanCalculator.tsx:85` | `calculateB2cLoanPreview(inputs)` — no rate/PF inputs | Add rate & PF% state + inputs; call scenario fn with them. |
| 4 | `loanCalculator.ts:448` `freezeB2cLoanPreview` | Writes `interestRate: INTEREST_RATE` | **Must** write `preview.interestRate`. |
| 5 | `b2cEvFormSchema.ts:146-159` loan fields | No interest-rate / PF-% field | Add fields if they should appear/validate in the schema. |
| 6 | `b2cEvFormValidation.ts:176-197` | Doesn't require/validate rate | Add interest-rate (and PF%) validation; align with backend. |
| 7 | `frozenValuesToFormDataPatch` / `formDataToFrozenValues` | No `loan.processingFeePct` key | Add if PF% (not just ₹) must persist & rehydrate. |

---

## 9. Recommended implementation plan (engine untouched)

Order matters; each step is independently testable.

1. **UI inputs (wizard only).** In `LoanCalculator.tsx` Stage 1, add two controlled inputs:
   - Interest Rate (annual %) — default `INTEREST_RATE`.
   - Processing Fee % — default `PF_PCT * 100`.
   Keep them editable only while **not frozen** (mirror the existing `disabled={isFrozen}` pattern).

2. **Feed the engine (no formula change).** Replace the `calculateB2cLoanPreview(inputs)` call with:
   ```ts
   calculateB2cLoanScenarioPreview(inputs, interestRatePct, processingFeePct /* fraction */, 'wizardGrossUp')
   ```
   Parse `%` → fraction for PF (`8` → `0.08`). Decide with product owner whether to keep `wizardGrossUp` (PF% does not change principal) or switch to `feeInverse` (PF% reshapes principal). Default: keep `wizardGrossUp`.

3. **Fix freeze.** Change `freezeB2cLoanPreview` to persist `interestRate: preview.interestRate` (remove the hardcoded `INTEREST_RATE`). This is the single most important correctness fix. (This is a *helper*, not a formula — acceptable under "engine untouched", but if you want zero changes to `loanCalculator.ts`, instead build the `LoanFrozenValues` in the UI using `b2cPreviewToFrozenValues`, which already copies the dynamic rate.)

4. **Persist PF% (optional but recommended).** Add `loan.processingFeePct` to `frozenValuesToFormDataPatch` and read it back in `formDataToFrozenValues`, so reopening a draft restores the chosen PF% (not just the ₹ amount). Requires adding `processingFeePct` to `LoanFrozenValues` — a type change, still not a formula change.

5. **Validation alignment.** 
   - Frontend: add `loan.interestRate` (and `loan.processingFeePct` if used) to the loan-stage required list in `b2cEvFormValidation.ts`, with sane bounds (e.g. 0 < rate ≤ 60, 0 ≤ PF% < 100).
   - Backend: `loan.interestRate` is already required; add matching bounds if desired. Keep both in sync (the backend file explicitly says it "mirrors" the frontend).

6. **Rehydrate defaults.** `formDataToFrozenValues` already falls back to `INTEREST_RATE` when `loan.interestRate` is missing — keep that so old drafts still open.

7. **KAM edit (optional).** If rate/PF edits must recompute EMI/disbursal, wire `B2cEvKamEditModal` through the engine on save; otherwise document that KAM edits are manual overrides.

8. **Leave untouched:** `EmiRangeCalculator.tsx` (`/calculator`), all math in `loanCalculator.ts` (EMI, `resolveB2cLoanAmount`, GST helpers, invoice breakdown logic).

---

## 10. Gotchas checklist

- [ ] `freezeB2cLoanPreview` **overwrites** interest rate to 35 — fix or bypass (step 3).
- [ ] In `wizardGrossUp`, **PF% does not change the loan amount** — only PF₹ and disbursal. Confirm expected product behavior.
- [ ] Backend requires `loan.interestRate` but the frontend form never surfaced it — don't break this invariant; always keep the key populated.
- [ ] `syncB2cEvComputedFields` recomputes `disbursalAmount = amount − processingFee` — make sure the frozen `processingFee` reflects the dynamic PF% so this stays consistent.
- [ ] Only tenure **12 / 18** is valid; GPS charges are tenure-tiered.
- [ ] `requested_loan_amount` (top-level + `requestedLoanAmount` Prisma column) is promoted from `loan.amount` — unaffected by rate/PF, but re-verify after changes.
- [ ] `docs/loan-details-calculator-logic.md` is **stale** (old fn names / old formula). Update or annotate it if you touch related docs.
- [ ] Two loan-amount formulas exist (`× 1.09` vs `/(1−fee)`); the wizard and the range page intentionally differ. Don't "unify" them without product sign-off.

---

## 11. Acceptance criteria / test checklist

Functional:
- [ ] Changing Interest Rate in the wizard updates the live EMI (and only EMI, in `wizardGrossUp`).
- [ ] Changing PF% updates PF₹ and Disbursal live.
- [ ] After **Freeze**, `form_data["loan.interestRate"]` equals the entered rate (not 35), and `loan.processingFee` matches PF% × loan amount.
- [ ] Reopening the saved draft restores the entered rate (and PF% if persisted).
- [ ] Submission passes **both** frontend and backend validation with the dynamic values.
- [ ] `/calculator` range page behavior is unchanged.

Regression / tests to run & extend:
- `src/lib/__tests__/loanCalculator.test.ts`
- `src/components/applications/__tests__/LoanCalculator.test.tsx`
- `src/components/applications/__tests__/B2CEvApplicationWizard.test.tsx`

Verify no math changed in `loanCalculator.ts` by keeping existing engine unit tests green.

---

## 12. Glossary

- **PF / Processing Fee** — fee charged on the loan; `processingFee = loanAmount × PF%`.
- **Interest Rate** — annual reducing-balance rate used in the EMI formula.
- **Tax invoice value** — vehicle price incl. GST + IOT + insurance + registration + accessories.
- **Assumed disbursement** — tax invoice value − customer payment.
- **Loan amount (principal)** — grossed-up disbursement (`× 1.09` in wizard).
- **Disbursal amount** — `loanAmount − processingFee` (net to dealer).
- **Freeze** — snapshotting calculator outputs into `form_data`.
- **`form_data`** — flat key/value JSON that is the persisted source of truth (mirrored to Airtable via n8n).
- **`LoanFrozenValues`** — typed shape of a frozen snapshot (`loanCalculator.ts:62-76`).
