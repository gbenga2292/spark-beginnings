const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs', 'user-manual', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const SCREENS = [
  { name: '02-dashboard', path: '/tasks/dashboard', title: 'Task Dashboard & Daily Overview' },
  { name: '03-daily-register', path: '/attendance', title: 'Daily Attendance Register' },
  { name: '04-employees', path: '/employees', title: 'Employee Directory & Staff Records' },
  { name: '05-onboarding', path: '/onboarding', title: 'Employee Onboarding & Contracts' },
  { name: '06-leaves', path: '/leaves', title: 'Leave & Vacation Requests' },
  { name: '07-salary-loans', path: '/salary-loans', title: 'Salary Advances & Loans' },
  { name: '08-hmo', path: '/hmo', title: 'HMO Health Insurance Management' },
  { name: '09-payroll', path: '/payroll', title: 'Monthly Payroll Engine' },
  { name: '10-client-accounts', path: '/client-accounts', title: 'Client Invoicing & Accounts' },
  { name: '11-beneficiaries', path: '/beneficiaries', title: 'Non-Employee Directory & Casual Labor' },
  { name: '12-ledger', path: '/ledger', title: 'General Ledger & Company Expenses' },
  { name: '13-bank-import', path: '/bank-import', title: 'Bank Statement AI Import' },
  { name: '14-operations-overview', path: '/operations', title: 'Operations Overview' },
  { name: '15-assets-inventory', path: '/operations/assets', title: 'Machinery & Equipment Inventory' },
  { name: '16-waybills', path: '/operations/waybills', title: 'Transit Waybills Register' },
  { name: '17-checkout', path: '/operations/checkout', title: 'Tool Quick Checkout Kiosk' },
  { name: '18-maintenance', path: '/operations/maintenance', title: 'Preventive Maintenance & Servicing' },
  { name: '19-diesel-refill', path: '/operations/diesel', title: 'Diesel Refill & Fuel Tracking' },
  { name: '20-vehicles', path: '/operations/vehicles', title: 'Fleet Vehicles Management' },
  { name: '21-client-360', path: '/client-360', title: 'Client 360 Dossier' },
  { name: '22-phonebook', path: '/clients/phonebook', title: 'Business Phonebook & Card Scanner' },
  { name: '23-sites-list', path: '/operations/sites', title: 'Project Sites Directory' },
  { name: '24-dewatercad-simulator', path: '/operations/simulator', title: 'DewaterCAD Simulator Canvas' },
  { name: '25-dewatering-calculator', path: '/operations/dewatering-calculator', title: 'Hydraulic Dewatering Calculator' },
  { name: '26-task-register', path: '/tasks', title: 'Task Register & Work Orders' },
  { name: '27-task-reminders', path: '/tasks/reminders', title: 'Task Reminders & Alerts' },
  { name: '28-minutes', path: '/minutes', title: 'Meeting Minutes Registry' },
  { name: '29-site-requests', path: '/operations/site-requests', title: 'Field Requisitions & Site Requests' },
  { name: '30-weekly-report', path: '/weekly-report', title: 'Executive Weekly Summary' },
  { name: '31-hr-reports', path: '/reports', title: 'Human Resources Reports' },
  { name: '32-financial-reports', path: '/financial-reports', title: 'Financial Accounting Reports' },
  { name: '33-users-management', path: '/users', title: 'User Accounts & Access Control' },
  { name: '34-settings', path: '/settings', title: 'System Settings & Variables' },
  { name: '35-activity-log', path: '/activity-log', title: 'System Activity Audit Log' }
];

async function captureAll() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log('====================================================');
  console.log('📸 DCEL Office Suite — Live Application Screen Capture');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // 1. Visit Login Page & Capture Pre-Login Screenshot
  console.log('Navigating to login page: http://localhost:3000/#/login ...');
  await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0', timeout: 25000 });
  await new Promise(r => setTimeout(r, 1000));
  
  const loginFile = path.join(SCREENSHOTS_DIR, '01-login-screen.png');
  await page.screenshot({ path: loginFile });
  console.log(`✅ Saved 01-login-screen.png`);

  // Fill credentials
  console.log('Submitting credentials for tundealonge@dewaterconstruct.com ...');
  await page.waitForSelector('input#email', { timeout: 10000 });
  await page.click('input#email', { clickCount: 3 });
  await page.type('input#email', 'tundealonge@dewaterconstruct.com');

  await page.waitForSelector('input#password', { timeout: 10000 });
  await page.click('input#password', { clickCount: 3 });
  await page.type('input#password', 'stargate');

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  ]);

  await new Promise(r => setTimeout(r, 3000));
  console.log('Authentication complete. Dismissing popup modals and briefings...\n');

  // Dismiss briefing modal if open
  await page.evaluate(() => {
    try {
      // Find and click any 'Close' button
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
      
      // Also mark session storage so it doesn't pop up again
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes('user')) {
          sessionStorage.setItem(`dcel_briefing_session_shown_${k}_${today}`, 'true');
        }
      }
    } catch (e) {}
  });
  await new Promise(r => setTimeout(r, 1000));

  let captured = 1; // 01-login-screen already saved
  for (const scr of SCREENS) {
    const targetUrl = `http://localhost:3000/#${scr.path}`;
    const targetFile = path.join(SCREENSHOTS_DIR, `${scr.name}.png`);

    process.stdout.write(`Capturing [${scr.name}] ${scr.title} ... `);
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
      
      // Allow tables, metrics, and cards to render
      await new Promise(r => setTimeout(r, 1500));

      // Dismiss any lingering briefing modals or dropdowns
      await page.evaluate(() => {
        try {
          const btns = Array.from(document.querySelectorAll('button'));
          const closeBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Close');
          if (closeBtn) closeBtn.click();
        } catch (e) {}
      });
      await new Promise(r => setTimeout(r, 300));

      await page.screenshot({ path: targetFile });
      console.log('✅ Done');
      captured++;
    } catch (err) {
      console.log(`⚠️ Skipped (${err.message})`);
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 Finished! Captured ${captured} live application screenshots!`);
  console.log(`Location: ${SCREENSHOTS_DIR}`);
  console.log('====================================================');

  await browser.close();
}

captureAll().catch(err => {
  console.error('Fatal crawler error:', err);
  process.exit(1);
});
