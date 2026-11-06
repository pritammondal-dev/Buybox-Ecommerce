import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

describe("Phase SM2 — Advanced Storefront Merchandising Builder Frontend Suite", () => {
  const discoveryPagePath = path.join(
    rootDir,
    "src/app/(storefront)/sections/[key]/page.js"
  );
  const discoveryViewPath = path.join(
    rootDir,
    "src/components/storefront/sections/SectionDiscoveryView.jsx"
  );
  const customSectionPath = path.join(
    rootDir,
    "src/components/storefront/home/CustomStorefrontSection.jsx"
  );
  const homeClientWrapperPath = path.join(
    rootDir,
    "src/components/storefront/home/HomeClientWrapper.jsx"
  );
  const managerPath = path.join(
    rootDir,
    "src/components/admin/cms/StorefrontMerchandisingManager.jsx"
  );
  const storefrontServicePath = path.join(
    rootDir,
    "src/services/storefront.service.js"
  );

  test("1. SM2 Route & Component Architecture Existence", () => {
    assert.ok(
      fs.existsSync(discoveryPagePath),
      "Dedicated discovery page route /sections/[key]/page.js must exist"
    );
    assert.ok(
      fs.existsSync(discoveryViewPath),
      "SectionDiscoveryView.jsx component must exist"
    );
    assert.ok(
      fs.existsSync(customSectionPath),
      "CustomStorefrontSection.jsx component must exist"
    );
    assert.ok(
      fs.existsSync(managerPath),
      "StorefrontMerchandisingManager.jsx component must exist"
    );
  });

  test("2. Storefront Service Phase SM2 Discovery Endpoints", () => {
    const serviceContent = fs.readFileSync(storefrontServicePath, "utf-8");
    assert.ok(
      serviceContent.includes("getSectionProducts(key, params"),
      "storefrontService must declare getSectionProducts for discovery page"
    );
    assert.ok(
      serviceContent.includes("/storefront/sections/active/${key}/products"),
      "getSectionProducts must query canonical /storefront/sections/active/:key/products endpoint"
    );
    assert.ok(
      serviceContent.includes("getAdminSectionProducts(sectionId, params"),
      "storefrontService must declare getAdminSectionProducts for admin preview"
    );
  });

  test("3. CustomStorefrontSection Multi-Group Tabs & Showcase Renderer", () => {
    const customContent = fs.readFileSync(customSectionPath, "utf-8");
    // Multi-group tab switching
    assert.ok(
      customContent.includes("activeGroupId") &&
        customContent.includes("setActiveGroupId"),
      "CustomStorefrontSection must provide interactive tab switching for multi-group showcases"
    );
    // Support category and brand showcases
    assert.ok(
      customContent.includes("category_showcase") &&
        customContent.includes("brand_showcase"),
      "CustomStorefrontSection must render category_showcase and brand_showcase types"
    );
    // Dynamic viewAllHref linking to /sections/[key]
    assert.ok(
      customContent.includes("viewAllHref") &&
        customContent.includes("/sections/"),
      "CustomStorefrontSection must dynamically construct viewAllHref linking to /sections/[key]"
    );
  });

  test("4. Dedicated Discovery Page (/sections/[key]) Features", () => {
    const viewContent = fs.readFileSync(discoveryViewPath, "utf-8");
    // Breadcrumbs
    assert.ok(
      viewContent.includes("<Breadcrumbs") && viewContent.includes("items="),
      "SectionDiscoveryView must render hierarchical Breadcrumbs"
    );
    // Scoped theme styling
    assert.ok(
      viewContent.includes("theme.backgroundColor") || viewContent.includes("bgColor"),
      "SectionDiscoveryView must apply scoped theme background and text colors"
    );
    // Flipkart style group pill switcher
    assert.ok(
      viewContent.includes("handleGroupSelect") &&
        viewContent.includes("currentGroupId"),
      "SectionDiscoveryView must support interactive group switching when section has multi-groups"
    );
    // Faceted filters
    assert.ok(
      viewContent.includes("availableFilters.categories") &&
        viewContent.includes("availableFilters.brands") &&
        viewContent.includes("priceDraft") &&
        viewContent.includes("currentInStock"),
      "SectionDiscoveryView must provide faceted filters for categories, brands, price range, and in-stock items"
    );
    // Server-side pagination
    assert.ok(
      viewContent.includes("pagination.totalPages") &&
        viewContent.includes("pagination.page") &&
        viewContent.includes("updateQueryParams({ page:"),
      "SectionDiscoveryView must implement server-side pagination controls"
    );
  });

  test("5. Superadmin Merchandising Manager Hybrid Mode & Contrast Warnings", () => {
    const managerContent = fs.readFileSync(managerPath, "utf-8");
    // Hybrid mode support
    assert.ok(
      managerContent.includes('"hybrid"') || managerContent.includes("'hybrid'"),
      "StorefrontMerchandisingManager must support Hybrid selection mode"
    );
    assert.ok(
      managerContent.includes("pinnedProducts") &&
        managerContent.includes("excludedProducts"),
      "StorefrontMerchandisingManager must support pinned products and exclusions in Hybrid mode"
    );
    // Independent limits
    assert.ok(
      managerContent.includes("Homepage Product Limit") &&
        managerContent.includes("Discovery Page Size"),
      "StorefrontMerchandisingManager must support independent homepage limits and discovery page sizes"
    );
    // WCAG Contrast calculator
    assert.ok(
      managerContent.includes("calculateContrastRatio") &&
        managerContent.includes("contrastRatio") &&
        managerContent.includes("WCAG"),
      "StorefrontMerchandisingManager must calculate contrast ratio and display WCAG warnings"
    );
    // Brand Showcase & multi-group builder
    assert.ok(
      managerContent.includes("brand_showcase") &&
        managerContent.includes("groups.map"),
      "StorefrontMerchandisingManager must support brand showcases and multi-group builders"
    );
  });

  test("6. HomeClientWrapper View More & Showcase Routing", () => {
    const wrapperContent = fs.readFileSync(homeClientWrapperPath, "utf-8");
    assert.ok(
      wrapperContent.includes("brand_showcase") &&
        wrapperContent.includes("mixed_collection"),
      "HomeClientWrapper must include brand_showcase and mixed_collection in custom section rendering"
    );
    assert.ok(
      wrapperContent.includes("viewAllHref"),
      "HomeClientWrapper must pass dynamic viewAllHref props to core showcases"
    );
  });
});
