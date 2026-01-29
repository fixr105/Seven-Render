# Login Fix - Quick Reference Guide

## 🚨 Most Likely Fix (90% of cases)

**Set `N8N_BASE_URL` environment variable in your backend:**

```
N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
```

**Then REDEPLOY your backend** (environment variables require redeploy!)

## 📋 Quick Checklist

1. [ ] Check backend logs for specific error
2. [ ] Verify `N8N_BASE_URL` is set in backend environment
3. [ ] If missing/incorrect: Add/Update and **redeploy**
4. [ ] Check n8n workflow is Active
5. [ ] Test login again

## 🔍 What to Check in Backend Logs

**✅ Success**:
```
[AuthService] Fetching from: https://fixrrahul.app.n8n.cloud/webhook/useraccount
[AuthService] ✅ JSON parsed successfully. Response type: array, Length: 11
```

**❌ Common Errors**:

| Error Message | Solution |
|--------------|----------|
| `N8N_BASE_URL environment variable is required` | Set `N8N_BASE_URL` and redeploy |
| `Response looks like HTML` | Check n8n workflow is active |
| `Webhook response is not valid JSON` | Check n8n workflow response format |
| `Request timed out` | Check network or increase timeout |
| `ECONNREFUSED` | Check network connectivity |

## 🛠️ How to Set Environment Variable

### Render
1. Dashboard → Your Service → Environment
2. Add: `N8N_BASE_URL` = `https://fixrrahul.app.n8n.cloud`
3. **Save and Redeploy**

### Fly.io
```bash
fly secrets set N8N_BASE_URL=https://fixrrahul.app.n8n.cloud
fly deploy
```

### Vercel
1. Project Settings → Environment Variables
2. Add: `N8N_BASE_URL` = `https://fixrrahul.app.n8n.cloud`
3. **Redeploy**

## 📖 Full Plan

See `LOGIN_ISSUE_RESOLUTION_PLAN.md` for comprehensive details.

## ✅ Verification

After fixing, test login and check:
- [ ] Login succeeds
- [ ] Profile IDs are returned (kamId, clientId, etc.)
- [ ] No error messages
- [ ] Backend logs show success

---

**Remember**: Environment variables require a **redeploy** to take effect!
