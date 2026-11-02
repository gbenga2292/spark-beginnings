# Damage Logging & Incident Management System (DamageManager)

## 1. Overview
The **Damage Logging & Incident Management System** provides a centralized, accountable register to record, evaluate, and resolve damage incidents occurring across active project sites, the head office, fabrication yards/workshops, and during transit. 

Key architectural requirements established during discovery:
- **Hybrid Target Linking:** Connects seamlessly to registered Sites, Plant/Machinery Assets, and Fleet Vehicles, while fully permitting free-text logging for unregistered equipment, office fixtures, third-party items, and premises.
- **Dedicated Media Server Image Upload:** Photos and documentation are uploaded directly to the custom media server (`task_upload.php`) using `VITE_MEDIA_SERVER_URL` and `VITE_MEDIA_API_KEY`. Only resulting URLs are saved in Supabase.
- **Granular User Privileges:** Full integration into `userStore.ts` with dedicated `opsDamages` permissions (`canView`, `canCreate`, `canEdit`, `canDelete`, `canAssess`, `canSignOff`, `canExport`) controllable via the User Management interface.
- **Operational Lifecycle:** Review and sign-off workflow (`Reported` ➔ `Under Assessment` ➔ `In Repair` ➔ `Repaired / Resolved` or `Written Off`).

---

## 2. Project Type
- **Project Type:** `WEB` (React 19 + TypeScript + Vite + Electron Desktop App)
- **Primary Agent:** `frontend-specialist` & `backend-specialist`
- **Orchestration:** `orchestrator` / `project-planner`

---

## 3. Success Criteria
1. **Database & Schema:**
   - Supabase table `damage_logs` created with appropriate RLS policies, indexing, and real-time publication.
   - Secure schema storing incident metadata, location categorization, entity references, cost estimations, and image URL arrays.
2. **Access Control & Permissions:**
   - `UserPrivileges` updated with `opsDamages` interface.
   - Privilege toggles integrated into `UserForm.tsx` and default roles in `userStore.ts`.
   - Protected route guards applied in `App.tsx`.
3. **Media Server Photo Upload:**
   - Direct multipart upload to `${VITE_MEDIA_SERVER_URL}/task_upload.php` with authorization header `X-API-Key: ${VITE_MEDIA_API_KEY}`.
   - Clean thumbnail gallery with image enlargement/preview dialog in incident view.
4. **Interactive UI & Experience:**
   - Dedicated page `src/pages/DamageManager.tsx` mounted at `/operations/damages`.
   - Comprehensive filter bar: Search query, Location type (Site/Office/Yard/Transit/Other), Status badge filters, Date range, and Damaged Item Type.
   - Incident detail modal supporting assessment updates, cost recording, and manager sign-off.
   - Clean export capability (CSV / Print summary).
5. **Quality & Stability:**
   - `npm run build` succeeds without TypeScript or bundle errors.
   - Dark/Light mode theme parity matching DCEL Office Suite aesthetic guidelines.

---

## 4. Tech Stack & Rationale
- **Frontend Framework:** React 19 + TypeScript (existing repo standard).
- **Styling:** Tailwind CSS + Lucide React icons + Radix UI primitives.
- **State Management & Data Sync:** Zustand (`userStore.ts`) + Supabase Realtime client.
- **Media Storage:** Remote PHP Media Endpoint (`/task_upload.php`) storing file binaries and returning public URLs.
- **Database:** Supabase PostgreSQL with Row Level Security (RLS).

---

## 5. File Structure & Impact Analysis

```
spark-beginnings/
├── supabase/migrations/
│   └── 20261029143500_create_damage_logs.sql       # New table schema, RLS, indexes
├── src/
│   ├── types/
│   │   └── damage.ts                               # Type definitions for DamageLog & status
│   ├── store/
│   │   └── userStore.ts                            # Update UserPrivileges with opsDamages
│   ├── constants/
│   │   └── navigation.ts                           # Add 'Damage Logs' to Operations group
│   ├── pages/
│   │   ├── DamageManager.tsx                       # Main Damage Logs hub page
│   │   └── UserForm.tsx                            # Add opsDamages permission controls
│   ├── components/
│   │   └── damages/
│   │       ├── CreateDamageDialog.tsx              # Incident creation with media upload
│   │       ├── DamageDetailDialog.tsx              # Detailed inspection & sign-off
│   │       ├── DamageStatusBadge.tsx               # Status indicator badge
│   │       └── DamageFilterBar.tsx                 # Search & filters
│   └── App.tsx                                     # Register /operations/damages route
```

