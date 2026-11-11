# BUYBOX E-COMMERCE
## UNCOMMITTED WORK INVENTORY & ISOLATION STRATEGY
### Phase: PROJECT-REPOSITORY-HYGIENE-01
### Document: `docs/archive/repository-cleanup-01/UNCOMMITTED_WORK_INVENTORY.md`
### Date: November 11, 2026

---

## 1. Executive Summary

This inventory documents all **111 uncommitted changes** currently present in the working tree (77 modified tracked files and 35 untracked files).

### Forensic Verification of Branch Origin
A cross-branch forensic audit was performed across all local and remote branches (`main`, `origin/main`, `backup/pre-sync-e72f639`, `origin/feature/reference-storefront-category`, `origin/fix/superadmin-global-control-audit`).

**Conclusion:**
- These 111 files represent **unique local feature implementation work** developed across recent completed phases (Customer Account Deletion, Vendor Warehouse Operations, Inventory Reconciliation, Warehouse Analytics, Refund Governance, and RBAC).
- **None of these changes are included in `origin/main` or any other branch.**
- They are completely uncommitted in the local working tree.
- They MUST NOT be discarded, reset, or overwritten.

---

## 2. Classification Summary

### By High-Level Category

| Category | File Count | Description |
|---|---:|---|
| **Previous feature-phase implementation changes** | 102 | Feature logic, schemas, and test suites |
| **Repository cleanup changes** | 5 | Reports and templates related to repository hygiene |
| **Temporary/generated files** | 4 | Media uploads and test assets |

### By Feature Phase Domain

| Feature Phase / Domain | File Count | Key Components Affected |
|---|---:|---|
| **Asset/Media uploads** | 4 | Models, services, controllers, routes, tests, UI views |
| **CUSTOMER-ACCOUNT-DELETE-01 / AUTH** | 6 | Models, services, controllers, routes, tests, UI views |
| **MERCHANT-REFUND-GOVERNANCE-01** | 6 | Models, services, controllers, routes, tests, UI views |
| **ORDER-OPERATIONS / DISCOUNTS** | 1 | Models, services, controllers, routes, tests, UI views |
| **PLATFORM-SERVICES** | 23 | Models, services, controllers, routes, tests, UI views |
| **PROJECT-REPOSITORY-HYGIENE-01** | 5 | Models, services, controllers, routes, tests, UI views |
| **RBAC-01 / RBAC-02 / PHASE-SA-04** | 14 | Models, services, controllers, routes, tests, UI views |
| **REFUND-GATEWAY-RECONCILIATION-01** | 6 | Models, services, controllers, routes, tests, UI views |
| **SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS** | 14 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-CONSOLE-INTEGRITY / SUPPORT** | 8 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-FINANCE / SETTLEMENTS** | 3 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-INVENTORY-RECONCILIATION-03** | 4 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE** | 7 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-WAREHOUSE-ANALYTICS-04 / BUGFIX** | 3 | Models, services, controllers, routes, tests, UI views |
| **VENDOR-WAREHOUSE-OPERATIONS-02** | 7 | Models, services, controllers, routes, tests, UI views |

---

## 3. Comprehensive Inventory Table (111 Files)

