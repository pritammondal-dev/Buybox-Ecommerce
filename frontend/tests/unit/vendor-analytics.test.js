import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "../../");

import {
  CANONICAL_SORT_FIELDS,
  CANONICAL_SORT_ORDERS,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  normalizeSortParams,
} from "../../src/utils/vendor-analytics-sort.js";

describe("Vendor Analytics — API Sort Validation & Contract Compliance", () => {
  it("verifies vendorService includes all modern analytics endpoints", () => {
    const servicePath = path.join(frontendRoot, "src/services/vendor.service.js");
    const content = fs.readFileSync(servicePath, "utf8");

    assert.ok(content.includes("getAnalyticsOverview"), "vendorService must declare getAnalyticsOverview");
    assert.ok(content.includes("getAnalyticsSalesTrend"), "vendorService must declare getAnalyticsSalesTrend");
    assert.ok(content.includes("getAnalyticsTopProducts"), "vendorService must declare getAnalyticsTopProducts");
    assert.ok(content.includes("getProductPerformance"), "vendorService must declare getProductPerformance");
    assert.ok(content.includes("exportAnalytics"), "vendorService must declare exportAnalytics");
    assert.ok(content.includes("responseType: \"blob\""), "exportAnalytics must request blob response type");
  });

  it("verifies VendorSidebar includes Analytics navigation item with BarChart3", () => {
    const sidebarPath = path.join(frontendRoot, "src/components/vendor/VendorSidebar.jsx");
    const content = fs.readFileSync(sidebarPath, "utf8");

    assert.ok(content.includes("BarChart3"), "VendorSidebar must import BarChart3");
    assert.ok(content.includes("/vendor/analytics"), "VendorSidebar must route to /vendor/analytics");
    assert.ok(content.includes('name: "Analytics"'), "VendorSidebar must display Analytics label");
  });

  it("verifies dedicated vendor analytics page conforms to the Global Design Standard", () => {
    const pagePath = path.join(frontendRoot, "src/app/vendor/analytics/page.js");
    assert.ok(fs.existsSync(pagePath), "Vendor analytics page must exist at /vendor/analytics/page.js");

    const content = fs.readFileSync(pagePath, "utf8");
    assert.ok(content.includes("VendorPageHeader"), "Page must use VendorPageHeader");
    assert.ok(content.includes("VendorBreadcrumbs"), "Page must use VendorBreadcrumbs");
    assert.ok(content.includes("VendorKpiCard"), "Page must use VendorKpiCard");
    assert.ok(content.includes("VendorStatusBadge"), "Page must use VendorStatusBadge");
    assert.ok(content.includes("VendorEmptyState"), "Page must use VendorEmptyState");
    assert.ok(content.includes("VendorTablePagination"), "Page must use VendorTablePagination");

    // Live DB telemetry & authoritative wallet
    assert.ok(content.includes("Authoritative Wallet & Payout Ledger"), "Page must feature authoritative wallet banner");
    assert.ok(content.includes("Available for Payout"), "Page must display available for payout balance");

    // Amazon Seller Central pattern: period comparison, SVG velocity trajectory, product performance
    assert.ok(content.includes("Compare with Previous"), "Page must support period comparison toggle");
    assert.ok(content.includes("Product Performance & Inventory Health"), "Page must have product performance section");
    assert.ok(content.includes("Daily Revenue & Velocity Trajectory"), "Page must render velocity trajectory");
  });

  it("exports canonical sort contract matching backend Zod schema exactly", () => {
    assert.deepEqual(
      [...CANONICAL_SORT_FIELDS],
      ["unitsSold", "grossSales", "netSales", "productName"],
      "Canonical sort fields must exactly match backend Zod enum"
    );
    assert.deepEqual(
      [...CANONICAL_SORT_ORDERS],
      ["asc", "desc"],
      "Canonical sort orders must be asc and desc"
    );
    assert.equal(DEFAULT_SORT_BY, "unitsSold");
    assert.equal(DEFAULT_SORT_ORDER, "desc");
  });

  it("initializes state to canonical unitsSold and desc on page load", () => {
    const pagePath = path.join(frontendRoot, "src/app/vendor/analytics/page.js");
    const content = fs.readFileSync(pagePath, "utf8");

    assert.ok(
      content.includes('const [sortBy, setSortBy] = useState("unitsSold");'),
      "sortBy state must initialize to canonical unitsSold"
    );
    assert.ok(
      content.includes('const [sortOrder, setSortOrder] = useState("desc");'),
      "sortOrder state must initialize to canonical desc"
    );
  });

  it("ensures dropdown options only contain canonical enum combinations", () => {
    const pagePath = path.join(frontendRoot, "src/app/vendor/analytics/page.js");
    const content = fs.readFileSync(pagePath, "utf8");

    // Must have canonical options
    assert.ok(content.includes('value="unitsSold:desc"'), "Must contain unitsSold:desc option");
    assert.ok(content.includes('value="unitsSold:asc"'), "Must contain unitsSold:asc option");
    assert.ok(content.includes('value="grossSales:desc"'), "Must contain grossSales:desc option");
    assert.ok(content.includes('value="grossSales:asc"'), "Must contain grossSales:asc option");
    assert.ok(content.includes('value="netSales:desc"'), "Must contain netSales:desc option");
    assert.ok(content.includes('value="netSales:asc"'), "Must contain netSales:asc option");
    assert.ok(content.includes('value="productName:asc"'), "Must contain productName:asc option");
    assert.ok(content.includes('value="productName:desc"'), "Must contain productName:desc option");

    // Must NOT contain obsolete or invalid values
    assert.ok(!content.includes('value="units:desc"'), "Must NOT contain obsolete units:desc");
    assert.ok(!content.includes('value="orders:desc"'), "Must NOT contain obsolete orders:desc");
  });

  it("normalizes canonical sort fields and directions without alteration", () => {
    assert.deepEqual(normalizeSortParams("unitsSold", "desc"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("unitsSold", "asc"), { sortBy: "unitsSold", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("grossSales", "desc"), { sortBy: "grossSales", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("grossSales", "asc"), { sortBy: "grossSales", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("netSales", "desc"), { sortBy: "netSales", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("netSales", "asc"), { sortBy: "netSales", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("productName", "asc"), { sortBy: "productName", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("productName", "desc"), { sortBy: "productName", sortOrder: "desc" });
  });

  it("normalizes combined field:direction strings properly", () => {
    assert.deepEqual(normalizeSortParams("unitsSold:desc"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("grossSales:asc"), { sortBy: "grossSales", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("netSales:desc"), { sortBy: "netSales", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("productName:asc"), { sortBy: "productName", sortOrder: "asc" });
  });

  it("safely normalizes legacy and obsolete values to valid defaults", () => {
    // Obsolete 'units' -> 'unitsSold'
    assert.deepEqual(normalizeSortParams("units", "desc"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("units:desc"), { sortBy: "unitsSold", sortOrder: "desc" });

    // Obsolete 'orders' -> 'unitsSold'
    assert.deepEqual(normalizeSortParams("orders", "desc"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("orders:desc"), { sortBy: "unitsSold", sortOrder: "desc" });

    // Legacy 'revenue' / 'gross' -> 'grossSales'
    assert.deepEqual(normalizeSortParams("revenue", "desc"), { sortBy: "grossSales", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("gross", "asc"), { sortBy: "grossSales", sortOrder: "asc" });

    // Legacy 'net' -> 'netSales'
    assert.deepEqual(normalizeSortParams("net", "desc"), { sortBy: "netSales", sortOrder: "desc" });

    // Legacy 'name' / 'title' -> 'productName'
    assert.deepEqual(normalizeSortParams("name", "asc"), { sortBy: "productName", sortOrder: "asc" });
    assert.deepEqual(normalizeSortParams("title", "desc"), { sortBy: "productName", sortOrder: "desc" });

    // Completely invalid/arbitrary inputs fall back to canonical defaults
    assert.deepEqual(normalizeSortParams("malicious_field"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams(null, "invalid_direction"), { sortBy: "unitsSold", sortOrder: "desc" });
    assert.deepEqual(normalizeSortParams("", ""), { sortBy: "unitsSold", sortOrder: "desc" });
  });

  it("verifies interactive column headers support sorting on all 4 canonical fields", () => {
    const pagePath = path.join(frontendRoot, "src/app/vendor/analytics/page.js");
    const content = fs.readFileSync(pagePath, "utf8");

    assert.ok(content.includes('handleColumnSort("productName")'), "Must support clicking Product & SKU to sort");
    assert.ok(content.includes('handleColumnSort("unitsSold")'), "Must support clicking Units Sold to sort");
    assert.ok(content.includes('handleColumnSort("grossSales")'), "Must support clicking Gross Sales to sort");
    assert.ok(content.includes('handleColumnSort("netSales")'), "Must support clicking Net Sales to sort");
  });

  it("verifies request parameter construction in fetchProductPerformance separates field and direction", () => {
    const pagePath = path.join(frontendRoot, "src/app/vendor/analytics/page.js");
    const content = fs.readFileSync(pagePath, "utf8");

    assert.ok(
      content.includes("sortBy: cleanSortBy"),
      "Must assign cleanSortBy without appended direction"
    );
    assert.ok(
      content.includes("sortOrder: cleanSortOrder"),
      "Must assign cleanSortOrder separately"
    );
    assert.ok(
      content.includes("page: pagination.page"),
      "Must preserve pagination.page"
    );
    assert.ok(
      content.includes("limit: pagination.limit"),
      "Must preserve pagination.limit"
    );
  });
});
