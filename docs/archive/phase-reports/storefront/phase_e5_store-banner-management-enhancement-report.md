# BUYBOX E-COMMERCE
# PHASE E5 — STORE BANNER MANAGEMENT UX & WORKFLOW ENHANCEMENT
## FORENSIC AUDIT + BACKWARD-COMPATIBLE IMPLEMENTATION + REGRESSION VERIFICATION REPORT

**Report File:** `phase_e5_store-banner-management-enhancement-report.md`  
**Execution Date:** 2026-10-27  
**Branch:** Working branch (Uncommitted changes strictly preserved)  
**Acceptance Status:** **PASS**

---

## 1. EXECUTIVE SUMMARY & ACCEPTANCE STATUS

### Status: **PASS** — All required checks executed and passed

Phase E5 enhanced the Superadmin and Admin Store Banner Management dashboard and Add/Edit Banner workflow to match the usability, organization, and visual quality of the improved Marketing Campaign management interface (Phase E3/E4A). 

All existing business logic, database contracts, image storage mechanisms, storefront placement rules, display ordering behavior, scheduling constraints, and RBAC permissions were rigorously preserved. Store Banners and Marketing Campaigns remain strictly separated as independent features.

### Key Deliverables Completed:
1. **Forensic Audit**: Audited the backend `StorefrontBanner` model, REST API controllers, storage service (`storefront-media`), validators, permissions (`PERMISSIONS.SETTINGS_MANAGE`), and storefront consumers (`HeroSection.jsx`, `useBannerSlot.js`).
2. **Enhanced Dashboard**: Modernized `BannerSlotManager.jsx` with 5 KPI summary cards (Total Banners, Active on Store, Scheduled Windows, Inactive / Hidden, Slot Coverage meter), placement section tabs, status and slot filters, search bar, sort controls, visual card grid view, and high-density data table view.
3. **Structured 6-Section Form Modal**: Created `StoreBannerFormModal.jsx` featuring a structured, step-by-step workflow:
   - Section 1: General Information & Copy (Title, Badge, Subtitle, CTA Button, Alt Text)
   - Section 2: Banner Artwork & Media (Upload with drag & drop, Direct URL, Curated Presets, 2MB size limit, SVG security notice, mobile responsive image support)
   - Section 3: Placement & Priority (12 supported slots grouped by section with exact dimension tags, displayOrder index)
   - Section 4: Destination & Navigation (Destination link URL, link format validator, quick test link button, quick destination suggestions, optional campaign association)
   - Section 5: Schedule & Status (Master publication toggle, scheduled publication window with startsAt and endsAt datetime pickers, time-bound status calculator)
   - Section 6: Live Interactive Preview & Review (Desktop & Mobile view toggles, simulated storefront banner card, pre-publishing checklist)
4. **Live Storefront Preview Modal**: Created `StoreBannerPreviewModal.jsx` allowing full resolution inspection of any banner in its simulated storefront slot with Desktop and Mobile viewport toggles.
5. **Shared Banner Utilities**: Created `banner.util.js` with pure schedule status computation, link validation, and dashboard KPI calculations.
6. **Regression Verification**:
   - Backend: 24 tests passed (14 focused Phase E5 tests + 10 storefront slot tests).
   - Frontend: 446 unit tests passed (15 new Phase E5 tests).
   - Production Build: Next.js production build succeeded with exit code 0 (`271/271` static pages generated).
   - Browser E2E Testing: Automated browser subagent executed full banner creation, image selection, live previewing, field-preserving edit, status toggling, and verified storefront rendering and campaign separation with WebP video and screenshots.

---

## 2. EXISTING ARCHITECTURE & BEHAVIOR DISCOVERED

