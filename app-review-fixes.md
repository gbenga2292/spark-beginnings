# Resolve App Review Issues

## Goal
Implement critical bug fixes, stability enhancements, and architectural improvements identified during the dual-agent code review.

## Tasks
- [ ] Task 1: Fix `arguments[]` bug in `supabaseService.ts` and remove duplicate leave store methods in `appStore.ts`. → Verify: VehicleManager loads vehicle/trip data successfully; adding a leave only fires a single database insert.
- [ ] Task 2: Fix `CommLog.tsx` import type hack and standardize `lazy()` imports in `App.tsx`. → Verify: Application routes cleanly without runtime import warnings; lazy loading uses a consistent `.then()` pattern.
- [ ] Task 3: Replace full-delete pattern in `setSites` with differential upsert, and replace hardcoded `dcel-team` `workspace_id` with dynamic `userStore` variable in `supabaseService.ts`. → Verify: Updates to sites sync safely; vehicle trips log the correct current workspace string.
- [ ] Task 4: Add per-page `ErrorBoundary` and `Suspense` wrapping in `App.tsx`. → Verify: Purposefully throwing an error in one lazy-loaded route gracefully displays a localized fallback without crashing the entire app.
- [ ] Task 5: Add explicit error throwing to CRUD operations in `supabaseService.ts` instead of silent `console.error`. → Verify: Network failures during saves bubble up to UI forms and trigger visual toast/alert notifications.
- [ ] Task 6: Refactor `index.css` to eliminate `!important` dark mode cascades in favor of CSS variables, and replace the purple calendar color. → Verify: `dark:` variant functions properly; calendar color adheres to the "Purple Ban" rule.
- [ ] Task 7: Add Skeleton Loaders for data-heavy pages (Employees, Payroll, Tasks) replacing the generic `<PageLoader />`. → Verify: Skeletons show immediate layout context during transitions.
- [ ] Task 8: Implement date-range filtering for Attendance fetch mapping (replacing `limit(10000)`). → Verify: Attendance only queries the active viewing range, preventing arbitrary truncation.
- [ ] Task 9: Run `supabase gen types` (if applicable) and type the database rows in `supabaseService.ts` mappers, eliminating `r: any`. → Verify: Full type safety applied to database boundary; `tsc --noEmit` returns no errors.
- [ ] Task 10: Componentize Massive Pages (`Tasks.tsx`, `Variables.tsx`, `Payroll.tsx`, `Employees.tsx`) into sub-directories. → Verify: Main page files are focused entry points mapping to clean sub-components.

## Done When
- [ ] Vehicle module is unblocked and data fetches correctly.
- [ ] Data writes correctly bubble up success/error states to the React UI layer.
- [ ] Front-end stability is robust enough that one chunk load failure doesn't crash the global app state.
- [ ] The app aligns with strict UI/UX (e.g., no purple, dark mode functions gracefully).
