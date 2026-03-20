import { useEffect, lazy, Suspense } from 'react';

import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useDataLoader, useRealtimeData } from './hooks/useDataLoader';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { SuperAdminSetup } from './pages/SuperAdminSetup';
import { Dashboard } from './pages/Dashboard';
import { TitleBar } from './components/layout/TitleBar';
import { ToastContainer, ConfirmDialog } from './components/ui/toast';
import { GlobalDragScroll } from './components/ui/GlobalDragScroll';
import { useTheme } from './hooks/useTheme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TaskProvider } from './contexts/AppDataContext';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// These are code-split to keep the initial bundle small. Each page loads on demand.
const Employees = lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const Sites = lazy(() => import('./pages/Sites').then(m => ({ default: m.Sites })));
const SiteOnboarding = lazy(() => import('./pages/SiteOnboarding').then(m => ({ default: m.SiteOnboarding })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Payroll = lazy(() => import('./pages/Payroll').then(m => ({ default: m.Payroll })));
const ClientAccounts = lazy(() => import('./pages/ClientAccounts').then(m => ({ default: m.ClientAccounts })));
const Billing = lazy(() => import('./pages/Billing').then(m => ({ default: m.Billing })));
const Payments = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));
const VatPayments = lazy(() => import('./pages/VatPayments').then(m => ({ default: m.VatPayments })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const NewHire = lazy(() => import('./pages/NewHire').then(m => ({ default: m.NewHire })));
const GenerateContract = lazy(() => import('./pages/GenerateContract').then(m => ({ default: m.GenerateContract })));
const StartOffboarding = lazy(() => import('./pages/StartOffboarding').then(m => ({ default: m.StartOffboarding })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const FinancialReports = lazy(() => import('./pages/FinancialReports').then(m => ({ default: m.FinancialReports })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Leaves = lazy(() => import('./pages/Leaves').then(m => ({ default: m.Leaves })));
const LeaveSummary = lazy(() => import('./pages/LeaveSummary').then(m => ({ default: m.LeaveSummary })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const UserForm = lazy(() => import('./pages/UserForm').then(m => ({ default: m.UserForm })));
const SalaryLoans = lazy(() => import('./pages/SalaryLoans').then(m => ({ default: m.SalaryLoans })));
const Disciplinary = lazy(() => import('./pages/Disciplinary').then(m => ({ default: m.Disciplinary })));
const Evaluations = lazy(() => import('./pages/Evaluations').then(m => ({ default: m.Evaluations })));
const Ledger = lazy(() => import('./pages/Ledger').then(m => ({ default: m.Ledger })));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskDashboard = lazy(() => import('./pages/TaskDashboard'));
const TaskReminders = lazy(() => import('./pages/TaskReminders'));

// ── Suspense fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading…</p>
      </div>
    </div>
  );
}

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
  
  // Listen to realtime database changes so connected clients update instantly
  useRealtimeData(!!user);

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SuperAdminSetup />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="employees" element={<Employees />} />
          <Route path="sites" element={<Sites />} />
          <Route path="sites/onboarding/:id" element={<SiteOnboarding />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="client-accounts" element={<ClientAccounts />} />
          <Route path="invoices" element={<Navigate to="/client-accounts" replace />} />
          <Route path="payments" element={<Navigate to="/client-accounts" replace />} />
          <Route path="vat" element={<Navigate to="/client-accounts" replace />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="onboarding/new" element={<NewHire />} />
          <Route path="onboarding/contract" element={<GenerateContract />} />
          <Route path="onboarding/offboard" element={<StartOffboarding />} />
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
          <Route path="disciplinary" element={<Disciplinary />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="ledger" element={<Ledger />} />
          
          {/* Task Manager Module */}
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/dashboard" element={<TaskDashboard />} />
          <Route path="tasks/reminders" element={<TaskReminders />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const { isDark } = useTheme();
  return (
    <AuthProvider>
      <TaskProvider>
        <ErrorBoundary>
          <div className={`flex flex-col h-[100dvh] transition-colors duration-200 ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
            <TitleBar />
            <div className="flex-1 min-h-0 relative">
              <GlobalDragScroll />
              <ToastContainer />
              <ConfirmDialog />
              <HashRouter>
                <AppContent />
              </HashRouter>
            </div>
          </div>
        </ErrorBoundary>
      </TaskProvider>
    </AuthProvider>
  );
}
