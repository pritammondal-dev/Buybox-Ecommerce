import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apiClient } from "../../src/lib/api/axios.js";
import { fetchStorefrontSettings, invalidateStorefrontSettings } from "../../src/hooks/useStorefrontSettings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase E1C — Frontend Logo Size Management, Promotions & Superadmin Notice", () => {
  describe("1. Logo Size Management & Hook Contract", () => {
    test("fetchStorefrontSettings includes logoDimensions with fallback values", async () => {
      const originalGet = apiClient.get;
      apiClient.get = async (url) => {
        if (url === "/storefront/settings") {
          return {
            data: {
              success: true,
              data: {
                storeName: "Buybox Test",
                logoUrl: "/uploads/logo.png",
                logoDimensions: {
                  desktopWidth: 180,
                  desktopMaxHeight: 52,
                  mobileWidth: 130,
                  mobileMaxHeight: 38,
                  footerMaxHeight: 42,
                },
              },
            },
          };
        }
        return { data: {} };
      };

      try {
        await invalidateStorefrontSettings();
        const settings = await fetchStorefrontSettings(true);
        assert.ok(settings.logoDimensions);
        assert.equal(settings.logoDimensions.desktopWidth, 180);
        assert.equal(settings.logoDimensions.desktopMaxHeight, 52);
        assert.equal(settings.logoDimensions.mobileWidth, 130);
        assert.equal(settings.logoDimensions.mobileMaxHeight, 38);
        assert.equal(settings.logoDimensions.footerMaxHeight, 42);
      } finally {
        apiClient.get = originalGet;
        await invalidateStorefrontSettings();
      }
    });

    test("LogoSizeManagementModal exists and exports component with expected controls", () => {
      const modalPath = path.join(
        rootDir,
        "src/components/admin/settings/LogoSizeManagementModal.jsx"
      );
      assert.ok(fs.existsSync(modalPath), "LogoSizeManagementModal.jsx must exist");
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(content.includes("LogoSizeManagementModal"), "Must export LogoSizeManagementModal");
      assert.ok(content.includes("desktopWidth"), "Must include desktopWidth control");
      assert.ok(content.includes("desktopMaxHeight"), "Must include desktopMaxHeight control");
      assert.ok(content.includes("mobileWidth"), "Must include mobileWidth control");
      assert.ok(content.includes("mobileMaxHeight"), "Must include mobileMaxHeight control");
      assert.ok(content.includes("footerMaxHeight"), "Must include footerMaxHeight control");
      assert.ok(content.includes("object-contain"), "Must preserve aspect ratio with object-contain");
      assert.ok(content.includes("Live Responsive Preview"), "Must include responsive preview tabs");
    });

    test("StorefrontHeader applies logoDimensions to desktop and mobile logo rendering", () => {
      const headerPath = path.join(
        rootDir,
        "src/components/storefront/StorefrontHeader.jsx"
      );
      const content = fs.readFileSync(headerPath, "utf-8");

      assert.ok(content.includes("logoDimensions"), "Header must consume logoDimensions");
      assert.ok(content.includes("maxWidth: `${logoDimensions?.desktopWidth"), "Desktop logo must bind maxWidth");
      assert.ok(content.includes("maxHeight: `${logoDimensions?.desktopMaxHeight"), "Desktop logo must bind maxHeight");
      assert.ok(content.includes("maxWidth: `${logoDimensions?.mobileWidth"), "Mobile logo must bind maxWidth");
      assert.ok(content.includes("maxHeight: `${logoDimensions?.mobileMaxHeight"), "Mobile logo must bind maxHeight");
    });

    test("StorefrontFooter applies logoDimensions to footer logo rendering", () => {
      const footerPath = path.join(
        rootDir,
        "src/components/storefront/StorefrontFooter.jsx"
      );
      const content = fs.readFileSync(footerPath, "utf-8");

      assert.ok(content.includes("logoDimensions"), "Footer must consume logoDimensions");
      assert.ok(content.includes("maxHeight: `${logoDimensions?.footerMaxHeight"), "Footer logo must bind footerMaxHeight");
    });
  });

  describe("2. Discounts and Promotions Page Distinction", () => {
    test("Discounts page and Promotions page are completely distinct components", () => {
      const discountsPath = path.join(
        rootDir,
        "src/app/administrator/marketing/discounts/page.js"
      );
      const promotionsPath = path.join(
        rootDir,
        "src/app/administrator/marketing/promotions/page.js"
      );

      assert.ok(fs.existsSync(discountsPath), "Discounts page must exist");
      assert.ok(fs.existsSync(promotionsPath), "Promotions page must exist");

      const discountsContent = fs.readFileSync(discountsPath, "utf-8");
      const promotionsContent = fs.readFileSync(promotionsPath, "utf-8");

      // Verify that Promotions page does NOT re-export or render MarketingDiscountsPage
      assert.ok(
        !promotionsContent.includes("MarketingDiscountsPage"),
        "Promotions page must NOT render MarketingDiscountsPage"
      );
      assert.ok(
        !promotionsContent.includes('from "../discounts/page"'),
        "Promotions page must NOT import discounts page"
      );

      // Verify distinct page names & identifiers
      assert.ok(
        discountsContent.includes("MarketingDiscountsPage"),
        "Discounts page must define MarketingDiscountsPage"
      );
      assert.ok(
        promotionsContent.includes("MarketingPromotionsPage"),
        "Promotions page must define MarketingPromotionsPage"
      );

      // Discounts focuses on discount rules, price floors, and subsidies
      assert.ok(
        discountsContent.includes("discountType") && discountsContent.includes("fundingSource"),
        "Discounts page must manage pricing rules and funding sources"
      );

      // Promotions focuses on campaigns, events, scheduling, and performance
      assert.ok(
        promotionsContent.includes("campaignService") && promotionsContent.includes("startsAt"),
        "Promotions page must manage promotional campaigns and scheduling"
      );
    });
  });

  describe("3. Superadmin Policy Notice and Feature Flag Navigation Gating", () => {
    test("Store Settings page includes real verified Superadmin policy notice", () => {
      const storeSettingsPath = path.join(
        rootDir,
        "src/app/administrator/settings/store/page.js"
      );
      const content = fs.readFileSync(storeSettingsPath, "utf-8");

      assert.ok(
        content.includes("Superadmin has full access to platform settings and feature flag management"),
        "Notice must contain authoritative verified policy text"
      );
      assert.ok(
        content.includes("Logo Size Management"),
        "Store Settings must contain Logo Size Management button"
      );
    });

    test("MainShoppingNav gates /flash-sale, /coupons, and /compare using isFeatureEnabled", () => {
      const navPath = path.join(
        rootDir,
        "src/components/storefront/navigation/MainShoppingNav.jsx"
      );
      const content = fs.readFileSync(navPath, "utf-8");

      assert.ok(content.includes("useStorefrontSettings"), "Nav must import useStorefrontSettings");
      assert.ok(content.includes("isFeatureEnabled"), "Nav must call isFeatureEnabled");
      assert.ok(content.includes('!isFeatureEnabled("flashSale")'), "Nav must gate flashSale");
      assert.ok(content.includes('!isFeatureEnabled("coupons")'), "Nav must gate coupons");
      assert.ok(content.includes('!isFeatureEnabled("compare")'), "Nav must gate compare");
    });

    test("DealsPromoRow gates flash sale card using isFeatureEnabled('flashSale')", () => {
      const dealsPath = path.join(
        rootDir,
        "src/components/storefront/home/DealsPromoRow.jsx"
      );
      const content = fs.readFileSync(dealsPath, "utf-8");

      assert.ok(content.includes("useStorefrontSettings"), "DealsPromoRow must import useStorefrontSettings");
      assert.ok(content.includes('isFeatureEnabled("flashSale")'), "DealsPromoRow must check flashSale flag");
      assert.ok(content.includes("flashSaleEnabled && ("), "DealsPromoRow must conditionally render flash sale card");
    });
  });
});
