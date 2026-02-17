# Action Plan: n8n + Airtable for New Form Config

This plan sets up the **Form Link** and **Record Titles** tables and n8n GET webhooks so the backend can serve form config (one "Documents" category with record titles + 3 checkboxes).

---

## 1. Airtable

### 1.1 Form Link table

- **Create a base or use an existing one** where the app’s n8n workflows read from.
- **Create a table** (name can be anything; you’ll point n8n to it). Recommended name: **Form Link**.
- **Add these columns** (backend reads these names; use Single line text unless noted):

  | Column name   | Type   | Required | Notes |
  |---------------|--------|----------|--------|
  | Client ID     | Text   | Yes      | Must match client IDs used in the app (e.g. Airtable record id or your internal id). |
  | Form link     | URL/Text | No    | Optional; e.g. public form URL for this client/product. |
  | Product ID    | Text   | No       | If empty, row applies to “any product” for that client. If set, only that product uses this row. |
  | Mapping ID    | Text   | Yes      | Links this row to Record Titles (same value in Record Titles = same document list). |

- **Data rules:**
  - At least one row per client (Client ID unique per “default” row if Product ID is empty).
  - For product-specific forms: one row per client + product with same Client ID and different Product ID; each has its own Mapping ID.
  - Backend resolves: first row with matching Client ID + Product ID; if none, row with Client ID and empty Product ID.

- **Example rows:**

  | Client ID   | Form link                    | Product ID | Mapping ID |
  |------------|------------------------------|------------|------------|
  | recClient1 | https://app.com/form/recXXX  |            | M1         |
  | recClient1 | https://app.com/form/recYYY  | recProdA   | M2         |

### 1.2 Record Titles table

- **In the same (or linked) base**, create a table. Recommended name: **Record Titles**.
- **Add these columns:**

  | Column name   | Type   | Required | Notes |
  |---------------|--------|----------|--------|
  | Mapping ID    | Text   | Yes      | Must match a Mapping ID from Form Link. |
  | Record Title  | Text   | Yes      | Label shown in the form (e.g. "PAN Card", "Aadhaar", "Bank Statement"). |
  | Display Order | Number | No       | Sort order (ascending). If missing, backend uses 0. |
  | Is Required   | Checkbox / Text | No | If true or "True", field is mandatory. Optional: use "Is Mandatory" as alias. |

- **Optional:** A column for a unique id (e.g. Airtable record id) can be used as `fieldId`; otherwise backend generates `doc-0`, `doc-1`, etc.
- **Data rules:**
  - Multiple rows per Mapping ID = one document row per record title in the form.
  - Same Mapping ID can be used by multiple Form Link rows (e.g. same document list for several clients).

- **Example rows (Mapping ID = M1):**

  | Mapping ID | Record Title   | Display Order | Is Required |
  |------------|----------------|---------------|-------------|
  | M1         | PAN Card       | 1             | ✓           |
  | M1         | Aadhaar Card   | 2             | ✓           |
  | M1         | Bank Statement | 3             |             |

---

## 2. n8n

### 2.1 Base URL

- Backend uses `N8N_BASE_URL` (e.g. `https://fixrrahul.app.n8n.cloud`). All webhook URLs are: `{N8N_BASE_URL}/webhook/{path}`.

### 2.2 GET webhook: Form Link table

- **Path the backend calls:** `formlink`  
  - Full URL: `https://fixrrahul.app.n8n.cloud/webhook/formlink`
- **Workflow:**
  1. **Webhook** node: trigger = Webhook; HTTP Method = GET; path = `formlink`.
  2. **Airtable** node: operation = “List” (or “Search” if you add filters); select the **Form Link** base and **Form Link** table.
  3. Return the **full list of rows** (all columns above). Backend does filtering by Client ID and Product ID in code.
  4. Respond with JSON: array of rows, each row as an object with keys matching column names (e.g. `Client ID`, `Form link`, `Product ID`, `Mapping ID`). If Airtable returns different names, add a “Set” or “Edit Fields” node to map to these names.

- **Response shape (minimum):**  
  `[ { "Client ID": "...", "Form link": "...", "Product ID": "...", "Mapping ID": "..." }, ... ]`

### 2.3 GET webhook: Record Titles table

- **Path the backend calls:** `Recordtitle`  
  - Full URL: `https://fixrrahul.app.n8n.cloud/webhook/Recordtitle`
- **Workflow:**
  1. **Webhook** node: trigger = Webhook; HTTP Method = GET; path = `Recordtitle`.
  2. **Airtable** node: operation = “List”; select the **Record Titles** base and **Record Titles** table.
  3. Return the **full list of rows**. Backend filters by Mapping ID and sorts by Display Order.
  4. Respond with JSON: array of objects with at least `Mapping ID`, `Record Title`, `Display Order`, and optionally `Is Required` (or `Is Mandatory`) and `id` (or `Field ID` / `fieldId`).

- **Response shape (minimum):**  
  `[ { "Mapping ID": "...", "Record Title": "...", "Display Order": 1, "Is Required": true/false }, ... ]`

### 2.4 Optional: env overrides

- Backend can override URLs with:
  - `N8N_GET_FORM_LINK_URL` → full URL for Form Link (e.g. different path or host).
  - `N8N_GET_RECORD_TITLES_URL` → full URL for Record Titles.
- If these are set, n8n paths don’t need to be exactly `formlink` / `recordtitles`, as long as the response shapes above are returned.

### 2.5 Activate and test

- Activate both workflows.
- In a browser or Postman:
  - `GET https://fixrrahul.app.n8n.cloud/webhook/formlink` → should return an array of Form Link rows.
  - `GET https://fixrrahul.app.n8n.cloud/webhook/Recordtitle` → should return an array of Record Titles rows.
- Then in the app: open form config for a client (and optionally product) that has a Form Link row and matching Record Titles; you should see one “Documents” card with one row per record title and 3 checkboxes each.

---

## 3. Checklist

| Step | Task |
|------|------|
| 1 | Create **Form Link** table in Airtable with columns: Client ID, Form link, Product ID, Mapping ID. |
| 2 | Create **Record Titles** table in Airtable with columns: Mapping ID, Record Title, Display Order, Is Required (optional). |
| 3 | Add at least one Form Link row (Client ID + Mapping ID) and several Record Titles rows for that Mapping ID. |
| 4 | In n8n, create GET webhook workflow for **Form Link** (path `formlink`), read table, return JSON array. |
| 5 | In n8n, create GET webhook workflow for **Record Titles** (path `recordtitles`), read table, return JSON array. |
| 6 | Activate workflows and test both GET URLs; then test form config in the app. |

---

## 4. CSV template

Use `docs/airtable-form-links-template.csv` as a reference for Form Link column headers and one example row when populating Airtable or importing data.
