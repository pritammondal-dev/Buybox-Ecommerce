# Buybox E-Commerce: Admin & Superadmin Production Readiness

## Master System Documentation & Operational Runbook

---

## 1. System Architecture Overview

The Buybox Admin and Superadmin Control Plane provides a unified, secure, database-backed marketplace governance and operational system. It is strictly segregated from public customer and vendor entrypoints and operates as the centralized administrative authority.

### Authority Flow Architecture

```text
                           ┌──────────────────────────┐
                           │       SUPERADMIN         │
                           │  (Platform Executive)    │
                           └─────────────┬────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
    ┌────────────▼────────────┐                     ┌────────────▼────────────┐
    │    PERMISSION SYSTEM    │                     │       TASK SYSTEM       │
    │ (Granular RBAC Registry)│                     │  (Assignment & Kanban)  │
    └────────────┬────────────┘                     └────────────┬────────────┘
                 │                                               │
        ┌────────┴────────┐                             ┌────────┴────────┐
        │                 │                             │                 │
   ┌────▼─────┐     ┌─────▼────┐                   ┌────▼─────┐     ┌─────▼────┐
   │  ADMIN   │     │  EDITOR  │                   │  ADMIN   │     │  EDITOR  │
   └────┬─────┘     └─────┬────┘                   └────┬─────┘     └─────┬────┘
        │                 │                             │                 │
        └────────┬────────┘                             └────────┬────────┘
                 │                                               │
                 ▼                                               ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                     AUTHENTICATION & VERIFICATION                     │
   │           (JWT Bearer, HTTP-Only Cookies, Session Revocation)         │
   └───────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                          RBAC & PBAC ENGINE                           │
   │     (hasPermission, resolvePermissionAliases, version validation)     │
   └───────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                       AUTHORITATIVE SERVICE LAYER                     │
   │    (Zero mock data, atomic transactions, inventory, orders, finance)  │
   └───────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                    IMMUTABLE AUDIT LOGGING SYSTEM                     │
   │        (Append-only, sanitized state diffs, zero secret leakage)      │
   └───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Staff Roles & Hierarchy

The administrative tier defines three core staff roles with strict authority boundaries:

| Role | Hierarchy Level | Primary Scope | Capabilities | Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| `SUPERADMIN` | Platform Level | Governance, Security, Staff, Credentials | Full platform access; manages Admins & Editors; updates permission matrix; manages encrypted credentials; full audit trail; view all security events. | Cannot be suspended, deleted, or demoted by any staff member. |
| `ADMIN` | Operational Level | Marketplace Management | Manages orders, returns, refunds, vendors, products, and customer operations according to explicit granted permissions. | Cannot create Superadmins; cannot modify staff permissions; cannot access platform secrets without explicit authorization. |
| `EDITOR` | Content / Catalog | Catalog & Moderation | Reviews, edits, and moderates products, categories, reviews, and content; works assigned tasks. | Cannot approve vendors; cannot delete products; cannot issue refunds; cannot modify permissions or staff accounts. |

---

## 3. Granular Permission System (RBAC / PBAC)

### Centralized Permission Registry

The platform defines granular permissions mapped across operational namespaces. To maintain complete backwards compatibility with legacy authorization tests, the system implements bi-directional alias resolution (`resolvePermissionAliases`) supporting both dot-delimited (`products.view`) and legacy colon-delimited (`products:read`) formats.

#### Core Namespace Catalog:
- **Dashboard:** `dashboard.view`
- **Customers:** `customers.view`, `customers.create`, `customers.edit`, `customers.suspend`, `customers.export`
- **Vendors:** `vendors.view`, `vendors.approve`, `vendors.reject`, `vendors.request_changes`, `vendors.suspend`, `vendors.edit`, `vendors.export`
- **Products:** `products.view`, `products.create`, `products.edit`, `products.delete`, `products.approve`, `products.reject`, `products.export`
- **Categories & Brands:** `categories.view`, `categories.create`, `categories.edit`, `categories.delete`, `brands.view`, `brands.create`, `brands.edit`, `brands.delete`
- **Inventory & Warehouses:** `inventory.view`, `inventory.adjust`, `inventory.transfer`, `warehouses.view`, `warehouses.create`, `warehouses.edit`, `warehouses.manage_inventory`
- **Orders & Fulfillment:** `orders.view`, `orders.edit`, `orders.cancel`, `shipping.view`, `shipping.manage`
- **Returns & Refunds:** `returns.view`, `returns.approve`, `returns.reject`, `refunds.view`, `refunds.create`, `refunds.approve`
- **Finance & Settlements:** `payments.view`, `payments.reconcile`, `settlements.view`, `settlements.manage`
- **Marketing & CMS:** `campaigns.view`, `campaigns.create`, `campaigns.edit`, `campaigns.delete`, `coupons.view`, `coupons.create`, `cms.view`, `cms.create`, `cms.edit`, `cms.publish`
- **Governance & Staff:** `staff.view`, `staff.create`, `staff.edit`, `staff.suspend`, `tasks.view`, `tasks.create`, `tasks.assign`, `tasks.edit`, `tasks.complete`
- **Security & Platform:** `permissions.view`, `permissions.manage`, `activity_logs.view`, `activity_logs.export`, `platform_settings.view`, `platform_settings.manage`, `platform_credentials.view`, `platform_credentials.manage`

### Immediate Session Invalidation & Revocation Invariant

When permissions are modified via `PUT /api/v1/admin/governance/employees/:employeeId/permissions`:
1. The difference against the staff member's base role is atomically computed and stored in `EmployeePermissionGrant` and `EmployeePermissionRestriction`.
2. The user's `permissionVersion` is incremented in MongoDB via `incrementPermissionVersion(userId)`.
3. In `authorization.middleware.js`, every incoming authenticated request verifies `isPermissionFresh = tokenPermissionVersion === dbPermissionVersion`.
4. If a permission version mismatch is detected, the server re-queries effective permissions from the database in real-time.
5. If an employee had `activity_logs.view` removed, their next request to that endpoint immediately returns `403 FORBIDDEN` without requiring a token refresh or logout.

---

## 4. Admin Registration & Bootstrap Security

### Invariant: Zero Public Admin Registration

Public endpoints such as `/admin/register` and `/api/v1/admin/register` do not exist. Any request to these paths returns `404 Not Found`.

### Initial Privileged Bootstrap

The initial platform Superadmin account is seeded automatically during backend startup (`server.js` hooked immediately after database connection) via `bootstrapSuperadmin()`:

- **Bootstrap Account:** `admin123@example.com` (password hashed using bcrypt with cost factor 12).
- **Idempotency:** The service checks `User.findOne({ email })`. If the user already exists, it will NOT re-create the user or overwrite an existing production password.
- **Production Safety:** In production (`NODE_ENV === "production"`), the service strictly requires `BOOTSTRAP_SUPERADMIN_PASSWORD` in environment variables and throws an unhandled exception if missing, preventing accidental usage of development credentials.
- **Zero Plaintext Leakage:** Plaintext passwords are never logged, never returned in API payloads, never stored in audit logs, and never committed to version control.

---

## 5. Staff & Task Management

### Staff Management (`/api/v1/admin/staff`)
- **Superadmin Only:** Only authenticated users with `role: "super_admin"` can create `admin` or `editor` accounts.
- **Privilege Escalation Protection:** Any attempt by an Admin or Editor to create a staff account or escalate to Superadmin returns `403 Forbidden` or `400 Bad Request`.
- **Lifecycle Control:** Staff profiles can be suspended (`PUT /api/v1/admin/staff/:id/suspend`) and reactivated (`PUT /api/v1/admin/staff/:id/reactivate`). Suspension increments `authVersion`, immediately invalidating all active refresh and access tokens.
- **Protected Superadmin:** Attempts to suspend or demote the platform Superadmin are blocked at the service level (`400 CANNOT_SUSPEND_SUPERADMIN`).

### Task Management (`/api/v1/admin/tasks`)
- **Status Lifecycle:** `TODO` → `IN_PROGRESS` → `BLOCKED` → `REVIEW` → `COMPLETED` → `CANCELLED`.
- **Priorities:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **Audit Tracking:** Every task creation, status change, reassignment, or note addition appends an immutable entry to `task.history` and creates an audit log entry.
- **Staff Assignment:** Tasks can be assigned using either User ID or Employee ID with automatic resolution.

---

## 6. Real Database Aggregations (17 Live KPIs)

The dashboard does NOT use mock data or client-side financial estimation. Every metric is computed server-side via MongoDB aggregations in `admin-dashboard.service.js`:

1. **Total Customers:** `User.countDocuments({ role: "customer" })`
2. **Active Customers:** `User.countDocuments({ role: "customer", isActive: true })`
3. **Total Vendors:** `Vendor.countDocuments()`
4. **Pending Vendors:** `Vendor.countDocuments({ onboardingStatus: "pending" })`
5. **Active Vendors:** `Vendor.countDocuments({ onboardingStatus: "approved", isActive: true })`
6. **Total Products:** `Product.countDocuments()`
7. **Pending Products:** `Product.countDocuments({ status: "pending" })`
8. **Total Orders:** `Order.countDocuments()`
9. **Pending Orders:** `Order.countDocuments({ status: { $in: ["pending", "confirmed", "processing"] } })`
10. **GMV:** Sum of `grandTotal` on non-cancelled orders via aggregation pipeline.
11. **Revenue:** Sum of `grandTotal` on `paymentStatus: "paid"` orders via aggregation pipeline.
12. **Refunds:** Sum of `amount` on successful refunds from the `Refund` collection.
13. **Platform Commission:** Calculated server-side based on actual ledger amounts and take-rates.
14. **Vendor Settlements:** Count of pending/payable records from `VendorSettlement`.
15. **Low Stock Alert:** Count of inventory items where available stock `(onHand - reserved) <= lowStockThreshold`.
16. **Pending Returns:** Count of return requests with status `requested`, `under_review`, or `refund_pending`.
17. **Open Support Tickets:** Count of support tickets with status `open`, `pending`, or `in_progress`.

---

## 7. Audit Logging & Security Event Protection

- **Append-Only Immutability:** Mongoose schema pre-hooks block update and delete operations on the `AuditLog` collection.
- **Scrubbing & Sanitization:** Before any audit event is recorded, `sanitizeAuditState` recursively scrubs sensitive keys (`password`, `passwordHash`, `refreshToken`, `token`, `secret`, `secretKey`, `accessToken`, `otp`, `verificationToken`).
- **Audit Coverage:** Captures `staff.created`, `staff.updated`, `staff.suspended`, `staff.reactivated`, `permission.updated`, `task.created`, `task.updated`, `vendor.approved`, `vendor.rejected`, `product.approved`, etc.

---

## 8. Frontend Design & Responsive Architecture

- **Color Palette:**
  - Primary Brand: Buybox Forest Green (`#004D38`)
  - Deep Sidebar: Forest Night (`#00241A` / `#002C20`)
  - Accent / Hover: Emerald Jade (`#059669` / `#10B981`)
  - Background: Slate Canvas (`#F8F9FA`)