---

## 6. Task Breakdown

### Task 1: Supabase Database Migration
- **Agent:** `backend-specialist`
- **Skills:** `database-design`
- **Priority:** P0 (Blocker)
- **Dependencies:** None
- **INPUT:** Project database schema specifications.
- **OUTPUT:** Migration file `supabase/migrations/20261029143500_create_damage_logs.sql` defining:
  - `id` (UUID, PK)
  - `incident_number` (Text, e.g. `DMG-2026-0001`)
  - `incident_date` (TIMESTAMPTZ)
  - `location_type` (`site`, `office`, `yard`, `transit`, `other`)
  - `site_id` (UUID optional, FK to `sites`)
  - `specific_location` (Text, e.g. "Main boardroom ceiling", "Excavation pit #2")
  - `item_type` (`asset`, `vehicle`, `office_fixture`, `tool_equipment`, `property`, `other`)
  - `asset_id` (UUID optional, FK to `operations_assets`)
  - `vehicle_id` (UUID optional, FK to `vehicles`)
  - `item_name` (Text - fallback for unregistered/office items)
  - `severity` (`minor`, `moderate`, `severe`, `critical`)
  - `status` (`reported`, `under_assessment`, `in_repair`, `repaired`, `written_off`, `resolved`)
  - `reported_by` (UUID FK to `profiles`)
  - `personnel_involved` (Text / Array)
  - `cause_category` (`operator_error`, `wear_tear`, `accident`, `weather`, `malfunction`, `third_party`, `other`)
  - `description` (Text)
  - `estimated_repair_cost` (NUMERIC)
  - `actual_repair_cost` (NUMERIC)
  - `fault_attribution` (`internal_operator`, `subcontractor`, `client_billable`, `insurance_claim`, `unavoidable`)
  - `photos` (JSONB - array of `{ name, url, type, uploaded_at }`)
  - `signed_off_by` (UUID FK to `profiles`)
  - `signed_off_at` (TIMESTAMPTZ)
  - `resolution_notes` (Text)
  - Timestamps `created_at`, `updated_at`
- **VERIFY:** Apply migration or verify SQL syntax against existing migrations; ensure RLS policies enable authenticated read/write.

---

### Task 2: TypeScript Interfaces & Privilege Definitions
- **Agent:** `backend-specialist`
- **Skills:** `clean-code`
- **Priority:** P1
- **Dependencies:** Task 1
- **INPUT:** Database schema from Task 1.
- **OUTPUT:**
  - Create `src/types/damage.ts` exporting `DamageLog`, `DamageLocationType`, `DamageItemType`, `DamageSeverity`, `DamageStatus`, `DamageCauseCategory`, `DamagePhoto`.
  - Update `src/store/userStore.ts`:
    - Define `OpsDamagesPriv` interface:
      ```ts
      export interface OpsDamagesPriv {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canAssess: boolean;
        canSignOff: boolean;
        canExport: boolean;
      }
      ```
    - Add `opsDamages` to `UserPrivileges`.
    - Provide default role privileges (SuperAdmin: all `true`; Ops Manager: all `true`; Field Engineer: `canView`, `canCreate`).
- **VERIFY:** Run `npx tsc --noEmit` to confirm no broken interfaces.

---

