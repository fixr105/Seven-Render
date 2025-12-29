# RBAC Secure Data Separation - Implementation Summary

**Date:** 2025-01-29  
**Purpose:** Enforce secure data separation based on user role and ID. Ensure all database queries filter data according to RBAC rules.

## Implementation Overview

### Core Service Created

**`backend/src/services/rbac/rbacFilter.service.ts`**
- Centralized RBAC filtering service
- Replaces all 'Search records' logic previously handled by n8n search nodes
- Filters data based on user session role and ID

### RBAC Rules Enforced

#### 1. **CLIENT Role**
- **Loan Applications**: Only see their own applications (filtered by `clientId`)
- **Commission Ledger**: Only see their own ledger entries (filtered by `clientId`)
- **File Audit Log**: Only see audit logs for their own files
- **Admin Activity Log**: Only see activities related to their own files and ledger entries
- **Clients**: Only see their own client record

#### 2. **KAM Role**
- **Loan Applications**: Only see applications for clients they manage (via `Assigned KAM` field)
- **Commission Ledger**: Only see entries for clients they manage
- **File Audit Log**: Only see audit logs for their managed clients' files
- **Admin Activity Log**: Only see activities for their managed clients
- **Clients**: Only see clients they manage

#### 3. **NBFC Role**
- **Loan Applications**: Only see files assigned to them (filtered by `nbfcId`)
- **Commission Ledger**: No access (returns empty array)
- **File Audit Log**: Only see audit logs for files assigned to them
- **Admin Activity Log**: Only see activities for files assigned to them
- **Clients**: No access (returns empty array)

#### 4. **CREDIT Role**
- **All Data**: Sees all data (no filtering applied)
- Full access to all tables and records

## Key Features

### ✅ Centralized Filtering Service

**Service**: `rbacFilterService`

**Methods**:
- `filterLoanApplications(applications, user)`: Filters loan applications by role
- `filterCommissionLedger(entries, user)`: Filters commission ledger by role
- `filterFileAuditLog(entries, user)`: Filters file audit logs by role
- `filterAdminActivityLog(entries, user)`: Filters admin activity logs by role
- `filterClients(clients, user)`: Filters clients by role
- `getKAMManagedClientIds(kamId)`: Gets client IDs managed by a KAM
- `canAccessResource(user, resourceClientId, resourceNbfcId)`: Verifies resource access

### ✅ KAM Managed Clients Resolution

The service automatically resolves which clients are managed by a KAM by:
1. Fetching all clients from the Clients table
2. Filtering by `Assigned KAM` field (supports multiple field name variations)
3. Returning array of client IDs

### ✅ ID Matching Logic

Robust ID matching that handles:
- String/number conversion
- Case-insensitive matching
- Partial matches (contains)
- Multiple field name variations

### ✅ Controllers Updated

All controllers now use the centralized RBAC filter service:

1. **Loan Controller** (`loan.controller.ts`)
   - `listApplications()`: Uses `rbacFilterService.filterLoanApplications()`

2. **Ledger Controller** (`ledger.controller.ts`)
   - `getClientLedger()`: Uses `rbacFilterService.filterCommissionLedger()`

3. **KAM Controller** (`kam.controller.ts`)
   - `getDashboard()`: Uses RBAC filters for all data types

4. **NBFC Controller** (`nbfc.controller.ts`)
   - `getDashboard()`: Uses `rbacFilterService.filterLoanApplications()`
   - `listApplications()`: Uses `rbacFilterService.filterLoanApplications()`
   - `getApplication()`: Uses `rbacFilterService.filterLoanApplications()`
   - `recordDecision()`: Uses `rbacFilterService.filterLoanApplications()`

5. **Client Controller** (`client.controller.ts`)
   - `getDashboard()`: Uses RBAC filters for all data types

6. **Audit Controller** (`audit.controller.ts`)
   - `getFileAuditLog()`: Uses `rbacFilterService.filterLoanApplications()` and `filterFileAuditLog()`
   - `getAdminActivityLog()`: Uses `rbacFilterService.filterAdminActivityLog()`

