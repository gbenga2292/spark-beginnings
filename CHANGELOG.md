# Changelog

All notable changes to this project will be documented in this file.

---

## [2.1.0] - 2026-09-15

### Added / Improved

- **Wellpoint Dewatering Sizing Calculator (`/operations/dewatering-calculator`)**:
  - Engineered an industrial-grade calculation engine (`src/utils/dewateringCalculator.ts`) ported from field Python algorithms for wellpoint perimeter ring-main sizing, header pipe layout, and equipment bill of quantities (BOQ).
  - Computes exact perimeter dimensions, 6-meter pipe section requirements with safety rounding, excavation volume ($m^3$), wellpoint density based on soil-condition spacing (1.0m to 1.5m), riser pipes (with spare), swing bows, sealing rubber rings, and plug caps.
  - Implemented automated pump recommendation algorithm sizing 6-inch / 8-inch diesel and electric dewatering units according to overall wellpoint count and depth thresholds.
  - Added jetting hose sizing ($2 \times \text{depth} + 5\text{m}$) and optional site ingress opening calculations.
  - **Interactive Live Site Schematic (SVG)**:
    - Real-time segmented vector schematic visualizing plot boundaries, excavation envelope, segmented ring-main pipe run, wellpoint distribution nodes, pump placement, and site ingress clearance.
    - True physical gap rendering for vehicle ingress access with custom gap width markers, dimension lines, and ingress flow directional indicator.
  - **Minimalist Industrial Interface & Direct Header Controls**:
    - Embedded action buttons (Reset Defaults, Copy Bill of Quantities, Print / Export PDF, Open Dewatering Simulator) directly into the global application header via `useSetPageTitle`.
    - Pure monochromatic slate styling adhering to strict design standards (zero violet/purple, high contrast, clean typography, absence of AI aesthetic clichés).
  - **System Navigation & Access Control**:
    - Protected by `simulator.canView` permission gate via `ProtectedRoute`.
    - Integrated across `Sidebar.tsx`, `HomePage.tsx` launchpad, `OmniSearch.tsx` command palette, and `routePrefetch.ts` for instant zero-lag route transitions.

- **Invoice, Billing & Operational Enhancements**:
  - Enhanced `useActiveSiteInvoices.ts` and `ActiveSiteInvoicesModal.tsx` for real-time site financial reconciliation.
  - Improved payment settlement workflows in `Billing.tsx`, `InvoiceDetailDialog.tsx`, and `InvoiceRuntimeTracker.tsx`.
  - Refined dashboard navigation and responsiveness across `Site360View.tsx` and `TaskDashboard.tsx`.

### Git Commits Since v2.0.0

- `075ec30`: feat: initialize application scaffold with comprehensive suite of administrative and operational modules

### Database Migrations (Supabase)

- Verified Supabase migrations in sync up to `20260914140000_add_invoice_linkage_to_payments.sql`. No additional database schema migrations required for client-side operational calculator tooling.

---

## [2.0.0] - 2026-09-14

### Added / Improved

- **Instantaneous Zero-Lag Navigation & Route Prefetching**:
  - Implemented comprehensive route prefetch engine (`src/lib/routePrefetch.ts`) covering all 42 application routes.
  - Linked intent-based prefetching on `onMouseEnter`, `onTouchStart`, and `onFocus` across all navigation links in both `HomePage` and `Sidebar`.
  - Added progressive background idle-time route warming (`requestIdleCallback`) for 16 core daily operational modules (`/tasks/dashboard`, `/tasks`, `/hr-dashboard`, `/attendance`, `/employees`, `/operations`, `/comm-log`, `/payroll`, `/sites`, etc.), eliminating route loading spinners and rendering transitions instantaneously.

- **Next-Gen Modular Launchpad (`HomePage.tsx`)**:
  - Re-architected the main workspace launchpad into an accessible, role-governed card grid with rich hover bloom popovers for sub-modules.
  - Removed redundant "Activity Audit Log" card from Home (consolidated within System Settings).
  - Eliminated procedural SVG `feTurbulence` fractal noise filters, drastically cutting GPU rasterization overhead and memory pressure.
  - Guarded profile fetching on mount to eliminate redundant network queries and render cycles.
  - Defer-rendered `OmniSearch` to avoid eager background task subscriptions when search modal is inactive.

