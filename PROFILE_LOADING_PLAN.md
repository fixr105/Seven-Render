# Profile Loading Verification Plan

## Goal
Ensure only the logged-in user's profile and subsections load properly based on their role-specific ID (clientId, kamId, nbfcId, or creditTeamId).

## Verification Checklist

### ✅ Backend JWT Token
- [x] verifyToken extracts all IDs (clientId, kamId, nbfcId, creditTeamId)
- [x] JWT payload includes all IDs

### ✅ Backend Data Filtering
- [x] RBAC filter service checks for IDs
- [x] Controllers use rbacFilterService
- [ ] Verify ALL endpoints use filtering
- [ ] Check dashboard endpoints
- [ ] Verify credit team ID handling

### ✅ Frontend Data Fetching
- [x] useApplications uses API service
- [x] API service sends JWT token
- [ ] Verify all hooks use correct user context
- [ ] Check dashboard components

### ⚠️ Potential Issues
1. Some endpoints may not use rbacFilterService
2. Frontend may cache old data
3. Credit team ID may not be checked in all filters

## Execution Steps
1. Verify all loan endpoints use rbacFilterService
2. Check dashboard endpoints filter correctly
3. Verify credit team filtering
4. Check frontend hooks use user context
5. Test end-to-end
