# API Service Usage Guide

## Overview

The API service (`src/services/api.ts`) provides a complete wrapper for all backend endpoints with:
- ✅ JWT token management
- ✅ Automatic authentication headers
- ✅ TypeScript types for all requests/responses
- ✅ Error handling
- ✅ Role-based access helpers

## Setup

### 1. Environment Variable

Add to `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

### 2. Update Auth Context

Replace Supabase auth with API auth:

```tsx
// In App.tsx
import { ApiAuthProvider } from './contexts/ApiAuthContext';

function App() {
  return (
    <ApiAuthProvider>
      {/* Your app */}
    </ApiAuthProvider>
  );
}
```

### 3. Update Login Page

```tsx
import { useApiAuth } from '../contexts/ApiAuthContext';

const { login } = useApiAuth();

const handleLogin = async () => {
  const { error } = await login(email, password);
  if (!error) {
    navigate('/dashboard');
  }
};
```

## Usage Examples

### Authentication

```tsx
import { apiService } from '../services/api';

// Login
const response = await apiService.login(email, password);
if (response.success) {
  // Token automatically stored
  const user = response.data.user;
}

// Get current user
const me = await apiService.getMe();

// Logout
apiService.logout();
```

### Client Dashboard

```tsx
import { apiService } from '../services/api';
import { useApiCall } from '../hooks/useApi';

function ClientDashboard() {
  const { loading, error, data, execute } = useApiCall();

  useEffect(() => {
    execute(() => apiService.getClientDashboard());
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{/* Render dashboard */}</div>;
}
```

### Loan Applications

```tsx
// List applications
const applications = await apiService.listApplications({
  status: 'pending',
  search: 'John',
});

// Create application
const newApp = await apiService.createApplication({
  productId: 'home-loan',
  borrowerIdentifiers: {
    name: 'John Doe',
    pan: 'ABCDE1234F',
  },
});

// Submit application
await apiService.submitApplication(applicationId);
```

### Role-Based Access

```tsx
import { RoleGuard } from '../components/RoleGuard';
import { useRoleAccess } from '../hooks/useRoleAccess';

// Component-level guard
<RoleGuard allowedRoles={['kam', 'credit_team']}>
  <AdminPanel />
</RoleGuard>

// Hook-based check
const { isCredit, canApprovePayouts } = useRoleAccess();

{canApprovePayouts && (
  <Button onClick={approvePayout}>Approve</Button>
)}
```

### Form Configuration

```tsx
// Get dynamic form config
const formConfig = await apiService.getFormConfig();

// Render form dynamically
formConfig.data.categories.forEach(category => {
  const fields = formConfig.data.fields.filter(
    f => f.category === category.categoryName
  );
  // Render fields
});
```

### Commission Ledger

```tsx
// Get ledger
const ledger = await apiService.getClientLedger();

// Create payout request
await apiService.createPayoutRequest(50000);

// Get payout requests
const payouts = await apiService.getPayoutRequests();
```

### Workflow Actions

```tsx
// KAM: Forward to credit
await apiService.forwardToCredit(applicationId);

// Credit: Assign NBFC
await apiService.assignNBFCs(applicationId, ['nbfc-1', 'nbfc-2']);

// NBFC: Record decision
await apiService.recordNBFCDecision(applicationId, {
  decision: 'approved',
  decisionDate: '2025-12-02',
  approvedAmount: '5000000',
});
```

## Error Handling

```tsx
const response = await apiService.getClientDashboard();

if (!response.success) {
  // Handle error
  console.error(response.error);
  // Show toast/alert
} else {
  // Use data
  const dashboard = response.data;
}
```

## Token Management

The API service automatically:
- Stores token in `localStorage` on login
- Adds `Authorization: Bearer <token>` header to all requests
- Clears token on logout
- Validates token on `getMe()` calls

## Type Safety

All methods are fully typed:

```tsx
// TypeScript knows the return type
const dashboard: DashboardSummary = await apiService
  .getClientDashboard()
  .then(r => r.data!);
```

## Migration from Supabase

1. Replace `supabase.auth.signIn()` with `apiService.login()`
2. Replace `supabase.from('table').select()` with API methods
3. Replace `useAuth()` with `useApiAuth()`
4. Update all data fetching to use `apiService`

See `CURSOR_FIX_PROMPTS.md` for detailed migration steps.

