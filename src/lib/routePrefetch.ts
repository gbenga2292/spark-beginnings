/**
 * Route-to-import map for intent-based prefetching.
 * When user hovers a sidebar link, we eagerly load the chunk.
 */
const routeImportMap: Record<string, () => Promise<any>> = {
  '/': () => import('@/src/pages/Dashboard'),
  '/attendance': () => import('@/src/pages/Attendance'),
  '/employees': () => import('@/src/pages/Employees'),
  '/leaves': () => import('@/src/pages/Leaves'),
  '/sites': () => import('@/src/pages/Sites'),
  '/onboarding': () => import('@/src/pages/Onboarding'),
  '/payroll': () => import('@/src/pages/Payroll'),
  '/client-accounts': () => import('@/src/pages/ClientAccounts'),
  '/reports': () => import('@/src/pages/Reports'),
  '/financial-reports': () => import('@/src/pages/FinancialReports'),
  '/settings': () => import('@/src/pages/Settings'),
  '/users': () => import('@/src/pages/Users'),
  '/salary-loans': () => import('@/src/pages/SalaryLoans'),
  '/performance-conduct': () => import('@/src/pages/PerformanceConduct'),
  '/evaluations': () => import('@/src/pages/Evaluations'),
  '/ledger': () => import('@/src/pages/Ledger'),
  '/company-expenses': () => import('@/src/pages/CompanyExpenses'),
  '/tasks': () => import('@/src/pages/Tasks'),
  '/tasks/dashboard': () => import('@/src/pages/TaskDashboard'),
  '/tasks/reminders': () => import('@/src/pages/TaskReminders'),
  '/tasks/reports': () => import('@/src/pages/TaskReports'),
  '/comm-log': () => import('@/src/pages/CommLog'),
  '/operations': () => import('@/src/pages/OperationsDashboard'),
  '/operations/assets': () => import('@/src/pages/AssetManager'),
  '/operations/waybills': () => import('@/src/pages/WaybillManager'),
  '/operations/checkout': () => import('@/src/pages/QuickCheckout'),
  '/operations/maintenance': () => import('@/src/pages/MaintenanceManager'),
  '/operations/sites': () => import('@/src/pages/SiteManager'),
  '/beneficiaries': () => import('@/src/pages/Beneficiaries'),
  '/activity-log': () => import('@/src/pages/ActivityLog'),
  '/profile': () => import('@/src/pages/Profile'),
};

const prefetched = new Set<string>();

/**
 * Prefetch the JS chunk for a route. Safe to call multiple times — only fetches once.
 */
export function prefetchRoute(href: string) {
  if (prefetched.has(href)) return;
  const loader = routeImportMap[href];
  if (loader) {
    prefetched.add(href);
    loader().catch(() => {
      // Silently ignore — user may be offline
      prefetched.delete(href);
    });
  }
}
