# Assigned Loan Products Integration Plan

## Overview

GET loan products will now return **assigned products with product ID** (client-specific). This document describes how to integrate this into the system.

---

## Current Flow (Today)

| Step | Component | Action |
|------|-----------|--------|
| 1 | `NewApplication` (client) | `getConfiguredProducts()` → returns product IDs (from Assigned Products or Form Link) |
| 2 | `NewApplication` | `listLoanProducts(true)` → returns ALL active products |
| 3 | `NewApplication` | Filters: `visibleProducts = allProducts.filter(p => configuredProductIds.has(p.id))` |
| 4 | `FormConfiguration` | `listLoanProducts(true)` → all products (no filtering) |
| 5 | `ClientDashboard` | `listLoanProducts` + `getConfiguredProducts` → filters and shows configured status |

---

## New Flow (Assigned Products from API)

| Role | Endpoint | Returns |
|------|----------|---------|
| **Client** | `GET /client/loan-products` (new) or `GET /loan-products` (role-aware) | Assigned products only, each with `productId` |
| **KAM / Credit / Admin** | `GET /loan-products` | All products (unchanged) |

---

## Implementation Options

### Option A: New client-specific endpoint (recommended)

**Backend:** Add `GET /client/loan-products` that returns assigned products with full product details.

**Pros:** Clear separation, no breaking changes to existing `/loan-products`  
**Cons:** One more endpoint to maintain

### Option B: Role-aware `/loan-products`

**Backend:** Modify `GET /loan-products` to check `req.user.role === 'client'` and return only assigned products when client.

**Pros:** Single endpoint  
**Cons:** Same URL returns different data by role; harder to reason about

---

## Implementation Steps (Option A)

### 1. Backend: Add `GET /client/loan-products`

**File:** `backend/src/controllers/client.controller.ts`

```ts
/**
 * GET /client/loan-products
 * Returns list of assigned loan products for the authenticated client.
 * Each product includes id, productId, productName, description, active.
 */
async getAssignedLoanProducts(req: Request, res: Response): Promise<void> {
  // 1. Resolve clientId (same logic as getConfiguredProducts)
  // 2. Get assigned product IDs from Clients record (Assigned Products column)
  // 3. Fetch Loan Products from n8n
  // 4. Filter to only assigned product IDs (match by Product ID)
  // 5. Return: { success: true, data: products.map(p => ({ id, productId, productName, ... })) }
}
```

**Route:** `backend/src/routes/client.routes.ts`  
Add: `router.get('/loan-products', clientController.getAssignedLoanProducts.bind(clientController));`

**Response shape (same as listLoanProducts):**
```json
{
  "success": true,
  "data": [
    { "id": "recXXX", "productId": "LP008", "productName": "Credit Card", "description": "...", "active": true }
  ]
}
```

### 2. Backend: Reuse existing logic

`getConfiguredProducts` already returns assigned product IDs. The new endpoint can:
- Call the same client-resolution logic
- Fetch Loan Products
- Filter by assigned IDs
- Return full product objects (not just IDs)

### 3. Frontend: Add `getClientLoanProducts` API method

**File:** `src/services/api.ts`

```ts
async getClientLoanProducts(): Promise<ApiResponse<Array<{
  id: string;
  productId: string;
  productName: string;
  description?: string;
  active?: boolean;
}>>> {
  return this.request('/client/loan-products');
}
```

### 4. Frontend: Update `NewApplication.tsx`

**Current:** `getConfiguredProducts` → `listLoanProducts` → filter by `configuredProductIds`

**New (client):**
```ts
// For clients: fetch assigned products directly
const response = await apiService.getClientLoanProducts();
// No filtering needed - backend returns only assigned
setLoanProducts(response.data.map(p => ({ id: p.productId || p.id, name: p.productName || p.name })));
```

**Keep for other roles:** `listLoanProducts(true)` for KAM, Credit, FormConfiguration.

### 5. Frontend: Update `ClientDashboard.tsx`

- Use `getClientLoanProducts()` for clients instead of `listLoanProducts` + `getConfiguredProducts`
- `configuredProductIds` can be derived from the response (all returned products are configured)

### 6. Frontend: `FormConfiguration` and `Clients` (KAM)

- No change: continue using `listLoanProducts(true)` for full product list

---

## Product ID Consistency

Ensure all consumers use the same identifier:

| Field | Use for |
|-------|---------|
| `productId` | Product ID (e.g. LP008) – used in form config, application creation |
| `id` | Airtable record ID – fallback when productId missing |

**Frontend mapping (already in place):**
```ts
const id = product.productId || product.id;
const name = product.productName || product['Product Name'] || product.name;
```

---

## Fallback Behavior

If a client has **no Assigned Products** (empty):

- **Option 1:** Return empty array (client sees "No products configured")
- **Option 2:** Fall back to Form Link / Product Documents config (current `getConfiguredProducts` logic)

Recommend **Option 2** for backward compatibility.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | Backend: Add `GET /client/loan-products` that returns assigned products with `productId` |
| 2 | Frontend: Add `getClientLoanProducts()` to api.ts |
| 3 | Frontend: NewApplication (client) – use `getClientLoanProducts` instead of `listLoanProducts` + filter |
| 4 | Frontend: ClientDashboard – use `getClientLoanProducts` for clients |
| 5 | Frontend: Remove `fetchConfiguredProducts` dependency for loan product list (clients only) |
| 6 | Keep `getConfiguredProducts` if still needed for form config loading (e.g. which products have form config) |
| 7 | Test: Client sees only assigned products in dropdown |
| 8 | Test: KAM/FormConfiguration still see all products |

---

## n8n / Webhook Changes (if applicable)

If the **n8n webhook** is changing to return assigned products:

- The webhook may need a `clientId` or `email` query param to filter
- Backend would pass the client context when calling the webhook
- Document the new webhook contract in `backend/docs/API_ENDPOINTS_WEBHOOK_MAPPING.md`
