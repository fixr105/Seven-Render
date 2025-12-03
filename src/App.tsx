import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Use API Auth Provider instead of Supabase Auth Provider
import { ApiAuthProvider } from './contexts/ApiAuthContext';
import { AuthProvider } from './contexts/AuthContext'; // Fallback for backward compatibility
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { WebhookTest } from './pages/WebhookTest';

function App() {
  // Use API Auth Provider (backend API) instead of Supabase
  // Set VITE_USE_API_AUTH=false to use Supabase (legacy)
  const useApiAuth = import.meta.env.VITE_USE_API_AUTH !== 'false';
  
  return (
    <>
      {useApiAuth ? (
        <ApiAuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ApiAuthProvider>
      ) : (
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      )}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
          <ProtectedRoute>
            <ApplicationDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/applications/new"
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <NewApplication />
          </ProtectedRoute>
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
        path="/webhook-test"
        element={
          <ProtectedRoute allowedRoles={['credit_team', 'kam']}>
            <WebhookTest />
          </ProtectedRoute>
        }
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
