import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("ADMINISTRATOR DASHBOARD — Frontend Page & Data Contract Tests", () => {
  const pagePath = path.resolve(__dirname, "../../src/app/administrator/dashboard/page.js");
  const servicePath = path.resolve(__dirname, "../../src/services/admin/admin.service.js");

  test("1. Administrator dashboard page exists and is populated", () => {
    assert.ok(fs.existsSync(pagePath), "Administrator dashboard page.js must exist");
    const content = fs.readFileSync(pagePath, "utf8");
    assert.ok(content.length > 500, "page.js must have substantive implementation");
    assert.ok(content.includes('"use client"'), "page.js must be a Client Component");
  });

  test("2. Connects to authoritative dashboardService with dynamic range parameters", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(
      pageContent.includes("dashboardService.getStats({ range })") ||
      pageContent.includes("dashboardService.getStats({"),
      "Dashboard must pass range parameter to dashboardService.getStats"
    );

    const serviceContent = fs.readFileSync(servicePath, "utf8");
    assert.ok(
      serviceContent.includes("getStats: async (params = {})"),
      "dashboardService.getStats must accept optional query params"
    );
    assert.ok(
      serviceContent.includes('apiClient.get("/admin/dashboard/stats", { params })'),
      "dashboardService.getStats must forward params to /admin/dashboard/stats"
    );
  });

  test("3. Supports interactive date range selection (Today, 7d, 30d, 90d)", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(pageContent.includes('"today"'), "Must define 'today' range");
    assert.ok(pageContent.includes('"7d"'), "Must define '7d' range");
    assert.ok(pageContent.includes('"30d"'), "Must define '30d' range");
    assert.ok(pageContent.includes('"90d"'), "Must define '90d' range");
    assert.ok(pageContent.includes("DATE_RANGE_OPTIONS"), "Must export/define range options");
  });

  test("4. Sales and orders trend visualizer with interactive metric toggles", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(pageContent.includes("chartMetric"), "Must track chartMetric state");
    assert.ok(pageContent.includes('"sales"'), "Must support revenue/sales metric");
    assert.ok(pageContent.includes('"orders"'), "Must support orders count metric");
    assert.ok(pageContent.includes("trends.map"), "Must map over real trend data points");
    assert.ok(pageContent.includes("trendAnalysis"), "Must compute dynamic trend analysis");
  });

  test("5. Recent orders table connects to real order routes and formats INR currency", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(
      pageContent.includes("/administrator/operations/orders/${ord._id}"),
      "Order items must link directly to order details"
    );
    assert.ok(pageContent.includes("currency: \"INR\""), "Must format currency as INR");
    assert.ok(pageContent.includes("recentOrders.map"), "Must map over recent orders from API");
    assert.ok(pageContent.includes("No orders recorded yet"), "Must have empty state for orders");
  });

  test("6. Vendor onboarding queue and audit log trails link to canonical admin modules", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(
      pageContent.includes("/administrator/vendors/${ven._id}"),
      "Vendors must link to vendor details"
    );
    assert.ok(
      pageContent.includes("/administrator/security/audit-logs"),
      "Audit trail must link to canonical audit logs page"
    );
    assert.ok(
      pageContent.includes("/administrator/inventory/stock"),
      "Low stock quick action must link to inventory stock page"
    );
  });

  test("7. Handles loading, error banners, and manual refresh states", () => {
    const pageContent = fs.readFileSync(pagePath, "utf8");
    assert.ok(pageContent.includes("RefreshCw"), "Must display refresh icon");
    assert.ok(pageContent.includes("AlertTriangle"), "Must display error banner icon");
    assert.ok(pageContent.includes("fetchStats(true)"), "Must support background live refresh");
    assert.ok(pageContent.includes("animate-pulse"), "Must implement skeleton/pulse loading indicators");
  });
});
