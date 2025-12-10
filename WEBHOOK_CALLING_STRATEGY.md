# Webhook Calling Strategy - Complete Guide

## Overview

This document explains **when** and **for what operations** webhooks are called in the system. There are two types of webhooks:

1. **GET Webhooks** - Fetch/read data from Airtable via n8n
2. **POST Webhooks** - Write/update data to Airtable via n8n

---

## 🔵 GET Webhooks (Reading Data)

### When GET Webhooks Are Called

#### 1. **User Login** (Backend Only)
**Operation**: User authentication
**Webhook**: `User Accounts` table
**When**: Every login attempt
**Location**: `backend/src/services/auth/auth.service.ts`

```typescript
// Called during login
const userAccounts = await n8nClient.getUserAccounts();
```

**Additional Role-Specific Webhooks** (after login validation):
- **KAM Users**: If user role is `kam`
- **Credit Team Users**: If user role is `credit_team`
- **NBFC Partners**: If user role is `nbfc`

**Frequency**: Once per login attempt
**Cache**: Uses cache if available (30-minute TTL)

---

#### 2. **Dashboard Data Loading** (Backend API)
**Operation**: Loading dashboard data
**Webhooks Called**: Multiple tables based on role

**KAM Dashboard** (`/kam/dashboard`):
- `User Accounts`
- `Loan Application`
- `Commission Ledger`
- `File Auditing Log`

**Client Dashboard** (`/client/dashboard`):
- `Loan Application`
- `Commission Ledger`
- `File Auditing Log`

**Credit Dashboard** (`/credit/dashboard`):
- `Loan Application`
- `File Auditing Log`

**NBFC Dashboard** (`/nbfc/dashboard`):
- `Loan Application`
- `NBFC Partners`

**When**: Every API request to dashboard endpoint
**Cache**: Uses cache if available (30-minute TTL)
**Location**: `backend/src/controllers/*.controller.ts`

---

#### 3. **Listing Data** (Backend API)
**Operation**: Fetching lists of entities

**Examples**:
- `GET /kam/clients` → Calls `Clients` webhook
- `GET /loan-applications` → Calls `Loan Application` webhook
- `GET /credit-team-users` → Calls `Credit Team Users` webhook
- `GET /form-categories` → Calls `Form Categories` webhook
- `GET /loan-products` → Calls `Loan Products` webhook

**When**: Every API request to list endpoint
**Cache**: Uses cache if available (30-minute TTL)

---

#### 4. **Frontend Manual Refresh** (User Action)
**Operation**: User clicks "Refresh" button
**Webhooks Called**: Only tables needed by the current page

**Applications Page** (`/applications`):
- `Loan Application`
- `Clients`
- `Loan Products`

**Form Configuration Page** (`/form-configuration`):
- `Client Form Mapping`
- `Form Categories`
- `Form Fields`

**When**: User explicitly clicks refresh button
**Cache**: Bypassed (force refresh)
**Location**: `src/pages/Applications.tsx`, `src/pages/FormConfiguration.tsx`

```typescript
// User clicks refresh button
const { refetch } = useUnifiedApplications();
await refetch(); // Forces fresh webhook call
```

**Important**: 
- ❌ **NO auto-execution on page load**
- ❌ **NO auto-execution on navigation**
- ✅ **ONLY on explicit user action (refresh button)**

---

### GET Webhook Cache Strategy

**Cache Duration**: 30 minutes
**Cache Location**: 
- Frontend: `src/lib/webhookFetcher.ts` (in-memory)
- Backend: `backend/src/services/airtable/cache.service.ts` (in-memory)

**Cache Invalidation**:
- Automatically invalidated after 30 minutes
- Manually invalidated after POST operations (see below)

---

## 🟢 POST Webhooks (Writing Data)

### When POST Webhooks Are Called

POST webhooks are called **immediately after** database operations to sync data to Airtable.

---

#### 1. **Loan Application Operations**

