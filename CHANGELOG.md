# Changelog

All notable changes to this project will be documented in this file.

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
