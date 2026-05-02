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
import { PageErrorBoundary } from './components/common/PageErrorBoundary';
import { TaskProvider } from './contexts/AppDataContext';
import { PageProvider } from './contexts/PageContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { IS_LIMITED_WEB_WEB } from './lib/utils';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// These are code-split to keep the initial bundle small. Each page loads on demand.
const Employees = lazy(() => import('./pages/Employees').then(m => ({ default: m.Employees })));
const Beneficiaries = lazy(() => import('./pages/Beneficiaries').then(m => ({ default: m.Beneficiaries })));
const Organogram = lazy(() => import('./pages/Organogram').then(m => ({ default: m.Organogram })));
const Sites = lazy(() => import('./pages/Sites').then(m => ({ default: m.Sites })));
const SiteDiary = lazy(() => import('./pages/SiteDiary').then(m => ({ default: m.SiteDiary })));
const SiteConversations = lazy(() => import('./pages/SiteConversations').then(m => ({ default: m.SiteConversations })));
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
const HmoManagement = lazy(() => import('./pages/HmoManagement').then(m => ({ default: m.HmoManagement })));
const PerformanceConduct = lazy(() => import('./pages/PerformanceConduct').then(m => ({ default: m.PerformanceConduct })));
const Evaluations = lazy(() => import('./pages/Evaluations').then(m => ({ default: m.Evaluations })));
const Ledger = lazy(() => import('./pages/Ledger').then(m => ({ default: m.Ledger })));
const CompanyExpenses = lazy(() => import('./pages/CompanyExpenses').then(m => ({ default: m.CompanyExpenses })));
const TaskDashboard = lazy(() => import('./pages/TaskDashboard').then(m => ({ default: m.TaskDashboard })));
const TaskReminders = lazy(() => import('./pages/TaskReminders').then(m => ({ default: m.TaskReminders })));
const Tasks = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const TaskReports = lazy(() => import('./pages/TaskReports').then(m => ({ default: m.TaskReports })));
const CommLog = lazy(() => import('./pages/CommLog').then(m => ({ default: m.CommLog })));
const DailyJournal = lazy(() => import('./pages/DailyJournal').then(m => ({ default: m.DailyJournal })));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport').then(m => ({ default: m.WeeklyReport })));
const TaskArchive = lazy(() => import('./pages/TaskArchive').then(m => ({ default: m.TaskArchive })));
const OperationsDashboard = lazy(() => import('./pages/OperationsDashboard').then(m => ({ default: m.Dashboard })));
const AssetManager = lazy(() => import('./pages/AssetManager').then(m => ({ default: m.AssetManager })));
const WaybillManager = lazy(() => import('./pages/WaybillManager').then(m => ({ default: m.WaybillManager })));
const SiteManager = lazy(() => import('./pages/SiteManager').then(m => ({ default: m.SiteManager })));
const QuickCheckout = lazy(() => import('./pages/QuickCheckout').then(m => ({ default: m.QuickCheckout })));
const MaintenanceManager = lazy(() => import('./pages/MaintenanceManager').then(m => ({ default: m.MaintenanceManager })));
const VehicleManager = lazy(() => import('./pages/VehicleManager').then(m => ({ default: m.VehicleManager })));
const EmployeeAnalytics = lazy(() => import('./pages/EmployeeAnalytics').then(m => ({ default: m.EmployeeAnalytics })));
const NotificationsPage = lazy(() => import('./pages/Notifications').then(m => ({ default: m.NotificationsPage })));
import { OperationsProvider } from './contexts/OperationsContext';
import { useVehicleDocumentSync } from './hooks/useVehicleDocumentSync';

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

// Helper: wrap a lazy page in its own Suspense + scoped error boundary
const Page = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <PageErrorBoundary label={label}>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </PageErrorBoundary>
);

import { useUserStore } from './store/userStore';