**Create Application** (`POST /loan-applications`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook (audit trail)

**Update Application** (`POST /kam/loan-applications/:id/edit`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Submit Application** (`POST /loan-applications/:id/submit`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Forward to Credit** (`POST /kam/loan-applications/:id/forward-to-credit`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Raise Query** (`POST /kam/loan-applications/:id/queries`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Mark in Negotiation** (`POST /credit/loan-applications/:id/mark-in-negotiation`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Assign NBFCs** (`POST /credit/loan-applications/:id/assign-nbfcs`):
- ✅ POST to `applications` webhook
- ✅ POST to `Admin Activity Log` webhook

**Capture NBFC Decision** (`POST /credit/loan-applications/:id/nbfc-decision`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook

**Mark Disbursed** (`POST /credit/loan-applications/:id/mark-disbursed`):
- ✅ POST to `applications` webhook
- ✅ POST to `File Auditing Log` webhook
- ✅ POST to `Commission Ledger` webhook (create ledger entry)

**Location**: `backend/src/controllers/loan.controller.ts`, `backend/src/controllers/credit.controller.ts`, `backend/src/controllers/kam.controller.ts`

---

#### 2. **Client Operations**

**Create Client** (`POST /kam/clients`):
- ✅ POST to `Clients` webhook (via `postClient`)
- ✅ POST to `User Accounts` webhook (create user account)
- ✅ POST to `Admin Activity Log` webhook

**Update Client** (`PATCH /kam/clients/:id`):
- ✅ POST to `Clients` webhook
- ✅ POST to `Admin Activity Log` webhook

**Update Client Modules** (`PATCH /kam/clients/:id/modules`):
- ✅ POST to `Clients` webhook
- ✅ POST to `Admin Activity Log` webhook

**Location**: `backend/src/controllers/kam.controller.ts`, `backend/src/controllers/client.controller.ts`

---

#### 3. **Form Configuration Operations**

**Create Form Category** (`POST /form-categories`):
- ✅ POST to `FormCategory` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Form Categories`, `Client Form Mapping`

**Update Form Category** (`PATCH /form-categories/:id`):
- ✅ POST to `FormCategory` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Form Categories`, `Client Form Mapping`

**Delete Form Category** (`DELETE /form-categories/:id`):
- ✅ POST to `FormCategory` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Form Categories`, `Client Form Mapping`

**Create Form Mapping** (`POST /kam/clients/:id/form-mappings`):
- ✅ POST to `POSTCLIENTFORMMAPPING` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Client Form Mapping`, `Form Categories`, `Form Fields`

**Location**: `backend/src/controllers/formCategory.controller.ts`, `backend/src/controllers/kam.controller.ts`

---

#### 4. **Credit Team User Operations**

**Create Credit Team User** (`POST /credit-team-users`):
- ✅ POST to `CREDITTEAMUSERS` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Credit Team Users`

**Update Credit Team User** (`PATCH /credit-team-users/:id`):
- ✅ POST to `CREDITTEAMUSERS` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Credit Team Users`

**Delete Credit Team User** (`DELETE /credit-team-users/:id`):
- ✅ POST to `CREDITTEAMUSERS` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Credit Team Users`

**Location**: `backend/src/controllers/creditTeamUsers.controller.ts`

---

#### 5. **Commission Ledger Operations**

**Create Ledger Entry** (via disbursement):
- ✅ POST to `COMISSIONLEDGER` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Commission Ledger`

**Create Payout Request** (`POST /clients/me/payout-requests`):
- ✅ POST to `COMISSIONLEDGER` webhook (update entry)
- ✅ POST to `Admin Activity Log` webhook

**Location**: `backend/src/controllers/ledger.controller.ts`, `backend/src/controllers/credit.controller.ts`

---

#### 6. **Report Operations**

**Generate Daily Summary** (`POST /reports/daily/generate`):
- ✅ POST to `DAILYSUMMARY` webhook
- ✅ POST to `Admin Activity Log` webhook
- **Cache Invalidation**: `Daily Summary Report`

**Location**: `backend/src/controllers/reports.controller.ts`

---

#### 7. **Query Operations**

**Reply to Query** (`POST /loan-applications/:id/queries/:queryId/reply`):
- ✅ POST to `File Auditing Log` webhook
- ✅ POST to `applications` webhook (update status)

**Location**: `backend/src/controllers/queries.controller.ts`

---

### POST Webhook Cache Invalidation

After every POST operation, the relevant GET webhook caches are **automatically invalidated**:

```typescript
// Example from postClientFormMapping
async postClientFormMapping(data: Record<string, any>) {
  const result = await this.postData(n8nConfig.postClientFormMappingUrl, data);
  // Invalidate cache for related tables
  this.invalidateCache('Client Form Mapping');
  this.invalidateCache('Form Categories');
  this.invalidateCache('Form Fields');
  return result;
}
```

This ensures that the next GET request fetches fresh data.

---

## 📊 Summary Table

| Operation Type | GET Webhook | POST Webhook | When Called |
|---------------|-------------|--------------|-------------|
| **Login** | ✅ User Accounts | ❌ | Every login attempt |
| **Dashboard Load** | ✅ Multiple tables | ❌ | Every API request |
| **List Data** | ✅ Specific table | ❌ | Every API request |
| **Frontend Refresh** | ✅ Needed tables | ❌ | User clicks refresh |
| **Create Entity** | ❌ | ✅ Entity webhook | After DB insert |
| **Update Entity** | ❌ | ✅ Entity webhook | After DB update |
| **Delete Entity** | ❌ | ✅ Entity webhook | After DB delete |
| **Status Change** | ❌ | ✅ Entity + Audit | After status update |

---

## 🎯 Key Principles

### 1. **GET Webhooks (Read)**
- ✅ Use cache (30-minute TTL)
- ✅ Called on API requests
- ✅ Called on user refresh (frontend)
- ❌ Never auto-execute on page load
- ❌ Never auto-execute on navigation

### 2. **POST Webhooks (Write)**
- ✅ Always called after database operations
- ✅ Immediately sync to Airtable
- ✅ Always invalidate related caches
- ✅ Always create audit log entries

### 3. **Cache Strategy**
- ✅ GET requests use cache (30 minutes)
- ✅ POST operations invalidate cache
- ✅ Force refresh bypasses cache
- ✅ Cache reduces webhook executions by ~90%

---

## 🔍 Monitoring Webhook Calls

### Development Mode
Enable logging to see webhook calls:
```bash
# Backend
LOG_WEBHOOK_CALLS=true npm run dev

# Frontend (automatic in dev mode)
# Logs show: "Fetching {table} from: {url}"
```

### Production Mode
- Logging is disabled by default
- Only errors are logged
- Use monitoring tools to track webhook execution counts

---

## 📝 Best Practices

### ✅ DO:
1. Use cache for GET requests (default behavior)
2. Invalidate cache after POST operations
3. Call POST webhooks immediately after DB operations
4. Only call GET webhooks on explicit user action (frontend)
5. Use individual table webhooks (not single GET webhook)

### ❌ DON'T:
1. Don't auto-execute webhooks on page load
2. Don't call webhooks unnecessarily
3. Don't skip cache invalidation after POST
4. Don't call login webhook from frontend
5. Don't bypass cache unless necessary

---

## 🚀 Performance Impact

**Before Optimizations**:
- Page reload: 1-3 webhook calls
- Component mount: 0 calls
- Cache: 5 minutes

**After Optimizations**:
- Page reload: 0 calls (removed auto-fetch)
- Component mount: 0 calls
- Manual refresh: 1 call per user action
- Cache: 30 minutes

**Result**: ~90% reduction in webhook executions

---

## 📚 Related Documentation

- `WEBHOOK_EXECUTION_GUIDE.md` - When webhooks execute
- `PROJECT_FIXES_SUMMARY.md` - Recent optimizations
- `INDIVIDUAL_WEBHOOKS_IMPLEMENTATION.md` - Implementation details
- `WEBHOOK_TABLE_MAPPING.md` - Table-to-webhook mapping

---

**Last Updated**: 2025-01-27
