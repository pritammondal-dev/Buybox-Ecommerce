import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("PHASE E6 — CMS Special Event Page Builder Frontend Unit Tests", () => {
  const detailViewPath = path.resolve(
    __dirname,
    "../../src/app/(storefront)/events/[slug]/EventPageDetailView.jsx"
  );
  const pageRoutePath = path.resolve(
    __dirname,
    "../../src/app/(storefront)/events/[slug]/page.js"
  );
  const adminPagePath = path.resolve(
    __dirname,
    "../../src/app/administrator/cms/events/page.js"
  );

  test("1. Event Page route files exist and are populated", () => {
    assert.ok(fs.existsSync(detailViewPath), "EventPageDetailView.jsx must exist");
    assert.ok(fs.existsSync(pageRoutePath), "events/[slug]/page.js must exist");
    assert.ok(fs.existsSync(adminPagePath), "administrator/cms/events/page.js must exist");

    const detailContent = fs.readFileSync(detailViewPath, "utf-8");
    assert.ok(detailContent.includes("export function EventPageDetailView"), "Must export EventPageDetailView");
  });

  test("2. EventPageDetailView handles canonical ProductCard and catalog integration", () => {
    const detailContent = fs.readFileSync(detailViewPath, "utf-8");
    assert.ok(detailContent.includes("<ProductCard"), "Must render canonical ProductCard component");
    assert.ok(detailContent.includes("useCart()"), "Must hook into cart service via useCart");
    assert.ok(detailContent.includes("useWishlist()"), "Must hook into wishlist service via useWishlist");
    assert.ok(!detailContent.includes("dangerouslySetInnerHTML"), "Must never render dangerous unsafe raw HTML");
  });

  test("3. EventPageDetailView implements supported section types", () => {
    const detailContent = fs.readFileSync(detailViewPath, "utf-8");
    const requiredSections = [
      "hero_banner",
      "banner_slider",
      "promo_banner",
      "ad_banner",
      "category_grid",
      "product_collection",
      "brand_showcase",
      "countdown",
      "rich_text",
    ];

    for (const secType of requiredSections) {
      assert.ok(
        detailContent.includes(`case "${secType}":`),
        `DetailView must handle section type: ${secType}`
      );
    }
  });

  test("4. Public route implements SSR metadata and token-guarded preview support", () => {
    const pageContent = fs.readFileSync(pageRoutePath, "utf-8");
    assert.ok(pageContent.includes("generateMetadata"), "Must implement generateMetadata for SEO");
    assert.ok(pageContent.includes("getEventBySlug"), "Must fetch event data by slug");
    assert.ok(pageContent.includes("notFound()"), "Must invoke notFound() on missing or unauthorized event");
    assert.ok(pageContent.includes("preview"), "Must support preview query parameter");
    assert.ok(pageContent.includes("token"), "Must support preview token verification");
  });

  test("5. Admin Event Builder implements section palette and reordering", () => {
    const adminContent = fs.readFileSync(adminPagePath, "utf-8");
    assert.ok(adminContent.includes("SECTION_TYPE_CONFIG"), "Must define section configuration palette");
    assert.ok(adminContent.includes("handleAddSection"), "Must support adding new sections");
    assert.ok(adminContent.includes("handleMoveSection"), "Must support moving sections up and down");
    assert.ok(adminContent.includes("handleDeleteSection"), "Must support deleting sections");
    assert.ok(adminContent.includes("handleSaveSections"), "Must support persisting section configurations");
    assert.ok(adminContent.includes("handlePublish"), "Must support publishing event live");
    assert.ok(adminContent.includes("handleDuplicate"), "Must support duplicating event pages");
  });

  test("6. Admin Sidebar includes Special Event Pages link", () => {
    const sidebarPath = path.resolve(__dirname, "../../src/components/admin/AdminSidebar.jsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      sidebarContent.includes("/administrator/cms/events"),
      "AdminSidebar must link to /administrator/cms/events"
    );
    assert.ok(
      sidebarContent.includes("Special Event Pages"),
      "AdminSidebar must display Special Event Pages label"
    );
  });
});
