/**
 * DCEL Office Suite — Automated User Manual Screenshot Capture Script
 * Standardized in accordance with the `app-docs` specification (1280x720, populated data states).
 *
 * Usage:
 *   1. Ensure the dev server is running: npm run dev (default http://localhost:3000)
 *   2. Run capture script: npx tsx scripts/capture-manual-screenshots.ts
 *
 * Environment Options:
 *   BASE_URL=http://localhost:3000  (Default: http://localhost:3000)
 *   HEADLESS=true                   (Set to false to watch browser crawl)
 *   AUTH_EMAIL=admin@dcel.com       (Optional user credentials for auto-login)
 *   AUTH_PASSWORD=password123
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteTarget {
  name: string;
  path: string;
  category: string;
  waitForSelector?: string;
}

const ROUTES: RouteTarget[] = [
  // ── Standalone & Dashboard
  { name: '01-home-launcher', path: '/home', category: 'General' },
  { name: '02-tasks-dashboard', path: '/tasks/dashboard', category: 'Dashboard' },

  // ── Clients & Recon
  { name: '03-client-360', path: '/client-360', category: 'Clients' },
  { name: '04-phonebook-directory', path: '/clients/phonebook', category: 'Clients' },
  { name: '05-machine-reconciliation', path: '/operations/machine-reconciliation', category: 'Clients' },
  { name: '06-site-analytics', path: '/operations/site-analytics', category: 'Clients' },

  // ── Communication & Field Logs
  { name: '07-task-register', path: '/tasks', category: 'Communication' },
  { name: '08-task-reminders', path: '/tasks/reminders', category: 'Communication' },
  { name: '09-external-comms-log', path: '/comm-log', category: 'Communication' },
  { name: '10-daily-journals', path: '/daily-journal', category: 'Communication' },
  { name: '11-meeting-minutes', path: '/minutes', category: 'Communication' },
  { name: '12-site-requests', path: '/operations/site-requests', category: 'Communication' },

  // ── Engineering Tools
  { name: '13-dewatercad-simulator', path: '/operations/simulator', category: 'Tools' },
  { name: '14-dewatering-calculator', path: '/operations/dewatering-calculator', category: 'Tools' },
  { name: '15-logistics-estimator', path: '/operations/estimator', category: 'Tools' },
  { name: '16-vat-calculator', path: '/operations/vat-calculator', category: 'Tools' },

  // ── Human Resources
  { name: '17-hr-dashboard', path: '/hr-dashboard', category: 'HR' },
  { name: '18-daily-attendance', path: '/attendance', category: 'HR' },
  { name: '19-employees-directory', path: '/employees', category: 'HR' },
  { name: '20-onboarding-pipeline', path: '/onboarding', category: 'HR' },
  { name: '21-onboarding-new-hire', path: '/onboarding/new', category: 'HR' },
  { name: '22-onboarding-contract', path: '/onboarding/contract', category: 'HR' },
  { name: '23-onboarding-offboard', path: '/onboarding/offboard', category: 'HR' },
  { name: '24-leaves-management', path: '/leaves', category: 'HR' },
  { name: '25-leave-summary-ledger', path: '/leave-summary', category: 'HR' },
  { name: '26-salary-loans', path: '/salary-loans', category: 'HR' },
  { name: '27-hmo-management', path: '/hmo', category: 'HR' },
  { name: '28-evaluations-scorecards', path: '/evaluations', category: 'HR' },
  { name: '29-interviews-ai-parser', path: '/interviews', category: 'HR' },
  { name: '30-performance-conduct', path: '/performance-conduct', category: 'HR' },

  // ── Operations & Yard
  { name: '31-operations-overview', path: '/operations', category: 'Operations' },
  { name: '32-assets-inventory', path: '/operations/assets', category: 'Operations' },
  { name: '33-transit-waybills', path: '/operations/waybills', category: 'Operations' },
  { name: '34-quick-checkout', path: '/operations/checkout', category: 'Operations' },
  { name: '35-maintenance-tickets', path: '/operations/maintenance', category: 'Operations' },
  { name: '36-diesel-refill-logs', path: '/operations/diesel', category: 'Operations' },
  { name: '37-vehicles-fleet', path: '/operations/vehicles', category: 'Operations' },
  { name: '38-sites-directory', path: '/operations/sites', category: 'Operations' },

  // ── Accounts & Finance
  { name: '39-client-accounts', path: '/client-accounts', category: 'Accounts' },
  { name: '40-payroll-engine', path: '/payroll', category: 'Accounts' },
  { name: '41-beneficiaries-casual-labor', path: '/beneficiaries', category: 'Accounts' },
  { name: '42-general-ledger', path: '/ledger', category: 'Accounts' },
  { name: '43-bank-ai-import', path: '/bank-import', category: 'Accounts' },
  { name: '44-vendor-invoices', path: '/vendor-invoices', category: 'Accounts' },
  { name: '45-corporate-budget', path: '/budget', category: 'Accounts' },

  // ── Reports & Administration
  { name: '46-hr-reports', path: '/reports', category: 'Reports' },
  { name: '47-financial-reports', path: '/financial-reports', category: 'Reports' },
  { name: '48-task-reports', path: '/tasks/reports', category: 'Reports' },
  { name: '49-weekly-report', path: '/weekly-report', category: 'Reports' },
  { name: '50-users-rbac', path: '/users', category: 'Settings' },
  { name: '51-system-settings', path: '/settings', category: 'Settings' },
  { name: '52-activity-log-audit', path: '/activity-log', category: 'Settings' },
];

async function captureManualScreenshots() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const isHeadless = process.env.HEADLESS !== 'false';
  const outputDir = path.resolve(process.cwd(), 'docs', 'user-manual', 'screenshots');

  console.log('====================================================');
  console.log('📸 DCEL Office Suite — User Manual Screenshot Crawler');
  console.log(`🌐 Target Base URL: ${baseUrl}`);
  console.log(`📁 Output Directory: ${outputDir}`);
  console.log(`🖥️ Viewport Standard: 1280 x 720 (app-docs standard)`);
  console.log('====================================================\n');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let chromium: any;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.error('❌ Playwright is not installed in the workspace.');
    console.error('To run automated screenshot capture, please install it:');
    console.error('  npm install -D playwright');
    console.error('  npx playwright install chromium\n');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: isHeadless,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // Retina 2x screenshot sharpness
  });

  const page = await context.newPage();

  try {
    // 1. Check if server is running
    console.log(`Connecting to ${baseUrl}...`);
    try {
      await page.goto(baseUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
    } catch (e: any) {
      console.error(`\n❌ Error: Could not connect to dev server at ${baseUrl}.`);
      console.error('Please make sure your Vite dev server is running with: npm run dev');
      await browser.close();
      process.exit(1);
    }

    // 2. Perform Login if on /login page
    if (page.url().includes('/login')) {
      const email = process.env.AUTH_EMAIL || 'admin@dcel.com';
      const password = process.env.AUTH_PASSWORD || 'password123';
      console.log(`Authenticating as ${email}...`);

      try {
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ timeout: 8000, waitUntil: 'networkidle' }).catch(() => {});
      } catch (err) {
        console.warn('⚠️ Auto-login form fields not matched or already authenticated.');
      }
    }

    // 3. Iterate through routes
    let capturedCount = 0;
    for (const route of ROUTES) {
      const targetUrl = `${baseUrl}${route.path}`;
      const filePath = path.join(outputDir, `${route.name}.png`);

      process.stdout.write(`Capturing [${route.category}] ${route.path} ... `);

      try {
        await page.goto(targetUrl, { timeout: 15000, waitUntil: 'networkidle' }).catch(async () => {
          await page.waitForTimeout(1000);
        });

        // Small stabilization pause to ensure charts/tables render without skeletons
        await page.waitForTimeout(600);

        if (route.waitForSelector) {
          await page.waitForSelector(route.waitForSelector, { timeout: 3000 }).catch(() => {});
        }

        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`✅ Saved (${route.name}.png)`);
        capturedCount++;
      } catch (routeErr: any) {
        console.log(`⚠️ Skipped (${routeErr.message || 'Timeout'})`);
      }
    }

    console.log('\n====================================================');
    console.log(`🎉 Finished! Successfully captured ${capturedCount} / ${ROUTES.length} screenshots.`);
    console.log(`Files located in: ${outputDir}`);
    console.log('====================================================');
  } catch (globalErr: any) {
    console.error('Fatal execution error:', globalErr);
  } finally {
    await browser.close();
  }
}

captureManualScreenshots().catch((err) => {
  console.error(err);
  process.exit(1);
});
