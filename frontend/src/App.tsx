import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { PageSkeleton } from './components/common/PageSkeleton';
import { hasPermission, normalizeRole } from './utils/permissions';
import { RefreshCw } from 'lucide-react';

// Route-level code splitting for performance optimization
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Employees = React.lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const Attendance = React.lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Leave = React.lazy(() => import('./pages/Leave').then(m => ({ default: m.Leave })));
const Holidays = React.lazy(() => import('./pages/Holidays').then(m => ({ default: m.Holidays })));
const Expenses = React.lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const Timesheets = React.lazy(() => import('./pages/Timesheets').then(m => ({ default: m.Timesheets })));
const Assets = React.lazy(() => import('./pages/Assets').then(m => ({ default: m.Assets })));
const Notifications = React.lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Reports = React.lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const AdminControl = React.lazy(() => import('./pages/AdminControl').then(m => ({ default: m.AdminControl })));

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[]; requiredPermission?: string }> = ({
  children,
  allowedRoles,
  requiredPermission
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center gap-3 text-[var(--primary)] font-medium text-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return (
      <Layout>
        <div className="p-8 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-2xl text-[var(--action-danger-bg)] space-y-2">
          <h2 className="text-lg font-bold">403 Forbidden</h2>
          <p className="text-xs">You do not have permission to access this module ({requiredPermission}).</p>
        </div>
      </Layout>
    );
  }

  if (allowedRoles && !allowedRoles.map(r => normalizeRole(r)).includes(normalizeRole(user.role))) {
    return (
      <Layout>
        <div className="p-8 bg-[var(--action-danger-soft)] border border-[var(--action-danger-bg)]/30 rounded-2xl text-[var(--action-danger-bg)] space-y-2">
          <h2 className="text-lg font-bold">403 Forbidden</h2>
          <p className="text-xs">You do not have permission to access this module. Required role: {allowedRoles.join(' or ')}.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<PageSkeleton />}>
        {children}
      </Suspense>
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AttendanceProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute requiredPermission="EMPLOYEE_VIEW_WORKFORCE"><Employees /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
              <Route path="/holidays" element={<ProtectedRoute><Holidays /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
              <Route path="/timesheets" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
              <Route path="/weekly-plan" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
              <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requiredPermission="REPORTS_WORKFORCE_VIEW"><Reports /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute requiredPermission="AUDIT_LOG_VIEW"><AuditLogs /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin-control" element={<ProtectedRoute requiredPermission="USER_ROLE_ASSIGN"><AdminControl /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AttendanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