- **Sidebar 2.0 (High-Performance Modular Navigation)**:
  - Added hardware compositing acceleration hints (`will-change-[width,transform]`, `transform-gpu`) for buttery smooth 60/120 FPS drawer animations.
  - Upgraded viewport detection to modern `matchMedia('(max-width: 1023px)')` event listeners, eliminating continuous CPU cycles during window resizing.
  - Extended smart auto-collapse behavior to `/tasks/archive`, `/tasks/dashboard`, Reports, Simulator, and Machine Reconciliation for maximum canvas workspace.
  - Optimized communication unread counter (`unreadCommCount`) using $O(N + M)$ `Set` lookup.
  - Decoupled `pendingLedgerEntries` from reactive hook state into imperative click handling (`useAppStore.getState()`), preventing spurious re-renders during transaction entry.

- **Operations & Analytics Suite**:
  - Added `RefillForecastModal.tsx` and `useRefillForecast.ts` for predictive diesel consumption estimation.
  - Integrated `useActiveSiteInvoices.ts` and `useMachineReconSummary.ts` for operational financial metrics.
  - Introduced `MetricHeroCard.tsx` and `Sparkline.tsx` reusable analytics components.
  - Redesigned `OfflineCapabilitiesModal.tsx` with responsive, non-overflowing flex layout, compact hero status banner, and pinned action bar.
  - Added `TaskArchive.tsx` with auto-collapse sidebar lifecycle hooks.

- **QuickBooks-Style Unified Invoice & Payment Settlement Architecture**:
  - Re-architected financial settlement engine (`src/lib/settlementUtils.ts`) to resolve invoice/payment dissonance with multi-invoice allocation and advance credits.
  - Added instant Withholding Tax (WHT) and discount credit clearance: $\text{Settled} = \text{Cash} + \text{WHT} + \text{Discount}$.
  - Chronological FIFO waterfall for historical and advance payments, guaranteeing 100% backward compatibility.
  - Linked direct "Record Payment" flow from `Billing.tsx` and `InvoiceDetailDialog.tsx` to `ClientAccounts.tsx` with pre-filled allocation matrix.
  - Standardized real-time settlement status badges (`Paid`, `Partially Paid`, `Overdue`, `Sent`) and remaining balance indicators across `InvoiceDetailDialog.tsx`, `SiteDetailDialog.tsx`, `Site360View.tsx`, `Client360.tsx`, `Sites.tsx`, and `FinancialReports.tsx`.
  - Fixed hardcoded VAT formula in `Payments.tsx` to dynamically use the configured payroll variable `vatRate`.

### Git Commits Since v1.8.0

- `bd61eb3`: feat: implement AI-powered daily log analysis modal and project tracking pages
- `d733afd`: feat: implement operational management pages for assets, daily logs, and site analytics with new context and routing utilities

### Database Migrations (Supabase)

- `20260914140000_add_invoice_linkage_to_payments.sql`: Added `invoice_id`, `invoice_number`, `allocations`, and `unapplied_amount` columns to `public.payments`.
- All prior migrations verified and in sync up to `20260907153000_add_dipstick_to_daily_logs.sql`.

---

## [1.8.0] - 2026-09-08

### Added / Improved

- **Daily Log Management & Asset Tracking**:
  - Implemented Daily Log Management module with full CRUD for site daily entries.
  - Added Site Asset View grid (MaintenanceAssetGrid) for equipment tracking per site.
  - Added Site View modules for asset reporting with filter and export capabilities.

- **Task Calendar & Persistent Operational Data**:
  - Implemented TaskCalendar page with monthly/weekly task overview visualisation.
  - Integrated persistent operational data management for tasks, daily journals, and site assets using IndexedDB (idb) for offline-capable caching.
  - Added bulk task actions bar (TaskBulkActionsBar) for multi-select task operations.

- **AI Agent Runtime & Financial Reporting Upgrades**:
  - Implemented AI Agent Runtime powered by Google Gemini for in-app co-pilot assistance.
  - Added Payroll Snapshot Versioning — payroll runs are now snapshotted and stored for historical comparison.
  - Upgraded Financial Reporting Suite with multi-source aggregation, visual charts, and export.
  - Implemented usePayrollCalculator hook for consolidated payroll computation.
  - Added AccountsReportBuilder component for customised multi-source report assembly.

