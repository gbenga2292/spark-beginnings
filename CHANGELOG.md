# Changelog

All notable changes to this project will be documented in this file.

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