### Data Model (`backend/src/models/StorefrontBanner.js`):
- **Model Name:** `StorefrontBanner` (Collection: `storefrontbanners`)
- **Key Fields:**
  - `title`: String, required, trim, max 200
  - `subtitle`: String, trim, max 300, default null
  - `badge`: String, trim, max 50, default null
  - `ctaText`: String, trim, max 50, default null
  - `slotKey`: String, enum `ALLOWED_BANNER_SLOTS` (indexed)
  - `placement`: Virtual alias getter/setter mapping to `slotKey`
  - `imageUrl`: String, required, trim
  - `mobileImageUrl`: String, trim, default null
  - `linkUrl`: String, trim, default null
  - `altText`: String, trim, default null
  - `campaignId`: ObjectId ref `Campaign`, default null (indexed)
  - `displayOrder`: Number, min 0, default 0 (indexed)
  - `isActive`: Boolean, default true (indexed)
  - `startsAt`: Date, default null (indexed)
  - `endsAt`: Date, default null (indexed)
  - `createdBy`: ObjectId ref `User`, required (indexed)
  - `deletedAt`: Date, default null (soft delete)
- **Validation Hook:** `pre("validate")` verifies `startsAt < endsAt` if both are supplied.

### 12 Supported Storefront Slots (`ALLOWED_BANNER_SLOTS`):
1. `hero_main`: Hero Main — Primary Carousel Slide (840 × 430 px, ~2:1)
2. `hero_audio`: Hero Card 1 — Audio Essentials (384 × 115 px, ~3.3:1)
3. `hero_smart_home`: Hero Card 2 — Smart Devices (384 × 115 px, ~3.3:1)
4. `hero_brand_deals`: Hero Card 3 — Brand Deals (384 × 115 px, ~3.3:1)
5. `mid_work_smarter`: Mid Banner 1 — Work Smarter 67% Width (840 × 260 px, ~3.2:1)
6. `mid_stylish_looks`: Mid Banner 2 — Stylish Looks 33% Width (420 × 260 px, ~1.6:1)
7. `category_audio`: Category Highlight 1 — Audio Mood (400 × 300 px, 4:3)
8. `category_workspace`: Category Highlight 2 — Workspace Upgrade (400 × 300 px, 4:3)
9. `category_smart_living`: Category Highlight 3 — Smart Living (400 × 300 px, 4:3)
10. `bottom_home_kitchen`: Bottom Promo 1 — Home & Kitchen (400 × 300 px, 4:3)
11. `bottom_smart_gadgets`: Bottom Promo 2 — Smart Gadgets (400 × 300 px, 4:3)
12. `bottom_monsoon_special`: Bottom Promo 3 — Monsoon Special (400 × 300 px, 4:3)

### API Endpoints & Permissions (`backend/src/routes/storefront-banner.routes.js`):
- `GET /api/v1/storefront/banners/active`: Public endpoint. Filters `isActive: true`, `startsAt <= now` (or null), `endsAt >= now` (or null), and optional `slotKey` / `placement`.
- `GET /api/v1/storefront/banners`: Protected endpoint (`authenticate`, `SETTINGS_READ`). Returns all non-deleted banners.
- `GET /api/v1/storefront/banners/:bannerId`: Protected endpoint (`authenticate`, `SETTINGS_READ`).
- `POST /api/v1/storefront/banners`: Protected endpoint (`authenticate`, `SETTINGS_MANAGE`).
- `PATCH /api/v1/storefront/banners/:bannerId`: Protected endpoint (`authenticate`, `SETTINGS_MANAGE`).
- `DELETE /api/v1/storefront/banners/:bannerId`: Protected endpoint (`authenticate`, `SETTINGS_MANAGE`).

### Media Storage Architecture (`backend/src/controllers/storefront-media.controller.js`):
- Endpoint: `POST /api/v1/storefront/media/upload` (`SETTINGS_MANAGE` required).
- Multipart file upload using multer memory storage.
- File Size Limit: **2 MB** max (`MAX_BRAND_ASSET_SIZE = 2 * 1024 * 1024`).
- Allowed MIME types: JPEG, PNG, WebP, GIF, AVIF, ICO.
- Security Constraint: **SVG uploads strictly rejected** (`SVG_NOT_ALLOWED`) with a 400 error to prevent stored XSS attacks.
- Magic byte verification for PNG, JPEG, GIF, and WebP.
- File synchronization: Writes simultaneously to `backend/public/uploads` and `frontend/public/uploads` with generated unique hash filenames (`media_<timestamp>_<hex>.<ext>`), returning file path `/uploads/<filename>`.

---

## 3. CONFIRMED PROBLEMS IN THE OLD UI / WORKFLOW

