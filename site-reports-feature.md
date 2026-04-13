# Site Reports Feature (MySQL & Supabase Auth Bridge)

## Goal
Build a WhatsApp-style "Site Reports" feed where field workers log media & updates into a new Node.js/MySQL backend hosted on the company web server, while securely authenticating via the main app's existing Supabase auth system.

## Tasks
- [ ] Task 1: Initialize isolated Node.js API folder (`site-reports-api`) with Express, MySQL2, and Multer. → Verify: `package.json` created and modules installed.
- [ ] Task 2: Create MySQL database schema (Sites, Reports, Media) & connection pool. → Verify: API connects to MySQL without errors.
- [ ] Task 3: Setup `multer` for local hard-drive media storage. → Verify: API can receive a mock image upload and save it physically to an `uploads/` folder.
- [ ] Task 4: Implement Supabase JWT verification middleware in Node API. → Verify: API blocks requests without valid token, allows valid Supabase JWTs.
- [ ] Task 5: Build API endpoints (Create Report, Fetch Feed by Site ID) and expose via REST. → Verify: Postman/cURL can fetch and insert reports.
- [ ] Task 6: Build `SiteReportFeed.tsx` (WhatsApp-style feed UI) in the React app. → Verify: Component renders scrolling chat bubbles and media attachment UI cleanly.
- [ ] Task 7: Integrate `SiteReportFeed` into `Sidebar.tsx` (Main PC App) & Create standalone Website route. → Verify: Navigation correctly opens the Site Reports section.
- [ ] Task 8: Connect Frontend to Node API (passing Supabase JWT in auth headers). → Verify: Sending a message cleanly updates MySQL and saves to the local drive.

## Done When
- [ ] Custom Node.js backend securely handles MySQL inserts and physical file storage.
- [ ] Frontend uses existing Supabase Auth to identify the field worker.
- [ ] PC App and Web users can use the feed with a smooth, cataloged WhatsApp-like UX.
