# Troubleshooting 401 Errors

## What You're Seeing

- `seven-dash.fly.dev/api/auth/login` → **401**
- `seven-dash.fly.dev/api/loan-applications` → **401**
- `seven-dash.fly.dev/api/kam/dashboard` → **401**
- `seven-dash.fly.dev/api/kam/clients` → **401**
- `seven-dash.fly.dev/api/notifications` → **401**
- Frontend: "Session expired. Please login again."

---

## Two Types of 401

### 1. Login 401 (POST /api/auth/login)

**Meaning:** The backend rejected your credentials.

**Backend response:** `{ success: false, error: "Invalid email or password" }`

**Causes:**
- Wrong email or password
- User not in Airtable User Accounts
- Account Status is not "Active"
- Backend cannot reach n8n webhook (User Accounts) → returns empty list → no user found → 401

### 2. Other Endpoints 401 (loan-applications, kam/dashboard, etc.)

**Meaning:** No valid auth token was sent.

**Backend response:** `{ success: false, error: "Session expired. Please login again." }` or `"Authentication required. Please login."`

**Causes:**
- Login failed (so no token)
- Token expired
- Cookie not sent cross-origin (SameSite / third-party cookie blocking)
- Bearer token not set (e.g. page refresh clears in-memory token)

---

## Debug Steps

### Step 1: Test login with curl

```bash
curl -X POST "https://seven-dash.fly.dev/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
```

**If 200:** Credentials work. The issue is likely frontend/cookie/Bearer token.

**If 401:** Credentials rejected. Check:
- Email/password correct
- User exists in Airtable User Accounts
- Account Status = "Active"
- Backend can reach n8n (see Step 2)

### Step 2: Check Fly.io secrets

```bash
fly secrets list --app seven-dash
```

Required:
- `N8N_BASE_URL` – e.g. `https://fixrrahul.app.n8n.cloud/webhook`
- `CORS_ORIGIN` – e.g. `https://lms.sevenfincorp.com,https://seven-dashboard-seven.vercel.app`
- `JWT_SECRET` – secure random string (32+ chars)

If `N8N_BASE_URL` is wrong or n8n is unreachable from Fly.io, `getUserAccounts()` may fail or return empty → login 401.

### Step 3: Check backend logs

```bash
fly logs --app seven-dash
```

Look for:
- `[getUserAccounts] Fetch completed in Xms, status: 200` – n8n reachable
- `[getUserAccounts] User Accounts webhook failed` – n8n error
- `Login attempt for inactive account` – account not Active
- `User account missing password hash` – bad Airtable data

### Step 4: Verify CORS

```bash
curl -s -I -X OPTIONS "https://seven-dash.fly.dev/api/auth/login" \
  -H "Origin: https://lms.sevenfincorp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Expect: `Access-Control-Allow-Origin: https://lms.sevenfincorp.com`

---

## Common Fixes

### Login works in curl but not in browser

1. **CORS:** Ensure `CORS_ORIGIN` includes your frontend origin (e.g. `https://lms.sevenfincorp.com`).
2. **Third-party cookies:** Some browsers block cross-origin cookies. The app also uses Bearer token in memory; if the page refreshes before login completes, the token is lost. Try a hard refresh and log in again.

### "Session expired" on every request

- Login is failing (401), so no token is ever stored.
- Fix the login 401 first (credentials, n8n, Airtable).

### Login worked before, now 401

- Token expired (JWT default 7 days).
- User was deactivated in Airtable.
- n8n webhook URL changed or n8n is down.

---

## Quick Reference

| Symptom | Likely cause |
|--------|--------------|
| Login 401 | Wrong credentials, user not in Airtable, n8n unreachable |
| Other 401 | Login failed, no token, or token expired |
| Works in curl, fails in browser | CORS, third-party cookies, or frontend not sending token |