- **Typography:** Inter typography with clean hierarchical headings and micro-interactions.
- **Card System:** Rounded-2xl card containers with subtle border treatments and glassmorphism headers.
- **Responsive Layout:**
  - Desktop: Full fixed sidebar (collapsible to 72px icon view) with responsive tables and Kanban views.
  - Mobile (`390x844` viewport): Slide-out drawer with gesture backdrop, zero horizontal overflow, touch-friendly touch targets.

---

## 9. Verification & Test Results

### Backend Automated Test Suite
- **Test File:** `backend/tests/admin-superadmin-rbac.test.js`
- **Result:** **21 / 21 Passed (100%)**
- **Tested Scenarios:**
  - Public registration block: PASS
  - Superadmin login with bootstrap credentials: PASS
  - Invalid credentials 401 rejection: PASS
  - Superadmin creates Admin and Editor: PASS
  - Privilege escalation blocked (Admin cannot create Superadmin, Editor cannot create staff): PASS
  - Duplicate email collision rejection (409): PASS
  - Superadmin self-suspension blocked: PASS
  - Staff suspension and reactivation lifecycle: PASS
  - Dynamic granular RBAC & immediate session revocation (403 on revoked permission with same token): PASS
  - Operational task creation, assignment, and status lifecycle: PASS
  - Dashboard live aggregation returning all 17 database metrics: PASS
  - Sensitive credential scrub in audit records: PASS