- **Activity Log UX Overhaul**:
  - Replaced database jargon (INSERT, UPDATE, DELETE) with human-readable business language: Added / Edited / Deleted with colour-coded badges.
  - Added High-Level Category Filters: All Categories / Finance & Accounts / Staff & HR / Site & Operations.
  - Added Quick Date Presets: Today, Yesterday, Last 7 Days, This Month, Custom Range.
  - Smart record identifiers — shows invoice numbers, employee names, client/site combos, and amounts instead of raw UUIDs.
  - All monetary values formatted with Nigerian Naira symbol and thousands separators.
  - In-card expandable accordion for entries with many fields.
  - Feed now flows naturally to display all 20-50 entries without a cramped inner scrollbox.

### Database Migrations (Supabase)

- `20260907153000_add_dipstick_to_daily_logs.sql` — Added `dipstick` field to `daily_logs` table for fuel level measurement tracking.
- `20260907150000_add_diesel_benchmark_to_assets.sql` — Added `diesel_benchmark` column to `assets` for fuel consumption baseline per asset.
- `20260904150000_add_auxiliary_equipment_to_invoices.sql` — Added `auxiliary_equipment` field to `invoices` table for secondary equipment line items.

### Build

- Electron v41.0.0 — Windows installer and portable builds regenerated for v1.8.0.
- Android (Capacitor) — Synced with latest web bundle. Debug APK generated for internal testing.
- Vite web bundle rebuilt with all feature additions.

---

## [1.7.17] - 2026-09-03

### Added / Improved
- **AI Agent Intelligence & Automation Suite**:
  - Integrated full Agent Execution runtime (`agentExecutor.ts`, `agentTools.ts`, `useAgentContext.ts`) with function calling and contextual application tools.
  - Added embedded AI assistant in Site 360 and Operations workflows for automated report generation, milestone extraction, and task orchestration.
- **Payroll Snapshots & Version Audit System**:
  - Added historical payroll snapshots table (`payroll_snapshots`) allowing accounting to freeze, archive, and audit closed payroll cycles.
  - Updated `usePayrollCalculator` and `PayrollVersionModal` to support version comparisons, adjustments, and automated ledger synchronization.
- **Vehicle Logistics & Fuel Ledger Linking**:
  - Added direct financial reconciliation linking vehicle refueling logs to general ledger expenses (`linked_ledger_ids`).
  - Improved expense categorization across fleet operations in `VehicleManager.tsx`.
- **Site Milestones & Storyboard UX**:
  - Added `SiteMilestonesCard` with phase progress markers, target completion dates, and stage health metrics.
  - Enhanced `SiteGanttStoryboard` with real-time milestone sync and phase transitions.
- **Database Migrations (Supabase)**:
  - `20260827120000_add_inventory_ledger_batches_packaging.sql`: Added inventory ledger batches and packaging support.
  - `20260831120000_create_payroll_snapshots.sql`: Created `payroll_snapshots` with JSON breakdown payload and RLS policies.
  - `20260903120000_add_linked_ledger_ids_to_vehicle_fuel_logs.sql`: Added `linked_ledger_ids` tracking array to `vehicle_fuel_logs`.
