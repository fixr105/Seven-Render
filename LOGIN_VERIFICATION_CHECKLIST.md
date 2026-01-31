# Login Verification Checklist

Use this checklist to verify each layer of the login flow when debugging failures. See the **Login Failure Diagnostic Plan** for full detail.

## Minimal verification checklist

1. **Backend**
   - `N8N_BASE_URL` and `JWT_SECRET` set (e.g. in `backend/.env` or deployment env).
   - `curl http://localhost:3001/health` returns 200 (root `/health`; `/api/health` may require auth).

2. **Frontend**
   - Either use **proxy** (leave `VITE_API_BASE_URL` unset, use `http://localhost:3000`) **or** set `CORS_ORIGIN` to include the frontend origin (e.g. `http://localhost:3000`) when using an explicit API URL.

3. **n8n**
   - **GET /webhook/useraccount** workflow is **active**, path exactly `useraccount`, returns a JSON array of User Accounts records.

4. **Airtable User Accounts**
   - Test user (e.g. **Sagar@gmail.com**) exists. (`verify:login` fails with 401 if not.)
   - **Username** = that email (no extra spaces).
   - **Account Status** = `Active`.
   - **Password** = `pass@123` (plaintext) or stored bcrypt equivalent.
   - **Role** = one of `client`, `kam`, `Credit Team`, `KAM`, `credit_team`, `nbfc`, etc. (see auth service `roleMap`).

5. **Login form**
   - Use **Sagar@gmail.com** / **pass@123**.
   - Inspect DevTools → Network for `POST .../auth/validate` and backend logs.

---

## Run the verification script

Start the backend first (e.g. `cd backend && npm run dev`), then from the `backend` directory:

```bash
cd backend
npm run verify:login
```

Or with env overrides:

```bash
API_BASE_URL=http://localhost:3001/api N8N_BASE_URL=https://fixrrahul.app.n8n.cloud \
  E2E_CLIENT_USERNAME=Sagar@gmail.com E2E_CLIENT_PASSWORD=pass@123 \
  npx tsx scripts/verify-login-flow.ts
```

The script checks:

1. **GET /health** (root) → backend reachable.
2. **GET {N8N_BASE_URL}/webhook/useraccount** → 200, JSON array, records with `id` and user data.
3. **POST /api/auth/validate** with `{ username, passcode }` → 200, `data.token`, `data.user`.

---

## Backend log prefixes

When reproducing a failing login, capture backend logs and look for:

| Prefix | Meaning |
|--------|---------|
| `[AuthController] VALIDATE_REQUEST_STARTED` | Validate request received. |
| `[AuthController] VALIDATE_INPUT_VALIDATION_*` | Username/passcode validation. |
| `[AuthController] VALIDATE_SUCCESS` | Login succeeded. |
| `[AuthController] VALIDATE_ERROR` | Login failed. |
| `[AuthService]` | Useraccount fetch, user lookup, status check, password check, role normalization. |

Map failures to:

- **Webhook fetch** (timeout, non-JSON, non-array, empty) → fix n8n **useraccount** workflow and Airtable.
- **User not found** → fix **Username** / **Account Status** / **Role** in User Accounts.
- **Password mismatch** → fix **Password** (plaintext vs bcrypt, trimming, typo).
- **Account not active** → set **Account Status** to **Active**.

---

## Airtable User Accounts checks

- **Username**: Must match what you type (usually email). Case-insensitive match.
- **Account Status**: Must be `Active` (case-insensitive). Any other value blocks login.
- **Password**: Plaintext exact match or bcrypt (`$2a$`, `$2b$`, `$2y$`). No leading/trailing spaces.
- **Role**: Must normalize to `client`, `kam`, `credit_team`, or `nbfc` (e.g. `KAM`, `Credit Team`, `DSA Client` map via `roleMap`).

---

## Login flow summary

Login uses **POST /auth/validate** (username + passcode) → **authService.login** → **GET /webhook/useraccount** only. The n8n **/webhook/validate** workflow is **not** used for login.