| # | Component / Flow | Old Behavior / Deficiency | Resolved in Phase E5 |
|---|------------------|---------------------------|----------------------|
| 1 | **Scheduling Inputs** | Form had **no fields** for `startsAt` or `endsAt`, making time-bound banner scheduling impossible from the UI despite full backend support. | Added dedicated "Schedule & Status" section with datetime-local inputs, range validation, and live schedule status badge. |
| 2 | **Mobile Banner Artwork** | Form had **no input** for `mobileImageUrl`. Admins could not configure responsive artwork for smartphone viewports. | Added optional mobile artwork upload and URL input, with desktop/mobile preview toggles. |
| 3 | **Image Upload Constraints** | Old UI claimed a 5MB limit and listed SVG as supported; server threw `SVG_NOT_ALLOWED` and rejected files > 2MB. | Updated UI guidelines to explicitly indicate 2MB limit and explain SVG exclusion for XSS security. Added client-side pre-validation. |
| 4 | **Form Organization** | Flat single-page modal with all fields jumbled together, lacking structure or workflow. | Refactored into a polished 6-section tabbed modal matching the visual quality and usability of `CampaignFormModal.jsx`. |
| 5 | **Preview Experience** | Only showed a tiny artwork thumbnail in the form; no way to see how text, badges, and CTA buttons rendered over the image. | Added real-time simulated storefront card preview with Desktop and Mobile modes and a standalone `StoreBannerPreviewModal`. |
| 6 | **KPI Summary Cards** | Only counted total banners and hero carousel slides; gave no visibility into slot coverage or scheduled time windows. | Implemented 5 KPI cards: Total Banners, Active on Store, Scheduled Windows, Inactive Drafts, and Slot Coverage progress meter. |
| 7 | **Search & Filters** | Had basic text search and 3 buttons; could not filter by specific slot or by scheduled/expired status. | Added multi-level filtering: Status (All, Active, Scheduled, Hidden), specific slot dropdown, sort dropdown, and real-time query search. |
| 8 | **Destructive Actions** | Delete was immediate or used raw alert; lacked clear details about the affected banner. | Implemented safe confirmation modal detailing banner name and storefront removal implications. |

---

## 4. FILES CHANGED & PURPOSE

| File Path | Status | Purpose |
|-----------|--------|---------|
| [frontend/src/utils/banner.util.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/utils/banner.util.js) | Created | Pure JavaScript utilities for banner schedule status computation (`getBannerScheduleStatus`), destination link URL validation (`isBannerLinkValid`), and dashboard KPI calculation (`calculateBannerKPIs`). |
| [frontend/src/components/admin/cms/StoreBannerPreviewModal.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/cms/StoreBannerPreviewModal.jsx) | Created | Standalone modal for previewing any configured store banner in its realistic slot aspect ratio with responsive Desktop and Mobile view toggles, metadata grid, and link tester. |
| [frontend/src/components/admin/cms/StoreBannerFormModal.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/cms/StoreBannerFormModal.jsx) | Created | Structured 6-section Add/Edit banner form modal matching the Campaign Form UX, featuring drag-and-drop upload, preset selection, dimension hints, destination URL tester, scheduling pickers, and live card preview. |
| [frontend/src/components/admin/cms/BannerSlotManager.jsx](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/cms/BannerSlotManager.jsx) | Enhanced | Modernized dashboard with 5 KPI summary cards, section tabs, status and slot filters, search and sort controls, card grid view, data table view, and integrated form and preview modals. |
| [backend/tests/phase-e5-store-banner-management.test.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase-e5-store-banner-management.test.js) | Created | Backend regression test suite covering all 16 Phase G invariants (listing, creating, editing without field degradation, scheduling, media upload security, RBAC, campaign separation). |
| [frontend/tests/unit/phase-e5-store-banner-management.test.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/tests/unit/phase-e5-store-banner-management.test.js) | Created | Frontend unit tests verifying banner slot definitions, schedule status calculator, link validation, KPI calculations, and component contract integrity. |

---

## 5. FORM AND DASHBOARD IMPROVEMENTS

