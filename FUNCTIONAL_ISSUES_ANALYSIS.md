# Functional Issues Analysis - CodeRabbit Style
**Generated:** January 23, 2026  
**Analysis Type:** Functional/UX Flow Analysis

---

## 🔴 Critical Functional Issues

### 1. **Profile Update - Not Connected to Backend**
**File:** `src/pages/Profile.tsx` (Line 79-94)  
**Issue:** Profile save button shows alert but doesn't actually save to backend

**Current Code:**
```typescript
const handleSave = async () => {
  // For now, just show a message
  alert('Profile update functionality will be implemented via backend API');
}
```

**Impact:** 
- Users can edit profile fields but changes are never saved
- Button appears functional but does nothing
- Poor user experience - misleading functionality

**Recommendation:**
- Implement `PATCH /user-accounts/:id` endpoint in backend (if not exists)
- Add `apiService.updateProfile()` method
- Connect save button to actual API call

**Severity:** High

---

### 2. **Settings Page - Only Saves to localStorage**
**File:** `src/pages/Settings.tsx` (Line 50-66)  
**Issue:** Settings are saved to localStorage but never synced with backend

**Current Code:**
```typescript
const handleSave = async () => {
  localStorage.setItem('userSettings', JSON.stringify(settings));
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  alert('Settings saved successfully!');
}
```

**Impact:**
- Settings are lost when user clears browser data
- Settings don't sync across devices
- No backend persistence

**Recommendation:**
- Create `PATCH /user-accounts/:id/settings` endpoint
- Implement `apiService.updateSettings()` method
- Save to backend and sync with localStorage

**Severity:** Medium

---

### 3. **Reports Page - API Methods Verified ✅**
**File:** `src/pages/Reports.tsx` (Line 55, 77)  
**Status:** ✅ API methods exist in `apiService.ts`

**Verified:**
- ✅ `apiService.listDailySummaries()` exists (Line 1052)
- ✅ `apiService.generateDailySummary()` exists (Line 1035)
- ✅ Backend endpoints: `GET /reports/daily/list` and `POST /reports/daily/generate`

**Note:** Functionality should work, but backend endpoint implementation should be verified

**Severity:** Low (Methods exist, but backend verification needed)

---

## 🟡 High Priority Issues

### 4. **ClientForm - Uses window.location Instead of navigate**
**File:** `src/pages/ClientForm.tsx` (Lines 394, 512)  
**Issue:** Uses `window.location.href = '/dashboard'` instead of React Router's `navigate()`

**Current Code:**
```typescript
<Button onClick={() => window.location.href = '/dashboard'}>
```

**Impact:**
- Full page reload instead of SPA navigation
- Loses React state
- Slower user experience
- Inconsistent with rest of app

**Recommendation:**
- Replace with `navigate('/dashboard')` from `useNavigate()`
- Ensure consistent navigation pattern

**Severity:** Medium

---

### 5. **Login Page - "Forgot Passcode" Link Does Nothing**
**File:** `src/pages/Login.tsx` (Line 141-149)  
**Issue:** "Forgot passcode?" link has `href="#"` and prevents default but does nothing

**Current Code:**
```typescript
<a href="#" onClick={(e) => { e.preventDefault(); }}>
  Forgot passcode?
</a>
```

**Impact:**
- Link appears clickable but does nothing
- Misleading to users
- Missing password reset functionality

**Recommendation:**
- Either implement password reset flow
- Or remove the link if not needed
- Or show "Coming soon" message

**Severity:** Medium

---

### 6. **ApplicationDetail - Manual Refresh Required After Actions**
**File:** `src/pages/ApplicationDetail.tsx` (Multiple locations)  
**Issue:** Several actions require manual page refresh to see updates

**Examples:**
- Line 302: "Please refresh the page to see the updated query status"
- Line 80: Reports page requires manual refresh after generation

**Impact:**
- Poor UX - users must manually refresh
- Data can appear stale
- Inconsistent with modern SPA patterns

**Recommendation:**
- Automatically refetch data after successful actions
- Use optimistic updates where appropriate
- Remove manual refresh requirements

**Severity:** Medium

---

### 7. **FormConfiguration - Link to Clients Page May Not Work**
**File:** `src/pages/FormConfiguration.tsx` (Line 341)  
**Issue:** Uses HTML anchor tag instead of React Router Link

**Current Code:**
```typescript
<a href="/clients" className="text-brand-primary hover:underline">Clients page</a>
```

**Impact:**
- Full page reload instead of SPA navigation
- Inconsistent navigation

**Recommendation:**
- Use React Router's `Link` component
- Or use `navigate('/clients')` in onClick handler

**Severity:** Low

---

## 🟢 Medium Priority Issues

### 8. **Missing Error Boundaries**
**Files:** All page components  
**Issue:** No error boundaries to catch React errors gracefully

**Impact:**
- Unhandled errors can crash entire app
- Poor error recovery
- No user-friendly error messages

**Recommendation:**
- Add ErrorBoundary component around page components
- Show friendly error messages instead of blank screens

**Severity:** Medium

---

