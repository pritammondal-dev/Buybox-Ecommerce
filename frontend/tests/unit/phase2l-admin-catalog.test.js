import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractProductThumbnailUrl,
  collectProductGalleryImages,
  parseBulkOperationReport,
  computeBulkActionAvailability,
} from "../../src/utils/product-image.util.js";
import { adminCatalogService } from "../../src/services/admin/admin.service.js";

describe("Phase 2L.1 — Administrator Catalog Remediation Frontend Unit Tests", () => {
  // =========================================================================
  // DEF-001 & DEF-002: Safe Product Thumbnail URL Extraction & Normalization
  // =========================================================================
  describe("DEF-001 & DEF-002: Product Thumbnail URL Extraction", () => {
    test("handles null or undefined product safely", () => {
      assert.equal(extractProductThumbnailUrl(null), null);
      assert.equal(extractProductThumbnailUrl(undefined), null);
      assert.equal(extractProductThumbnailUrl({}), null);
      assert.equal(extractProductThumbnailUrl(42), null);
      assert.equal(extractProductThumbnailUrl("string"), null);
    });

    test("extracts URL from canonical subdocument primaryImage { url, publicId, ... }", () => {
      const product = {
        primaryImage: {
          url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
          publicId: "sample_123",
          altText: "Sample product",
          sortOrder: 0,
        },
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "https://res.cloudinary.com/demo/image/upload/sample.jpg"
      );
    });

    test("extracts URL from legacy string primaryImage", () => {
      const product = {
        primaryImage: "https://example.com/legacy-primary.jpg",
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "https://example.com/legacy-primary.jpg"
      );
    });

    test("extracts URL from images array containing canonical subdocuments", () => {
      const product = {
        images: [
          {
            url: "/uploads/product_123.jpg",
            publicId: "prod_123",
            altText: "Product 123",
            sortOrder: 0,
          },
        ],
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "/uploads/product_123.jpg"
      );
    });

    test("extracts URL from images array containing legacy strings", () => {
      const product = {
        images: ["/uploads/legacy_item.png"],
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "/uploads/legacy_item.png"
      );
    });

    test("handles empty objects, whitespace-only strings, and null items without crashing", () => {
      const product = {
        primaryImage: {},
        images: [null, undefined, "", "   ", {}, { url: "" }, { url: "   " }],
        thumbnail: "   ",
      };
      assert.equal(extractProductThumbnailUrl(product), null);
    });

    test("falls through to thumbnail field if primaryImage and images are empty", () => {
      const product = {
        primaryImage: null,
        images: [],
        thumbnail: { url: "https://example.com/thumb.webp" },
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "https://example.com/thumb.webp"
      );
    });

    test("trims leading/trailing whitespace from valid URLs", () => {
      const product = {
        primaryImage: "   https://example.com/trimmed.jpg   ",
      };
      assert.equal(
        extractProductThumbnailUrl(product),
        "https://example.com/trimmed.jpg"
      );
    });
  });

  // =========================================================================
  // DEF-007: Product Detail Image Gallery Normalization
  // =========================================================================
  describe("DEF-007: Product Detail Image Gallery Normalization", () => {
    test("returns empty array for product with no images", () => {
      const result = collectProductGalleryImages({ name: "Empty Product" });
      assert.deepEqual(result, []);
      assert.deepEqual(collectProductGalleryImages(null), []);
      assert.deepEqual(collectProductGalleryImages(undefined), []);
    });

    test("collects and sorts gallery images by sortOrder", () => {
      const product = {
        name: "Test Shirt",
        images: [
          { url: "https://example.com/img3.jpg", sortOrder: 3, altText: "Back View" },
          { url: "https://example.com/img1.jpg", sortOrder: 1, altText: "Front View" },
          { url: "https://example.com/img2.jpg", sortOrder: 2, altText: "Side View" },
        ],
      };
      const result = collectProductGalleryImages(product);
      assert.equal(result.length, 3);
      assert.equal(result[0].url, "https://example.com/img1.jpg");
      assert.equal(result[0].altText, "Front View");
      assert.equal(result[1].url, "https://example.com/img2.jpg");
      assert.equal(result[2].url, "https://example.com/img3.jpg");
    });

    test("includes variant-specific images with variant SKU tags", () => {
      const product = {
        name: "Variable Shoes",
        images: [{ url: "https://example.com/shoe-main.jpg", sortOrder: 0 }],
        variants: [
          {
            sku: "SHOE-RED-42",
            image: { url: "https://example.com/shoe-red.jpg" },
          },
          {
            sku: "SHOE-BLU-42",
            images: [{ url: "https://example.com/shoe-blue.jpg" }],
          },
        ],
      };
      const result = collectProductGalleryImages(product);
      assert.equal(result.length, 3);
      assert.equal(result[0].url, "https://example.com/shoe-main.jpg");
      assert.equal(result[1].url, "https://example.com/shoe-red.jpg");
      assert.equal(result[1].variantSku, "SHOE-RED-42");
      assert.equal(result[2].url, "https://example.com/shoe-blue.jpg");
      assert.equal(result[2].variantSku, "SHOE-BLU-42");
    });

    test("deduplicates identical URLs between product images and variant images", () => {
      const product = {
        name: "Dedupe Item",
        images: [{ url: "https://example.com/shared.jpg" }],
        variants: [
          {
            sku: "VAR-1",
            image: { url: "https://example.com/shared.jpg" },
          },
        ],
      };
      const result = collectProductGalleryImages(product);
      assert.equal(result.length, 1);
    });

    test("safely ignores malformed variant image entries", () => {
      const product = {
        name: "Malformed Variants",
        variants: [
          { sku: "VAR-NULL", image: null },
          { sku: "VAR-EMPTY-OBJ", image: {} },
          { sku: "VAR-EMPTY-STR", image: "   " },
          { sku: "VAR-VALID", image: "https://example.com/valid-variant.jpg" },
        ],
      };
      const result = collectProductGalleryImages(product);
      assert.equal(result.length, 1);
      assert.equal(result[0].url, "https://example.com/valid-variant.jpg");
    });
  });

  // =========================================================================
  // DEF-005 & DEF-008: Bulk Operation Response Parsing & Error Reporting
  // =========================================================================
  describe("DEF-005 & DEF-008: Bulk Operation Response Contract", () => {
    test("correctly parses canonical backend bulk response shape with summary and results[].id", () => {
      const backendResponse = {
        summary: { total: 3, succeeded: 2, failed: 1 },
        results: [
          { id: "prod_001", status: "succeeded", message: "Approved successfully" },
          { id: "prod_002", status: "succeeded", message: "Approved successfully" },
          { id: "prod_003", status: "failed", error: "Product is in draft state and cannot be approved" },
        ],
      };

      const parsed = parseBulkOperationReport(backendResponse);
      assert.equal(parsed.total, 3);
      assert.equal(parsed.succeeded, 2);
      assert.equal(parsed.failed, 1);
      assert.equal(parsed.results[0].id, "prod_001");
      assert.equal(parsed.results[1].id, "prod_002");
      assert.equal(parsed.results[2].id, "prod_003");
      assert.equal(parsed.results[2].status, "failed");
      assert.ok(parsed.results[2].error.includes("draft state"));
    });

    test("handles all-success bulk response", () => {
      const allSuccess = {
        summary: { total: 2, succeeded: 2, failed: 0 },
        results: [
          { id: "p1", status: "succeeded" },
          { id: "p2", status: "succeeded" },
        ],
      };
      const parsed = parseBulkOperationReport(allSuccess);
      assert.equal(parsed.total, 2);
      assert.equal(parsed.succeeded, 2);
      assert.equal(parsed.failed, 0);
    });

    test("handles all-failure bulk response without reporting false zero-item success", () => {
      const allFailure = {
        summary: { total: 2, succeeded: 0, failed: 2 },
        results: [
          { id: "p1", status: "failed", error: "Validation error" },
          { id: "p2", status: "failed", error: "Ownership error" },
        ],
      };
      const parsed = parseBulkOperationReport(allFailure);
      assert.equal(parsed.total, 2);
      assert.equal(parsed.succeeded, 0);
      assert.equal(parsed.failed, 2);
    });

    test("handles null or malformed response gracefully", () => {
      const parsed = parseBulkOperationReport(null);
      assert.equal(parsed.total, 0);
      assert.equal(parsed.succeeded, 0);
      assert.equal(parsed.failed, 0);
      assert.deepEqual(parsed.results, []);
    });
  });

  // =========================================================================
  // DEF-004, DEF-009, & DEF-011: Status-Aware Approval & Lifecycle UX
  // =========================================================================
  describe("DEF-004, DEF-009, & DEF-011: Status-Aware Lifecycle Business Logic", () => {
    test("allows Approve action only when pending_approval products are selected and drafts are absent", () => {
      const pendingOnly = [{ status: "pending_approval" }, { status: "pending_approval" }];
      const result = computeBulkActionAvailability(pendingOnly);
      assert.equal(result.canApprove, true);
      assert.equal(result.approveDisabledReason, null);
    });

    test("disables Approve action when drafts are in the selection with clear explanation", () => {
      const mixed = [{ status: "pending_approval" }, { status: "draft" }];
      const result = computeBulkActionAvailability(mixed);
      assert.equal(result.canApprove, false);
      assert.ok(result.approveDisabledReason.includes("Draft products must be submitted for review"));
    });

    test("exposes Submit for Review when drafts or rejected items are selected", () => {
      const draftOnly = [{ status: "draft" }];
      const result = computeBulkActionAvailability(draftOnly);
      assert.equal(result.canSubmitForReview, true);
      assert.equal(result.canApprove, false);
    });

    test("adminCatalogService exposes submitProduct for single-item and bulk submission", () => {
      assert.equal(typeof adminCatalogService.submitProduct, "function");
      assert.equal(typeof adminCatalogService.approveProduct, "function");
      assert.equal(typeof adminCatalogService.rejectProduct, "function");
      assert.equal(typeof adminCatalogService.listProducts, "function");
      assert.equal(typeof adminCatalogService.getProduct, "function");
    });
  });
});