| # | Status | File Path | Classification Category | Phase / Feature Domain | Description |
|---|---|---|---|---|---|
| 1 | `Modified (tracked)` | `ackend/README.md` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 2 | `Modified (tracked)` | `backend/src/constants/permissions.constants.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 3 | `Modified (tracked)` | `backend/src/constants/refund.constants.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 4 | `Modified (tracked)` | `backend/src/controllers/admin-customer.controller.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 5 | `Modified (tracked)` | `backend/src/controllers/inventory.controller.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 6 | `Modified (tracked)` | `backend/src/controllers/question.controller.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 7 | `Modified (tracked)` | `backend/src/controllers/return-request.controller.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 8 | `Modified (tracked)` | `backend/src/controllers/review.controller.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 9 | `Modified (tracked)` | `backend/src/controllers/warehouse.controller.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 10 | `Modified (tracked)` | `backend/src/middlewares/authentication.middleware.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 11 | `Modified (tracked)` | `backend/src/middlewares/error.middleware.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 12 | `Modified (tracked)` | `backend/src/middlewares/validate.middleware.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 13 | `Modified (tracked)` | `backend/src/models/Inventory.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 14 | `Modified (tracked)` | `backend/src/models/InventoryTransaction.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 15 | `Modified (tracked)` | `backend/src/models/Refund.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 16 | `Modified (tracked)` | `backend/src/models/ReturnRequest.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 17 | `Modified (tracked)` | `backend/src/models/StockCount.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03` | Physical cycle counting, blind stock auditing, and movement-aware reconciliation |
| 18 | `Modified (tracked)` | `backend/src/models/StockReceiving.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 19 | `Modified (tracked)` | `backend/src/models/StockTransfer.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 20 | `Modified (tracked)` | `backend/src/models/SupportTicket.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 21 | `Modified (tracked)` | `backend/src/repositories/analytics.repository.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 22 | `Modified (tracked)` | `backend/src/repositories/payment.repository.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 23 | `Modified (tracked)` | `backend/src/repositories/vendor-settlement.repository.js` | **Previous feature-phase implementation changes** | `VENDOR-FINANCE / SETTLEMENTS` | Vendor settlements, financial statements, and ledger accounting |
| 24 | `Modified (tracked)` | `backend/src/routes/admin-discount.routes.js` | **Previous feature-phase implementation changes** | `ORDER-OPERATIONS / DISCOUNTS` | Admin discount routes and order validation |
| 25 | `Modified (tracked)` | `backend/src/routes/index.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 26 | `Modified (tracked)` | `backend/src/routes/inventory.routes.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 27 | `Modified (tracked)` | `backend/src/routes/return-request.routes.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 28 | `Modified (tracked)` | `backend/src/routes/review.routes.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 29 | `Modified (tracked)` | `backend/src/routes/vendor.routes.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 30 | `Modified (tracked)` | `backend/src/services/analytics.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 31 | `Modified (tracked)` | `backend/src/services/auth.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 32 | `Modified (tracked)` | `backend/src/services/authorization.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 33 | `Modified (tracked)` | `backend/src/services/governance.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 34 | `Modified (tracked)` | `backend/src/services/inventory-transaction.service.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 35 | `Modified (tracked)` | `backend/src/services/inventory.service.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 36 | `Modified (tracked)` | `backend/src/services/refund-webhook.service.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 37 | `Modified (tracked)` | `backend/src/services/refund.service.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 38 | `Modified (tracked)` | `backend/src/services/return-request.service.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 39 | `Modified (tracked)` | `backend/src/services/review.service.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 40 | `Modified (tracked)` | `backend/src/services/stock-count.service.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03` | Physical cycle counting, blind stock auditing, and movement-aware reconciliation |
| 41 | `Modified (tracked)` | `backend/src/services/stock-receiving.service.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 42 | `Modified (tracked)` | `backend/src/services/stock-transfer.service.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 43 | `Modified (tracked)` | `backend/src/services/vendor-settlement.service.js` | **Previous feature-phase implementation changes** | `VENDOR-FINANCE / SETTLEMENTS` | Vendor settlements, financial statements, and ledger accounting |
| 44 | `Modified (tracked)` | `backend/src/services/warehouse.service.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 45 | `Modified (tracked)` | `backend/src/validators/order/return-request.validator.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 46 | `Modified (tracked)` | `backend/src/validators/support/support-ticket.validator.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 47 | `Modified (tracked)` | `backend/tests/google-auth.test.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 48 | `Modified (tracked)` | `backend/tests/phase-e7a-role-permission-acceptance.test.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 49 | `Modified (tracked)` | `backend/tests/phase-sa04-e2e-security-acceptance.test.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 50 | `Modified (tracked)` | `docs/archive/repository-cleanup-01/PROJECT_REPOSITORY_HYGIENE_01_COMPLETION_REPORT.md` | **Repository cleanup changes** | `PROJECT-REPOSITORY-HYGIENE-01` | Audit report, completion report, or documentation file created/edited during cleanup |
| 51 | `Modified (tracked)` | `frontend/src/app/(storefront)/orders/[orderId]/return/OrderReturnPageView.jsx` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 52 | `Modified (tracked)` | `frontend/src/app/admin/settings/permissions/page.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 53 | `Modified (tracked)` | `frontend/src/app/administrator/customers/[id]/page.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 54 | `Modified (tracked)` | `frontend/src/app/administrator/customers/page.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 55 | `Modified (tracked)` | `frontend/src/app/administrator/job-roles/[id]/page.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 56 | `Modified (tracked)` | `frontend/src/app/administrator/operations/refunds/page.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 57 | `Modified (tracked)` | `frontend/src/app/administrator/operations/returns/page.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 58 | `Modified (tracked)` | `frontend/src/app/administrator/settings/permissions/page.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 59 | `Modified (tracked)` | `frontend/src/app/vendor/analytics/page.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 60 | `Modified (tracked)` | `frontend/src/app/vendor/finance/statements/page.js` | **Previous feature-phase implementation changes** | `VENDOR-FINANCE / SETTLEMENTS` | Vendor settlements, financial statements, and ledger accounting |
| 61 | `Modified (tracked)` | `frontend/src/app/vendor/inventory/page.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03 / WAREHOUSE` | Inventory transactions, warehouse stock allocation, and audit trails |
| 62 | `Modified (tracked)` | `frontend/src/app/vendor/returns/[id]/page.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 63 | `Modified (tracked)` | `frontend/src/app/vendor/returns/page.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 64 | `Modified (tracked)` | `frontend/src/app/vendor/reviews/page.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 65 | `Modified (tracked)` | `frontend/src/app/vendor/support/page.js` | **Previous feature-phase implementation changes** | `VENDOR-CONSOLE-INTEGRITY / SUPPORT` | Merchant product reviews, Q&A, and support ticket management |
| 66 | `Modified (tracked)` | `frontend/src/app/vendor/warehouses/[id]/page.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-OPERATIONS-02` | Warehouse receiving, inter-warehouse transfers, and fulfillment center operations |
| 67 | `Modified (tracked)` | `frontend/src/components/admin/AdminSidebar.jsx` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 68 | `Modified (tracked)` | `frontend/src/components/admin/PermissionGate.jsx` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 69 | `Modified (tracked)` | `frontend/src/components/admin/shared/PermissionGate.jsx` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 70 | `Modified (tracked)` | `frontend/src/components/vendor/index.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 71 | `Modified (tracked)` | `frontend/src/constants/permissions.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 72 | `Modified (tracked)` | `frontend/src/hooks/admin/usePermissions.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 73 | `Modified (tracked)` | `frontend/src/lib/auth/permissions.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 74 | `Modified (tracked)` | `frontend/src/services/admin/admin.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 75 | `Modified (tracked)` | `frontend/src/services/admin/customer.service.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 76 | `Modified (tracked)` | `frontend/src/services/vendor.service.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 77 | `Modified (tracked)` | `frontend/src/stores/admin-auth.store.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 78 | `Untracked (new)` | `backend/.env.production.example` | **Repository cleanup changes** | `PROJECT-REPOSITORY-HYGIENE-01` | Environment template allowed by .gitignore |
| 79 | `Untracked (new)` | `backend/public/uploads/media_1794128120956_388cc134.png` | **Temporary/generated files** | `Asset/Media uploads` | Public media assets uploaded during testing |
| 80 | `Untracked (new)` | `backend/public/uploads/media_1794128120970_612d0026.ico` | **Temporary/generated files** | `Asset/Media uploads` | Public media assets uploaded during testing |
| 81 | `Untracked (new)` | `backend/src/controllers/refund-application.controller.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 82 | `Untracked (new)` | `backend/src/models/RefundApplication.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 83 | `Untracked (new)` | `backend/src/routes/refund-application.routes.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 84 | `Untracked (new)` | `backend/src/services/refund-application.service.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 85 | `Untracked (new)` | `backend/src/services/warehouse-analytics.service.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-ANALYTICS-04 / BUGFIX` | Warehouse analytics, stock aging, turnover, and product performance aggregation fix |
| 86 | `Untracked (new)` | `backend/src/validators/order/refund-application.validator.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 87 | `Untracked (new)` | `backend/tests/phase-customer-account-delete-01.test.js` | **Previous feature-phase implementation changes** | `CUSTOMER-ACCOUNT-DELETE-01 / AUTH` | Customer permanent deletion lifecycle and Google Auth integration |
| 88 | `Untracked (new)` | `backend/tests/phase-merchant-ops-fix-01.test.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 89 | `Untracked (new)` | `backend/tests/phase-merchant-refund-governance-01.test.js` | **Previous feature-phase implementation changes** | `MERCHANT-REFUND-GOVERNANCE-01` | Refund disbursement application workflow separating merchant inspection from disbursement authority |
| 90 | `Untracked (new)` | `backend/tests/phase-merchant-returns-02.test.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 91 | `Untracked (new)` | `backend/tests/phase-merchant-reviews-returns.test.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 92 | `Untracked (new)` | `backend/tests/phase-razorpay-processed-buybox-pending-01.test.js` | **Previous feature-phase implementation changes** | `REFUND-GATEWAY-RECONCILIATION-01` | Razorpay refund status synchronization, pool accounting, and duplicate prevention |
| 93 | `Untracked (new)` | `backend/tests/phase-rbac-01-feature-sync.test.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 94 | `Untracked (new)` | `backend/tests/phase-rbac-02-runtime-security.test.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |
| 95 | `Untracked (new)` | `backend/tests/phase-refund-gateway-reconciliation-01.test.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03` | Physical cycle counting, blind stock auditing, and movement-aware reconciliation |
| 96 | `Untracked (new)` | `backend/tests/phase-superadmin-returns-01.test.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 97 | `Untracked (new)` | `backend/tests/phase-superadmin-returns-02.test.js` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 98 | `Untracked (new)` | `backend/tests/phase-vendor-inventory-reconciliation-03.test.js` | **Previous feature-phase implementation changes** | `VENDOR-INVENTORY-RECONCILIATION-03` | Physical cycle counting, blind stock auditing, and movement-aware reconciliation |
| 99 | `Untracked (new)` | `backend/tests/phase-vendor-warehouse-analytics-04.test.js` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-ANALYTICS-04 / BUGFIX` | Warehouse analytics, stock aging, turnover, and product performance aggregation fix |
| 100 | `Untracked (new)` | `backend/tests/phase-vendor-warehouse-details.test.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 101 | `Untracked (new)` | `backend/tests/phase-vendor-warehouse-operations-02.test.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 102 | `Untracked (new)` | `backend/tests/vendor-analytics-product-performance-subtract-array.test.js` | **Previous feature-phase implementation changes** | `PLATFORM-SERVICES` | Core application services, error handling, or validation middleware |
| 103 | `Untracked (new)` | `docs/archive/repository-cleanup-01/PROJECT_REPOSITORY_HYGIENE_01_PRE_MERGE_AUDIT.md` | **Repository cleanup changes** | `PROJECT-REPOSITORY-HYGIENE-01` | Audit report, completion report, or documentation file created/edited during cleanup |
| 104 | `Untracked (new)` | `frontend/.env.example` | **Repository cleanup changes** | `PROJECT-REPOSITORY-HYGIENE-01` | Environment template allowed by .gitignore |
| 105 | `Untracked (new)` | `frontend/.env.production.example` | **Repository cleanup changes** | `PROJECT-REPOSITORY-HYGIENE-01` | Environment template allowed by .gitignore |
| 106 | `Untracked (new)` | `frontend/public/uploads/media_1794128120956_388cc134.png` | **Temporary/generated files** | `Asset/Media uploads` | Public media assets uploaded during testing |
| 107 | `Untracked (new)` | `frontend/public/uploads/media_1794128120970_612d0026.ico` | **Temporary/generated files** | `Asset/Media uploads` | Public media assets uploaded during testing |
| 108 | `Untracked (new)` | `frontend/src/app/admin/operations/returns/[id]/` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 109 | `Untracked (new)` | `frontend/src/app/administrator/operations/returns/[id]/` | **Previous feature-phase implementation changes** | `SUPERADMIN-RETURNS-02 / MERCHANT-RETURNS` | Return request management, quality inspection, and reverse logistics |
| 110 | `Untracked (new)` | `frontend/src/components/vendor/WarehouseAnalyticsTab.jsx` | **Previous feature-phase implementation changes** | `VENDOR-WAREHOUSE-ANALYTICS-04 / BUGFIX` | Warehouse analytics, stock aging, turnover, and product performance aggregation fix |
| 111 | `Untracked (new)` | `frontend/tests/unit/phase-rbac-01-permissions.test.js` | **Previous feature-phase implementation changes** | `RBAC-01 / RBAC-02 / PHASE-SA-04` | Role-based access control, permission registry, and admin navigation guards |

