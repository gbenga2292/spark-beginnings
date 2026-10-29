/**
 * DCEL Office Suite — PDF Instruction Manual Compiler
 * Compiles all modular chapters under docs/user-manual/ into a publication-grade,
 * unified print document and renders it to PDF via Chromium/Edge headless engine.
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { marked } from 'marked';

const DOCS_DIR = path.resolve(process.cwd(), 'docs', 'user-manual');
const OUTPUT_HTML = path.join(DOCS_DIR, 'DCEL_OFFICE_SUITE_MANUAL.html');
const OUTPUT_PDF = path.join(DOCS_DIR, 'DCEL_OFFICE_SUITE_INSTRUCTION_MANUAL.pdf');

const CHAPTERS = [
  { id: 'atlas', title: 'Screen Directory & Navigation Guide', file: 'APP_ATLAS.md' },
  { id: 'ch1', title: 'Chapter 1: Getting Started & Using the App', file: '01-GETTING-STARTED.md' },
  { id: 'ch2', title: 'Chapter 2: Human Resources & Staff Management', file: '02-HR-AND-WORKFORCE.md' },
  { id: 'ch3', title: 'Chapter 3: Finance, Payroll & Invoicing', file: '03-FINANCE-PAYROLL-AND-ACCOUNTS.md' },
  { id: 'ch4', title: 'Chapter 4: Operations, Machinery & Diesel Fuel', file: '04-OPERATIONS-AND-ASSETS.md' },
  { id: 'ch5', title: 'Chapter 5: Clients, Site Diaries & DewaterCAD', file: '05-CLIENTS-AND-SITE-ENGINEERING.md' },
  { id: 'ch6', title: 'Chapter 6: Tasks, Team Chat & Meeting Minutes', file: '06-TASKS-AND-COMMUNICATIONS.md' },
  { id: 'ch7', title: 'Chapter 7: Reports, User Accounts & Settings', file: '07-REPORTS-AND-ADMINISTRATION.md' },
  { id: 'ch8', title: 'Chapter 8: Everyday Help & Frequently Asked Questions', file: '08-TROUBLESHOOTING-AND-FAQ.md' },
];

function transformAlerts(html) {
  // Convert GitHub style blockquote alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  return html
    .replace(/<blockquote>\s*<p>\s*\[!NOTE\]([\s\S]*?)<\/blockquote>/gi, '<div class="alert alert-note"><div class="alert-title">ℹ️ NOTE</div><p>$1</div>')
    .replace(/<blockquote>\s*<p>\s*\[!TIP\]([\s\S]*?)<\/blockquote>/gi, '<div class="alert alert-tip"><div class="alert-title">💡 TIP</div><p>$1</div>')
    .replace(/<blockquote>\s*<p>\s*\[!IMPORTANT\]([\s\S]*?)<\/blockquote>/gi, '<div class="alert alert-important"><div class="alert-title">⭐ IMPORTANT</div><p>$1</div>')
    .replace(/<blockquote>\s*<p>\s*\[!WARNING\]([\s\S]*?)<\/blockquote>/gi, '<div class="alert alert-warning"><div class="alert-title">⚠️ WARNING</div><p>$1</div>')
    .replace(/<blockquote>\s*<p>\s*\[!CAUTION\]([\s\S]*?)<\/blockquote>/gi, '<div class="alert alert-caution"><div class="alert-title">🛑 CAUTION</div><p>$1</div>');
}

async function compileManual() {
  console.log('====================================================');
  console.log('📖 Compiling DCEL Office Suite Instruction Manual PDF');
  console.log('====================================================\n');

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  let chaptersHtml = '';

  for (const ch of CHAPTERS) {
    const filePath = path.join(DOCS_DIR, ch.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Warning: Chapter file not found: ${ch.file}`);
      continue;
    }
    console.log(`Processing ${ch.title} ...`);
    const rawMd = fs.readFileSync(filePath, 'utf-8');
    
    // Remove individual front-matter or leading metadata block if present
    const cleanMd = rawMd.replace(/^---[\s\S]*?---\n*/, '');
    let renderedHtml = marked.parse(cleanMd);
    renderedHtml = transformAlerts(renderedHtml);

    chaptersHtml += `
      <section class="chapter-break" id="${ch.id}">
        ${renderedHtml}
      </section>
    `;
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="file:///${DOCS_DIR.replace(/\\/g, '/')}/">
  <title>DCEL Office Suite — Comprehensive Instruction Manual</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: "Page " counter(page);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
      @bottom-left {
        content: "DCEL Office Suite — Official Instruction Manual (v1.5.3+)";
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* ── Cover Page ── */
    .cover-page {
      page-break-after: always;
      break-after: page;
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 3px solid #1e3a8a;
      border-radius: 8px;
      padding: 48px 40px;
      background: linear-gradient(175deg, #ffffff 0%, #f8fafc 100%);
    }

    .cover-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 20px;
    }

    .company-name {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0369a1;
      text-transform: uppercase;
      margin: 0;
    }

    .company-sub {
      font-size: 9pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 4px;
    }

    .cover-body {
      margin: 60px 0;
    }

    .doc-badge {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .doc-title {
      font-size: 28pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.15;
      margin: 0 0 16px 0;
    }

    .doc-subtitle {
      font-size: 13pt;
      color: #334155;
      line-height: 1.45;
      max-width: 650px;
      margin: 0;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      background: #f1f5f9;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #0284c7;
      margin-top: 30px;
    }

    .meta-item {
      font-size: 9pt;
    }

    .meta-label {
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }

    .meta-val {
      color: #0f172a;
      font-weight: 600;
      margin-top: 2px;
    }

    .cover-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 16px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }

    /* ── Table of Contents ── */
    .toc-page {
      page-break-after: always;
      break-after: page;
      padding-top: 20px;
    }

    .toc-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 24px;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 10px 0;
      border-bottom: 1px dashed #cbd5e1;
      font-size: 10pt;
    }

    .toc-name {
      font-weight: 600;
      color: #0f172a;
    }

    .toc-file {
      font-size: 8.5pt;
      color: #64748b;
      font-family: monospace;
    }

    /* ── Headings & Sectioning ── */
    .chapter-break {
      page-break-before: always;
      break-before: page;
      padding-top: 10px;
    }

    h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 16px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #0369a1;
      margin-top: 28px;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h3 {
      font-size: 11.5pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 20px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h4 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    p {
      margin: 0 0 10px 0;
      text-align: justify;
    }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.5px;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* ── Code Blocks & ASCII Schematics ── */
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
      font-size: 8pt;
      line-height: 1.4;
      overflow-x: auto;
      margin: 14px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    code {
      font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      color: #0369a1;
      padding: 2px 5px;
      border-radius: 4px;
    }

    pre code {
      background: transparent;
      color: #f8fafc;
      padding: 0;
    }

    /* ── GitHub Callouts / Alerts ── */
    .alert {
      border-left: 4px solid;
      border-radius: 0 6px 6px 0;
      padding: 12px 16px;
      margin: 16px 0;
      background: #f8fafc;
      font-size: 9pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .alert-title {
      font-weight: 800;
      font-size: 8.5pt;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .alert-note {
      border-color: #0284c7;
      background: #f0f9ff;
    }
    .alert-note .alert-title { color: #0284c7; }

    .alert-tip {
      border-color: #10b981;
      background: #ecfdf5;
    }
    .alert-tip .alert-title { color: #059669; }

    .alert-important {
      border-color: #0284c7;
      background: #f8fafc;
    }
    .alert-important .alert-title { color: #0369a1; }

    .alert-warning {
      border-color: #f59e0b;
      background: #fffbeb;
    }
    .alert-warning .alert-title { color: #d97706; }

    .alert-caution {
      border-color: #ef4444;
      background: #fef2f2;
    }
    /* ── Screenshots & Images ── */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
      margin: 16px 0;
      display: block;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* ── List Elements ── */
    ul, ol {
      margin: 0 0 12px 0;
      padding-left: 20px;
    }

    li {
      margin-bottom: 4px;
    }

    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="company-name">DEWATERING CONSTRUCTION ETC. LIMITED</div>
      <div class="company-sub">Groundwater Control, Foundation Dewatering & Construction Engineering</div>
    </div>

    <div class="cover-body">
      <div class="doc-badge">Official Staff Instruction Manual</div>
      <h1 class="doc-title">DCEL Office Suite</h1>
      <p class="doc-subtitle">
        Simple Step-by-Step User Guide and Workflow Playbook for Construction Site Operations, Heavy Machinery, Daily Attendance, Automated Payroll, and DewaterCAD Engineering.
      </p>

      <div class="cover-meta-grid">
        <div class="meta-item">
          <div class="meta-label">Software Application</div>
          <div class="meta-val">DCEL Office Suite (v1.5.3+)</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Target Audience</div>
          <div class="meta-val">Site Supervisors, Engineers, HR, Accounts & Field Staff</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Operating Platforms</div>
          <div class="meta-val">Web Browser, Windows Desktop App, Android / iOS Mobile</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Publication Date</div>
          <div class="meta-val">October 2026</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div>CONFIDENTIAL & PROPRIETARY — FOR INTERNAL STAFF USE ONLY</div>
      <div>DEWATERING CONSTRUCTION ETC. LIMITED (DCEL)</div>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-page">
    <div class="toc-title">Table of Contents</div>
    <ul class="toc-list">
      <li class="toc-item">
        <span class="toc-name">Visual Screen Map: Where to Find Every Tool and Screen</span>
        <span class="toc-file">APP_ATLAS.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 1: Getting Started, Signing In & Screen Layout</span>
        <span class="toc-file">01-GETTING-STARTED.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 2: Human Resources & Staff Management (Attendance, Leaves, HMO)</span>
        <span class="toc-file">02-HR-AND-WORKFORCE.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 3: Finance, Payroll & Invoicing (Salaries, Invoices, Expenses)</span>
        <span class="toc-file">03-FINANCE-PAYROLL-AND-ACCOUNTS.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 4: Operations, Machinery & Diesel Fuel (Waybills, Maintenance, Fuel)</span>
        <span class="toc-file">04-OPERATIONS-AND-ASSETS.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 5: Clients, Site Diaries & DewaterCAD (Blueprints, Excavation Tracing)</span>
        <span class="toc-file">05-CLIENTS-AND-SITE-ENGINEERING.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 6: Tasks, Team Chat & Meeting Minutes (Work Orders, Reminders)</span>
        <span class="toc-file">06-TASKS-AND-COMMUNICATIONS.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 7: Reports, User Accounts & Settings (Weekly Digest, Permissions)</span>
        <span class="toc-file">07-REPORTS-AND-ADMINISTRATION.md</span>
      </li>
      <li class="toc-item">
        <span class="toc-name">Chapter 8: Everyday Help & Frequently Asked Questions (Quick Fixes, Support)</span>
        <span class="toc-file">08-TROUBLESHOOTING-AND-FAQ.md</span>
      </li>
    </ul>
  </div>

  <!-- Chapters Content -->
  ${chaptersHtml}

</body>
</html>`;

  fs.writeFileSync(OUTPUT_HTML, fullHtml, 'utf-8');
  console.log(`✅ Formatted HTML compiled to: ${OUTPUT_HTML}`);

  // Determine Browser Executable (Edge or Chrome)
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserExe = fs.existsSync(edgePath) ? edgePath : fs.existsSync(chromePath) ? chromePath : null;

  if (!browserExe) {
    console.error('❌ Could not find Edge or Chrome executable for PDF rendering.');
    return;
  }

  console.log(`Rendering PDF using Chromium Puppeteer (${path.basename(browserExe)})...`);

  const tempPdfPath = path.join(DOCS_DIR, `manual_build_${Date.now()}.pdf`);
  const finalPdf = path.join(DOCS_DIR, 'DCEL_OFFICE_SUITE_USER_MANUAL.pdf');
  const altPdf = path.join(DOCS_DIR, 'DCEL_OFFICE_SUITE_INSTRUCTION_MANUAL.pdf');

  try {
    const browser = await puppeteer.launch({
      executablePath: browserExe,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    const htmlUrl = `file:///${OUTPUT_HTML.replace(/\\/g, '/')}`;
    console.log(`Loading document: ${htmlUrl} ...`);
    await page.goto(htmlUrl, { waitUntil: 'networkidle0', timeout: 90000 });

    // Ensure all images are decoded and settled
    await page.evaluate(async () => {
      const selectors = Array.from(document.querySelectorAll('img'));
      await Promise.all(selectors.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      }));
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Generating high-resolution print PDF...');
    await page.pdf({
      path: tempPdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '18mm',
        bottom: '18mm',
        left: '16mm',
        right: '16mm'
      }
    });

    await browser.close();

    if (fs.existsSync(tempPdfPath)) {
      // Safely copy to primary target
      fs.copyFileSync(tempPdfPath, finalPdf);
      try {
        fs.copyFileSync(tempPdfPath, altPdf);
      } catch (copyErr) {
        console.warn('⚠️ Note: DCEL_OFFICE_SUITE_INSTRUCTION_MANUAL.pdf is open in another app. Fresh manual saved to DCEL_OFFICE_SUITE_USER_MANUAL.pdf');
      }
      fs.unlinkSync(tempPdfPath);

      const stats = fs.statSync(finalPdf);
      console.log('\n====================================================');
      console.log('🎉 SUCCESS! Non-Technical User Manual PDF Generated!');
      console.log(`📄 PDF File: ${finalPdf}`);
      console.log(`📊 File Size: ${(stats.size / 1024).toFixed(1)} KB`);
      console.log('====================================================\n');
    } else {
      console.error('❌ PDF output file was not created.');
    }
  } catch (err) {
    console.error('❌ Error executing PDF print command:', err.message);
  }
}

compileManual().catch(err => {
  console.error('Fatal manual compilation error:', err);
});
