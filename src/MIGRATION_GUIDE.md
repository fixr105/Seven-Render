# Migration Guide: Supabase to Backend API

## Overview

This guide helps migrate the frontend from Supabase to the backend API service.

## Step 1: Install Dependencies

No additional dependencies needed - uses native `fetch` API.

## Step 2: Update Environment Variables

Add to `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

## Step 3: Replace Auth Context

### Before (Supabase):
```tsx
import { AuthProvider } from './contexts/AuthContext';
```

### After (API):
```tsx
import { ApiAuthProvider } from './contexts/ApiAuthContext';

// In App.tsx
<ApiAuthProvider>
  {/* Your app */}
</ApiAuthProvider>
```

## Step 4: Update Login Page

### Before:
```tsx
import { useAuth } from '../contexts/AuthContext';
const { signIn } = useAuth();
await signIn(email, password);
```

### After:
```tsx
import { useApiAuth } from '../contexts/ApiAuthContext';
const { login } = useApiAuth();
const { error } = await login(email, password);
```

See `src/pages/LoginApiExample.tsx` for complete example.

## Step 5: Update Data Fetching

### Before (Supabase):
```tsx
const { data } = await supabase
  .from('loan_applications')
  .select('*')
  .eq('client_id', clientId);
```

### After (API):
```tsx
import { apiService } from '../services/api';

const response = await apiService.listApplications();
if (response.success) {
  const applications = response.data;
}
```

## Step 6: Update Form Submissions

### Before:
```tsx
await supabase
  .from('loan_applications')
  .insert({ ...data });
```

### After:
```tsx
await apiService.createApplication({
  productId: 'home-loan',
  borrowerIdentifiers: { name: 'John' },
});
```

## Step 7: Use Role-Based Access

### Before:
```tsx
const { userRole } = useAuth();
if (userRole === 'kam') { ... }
```

### After:
```tsx
import { useRoleAccess } from '../hooks/useRoleAccess';
const { isKAM, canManageClients } = useRoleAccess();

// Or use RoleGuard component
<RoleGuard allowedRoles={['kam', 'credit_team']}>
  <AdminPanel />
</RoleGuard>
```

## Step 8: Update All Pages

### Dashboard
- Replace `supabase.from('dsa_clients')` with `apiService.getClientDashboard()`
- Use `useApiCall` hook for loading/error states

### Applications
- Replace Supabase queries with `apiService.listApplications()`
- Use role-specific methods: `listKAMApplications()`, `listCreditApplications()`, etc.

### Ledger
- Replace with `apiService.getClientLedger()`
- Use `apiService.createPayoutRequest()`

### Clients
- Replace with `apiService.createClient()`
- Use `apiService.updateClientModules()`

## Complete Example

See:
- `src/pages/LoginApiExample.tsx` - Login page
- `src/examples/DashboardApiExample.tsx` - Dashboard
- `src/examples/ApplicationsApiExample.tsx` - Applications list

## Benefits

✅ Type-safe API calls
✅ Automatic JWT handling
✅ Role-based access helpers
✅ Centralized error handling
✅ Consistent response format
✅ No Supabase dependency