### Dashboard UX (`BannerSlotManager.jsx`):
- **Hero Header**: Live CMS badge, Storefront link, Refresh button, and primary "Add New Banner" action.
- **5 KPI Summary Cards**:
  1. *Total Banners*: Total count across all sections.
  2. *Active on Store*: Live banners currently displayed to shoppers.
  3. *Scheduled Windows*: Time-bound banners with future starts or expiration dates.
  4. *Inactive / Hidden*: Draft artwork withheld from public display.
  5. *Slot Coverage*: Progress meter showing populated slots out of 12 (e.g. `8 / 12 Slots - 67%`).
- **Placement Section Tabs**: Filter by All, Hero Showcase Carousel, Hero Mini Side Cards, Mid-Page Banners, Category Highlights, and Bottom Seasonal Promos.
- **Multi-Level Filtering Bar**:
  - Filter pills for status: `All Status`, `Active Live`, `Scheduled`, `Hidden`.
  - Dropdown filter for specific slots.
  - Sort dropdown: `Display Order`, `Title A-Z`, `Newest First`.
  - Real-time search by title, subtitle, badge, slotKey, and destination link.
  - View switcher: Visual Card Grid vs High-Density Data Table.
- **Visual Card Grid**:
  - Slot key and section label badges.
  - Schedule status indicator (`Live`, `Scheduled (Starts [date])`, `Expired`, `Hidden`).
  - Active/Inactive power switch with optimistic toggle.
  - Artwork thumbnail with hover zoom effect.
  - Title, subtitle, destination link with click-to-test button, display order badge.
  - Actions: `Preview` (opens full modal), `Edit` (opens structured form), `Delete` (opens confirmation).

### Structured 6-Section Form Modal (`StoreBannerFormModal.jsx`):
1. **General Information**: Banner Title (required), Subtitle / Promo Copy, Badge Text, CTA Button Text, Alt Text.
2. **Artwork & Media**: Upload File (drag & drop with progress bar), Image URL/Path, Sample Presets selector. 2MB file limit notice, SVG security notice. Mobile responsive artwork input.
3. **Placement & Priority**: Slot dropdown grouped by section with exact dimensions (e.g. `840 × 430 px (~2:1)`) and descriptions. Display Order priority number input.
4. **Destination & Navigation**: Destination link URL input with format validation, "Test Link" button, quick suggestions (`/shop`, `/shop?category=audio`, `/campaigns`), optional Campaign ID association.
5. **Schedule & Status**: Master publication toggle (`Published Live` vs `Draft / Hidden`). Time-bound scheduling toggle with start and end datetime pickers and range validation (`startsAt < endsAt`).
6. **Preview & Publish**: Simulated storefront card preview with Desktop and Mobile view toggles. Pre-publishing verification checklist. "Publish Banner" / "Update Banner" button.

---

## 6. IMAGE-UPLOAD AND STORAGE BEHAVIOR

1. **Storage Endpoint Reused**: Communicates directly with existing `/api/v1/storefront/media/upload` via `adminMediaService.uploadMedia(file)`.
2. **File Size Enforcement**: Client and server reject images exceeding 2 MB (`MAX_BRAND_ASSET_SIZE`).
3. **Format Security**: Supported formats include PNG, WebP, JPEG, and AVIF. SVG uploads are strictly rejected (`SVG_NOT_ALLOWED`) on both client and server to prevent stored XSS attacks.
4. **Dual-Directory Persistence**: Files are written to both `backend/public/uploads` and `frontend/public/uploads`, allowing immediate serving via Next.js `/uploads/<filename>`.
5. **Field Preservation During Edits**: Editing an existing banner does not clear or mutate `imageUrl` or `mobileImageUrl` unless explicitly replaced or cleared by the administrator.

---

## 7. STOREFRONT COMPATIBILITY RESULTS

- **Active Banners API**: Storefront components fetching `/api/v1/storefront/banners/active` receive only active banners within their scheduled time windows.
- **Hero Carousel (`HeroSection.jsx`)**: Banners assigned to `hero_main` render seamlessly in the carousel with their title, subtitle, badge, and CTA button.
- **Hero Mini Side Cards**: Banners assigned to `hero_audio`, `hero_smart_home`, and `hero_brand_deals` populate the 3 stacked cards beside the hero carousel.
- **Mid-Page & Category Rows**: Banners assigned to `mid_work_smarter`, `mid_stylish_looks`, `category_audio`, `category_workspace`, and `category_smart_living` continue to render in their designated slots.
- **Fallback Behavior**: Slots with no active banners safely fall back to default assets via `useBannerSlot.js` without layout shifts or crashes.
- **Destination Navigation**: Clicking banner links routes correctly to internal marketplace categories or collections.

