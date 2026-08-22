import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Attendance } from './pages/Attendance';
import { Leave } from './pages/Leave';
import { Holidays } from './pages/Holidays';
import { Expenses } from './pages/Expenses';
import { Timesheets } from './pages/Timesheets';
import { Assets } from './pages/Assets';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { AdminControl } from './pages/AdminControl';
import { hasPermission, normalizeRole } from './utils/permissions';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[]; requiredPermission?: string }> = ({
  children,
  allowedRoles,
  requiredPermission
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-medium text-sm">
        Loading RANSOM Workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return (
      <Layout>
        <div className="p-8 bg-rose-950/40 border border-rose-800 rounded-2xl text-rose-300 space-y-2">
          <h2 className="text-lg font-bold">403 Forbidden</h2>
          <p className="text-xs">You do not have permission to access this module ({requiredPermission}).</p>
        </div>
      </Layout>
    );
  }

  if (allowedRoles && !allowedRoles.map(r => normalizeRole(r)).includes(normalizeRole(user.role))) {
    return (
      <Layout>
        <div className="p-8 bg-rose-950/40 border border-rose-800 rounded-2xl text-rose-300 space-y-2">
          <h2 className="text-lg font-bold">403 Forbidden</h2>
          <p className="text-xs">You do not have permission to access this module. Required role: {allowedRoles.join(' or ')}.</p>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
};

export const App: React.FC = () => {
  return (
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
);
};

export default App;
