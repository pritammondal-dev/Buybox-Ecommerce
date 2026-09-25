import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { vendorService } from "../../src/services/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";
import {
  getVendorOrderUrl,
  getVendorProductUrl,
  getVendorShipmentUrl,
  getVendorReturnUrl,
  getVendorWarehouseUrl,
} from "../../src/utils/secure-id.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Merchant Console Service Contract & Route File Structure", () => {
  // 1. Secure URL helpers
  test("secure ID URL helpers construct correct vendor console routes", () => {
    assert.equal(getVendorOrderUrl("ord_1234567890abcdef"), "/vendor/orders/ord_1234567890abcdef");
    assert.equal(getVendorProductUrl("prd_abcdef1234567890"), "/vendor/products/prd_abcdef1234567890");
    assert.equal(getVendorShipmentUrl("shp_9876543210fedcba"), "/vendor/shipments/shp_9876543210fedcba");
    assert.equal(getVendorReturnUrl("ret_1122334455667788"), "/vendor/returns/ret_1122334455667788");
    assert.equal(getVendorWarehouseUrl("wh_aabbccddeeff0011"), "/vendor/warehouses/wh_aabbccddeeff0011");
  });

  // 2. Dashboard Analytics API
  test("vendorService.getDashboardAnalytics issues GET /vendors/me/dashboard with range params", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;
    let capturedConfig = null;

    apiClient.get = async (url, config) => {
      capturedUrl = url;
      capturedConfig = config;
      return {
        data: {
          success: true,
          data: {
            metrics: { totalSales: "5000.00", ordersCount: 5 },
            salesTrends: [],
            recentOrders: [],
          },
        },
      };
    };

    try {
      const res = await vendorService.getDashboardAnalytics({ range: "7d" });
      assert.equal(capturedUrl, "/vendors/me/dashboard");
      assert.deepEqual(capturedConfig, { params: { range: "7d" } });
      assert.equal(res.data.data.metrics.totalSales, "5000.00");
    } finally {
      apiClient.get = originalGet;
    }
  });

  // 3. Inventory & Warehouses API
  test("vendorService inventory and warehouse endpoints issue expected paths", async () => {
    const originalGet = apiClient.get;
    const calls = [];

    apiClient.get = async (url) => {
      calls.push(url);
      return { data: { success: true, data: [] } };
    };

    try {
      await vendorService.getMyInventory();
      await vendorService.getMyWarehouses();
      await vendorService.getMyWarehouseById("wh_123");

      assert.equal(calls[0], "/inventory/vendor/my");
      assert.equal(calls[1], "/warehouses/vendor/my");
      assert.equal(calls[2], "/warehouses/vendor/my/wh_123");
    } finally {
      apiClient.get = originalGet;
    }
  });

  // 4. Orders & Shipments API
  test("vendorService order and shipment endpoints issue expected paths", async () => {
    const originalGet = apiClient.get;
    const calls = [];

    apiClient.get = async (url) => {
      calls.push(url);
      return { data: { success: true, data: {} } };
    };

    try {
      await vendorService.getMyOrders({ status: "confirmed" });
      await vendorService.getMyOrderById("ord_test");
      await vendorService.getMyShipments();
      await vendorService.getMyShipmentById("shp_test");

      assert.equal(calls[0], "/vendors/me/orders");
      assert.equal(calls[1], "/vendors/me/orders/ord_test");
      assert.equal(calls[2], "/shipments/vendor/my");
      assert.equal(calls[3], "/shipments/vendor/my/shp_test");
    } finally {
      apiClient.get = originalGet;
    }
  });

  // 5. Customer Reviews & Q&A Operations
  test("vendorService review response and question answer methods issue expected mutations", async () => {
    const originalPatch = apiClient.patch;
    const originalPost = apiClient.post;
    let patchUrl = null;
    let patchData = null;
    let postUrl = null;
    let postData = null;

    apiClient.patch = async (url, data) => {
      patchUrl = url;
      patchData = data;
      return { data: { success: true } };
    };

    apiClient.post = async (url, data) => {
      postUrl = url;
      postData = data;
      return { data: { success: true } };
    };

    try {
      await vendorService.respondToReview("rev_123", "Thank you for your feedback!");
      assert.equal(patchUrl, "/reviews/rev_123/vendor-response");
      assert.deepEqual(patchData, { response: "Thank you for your feedback!" });

      await vendorService.answerQuestion("qst_456", "This keyboard is Mac compatible.");
      assert.equal(postUrl, "/questions/qst_456/answers");
      assert.deepEqual(postData, { content: "This keyboard is Mac compatible." });
    } finally {
      apiClient.patch = originalPatch;
      apiClient.post = originalPost;
    }
  });

  // 6. Settlements & Finance API
  test("vendorService.getMySettlements issues GET /vendors/me/settlements", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { success: true, data: [] } };
    };

    try {
      await vendorService.getMySettlements();
      assert.equal(capturedUrl, "/vendors/me/settlements");
    } finally {
      apiClient.get = originalGet;
    }
  });

  // 7. Filesystem Route Verification
  test("verifies all Merchant Console route files exist and are populated", () => {
    const requiredFiles = [
      "app/vendor/layout.js",
      "app/vendor/dashboard/page.js",
      "app/vendor/products/page.js",
      "app/vendor/products/new/page.js",
      "app/vendor/products/import/page.js",
      "app/vendor/products/[id]/page.js",
      "app/vendor/inventory/page.js",
      "app/vendor/warehouses/page.js",
      "app/vendor/warehouses/[id]/page.js",
      "app/vendor/orders/page.js",
      "app/vendor/orders/[id]/page.js",
      "app/vendor/shipments/page.js",
      "app/vendor/shipments/[id]/page.js",
      "app/vendor/returns/page.js",
      "app/vendor/returns/[id]/page.js",
      "app/vendor/finance/page.js",
      "app/vendor/store/page.js",
      "app/vendor/reviews/page.js",
      "app/vendor/questions/page.js",
      "app/vendor/notifications/page.js",
      "app/vendor/support/page.js",
      "app/vendor/activity/page.js",
      "components/vendor/VendorShell.jsx",
      "components/vendor/VendorSidebar.jsx",
      "components/vendor/VendorHeader.jsx",
      "components/vendor/VendorMobileNav.jsx",
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(srcDir, file);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${file}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 50, `File must not be empty: ${file}`);
    }
  });

  // 8. ApiError Axios Response Compatibility
  test("ApiError retains response property with status and data for Axios consumer compatibility", async () => {
    const { ApiError, normalizeApiError } = await import("../../src/lib/api/api-error.js");

    const mockAxios403 = {
      isAxiosError: true,
      message: "Request failed with status code 403",
      response: {
        status: 403,
        data: {
          success: false,
          code: "VENDOR_ONBOARDING_NOT_APPROVED",
          message: "Vendor onboarding is currently 'pending'. Approved status required for marketplace operations.",
        },
      },
    };

    const apiErr = normalizeApiError(mockAxios403);
    assert.equal(apiErr.status, 403);
    assert.equal(apiErr.code, "VENDOR_ONBOARDING_NOT_APPROVED");
    assert.ok(apiErr.response, "ApiError must expose .response");
    assert.equal(apiErr.response.status, 403);
    assert.equal(apiErr.response.data?.code, "VENDOR_ONBOARDING_NOT_APPROVED");
    assert.equal(apiErr.response.data?.message, mockAxios403.response.data.message);

    // Direct ApiError instance also has response
    const directErr = new ApiError({
      message: "Permission denied",
      status: 403,
      code: "INSUFFICIENT_PERMISSIONS",
    });
    assert.ok(directErr.response);
    assert.equal(directErr.response.status, 403);
    assert.equal(directErr.response.data?.code, "INSUFFICIENT_PERMISSIONS");
  });

  // 9. Bulk Product Import & Export API
  test("vendorService bulk import and export methods issue expected paths and payloads", async () => {
    const originalGet = apiClient.get;
    const originalPost = apiClient.post;
    const calls = [];

    apiClient.get = async (url, config) => {
      calls.push({ method: "GET", url, config });
      return { data: new Uint8Array([1, 2, 3]) };
    };

    apiClient.post = async (url, data, config) => {
      calls.push({ method: "POST", url, data, config });
      return { data: { success: true, data: { totalProcessed: 1 } } };
    };

    try {
      await vendorService.downloadImportTemplate("csv");
      assert.equal(calls[0].url, "/products/vendor/import/template?format=csv");
      assert.equal(calls[0].config?.responseType, "blob");

      await vendorService.downloadImportTemplate("xlsx");
      assert.equal(calls[1].url, "/products/vendor/import/template?format=xlsx");

      const fakeFormData = { fake: "form-data" };
      await vendorService.validateBulkImport(fakeFormData);
      assert.equal(calls[2].url, "/products/vendor/import/validate");
      assert.deepEqual(calls[2].data, fakeFormData);
      assert.equal(calls[2].config?.headers?.["Content-Type"], "multipart/form-data");

      const rows = [{ sku: "SKU-1", name: "Test Item" }];
      await vendorService.commitBulkImport(rows);
      assert.equal(calls[3].url, "/products/vendor/import/commit");
      assert.deepEqual(calls[3].data, { rows });

      await vendorService.exportProducts({ status: "active", format: "csv" });
      assert.equal(calls[4].url, "/products/vendor/export");
      assert.deepEqual(calls[4].config?.params, { status: "active", format: "csv" });
      assert.equal(calls[4].config?.responseType, "blob");
    } finally {
      apiClient.get = originalGet;
      apiClient.post = originalPost;
    }
  });
});