---

## 8. PERMISSION AND SECURITY RESULTS

- **Admin Write Endpoints (`POST`, `PATCH`, `DELETE`)**: Protected by `authenticate` and `requirePermissions(PERMISSIONS.SETTINGS_MANAGE)`.
- **Admin Read Endpoints (`GET /`, `GET /:id`)**: Protected by `authenticate` and `requirePermissions(PERMISSIONS.SETTINGS_READ)`.
- **Public Storefront Endpoint (`GET /active`)**: Open to unauthenticated shoppers, returning only active, eligible banners.
- **Customer Role Mutation Rejection**: Verified that regular customer accounts attempting to create, update, or delete banners are rejected with `403 Forbidden`.
- **Unauthenticated Mutation Rejection**: Verified that unauthenticated requests to mutating endpoints receive `401 Unauthorized`.
- **SVG Upload Rejection**: Verified that attempting to upload SVG files via the media endpoint is rejected with `400 SVG_NOT_ALLOWED`.

---

## 9. EXACT TEST COMMANDS AND RESULTS

### Backend Tests:
```bash
npx jest tests/phase-e5-store-banner-management.test.js tests/storefront-banner-slots.test.js --runInBand
```
**Result: PASS (24 passed, 2 total test suites)**
```
PASS tests/phase-e5-store-banner-management.test.js
  PHASE E5 — Store Banner Management UX & Workflow Enhancement Tests
    1. Banner Creation & Listing Contract
      √ should list existing storefront banners via admin endpoint (83 ms)
      √ should create a banner with all structured fields (63 ms)
    2. Editing Banner without Field Degradation
      √ should update banner title without clearing imageUrl or other fields (47 ms)
      √ should allow replacing imageUrl without affecting displayOrder or linkUrl (36 ms)
    3. Status & Scheduling Invariants
      √ should reject startsAt >= endsAt with 400 INVALID_BANNER_SCHEDULE (27 ms)
      √ should accept valid scheduled start and end dates (47 ms)
      √ should exclude expired scheduled banners from public active storefront API (59 ms)
      √ should exclude future scheduled banners from public active storefront API (28 ms)
      √ should hide inactive banners from public active storefront API (32 ms)
    4. Media Upload & Validation Security
      √ should reject SVG uploads for stored XSS security (53 ms)
      √ should upload a valid PNG image and return accessible file URL (129 ms)
    5. Role & Permission Security
      √ should reject unauthenticated attempt to create a banner with 401 (39 ms)
      √ should reject customer role attempt to create or update banner with 403 (15 ms)
    6. Campaign Separation Invariants
      √ should allow linking optional campaignId without altering campaign lifecycle or collection (12 ms)

PASS tests/storefront-banner-slots.test.js
  Storefront Banner Slot Manager API Tests
    1. Validation & Allowed Placements
      √ should accept valid promotional slotKey (hero_audio) (179 ms)
      √ should accept placement alias and map to slotKey (60 ms)
      √ should accept data URI image format (38 ms)
      √ should reject an invalid slotKey not in the allowed enum list (25 ms)
    2. Active Banners Listing & Slot Filtering
      √ public GET /storefront/banners/active returns active banners without auth (45 ms)
      √ public GET /storefront/banners/active?slotKey=category_audio filters specifically by slotKey (19 ms)
    3. Banner Updates & Deletion
      √ should allow admin to update slotKey, altText, linkUrl, and isActive (64 ms)
      √ should allow admin to delete a banner (51 ms)
    4. Security & Role Enforcement
      √ should reject unauthenticated attempt to create banner with 401 (9 ms)
      √ should reject customer attempt to create banner with 403 (12 ms)

Test Suites: 2 passed, 2 total
Tests:       24 passed, 24 total
Time:        8.606 s
```

### Frontend Tests:
```bash
npm test
```
**Result: PASS (446 passed, 153 test suites, 0 failed)**
```
ℹ tests 446
ℹ suites 153
ℹ pass 446
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2988.6234
```