- **Version Bump**:
  - Updated application version to `1.7.17` in [package.json](file:///c:/Users/USER/Desktop/assign/spark-beginnings/package.json) and [version.ts](file:///c:/Users/USER/Desktop/assign/spark-beginnings/src/constants/version.ts).

## [1.7.14] - 2026-08-26

### Added / Improved
- **Site 360 & Operations Workflow**:
  - Implemented `Site360View` comprehensive dashboard with modular tabs, site storyboard, AI chat assistant, and integrated task management.
  - Enhanced Daily Log Manager with detailed equipment operation logs, pump installation/replacement date tracking (`replaced_asset_id`), and consumable checkout workflows.
  - Upgraded site inventory view with reconciliation status, pump tracking, and live waybill linkage.
- **Communications Log (Comm Log)**:
  - Added new site registration tracking (`registered_new_site`) directly within communication log entries.
  - Implemented per-user read receipt tracking (`comm_log_reads`) to highlight unread team updates.
- **Financial & Ledger Management**:
  - Enhanced Ledger page with automated VAT calculation and tax breakdown for expense line items.
  - Added financial reporting suite with customizable multi-filter views, data visualization, and export capabilities.
- **Task Management & Desktop UI**:
  - Improved Desktop Floating Calendar and task inbox with intuitive filtering, quick-view sheets, and inline subtask handling.
- **Database Migrations (Supabase)**:
  - `20260821160000_add_expenses_vat_to_ledger.sql`: Added VAT column and tracking to ledger entries.
  - `20260824000000_comm_log_reads.sql`: Created `comm_log_reads` table with RLS and indexing.
  - `20260824100000_add_registered_new_site_to_comm_logs.sql`: Added `registered_new_site` flag to `comm_logs`.
  - `20260826170000_add_replaced_asset_to_pump_dates.sql`: Added `replaced_asset_id` to `operations_site_pump_dates`.
- **Version Bump**:
  - Updated application version to `1.7.14` in [package.json](file:///c:/Users/USER/Desktop/assign/spark-beginnings/package.json) and [version.ts](file:///c:/Users/USER/Desktop/assign/spark-beginnings/src/constants/version.ts).

## [1.7.13] - 2026-07-31

### Added / Improved
- **HR Report — Interactive Legend Filter (Schedule Chart)**:
  - Legend chips in the Staff Site Work Report (Schedule Chart view) are now clickable toggle buttons.
  - Clicking a site chip filters visible rows — non-matching employees fade to 25% opacity with a smooth transition.
  - Multiple sites can be selected simultaneously (OR logic). A "× Clear filter" button appears when any filter is active.
  - Fixed night-shift site detection: night-only workers' `nightSite` was previously lost and recorded as `Absent`; this is now correctly resolved.
  - Added `empSiteSetsForMonth` memo that builds per-employee site sets directly from attendance records for accurate filtering.
- **Client 360 — Complete Client Dropdown**:
  - Fixed missing clients in the Client 360 selector: clients that existed in `sites` but had no `clientProfile` record were silently excluded.
  - `allClients` derivation now always merges all three sources (`clientProfiles`, `sites`, `pendingSites`) using a `Set` to deduplicate.
- **Clients Management — Removed Delete Icon from Cards**:
  - Removed the `Trash2` delete button from each client card in both Grid and List views of the Clients Management page.
  - The delete functionality is preserved internally but no longer surfaced on the summary grid.
- **Sidebar — Auto-Collapse on Client 360 & Site 360**:
  - The sidebar now automatically collapses (icon-only mode) when navigating to `/client-360` or any sub-path, matching existing behavior for Simulator and Machine Recon.
  - The sidebar auto-restores when navigating away from these pages.
- **Version Bump**:
  - Updated application version to `1.7.13` in `package.json`.

## [1.7.12] - 2026-07-30


### Added / Improved
- **Auto-Updater & Release Notes Viewer**:
  - Added automatic release notes parsing from `CHANGELOG.md` in `electron/main.cjs` for direct NAS and auto-updater update checks.
  - Updated `UpdateModal.tsx` to dynamically present release notes to users during update download and ready-to-install phases.
  - Enhanced installer execution flow in Electron main process via `shell.openPath` with graceful fallback handling.
- **Version Bump**:
  - Updated application version to `1.7.12` in `package.json` and `src/constants/version.ts`.

## [1.7.11] - 2026-07-30

### Added / Improved
- **Financial Reporting & Payroll Calculation Suite**:
  - Implemented `AccountsReportBuilder` component and `usePayrollCalculator` hook for multi-source financial reporting.
  - Enhanced payroll calculation hooks and multi-source report builder UI.
- **Task Management Suite**:
  - Implemented full task management module with dedicated context provider, read tracking, and UI component suite.
- **Site Onboarding & Client Management**:
  - Added site onboarding module with multi-phase questionnaire and document management.
  - Added `LogisticsEstimatorDialog`, `MachineReconciliation`, `Sites`, and `Client360` page components.
- **Electron & Core Infrastructure**:
  - Initialized Electron main process with auto-updater, hardware acceleration settings, and single-instance locking.
- **Version Bump**:
  - Updated app version to `1.7.11` in `package.json` and `src/constants/version.ts`.

## [1.7.10] - 2026-07-28

### Added / Improved
- **Dewatering Canvas & Operations**:
  - Implemented core dewatering canvas, state management, and project dashboard modules.

## [1.7.9] - 2026-07-24

### Added / Improved
- **Task Dashboard Enhancements**:
  - Clarified stat card subtext labels ("Total assigned tasks", "% of assigned tasks", "Created by me").
  - Filtered out inactive, delisted, or terminated staff members from Team Workspace count in `useWorkspace`.
- **Electron Window Display Fix**:
  - Implemented window display fallback timer in `electron/main.cjs` ensuring the main window always shows, fixing invisible background process issue.
- **Version Bump**:
  - Updated app version to `1.7.9` in `package.json` and `version.ts`.

## [1.7.8] - 2026-07-24

### Added / Improved
- Machine Attendance Overview feature and vehicle waybill fixes.
- Release candidate for Office Suite v1.7.x.
