# Dynamic Form & Module Configuration Service - Implementation Summary

**Date:** 2025-01-29  
**Purpose:** Implement backend function that allows KAM to configure Client dashboard by selecting active modules and form fields, and returns only enabled modules when Client requests their dashboard configuration.

## Implementation Overview

### Files Created

1. **`backend/src/services/formConfig/formConfig.service.ts`**
   - Main form and module configuration service
   - Handles client dashboard configuration
   - Filters by ClientFormMapping table entries
   - Supports module-based filtering

2. **`backend/FORM_CONFIG_SERVICE_SUMMARY.md`** (this file)
   - Implementation summary and documentation

### Files Modified

1. **`backend/src/controllers/client.controller.ts`**
   - Updated `getFormConfig()` to use `formConfigService.getClientDashboardConfig()`
   - Returns only enabled modules and form fields for the client

2. **`backend/src/controllers/kam.controller.ts`**
   - Added `configureClientModules()` method
   - Allows KAM to configure client modules and form fields

3. **`backend/src/routes/kam.routes.ts`**
   - Added route: `POST /kam/clients/:id/configure-modules`

## Key Features

### ✅ Client Dashboard Configuration

**Endpoint**: `GET /client/form-config`

**Functionality**:
- Returns only modules and form fields enabled for the requesting client
- Filters based on:
  1. ClientFormMapping table entries for this client
  2. Client's Enabled Modules field
  3. Active categories and fields
  4. Form config version (for versioning support)
  5. Product ID (optional filtering)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "clientId": "CLIENT-001",
    "clientName": "Test Client",
    "enabledModules": ["M1", "M2", "M3"],
    "modules": [
      {
        "moduleId": "M1",
        "moduleName": "Pay In/Out Ledger",
        "description": "Commission ledger and payout management",
        "enabled": true,
        "categories": [
          {
            "categoryId": "CAT-001",
            "categoryName": "Commission Ledger",
            "description": "...",
            "isRequired": true,
            "displayOrder": 1,
            "fields": [...]
          }
        ]
      }
    ],
    "version": "2025-01-29T12:00:00.000Z",
    "productId": "PROD-001"
  }
}
```

### ✅ KAM Module Configuration

**Endpoint**: `POST /kam/clients/:id/configure-modules`

**Functionality**:
- Allows KAM to configure which modules and form fields are enabled for a client
- Creates ClientFormMapping entries for the specified configuration
- Updates client's Enabled Modules field
- Supports versioning (creates new version timestamp)

**Request Body**:
```json
{
  "enabledModules": ["M1", "M2", "M3"],
  "categories": [
    {
      "categoryId": "CAT-001",
      "isRequired": true,
      "displayOrder": 1
    }
  ],
  "productId": "PROD-001" // optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "clientId": "CLIENT-001",
    "enabledModules": ["M1", "M2", "M3"],
    "mappings": [...]
  }
}
```

## Service Methods

### `getClientDashboardConfig(clientId, productId?, version?)`

Returns complete form configuration for a client, including:
- Enabled modules
- Categories with mappings
- Fields with required/mandatory status
- Display order
- Version information

**Filtering Logic**:
1. Filters ClientFormMapping by clientId
2. Filters by version (uses latest if not specified)
3. Filters by productId (if specified)
4. Only includes categories that have mappings
5. Only includes active categories and fields
6. Groups categories by module (M1-M7)

### `configureClientModules(kamUserId, options)`

Configures client modules and form fields:
- Verifies client exists and is assigned to KAM
- Updates client's Enabled Modules field
- Creates ClientFormMapping entries for specified categories
- Creates version timestamp for form config versioning
- Returns created mappings

## Module Mapping

The service automatically maps categories to modules based on naming patterns:

- **M1 (Pay In/Out Ledger)**: Categories with "ledger", "commission", "payout"
- **M2 (Master Form Builder)**: Categories with "form", "kyc", "document"
- **M3 (File Status Tracking)**: Categories with "status", "tracking", "workflow"
- **M4 (Audit Log & Query Dialog)**: Categories with "audit", "query", "log"
- **M5 (Action Center)**: Categories with "action", "notification", "alert"
- **M6 (Daily Summary Reports)**: Categories with "report", "summary", "daily"
- **M7 (File Summary Insights)**: Categories with "insight", "summary", "ai"

Default: M2 (Master Form Builder)

## Integration Points

### Client Controller

**`GET /client/form-config`**
- Uses `formConfigService.getClientDashboardConfig()`
- Returns only enabled modules for the authenticated client
- Supports versioning via `applicationId` query parameter
- Supports product filtering via `productId` query parameter

### KAM Controller

**`POST /kam/clients/:id/configure-modules`**
- Uses `formConfigService.configureClientModules()`
- Verifies KAM has access to the client
- Creates ClientFormMapping entries
- Updates client's Enabled Modules field
- Logs admin activity

## Data Flow

### Client Request Flow

```
Client → GET /client/form-config
  ↓
