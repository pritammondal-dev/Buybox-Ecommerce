import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase SM1 — Storefront Merchandising Control Center Frontend Suite", () => {
  const managerPath = path.join(
    rootDir,
    "src/components/admin/cms/StorefrontMerchandisingManager.jsx"
  );
  const merchandisingPagePath = path.join(
    rootDir,
    "src/app/administrator/cms/merchandising/page.js"
  );
  const homepageRedirectPath = path.join(
    rootDir,
    "src/app/administrator/cms/homepage/page.js"
  );
  const sidebarPath = path.join(
    rootDir,
    "src/components/admin/AdminSidebar.jsx"
  );
  const sectionContainerPath = path.join(
    rootDir,
    "src/components/storefront/home/SectionContainer.jsx"
  );
  const customSectionPath = path.join(
    rootDir,
    "src/components/storefront/home/CustomStorefrontSection.jsx"
  );
  const homeClientWrapperPath = path.join(
    rootDir,
    "src/components/storefront/home/HomeClientWrapper.jsx"
  );
  const storefrontServicePath = path.join(
    rootDir,
    "src/services/storefront.service.js"
  );

  test("1. Files existence and structural validation", () => {
    assert.ok(fs.existsSync(managerPath), "StorefrontMerchandisingManager.jsx must exist");
    assert.ok(fs.existsSync(merchandisingPagePath), "merchandising/page.js must exist");
    assert.ok(fs.existsSync(customSectionPath), "CustomStorefrontSection.jsx must exist");
  });

  test("2. Superadmin Sidebar and Routing Integration", () => {
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      sidebarContent.includes("/administrator/cms/merchandising"),
      "AdminSidebar must link to /administrator/cms/merchandising"
    );
    assert.ok(
      sidebarContent.includes("Storefront Merchandising"),
      "AdminSidebar must display 'Storefront Merchandising' label"
    );

    const redirectContent = fs.readFileSync(homepageRedirectPath, "utf-8");
    assert.ok(
      redirectContent.includes("/administrator/cms/merchandising"),
      "Legacy cms/homepage must redirect to /administrator/cms/merchandising"
    );
  });

  test("3. SectionContainer Scoped Theme Support", () => {
    const containerContent = fs.readFileSync(sectionContainerPath, "utf-8");
    assert.ok(
      containerContent.includes("theme") && containerContent.includes("theme?.backgroundColor"),
      "SectionContainer must accept theme prop and evaluate theme.backgroundColor"
    );
    assert.ok(
      containerContent.includes("theme?.headingColor") && containerContent.includes("theme?.badgeColor"),
      "SectionContainer must support scoped heading and badge color overrides"
    );
    assert.ok(
      containerContent.includes("containerStyle") && containerContent.includes("style={containerStyle}"),
      "SectionContainer must apply scoped inline style without polluting global CSS variables"
    );
  });

  test("4. Storefront Service Merchandising Endpoints", () => {
    const serviceContent = fs.readFileSync(storefrontServicePath, "utf-8");
    assert.ok(
      serviceContent.includes("getAllSections") &&
        serviceContent.includes("createSection") &&
        serviceContent.includes("updateSection") &&
        serviceContent.includes("deleteSection") &&
        serviceContent.includes("reorderSections"),
      "storefrontService must declare authoritative CRUD and reorder methods for merchandising"
    );
  });

  test("5. Custom Storefront Section Renderer", () => {
    const customContent = fs.readFileSync(customSectionPath, "utf-8");
    assert.ok(
      customContent.includes("type === \"carousel\"") &&
        customContent.includes("type === \"grid\"") &&
        customContent.includes("type === \"category_showcase\"") &&
        customContent.includes("type === \"promotional_banner\""),
      "CustomStorefrontSection must support carousel, grid, category_showcase, and promotional_banner types"
    );
    assert.ok(
      customContent.includes("ProductCarousel") && customContent.includes("ProductCard"),
      "CustomStorefrontSection must reuse standard ProductCarousel and ProductCard components"
    );
  });

  test("6. HomeClientWrapper Dynamic Storefront Merchandising Journey", () => {
    const wrapperContent = fs.readFileSync(homeClientWrapperPath, "utf-8");
    assert.ok(
      wrapperContent.includes("initialSections = []"),
      "HomeClientWrapper must accept initialSections prop"
    );
    assert.ok(
      wrapperContent.includes("customSections") && wrapperContent.includes("CustomStorefrontSection"),
      "HomeClientWrapper must render dynamic custom sections"
    );
    assert.ok(
      wrapperContent.includes("theme={featuredSec?.theme}") &&
        wrapperContent.includes("theme={newArrivalsSec?.theme}") &&
        wrapperContent.includes("theme={bestSellersSec?.theme}"),
      "HomeClientWrapper must pass scoped theme settings to system sections"
    );
    assert.ok(
      wrapperContent.includes("showFeatured") &&
        wrapperContent.includes("showNewArrivals") &&
        wrapperContent.includes("showBestSellers"),
      "HomeClientWrapper must respect section visibility toggles"
    );
  });

  test("7. StorefrontMerchandisingManager Comprehensive Management Features", () => {
    const managerContent = fs.readFileSync(managerPath, "utf-8");
    // Tab switching
    assert.ok(
      managerContent.includes("activeTab") &&
        managerContent.includes("featured") &&
        managerContent.includes("new_arrivals") &&
        managerContent.includes("best_sellers") &&
        managerContent.includes("deals"),
      "StorefrontMerchandisingManager must provide dedicated management tabs"
    );
    // Automatic vs Manual modes
    assert.ok(
      managerContent.includes("selectionMode") &&
        managerContent.includes("Automatic") &&
        managerContent.includes("Manual"),
      "StorefrontMerchandisingManager must support Automatic and Manual selection modes"
    );
    // Best Sellers lookback period
    assert.ok(
      managerContent.includes("lookbackDays") &&
        managerContent.includes("Sales Lookback Period"),
      "StorefrontMerchandisingManager must allow configuring sales lookback period"
    );
    // Scoped Theme controls
    assert.ok(
      managerContent.includes("PRESET_THEMES") &&
        managerContent.includes("handleApplyPreset") &&
        managerContent.includes("Reset to Default"),
      "StorefrontMerchandisingManager must provide curated palette presets and reset-to-default action"
    );
    // Live preview
    assert.ok(
      managerContent.includes("Live Section Header") &&
        managerContent.includes("PREVIEW"),
      "StorefrontMerchandisingManager must render a live scoped preview box"
    );
  });
});
