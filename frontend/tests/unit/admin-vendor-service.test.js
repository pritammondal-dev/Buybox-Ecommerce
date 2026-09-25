import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminVendorService } from "../../src/services/admin/vendor.service.js";
import { vendorService } from "../../src/services/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";
import { getAdminVendorUrl } from "../../src/utils/secure-id.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../../src");

describe("Admin Vendor Onboarding Service Contract & Route Tests", () => {
  test("getAdminVendorUrl formats correct path", () => {
    assert.equal(getAdminVendorUrl("ven_abcdef1234567890"), "/admin/vendors/ven_abcdef1234567890");
  });

  test("vendorService.resubmitApplication issues POST /vendors/me/resubmit", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;

    apiClient.post = async (url) => {
      capturedUrl = url;
      return { data: { success: true, message: "Application resubmitted" } };
    };

    try {
      const res = await vendorService.resubmitApplication();
      assert.equal(capturedUrl, "/vendors/me/resubmit");
      assert.equal(res.data.success, true);
    } finally {
      apiClient.post = originalPost;
    }
  });

  test("adminVendorService.listVendors issues GET /admin/vendors with params", async () => {
    const originalGet = adminApiClient.get;
    let capturedUrl = null;
    let capturedConfig = null;

    adminApiClient.get = async (url, config) => {
      capturedUrl = url;
      capturedConfig = config;
      return {
        data: {
          success: true,
          data: {
            vendors: [{ secureId: "ven_1" }],
            pagination: { page: 1, limit: 10, total: 1 },
          },
        },
      };
    };

    try {
      const res = await adminVendorService.listVendors({ page: 1, limit: 10, status: "pending" });
      assert.equal(capturedUrl, "/admin/vendors");
      assert.deepEqual(capturedConfig, { params: { page: 1, limit: 10, status: "pending" } });
      assert.equal(res.vendors.length, 1);
    } finally {
      adminApiClient.get = originalGet;
    }
  });

  test("adminVendorService.getVendorById issues GET /admin/vendors/:id", async () => {
    const originalGet = adminApiClient.get;
    let capturedUrl = null;

    adminApiClient.get = async (url) => {
      capturedUrl = url;
      return {
        data: {
          success: true,
          data: { secureId: "ven_1", storeName: "Test Store" },
        },
      };
    };

    try {
      const res = await adminVendorService.getVendorById("ven_1");
      assert.equal(capturedUrl, "/admin/vendors/ven_1");
      assert.equal(res.storeName, "Test Store");
    } finally {
      adminApiClient.get = originalGet;
    }
  });

  test("adminVendorService approval, rejection, and change request endpoints", async () => {
    const originalPost = adminApiClient.post;
    const calls = [];

    adminApiClient.post = async (url, data) => {
      calls.push({ url, data });
      return { data: { success: true, message: "OK" } };
    };

    try {
      // Approve
      await adminVendorService.approveVendor("ven_1");
      assert.equal(calls[0].url, "/admin/vendors/ven_1/approve");
      assert.equal(calls[0].data, undefined);

      // Reject
      await adminVendorService.rejectVendor("ven_1", "Incomplete documentation provided");
      assert.equal(calls[1].url, "/admin/vendors/ven_1/reject");
      assert.deepEqual(calls[1].data, { reason: "Incomplete documentation provided" });

      // Request Changes
      await adminVendorService.requestChanges("ven_1", "Please re-upload GSTIN certificate");
      assert.equal(calls[2].url, "/admin/vendors/ven_1/request-changes");
      assert.deepEqual(calls[2].data, { reason: "Please re-upload GSTIN certificate" });
    } finally {
      adminApiClient.post = originalPost;
    }
  });

  test("Admin and Vendor page route files exist", () => {
    const adminVendorsPage = path.join(srcDir, "app/admin/vendors/page.js");
    const adminVendorDetailPage = path.join(srcDir, "app/admin/vendors/[id]/page.js");
    const vendorDashboardPage = path.join(srcDir, "app/vendor/dashboard/page.js");
    const vendorStorePage = path.join(srcDir, "app/vendor/store/page.js");

    assert.ok(fs.existsSync(adminVendorsPage), "admin/vendors/page.js must exist");
    assert.ok(fs.existsSync(adminVendorDetailPage), "admin/vendors/[id]/page.js must exist");
    assert.ok(fs.existsSync(vendorDashboardPage), "vendor/dashboard/page.js must exist");
    assert.ok(fs.existsSync(vendorStorePage), "vendor/store/page.js must exist");
  });
});
