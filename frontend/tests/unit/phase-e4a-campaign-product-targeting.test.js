import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper mimicking CampaignFormModal's safeId
const safeId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return String(item._id || item.id || "");
  }
  return String(item);
};

describe("Phase E4A: Campaign Banner, Product Targeting & Storefront Integration", () => {
  describe("1. Identifier Normalization & Safe ID Extraction", () => {
    it("extracts string IDs cleanly", () => {
      assert.strictEqual(safeId("60d21b4667d0d8992e610c85"), "60d21b4667d0d8992e610c85");
    });

    it("extracts _id from populated or plain objects", () => {
      const obj = { _id: "60d21b4667d0d8992e610c85", name: "Sennheiser HD 800 S" };
      assert.strictEqual(safeId(obj), "60d21b4667d0d8992e610c85");
    });

    it("extracts numeric or string id property", () => {
      const obj = { id: "prod_12345", name: "Product" };
      assert.strictEqual(safeId(obj), "prod_12345");
    });

    it("handles null and undefined gracefully without throwing", () => {
      assert.strictEqual(safeId(null), "");
      assert.strictEqual(safeId(undefined), "");
      assert.strictEqual(safeId(""), "");
    });

    it("correctly identifies selection across mixed string and object IDs", () => {
      const selectedIds = ["60d21b4667d0d8992e610c85", "60d21b4667d0d8992e610c86"];
      const candidateCat = { _id: "60d21b4667d0d8992e610c85", name: "Electronics" };
      const candidateUnselected = { _id: "60d21b4667d0d8992e610c99", name: "Books" };

      const isSelected1 = selectedIds.some((id) => safeId(id) === safeId(candidateCat));
      const isSelected2 = selectedIds.some((id) => safeId(id) === safeId(candidateUnselected));

      assert.strictEqual(isSelected1, true);
      assert.strictEqual(isSelected2, false);
    });

    it("correctly toggles selections by ID without removing unrelated entries", () => {
      let selectedIds = ["id_1", "id_2", "id_3"];
      const toggleRemove = "id_2";

      selectedIds = selectedIds.filter((cid) => safeId(cid) !== safeId(toggleRemove));
      assert.deepStrictEqual(selectedIds, ["id_1", "id_3"]);

      const toggleAdd = "id_4";
      selectedIds = [...selectedIds, toggleAdd];
      assert.deepStrictEqual(selectedIds, ["id_1", "id_3", "id_4"]);
    });
  });

  describe("2. CampaignDetailView Product Safety & Error Resilience", () => {
    it("safely filters null or malformed product entries from populated productIds", () => {
      const rawProductIds = [
        { _id: "prod_1", name: "Valid Product 1", price: 2999 },
        null, // simulate deleted product
        undefined,
        { id: "prod_2", name: "Valid Product 2", price: 4999 },
      ];

      const safeProducts = rawProductIds.filter((p) => Boolean(p && (p._id || p.id)));

      assert.strictEqual(safeProducts.length, 2);
      assert.strictEqual(safeProducts[0]._id, "prod_1");
      assert.strictEqual(safeProducts[1].id, "prod_2");
    });

    it("verifies CampaignDetailView file handles banner error fallback and category pills", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/app/(storefront)/campaign/[slug]/CampaignDetailView.jsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify safe product filtering
      assert.ok(
        content.includes("campaign?.productIds || campaign?.products || []"),
        "CampaignDetailView must support productIds or products fallback"
      );
      assert.ok(
        content.includes("Boolean(p && (p._id || p.id))"),
        "CampaignDetailView must filter out null/deleted product references"
      );

      // Verify banner error handler
      assert.ok(
        content.includes("onError="),
        "CampaignDetailView must handle banner image error cleanly"
      );

      // Verify category badges rendering
      assert.ok(
        content.includes("campaign?.categoryIds"),
        "CampaignDetailView must support rendering category targeting badges"
      );
    });
  });

  describe("3. ActiveCampaignsSection Banner & Product Count Resilience", () => {
    it("verifies ActiveCampaignsSection handles banner errors and resolved product counts", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/components/storefront/home/ActiveCampaignsSection.jsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        content.includes("failedBanners"),
        "ActiveCampaignsSection must track failed banner loads"
      );
      assert.ok(
        content.includes("onError="),
        "ActiveCampaignsSection must attach onError handler to banner images"
      );
      assert.ok(
        content.includes("camp.productCount"),
        "ActiveCampaignsSection must display resolved productCount"
      );
      assert.ok(
        content.includes("href={`/campaign/${slug}`}"),
        "ActiveCampaignsSection must link cards to canonical /campaign/${slug}"
      );
    });
  });

  describe("4. Next.js Uploads Rewrite Rule", () => {
    it("verifies next.config.mjs proxies /uploads to backend", () => {
      const filePath = path.resolve(__dirname, "../../next.config.mjs");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        content.includes('source: "/uploads/:path*"'),
        "next.config.mjs must rewrite /uploads/:path*"
      );
      assert.ok(
        content.includes('destination: "http://localhost:5000/uploads/:path*"'),
        "next.config.mjs must forward /uploads to backend port 5000"
      );
    });
  });

  describe("5. Campaign Form Modal Persistence & Status Invariants", () => {
    it("verifies CampaignFormModal explicitly includes isActive based on status", () => {
      const filePath = path.resolve(
        __dirname,
        "../../src/components/admin/marketing/CampaignFormModal.jsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        content.includes("isActive: targetIsActive"),
        "CampaignFormModal must include isActive in payload"
      );
      assert.ok(
        content.includes("safeId"),
        "CampaignFormModal must use safeId for robust selection tracking"
      );
    });
  });
});
