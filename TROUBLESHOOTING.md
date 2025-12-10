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

- **Client:** `client@test.com` / `password123`
- **KAM:** `kam@test.com` / `password123`
- **Credit Team:** `credit@test.com` / `password123`
- **NBFC:** `nbfc@test.com` / `password123`

## URLs

- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:3000
- **Login:** http://localhost:5000/login
- **Dashboard:** http://localhost:5000/dashboard