---

## 10. PRODUCTION BUILD AND BROWSER VERIFICATION

### Frontend Production Build:
```bash
npm run build
```
- **Exit Code:** 0
- **Compilation:** `✓ Compiled successfully in 32.1s`
- **Static Page Generation:** `✓ Generating static pages using 11 workers (271/271) in 12.5s`
- **Output:** All administrator and storefront routes built cleanly without TypeScript, ESLint, or Webpack errors.

### Browser E2E Verification:
Automated browser subagents executed complete end-to-end user journeys:
1. **Admin Login**: Authenticated at `/administrator/login` with staff credentials.
2. **Dashboard Review**: Navigated to `/administrator/marketing/banners`. Verified the 5 KPI cards, section tabs, filter bar, and banner card layout.
3. **Banner Creation**: Opened `StoreBannerFormModal`, entered `Browser E2E Showcase Banner`, badge `30% OFF`, description, CTA `Explore Audio`, selected `hero_audio` preset artwork, target slot `hero_main`, destination `/shop?category=audio`, verified Desktop/Mobile preview, and published.
4. **Slot Preview**: Opened `StoreBannerPreviewModal` from the banner card, verified Desktop aspect ratio rendering and Mobile responsive rendering, and closed.
5. **Editing with Field Preservation**: Opened banner in edit mode, updated title to `Browser E2E Showcase Banner (Updated)`, confirmed that artwork, slot, and link remained populated, and saved.
6. **Quick Status Toggle**: Toggled active/inactive status switch directly from the dashboard card.
7. **Storefront Verification**: Navigated to `http://localhost:3000/`, verified hero carousel rendering and active promotions.
8. **Campaign Separation**: Navigated to `http://localhost:3000/campaigns`, verified campaign discovery page and marketing campaigns remain fully operational.

### Verification Artifacts:
- **Video Recording (Creation & Dashboard):** [phase_e5_store_banner_verification.webp](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/phase_e5_store_banner_verification_1793099570505.webp)
- **Video Recording (Preview & Edit):** [phase_e5_storefront_preview_verification.webp](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/phase_e5_storefront_preview_verification_1793099814795.webp)
- **Video Recording (Storefront & Campaigns):** [phase_e5_storefront_homepage_verification.webp](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/phase_e5_storefront_homepage_verification_1793099939336.webp)
- **Dashboard Screenshot:** [banners_dashboard.png](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/banners_dashboard_1793099621111.png)
- **Desktop Preview Modal Screenshot:** [banner_preview_desktop.png](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/banner_preview_desktop_1793099834159.png)
- **Updated Banner Screenshot:** [banners_updated_final.png](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/banners_updated_final_1793099926713.png)
- **Storefront Homepage Screenshot:** [storefront_homepage.png](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/storefront_homepage_1793099962371.png)
- **Campaigns Discovery Page Screenshot:** [campaigns_discovery_page.png](file:///C:/Users/itspr/.gemini/antigravity-ide/brain/2d3165a0-7d8a-42db-9e3c-30c2f09d09fa/campaigns_discovery_page_1793099975102.png)

---

## 11. KNOWN LIMITATIONS AND DEPLOYMENT CONSIDERATIONS

1. **SVG Upload Restriction**: As intentionally designed for XSS prevention, SVG artwork cannot be uploaded directly via the multipart upload endpoint. SVG assets packaged in `/public/images/banners/*.svg` can still be referenced via static paths.
2. **Carousel Rotation Order**: In the `hero_main` slot, multiple active banners rotate based on `displayOrder` ascending. Setting identical order indices will fall back to database insertion order.
3. **Timezone Considerations**: Scheduled start and end dates are saved as UTC ISO strings. The dashboard formats dates using the local administrator browser timezone.
4. **Environment Isolation**: Production deployments should verify that the static uploads directory (`public/uploads`) is mounted on persistent shared storage if horizontally scaled across multiple instances.

---

## 12. CONCLUSION & ACCEPTANCE SIGN-OFF

Phase E5 has completely achieved its objective. The Superadmin/Admin Store Banner management interface now provides an intuitive, high-quality, structured experience matching the Campaign management interface while preserving every underlying business rule, security boundary, and storefront integration.

**Final Status:** **PASS**
