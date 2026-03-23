import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
import './index.css';

// Layout
import AppShell from './components/layout/AppShell';

// Auth pages
import LoginPage          from './pages/LoginPage';
import AcceptInvitePage   from './pages/AcceptInvitePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';

// Worker pages
import TimerPage         from './pages/worker/TimerPage';
import ChecklistPage     from './pages/worker/ChecklistPage';
import MyTimesheetsPage  from './pages/worker/MyTimesheetsPage';
import WeeklyViewPage    from './pages/worker/WeeklyViewPage';
import NotificationsPage from './pages/worker/NotificationsPage';
import ProfilePage       from './pages/worker/ProfilePage';

// Approver pages
import ApproverDashboard  from './pages/approver/DashboardPage';
import ApproverTimesheets from './pages/approver/TimesheetsPage';
import QueriesPage        from './pages/approver/QueriesPage';
import ExceptionsPage     from './pages/approver/ExceptionsPage';
import ReportsPage        from './pages/approver/ReportsPage';
import ExportPage         from './pages/approver/ExportPage';

// Admin pages
import UsersPage       from './pages/admin/UsersPage';
import SitesPage       from './pages/admin/SitesPage';
import GeofencePage    from './pages/admin/GeofencePage';
import WorkCodesPage   from './pages/admin/WorkCodesPage';
import ChecklistAdmin  from './pages/admin/ChecklistAdminPage';
import FeaturesPage    from './pages/admin/FeaturesPage';
import CustomFieldsPage from './pages/admin/CustomFieldsPage';
import BrandingPage    from './pages/admin/BrandingPage';
import NotifSettingsPage from './pages/admin/NotifSettingsPage';
import AuditPage       from './pages/admin/AuditPage';

// Super admin pages
import OrgsPage      from './pages/super/OrgsPage';
import OnboardPage   from './pages/super/OnboardPage';
import PlatformPage  from './pages/super/PlatformPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Route guard ───────────────────────────────────────────────

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// ── Role-based default redirect ───────────────────────────────

function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'worker')      return <Navigate to="/timer" replace />;
  if (user.role === 'approver')    return <Navigate to="/dashboard" replace />;
  if (user.role === 'org_admin')   return <Navigate to="/users" replace />;
  if (user.role === 'super_admin') return <Navigate to="/orgs" replace />;
  return <Navigate to="/timer" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OfflineProvider>
          <BrowserRouter>
            <Routes>

              {/* Public routes */}
              <Route path="/login"            element={<LoginPage />} />
              <Route path="/accept-invite"    element={<AcceptInvitePage />} />
              <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
              <Route path="/reset-password"   element={<ResetPasswordPage />} />

              {/* Protected app routes — all inside AppShell */}
              <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>

                <Route index element={<DefaultRedirect />} />

                {/* Worker */}
                <Route path="timer"         element={<TimerPage />} />
                <Route path="checklist"     element={<ChecklistPage />} />
                <Route path="timesheets"    element={<MyTimesheetsPage />} />
                <Route path="weekly"        element={<WeeklyViewPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile"       element={<ProfilePage />} />

                {/* Approver */}
                <Route path="dashboard"  element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><ApproverDashboard /></ProtectedRoute>} />
                <Route path="approve"    element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><ApproverTimesheets /></ProtectedRoute>} />
                <Route path="queries"    element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><QueriesPage /></ProtectedRoute>} />
                <Route path="exceptions" element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><ExceptionsPage /></ProtectedRoute>} />
                <Route path="reports"    element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><ReportsPage /></ProtectedRoute>} />
                <Route path="export"     element={<ProtectedRoute roles={['approver','org_admin','super_admin']}><ExportPage /></ProtectedRoute>} />

                {/* Admin */}
                <Route path="users"        element={<ProtectedRoute roles={['org_admin','super_admin']}><UsersPage /></ProtectedRoute>} />
                <Route path="sites"        element={<ProtectedRoute roles={['org_admin','super_admin']}><SitesPage /></ProtectedRoute>} />
                <Route path="geofence"     element={<ProtectedRoute roles={['org_admin','super_admin']}><GeofencePage /></ProtectedRoute>} />
                <Route path="work-codes"   element={<ProtectedRoute roles={['org_admin','super_admin']}><WorkCodesPage /></ProtectedRoute>} />
                <Route path="checklists"   element={<ProtectedRoute roles={['org_admin','super_admin']}><ChecklistAdmin /></ProtectedRoute>} />
                <Route path="features"     element={<ProtectedRoute roles={['org_admin','super_admin']}><FeaturesPage /></ProtectedRoute>} />
                <Route path="fields"       element={<ProtectedRoute roles={['org_admin','super_admin']}><CustomFieldsPage /></ProtectedRoute>} />
                <Route path="branding"     element={<ProtectedRoute roles={['org_admin','super_admin']}><BrandingPage /></ProtectedRoute>} />
                <Route path="notif-settings" element={<ProtectedRoute roles={['org_admin','super_admin']}><NotifSettingsPage /></ProtectedRoute>} />
                <Route path="audit"        element={<ProtectedRoute roles={['org_admin','super_admin']}><AuditPage /></ProtectedRoute>} />

                {/* Super admin */}
                <Route path="orgs"     element={<ProtectedRoute roles={['super_admin']}><OrgsPage /></ProtectedRoute>} />
                <Route path="onboard"  element={<ProtectedRoute roles={['super_admin']}><OnboardPage /></ProtectedRoute>} />
                <Route path="platform" element={<ProtectedRoute roles={['super_admin']}><PlatformPage /></ProtectedRoute>} />

              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
