# Troubleshooting Localhost Issues

## Quick Checks

### 1. Verify Servers Are Running
```bash
# Check frontend (port 5000)
lsof -i:5000

# Check backend (port 3000)
lsof -i:3000
```

### 2. Test Server Responses
```bash
# Test frontend
curl http://localhost:5000

# Test backend
curl http://localhost:3000/health
```

### 3. Restart Servers

**Frontend:**
```bash
cd /Users/rahulgonsalves/Downloads/7\ git/Seven-Dashboard
npm run dev
```

**Backend:**
```bash
cd /Users/rahulgonsalves/Downloads/7\ git/Seven-Dashboard/backend
npm run dev
```

## Common Issues

### Issue: "This site can't be reached" or "Connection refused"
**Solution:** Servers are not running. Start them using the commands above.

### Issue: "403 Forbidden" or "401 Unauthorized"
**Solution:** 
1. Clear browser localStorage (DevTools → Application → Local Storage → Clear)
2. Go to http://localhost:5000/login
3. Login with test credentials

### Issue: Page loads but shows blank/error
**Solution:**
1. Open browser DevTools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab for failed requests
4. Look for CORS errors

### Issue: "Authentication service temporarily unavailable" on login

**Which login are you using?**
- **Username + Passcode** (lms.sevenfincorp.com, Login.tsx) → **POST /auth/validate** → n8n **POST /webhook/validate**
- **Email + Password** (e.g. API or a different form) → **POST /auth/login** → n8n **GET /webhook/useraccount**

**Common causes:** The n8n webhook returned **empty** or **non‑JSON** (e.g. HTML error page), the workflow is **inactive**, **N8N_BASE_URL** is wrong, or n8n/Airtable is down (5xx).

**What to do:**

1. **Check backend logs** when you try to log in:
   - **Validate flow** (Username/Passcode): look for `VALIDATE: Webhook returned empty body` or `VALIDATE: Webhook response is not valid JSON` or `VALIDATE: Body looks like HTML`. Logs include `validateUrl` and `responseStatus`.
   - **Login flow** (Email/Password): look for `[AuthService] ❌` (Empty body, Body looks like HTML, Webhook returned status 4xx/5xx).

2. **Test the correct webhook:**
   - **Validate (Username/Passcode):**
     ```bash
     curl -s -w "\nstatus=%{http_code}" -X POST "YOUR_N8N_BASE_URL/webhook/validate" \
       -H "Content-Type: application/json" -d '{"username":"Sagar@gmail.com","passcode":"pass@123"}'
     ```
     For **Rahul@gmail.com** / **pass@123**:
     ```bash
     curl -s -w "\nstatus=%{http_code}" -X POST "YOUR_N8N_BASE_URL/webhook/validate" \
       -H "Content-Type: application/json" -d '{"username":"Rahul@gmail.com","passcode":"pass@123"}'
     ```
     Expect `status=200` and JSON (e.g. `[{ "output": { "username": "...", "role": "..." } }]` or `{ "success": true, "user": {...} }`). If you get **empty**, **HTML**, or **404**, the `/webhook/validate` workflow may be inactive, the user may not exist in **User Accounts** (Airtable), or the workflow returns nothing when the user is not found.
   - **Useraccount (Email/Password):**
     ```bash
     curl -s -w "\nstatus=%{http_code}" "YOUR_N8N_BASE_URL/webhook/useraccount"
     ```
     Expect `status=200` and a JSON array of user records.

3. **Env:** Set `N8N_BASE_URL` (e.g. `https://your-instance.app.n8n.cloud`) with **no** trailing slash. For login, optional: `N8N_GET_USER_ACCOUNTS_URL`. For validate, the URL is always `N8N_BASE_URL/webhook/validate`.

4. **Local dev without n8n (Email/Password only):** Set `E2E_USE_MOCK_USER_ACCOUNTS=1` and use **Sagar@gmail.com** / **pass@123**. The Username/Passcode (validate) flow has no mock; it always calls n8n.

5. **Rahul@gmail.com (or other usernames) returns "temporarily unavailable":** The n8n `/webhook/validate` workflow looks up **User Accounts** in Airtable by **Username** and **Password**. If the user does not exist, or the workflow returns **empty** or **HTML**, you get this error. **Fix:**  
   - **Option A:** Add the user to **User Accounts** in Airtable: `Username` = `Rahul@gmail.com`, `Password` = `pass@123`, `Role` = your role (e.g. `credit_team`), `Account Status` = `Active`. Ensure the n8n validate workflow is **active** and queries this table.  
   - **Option B:** Run `node backend/scripts/create-test-users.js` (after adding your user to the `testUsers` array in that script). That calls the `/webhook/adduser` n8n webhook to create the account.  
   - Then test with the curl command in step 2; if it returns 200 and JSON, login from the app should work.

### Issue: API calls failing
**Solution:**
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check browser console for API errors
3. Verify `.env` file has `VITE_API_BASE_URL=http://localhost:3000`

## Browser-Specific Fixes

### Chrome/Edge:
1. Clear cache: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
2. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
3. Disable cache in DevTools (Network tab → Disable cache)

### Firefox:
1. Clear cache: Ctrl+Shift+Delete
2. Hard refresh: Ctrl+F5
3. Try in Private Window

### Safari:
1. Clear cache: Cmd+Option+E
2. Hard refresh: Cmd+Option+R
3. Enable Develop menu in Preferences

## Test Credentials

For tests always use: **Sagar@gmail.com** / **pass@123**

## URLs

- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:3000
- **Login:** http://localhost:5000/login
- **Dashboard:** http://localhost:5000/dashboard

