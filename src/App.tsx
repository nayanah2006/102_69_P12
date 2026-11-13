import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Layout } from './components/Layout.tsx';
import { SubmitComplaintPage } from './pages/SubmitComplaintPage.tsx';
import { TrackComplaintPage } from './pages/TrackComplaintPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { UserDashboardPage } from './pages/UserDashboardPage.tsx';
import { HandlerDashboardPage } from './pages/HandlerDashboardPage.tsx';
import { RoutingDashboardPage } from './pages/RoutingDashboardPage.tsx';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage.tsx';
import type { UserRole } from './types/index.ts';

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-slate-900 font-display">Access Restricted</h2>
        <p className="text-sm text-slate-600">
          Your account role ({user.role}) does not have permission to access this view.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/submit" replace />} />
            <Route path="/submit" element={<SubmitComplaintPage />} />
            <Route path="/track" element={<TrackComplaintPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <UserDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/handler"
              element={
                <ProtectedRoute allowedRoles={['handler', 'admin']}>
                  <HandlerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/routing"
              element={
                <ProtectedRoute allowedRoles={['handler', 'admin']}>
                  <RoutingDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={['handler', 'admin']}>
                  <AnalyticsDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/submit" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
