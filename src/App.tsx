import { useEffect } from 'react';

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useDataLoader } from './hooks/useDataLoader';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { SuperAdminSetup } from './pages/SuperAdminSetup';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Sites } from './pages/Sites';
import { Attendance } from './pages/Attendance';
import { Payroll } from './pages/Payroll';
import { Billing } from './pages/Billing';
import { Payments } from './pages/Payments';
import { VatPayments } from './pages/VatPayments';
import { Onboarding } from './pages/Onboarding';
import { Reports } from './pages/Reports';
import { FinancialReports } from './pages/FinancialReports';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Leaves } from './pages/Leaves';
import { LeaveSummary } from './pages/LeaveSummary';
import { Users } from './pages/Users';
import { UserForm } from './pages/UserForm';
import { SalaryLoans } from './pages/SalaryLoans';
import { ClientSummary } from './pages/ClientSummary';
import { TitleBar } from './components/layout/TitleBar';
import { ToastContainer, ConfirmDialog } from './components/ui/toast';
import { GlobalDragScroll } from './components/ui/GlobalDragScroll';
import { useTheme } from './hooks/useTheme';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load data from Supabase when authenticated
  useDataLoader(!!user);

  // Handle navigation triggered by Electron main-process menu items
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (path) navigate(path);
    };
    window.addEventListener('electron-navigate', handler);
    return () => window.removeEventListener('electron-navigate', handler);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<SuperAdminSetup />} />
      <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="employees" element={<Employees />} />
        <Route path="sites" element={<Sites />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="invoices" element={<Billing />} />
        <Route path="payments" element={<Payments />} />
        <Route path="vat" element={<VatPayments />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="reports" element={<Reports />} />
        <Route path="financial-reports" element={<FinancialReports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="variables" element={<Navigate to="/settings" replace />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="leave-summary" element={<LeaveSummary />} />
        <Route path="users" element={<Users />} />
        <Route path="users/new" element={<UserForm />} />
        <Route path="users/:id/edit" element={<UserForm />} />
        <Route path="salary-loans" element={<SalaryLoans />} />
        <Route path="client-summary" element={<ClientSummary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { isDark } = useTheme();
  return (
    <AuthProvider>
      <div className={`flex flex-col h-[100dvh] transition-colors duration-200 ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
        <TitleBar />
        <div className="flex-1 min-h-0 relative">
          <GlobalDragScroll />
          <ToastContainer />
          <ConfirmDialog />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </div>
      </div>
    </AuthProvider>
  );
}