function RootRedirect() {
  const { user } = useAuth();
  const currentUser = useUserStore((s) => s.getCurrentUser());

  if (user && !currentUser) {
    return <PageLoader />;
  }

  if (currentUser) {
    const p = currentUser.privileges;
    
    // Waterfall redirect based on highest-priority modules
    if (p.tasks?.canViewDashboard) return <Navigate to="/tasks/dashboard" replace />;
    if (p.tasks?.canView) return <Navigate to="/tasks" replace />;
    if (p.dashboard?.canView) return <Navigate to="/hr-dashboard" replace />;
    if (p.operations?.canView) return <Navigate to="/operations" replace />;
    if (p.dailyJournal?.canView) return <Navigate to="/daily-journal" replace />;
    if (p.employees?.canView) return <Navigate to="/employees" replace />;
    if (p.sites?.canView) return <Navigate to="/sites" replace />;
    if (p.ledger?.canView) return <Navigate to="/ledger" replace />;
    if (p.weeklyReport?.canView) return <Navigate to="/weekly-report" replace />;
    if (p.leaves?.canView) return <Navigate to="/leaves" replace />;
    
    // Fallback: If they have minimal permissions, at least let them see their profile
    return <Navigate to="/profile" replace />;
  }

  return <Navigate to="/login" replace />;
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load data from Supabase when authenticated
  useDataLoader(!!user);
  
  // Listen to realtime database changes so connected clients update instantly
  useRealtimeData(!!user);

  // Auto-sync vehicle document expiries to tasks and reminders
  useVehicleDocumentSync();

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
        <Route index element={<RootRedirect />} />
        
        {/* ── Restricted Modules (Hidden in Web Build) ────────────────────────── */}
        {!IS_LIMITED_WEB_WEB && (
          <>
            <Route path="hr-dashboard" element={<Page label="HR Dashboard"><ProtectedRoute requiredModule="dashboard"><Dashboard /></ProtectedRoute></Page>} />
            <Route path="attendance" element={<Page label="Attendance"><ProtectedRoute requiredModule="attendance"><Attendance /></ProtectedRoute></Page>} />
            <Route path="employees" element={<Page label="Employees"><ProtectedRoute requiredModule="employees"><Employees /></ProtectedRoute></Page>} />
            <Route path="beneficiaries" element={<Page label="Beneficiaries"><ProtectedRoute requiredModule="beneficiaries"><Beneficiaries /></ProtectedRoute></Page>} />
            <Route path="organogram" element={<Page label="Organogram"><ProtectedRoute requiredModule="employees"><Organogram /></ProtectedRoute></Page>} />
            <Route path="sites" element={<Page label="Sites"><ProtectedRoute requiredModule="sites"><Sites /></ProtectedRoute></Page>} />
            <Route path="sites/diary/:siteId" element={<Page label="Site Diary"><ProtectedRoute requiredModule="sites"><SiteDiary /></ProtectedRoute></Page>} />
            <Route path="sites/conversations/:siteId" element={<Page label="Site Conversations"><ProtectedRoute requiredModule="sites"><SiteConversations /></ProtectedRoute></Page>} />
            <Route path="sites/onboarding/:id" element={<Page label="Site Onboarding"><ProtectedRoute requiredModule="sites"><SiteOnboarding /></ProtectedRoute></Page>} />
            <Route path="payroll" element={<Page label="Payroll"><ProtectedRoute requiredModule="payroll"><Payroll /></ProtectedRoute></Page>} />
            <Route path="client-accounts" element={<Page label="Client Accounts"><ProtectedRoute requiredModule="sites"><ClientAccounts /></ProtectedRoute></Page>} />
            <Route path="invoices" element={<Navigate to="/client-accounts" replace />} />
            <Route path="payments" element={<Navigate to="/client-accounts" replace />} />
            <Route path="vat" element={<Navigate to="/client-accounts" replace />} />
            <Route path="onboarding" element={<Page label="Onboarding"><ProtectedRoute requiredModule="onboarding"><Onboarding /></ProtectedRoute></Page>} />
            <Route path="onboarding/new" element={<Page label="New Hire"><ProtectedRoute requiredModule="onboarding"><NewHire /></ProtectedRoute></Page>} />
            <Route path="onboarding/contract" element={<Page label="Generate Contract"><ProtectedRoute requiredModule="onboarding"><GenerateContract /></ProtectedRoute></Page>} />
            <Route path="onboarding/offboard" element={<Page label="Offboarding"><ProtectedRoute requiredModule="onboarding"><StartOffboarding /></ProtectedRoute></Page>} />
            <Route path="reports" element={<Page label="Reports"><ProtectedRoute requiredModule="reports"><Reports /></ProtectedRoute></Page>} />
            <Route path="financial-reports" element={<Page label="Financial Reports"><ProtectedRoute requiredModule="financialReports"><FinancialReports /></ProtectedRoute></Page>} />
            <Route path="settings" element={<Page label="Settings"><ProtectedRoute requiredModule="variables"><Settings /></ProtectedRoute></Page>} />
            <Route path="variables" element={<Navigate to="/settings" replace />} />
            <Route path="leaves" element={<Page label="Leaves"><ProtectedRoute requiredModule="leaves"><Leaves /></ProtectedRoute></Page>} />
            <Route path="leave-summary" element={<Page label="Leave Summary"><ProtectedRoute requiredModule="leaves"><LeaveSummary /></ProtectedRoute></Page>} />
            <Route path="users" element={<Page label="Users"><ProtectedRoute requiredModule="users"><Users /></ProtectedRoute></Page>} />
            <Route path="users/new" element={<Page label="New User"><ProtectedRoute requiredModule="users"><UserForm /></ProtectedRoute></Page>} />
            <Route path="users/:id/edit" element={<Page label="Edit User"><ProtectedRoute requiredModule="users"><UserForm /></ProtectedRoute></Page>} />
            <Route path="salary-loans" element={<Page label="Salary & Loans"><ProtectedRoute requiredModule="salaryLoans"><SalaryLoans /></ProtectedRoute></Page>} />
            <Route path="hmo" element={<Page label="HMO Management"><ProtectedRoute requiredModule="hmo"><HmoManagement /></ProtectedRoute></Page>} />
            <Route path="performance-conduct" element={<Page label="Performance & Conduct"><ProtectedRoute requiredModule="disciplinary"><PerformanceConduct /></ProtectedRoute></Page>} />
            <Route path="evaluations" element={<Page label="Evaluations"><ProtectedRoute requiredModule="evaluations"><Evaluations /></ProtectedRoute></Page>} />
            <Route path="ledger" element={<Page label="Ledger"><ProtectedRoute requiredModule="ledger"><Ledger /></ProtectedRoute></Page>} />
            <Route path="clients" element={<Navigate to="/sites" replace />} />
            
            {/* Operations & Analytics — Restricted on Web */}
            <Route path="operations/*" element={
              <Page label="Operations">
                <ProtectedRoute requiredModule={['operations', 'opsInventory', 'opsWaybills', 'opsCheckout', 'opsMaintenance', 'opsVehicles', 'opsSites']}>
                  <>
                    <Routes>
                      <Route index element={<OperationsDashboard />} />
                      <Route path="assets" element={<ProtectedRoute requiredModule="opsInventory"><AssetManager /></ProtectedRoute>} />
                      <Route path="waybills" element={<ProtectedRoute requiredModule="opsWaybills"><WaybillManager /></ProtectedRoute>} />
                      <Route path="checkout" element={<ProtectedRoute requiredModule="opsCheckout"><QuickCheckout /></ProtectedRoute>} />
                      <Route path="maintenance" element={<ProtectedRoute requiredModule="opsMaintenance"><MaintenanceManager /></ProtectedRoute>} />
                      <Route path="vehicles" element={<ProtectedRoute requiredModule="opsVehicles"><VehicleManager /></ProtectedRoute>} />
                      <Route path="sites" element={<ProtectedRoute requiredModule="opsSites"><SiteManager /></ProtectedRoute>} />
                      <Route path="analytics" element={<ProtectedRoute requiredModule="opsCheckout"><EmployeeAnalytics /></ProtectedRoute>} />
                      <Route path="*" element={<Navigate to="/operations" replace />} />
                    </Routes>
                  </>
                </ProtectedRoute>
              </Page>
            } />
            <Route path="activity-log" element={<Page label="Activity Log"><ProtectedRoute requiredModule="activityLog"><ActivityLog /></ProtectedRoute></Page>} />
          </>
        )}

        {/* ── Shared Routes (Available in Web Build) ─────────────────────────── */}
        <Route path="profile" element={<Page label="Profile"><ProtectedRoute><Profile /></ProtectedRoute></Page>} />
        <Route path="company-expenses" element={<Page label="Company Expenses"><ProtectedRoute requiredModule="ledger"><CompanyExpenses /></ProtectedRoute></Page>} />
        
        <Route path="tasks" element={<Page label="Task Register"><ProtectedRoute requiredModule="tasks"><Tasks /></ProtectedRoute></Page>} />
        <Route path="tasks/dashboard" element={<Page label="Task Dashboard"><ProtectedRoute requiredModule="tasks"><TaskDashboard /></ProtectedRoute></Page>} />
        <Route path="tasks/reminders" element={<Page label="Task Reminders"><ProtectedRoute requiredModule="tasks"><TaskReminders /></ProtectedRoute></Page>} />
        <Route path="tasks/reports" element={<Page label="Task Reports"><ProtectedRoute requiredModule="tasks"><TaskReports /></ProtectedRoute></Page>} />
        <Route path="tasks/archive" element={<Page label="Task Archive"><ProtectedRoute requiredModule="tasks"><TaskArchive /></ProtectedRoute></Page>} />
        
        <Route path="comm-log" element={<Page label="Communication Log"><ProtectedRoute requiredModule="commLog"><CommLog /></ProtectedRoute></Page>} />
        <Route path="daily-journal" element={<Page label="Daily Journal"><ProtectedRoute requiredModule="dailyJournal"><DailyJournal /></ProtectedRoute></Page>} />
        <Route path="weekly-report" element={<Page label="Weekly Report"><ProtectedRoute requiredModule="sites"><WeeklyReport /></ProtectedRoute></Page>} />
        <Route path="notifications" element={<Page label="Notifications"><ProtectedRoute><NotificationsPage /></ProtectedRoute></Page>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { isDark } = useTheme();
  return (
    <AuthProvider>
      <TaskProvider>
        <PageProvider>
          <OperationsProvider>
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
        </OperationsProvider>
      </PageProvider>
      </TaskProvider>
    </AuthProvider>
  );
}