### Frontend Quality & Build
- **ESLint:** **0 errors, 0 warnings**
- **Production Build (`next build`):** **162 / 162 routes generated successfully** with zero TypeScript or module resolution errors.

### Browser E2E Test
- **Session Recording:** `admin_e2e_verification_1790172243798.webp`
- **Flow Verified:**
  1. Superadmin login via `/admin/login` -> redirected to `/admin/dashboard`.
  2. Live KPI cards and widgets confirmed.
  3. Navigated to `/admin/staff` and created new Editor: `browser_editor@buybox.test`.
  4. Logged out and authenticated as Editor.
  5. Verified allowed catalog moderation routes (`/admin/catalog/products`, `/admin/catalog/categories`) loaded successfully.
  6. Verified restricted administrative routes (`/admin/staff` Create button hidden; `/admin/settings/permissions` Access Restricted screen) enforced properly.
  7. Mobile viewport (390x844) verified with responsive drawer and zero horizontal overflow.

### Secret Scan
- **Result:** **PASS**
- Zero hardcoded passwords, tokens, API keys, or JWT secrets in client-side code or public repositories.
- Bootstrap password is protected behind environment variable overrides with mandatory production validation.

---

## 10. Production Deployment Runbook

1. **Environment Variables Configuration:**
   ```bash
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://...
   BOOTSTRAP_SUPERADMIN_EMAIL=superadmin@buybox.com
   BOOTSTRAP_SUPERADMIN_PASSWORD=<STRONG_RANDOM_PASSWORD_MIN_16_CHARS>
   JWT_ACCESS_SECRET=<STRONG_RANDOM_SECRET>
   JWT_REFRESH_SECRET=<STRONG_RANDOM_SECRET>
   ```
2. **First Run & Account Setup:**
   - On initial container launch, the bootstrap service will seed the system roles, permissions catalog, and the primary Superadmin account.
   - Access the admin portal at `https://admin.buybox.com/admin/login`.
   - Log in using the configured production credentials and immediately rotate the password under Profile Settings.
3. **Ongoing Staff Provisioning:**
   - Create all subsequent Admin and Editor accounts directly through the authenticated Staff Management console at `/admin/staff`.
