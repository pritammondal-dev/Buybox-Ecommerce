import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminMediaService } from "../../src/services/admin/admin.service.js";
import adminApiClient from "../../src/lib/api/admin-axios.js";
import { apiClient } from "../../src/lib/api/axios.js";
import { fetchStorefrontSettings, invalidateStorefrontSettings } from "../../src/hooks/useStorefrontSettings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase E1B — Frontend Store Branding, Promotions & Route Consistency", () => {
  describe("1. Admin Media Upload Service Contract", () => {
    test("uploadMedia sends multipart request to /storefront/media/upload", async () => {
      const originalPost = adminApiClient.post;
      let capturedUrl = null;
      let capturedData = null;
      let capturedConfig = null;

      adminApiClient.post = async (url, data, config) => {
        capturedUrl = url;
        capturedData = data;
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: { url: "/uploads/media_mock_logo.png" },
          },
        };
      };

      try {
        const mockBlob = new Blob(["mock image data"], { type: "image/png" });
        const res = await adminMediaService.uploadMedia(mockBlob);

        assert.equal(capturedUrl, "/storefront/media/upload");
        assert.ok(capturedData instanceof FormData);
        assert.equal(capturedConfig?.headers?.["Content-Type"], "multipart/form-data");
        assert.equal(res.data.url, "/uploads/media_mock_logo.png");
      } finally {
        adminApiClient.post = originalPost;
      }
    });
  });

  describe("2. Authoritative Settings Hook & Cache Invalidation", () => {
    test("fetchStorefrontSettings fetches /storefront/settings and caches result", async () => {
      const originalGet = apiClient.get;
      let fetchCount = 0;

      apiClient.get = async (url) => {
        if (url === "/storefront/settings") {
          fetchCount++;
          return {
            data: {
              success: true,
              data: {
                storeName: "Buybox Marketplace",
                logoUrl: "/uploads/logo.png",
                faviconUrl: "/uploads/favicon.ico",
                featureFlags: { coupons: true, returns: true, wishlist: true },
              },
            },
          };
        }
        return { data: {} };
      };

      try {
        await invalidateStorefrontSettings();
        const settings1 = await fetchStorefrontSettings();
        assert.equal(settings1.storeName, "Buybox Marketplace");
        assert.equal(settings1.logoUrl, "/uploads/logo.png");

        // Second call should reuse cached result without extra network call
        const settings2 = await fetchStorefrontSettings();
        assert.equal(settings2.storeName, "Buybox Marketplace");
        assert.equal(fetchCount, 1);

        // After invalidation, next fetch issues fresh request
        await invalidateStorefrontSettings();
        assert.equal(fetchCount, 2);
      } finally {
        apiClient.get = originalGet;
      }
    });
  });

  describe("3. Promotions Route Repair & Admin Sidebar Consistency", () => {
    test("/administrator/marketing/promotions imports and renders MarketingPromotionsPage", () => {
      const pagePath = path.resolve(rootDir, "src/app/administrator/marketing/promotions/page.js");
      assert.ok(fs.existsSync(pagePath), "Promotions page file must exist");

      const content = fs.readFileSync(pagePath, "utf8");
      assert.ok(
        content.includes("MarketingPromotionsPage"),
        "Must render the dedicated MarketingPromotionsPage"
      );
      assert.ok(
        !content.includes("/administrator/marketing/campaigns"),
        "Must NOT redirect to Campaigns"
      );
    });

    test("AdminSidebar contains consistent navigation for Promotions and Discounts", () => {
      const sidebarPath = path.resolve(rootDir, "src/components/admin/AdminSidebar.jsx");
      const content = fs.readFileSync(sidebarPath, "utf8");

      assert.ok(content.includes("/administrator/marketing/promotions"), "Promotions route must be in sidebar");
      assert.ok(content.includes("/administrator/marketing/discounts"), "Discounts route must be in sidebar");
    });

    test("Legacy admin routes redirect safely to administrator destinations without blank stubs", () => {
      const legacyPromotionsPath = path.resolve(rootDir, "src/app/admin/marketing/promotions/page.js");
      const legacyStoreSettingsPath = path.resolve(rootDir, "src/app/admin/settings/store/page.js");
      const legacyDiscountsPath = path.resolve(rootDir, "src/app/admin/marketing/discounts/page.js");

      assert.ok(fs.existsSync(legacyPromotionsPath));
      assert.ok(fs.existsSync(legacyStoreSettingsPath));
      assert.ok(fs.existsSync(legacyDiscountsPath));

      const promoContent = fs.readFileSync(legacyPromotionsPath, "utf8");
      assert.ok(promoContent.includes('redirect("/administrator/marketing/promotions")'));

      const storeContent = fs.readFileSync(legacyStoreSettingsPath, "utf8");
      assert.ok(storeContent.includes('redirect("/administrator/settings/store")'));

      const discContent = fs.readFileSync(legacyDiscountsPath, "utf8");
      assert.ok(discContent.includes('redirect("/administrator/marketing/discounts")'));
    });
  });

  describe("4. Dynamic Storefront Branding & Favicon Metadata", () => {
    test("StorefrontHeader consumes useStorefrontSettings and handles logo with fallback", () => {
      const headerPath = path.resolve(rootDir, "src/components/storefront/StorefrontHeader.jsx");
      const content = fs.readFileSync(headerPath, "utf8");

      assert.ok(content.includes("useStorefrontSettings"), "StorefrontHeader must consume useStorefrontSettings");
      assert.ok(content.includes("logoUrl"), "StorefrontHeader must reference logoUrl");
      assert.ok(content.includes("ShoppingBag"), "StorefrontHeader must retain ShoppingBag fallback");
    });

    test("StorefrontFooter consumes useStorefrontSettings and handles logo with fallback", () => {
      const footerPath = path.resolve(rootDir, "src/components/storefront/StorefrontFooter.jsx");
      const content = fs.readFileSync(footerPath, "utf8");

      assert.ok(content.includes("useStorefrontSettings"), "StorefrontFooter must consume useStorefrontSettings");
      assert.ok(content.includes("logoUrl"), "StorefrontFooter must reference logoUrl");
      assert.ok(content.includes("ShoppingBag"), "StorefrontFooter must retain ShoppingBag fallback");
    });

    test("Root layout exports generateMetadata with dynamic icons binding", () => {
      const layoutPath = path.resolve(rootDir, "src/app/layout.js");
      const content = fs.readFileSync(layoutPath, "utf8");

      assert.ok(content.includes("generateMetadata"), "Root layout must export generateMetadata");
      assert.ok(content.includes("faviconUrl"), "Metadata must bind faviconUrl");
      assert.ok(content.includes("/favicon.ico"), "Metadata must provide /favicon.ico fallback");
    });

    test("Default favicon.ico exists in public directory as a valid ICO file", () => {
      const faviconPath = path.resolve(rootDir, "public/favicon.ico");
      assert.ok(fs.existsSync(faviconPath), "favicon.ico must exist in public/");

      const buf = fs.readFileSync(faviconPath);
      assert.ok(buf.length >= 4, "Favicon file must not be empty");
      // ICO magic bytes: 00 00 01 00
      assert.equal(buf[0], 0x00);
      assert.equal(buf[1], 0x00);
      assert.equal(buf[2], 0x01);
      assert.equal(buf[3], 0x00);
    });
  });
});
