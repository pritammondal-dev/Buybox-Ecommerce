# Buybox E-Commerce — Frontend Application

The modern, responsive web application for Buybox E-Commerce, built on **Next.js (App Router)**, **React 19**, and **Tailwind CSS**.

---

## 1. Application Architecture

The frontend is organized around Next.js App Router route groups to support three distinct portal personas within a unified monorepo application:

1. **Customer Storefront (`src/app/(storefront)/`):**
   - Homepage with promotional banners, flash deals, and curated collections.
   - Dynamic product search, category browsing, and product details with variant selectors.
   - Interactive shopping cart, checkout workflow, and customer order tracking.
   - Customer account profile, address book, and self-service return request filing.

2. **Vendor Merchant Console (`src/app/vendor/`):**
   - Store onboarding, KYC profile, and branding configuration.
   - Product catalog management (physical & digital products with multi-SKU variants).
   - Multi-warehouse fulfillment management: goods receiving, inter-warehouse transfers, stock adjustments, and physical cycle counting.
   - Real-time warehouse analytics: inventory turnover velocity, stock aging, and safety reorder alerts.
   - Merchant return inspection, reverse logistics, and refund application submission.
   - Financial ledger: wallet balances, settlement statements, and payout accounts.

3. **Administrator & Superadmin Console (`src/app/administrator/`):**
   - Fine-grained Role-Based Access Control (RBAC): dynamic permission management, job roles, and administrator accounts.
   - Vendor onboarding audits, compliance approvals, and store controls.
   - Authoritative refund disbursement authority: multi-step disbursement review, Razorpay reconciliation, and pool ledger auditing.
   - Customer support ticketing, product catalog moderation, and platform-wide settings.

---

## 2. Directory Layout

```text
frontend/
├── src/
│   ├── app/                  # Next.js App Router pages, layouts, and route handlers
│   │   ├── (storefront)/     # Customer-facing shopping experience
│   │   ├── administrator/    # Admin and Superadmin portal
│   │   ├── vendor/           # Vendor merchant portal
│   │   └── api/              # Next.js server route handlers (if any)
│   ├── components/           # Reusable component library
│   │   ├── admin/            # Admin UI components and PermissionGate
│   │   ├── vendor/           # Vendor UI components and analytics tabs
│   │   ├── ui/               # Base design system primitives (buttons, modals, tables)
│   │   └── ...               # Storefront navigation, headers, footers
│   ├── constants/            # Client permissions, navigation links, status maps
│   ├── hooks/                # React custom hooks (usePermissions, useAuth, useDebounce)
│   ├── lib/                  # Utility helpers, Axios client instance with auth interceptors
│   ├── services/             # Typed API service abstractions (admin, vendor, customer)
│   └── stores/               # Zustand state stores (admin-auth, cart, notifications)
├── tests/                    # Jest unit test suites for components and hooks
├── public/                   # Static assets, branding logos, and favicon
├── next.config.mjs           # Next.js build configuration (Turbopack / Webpack)
├── tailwind.config.js        # Tailwind CSS design system theme configuration
└── README.md                 # This documentation file
```

---

## 3. Environment Variables

Create `.env.local` in `frontend/`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## 4. Development & Running

### Installation
```bash
npm install
```

### Start Local Development Server
```bash
npm run dev
# App will run at http://localhost:3000
```

---

## 5. Testing & Production Build

### Run Unit Tests
```bash
# Run all frontend tests in non-watch mode
npm test -- --watchAll=false
```

### Verify Production Build
```bash
# Compile and build the production bundle
npm run build
```

---

## 6. Design System & Related Documentation

- [Vendor Dashboard Design Standards](../docs/architecture/buybox-vendor-dashboard-global-design-standard.md)
- [Frontend API Architecture](../docs/architecture/frontend-api-architecture.md)
- [UI/UX Design System Specification](../docs/architecture/ui-ux-design-system.md)
- [Backend API Contract](../docs/api/backend-api-contract.md)
