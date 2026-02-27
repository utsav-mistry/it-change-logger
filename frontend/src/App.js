import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { LoadingPage } from './components/UI';

import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import IncidentList from './pages/IncidentList';
import IncidentCreate from './pages/IncidentCreate';
import IncidentDetail from './pages/IncidentDetail';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import Reports from './pages/Reports';
import ReportAudit from './pages/ReportAudit';
import NotificationPage from './pages/NotificationPage';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import About from './pages/About';
import Terms from './pages/Terms';
import SetupTerms from './pages/SetupTerms';
import WorkLog from './pages/WorkLog';
import WorkLogAdmin from './pages/WorkLogAdmin';

import api from './api/client';

function SetupGate({ children }) {
    const [initialized, setInitialized] = useState(null);
    const location = useLocation();

    useEffect(() => {
        api.get('/setup/status')
            .then(r => setInitialized(r.data.initialized))
            .catch(() => setInitialized(true));
    }, []);

    if (initialized === null) return <LoadingPage />;
    // Allow access to public terms pages while not initialized
    if (!initialized && (location.pathname === '/setup/terms' || location.pathname === '/terms')) return children;
    if (!initialized) return <SetupPage onComplete={() => setInitialized(true)} />;

    return children;
}

function AuthGuard() {
    const { user, loading } = useAuth();
    if (loading) return <LoadingPage />;
    if (!user) return <Navigate to="/login" replace />;
    return (
        <Layout>
            <Outlet />
        </Layout>
    );
}

function LoginGuard() {
    const { user, loading } = useAuth();
    if (loading) return <LoadingPage />;
    if (user) return <Navigate to="/dashboard" replace />;
    return <Outlet />;
}

function AdminGuard() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin' || user?.role === 'IT Admin';
    if (!isAdmin) return <Navigate to="/dashboard" replace />;
    return <Outlet />;
}

function AppRoutes() {
    return (
        <SetupGate>
            <Routes>
                <Route element={<LoginGuard />}>
                    <Route path="/login" element={<LoginPage />} />
                </Route>

                {/* Public standalone terms — accessible without login (e.g. from setup page) */}
                <Route path="/terms" element={<Terms standalone />} />
                <Route path="/setup/terms" element={<SetupTerms />} />

                <Route element={<AuthGuard />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/incidents" element={<IncidentList />} />
                    <Route path="/incidents/new" element={<IncidentCreate />} />
                    <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
                    <Route path="/worklog" element={<WorkLog />} />
                    <Route path="/notifications" element={<NotificationPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/about" element={<About />} />
                    {/* Terms inside the app — shown within the Layout with a Back button */}
                    <Route path="/app/terms" element={<Terms />} />

                    <Route element={<AdminGuard />}>
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/departments" element={<DepartmentManagement />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/reports/audit" element={<ReportAudit />} />
                        <Route path="/worklogs/admin" element={<WorkLogAdmin />} />
                        <Route path="/settings" element={<Settings />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </SetupGate>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <AppRoutes />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
