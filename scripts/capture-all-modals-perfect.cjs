const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs', 'user-manual', 'screenshots');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log('====================================================');
  console.log('📸 DCEL Office Suite — High-Resolution Form Modal Captures');
  console.log('⚠️ SAFETY GUARANTEE: NO DATABASE WRITES OR FORM SUBMITS');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1440, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Helper to trigger React controlled inputs
  async function fillInput(selector, value) {
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, value);
  }

  async function fillTextarea(selector, value) {
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector, value);
  }

  try {
    // 1. Authenticate
    console.log('Authenticating...');
    await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input#email');
    await page.type('input#email', 'tundealonge@dewaterconstruct.com');
    await page.type('input#password', 'stargate');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    // Dismiss briefing popup
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const closeBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });

    // -------------------------------------------------------------
    // CAPTURE 1: Leave Application Form Modal (Filled)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 06-leaves-modal.png ---');
    await page.goto('http://localhost:3000/#/leaves', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    await page.waitForSelector('button.bg-teal-600', { timeout: 10000 });
    await page.click('button.bg-teal-600');
    console.log('Opened Leave Application Modal.');
    await new Promise(r => setTimeout(r, 1500));

    // Populate modal
    await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      if (!modal) return;

      const selects = modal.querySelectorAll('select');
      if (selects[0] && selects[0].options.length > 2) {
        selects[0].selectedIndex = 2; // Employee
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Check Annual radio
      const labels = Array.from(modal.querySelectorAll('label'));
      const annualLabel = labels.find(l => l.textContent && l.textContent.toLowerCase().includes('annual'));
      if (annualLabel) annualLabel.click();

      // Relieving staff
      if (selects[2] && selects[2].options.length > 1) {
        selects[2].selectedIndex = 1;
        selects[2].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await fillTextarea('.fixed.inset-0 textarea', 'Annual family vacation leave and personal rest.');
    await fillInput('.fixed.inset-0 input[type="date"]', '2026-11-02');
    await fillInput('.fixed.inset-0 input[type="number"]', '10');

    await new Promise(r => setTimeout(r, 1200));
    const leaveFile = path.join(SCREENSHOTS_DIR, '06-leaves-modal.png');
    await page.screenshot({ path: leaveFile });
    console.log('✅ Saved 06-leaves-modal.png (NO SUBMISSION CLICKED)');

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // CAPTURE 2: Transit Waybill Creation Form (Populated)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 16-waybill-modal.png ---');
    await page.goto('http://localhost:3000/#/operations/waybills', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    // Click Create Waybill
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Create Waybill'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Populate Waybill Form
    await page.evaluate(() => {
      // Select Site
      const selects = document.querySelectorAll('select');
      if (selects[0] && selects[0].options.length > 1) {
        selects[0].selectedIndex = 1; // Site
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (selects[1] && selects[1].options.length > 1) {
        selects[1].selectedIndex = 1; // Driver
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (selects[2] && selects[2].options.length > 1) {
        selects[2].selectedIndex = 1; // Vehicle
        selects[2].dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Click "+ Add Item" button
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent && b.textContent.includes('Add Item'));
      if (addBtn) addBtn.click();
    });

    await new Promise(r => setTimeout(r, 1000));

    // Select asset for the item
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      // The last select added is the asset select
      const lastSelect = selects[selects.length - 1];
      if (lastSelect && lastSelect.options.length > 1) {
        lastSelect.selectedIndex = 1;
        lastSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    const waybillFile = path.join(SCREENSHOTS_DIR, '16-waybill-modal.png');
    await page.screenshot({ path: waybillFile });
    console.log('✅ Saved 16-waybill-modal.png (NO SUBMISSION CLICKED)');

    // -------------------------------------------------------------
    // CAPTURE 3: Task Creation Dialog (Filled)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 26-task-create-dialog.png ---');
    await page.goto('http://localhost:3000/#/tasks', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.toLowerCase().includes('new task'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0');
      if (!dialog) return;

      const input = dialog.querySelector('input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, 'Service 150kVA Perkins Generator at Dangote Site');
        else input.value = 'Service 150kVA Perkins Generator at Dangote Site';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const textarea = dialog.querySelector('textarea');
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(textarea, 'Carry out standard 250-hour preventative maintenance overhaul: replace engine oil, fuel filters, and test load transfer switch.');
        else textarea.value = 'Carry out standard 250-hour preventative maintenance overhaul: replace engine oil, fuel filters, and test load transfer switch.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    const taskFile = path.join(SCREENSHOTS_DIR, '26-task-create-dialog.png');
    await page.screenshot({ path: taskFile });
    console.log('✅ Saved 26-task-create-dialog.png (NO SAVE CLICKED)');

    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // CAPTURE 4: Site Requisitions Dialog (Filled)
    // -------------------------------------------------------------
    console.log('\n--- Capturing 29-site-request-modal.png ---');
    await page.goto('http://localhost:3000/#/operations/site-requests', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('New Request'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0');
      if (!dialog) return;

      const inputs = dialog.querySelectorAll('input');
      if (inputs[0]) {
        inputs[0].value = 'Emergency 2,000L Diesel Refill for Sykes Dewatering Pump';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = '2,000 Liters';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }

      const textarea = dialog.querySelector('textarea');
      if (textarea) {
        textarea.value = 'Required for 48-hour non-stop dewatering of basement excavation pit during foundation concrete pour.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 1200));
    const reqFile = path.join(SCREENSHOTS_DIR, '29-site-request-modal.png');
    await page.screenshot({ path: reqFile });
    console.log('✅ Saved 29-site-request-modal.png (NO SUBMISSION CLICKED)');

    console.log('\n====================================================');
    console.log('🎉 ALL PERFECT INTERACTIVE SCREENSHOTS CAPTURED SAFELY!');
    console.log('====================================================');

  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

run();
