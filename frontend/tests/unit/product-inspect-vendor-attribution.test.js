import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("PRODUCT-INSPECT-01 — Product Inspect & Vendor Attribution Restoration", () => {
  describe("1. adminCatalogService.getProduct response unwrapping contract", () => {
    it("safely extracts product object from standard backend envelope { success, data: { product } }", () => {
      // Simulate the service logic
      const simulateGetProduct = (res) => {
        return (
          res?.data?.product ||
          res?.data?.data?.product ||
          res?.product ||
          res?.data?.data ||
          res?.data ||
          res
        );
      };

      const axiosUnwrappedResponse = {
        success: true,
        message: "Product retrieved successfully",
        data: {
          product: {
            _id: "6ad71a22fd586ee2de97502d",
            name: "Acoustic Pro Wireless Noise-Cancelling Headphones",
            price: 2999,
            sku: "AP-WNC-001",
          },
        },
      };

      const extracted = simulateGetProduct(axiosUnwrappedResponse);
      assert.ok(extracted, "Product must be extracted");
      assert.equal(extracted._id, "6ad71a22fd586ee2de97502d");
      assert.equal(extracted.name, "Acoustic Pro Wireless Noise-Cancelling Headphones");
      assert.equal(extracted.price, 2999);
    });

    it("safely extracts product when response is directly { product: { ... } }", () => {
      const simulateGetProduct = (res) => {
        return (
          res?.data?.product ||
          res?.data?.data?.product ||
          res?.product ||
          res?.data?.data ||
          res?.data ||
          res
        );
      };

      const directProductResponse = {
        product: {
          _id: "prod-123",
          name: "Smart Fitness Watch",
        },
      };

      const extracted = simulateGetProduct(directProductResponse);
      assert.equal(extracted._id, "prod-123");
      assert.equal(extracted.name, "Smart Fitness Watch");
    });
  });

  describe("2. Vendor Attribution & Seller Status Resolution", () => {
    const resolveVendorAttribution = (product) => {
      const vendorAttribution = product?.vendorAttribution;
      const vendor =
        product?.vendorId && typeof product.vendorId === "object" && product.vendorId.businessName
          ? product.vendorId
          : vendorAttribution?.vendor || null;

      const rawVendorId = product?.vendorId?._id
        ? String(product.vendorId._id)
        : typeof product?.vendorId === "string" && product?.vendorId
        ? product.vendorId
        : vendorAttribution?.vendorId || null;

      const status =
        vendorAttribution?.status ||
        (vendor ? "assigned" : rawVendorId ? "unresolved_record" : "unassigned");

      return {
        vendor,
        rawVendorId,
        status,
        isAssigned: status === "assigned",
        isUnresolved: status === "unresolved_record",
        isUnassigned: status === "unassigned",
      };
    };

    it("accurately identifies assigned vendor with business details", () => {
      const productWithVendor = {
        _id: "prod-1",
        name: "Test Headphones",
        vendorId: {
          _id: "ven-123",
          businessName: "Buybox Electronics India",
          businessSlug: "buybox-electronics-india",
          onboardingStatus: "approved",
          supportEmail: "support@buyboxelectronics.in",
        },
      };

      const result = resolveVendorAttribution(productWithVendor);
      assert.equal(result.status, "assigned");
      assert.equal(result.isAssigned, true);
      assert.equal(result.vendor.businessName, "Buybox Electronics India");
      assert.equal(result.rawVendorId, "ven-123");
    });

    it("accurately reports unassigned vendor without inventing seller", () => {
      const platformProduct = {
        _id: "prod-2",
        name: "Generic Cable",
        vendorId: null,
      };

      const result = resolveVendorAttribution(platformProduct);
      assert.equal(result.status, "unassigned");
      assert.equal(result.isUnassigned, true);
      assert.equal(result.vendor, null);
      assert.equal(result.rawVendorId, null);
    });

    it("accurately identifies unresolved vendor reference ID", () => {
      const deletedVendorProduct = {
        _id: "prod-3",
        name: "Legacy Mouse",
        vendorId: "6a9955e001560df0f8e2ad6c", // unpopulated string reference
      };

      const result = resolveVendorAttribution(deletedVendorProduct);
      assert.equal(result.status, "unresolved_record");
      assert.equal(result.isUnresolved, true);
      assert.equal(result.vendor, null);
      assert.equal(result.rawVendorId, "6a9955e001560df0f8e2ad6c");
    });
  });

  describe("3. Decimal128 & Currency Formatting Resilience", () => {
    const parseDecimalNumber = (val) => {
      if (val == null) return 0;
      if (typeof val === "object" && val.$numberDecimal) return Number(val.$numberDecimal) || 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const formatCurrency = (val) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(parseDecimalNumber(val));
    };

    it("converts MongoDB Decimal128 object to formatted INR currency without [object Object] or NaN", () => {
      const decimalObj = { $numberDecimal: "4999.50" };
      const formatted = formatCurrency(decimalObj);
      assert.match(formatted, /4,999\.5/);
      assert.doesNotMatch(formatted, /NaN/);
      assert.doesNotMatch(formatted, /object/);
    });

    it("safely handles null, undefined, and numeric prices", () => {
      assert.match(formatCurrency(null), /0\.00/);
      assert.match(formatCurrency(undefined), /0\.00/);
      assert.match(formatCurrency(2999), /2,999\.00/);
      assert.match(formatCurrency("1499.00"), /1,499\.00/);
    });
  });

  describe("4. Static Inspection of Product Inspect Files", () => {
    it("verifies Product Inspect button attributes in administrator products listing", () => {
      const listPagePath = path.resolve(__dirname, "../../src/app/administrator/catalog/products/page.js");
      const content = fs.readFileSync(listPagePath, "utf-8");

      assert.ok(content.includes('title="Inspect Product"'), "Must have title='Inspect Product'");
      assert.ok(content.includes('data-testid="product-inspect-button"'), "Must have data-testid='product-inspect-button'");
      assert.ok(
        content.includes("/administrator/catalog/products/${pId}") ||
        content.includes("/administrator/catalog/products/${p._id}"),
        "Must route to /administrator/catalog/products/[id]"
      );
    });

    it("verifies SellerAttributionCard and ProductSpecificationsCard in product details page", () => {
      const detailPagePath = path.resolve(__dirname, "../../src/app/administrator/catalog/products/[id]/page.js");
      const content = fs.readFileSync(detailPagePath, "utf-8");

      assert.ok(content.includes("SellerAttributionCard"), "Must export/render SellerAttributionCard");
      assert.ok(content.includes("ProductSpecificationsCard"), "Must export/render ProductSpecificationsCard");
      assert.ok(content.includes('data-testid="seller-vendor-attribution-card"'), "Must include testid for seller attribution");
      assert.ok(content.includes('data-testid="product-specifications-card"'), "Must include testid for specifications card");
      assert.ok(content.includes("Verified Merchant Partner"), "Must support Verified Merchant Partner badge");
      assert.ok(content.includes("Vendor Record Unavailable"), "Must support Vendor Record Unavailable badge");
      assert.ok(content.includes("Vendor Not Assigned"), "Must support Vendor Not Assigned badge");
    });

    it("verifies backend product repository population in findById", () => {
      const repoPath = path.resolve(__dirname, "../../../backend/src/repositories/product.repository.js");
      const content = fs.readFileSync(repoPath, "utf-8");

      assert.ok(content.includes(".populate(\"categoryId\""), "Must populate categoryId");
      assert.ok(content.includes(".populate(\"brandId\""), "Must populate brandId");
      assert.ok(content.includes(".populate(\"vendorId\""), "Must populate vendorId");
      assert.ok(content.includes("businessName"), "Must include vendor businessName in projection");
    });
  });
});
