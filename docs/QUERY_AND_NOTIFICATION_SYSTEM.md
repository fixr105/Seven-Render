# Query and Notification System Analysis

## 1. How Credit Queries Are Handled

### Backend Flow (Credit → KAM)

**Endpoint:** `POST /api/credit/loan-applications/:id/queries`

**Controller:** `credit.controller.ts` → `raiseQuery()`

**Process:**
1. **Status Update**: Application status changes to `CREDIT_QUERY_WITH_KAM`
   - Updates via `n8nClient.postLoanApplication()` → `/webhook/loanapplications` → Airtable

2. **Query Creation**: Uses `queryService.createQuery()`
   - Creates entry in **File Auditing Log** via `/webhook/Fileauditinglog`
   - Entry includes:
     - File ID
     - Actor (credit team email)
     - Action Type: `credit_query`
     - Target User/Role: `kam`
     - Message (combines message, requestedDocs, clarifications)
     - Resolved: `False`

3. **Notification Creation**: `notificationService.notifyQueryCreated()`
   - Finds KAM user from client's `Assigned KAM` field
   - Creates notification in **Notifications** table via `/webhook/notification`
   - Sends email via SendGrid (if configured)
   - Notification includes:
     - Type: `query_created`
     - Title: "New Query on Application {fileId}"
     - Message: "{raisedBy} raised a query: {queryMessage}"
     - Channel: `both` (in-app + email)
     - Action Link: `/applications/{fileId}`

### Frontend Flow

**Component:** `ApplicationDetail.tsx` → `handleRaiseQuery()`

**Process:**
1. User (Credit team) enters query message
2. Calls `apiService.raiseQueryToKAM(id, queryMessage)`
3. On success:
   - Closes query modal
   - Refreshes queries list (`fetchQueries()`)
   - Application status updates to show "Credit Query with KAM"

---

## 2. UX Connection: Backend Updates → KAM

### ✅ **What EXISTS:**

#### A. **Notification System (Backend)**
- ✅ Notifications are created in Airtable when:
  - Credit raises query → KAM gets notification
  - Application status changes
  - Application is forwarded to credit
  - Query replies are made

#### B. **Notification Display (Frontend)**
- ✅ **TopBar** shows notification bell icon with unread count
- ✅ **useNotifications** hook fetches notifications from API
- ✅ Notification dropdown (UI exists, but shows placeholder data)

#### C. **Application List Refresh**
- ✅ **useApplications** hook fetches applications on mount
- ✅ Manual refresh available via `refetch()` function
- ✅ Applications list updates when user navigates or manually refreshes

### ❌ **What's MISSING:**

#### 1. **Real-Time Updates**
- ❌ **No automatic polling** - Applications don't auto-refresh
- ❌ **No WebSocket/SSE** - No real-time push notifications
- ❌ **No auto-refresh interval** - User must manually refresh or navigate

#### 2. **Notification Integration**
- ❌ **Notification dropdown shows placeholder** - Not connected to real notifications API
- ❌ **No notification click handler** - Can't navigate to application from notification
- ❌ **No notification polling** - Unread count only updates on page load

#### 3. **Status Change Visibility**
- ❌ **No visual indicator** when application status changes in background
- ❌ **No toast/alert** when new queries arrive
- ❌ **No badge/indicator** on applications with new activity

---

## Recommendations

### High Priority: Connect Notifications to Frontend

1. **Implement Notification API Integration**
   ```typescript
   // In TopBar.tsx - replace placeholder with real notifications
   const { notifications, unreadCount, markAsRead } = useNotifications();
   
   // Show real notifications from API
   // Add click handler to navigate to application
   ```

2. **Add Auto-Refresh for Applications**
   ```typescript
   // In useApplications.ts
   useEffect(() => {
     const interval = setInterval(() => {
       fetchApplications();
     }, 30000); // Refresh every 30 seconds
     return () => clearInterval(interval);
   }, []);
   ```

3. **Add Notification Polling**
   ```typescript
   // In useNotifications.ts
   useEffect(() => {
     const interval = setInterval(() => {
       fetchNotifications();
     }, 15000); // Check every 15 seconds
     return () => clearInterval(interval);
   }, []);
   ```

### Medium Priority: Visual Feedback

4. **Add Toast Notifications**
   - Show toast when new query arrives
   - Show toast when application status changes
   - Use existing Toast component

5. **Add Activity Indicators**
   - Badge on applications with unread queries
   - Highlight applications with recent updates
   - Show "New" indicator on recently updated applications

### Low Priority: Real-Time (Future Enhancement)

6. **WebSocket/SSE Integration**
   - Push notifications in real-time
   - Update application list without polling
   - Better user experience for multi-user scenarios

---

## Current State Summary

| Feature | Backend | Frontend | Connected? |
|---------|---------|----------|------------|
| Credit Query Creation | ✅ | ✅ | ✅ Yes |
| Status Update (CREDIT_QUERY_WITH_KAM) | ✅ | ✅ | ✅ Yes |
| Notification Creation | ✅ | ⚠️ Partial | ⚠️ Partial |
| Notification Display | ✅ | ⚠️ Placeholder | ❌ No |
| Auto-Refresh Applications | ❌ | ❌ | ❌ No |
| Auto-Refresh Notifications | ❌ | ❌ | ❌ No |
| Real-Time Updates | ❌ | ❌ | ❌ No |

**Status:** Backend is fully functional. Frontend has the structure but needs integration and auto-refresh to fully connect backend updates to KAM users.
