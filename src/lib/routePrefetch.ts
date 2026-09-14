/**
 * Route-to-import map for intent-based and idle prefetching.
 * When user hovers or touches any navigation link, or during idle browser time,
 * we eagerly load the JS chunk so route transitions are instant with zero lag or spinner.
 */
const routeImportMap: Record<string, () => Promise<any>> = {
  '/': () => import('@/src/pages/HomePage'),
  '/home': () => import('@/src/pages/HomePage'),
  '/hr-dashboard': () => import('@/src/pages/Dashboard'),
  '/attendance': () => import('@/src/pages/Attendance'),
  '/employees': () => import('@/src/pages/Employees'),
  '/beneficiaries': () => import('@/src/pages/Beneficiaries'),
  '/organogram': () => import('@/src/pages/Organogram'),
  '/leaves': () => import('@/src/pages/Leaves'),
  '/leave-summary': () => import('@/src/pages/LeaveSummary'),
  '/sites': () => import('@/src/pages/Sites'),
  '/client-360': () => import('@/src/pages/Client360'),
  '/onboarding': () => import('@/src/pages/Onboarding'),
  '/onboarding/new': () => import('@/src/pages/NewHire'),
  '/onboarding/contract': () => import('@/src/pages/GenerateContract'),
  '/onboarding/offboard': () => import('@/src/pages/StartOffboarding'),
  '/payroll': () => import('@/src/pages/Payroll'),
  '/client-accounts': () => import('@/src/pages/ClientAccounts'),
  '/reports': () => import('@/src/pages/Reports'),
  '/financial-reports': () => import('@/src/pages/FinancialReports'),
  '/settings': () => import('@/src/pages/Settings'),
  '/users': () => import('@/src/pages/Users'),
  '/salary-loans': () => import('@/src/pages/SalaryLoans'),
  '/hmo': () => import('@/src/pages/HmoManagement'),
  '/performance-conduct': () => import('@/src/pages/PerformanceConduct'),
  '/evaluations': () => import('@/src/pages/Evaluations'),
  '/interviews': () => import('@/src/pages/InterviewManager'),
  '/ledger': () => import('@/src/pages/Ledger'),
  '/bank-import': () => import('@/src/pages/BankImport'),
  '/company-expenses': () => import('@/src/pages/CompanyExpenses'),
  '/tasks': () => import('@/src/pages/Tasks'),
  '/tasks/dashboard': () => import('@/src/pages/TaskDashboard'),
  '/tasks/reminders': () => import('@/src/pages/TaskReminders'),
  '/tasks/reports': () => import('@/src/pages/TaskReports'),
  '/tasks/archive': () => import('@/src/pages/TaskArchive'),
  '/comm-log': () => import('@/src/pages/CommLog'),
  '/daily-journal': () => import('@/src/pages/DailyJournal'),
  '/weekly-report': () => import('@/src/pages/WeeklyReport'),
  '/notifications': () => import('@/src/pages/Notifications'),
  '/budget': () => import('@/src/pages/Budget'),
  '/operations': () => import('@/src/pages/OperationsDashboard'),
  '/operations/assets': () => import('@/src/pages/AssetManager'),
  '/operations/waybills': () => import('@/src/pages/WaybillManager'),
  '/operations/checkout': () => import('@/src/pages/QuickCheckout'),
  '/operations/maintenance': () => import('@/src/pages/MaintenanceManager'),
  '/operations/diesel': () => import('@/src/pages/DieselRefillManager'),
  '/operations/vehicles': () => import('@/src/pages/VehicleManager'),
  '/operations/sites': () => import('@/src/pages/SiteManager'),
  '/operations/analytics': () => import('@/src/pages/EmployeeAnalytics'),
  '/operations/site-analytics': () => import('@/src/pages/ActiveSiteAnalytics'),
  '/site-analytics': () => import('@/src/pages/ActiveSiteAnalytics'),
  '/operations/simulator': () => import('@/src/pages/Simulator'),
  '/operations/estimator': () => import('@/src/pages/Estimator'),
  '/operations/machine-reconciliation': () => import('@/src/pages/MachineReconciliation'),
  '/activity-log': () => import('@/src/pages/ActivityLog'),
  '/profile': () => import('@/src/pages/Profile'),
};

const prefetched = new Set<string>();

/**
 * Prefetch the JS chunk for a route. Safe to call multiple times — only fetches once.
 */
export function prefetchRoute(href: string) {
  if (!href) return;
  const cleanHref = href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (prefetched.has(cleanHref)) return;

  // Direct match or parent prefix match
  let loader = routeImportMap[cleanHref];
  if (!loader) {
    const segments = cleanHref.split('/');
    while (segments.length > 1) {
      segments.pop();
      const parent = segments.join('/') || '/';
      if (routeImportMap[parent]) {
        loader = routeImportMap[parent];
        break;
      }
    }
  }

  if (loader) {
    prefetched.add(cleanHref);
    loader().catch(() => {
      // Allow retry if there was a temporary network blip
      prefetched.delete(cleanHref);
    });
  }
}

// Eagerly prefetch core modules in the background during idle time
// so navigation is instantaneous with ZERO loading spinners
if (typeof window !== 'undefined') {
  const scheduleIdle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1200));
  scheduleIdle(() => {
    const coreRoutes = [
      '/tasks/dashboard',
      '/tasks',
      '/hr-dashboard',
      '/attendance',
      '/employees',
      '/operations',
      '/comm-log',
      '/client-accounts',
      '/payroll',
      '/sites',
      '/client-360',
      '/operations/site-analytics',
      '/daily-journal',
      '/weekly-report',
      '/ledger',
      '/company-expenses',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < coreRoutes.length) {
        prefetchRoute(coreRoutes[idx++]);
      } else {
        clearInterval(interval);
      }
    }, 120);
  });
}