---

## 4. Recommended Safe Isolation Strategy

To ensure that the repository cleanup branch (`chore/project-repository-hygiene-01`) can be cleanly merged into `main` without mixing cleanup chores with ongoing feature code, the following **non-destructive isolation strategy** is recommended:

### Option A: Dedicated Feature Branch Isolation (Recommended)
1. Create a dedicated feature branch from the current working tree to permanently preserve all 111 uncommitted feature changes in Git:
   ```bash
   git checkout -b feature/platform-hardening-and-vendor-ops-01
   git add -A
   git commit -m "feat: complete vendor warehouse operations, refund governance, customer deletion, and rbac"
   ```
2. Checkout the clean cleanup branch:
   ```bash
   git checkout chore/project-repository-hygiene-01
   ```
3. Merge `chore/project-repository-hygiene-01` into `main`.
4. Rebase or merge `main` into `feature/platform-hardening-and-vendor-ops-01`.

### Option B: Named Git Stash Isolation
1. Stash all uncommitted changes including untracked files with a clear description:
   ```bash
   git stash push -u -m "wip-feature-phases-customer-delete-vendor-ops-refund-gov"
   ```
2. Verify that `chore/project-repository-hygiene-01` working tree is clean.
3. Merge `chore/project-repository-hygiene-01` into `main`.
4. Reapply stashed changes on a new feature branch:
   ```bash
   git checkout -b feature/platform-hardening-and-vendor-ops-01
   git stash pop
   ```

### Safety Guardrails Observed
- ZERO files were reset, cleaned, or discarded.
- All 111 files remain safely preserved in the working tree.
- No destructive git commands were executed.
