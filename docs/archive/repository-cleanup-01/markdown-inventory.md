# Buybox E-Commerce — Markdown Documentation Inventory
## Phase: PROJECT-REPOSITORY-HYGIENE-01
### Document Reference: `docs/archive/repository-cleanup-01/markdown-inventory.md`
### Date Generated: November 11, 2026

---

## 1. Executive Summary

As part of **PROJECT-REPOSITORY-HYGIENE-01**, this inventory comprehensively catalogs and classifies all **158 Markdown (`.md`) files** existing across the Buybox-Ecommerce repository prior to reorganization.

### Key Metrics
- **Total Markdown Files Identified:** 158
- **Total Combined Content Size:** 2995.00 KB
- **Total Combined Lines:** 44,115
- **Empty Files Identified:** 1 (`backend/README.md`, rebuilt in Phase 3)
- **Active Documentation Targets:**
  - Architecture: `docs/architecture/`
  - API Contracts: `docs/api/`
  - Operations & Runbooks: `docs/operations/`
  - Security & RBAC: `docs/security/`
  - Database & Migrations: `docs/database/`
  - Development & Onboarding: `README.md`, `backend/README.md`, `frontend/README.md`
- **Historical Phase Reports & Migration Audits:** Archived into `docs/archive/phase-reports/<domain>/`

---

## 2. Classification Taxonomy (Categories A – L)

| Code | Category Name | Description | Count |
|---|---|---|---|
| **A** | Core Architecture & System Design | System design, design standards, frontend/backend architecture | 3 |
| **B** | API & Integration Contracts | Authoritative API contracts, payload schemas, route definitions | 1 |
| **C** | Operations, Deployment & Runbooks | Production deployment guides, rollback procedures, operations manual | 1 |
| **D** | Security, RBAC & Governance | Authorization route matrices, authentication flows, RBAC registries | 2 |
| **E** | Database, Data Models & Migrations | Schema specifications, migration runbooks, collection designs | 2 |
| **F** | Development, Onboarding & Environment | Root/app READMEs, developer onboarding guides, agent instructions | 6 |
| **G** | Product Domain: Customer & Storefront | Customer-facing UX, storefront, CMS pages | 0 (mapped to archive L/storefront) |
| **H** | Product Domain: Vendor & Store Management | Vendor operations, console, onboarding | 0 (mapped to archive L/vendor) |
| **I** | Product Domain: Inventory & Logistics | Warehouse, stock counts, adjustments | 0 (mapped to archive L/inventory) |
| **J** | Product Domain: Orders & Returns | Orders, postpurchase, reverse logistics | 0 (mapped to archive L/orders) |
| **K** | Product Domain: Payments & Refunds | Payment gateways, refund accounting | 0 (mapped to archive L/refunds) |
| **L** | Historical Phase Reports & Migration Audits | Historical implementation, forensic audits, test & completion reports | 143 |

### Distribution of Historical Archive (Category L by Domain)
| Archive Domain Directory | Files |
|---|---|
| `docs/archive/phase-reports/analytics/` | 11 |
| `docs/archive/phase-reports/authentication/` | 2 |
| `docs/archive/phase-reports/authorization/` | 10 |
| `docs/archive/phase-reports/catalog/` | 11 |
| `docs/archive/phase-reports/finance/` | 20 |
| `docs/archive/phase-reports/infrastructure/` | 9 |
| `docs/archive/phase-reports/inventory/` | 11 |
| `docs/archive/phase-reports/legacy-documentation/` | 1 |
| `docs/archive/phase-reports/orders/` | 28 |
| `docs/archive/phase-reports/refunds/` | 15 |
| `docs/archive/phase-reports/storefront/` | 11 |
| `docs/archive/phase-reports/vendor/` | 14 |

---

## 3. Comprehensive Markdown Inventory Table

