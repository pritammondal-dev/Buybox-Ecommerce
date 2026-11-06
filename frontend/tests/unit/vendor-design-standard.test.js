import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  STATUS_STYLES,
  resolveStatusMeta,
} from "../../src/utils/status-badge.util.js";

test("BUYBOX VENDOR DASHBOARD — GLOBAL DESIGN STANDARD VERIFICATION", async (t) => {
  await t.test("Part 1: Status Badge Resolver and Style Metadata", () => {
    // 1. Theme Color Variants Exist
    assert.ok(STATUS_STYLES.emerald, "Emerald variant must exist for successful/active states");
    assert.ok(STATUS_STYLES.blue, "Blue variant must exist for in-transit/in-progress states");
    assert.ok(STATUS_STYLES.amber, "Amber variant must exist for warning/pending states");
    assert.ok(STATUS_STYLES.rose, "Rose variant must exist for error/rejected/out of stock states");
    assert.ok(STATUS_STYLES.purple, "Purple variant must exist for special/out-for-delivery states");
    assert.ok(STATUS_STYLES.slate, "Slate variant must exist for neutral/draft states");

    // 2. Order Fulfillment Status Mappings
    const fulfilledMeta = resolveStatusMeta("fulfilled", "order");
    assert.strictEqual(fulfilledMeta.variant, "emerald");
    assert.strictEqual(fulfilledMeta.label, "Fulfilled");

    const partialMeta = resolveStatusMeta("partially_fulfilled", "order");
    assert.strictEqual(partialMeta.variant, "blue");
    assert.strictEqual(partialMeta.label, "Partially Fulfilled");

    const processingMeta = resolveStatusMeta("processing", "order");
    assert.strictEqual(processingMeta.variant, "amber");
    assert.strictEqual(processingMeta.label, "Processing");

    const cancelledMeta = resolveStatusMeta("cancelled", "order");
    assert.strictEqual(cancelledMeta.variant, "rose");
    assert.strictEqual(cancelledMeta.label, "Cancelled");

    // 3. Product Catalog Status Mappings
    const activePrd = resolveStatusMeta("active", "catalog");
    assert.strictEqual(activePrd.variant, "emerald");
    assert.strictEqual(activePrd.label, "Active");

    const draftPrd = resolveStatusMeta("draft", "catalog");
    assert.strictEqual(draftPrd.variant, "slate");
    assert.strictEqual(draftPrd.label, "Draft");

    const reviewPrd = resolveStatusMeta("pending_review", "catalog");
    assert.strictEqual(reviewPrd.variant, "amber");
    assert.strictEqual(reviewPrd.label, "Pending Review");

    const rejectedPrd = resolveStatusMeta("rejected", "catalog");
    assert.strictEqual(rejectedPrd.variant, "rose");
    assert.strictEqual(rejectedPrd.label, "Rejected");

    // 4. Inventory Stock Health Mappings
    const healthyInv = resolveStatusMeta("healthy", "inventory");
    assert.strictEqual(healthyInv.variant, "emerald");
    assert.strictEqual(healthyInv.label, "Healthy");

    const lowStockInv = resolveStatusMeta("low_stock", "inventory");
    assert.strictEqual(lowStockInv.variant, "amber");
    assert.strictEqual(lowStockInv.label, "Low Stock");

    const outOfStockInv = resolveStatusMeta("out_of_stock", "inventory");
    assert.strictEqual(outOfStockInv.variant, "rose");
    assert.strictEqual(outOfStockInv.label, "Out of Stock");

    // 5. Logistics Shipment Mappings
    const transitShipment = resolveStatusMeta("in_transit", "shipment");
    assert.strictEqual(transitShipment.variant, "blue");
    assert.strictEqual(transitShipment.label, "In Transit");

    const outForDelivery = resolveStatusMeta("out_for_delivery", "shipment");
    assert.strictEqual(outForDelivery.variant, "purple");
    assert.strictEqual(outForDelivery.label, "Out for Delivery");

    // 6. Customer Returns & RMA Mappings
    const returnRequested = resolveStatusMeta("requested", "return");
    assert.strictEqual(returnRequested.variant, "amber");
    assert.strictEqual(returnRequested.label, "Pending Inspection");

    const returnApproved = resolveStatusMeta("approved", "return");
    assert.strictEqual(returnApproved.variant, "emerald");
    assert.strictEqual(returnApproved.label, "Approved");

    // 7. Finance Settlements Mappings
    const settledMeta = resolveStatusMeta("settled", "finance");
    assert.strictEqual(settledMeta.variant, "emerald");
    assert.strictEqual(settledMeta.label, "Disbursed");

    // 8. Unrecognized Status Fallback
    const fallbackMeta = resolveStatusMeta("custom_random_code");
    assert.strictEqual(fallbackMeta.variant, "slate");
    assert.strictEqual(fallbackMeta.label, "Custom Random Code");
  });

  await t.test("Part 2: Vendor Component Barrel Export Integrity", () => {
    const indexPath = path.resolve("src/components/vendor/index.js");
    assert.ok(fs.existsSync(indexPath), "Vendor component barrel index.js must exist");
    const indexCode = fs.readFileSync(indexPath, "utf8");

    const requiredExports = [
      "VendorShell",
      "VendorHeader",
      "VendorSidebar",
      "VendorMobileNav",
      "VendorLayoutWrapper",
      "VendorPageHeader",
      "VendorBreadcrumbs",
      "VendorKpiCard",
      "VendorStatusBadge",
      "VendorEmptyState",
      "VendorTablePagination",
    ];

    for (const exp of requiredExports) {
      assert.ok(
        indexCode.includes(exp),
        `Vendor barrel index.js must export ${exp}`
      );
    }
  });

  await t.test("Part 3: Reusable Component Structure & Accessibility Standards", () => {
    // 1. VendorBreadcrumbs
    const breadcrumbsPath = path.resolve("src/components/vendor/VendorBreadcrumbs.jsx");
    const breadcrumbsCode = fs.readFileSync(breadcrumbsPath, "utf8");
    assert.ok(breadcrumbsCode.includes('aria-label="Breadcrumb"'), "Breadcrumbs must have aria-label");
    assert.ok(breadcrumbsCode.includes("/vendor/dashboard"), "Breadcrumbs root must link to vendor dashboard");

    // 2. VendorPageHeader
    const pageHeaderPath = path.resolve("src/components/vendor/VendorPageHeader.jsx");
    const pageHeaderCode = fs.readFileSync(pageHeaderPath, "utf8");
    assert.ok(pageHeaderCode.includes("VendorBreadcrumbs"), "PageHeader must integrate VendorBreadcrumbs");
    assert.ok(pageHeaderCode.includes("actions"), "PageHeader must support actions slot");

    // 3. VendorKpiCard
    const kpiCardPath = path.resolve("src/components/vendor/VendorKpiCard.jsx");
    const kpiCardCode = fs.readFileSync(kpiCardPath, "utf8");
    assert.ok(kpiCardCode.includes("emerald"), "KpiCard must support emerald theme");
    assert.ok(kpiCardCode.includes("amber"), "KpiCard must support amber theme");
    assert.ok(kpiCardCode.includes("isLoading"), "KpiCard must support loading skeleton");
    assert.ok(kpiCardCode.includes("alert"), "KpiCard must support alert indicator");

    // 4. VendorEmptyState
    const emptyStatePath = path.resolve("src/components/vendor/VendorEmptyState.jsx");
    const emptyStateCode = fs.readFileSync(emptyStatePath, "utf8");
    assert.ok(emptyStateCode.includes("action.href"), "EmptyState must support action button/link");
    assert.ok(emptyStateCode.includes("title"), "EmptyState must display title");

    // 5. VendorHeader Global Search
    const headerPath = path.resolve("src/components/vendor/VendorHeader.jsx");
    const headerCode = fs.readFileSync(headerPath, "utf8");
    assert.ok(
      headerCode.includes("handleGlobalSearchSubmit") && headerCode.includes("/vendor/orders"),
      "VendorHeader must have Amazon Seller Central style smart search routing"
    );
  });

  await t.test("Part 4: Universal Dashboard Page Standard Adoption", () => {
    // 1. Dashboard Overview
    const dashboardPagePath = path.resolve("src/app/vendor/dashboard/page.js");
    const dashboardCode = fs.readFileSync(dashboardPagePath, "utf8");
    assert.ok(dashboardCode.includes("VendorPageHeader"), "Dashboard Overview must use VendorPageHeader");
    assert.ok(dashboardCode.includes("VendorKpiCard"), "Dashboard Overview must use VendorKpiCard");
    assert.ok(dashboardCode.includes("VendorStatusBadge"), "Dashboard Overview must use VendorStatusBadge");
    assert.ok(dashboardCode.includes("VendorEmptyState"), "Dashboard Overview must use VendorEmptyState");

    // 2. Product Catalog
    const productsPagePath = path.resolve("src/app/vendor/products/page.js");
    const productsCode = fs.readFileSync(productsPagePath, "utf8");
    assert.ok(productsCode.includes("VendorPageHeader"), "Products Page must use VendorPageHeader");
    assert.ok(productsCode.includes("VendorStatusBadge"), "Products Page must use VendorStatusBadge");
    assert.ok(productsCode.includes("VendorEmptyState"), "Products Page must use VendorEmptyState");
    assert.ok(productsCode.includes("VendorTablePagination"), "Products Page must use VendorTablePagination");

    // 3. Customer Orders
    const ordersPagePath = path.resolve("src/app/vendor/orders/page.js");
    const ordersCode = fs.readFileSync(ordersPagePath, "utf8");
    assert.ok(ordersCode.includes("VendorPageHeader"), "Orders Page must use VendorPageHeader");
    assert.ok(ordersCode.includes("VendorStatusBadge"), "Orders Page must use VendorStatusBadge");
    assert.ok(ordersCode.includes("VendorEmptyState"), "Orders Page must use VendorEmptyState");
    assert.ok(ordersCode.includes("VendorTablePagination"), "Orders Page must use VendorTablePagination");

    // 4. Logistics Shipments
    const shipmentsPagePath = path.resolve("src/app/vendor/shipments/page.js");
    const shipmentsCode = fs.readFileSync(shipmentsPagePath, "utf8");
    assert.ok(shipmentsCode.includes("VendorPageHeader"), "Shipments Page must use VendorPageHeader");
    assert.ok(shipmentsCode.includes("VendorStatusBadge"), "Shipments Page must use VendorStatusBadge");
    assert.ok(shipmentsCode.includes("VendorEmptyState"), "Shipments Page must use VendorEmptyState");
    assert.ok(shipmentsCode.includes("VendorTablePagination"), "Shipments Page must use VendorTablePagination");

    // 5. Customer Returns
    const returnsPagePath = path.resolve("src/app/vendor/returns/page.js");
    const returnsCode = fs.readFileSync(returnsPagePath, "utf8");
    assert.ok(returnsCode.includes("VendorPageHeader"), "Returns Page must use VendorPageHeader");
    assert.ok(returnsCode.includes("VendorStatusBadge"), "Returns Page must use VendorStatusBadge");
    assert.ok(returnsCode.includes("VendorEmptyState"), "Returns Page must use VendorEmptyState");
    assert.ok(returnsCode.includes("VendorTablePagination"), "Returns Page must use VendorTablePagination");

    // 6. Inventory & Stock Control
    const inventoryPagePath = path.resolve("src/app/vendor/inventory/page.js");
    const inventoryCode = fs.readFileSync(inventoryPagePath, "utf8");
    assert.ok(inventoryCode.includes("VendorPageHeader"), "Inventory Page must use VendorPageHeader");
    assert.ok(inventoryCode.includes("VendorKpiCard"), "Inventory Page must use VendorKpiCard");
    assert.ok(inventoryCode.includes("VendorStatusBadge"), "Inventory Page must use VendorStatusBadge");
    assert.ok(inventoryCode.includes("VendorEmptyState"), "Inventory Page must use VendorEmptyState");
    assert.ok(inventoryCode.includes("VendorTablePagination"), "Inventory Page must use VendorTablePagination");
  });
});

