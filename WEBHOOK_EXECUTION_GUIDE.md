# Webhook Execution Guide

## ⚠️ IMPORTANT: Webhooks DO NOT Auto-Execute

**Webhooks are NEVER called automatically on component mount or navigation.**

Webhooks only execute when:
1. **Page is reloaded/refreshed** (F5 or browser refresh button)
2. **Refresh button is clicked** (explicit user action)

## When Webhooks Are Called

### 1. **Login Webhook** (Backend Only)
- **URL**: `https://fixrrahul.app.n8n.cloud/webhook/useraccount`
- **When**: During user login authentication
- **Who**: Backend API (`backend/src/services/auth/auth.service.ts`)
- **Purpose**: Fetch user account data to validate credentials
- **Frequency**: Once per login attempt
- **Frontend**: ❌ Frontend should NOT call this webhook directly

### 2. **Data Webhook** (Frontend - Manual Only)
- **URL**: `https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52`
- **When**: 
  - ✅ **Page reload/refresh** (F5 or browser refresh button)
  - ✅ **Refresh button clicked** (explicit user action via `refetch()`)
  - ❌ **NEVER on component mount** (normal navigation)
  - ❌ **NEVER automatically**
- **Who**: Frontend hooks (`useWebhookApplications`, `useUnifiedApplications`)
- **Purpose**: Fetch application data and other table data from n8n/Airtable
- **Frequency**: Only when explicitly requested
- **Frontend**: ✅ Frontend calls this, but ONLY on refresh/reload

## Default Data Source

**By default, pages use database data (via `useApplications` hook), NOT webhook data.**

- `useApplications()` → Fetches from database via API (no webhook)
- `useWebhookApplications()` → Fetches from webhook (only on refresh/reload)
- `useUnifiedApplications()` → Combines both (webhook only on refresh/reload)

## How Webhook Execution Works

### Page Reload Detection
The hook detects page reload using:
- `performance.getEntriesByType('navigation')[0].type === 'reload'`
- `performance.navigation.type === 1` (legacy)
- Document referrer check

### Manual Refresh
Pages have a **Refresh button** that calls `refetch()`:
```typescript
const { refetch } = useWebhookApplications();
// User clicks refresh button → refetch() → webhook executes
```

### Global State (Prevents Duplicates)
If multiple components call webhook simultaneously, they share one request:
```typescript
globalWebhookState = {
  data: LoanApplicationFromWebhook[] | null,
  loading: boolean,
  error: string | null,
  lastFetch: number | null,
  fetchPromise: Promise | null  // In-flight request
}
```

## Components That Use Webhooks

### Direct Webhook Usage
- `useWebhookApplications()` - Fetches applications from webhook
- `useUnifiedApplications()` - Combines webhook + database data

### Components Using These Hooks
- `Dashboard` → `ClientDashboard` / `KAMDashboard` / `CreditDashboard` / `NBFCDashboard`
- `Applications` page
- Any component that needs application data

## Best Practices

### ✅ DO:
- Use `useApplications()` for normal data (from database, no webhook)
- Use `useWebhookApplications()` only when you need webhook data
- Add a **Refresh button** to pages that need webhook data
- Call `refetch()` only when user explicitly clicks refresh
- Let users control when webhooks execute

### ❌ DON'T:
- ❌ **Auto-execute webhooks on component mount**
- ❌ **Auto-execute webhooks on navigation**
- ❌ Call webhook URLs directly with `fetch()`
- ❌ Set `autoSync: true` or `syncOnMount: true` (defaults are false)
- ❌ Call login webhook from frontend (backend only)

## Reducing Webhook Executions

### Current Optimizations
1. ✅ **30-second cache** - Prevents rapid successive calls
2. ✅ **Shared state** - Multiple components share one fetch
3. ✅ **Promise deduplication** - Concurrent mounts wait for same request
4. ✅ **Automatic cache invalidation** - Fresh data after 30s

### Manual Control
If you need to force a fresh fetch:
```typescript
const { refetch } = useWebhookApplications();
// Later...
await refetch(); // Forces fresh webhook call, bypasses cache
```

## Monitoring Webhook Calls

### Console Logs
The webhook hook logs:
- `"Page reload detected - fetching webhook data"` - Page reload detected
- `"Fetching webhook data from: [URL]"` - Webhook fetch started
- `"Webhook fetch already in progress, waiting for existing call..."` - Deduplication

### Expected Behavior
- **On normal navigation**: 0 webhook calls (uses database data)
- **On page reload (F5)**: 1 webhook call (if page uses webhook hook)
- **On refresh button click**: 1 webhook call (explicit user action)
- **On component mount**: 0 webhook calls (no auto-execution)

## Troubleshooting

### Too Many Webhook Calls?
1. Check if multiple components are calling `refetch()` unnecessarily
2. Verify cache duration (should be 30 seconds)
3. Check console logs for "Using cached webhook data" messages
4. Ensure you're using the hook, not direct `fetch()` calls

### Webhook Not Updating?
1. Cache might be serving stale data
2. Call `refetch()` manually to force update
3. Check if webhook URL is correct
4. Verify n8n workflow is returning data

## Summary

- **Login webhook**: Backend only, once per login
- **Data webhook**: Frontend, **ONLY on page reload or refresh button click**
- **Auto-execution**: ❌ **DISABLED** - webhooks never auto-execute
- **Default data source**: Database (via `useApplications`), not webhook
- **Manual refresh**: Use `refetch()` function when user clicks refresh button
- **Page-specific data**: Each page only fetches the data it needs when refresh is clicked

