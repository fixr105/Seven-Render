import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Use unified auth provider for API-based authentication
import { UnifiedAuthProvider } from './contexts/UnifiedAuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Applications } from './pages/Applications';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { NewApplication } from './pages/NewApplication';
import { Ledger } from './pages/Ledger';
import { Clients } from './pages/Clients';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { FormConfiguration } from './pages/FormConfiguration';
import { ClientForm } from './pages/ClientForm';

function App() {
  // Always wrap with BrowserRouter first, then unified provider
  // This ensures routing context is available before auth context
  // UnifiedAuthProvider ensures consistent component tree structure
  return (
    <BrowserRouter>
      <UnifiedAuthProvider>
        <AppRoutes />
      </UnifiedAuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Login route - case insensitive, redirect uppercase to lowercase */}
      <Route path="/login" element={<Login />} />
      <Route path="/LOGIN" element={<Navigate to="/login" replace />} />
      <Route path="/Login" element={<Navigate to="/login" replace />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/applications"
        element={
          <ProtectedRoute>
            <Applications />
          </ProtectedRoute>
        }
      />

      <Route
        path="/applications/:id"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <ApplicationDetail />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/applications/new"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['client']}>
              <NewApplication />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/ledger"
        element={
          <ProtectedRoute allowedRoles={['client', 'credit_team']}>
            <Ledger />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients"
        element={
          <ProtectedRoute allowedRoles={['kam', 'credit_team']}>
            <Clients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/form-configuration"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['kam']}>
              <FormConfiguration />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      {/* Client Form - accessible via link (may or may not require auth) */}
      <Route
        path="/form/:clientId"
        element={<ClientForm />}
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center bg-neutral-100">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Unauthorized</h1>
              <p className="text-neutral-600">You don't have permission to access this page.</p>
            </div>
          </div>
        }
      />

      {/* Catch-all route for 404 */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}

export default App;
