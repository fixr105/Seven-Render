# n8n User Account Webhook

The backend expects the useraccount webhook at `https://<N8N_BASE_URL>/webhook/useraccount` to support **GET** for login. Optionally, **POST** can be used for single-user validation.

## GET /webhook/useraccount (required for login)

Used by the backend during `POST /auth/login` to fetch all user accounts, then find the user by email and validate password.

**Request:** `GET /webhook/useraccount` (no body)

**Response:** JSON array of Airtable-style user records. Each element must have:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Airtable record ID (e.g. `recXXX`) |
| `createdTime` | string | ISO timestamp (optional, can be `""`) |
| `fields` | object | At least `Username`, and either `Password` or `PIN`; plus `Role`, `Account Status`, `Associated Profile`, `Last Login` as needed |

**Example response shape:**

```json
[
  {
    "id": "recI4Qd3Qsvxot2Vm",
    "createdTime": "2026-01-03T08:54:11.000Z",
    "fields": {
      "Username": "sagar@sevenfincorp.email",
      "Password": "pass@123",
      "Role": "kam",
      "Account Status": "Active",
      "Associated Profile": "Sagar",
      "Last Login": "2026-01-05T13:41:47.128Z",
      "Kam_ID": "USER-1767430957573-81645wu26"
    }
  }
]
```

The backend normalizes each record and accepts either `Password` or `PIN` in `fields`. Test accounts (e.g. `test@`, `dummy@`, `example.com`) should be filtered out in the n8n workflow so the backend receives only real, active accounts.

**Workflow file:** `n8n-useraccount-webhook-GET.json` — import and activate in n8n so GET returns this array.

---

## POST /webhook/useraccount (optional)

Used for single-user lookup by credentials (e.g. validate-one-user flows).

**Request:** `POST /webhook/useraccount` with body:

```json
{
  "Username": "user@example.com",
  "Password": "pass"
}
```

Both `Username`/`username` and `Password`/`password` (and Airtable `PIN`) are supported by the workflow.

**Response:** Either a single user record (same shape as one element of the GET array) or `{ "status": "unmatched" }`.

**Workflow file:** `n8n-useraccount-webhook-UPDATED.json`
