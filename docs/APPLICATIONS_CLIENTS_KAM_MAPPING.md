# Applications → Clients → KAMs Mapping

This doc describes how **applications** are connected to **clients** and **clients** to **KAMs**, and which GET/POST endpoints provide the data.

## Data model

- **Loan Application** has a `Client` field (client ID) → links to **Client**.
- **Client** has an `Assigned KAM` field (KAM ID) → links to **KAM User**.

So: **Application** → `Client` → **Client** → `Assigned KAM` → **KAM**.

## GET endpoints that provide the mapping

| Purpose | Endpoint | Role | Returns |
|--------|----------|------|--------|
| All applications (with client id) | `GET /credit/loan-applications` | credit_team | `data[].{ id, fileId, client, applicantName, status, ... }` — `client` is the client ID |
| All applications (RBAC-filtered) | `GET /loan-applications` | any | Same shape; KAM sees only their clients’ applications |
| KAM’s applications only | `GET /kam/loan-applications` | kam | Same shape; only applications for clients where `Assigned KAM` = this KAM |
| All clients (with KAM) | `GET /credit/clients` | credit_team | `data[].{ clientId, clientName, assignedKAM, assignedKAMName, ... }` |
| KAM’s clients only | `GET /kam/clients` | kam | Clients where `Assigned KAM` = this KAM (same shape where applicable) |
| Single client | `GET /credit/clients/:id` or `GET /kam/clients/:id` | credit_team / kam | `data.assignedKAM`, `data.assignedKAMName` |
| KAM list | `GET /kam-users` | authenticated | `data[].{ id, KAM ID, Name, Email, ... }` |

## POST endpoints that create/update the links

| Link | Endpoint | Role | Effect |
|------|----------|------|--------|
| Application → Client | `POST /loan-applications` | client | Creates application with `Client` = requester’s `clientId` |
| Client → KAM | `POST /kam/clients` | kam | Creates client; KAM is implied by requester |
| Client → KAM | `PATCH /credit/clients/:id/assign-kam` (or equivalent) | credit_team | Sets `Assigned KAM` on client |

## How to derive the full mapping via API

1. **As credit_team** (to see all):
   - `GET /credit/loan-applications` → list of applications; each has `client` (client ID).
   - `GET /credit/clients` → list of clients; each has `clientId`, `clientName`, `assignedKAM`, `assignedKAMName`.
   - `GET /kam-users` → list of KAMs (id, name).
2. Join: for each application use `client` to find the client in the clients list, then use that client’s `assignedKAM` / `assignedKAMName` (and optionally resolve name via `kam-users`).

## Script (same data, no auth)

The backend script uses the same underlying data (same webhooks/tables as the GET endpoints) and prints the mapping:

```bash
cd backend && npx tsx scripts/applications-clients-kam-mapping.ts
```

JSON output:

```bash
APPLICATIONS_KAM_OUTPUT=json npx tsx scripts/applications-clients-kam-mapping.ts
```

It fetches:

- **Loan Application** (GET `/webhook/loanapplication`)
- **Clients** (GET `/webhook/client`)
- **KAM Users** (GET `/webhook/kamusers`)

and outputs one row per application: File ID, Application ID, Applicant, Status, Client ID, Client Name, KAM ID, KAM Name.

## Reassigning all applications to one client and KAM tagging

To bulk reassign every existing Loan Application to a single client (e.g. identified by contact email), use the backend script. Applications are then **directly tagged** to the KAM via the existing model: Application → Client → Assigned KAM (no "posted by" field). Ensure the target client has **Assigned KAM** set (in Airtable or via `POST /credit/clients/:id/assign-kam`) so all reassigned and future applications from that client show under that KAM.

1. Ensure the client exists in the Clients table and their **Contact Email/Phone** contains the email you will use (e.g. `anyaaa@gmail.com`), and set **Assigned KAM** for that client.
2. Dry run (no writes): `REASSIGN_DRY_RUN=true npm run reassign:applications` from `backend/`.
3. Run: `npm run reassign:applications`. Optionally set `REASSIGN_CLIENT_EMAIL` to a different email (default is `anyaaa@gmail.com`).
