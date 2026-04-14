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
import { ResetPassword } from './pages/ResetPassword';
import { PrivacyPage } from './pages/Privacy';
import { TermsPage } from './pages/Terms';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminActivityLog } from './pages/AdminActivityLog';
import { AdminUserAccounts } from './pages/AdminUserAccounts';
import { AdminNBFCPartners } from './pages/AdminNBFCPartners';
import { NBFCTools } from './pages/NBFCTools';

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
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/LOGIN" element={<Navigate to="/login" replace />} />
      <Route path="/Login" element={<Navigate to="/login" replace />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route
        path="/dashboard"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/applications"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <Applications />
            </ProtectedRoute>
          </ErrorBoundary>
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
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['client', 'kam', 'credit_team', 'admin']}>
              <Ledger />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/clients"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['kam', 'credit_team', 'admin']}>
              <Clients />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/profile"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/settings"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/reports"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/admin/activity-log"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
              <AdminActivityLog />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />
      <Route
        path="/admin/user-accounts"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
              <AdminUserAccounts />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />
      <Route
        path="/admin/nbfc-partners"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
              <AdminNBFCPartners />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/form-configuration"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['credit_team', 'admin']}>
              <FormConfiguration />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route
        path="/nbfc/tools"
        element={
          <ErrorBoundary>
            <ProtectedRoute allowedRoles={['nbfc']}>
              <NBFCTools />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center bg-neutral-100">
            <div className="text-center max-w-md px-4">
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Unauthorized</h1>
              <p className="text-neutral-600">You don't have permission to access this page.</p>
            </div>
          </div>
        }
      />

      {/* Catch-all route for 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
