import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { vendorService } from "../../src/services/vendor.service.js";
import apiClient from "../../src/lib/api/axios.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Vendor Operations & Storefront More Menu Tests", () => {
  // 1. Vendor Service Contract
  test("vendorService.registerVendor issues POST /vendors/register", async () => {
    const originalPost = apiClient.post;
    let capturedUrl = null;
    let capturedData = null;

    apiClient.post = async (url, data) => {
      capturedUrl = url;
      capturedData = data;
      return { data: { success: true, data: { vendor: { onboardingStatus: "pending" } } } };
    };

    try {
      const payload = {
        firstName: "Merchant",
        lastName: "Seller",
        email: "seller@test.com",
        password: "Password123!",
        businessName: "Acme Store",
        businessSlug: "acme-store",
      };
      const res = await vendorService.registerVendor(payload);
      assert.equal(capturedUrl, "/vendors/register");
      assert.deepEqual(capturedData, payload);
      assert.equal(res.data.data.vendor.onboardingStatus, "pending");
    } finally {
      apiClient.post = originalPost;
    }
  });

  test("vendorService.getMyProfile issues GET /vendors/me", async () => {
    const originalGet = apiClient.get;
    let capturedUrl = null;

    apiClient.get = async (url) => {
      capturedUrl = url;
      return { data: { success: true, data: { vendor: { businessName: "Acme Store" } } } };
    };

    try {
      const res = await vendorService.getMyProfile();
      assert.equal(capturedUrl, "/vendors/me");
      assert.equal(res.data.data.vendor.businessName, "Acme Store");
    } finally {
      apiClient.get = originalGet;
    }
  });

  test("vendorService.updateMyProfile issues PATCH /vendors/me", async () => {
    const originalPatch = apiClient.patch;
    let capturedUrl = null;
    let capturedData = null;

    apiClient.patch = async (url, data) => {
      capturedUrl = url;
      capturedData = data;
      return { data: { success: true } };
    };

    try {
      await vendorService.updateMyProfile({ supportEmail: "support@newacme.com" });
      assert.equal(capturedUrl, "/vendors/me");
      assert.deepEqual(capturedData, { supportEmail: "support@newacme.com" });
    } finally {
      apiClient.patch = originalPatch;
    }
  });

  // 2. Second Navbar More Menu Contract
  test("MainShoppingNav contains More menu with Vendor, Support, and Help options", () => {
    const navFilePath = path.resolve(__dirname, "../../src/components/storefront/navigation/MainShoppingNav.jsx");
    const content = fs.readFileSync(navFilePath, "utf8");

    // Must have More menu trigger
    assert.ok(content.includes("More"), "MainShoppingNav must render More dropdown button");
    assert.ok(content.includes("moreOpen"), "MainShoppingNav must control More menu open state");

    // Must contain the 3 required routes
    assert.ok(
      content.includes("/vendor/login"),
      "More menu must route 'Become a Vendor / Seller' to /vendor/login"
    );
    assert.ok(
      content.includes("/contact-support"),
      "More menu must route '24 × 7 Support' to /contact-support"
    );
    assert.ok(
      content.includes("/help"),
      "More menu must route 'Help Center' to /help"
    );
  });

  // 3. Header Help Link Integrity
  test("StorefrontHeader and AnnouncementBar route Help to /help", () => {
    const headerPath = path.resolve(__dirname, "../../src/components/storefront/StorefrontHeader.jsx");
    const barPath = path.resolve(__dirname, "../../src/components/storefront/AnnouncementBar.jsx");

    const headerContent = fs.readFileSync(headerPath, "utf8");
    const barContent = fs.readFileSync(barPath, "utf8");

    // Help button in StorefrontHeader must point to /help
    assert.ok(
      headerContent.includes('href="/help"'),
      "StorefrontHeader Help button must link to /help"
    );
    assert.ok(
      !headerContent.includes('href="/shop">\n                  Help'),
      "StorefrontHeader Help button must not link to /shop"
    );

    // Help link in AnnouncementBar must point to /help
    assert.ok(
      barContent.includes('href="/help"'),
      "AnnouncementBar Help link must point to /help"
    );
  });

  // 4. Vendor Routing & Page Implementation
  test("Vendor pages exist with valid routing structure", () => {
    const loginPagePath = path.resolve(__dirname, "../../src/app/vendor/login/page.js");
    const registerPagePath = path.resolve(__dirname, "../../src/app/vendor/register/page.js");
    const dashboardPagePath = path.resolve(__dirname, "../../src/app/vendor/dashboard/page.js");

    assert.ok(fs.existsSync(loginPagePath), "/vendor/login page must exist");
    assert.ok(fs.existsSync(registerPagePath), "/vendor/register page must exist");
    assert.ok(fs.existsSync(dashboardPagePath), "/vendor/dashboard page must exist");

    const registerContent = fs.readFileSync(registerPagePath, "utf8");
    assert.ok(
      registerContent.includes("vendorService.registerVendor"),
      "Vendor register page must invoke vendorService.registerVendor"
    );
    assert.ok(
      registerContent.includes("Pending Admin Approval"),
      "Vendor register page must display explicit Pending status on submission"
    );

    const dashboardContent = fs.readFileSync(dashboardPagePath, "utf8");
    assert.ok(
      dashboardContent.includes("onboardingStatus"),
      "Vendor dashboard must evaluate onboardingStatus"
    );
    assert.ok(
      dashboardContent.includes("user.role === \"customer\""),
      "Vendor dashboard must guard against customer roles"
    );
  });
});
