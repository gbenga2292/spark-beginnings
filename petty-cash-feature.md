# Petty Cash Statement of Account Feature

## Goal
Create a minimalist, Excel-style Petty Cash Statement of Account page under the Accounts sidebar category that records "Money In" via modal, automatically pulls "Money Out" from General Ledger entries matching configured Petty Cash `Paid From` sources, and keeps all header controls/filters in the top bar for maximum screen space.

## Tasks
- [x] Task 1: Create Supabase migration for `petty_cash_entries` table and `petty_cash_banks` setting in `app_settings` → Verify: Migration applied cleanly to Supabase and saved in `supabase/migrations/`.
- [x] Task 2: Extend `supabaseService.ts`, `appStore.ts`, and `useDataLoader.ts` with `PettyCashEntry` CRUD, `pettyCashBanks` config, and Realtime sync → Verify: Store actions and DB sync compile without TypeScript errors.
- [x] Task 3: Build `src/pages/PettyCash.tsx` with header-mounted controls (Search, Date Range Filter, Export, Settings Dialog, Record Money In Modal), Opening Balance (B/F) row when date-filtered, compact `Paid From`/`Paid To` columns, chronological running balance, and Excel export → Verify: Page renders full-height Excel-style table with accurate running balances.
- [x] Task 4: Register `/petty-cash` in `src/constants/navigation.ts` (under Accounts), `src/App.tsx`, `src/lib/routePrefetch.ts`, and `src/components/layout/Header.tsx` → Verify: `npx tsc --noEmit` passes with zero errors.

## Done When
- [x] Petty Cash appears under Accounts in the sidebar.
- [x] Settings dialog lets user select which Ledger `Paid From` accounts classify as Petty Cash (defaulting to `["Petty Cash"]`).
- [x] Recording Money In via modal and Ledger expenses from selected Petty Cash accounts seamlessly merge into a chronological statement with accurate Opening Balance (B/F), Money In, Money Out, and Running Balance.
