# Client Form Mapping Webhook Data Analysis

## Summary: Is the webhook data enough to load forms?

**Yes, with caveats.** The data you shared is sufficient for forms to load in most cases, but there are gaps and data-quality issues that can cause problems.

---

## What the webhook returns (from your sample)

Each mapping record has:
- `id`, `createdTime`
- `Mapping ID`, `Client`, `Category`
- `Is Required`, `Display Order`
- `Product ID` (optional)

## Missing fields (compared to what createFormMapping sends)

| Field | Sent on POST | In your GET response | Impact |
|-------|--------------|----------------------|--------|
| **Included Field IDs** | Yes (JSON array of field IDs) | No | ClientForm falls back to all module fields. FormConfigService doesn't use it. |
| **Version** | Yes (ISO timestamp) | No | FormConfigService keeps all mappings when no Version; no "latest" filtering. |

---

## How form loading works

### 1. NewApplication (authenticated client)

- Uses `GET /client/form-config` → FormConfigService
- Needs: Client Form Mapping + Form Categories + Form Fields + Clients
- Filters mappings by: clientId, optional productId, optional version
- Gets fields from Form Fields table by Category (not from Included Field IDs)

**Result:** Works if Form Categories and Form Fields have matching records for the mapping's Category IDs.

### 2. ClientForm (public form link)

- Uses `GET /public/clients/:id/form-mappings` + `listFormCategories()`
- Matches mappings → categories by Category ID
- Uses Included Field IDs to filter fields; if missing, shows all module fields

**Result:** Works; falls back to all fields when Included Field IDs is missing.

---

## Data quality issues in your sample

### 1. `Included Field IDs` missing

- **Cause:** n8n/Airtable may not store or return this field
- **Fix:** Add `Included Field IDs` to the Client Form Mapping table in Airtable and ensure the n8n GET webhook returns it
- **Workaround:** Forms still load; all fields per module are shown instead of the configured subset

### 2. `Version` missing

- **Cause:** Older records or n8n not storing the field
- **Result:** FormConfigService uses all mappings for the client (no version filtering)
- **Risk:** Mixed configs if the client has multiple form-config saves

### 3. Category with FLD- prefix (legacy)

- Records: `rec65hNgUWVf5VO7j`, `recG3OdR95cznA7mG` have `Category: "FLD-1765189508834-1-0-ldnelyzjy"`
- FLD- is a Form Field ID format; categories use CAT-
- **Result:** Form Categories won't have these IDs; no category match → no form for these mappings

### 4. Incomplete record

- `rec7zi4Xb1ckwRSzo` has only `id` and `createdTime`
- **Result:** Filtered out (no Client) or ignored

### 5. Client ID mismatch (public form)

- URL may use `recVpVbkj1QdEfM9J` or `USER-1771248061376-1pqjvjlp0`
- **Fix applied:** `getPublicFormMappings` now resolves via the Clients table and supports both record id and Client ID

---

## Fix applied

**`getPublicFormMappings`** now supports multiple client ID formats:

- Before: `m.Client === id` (strict match on URL param)
- After: Resolves URL `id` against the Clients table and accepts both record id and Client ID
- Result: `/form/recVpVbkj1QdEfM9J` and `/form/USER-1771248061376-1pqjvjlp0` both work when the client record has both identifiers

---

## Checklist for reliable form loading

1. **Form Categories** – Must have records with `Category ID` matching each mapping's `Category` (CAT-xxx).
2. **Form Fields** – Must have records with `Category` matching those category IDs.
3. **Clients** – Client record must exist and be resolvable by `id` or `Client ID`.
4. **Enabled Modules** – Client should have `Enabled Modules` including `M2` (set by `createFormMapping`).
5. **Client ID in URL** – For public form, use either `recVpVbkj1QdEfM9J` or `USER-1771248061376-1pqjvjlp0` (both now supported).