### Task 3: User Management UI Permissions
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`, `clean-code`
- **Priority:** P2
- **Dependencies:** Task 2
- **INPUT:** `UserForm.tsx` privilege toggle sections.
- **OUTPUT:** Add "Damage Logs" section with privilege toggles under Operations in `src/pages/UserForm.tsx`.
- **VERIFY:** Render UserForm and verify toggles map properly to `userStore.updateUser` payload.

---

### Task 4: Media Server Image Upload Integration
- **Agent:** `frontend-specialist`
- **Skills:** `clean-code`
- **Priority:** P1
- **Dependencies:** Task 2
- **INPUT:** Media server config from `AppDataContext.tsx` (`task_upload.php`).
- **OUTPUT:**
  - Implement reusable helper or hook `src/utils/damageMediaUpload.ts`:
    - Reads `VITE_MEDIA_SERVER_URL` and `VITE_MEDIA_API_KEY`.
    - Accepts `File` / image blobs, validates mime type & size.
    - Sends multipart request to `${VITE_MEDIA_SERVER_URL}/task_upload.php`.
    - Returns `{ name, url, type }` objects for Supabase persistence.
- **VERIFY:** Test upload helper with local image file and inspect network payload.

---

### Task 5: Component Architecture (Dialogs, Badges & FilterBar)
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`, `clean-code`
- **Priority:** P2
- **Dependencies:** Tasks 2, 4
- **INPUT:** UI UX specifications.
- **OUTPUT:**
  - `DamageStatusBadge.tsx`: Visual badge for severity and workflow status.
  - `DamageFilterBar.tsx`: Responsive filter controls with search input, status pills, location dropdown, and date picker.
  - `CreateDamageDialog.tsx`:
    - Responsive dialog for reporting incidents.
    - Dynamic dropdowns: Site selection (fetched from `sites`), Asset selection (from `operations_assets`), Vehicle selection (from `vehicles`).
    - "Other / Office / Unlisted" freeform input option.
    - Image dropzone supporting multiple file selection with upload progress indicator.
  - `DamageDetailDialog.tsx`:
    - Full inspection view with photo gallery & full-screen lightbox preview.
    - Cost assessment tab (estimated vs. actual repair cost, fault attribution).
    - Manager Sign-off button enabled only if user has `canSignOff` permission.
- **VERIFY:** Components compile with clean props and handle empty/loading states gracefully.

---

### Task 6: DamageManager Page & Navigation Registration
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`, `drilldown-sidebar`
- **Priority:** P2
- **Dependencies:** Task 5
- **INPUT:** Navigation configuration and App routes.
- **OUTPUT:**
  - `src/pages/DamageManager.tsx`:
    - Summary metrics cards (Total Incidents, Pending Assessment, In Repair, Total Repair Costs).
    - Table view & Grid view toggle for damaged items with high-visibility thumbnails.
    - Real-time updates subscription to `damage_logs` table via Supabase.
  - `src/constants/navigation.ts`:
    - Add entry under `Operations`:
      `{ name: 'Damage Logs', href: '/operations/damages', icon: AlertTriangle, privKey: 'opsDamages', privField: 'canView' }`
  - `src/App.tsx`:
    - Lazy load `DamageManager`.
    - Route definition `<Route path="damages" element={<ProtectedRoute requiredModule="opsDamages"><DamageManager /></ProtectedRoute>} />`.
- **VERIFY:** Navigate to `/operations/damages` via sidebar, verify permission gating and responsiveness.

---

## 7. Phase X: Final Verification & Checklist

- [x] **Database & RLS:** Schema migration created and applied to Supabase database without syntax errors.
- [x] **Type Integrity:** `npx tsc --noEmit` runs with 0 errors.
- [x] **Lint & Code Quality:** Code complies with clean-code standards (no dead imports, no purple violations).
- [x] **Media Upload Verification:** Images upload to existing `task_upload.php` endpoint and URLs save to Supabase.
- [x] **Permission Gating:** Non-privileged users cannot access the route; users without `canSignOff` cannot approve sign-offs.
- [x] **Build Check:** `npm run build` generates production bundle cleanly (`dist/assets/DamageManager-H7Yz4PG3.js`).

## ✅ PHASE X COMPLETE
- Database Migration: ✅ Applied & verified in Supabase
- TypeScript: ✅ 0 errors (`npx tsc --noEmit`)
- Build: ✅ Success (`npm run build`)
- Date: 2026-10-29
