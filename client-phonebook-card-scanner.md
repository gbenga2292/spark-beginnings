# Client Phonebook & AI Business Card Scanner

## Goal
Build a full-featured, elegant Phonebook directory under the "Clients" category with an interactive Contact Form (supporting name, position, company, primary & multiple emails, primary & multiple phone numbers, multiple addresses, notes, tags) and an AI Business Card Scanner that captures or uploads business card photos, uses the workspace's configured AI (Gemini / OpenAI from Settings) to extract all fields, auto-populates the form, and waits for user confirmation before saving to Supabase.

## Tasks
- [x] Task 1: Supabase Database Schema & Migration → Create `phonebook_contacts` table in Supabase with RLS, realtime, and migration file.
- [x] Task 2: AI Business Card Extraction Service → Implement `src/lib/businessCardAiService.ts` hooking into `getWorkspaceAiKey()` with Gemini/OpenAI vision JSON parsing.
- [x] Task 3: Camera & File Upload Modal Component → Implement `src/components/phonebook/BusinessCardScannerModal.tsx` supporting webcam live capture and image file drop/upload.
- [x] Task 4: Phonebook Contact Form Modal → Implement Add/Edit modal supporting multiple phones, multiple emails, multiple addresses, notes, category, and AI scan prefill.
- [x] Task 5: Phonebook Main View Page → Build `src/pages/Phonebook.tsx` with search, filtering, card grid/list view, quick actions (call, email, copy, view card image, edit, delete).
- [x] Task 6: Routing & Navigation Integration → Register route in `src/App.tsx`, sidebar item in `src/constants/navigation.ts`, tile in `src/pages/HomePage.tsx`, and permissions in `src/pages/UserForm.tsx`.
- [x] Task 7: Verification & Build Check → Verify TypeScript compile, route accessibility, camera integration, and AI vision fallback handling.

## Done When
- [x] Users can navigate to "Phonebook" under the "Clients" category.
- [x] Users can open the "Add Contact" form and manually enter name, position, company, multiple phones, emails, addresses, and notes.
- [x] Users can click "Scan Business Card", take a picture via live camera or upload a photo, and watch AI parse the fields into the form.
- [x] The user can review, modify, and save the contact to the Supabase database.
- [x] Contacts are displayed in the phonebook directory with search, filters, and actions.