7. **Queries Controller** (`queries.controller.ts`)
   - All query methods: Use `rbacFilterService.filterFileAuditLog()`

## Data Flow

### Before (n8n Search Nodes)
```
Frontend Request → Backend Controller → n8n Webhook (Search Records) → Airtable
                                                                    ↓
                                                              Returns All Records
                                                                    ↓
                                                          Filter in Controller
```

### After (Centralized RBAC Filter)
```
Frontend Request → Backend Controller → n8n Webhook (Get All) → Airtable
                                                              ↓
                                                        Returns All Records
                                                              ↓
                                          rbacFilterService.filter*() → Filtered by Role/ID
                                                              ↓
                                                      Return Filtered Data
```

## Security Benefits

1. **Defense in Depth**: Even if n8n webhooks return all data, backend filters ensure only authorized data is returned
2. **Consistent Enforcement**: All queries go through the same filtering logic
3. **Session-Based**: Uses authenticated user's role and ID from JWT token
4. **No Data Leakage**: Missing IDs result in empty arrays, not all data

## Implementation Details

### ID Matching

The service uses a robust `matchIds()` method that:
- Converts both IDs to strings
- Performs exact match
- Performs case-insensitive match
- Performs partial match (contains)

This handles variations in:
- Field names (`Client` vs `Client ID` vs `clientId`)
- Data types (string vs number)
- Formatting differences

### KAM Client Resolution

KAMs need to see data for their managed clients. The service:
1. Fetches all clients from Clients table
2. Filters by `Assigned KAM` field (checks multiple variations)
3. Returns array of client IDs
4. Filters all data queries by these client IDs

### NBFC Assignment Resolution

NBFCs need to see files assigned to them. The service:
1. Filters applications by `Assigned NBFC` field
2. Supports multiple field name variations
3. Matches by `nbfcId` from user session

## Migration Notes

### Replaced Logic

The following controller-level filtering logic has been replaced:
- Manual client ID filtering in loan controller
- Manual KAM client lookup in KAM controller
- Manual NBFC assignment filtering in NBFC controller
- Manual filtering in ledger controller
- Manual filtering in audit controller

### Backward Compatibility

- Credit Team still sees all data (no change)
- All existing API endpoints work the same way
- Frontend doesn't need changes

## Testing Checklist

- [ ] Client can only see their own applications
- [ ] Client can only see their own ledger entries
- [ ] Client cannot see other clients' data
- [ ] KAM can only see data for managed clients
- [ ] KAM cannot see data for unmanaged clients
- [ ] NBFC can only see assigned files
- [ ] NBFC cannot see unassigned files
- [ ] Credit Team sees all data
- [ ] Missing IDs result in empty arrays (not errors)

## Files Modified

1. **Created**: `backend/src/services/rbac/rbacFilter.service.ts`
2. **Updated**: `backend/src/controllers/loan.controller.ts`
3. **Updated**: `backend/src/controllers/ledger.controller.ts`
4. **Updated**: `backend/src/controllers/kam.controller.ts`
5. **Updated**: `backend/src/controllers/nbfc.controller.ts`
6. **Updated**: `backend/src/controllers/client.controller.ts`
7. **Updated**: `backend/src/controllers/audit.controller.ts`
8. **Updated**: `backend/src/controllers/queries.controller.ts`

## Next Steps

1. ✅ Service created
2. ✅ Controllers updated
3. ⏳ Test with real data
4. ⏳ Verify all edge cases
5. ⏳ Add unit tests for RBAC filter service
6. ⏳ Monitor for any data leakage

## Security Considerations

- All filtering happens server-side (never trust client)
- JWT token provides authenticated user context
- Missing or invalid IDs result in empty arrays (fail secure)
- Credit Team has full access (by design)
- All other roles have restricted access based on ownership/assignment

