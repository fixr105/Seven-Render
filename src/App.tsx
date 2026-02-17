import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './auth/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { ForgotPassword } from './pages/ForgotPassword';
import { AdminActivityLog } from './pages/AdminActivityLog';
import { AdminUserAccounts } from './pages/AdminUserAccounts';
import { AdminNBFCPartners } from './pages/AdminNBFCPartners';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
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
          <ProtectedRoute allowedRoles={['client', 'credit_team', 'admin']}>
            <Ledger />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients"
        element={
          <ProtectedRoute allowedRoles={['kam', 'credit_team', 'admin']}>
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
        path="/admin/activity-log"
        element={
          <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
            <AdminActivityLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/user-accounts"
        element={
          <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
            <AdminUserAccounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/nbfc-partners"
        element={
          <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
            <AdminNBFCPartners />
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
