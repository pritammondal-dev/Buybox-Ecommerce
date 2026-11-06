import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getCanonicalProductId,
  deduplicateProducts,
} from "../../src/utils/recentlyViewed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Phase E4: Storefront Campaign Discovery & Recently Viewed Hydration Remediation", () => {
  describe("Part C: Canonical Product ID Resolution & Key Stability", () => {
    it("resolves string ID cleanly", () => {
      assert.strictEqual(getCanonicalProductId("prod_abc123"), "prod_abc123");
      assert.strictEqual(getCanonicalProductId("  spaced_id  "), "spaced_id");
    });

    it("resolves object with _id", () => {
      const prod = { _id: "65a123f0001", name: "Sennheiser HD 600" };
      assert.strictEqual(getCanonicalProductId(prod), "65a123f0001");
    });

    it("resolves object with numeric or string id", () => {
      const prod = { id: 98765, name: "Sony WH-1000XM5" };
      assert.strictEqual(getCanonicalProductId(prod), "98765");
    });

    it("resolves object with slug when id is missing", () => {
      const prod = { slug: "beyerdynamic-dt-990-pro", name: "DT 990 Pro" };
      assert.strictEqual(getCanonicalProductId(prod), "beyerdynamic-dt-990-pro");
    });

    it("returns null for malformed, empty, or undefined shapes without crashing", () => {
      assert.strictEqual(getCanonicalProductId(null), null);
      assert.strictEqual(getCanonicalProductId(undefined), null);
      assert.strictEqual(getCanonicalProductId(""), null);
      assert.strictEqual(getCanonicalProductId("   "), null);
      assert.strictEqual(getCanonicalProductId({}), null);
    });

    it("generates stable, non-undefined, prefixed React keys", () => {
      const items = [
        { _id: "prod_1", name: "Audio-Technica ATH-M50x" },
        { id: "prod_2", name: "Shure SM7B" },
        "prod_3",
      ];

      const keys = items.map((item) => `recently-viewed-${getCanonicalProductId(item)}`);
      assert.deepStrictEqual(keys, [
        "recently-viewed-prod_1",
        "recently-viewed-prod_2",
        "recently-viewed-prod_3",
      ]);

      // All keys must be defined and unique
      for (const key of keys) {
        assert.ok(key && !key.includes("undefined"));
      }
      assert.strictEqual(new Set(keys).size, items.length);
    });
  });

  describe("Part C: Product Deduplication", () => {
    it("deduplicates product list while preserving first-seen chronological order", () => {
      const rawList = [
        { _id: "prod_1", name: "Product 1" },
        { _id: "prod_2", name: "Product 2" },
        { _id: "prod_1", name: "Product 1 Duplicate" },
        { _id: "prod_3", name: "Product 3" },
        { id: "prod_2", name: "Product 2 Duplicate by id" },
      ];

      const deduplicated = deduplicateProducts(rawList);
      assert.strictEqual(deduplicated.length, 3);
      assert.strictEqual(getCanonicalProductId(deduplicated[0]), "prod_1");
      assert.strictEqual(getCanonicalProductId(deduplicated[1]), "prod_2");
      assert.strictEqual(getCanonicalProductId(deduplicated[2]), "prod_3");
    });

    it("deduplicates mixed string IDs and object records", () => {
      const mixedList = [
        "prod_100",
        { _id: "prod_200", name: "Item 200" },
        { _id: "prod_100", name: "Item 100 Object" },
        "prod_300",
      ];

      const deduplicated = deduplicateProducts(mixedList);
      assert.strictEqual(deduplicated.length, 3);
      assert.deepStrictEqual(
        deduplicated.map((p) => getCanonicalProductId(p)),
        ["prod_100", "prod_200", "prod_300"]
      );
    });

    it("filters out invalid items without throwing", () => {
      const dirtyList = [null, undefined, {}, { _id: "prod_valid" }, ""];
      const clean = deduplicateProducts(dirtyList);
      assert.strictEqual(clean.length, 1);
      assert.strictEqual(getCanonicalProductId(clean[0]), "prod_valid");
    });
  });

  describe("Part D: Hydration Safety & Component Structure Inspection", () => {
    const pageViewPath = path.resolve(
      __dirname,
      "../../src/app/(storefront)/account/recently-viewed/RecentlyViewedPageView.jsx"
    );
    const content = fs.readFileSync(pageViewPath, "utf8");

    it("uses deterministic initial state without reading window or localStorage in useState initializer", () => {
      // Must NOT use useState(() => localStorage.getItem(...))
      assert.ok(
        !content.includes("useState(() =>"),
        "RecentlyViewedPageView must not initialize state from browser localStorage inside useState callback"
      );

      // Must have isMounted state initialized to false
      assert.ok(
        content.includes("const [isMounted, setIsMounted] = useState(false)"),
        "Must initialize isMounted to false deterministically"
      );

      // Must have items initialized to []
      assert.ok(
        content.includes("const [items, setItems] = useState([])"),
        "Must initialize items to empty array deterministically"
      );
    });

    it("renders Clear History button conditionally on isMounted && items.length > 0", () => {
      assert.ok(
        content.includes("isMounted && items.length > 0"),
        "Clear History button must only render when hydrated (isMounted) and items exist"
      );
    });

    it("renders loading skeleton placeholder during initial hydration (!isMounted || isLoading)", () => {
      assert.ok(
        content.includes("!isMounted || isLoading"),
        "Component must render identical skeleton state during SSR and initial hydration"
      );
      assert.ok(
        content.includes("data-testid=\"recently-viewed-skeleton\""),
        "Skeleton container testid must be present for hydration safety verification"
      );
    });

    it("provides individual item removal button with removeRecentlyViewedId call", () => {
      assert.ok(
        content.includes("removeRecentlyViewedId"),
        "Must invoke removeRecentlyViewedId for single-item removal"
      );
      assert.ok(
        content.includes("handleRemoveItem"),
        "Must provide handleRemoveItem handler"
      );
    });

    it("provides full history clear with clearRecentlyViewed call", () => {
      assert.ok(
        content.includes("clearRecentlyViewed"),
        "Must invoke clearRecentlyViewed utility"
      );
      assert.ok(
        content.includes("handleClearHistory"),
        "Must provide handleClearHistory handler"
      );
    });
  });

  describe("Part B: Storefront Campaign Discovery Entry Points", () => {
    it("includes Campaigns navigation item in MainShoppingNav.jsx", () => {
      const navPath = path.resolve(
        __dirname,
        "../../src/components/storefront/navigation/MainShoppingNav.jsx"
      );
      const navContent = fs.readFileSync(navPath, "utf8");

      assert.ok(
        navContent.includes('label: "Campaigns"'),
        "MainShoppingNav must include 'Campaigns' label"
      );
      assert.ok(
        navContent.includes('href: "/campaigns"'),
        "MainShoppingNav must link to '/campaigns'"
      );
      assert.ok(
        navContent.includes('badge: "LIVE"'),
        "MainShoppingNav must include 'LIVE' badge on Campaigns"
      );
    });

    it("includes Campaigns & Offers link in StorefrontHeader mobile drawer", () => {
      const headerPath = path.resolve(
        __dirname,
        "../../src/components/storefront/StorefrontHeader.jsx"
      );
      const headerContent = fs.readFileSync(headerPath, "utf8");

      assert.ok(
        headerContent.includes('href="/campaigns"'),
        "StorefrontHeader mobile drawer must include link to '/campaigns'"
      );
      assert.ok(
        headerContent.includes("mobile-drawer-campaigns-link"),
        "StorefrontHeader must have mobile drawer campaigns link ID"
      );
      assert.ok(
        headerContent.includes("Campaigns &amp; Offers") || headerContent.includes("Campaigns & Offers"),
        "StorefrontHeader must display 'Campaigns & Offers' in mobile drawer"
      );
    });

    it("links Bank & Partner Offers card in DealsPromoRow.jsx to /campaigns", () => {
      const dealsRowPath = path.resolve(
        __dirname,
        "../../src/components/storefront/home/DealsPromoRow.jsx"
      );
      const dealsRowContent = fs.readFileSync(dealsRowPath, "utf8");

      assert.ok(
        dealsRowContent.includes('href="/campaigns"'),
        "DealsPromoRow Card 3 must link to '/campaigns'"
      );
      assert.ok(
        dealsRowContent.includes('id="deals-promo-bank-offers-link"'),
        "DealsPromoRow Card 3 must have deals-promo-bank-offers-link ID"
      );
    });

    it("links CampaignDetailView breadcrumbs to /campaigns", () => {
      const detailViewPath = path.resolve(
        __dirname,
        "../../src/app/(storefront)/campaign/[slug]/CampaignDetailView.jsx"
      );
      const detailViewContent = fs.readFileSync(detailViewPath, "utf8");

      assert.ok(
        detailViewContent.includes('href="/campaigns"'),
        "CampaignDetailView breadcrumb must link to '/campaigns'"
      );
    });

    it("renders ActiveCampaignsSection on storefront homepage", () => {
      const sectionPath = path.resolve(
        __dirname,
        "../../src/components/storefront/home/ActiveCampaignsSection.jsx"
      );
      assert.ok(fs.existsSync(sectionPath), "ActiveCampaignsSection.jsx must exist");

      const sectionContent = fs.readFileSync(sectionPath, "utf8");
      assert.ok(
        sectionContent.includes('href="/campaigns"'),
        "ActiveCampaignsSection header right must link to '/campaigns'"
      );
      assert.ok(
        sectionContent.includes("camp.bannerUrl"),
        "ActiveCampaignsSection must support campaign banners"
      );

      const wrapperPath = path.resolve(
        __dirname,
        "../../src/components/storefront/home/HomeClientWrapper.jsx"
      );
      const wrapperContent = fs.readFileSync(wrapperPath, "utf8");
      assert.ok(
        wrapperContent.includes("ActiveCampaignsSection"),
        "HomeClientWrapper must import and render ActiveCampaignsSection"
      );
      assert.ok(
        wrapperContent.includes("initialActiveCampaigns"),
        "HomeClientWrapper must receive initialActiveCampaigns prop"
      );
    });

    it("provides working /campaigns discovery page with empty state and campaign cards", () => {
      const campaignsPagePath = path.resolve(
        __dirname,
        "../../src/app/(storefront)/campaigns/page.js"
      );
      assert.ok(fs.existsSync(campaignsPagePath), "/campaigns/page.js must exist");

      const pageContent = fs.readFileSync(campaignsPagePath, "utf8");
      assert.ok(
        pageContent.includes("campaignService.getActiveCampaigns()"),
        "Campaigns page must fetch active campaigns"
      );
      assert.ok(
        pageContent.includes("No active campaigns right now"),
        "Campaigns page must render a graceful empty state"
      );
      assert.ok(
        pageContent.includes("Campaigns &amp; Special Offers") || pageContent.includes("Campaigns & Special Offers"),
        "Campaigns page must display appropriate heading"
      );
      assert.ok(
        pageContent.includes("href={`/campaign/${slug}`}"),
        "Campaign cards must link to single campaign landing route /campaign/[slug]"
      );
    });
  });
});