ClientController.getFormConfig()
  ↓
formConfigService.getClientDashboardConfig()
  ↓
1. Fetch ClientFormMapping (filter by clientId)
2. Fetch Form Categories (filter by mappings)
3. Fetch Form Fields (filter by categories)
4. Fetch Clients (get enabled modules)
  ↓
Filter by:
- Enabled Modules
- Active status
- Version (if specified)
- Product ID (if specified)
  ↓
Group by Module (M1-M7)
  ↓
Return only enabled modules
```

### KAM Configuration Flow

```
KAM → POST /kam/clients/:id/configure-modules
  ↓
KAMController.configureClientModules()
  ↓
formConfigService.configureClientModules()
  ↓
1. Verify client exists and is assigned to KAM
2. Update client's Enabled Modules field
3. Create ClientFormMapping entries for categories
4. Create version timestamp
  ↓
Return created mappings
```

## Versioning Support

The service supports form config versioning:
- Each configuration creates a new version timestamp
- Clients can request a specific version (via `applicationId`)
- Ensures submitted applications use frozen form config
- Latest version is used if not specified

## Product-Specific Configuration

The service supports product-specific form configurations:
- Categories can be linked to specific loan products
- Client requests can filter by `productId`
- Allows different form fields for different products

## Security & Authorization

- **Client Endpoint**: Only authenticated clients can access their own config
- **KAM Endpoint**: Only KAM users can configure modules
- **Client Assignment**: KAM can only configure clients assigned to them
- **Verification**: Service verifies client-KAM relationship before allowing configuration

## Benefits

1. **Centralized Logic** - All form config logic in one service
2. **Module-Based** - Groups categories by modules (M1-M7)
3. **Filtered Results** - Clients only see enabled modules
4. **Versioning** - Supports form config versioning
5. **Product-Specific** - Supports product-based configurations
6. **RBAC-Aware** - Respects KAM-client relationships

## Testing

### Test Client Dashboard Config

```bash
# Get client form config
curl -X GET "http://localhost:3001/api/client/form-config?productId=PROD-001" \
  -H "Authorization: Bearer <client_token>"
```

### Test KAM Module Configuration

```bash
# Configure client modules
curl -X POST "http://localhost:3001/api/kam/clients/CLIENT-001/configure-modules" \
  -H "Authorization: Bearer <kam_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledModules": ["M1", "M2", "M3"],
    "categories": [
      {
        "categoryId": "CAT-001",
        "isRequired": true,
        "displayOrder": 1
      }
    ]
  }'
```

## Next Steps

1. ✅ Service created
2. ✅ Client endpoint updated
3. ✅ KAM endpoint created
4. ⏳ Test with real data
5. ⏳ Frontend integration
6. ⏳ Add validation for module IDs
7. ⏳ Add bulk category configuration
8. ⏳ Add module enable/disable without categories

## Files Summary

- **Service**: `backend/src/services/formConfig/formConfig.service.ts`
- **Client Controller**: Updated `getFormConfig()` method
- **KAM Controller**: Added `configureClientModules()` method
- **Routes**: Added `POST /kam/clients/:id/configure-modules`
- **Documentation**: `backend/FORM_CONFIG_SERVICE_SUMMARY.md`

