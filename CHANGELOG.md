# Changelog

All notable changes to this project will be documented in this file.

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
