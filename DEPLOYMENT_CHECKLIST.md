# Deployment Checklist - Login System Fix

## Changes to Deploy

### Backend Code Changes
- ✅ `backend/src/services/auth/auth.service.ts` - Made profile data fetching blocking
- ✅ `backend/src/controllers/auth.controller.ts` - Updated response format to include all profile IDs

### Documentation
- ✅ `LOGIN_FIX_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- ✅ `N8N_LOGIN_WORKFLOW_FIX.md` - n8n workflow update guide

## Pre-Deployment Checklist

- [x] Code changes tested locally
- [x] All profile IDs (kamId, clientId, nbfcId, creditTeamId) are fetched before JWT generation
- [x] Response format includes all profile IDs explicitly
- [x] Error handling ensures login succeeds even if profile data is missing
- [ ] **n8n workflow updated** (see `N8N_LOGIN_WORKFLOW_FIX.md`)
- [ ] **Backend deployed to production**
- [ ] **Test login with all user types after deployment**

## Deployment Steps

### 1. Commit Changes
```bash
git add backend/src/services/auth/auth.service.ts
git add backend/src/controllers/auth.controller.ts
git add LOGIN_FIX_IMPLEMENTATION_SUMMARY.md
git add N8N_LOGIN_WORKFLOW_FIX.md
git commit -m "fix: Make profile data fetching blocking for all user types

- Changed profile data fetching from non-blocking to blocking
- Ensures all profile IDs (kamId, clientId, nbfcId, creditTeamId) are available before JWT generation
- Updated login and validate endpoints to explicitly include all profile IDs
- Added comprehensive error handling (login succeeds even if profile data missing)
- Added timeout handling (5s per role table)
- Created n8n workflow update guide

Fixes: Login responses now include accurate profile IDs for all user types"
```

### 2. Push to Repository
```bash
git push origin main
```

### 3. Deploy Backend
- Deploy to your backend hosting (Render/Fly.io/etc.)
- Wait for deployment to complete
- Verify backend is running

### 4. Update n8n Workflow (Required)
- Follow instructions in `N8N_LOGIN_WORKFLOW_FIX.md`
- Update AI Agent prompt
- Update Structured Output Parser schema
- Verify Respond to Webhook node configuration
- Activate workflow

### 5. Post-Deployment Testing
Test login with:
- [ ] KAM user (should return kamId)
- [ ] Client user (should return clientId)
- [ ] Credit Team user (should return creditTeamId)
- [ ] NBFC user (should return nbfcId)
- [ ] Invalid credentials (should return error)

## Rollback Plan

If issues occur:
1. Revert the commit: `git revert <commit-hash>`
2. Push and redeploy
3. Check logs for errors

## Important Notes

- **Profile data fetching is now blocking** - login may take slightly longer (max 5s per role table)
- **Login succeeds even if profile data is missing** - profile IDs will be null
- **All responses explicitly include all profile IDs** - even if null
- **n8n workflow update is required** - see `N8N_LOGIN_WORKFLOW_FIX.md`

## Expected Behavior After Deployment

1. **Login requests** will wait for profile data before generating JWT
2. **Response JSON** will always include all profile IDs (kamId, clientId, nbfcId, creditTeamId)
3. **JWT tokens** will contain all profile IDs
4. **Frontend** will receive complete user profile data
5. **RBAC filtering** will work correctly based on profile IDs