| # | Original Path | Cat | Proposed Destination | Size (Bytes) | Lines | Empty | Recommended Action |
|---|---|:---:|---|---:|---:|:---:|---|
| 1 | `BUYBOX_VENDOR_DASHBOARD_GLOBAL_DESIGN_STANDARD.md` | **A** | `docs/architecture/buybox-vendor-dashboard-global-design-standard.md` | 11,646 | 179 | No | Move to architecture |
| 2 | `frontend/docs/frontend-api-architecture.md` | **A** | `docs/architecture/frontend-api-architecture.md` | 15,854 | 282 | No | Move to architecture |
| 3 | `frontend/docs/ui-ux-design-system.md` | **A** | `docs/architecture/ui-ux-design-system.md` | 18,267 | 290 | No | Move to architecture |
| 4 | `frontend/docs/backend-api-contract.md` | **B** | `docs/api/backend-api-contract.md` | 36,002 | 1,091 | No | Move to api |
| 5 | `docs/PRODUCTION_OPERATIONS_AND_ROLLBACK_MANUAL.md` | **C** | `docs/operations/production-operations-and-rollback-manual.md` | 4,441 | 100 | No | Move to operations |
| 6 | `docs/security/authorization-route-matrix.md` | **D** | `docs/security/authorization-route-matrix.md` | 1,07,877 | 771 | No | Preserve in place (Security matrix) |
| 7 | `frontend/docs/auth-flow.md` | **D** | `docs/security/auth-flow.md` | 12,512 | 297 | No | Move to security |
| 8 | `docs/PHASE_2A_MIGRATION_SPECIFICATION.md` | **E** | `docs/database/phase-2a-migration-specification.md` | 8,659 | 144 | No | Move to database |
| 9 | `docs/PHASE_2B_INVENTORY_MIGRATION_SPECIFICATION.md` | **E** | `docs/database/phase-2b-inventory-migration-specification.md` | 16,889 | 254 | No | Move to database |
| 10 | `.agents/rules/ui-ux-design-system.md` | **F** | `.agents/rules/ui-ux-design-system.md` | 2,528 | 45 | No | Preserve in place (Agent rule) |
| 11 | `backend/README.md` | **F** | `backend/README.md` | 0 | 0 | Yes | Rebuild backend README with runtime & test instructions |
| 12 | `frontend/AGENTS.md` | **F** | `frontend/AGENTS.md` | 678 | 10 | No | Preserve in place (Agent instructions) |
| 13 | `frontend/CLAUDE.md` | **F** | `frontend/CLAUDE.md` | 11 | 2 | No | Preserve in place (Agent instructions) |
| 14 | `frontend/README.md` | **F** | `frontend/README.md` | 1,245 | 35 | No | Update frontend README with Next.js architecture & tests |
| 15 | `README.md` | **F** | `README.md` | 18 | 1 | No | Rebuild root README with full architecture & setup |
| 16 | `ADMIN_SUPERADMIN_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/catalog/ADMIN_SUPERADMIN_PRODUCTION_READINESS.md` | 18,115 | 243 | No | Move to archive catalog |
| 17 | `category_dynamic_href_error_remediation_report.md` | **L** | `docs/archive/phase-reports/storefront/category_dynamic_href_error_remediation_report.md` | 18,705 | 342 | No | Move to archive storefront |
| 18 | `CUSTOMER_VENDOR_AUTH_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/authentication/CUSTOMER_VENDOR_AUTH_PRODUCTION_READINESS.md` | 5,667 | 84 | No | Move to archive authentication |
| 19 | `docs/analytics.md` | **L** | `docs/archive/phase-reports/analytics/analytics.md` | 15,130 | 289 | No | Move to archive analytics |
| 20 | `EMAIL_COURIER_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/catalog/EMAIL_COURIER_PRODUCTION_READINESS.md` | 24,226 | 392 | No | Move to archive catalog |
| 21 | `FINAL_LAUNCH_READINESS_REPORT.md` | **L** | `docs/archive/phase-reports/infrastructure/FINAL_LAUNCH_READINESS_REPORT.md` | 32,536 | 460 | No | Move to archive infrastructure |
| 22 | `implementation_plan.md` | **L** | `docs/archive/legacy-documentation/implementation_plan.md` | 8,305 | 114 | No | Move to legacy archive |
| 23 | `PART_5_PRODUCTION_DEPLOYMENT_AND_GO_LIVE_REPORT.md` | **L** | `docs/archive/phase-reports/catalog/PART_5_PRODUCTION_DEPLOYMENT_AND_GO_LIVE_REPORT.md` | 26,636 | 406 | No | Move to archive catalog |
| 24 | `PHASE_3_MARKETPLACE_LIFECYCLE_COMPLETION_REPORT.md` | **L** | `docs/archive/phase-reports/storefront/PHASE_3_MARKETPLACE_LIFECYCLE_COMPLETION_REPORT.md` | 16,907 | 224 | No | Move to archive storefront |
| 25 | `PHASE_3B_VENDOR_REGISTRATION_REMEDIATION_REPORT.md` | **L** | `docs/archive/phase-reports/vendor/PHASE_3B_VENDOR_REGISTRATION_REMEDIATION_REPORT.md` | 13,823 | 210 | No | Move to archive vendor |
| 26 | `PHASE_4A_ADVANCED_PRODUCT_MANAGEMENT_COMPLETION_REPORT.md` | **L** | `docs/archive/phase-reports/catalog/PHASE_4A_ADVANCED_PRODUCT_MANAGEMENT_COMPLETION_REPORT.md` | 17,055 | 266 | No | Move to archive catalog |
| 27 | `PHASE_4B_DIGITAL_PRODUCT_MANAGEMENT_COMPLETION_REPORT.md` | **L** | `docs/archive/phase-reports/catalog/PHASE_4B_DIGITAL_PRODUCT_MANAGEMENT_COMPLETION_REPORT.md` | 31,576 | 434 | No | Move to archive catalog |
| 28 | `PHASE_4C_ADVANCED_WAREHOUSE_MANAGEMENT_COMPLETION_REPORT.md` | **L** | `docs/archive/phase-reports/inventory/PHASE_4C_ADVANCED_WAREHOUSE_MANAGEMENT_COMPLETION_REPORT.md` | 25,984 | 336 | No | Move to archive inventory |
| 29 | `phase_admin_dashboard_dynamic_implementation_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_admin_dashboard_dynamic_implementation_report.md` | 13,751 | 205 | No | Move to archive analytics |
| 30 | `phase_customer_account_delete_01_completion_report.md` | **L** | `docs/archive/phase-reports/authentication/phase_customer_account_delete_01_completion_report.md` | 11,675 | 146 | No | Move to archive authentication |
| 31 | `phase_customer_order_fulfillment_display_audit.md` | **L** | `docs/archive/phase-reports/orders/phase_customer_order_fulfillment_display_audit.md` | 29,253 | 436 | No | Move to archive orders |
| 32 | `phase_customer_order_fulfillment_display_remediation_report.md` | **L** | `docs/archive/phase-reports/orders/phase_customer_order_fulfillment_display_remediation_report.md` | 21,148 | 294 | No | Move to archive orders |
| 33 | `phase_E10_admin-inactivity-auto-logout-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E10_admin-inactivity-auto-logout-report.md` | 15,991 | 225 | No | Move to archive infrastructure |
| 34 | `phase_E11_infrastructure-readiness-gap-analysis-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E11_infrastructure-readiness-gap-analysis-report.md` | 30,937 | 317 | No | Move to archive infrastructure |
| 35 | `phase_E12A_persistent-media-storage-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12A_persistent-media-storage-report.md` | 22,560 | 294 | No | Move to archive infrastructure |
| 36 | `phase_E12B_environment-aware-api-media-url-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12B_environment-aware-api-media-url-report.md` | 23,062 | 310 | No | Move to archive infrastructure |
| 37 | `phase_E12C_trusted-proxy-distributed-rate-limiting-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12C_trusted-proxy-distributed-rate-limiting-report.md` | 19,638 | 288 | No | Move to archive infrastructure |
| 38 | `phase_E12D_mongodb-index-backup-recovery-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12D_mongodb-index-backup-recovery-report.md` | 22,081 | 330 | No | Move to archive infrastructure |
| 39 | `phase_E12E_worker-coordination-deployment-readiness-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12E_worker-coordination-deployment-readiness-report.md` | 25,114 | 284 | No | Move to archive infrastructure |
| 40 | `phase_E12E1_environment-bootstrap-verification-report.md` | **L** | `docs/archive/phase-reports/infrastructure/phase_E12E1_environment-bootstrap-verification-report.md` | 10,186 | 139 | No | Move to archive infrastructure |
| 41 | `phase_e4_campaign-discovery-and-hydration-acceptance-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_e4_campaign-discovery-and-hydration-acceptance-report.md` | 23,488 | 320 | No | Move to archive storefront |
| 42 | `phase_e5_store-banner-management-enhancement-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_e5_store-banner-management-enhancement-report.md` | 25,379 | 311 | No | Move to archive storefront |
| 43 | `phase_e6_cms-special-event-page-builder-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_e6_cms-special-event-page-builder-report.md` | 19,436 | 312 | No | Move to archive storefront |
| 44 | `phase_e6a_cms-special-event-page-builder-acceptance-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_e6a_cms-special-event-page-builder-acceptance-report.md` | 16,827 | 164 | No | Move to archive storefront |
| 45 | `phase_e7_role-permission-reconciliation-report.md` | **L** | `docs/archive/phase-reports/authorization/phase_e7_role-permission-reconciliation-report.md` | 28,053 | 333 | No | Move to archive authorization |
| 46 | `phase_e7a_role-permission-acceptance-audit-report.md` | **L** | `docs/archive/phase-reports/authorization/phase_e7a_role-permission-acceptance-audit-report.md` | 22,781 | 327 | No | Move to archive authorization |
| 47 | `phase_e8_feature-permission-coverage-audit-report.md` | **L** | `docs/archive/phase-reports/authorization/phase_e8_feature-permission-coverage-audit-report.md` | 26,819 | 194 | No | Move to archive authorization |
| 48 | `phase_e8a_campaign-date-hydration-fix-report.md` | **L** | `docs/archive/phase-reports/authorization/phase_e8a_campaign-date-hydration-fix-report.md` | 16,082 | 297 | No | Move to archive authorization |
| 49 | `phase_finance_overview_gl_variance_audit.md` | **L** | `docs/archive/phase-reports/finance/phase_finance_overview_gl_variance_audit.md` | 23,295 | 367 | No | Move to archive finance |
| 50 | `phase_finance_overview_legacy_exception_governance_report.md` | **L** | `docs/archive/phase-reports/finance/phase_finance_overview_legacy_exception_governance_report.md` | 18,051 | 255 | No | Move to archive finance |
| 51 | `phase_finance_overview_legacy_ledger_disposition_report.md` | **L** | `docs/archive/phase-reports/finance/phase_finance_overview_legacy_ledger_disposition_report.md` | 17,738 | 270 | No | Move to archive finance |
| 52 | `phase_finance_overview_remediation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_finance_overview_remediation_report.md` | 22,192 | 418 | No | Move to archive finance |
| 53 | `phase_finance_overview_zero_values_audit.md` | **L** | `docs/archive/phase-reports/finance/phase_finance_overview_zero_values_audit.md` | 33,286 | 508 | No | Move to archive finance |
| 54 | `phase_merchant_ops_02_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/orders/phase_merchant_ops_02_forensic_audit_report.md` | 29,372 | 378 | No | Move to archive orders |
| 55 | `phase_merchant_refund_governance_01_completion_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_merchant_refund_governance_01_completion_report.md` | 12,685 | 142 | No | Move to archive refunds |
| 56 | `phase_merchant_refund_governance_01_forensic_audit.md` | **L** | `docs/archive/phase-reports/refunds/phase_merchant_refund_governance_01_forensic_audit.md` | 23,132 | 286 | No | Move to archive refunds |
| 57 | `phase_merchant_refund_governance_01_implementation_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_merchant_refund_governance_01_implementation_report.md` | 10,504 | 153 | No | Move to archive refunds |
| 58 | `phase_merchant_refund_governance_01_security_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_merchant_refund_governance_01_security_report.md` | 12,934 | 181 | No | Move to archive refunds |
| 59 | `phase_merchant_refund_governance_01_test_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_merchant_refund_governance_01_test_report.md` | 10,252 | 180 | No | Move to archive refunds |
| 60 | `phase_merchant_returns_02_completion_report.md` | **L** | `docs/archive/phase-reports/orders/phase_merchant_returns_02_completion_report.md` | 17,407 | 263 | No | Move to archive orders |
| 61 | `phase_order_override_concurrency_audit.md` | **L** | `docs/archive/phase-reports/orders/phase_order_override_concurrency_audit.md` | 26,479 | 310 | No | Move to archive orders |
| 62 | `phase_order_override_concurrency_remediation_report.md` | **L** | `docs/archive/phase-reports/orders/phase_order_override_concurrency_remediation_report.md` | 22,172 | 402 | No | Move to archive orders |
| 63 | `phase_order_status_independent_verification_report.md` | **L** | `docs/archive/phase-reports/orders/phase_order_status_independent_verification_report.md` | 39,696 | 398 | No | Move to archive orders |
| 64 | `phase_postpurchase_103_lifecycle_integrity_report.md` | **L** | `docs/archive/phase-reports/orders/phase_postpurchase_103_lifecycle_integrity_report.md` | 15,141 | 211 | No | Move to archive orders |
| 65 | `phase_postpurchase_104_concurrency_recovery_report.md` | **L** | `docs/archive/phase-reports/orders/phase_postpurchase_104_concurrency_recovery_report.md` | 21,900 | 265 | No | Move to archive orders |
| 66 | `phase_postpurchase_105_distributed_transaction_report.md` | **L** | `docs/archive/phase-reports/orders/phase_postpurchase_105_distributed_transaction_report.md` | 22,831 | 290 | No | Move to archive orders |
| 67 | `phase_postpurchase_107_gross_refund_gst_integrity_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_postpurchase_107_gross_refund_gst_integrity_report.md` | 17,332 | 223 | No | Move to archive refunds |
| 68 | `phase_PRODUCT_INSPECT_vendor_attribution_restoration-report.md` | **L** | `docs/archive/phase-reports/catalog/phase_PRODUCT_INSPECT_vendor_attribution_restoration-report.md` | 23,112 | 345 | No | Move to archive catalog |
| 69 | `phase_refund_100_remediation_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_100_remediation_report.md` | 17,453 | 347 | No | Move to archive refunds |
| 70 | `phase_refund_101_production_integrity_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_101_production_integrity_report.md` | 13,661 | 230 | No | Move to archive refunds |
| 71 | `phase_refund_102_lifecycle_integrity_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_102_lifecycle_integrity_report.md` | 13,962 | 147 | No | Move to archive refunds |
| 72 | `phase_refund_gateway_reconciliation_01_completion_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_completion_report.md` | 5,288 | 83 | No | Move to archive refunds |
| 73 | `phase_refund_gateway_reconciliation_01_financial_integrity_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_financial_integrity_report.md` | 8,166 | 169 | No | Move to archive refunds |
| 74 | `phase_refund_gateway_reconciliation_01_forensic_audit.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_forensic_audit.md` | 16,896 | 233 | No | Move to archive refunds |
| 75 | `phase_refund_gateway_reconciliation_01_implementation_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_implementation_report.md` | 6,798 | 91 | No | Move to archive refunds |
| 76 | `phase_refund_gateway_reconciliation_01_security_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_security_report.md` | 5,119 | 101 | No | Move to archive refunds |
| 77 | `phase_refund_gateway_reconciliation_01_test_report.md` | **L** | `docs/archive/phase-reports/refunds/phase_refund_gateway_reconciliation_01_test_report.md` | 6,849 | 95 | No | Move to archive refunds |
| 78 | `phase_returns_exchange_acceptance_b_report.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_acceptance_b_report.md` | 23,413 | 358 | No | Move to archive orders |
| 79 | `phase_returns_exchange_acceptance_c_report.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_acceptance_c_report.md` | 18,678 | 315 | No | Move to archive orders |
| 80 | `phase_returns_exchange_acceptance_report.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_acceptance_report.md` | 25,293 | 287 | No | Move to archive orders |
| 81 | `phase_returns_exchange_final_acceptance_audit_report.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_final_acceptance_audit_report.md` | 12,465 | 176 | No | Move to archive orders |
| 82 | `phase_returns_exchange_forensic_audit.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_forensic_audit.md` | 15,259 | 195 | No | Move to archive orders |
| 83 | `phase_returns_exchange_remediation_audit.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_remediation_audit.md` | 8,374 | 135 | No | Move to archive orders |
| 84 | `phase_returns_exchange_remediation_report.md` | **L** | `docs/archive/phase-reports/orders/phase_returns_exchange_remediation_report.md` | 17,256 | 285 | No | Move to archive orders |
| 85 | `phase_SA-01_customer_vendor_account_management_audit.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-01_customer_vendor_account_management_audit.md` | 47,549 | 510 | No | Move to archive authorization |
| 86 | `phase_SA-02_backend_account_lifecycle_security_report.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-02_backend_account_lifecycle_security_report.md` | 40,574 | 701 | No | Move to archive authorization |
| 87 | `phase_SA-03_superadmin_customer_vendor_account_ui_report.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-03_superadmin_customer_vendor_account_ui_report.md` | 31,191 | 427 | No | Move to archive authorization |
| 88 | `phase_SA-03_vendor_detail_jsx_build_fix_report.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-03_vendor_detail_jsx_build_fix_report.md` | 8,201 | 221 | No | Move to archive authorization |
| 89 | `phase_SA-03B_vendor_delete_password_reset_remediation_report.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-03B_vendor_delete_password_reset_remediation_report.md` | 14,194 | 207 | No | Move to archive authorization |
| 90 | `phase_SA-04_end_to_end_security_acceptance_report.md` | **L** | `docs/archive/phase-reports/authorization/phase_SA-04_end_to_end_security_acceptance_report.md` | 31,220 | 350 | No | Move to archive authorization |
| 91 | `phase_SM1_superadmin_storefront_merchandising-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_SM1_superadmin_storefront_merchandising-report.md` | 22,128 | 365 | No | Move to archive storefront |
| 92 | `phase_SM2_advanced_storefront_merchandising-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_SM2_advanced_storefront_merchandising-report.md` | 24,190 | 375 | No | Move to archive storefront |
| 93 | `phase_SM2E_currentList_runtime_fix-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_SM2E_currentList_runtime_fix-report.md` | 9,224 | 157 | No | Move to archive storefront |
| 94 | `phase_SM2E_product-selection-ux-report.md` | **L** | `docs/archive/phase-reports/catalog/phase_SM2E_product-selection-ux-report.md` | 14,501 | 247 | No | Move to archive catalog |
| 95 | `phase_SM2E_runtime_stabilization-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_SM2E_runtime_stabilization-report.md` | 15,101 | 282 | No | Move to archive storefront |
| 96 | `phase_storefront_flash-sale-hot-deal-layout-refinement-report.md` | **L** | `docs/archive/phase-reports/storefront/phase_storefront_flash-sale-hot-deal-layout-refinement-report.md` | 9,213 | 112 | No | Move to archive storefront |
| 97 | `phase_superadmin_returns_01_completion_report.md` | **L** | `docs/archive/phase-reports/orders/phase_superadmin_returns_01_completion_report.md` | 19,391 | 277 | No | Move to archive orders |
| 98 | `phase_superadmin_returns_02_completion_report.md` | **L** | `docs/archive/phase-reports/orders/phase_superadmin_returns_02_completion_report.md` | 16,313 | 174 | No | Move to archive orders |
| 99 | `phase_superadmin_returns_02_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/orders/phase_superadmin_returns_02_forensic_audit_report.md` | 18,774 | 176 | No | Move to archive orders |
| 100 | `phase_superadmin_vendor_management_audit.md` | **L** | `docs/archive/phase-reports/vendor/phase_superadmin_vendor_management_audit.md` | 39,169 | 381 | No | Move to archive vendor |
| 101 | `phase_superadmin_vendor_management_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_superadmin_vendor_management_remediation_report.md` | 42,459 | 685 | No | Move to archive vendor |
| 102 | `phase_variable_product_deletion_remediation_report.md` | **L** | `docs/archive/phase-reports/catalog/phase_variable_product_deletion_remediation_report.md` | 20,331 | 216 | No | Move to archive catalog |
| 103 | `phase_variable_product_permanent_deletion_audit.md` | **L** | `docs/archive/phase-reports/catalog/phase_variable_product_permanent_deletion_audit.md` | 28,831 | 363 | No | Move to archive catalog |
| 104 | `phase_VB-01_vendor_bank_account_architecture_audit.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-01_vendor_bank_account_architecture_audit.md` | 38,091 | 599 | No | Move to archive finance |
| 105 | `phase_VB-02_backend_bank_account_foundation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-02_backend_bank_account_foundation_report.md` | 29,874 | 423 | No | Move to archive finance |
| 106 | `phase_VB-03_vendor_bank_account_console_ui_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-03_vendor_bank_account_console_ui_report.md` | 15,693 | 263 | No | Move to archive finance |
| 107 | `phase_VB-04_superadmin_bank_account_compliance_console_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-04_superadmin_bank_account_compliance_console_report.md` | 25,153 | 354 | No | Move to archive finance |
| 108 | `phase_VB-04R_bank_application_partner_bank_remediation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-04R_bank_application_partner_bank_remediation_report.md` | 30,912 | 504 | No | Move to archive finance |
| 109 | `phase_VB-04R2_vendor_bank_application_finance_navigation_remediation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-04R2_vendor_bank_application_finance_navigation_remediation_report.md` | 18,731 | 268 | No | Move to archive finance |
| 110 | `phase_VB-05_payout_integration_destination_integrity_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VB-05_payout_integration_destination_integrity_report.md` | 28,059 | 414 | No | Move to archive finance |
| 111 | `phase_VD-01_vendor_dashboard_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-01_vendor_dashboard_forensic_audit_report.md` | 36,260 | 386 | No | Move to archive vendor |
| 112 | `phase_VD-02_vendor_dashboard_core_usability_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-02_vendor_dashboard_core_usability_remediation_report.md` | 13,786 | 172 | No | Move to archive vendor |
| 113 | `phase_VD-03_vendor_analytics_reporting_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_VD-03_vendor_analytics_reporting_report.md` | 18,800 | 347 | No | Move to archive analytics |
| 114 | `phase_VD-04_store_branding_kyc_modernization_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-04_store_branding_kyc_modernization_report.md` | 23,801 | 363 | No | Move to archive vendor |
| 115 | `phase_VD-05_unified_order_management_fulfillment_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-05_unified_order_management_fulfillment_report.md` | 15,262 | 225 | No | Move to archive orders |
| 116 | `phase_VD-06_shipping_dispatch_fulfillment_implementation_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-06_shipping_dispatch_fulfillment_implementation_report.md` | 26,025 | 370 | No | Move to archive orders |
| 117 | `phase_VD-06A_shipping_dispatch_fulfillment_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-06A_shipping_dispatch_fulfillment_forensic_audit_report.md` | 31,530 | 501 | No | Move to archive orders |
| 118 | `phase_VD-06B_shipping_security_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-06B_shipping_security_remediation_report.md` | 16,801 | 232 | No | Move to archive vendor |
| 119 | `phase_VD-06C_vendor_first_order_management_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-06C_vendor_first_order_management_forensic_audit_report.md` | 36,848 | 411 | No | Move to archive orders |
| 120 | `phase_VD-06D_vendor_first_order_management_remediation_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-06D_vendor_first_order_management_remediation_report.md` | 24,580 | 379 | No | Move to archive orders |
| 121 | `phase_VD-06E_merchant_shipment_blank_forensic_audit_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-06E_merchant_shipment_blank_forensic_audit_report.md` | 26,721 | 456 | No | Move to archive vendor |
| 122 | `phase_VD-06F_merchant_shipment_creation_courier_booking_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_VD-06F_merchant_shipment_creation_courier_booking_remediation_report.md` | 14,944 | 217 | No | Move to archive vendor |
| 123 | `phase_VD-07A_order_shipment_state_integrity_forensic_audit.md` | **L** | `docs/archive/phase-reports/orders/phase_VD-07A_order_shipment_state_integrity_forensic_audit.md` | 27,232 | 446 | No | Move to archive orders |
| 124 | `phase_vendor_analytics_sort_remediation_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_vendor_analytics_sort_remediation_report.md` | 10,461 | 183 | No | Move to archive analytics |
| 125 | `phase_vendor_console_integrity_a_forensic_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_vendor_console_integrity_a_forensic_report.md` | 38,350 | 547 | No | Move to archive vendor |
| 126 | `phase_vendor_console_integrity_b_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_vendor_console_integrity_b_remediation_report.md` | 31,279 | 440 | No | Move to archive vendor |
| 127 | `phase_vendor_console_integrity_c_acceptance_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_vendor_console_integrity_c_acceptance_report.md` | 27,520 | 374 | No | Move to archive vendor |
| 128 | `phase_vendor_inventory_reconciliation_03_completion_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_inventory_reconciliation_03_completion_report.md` | 6,750 | 95 | No | Move to archive inventory |
| 129 | `phase_vendor_inventory_reconciliation_03_forensic_audit.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_inventory_reconciliation_03_forensic_audit.md` | 11,564 | 186 | No | Move to archive inventory |
| 130 | `phase_vendor_inventory_reconciliation_03_implementation_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_inventory_reconciliation_03_implementation_report.md` | 13,062 | 214 | No | Move to archive inventory |
| 131 | `phase_vendor_inventory_reconciliation_03_test_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_inventory_reconciliation_03_test_report.md` | 7,231 | 140 | No | Move to archive inventory |
| 132 | `phase_vendor_shipment_auth_context_audit.md` | **L** | `docs/archive/phase-reports/vendor/phase_vendor_shipment_auth_context_audit.md` | 29,713 | 419 | No | Move to archive vendor |
| 133 | `phase_vendor_shipment_auth_context_remediation_report.md` | **L** | `docs/archive/phase-reports/vendor/phase_vendor_shipment_auth_context_remediation_report.md` | 19,821 | 262 | No | Move to archive vendor |
| 134 | `phase_vendor_wallet_settlement_automation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_vendor_wallet_settlement_automation_report.md` | 26,141 | 445 | No | Move to archive finance |
| 135 | `phase_vendor_wallet_withdrawal_eligibility_audit.md` | **L** | `docs/archive/phase-reports/finance/phase_vendor_wallet_withdrawal_eligibility_audit.md` | 25,625 | 358 | No | Move to archive finance |
| 136 | `phase_vendor_warehouse_analytics_04_completion_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_vendor_warehouse_analytics_04_completion_report.md` | 10,329 | 167 | No | Move to archive analytics |
| 137 | `phase_vendor_warehouse_analytics_04_forensic_audit.md` | **L** | `docs/archive/phase-reports/analytics/phase_vendor_warehouse_analytics_04_forensic_audit.md` | 11,905 | 192 | No | Move to archive analytics |
| 138 | `phase_vendor_warehouse_analytics_04_implementation_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_vendor_warehouse_analytics_04_implementation_report.md` | 7,941 | 94 | No | Move to archive analytics |
| 139 | `phase_vendor_warehouse_analytics_04_test_report.md` | **L** | `docs/archive/phase-reports/analytics/phase_vendor_warehouse_analytics_04_test_report.md` | 6,798 | 96 | No | Move to archive analytics |
| 140 | `phase_vendor_warehouse_details_ui_data_remediation_01_completion_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_warehouse_details_ui_data_remediation_01_completion_report.md` | 9,365 | 123 | No | Move to archive inventory |
| 141 | `phase_vendor_warehouse_operations_02_completion_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_warehouse_operations_02_completion_report.md` | 6,731 | 91 | No | Move to archive inventory |
| 142 | `phase_vendor_warehouse_operations_02_forensic_audit.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_warehouse_operations_02_forensic_audit.md` | 13,350 | 200 | No | Move to archive inventory |
| 143 | `phase_vendor_warehouse_operations_02_implementation_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_warehouse_operations_02_implementation_report.md` | 10,146 | 130 | No | Move to archive inventory |
| 144 | `phase_vendor_warehouse_operations_02_test_report.md` | **L** | `docs/archive/phase-reports/inventory/phase_vendor_warehouse_operations_02_test_report.md` | 7,012 | 83 | No | Move to archive inventory |
| 145 | `phase_VW-01_financial_architecture_audit_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-01_financial_architecture_audit_report.md` | 39,804 | 525 | No | Move to archive finance |
| 146 | `phase_VW-02_commission_engine_order_snapshot_report.md` | **L** | `docs/archive/phase-reports/orders/phase_VW-02_commission_engine_order_snapshot_report.md` | 22,838 | 366 | No | Move to archive orders |
| 147 | `phase_VW-03_vendor_wallet_ledger_foundation_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-03_vendor_wallet_ledger_foundation_report.md` | 34,086 | 611 | No | Move to archive finance |
| 148 | `phase_VW-04_vendor_withdrawal_payout_workflow_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-04_vendor_withdrawal_payout_workflow_report.md` | 24,253 | 358 | No | Move to archive finance |
| 149 | `phase_VW-05_superadmin_financial_control_commission_management_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-05_superadmin_financial_control_commission_management_report.md` | 28,249 | 469 | No | Move to archive finance |
| 150 | `phase_VW-05S_admin_vendor_wallets_react_key_warning_fix_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-05S_admin_vendor_wallets_react_key_warning_fix_report.md` | 9,277 | 185 | No | Move to archive finance |
| 151 | `phase_VW-05T_vendor_directory_id_display_fix_report.md` | **L** | `docs/archive/phase-reports/finance/phase_VW-05T_vendor_directory_id_display_fix_report.md` | 6,978 | 115 | No | Move to archive finance |
| 152 | `vendor_analytics_product_performance_regression_test_report.md` | **L** | `docs/archive/phase-reports/analytics/vendor_analytics_product_performance_regression_test_report.md` | 4,677 | 61 | No | Move to archive analytics |
| 153 | `vendor_analytics_product_performance_subtract_array_bug_audit.md` | **L** | `docs/archive/phase-reports/analytics/vendor_analytics_product_performance_subtract_array_bug_audit.md` | 6,729 | 125 | No | Move to archive analytics |
| 154 | `vendor_analytics_product_performance_subtract_array_bug_fix.md` | **L** | `docs/archive/phase-reports/analytics/vendor_analytics_product_performance_subtract_array_bug_fix.md` | 7,141 | 190 | No | Move to archive analytics |
| 155 | `VENDOR_DASHBOARD_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/catalog/VENDOR_DASHBOARD_PRODUCTION_READINESS.md` | 14,885 | 219 | No | Move to archive catalog |
| 156 | `VENDOR_NAV_WAREHOUSE_AUDIT.md` | **L** | `docs/archive/phase-reports/inventory/VENDOR_NAV_WAREHOUSE_AUDIT.md` | 21,115 | 340 | No | Move to archive inventory |
| 157 | `VENDOR_ORDER_FULFILLMENT_SETTLEMENT_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/orders/VENDOR_ORDER_FULFILLMENT_SETTLEMENT_PRODUCTION_READINESS.md` | 6,405 | 105 | No | Move to archive orders |
| 158 | `VENDOR_PORTAL_PRODUCTION_READINESS.md` | **L** | `docs/archive/phase-reports/catalog/VENDOR_PORTAL_PRODUCTION_READINESS.md` | 7,702 | 132 | No | Move to archive catalog |

---

## 4. Execution Plan & Target Directory Structure

The reorganization is executed strictly according to the following principles:
1. **Zero Content Loss:** Every historical phase report is preserved and categorized into its proper domain folder under `docs/archive/phase-reports/`.
2. **Active Documentation Promoted:** Architecture, API contract, security, operations, and database migration documents are promoted to dedicated top-level directories in `docs/`.
3. **Repository Entrypoints Rebuilt:** Root `README.md` and `backend/README.md` are updated/rebuilt with accurate architectural diagrams, setup guides, and navigation indexes.
4. **Agent Configurations Preserved:** `frontend/AGENTS.md`, `frontend/CLAUDE.md`, and `.agents/rules/ui-ux-design-system.md` remain untouched in their active operational locations.
