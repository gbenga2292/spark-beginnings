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
import { ProtectedRoute } from './components/common/ProtectedRoute';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// These are code-split to keep the initial bundle small. Each page loads on demand.
const Employees = lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const Beneficiaries = lazy(() => import('./pages/Beneficiaries').then(m => ({ default: m.Beneficiaries })));
const Organogram = lazy(() => import('./pages/Organogram').then(m => ({ default: m.Organogram })));
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
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((m) => ({ default: m.ActivityLog })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Leaves = lazy(() => import('./pages/Leaves').then(m => ({ default: m.Leaves })));
const LeaveSummary = lazy(() => import('./pages/LeaveSummary').then(m => ({ default: m.LeaveSummary })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const UserForm = lazy(() => import('./pages/UserForm').then(m => ({ default: m.UserForm })));
const SalaryLoans = lazy(() => import('./pages/SalaryLoans').then(m => ({ default: m.SalaryLoans })));
const Disciplinary = lazy(() => import('./pages/Disciplinary').then(m => ({ default: m.Disciplinary })));
const Evaluations = lazy(() => import('./pages/Evaluations').then(m => ({ default: m.Evaluations })));
const Ledger = lazy(() => import('./pages/Ledger').then(m => ({ default: m.Ledger })));
const CompanyExpenses = lazy(() => import('./pages/CompanyExpenses').then(m => ({ default: m.CompanyExpenses })));
const TaskDashboard = lazy(() => import('./pages/TaskDashboard'));
const TaskReminders = lazy(() => import('./pages/TaskReminders'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskReports = lazy(() => import('./pages/TaskReports'));
const CommLog = lazy(() => import('./pages/CommLog').then(m => ({ default: m.CommLog })));
const OperationsDashboard = lazy(() => import('./operations/components/Dashboard').then(m => ({ default: m.Dashboard })));
const AssetManager = lazy(() => import('./operations/components/AssetManager').then(m => ({ default: m.AssetManager })));
const WaybillManager = lazy(() => import('./operations/components/WaybillManager').then(m => ({ default: m.WaybillManager })));
const SiteManager = lazy(() => import('./operations/components/SiteManager').then(m => ({ default: m.SiteManager })));
const QuickCheckout = lazy(() => import('./operations/components/QuickCheckout').then(m => ({ default: m.QuickCheckout })));
const MaintenanceManager = lazy(() => import('./operations/components/MaintenanceManager').then(m => ({ default: m.MaintenanceManager })));
const EmployeeAnalytics = lazy(() => import('./operations/components/EmployeeAnalytics').then(m => ({ default: m.EmployeeAnalytics })));
import { OperationsProvider } from './operations/contexts/OperationsContext';

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
          <Route index element={<ProtectedRoute requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute requiredModule="attendance"><Attendance /></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute requiredModule="employees"><Employees /></ProtectedRoute>} />
          <Route path="beneficiaries" element={<ProtectedRoute requiredModule="payroll"><Beneficiaries /></ProtectedRoute>} />
          <Route path="organogram" element={<ProtectedRoute requiredModule="employees"><Organogram /></ProtectedRoute>} />
          <Route path="sites" element={<ProtectedRoute requiredModule="sites"><Sites /></ProtectedRoute>} />
          <Route path="sites/onboarding/:id" element={<ProtectedRoute requiredModule="sites"><SiteOnboarding /></ProtectedRoute>} />
          <Route path="payroll" element={<ProtectedRoute requiredModule="payroll"><Payroll /></ProtectedRoute>} />
          <Route path="client-accounts" element={<ProtectedRoute requiredModule="sites"><ClientAccounts /></ProtectedRoute>} />
          <Route path="invoices" element={<Navigate to="/client-accounts" replace />} />
          <Route path="payments" element={<Navigate to="/client-accounts" replace />} />
          <Route path="vat" element={<Navigate to="/client-accounts" replace />} />
          <Route path="onboarding" element={<ProtectedRoute requiredModule="onboarding"><Onboarding /></ProtectedRoute>} />
          <Route path="onboarding/new" element={<ProtectedRoute requiredModule="onboarding"><NewHire /></ProtectedRoute>} />
          <Route path="onboarding/contract" element={<ProtectedRoute requiredModule="onboarding"><GenerateContract /></ProtectedRoute>} />
          <Route path="onboarding/offboard" element={<ProtectedRoute requiredModule="onboarding"><StartOffboarding /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute requiredModule="reports"><Reports /></ProtectedRoute>} />
          <Route path="financial-reports" element={<ProtectedRoute requiredModule="financialReports"><FinancialReports /></ProtectedRoute>} />
          {/* Using variables for default Settings view */}
          <Route path="settings" element={<ProtectedRoute requiredModule="variables"><Settings /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="variables" element={<Navigate to="/settings" replace />} />
          <Route path="leaves" element={<ProtectedRoute requiredModule="leaves"><Leaves /></ProtectedRoute>} />
          <Route path="leave-summary" element={<ProtectedRoute requiredModule="leaves"><LeaveSummary /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute requiredModule="users"><Users /></ProtectedRoute>} />
          <Route path="users/new" element={<ProtectedRoute requiredModule="users"><UserForm /></ProtectedRoute>} />
          <Route path="users/:id/edit" element={<ProtectedRoute requiredModule="users"><UserForm /></ProtectedRoute>} />
          <Route path="salary-loans" element={<ProtectedRoute requiredModule="salaryLoans"><SalaryLoans /></ProtectedRoute>} />
          <Route path="disciplinary" element={<ProtectedRoute requiredModule="disciplinary"><Disciplinary /></ProtectedRoute>} />
          <Route path="evaluations" element={<ProtectedRoute requiredModule="evaluations"><Evaluations /></ProtectedRoute>} />
          <Route path="ledger" element={<ProtectedRoute requiredModule="ledger"><Ledger /></ProtectedRoute>} />
          <Route path="company-expenses" element={<ProtectedRoute requiredModule="ledger"><CompanyExpenses /></ProtectedRoute>} />
          
          {/* Task Manager Module */}
          <Route path="tasks" element={<ProtectedRoute requiredModule="tasks"><Tasks /></ProtectedRoute>} />
          <Route path="tasks/dashboard" element={<ProtectedRoute requiredModule="tasks"><TaskDashboard /></ProtectedRoute>} />
          <Route path="tasks/reminders" element={<ProtectedRoute requiredModule="tasks"><TaskReminders /></ProtectedRoute>} />
          <Route path="tasks/reports" element={<ProtectedRoute requiredModule="tasks"><TaskReports /></ProtectedRoute>} />

          <Route path="comm-log" element={<ProtectedRoute requiredModule="sites"><CommLog /></ProtectedRoute>} />

          {/* Operations Module - Direct Routes */}
          <Route path="operations/*" element={
            <ProtectedRoute requiredModule="operations">
              <OperationsProvider>
                <Routes>
                  <Route index element={<OperationsDashboard />} />
                  <Route path="assets" element={<AssetManager />} />
                  <Route path="waybills" element={<WaybillManager />} />
                  <Route path="checkout" element={<QuickCheckout />} />
                  <Route path="maintenance" element={<MaintenanceManager />} />
                  <Route path="sites" element={<SiteManager />} />
                  <Route path="*" element={<Navigate to="/operations" replace />} />
                </Routes>
              </OperationsProvider>
            </ProtectedRoute>
          } />

          <Route path="activity-log" element={<ProtectedRoute requiredModule="variables"><ActivityLog /></ProtectedRoute>} />
          
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