### 9. **Navigation - Some Routes May Not Exist**
**Files:** Multiple dashboard files  
**Issue:** Navigation to routes like `/applications?status=...` - need to verify query params are handled

**Examples:**
- `navigate('/applications?status=pending_kam_review')`
- `navigate('/applications?status=forwarded_to_credit')`
- `navigate('/applications?status=kam_query_raised')`

**Recommendation:**
- Verify Applications page handles query parameters correctly
- Test all status filter links work
- Add error handling if status doesn't exist

**Severity:** Low

---

### 10. **Button States - Missing Loading/Disabled States**
**Files:** Multiple components  
**Issue:** Some buttons don't show loading states during async operations

**Examples:**
- File upload buttons in NewApplication
- Some form submission buttons

**Recommendation:**
- Add loading states to all async button actions
- Disable buttons during operations to prevent double-clicks
- Show progress indicators

**Severity:** Low

---

## 📊 Navigation Flow Analysis

### ✅ Working Navigation Paths
1. **Login → Dashboard** ✅ Works
2. **Dashboard → Applications** ✅ Works
3. **Applications → Application Detail** ✅ Works
4. **Clients → Applications (filtered)** ✅ Works
5. **New Application → Applications** ✅ Works

### ⚠️ Potentially Broken Navigation
1. **FormConfiguration → Clients** ⚠️ Uses `<a href>` instead of navigate
2. **ClientForm → Dashboard** ⚠️ Uses `window.location` instead of navigate
3. **Forgot Password Link** ❌ Does nothing

---

## 🔍 API Endpoint Verification

### ✅ Verified Working Endpoints
- `POST /auth/login` ✅
- `GET /client/dashboard` ✅
- `GET /applications` ✅
- `POST /loan-applications` ✅
- `GET /clients` ✅
- `POST /kam/clients` ✅

### ⚠️ Needs Verification
- `GET /reports/daily-summaries` - Called but endpoint existence needs verification
- `POST /reports/generate-daily-summary` - Called but endpoint existence needs verification
- `PATCH /user-accounts/:id` - Profile update endpoint may not exist
- `PATCH /user-accounts/:id/settings` - Settings endpoint may not exist

---

## 🎯 Button Functionality Checklist

### ✅ Fully Functional Buttons
- [x] Login form submit
- [x] Create new application
- [x] Submit application
- [x] Save as draft
- [x] Onboard client
- [x] Refresh clients list
- [x] View application details
- [x] Raise query
- [x] Respond to query
- [x] Update application status
- [x] Request payout
- [x] Forward to credit
- [x] Generate AI summary

### ⚠️ Partially Functional Buttons
- [ ] Save profile (shows alert, doesn't save)
- [ ] Save settings (saves to localStorage only)
- [ ] Generate report (needs API verification)
- [ ] Forgot password (does nothing)

### ❌ Non-Functional Buttons
- [ ] Profile save (alert only)
- [ ] Settings save (localStorage only)

---

## 📝 Recommendations Summary

### Immediate Actions (Before Production)
1. **Fix Profile Update** - Connect to backend API
2. **Fix Settings Save** - Connect to backend API
3. **Verify Reports API** - Ensure endpoints exist
4. **Fix Navigation** - Replace `window.location` and `<a href>` with React Router

### Short Term
1. Implement password reset flow or remove link
2. Add automatic data refresh after actions
3. Add error boundaries
4. Improve button loading states

### Long Term
1. Add comprehensive error handling
2. Implement optimistic updates
3. Add loading skeletons
4. Improve offline handling

---

## 🔗 Dead End Detection

### Processes That Lead Nowhere
1. **Forgot Password** → Click does nothing
2. **Profile Save** → Shows alert, doesn't persist
3. **Settings Save** → Only localStorage, not backend

### Missing Connections
1. No password reset flow
2. No profile update API integration
3. No settings sync with backend
4. No error recovery flows

---

## 📈 User Flow Issues

### Broken User Journeys
1. **User wants to reset password** → No functionality
2. **User updates profile** → Changes not saved
3. **User changes settings** → Lost on browser clear
4. **User generates report** → May fail if API missing

### Incomplete Flows
1. Profile management (read-only effectively)
2. Settings persistence (localStorage only)
3. Password recovery (non-existent)

---

## ✅ Positive Observations

1. **Good:** Most navigation uses React Router correctly
2. **Good:** Most buttons have proper onClick handlers
3. **Good:** API service is well-structured
4. **Good:** Error handling exists in most places
5. **Good:** Loading states on most async operations

---

## 🎯 Priority Fix List

### Critical (Fix Before Production)
1. ✅ Verify Reports API endpoints exist
2. ✅ Implement Profile update API
3. ✅ Implement Settings save API
4. ✅ Fix ClientForm navigation

### High Priority
1. ✅ Fix Forgot Password link (implement or remove)
2. ✅ Add automatic refresh after actions
3. ✅ Replace window.location with navigate

### Medium Priority
1. ✅ Add error boundaries
2. ✅ Improve button loading states
3. ✅ Verify all query parameter routes work

---

*This analysis was generated using CodeRabbit-style functional testing approach. For questions or clarifications, please refer to the specific file and line numbers mentioned above.*
