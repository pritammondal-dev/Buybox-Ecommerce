const mongoose = require("mongoose");
const {
  createStorefrontSectionSchema,
  updateStorefrontSectionSchema,
  reorderStorefrontSectionsSchema,
} = require("../src/validators/cms/storefront-section.validator");
const storefrontSectionService = require("../src/services/storefront-section.service");
const StorefrontSection = require("../src/models/StorefrontSection");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const AppError = require("../src/errors/AppError");

describe("Phase SM1 — Storefront Merchandising Control Center Backend Suite", () => {
  const dummyUserId = new mongoose.Types.ObjectId().toString();
  const dummyProductId1 = new mongoose.Types.ObjectId().toString();
  const dummyProductId2 = new mongoose.Types.ObjectId().toString();

  describe("1. Schema & Validator Forensic Safeguards", () => {
    it("accepts valid system and custom section types", () => {
      const validTypes = [
        "featured_products",
        "new_arrivals",
        "best_sellers",
        "products",
        "collection",
        "category",
        "carousel",
        "grid",
        "category_showcase",
        "promotional_banner",
        "flash_deal",
        "flash_sale",
      ];

      for (const type of validTypes) {
        const payload = {
          title: `Test ${type}`,
          key: `test-${type}`,
          type,
          selectionMode: "automatic",
          limit: 10,
          displayOrder: 1,
        };
        const parsed = createStorefrontSectionSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
      }
    });

    it("rejects unknown or arbitrary component types (anti-injection)", () => {
      const payload = {
        title: "Malicious Section",
        key: "malicious-section",
        type: "<script>alert(1)</script>",
      };
      const parsed = createStorefrontSectionSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it("validates safe hex colors for scoped theme controls", () => {
      const validColors = {
        title: "Themed Section",
        key: "themed-section",
        type: "carousel",
        theme: {
          backgroundColor: "#F0FDF4",
          headingColor: "#0F172A",
          textColor: "#334155",
          accentColor: "#007A55",
          badgeColor: "#E02424",
          buttonBgColor: "#007A55",
          buttonTextColor: "#FFFFFF",
          borderColor: "#E2E8F0",
        },
      };

      const parsed = createStorefrontSectionSchema.safeParse(validColors);
      expect(parsed.success).toBe(true);
    });

    it("rejects unsafe CSS / script injection in theme colors", () => {
      const invalidColors = [
        "javascript:alert(1)",
        "expression(alert(1))",
        "url('https://evil.com/leak')",
        "red; position: fixed; top: 0;",
        "rgb(255, 0, 0)",
        "#GGGGGG",
      ];

      for (const badColor of invalidColors) {
        const payload = {
          title: "Themed Section",
          key: "bad-themed-section",
          type: "carousel",
          theme: {
            backgroundColor: badColor,
          },
        };
        const parsed = createStorefrontSectionSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
      }
    });

    it("validates reorder batch schema properly", () => {
      const validReorder = {
        sections: [
          { id: dummyProductId1, displayOrder: 0, isActive: true },
          { id: dummyProductId2, displayOrder: 1, isActive: false },
        ],
      };
      expect(reorderStorefrontSectionsSchema.safeParse(validReorder).success).toBe(true);

      const invalidReorder = {
        sections: [],
      };
      expect(reorderStorefrontSectionsSchema.safeParse(invalidReorder).success).toBe(false);
    });
  });

  describe("2. System Sections Protection & Invariants", () => {
    it("protects system sections from deletion", async () => {
      const findByIdSpy = jest
        .spyOn(StorefrontSection, "findById")
        .mockReturnValue({
          session: jest.fn().mockResolvedValue({
            _id: new mongoose.Types.ObjectId(),
            key: "featured_products",
            isSystem: true,
            title: "Featured Products",
          }),
        });

      await expect(
        storefrontSectionService.deleteSection(dummyProductId1)
      ).rejects.toThrow(AppError);

      findByIdSpy.mockRestore();
    });

    it("prevents changing the key of a system section", async () => {
      const findByIdSpy = jest
        .spyOn(StorefrontSection, "findById")
        .mockReturnValue({
          session: jest.fn().mockResolvedValue({
            _id: new mongoose.Types.ObjectId(),
            key: "new_arrivals",
            isSystem: true,
            title: "New Arrivals",
          }),
        });

      await expect(
        storefrontSectionService.updateSection(
          dummyProductId1,
          { key: "renamed_new_arrivals" },
          dummyUserId
        )
      ).rejects.toThrow("System section key cannot be modified");

      findByIdSpy.mockRestore();
    });
  });

  describe("3. Dynamic Product Resolution Engine", () => {
    it("automatically queries newest active products for New Arrivals in automatic mode", async () => {
      const mockActiveProducts = [
        { _id: new mongoose.Types.ObjectId(), name: "Product A", createdAt: new Date("2026-10-28") },
        { _id: new mongoose.Types.ObjectId(), name: "Product B", createdAt: new Date("2026-10-27") },
      ];

      const findSpy = jest.spyOn(Product, "find").mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockActiveProducts),
          }),
        }),
      });

      const section = {
        type: "new_arrivals",
        selectionMode: "automatic",
        limit: 5,
      };

      const resolved = await storefrontSectionService.resolveSectionProducts(section);
      expect(resolved).toHaveLength(2);
      expect(resolved[0].name).toBe("Product A");
      expect(findSpy).toHaveBeenCalledWith({ status: "active" });

      findSpy.mockRestore();
    });

    it("aggregates qualifying completed/paid orders for Best Sellers ranking", async () => {
      const orderProdId1 = new mongoose.Types.ObjectId();
      const orderProdId2 = new mongoose.Types.ObjectId();

      const aggregateSpy = jest.spyOn(Order, "aggregate").mockResolvedValue([
        { _id: orderProdId1, totalUnitsSold: 50, totalRevenue: 10000 },
        { _id: orderProdId2, totalUnitsSold: 20, totalRevenue: 5000 },
      ]);

      const mockProducts = [
        { _id: orderProdId1, name: "Top Earphones", status: "active" },
        { _id: orderProdId2, name: "Mechanical Keyboard", status: "active" },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProducts),
      };
      const findSpy = jest.spyOn(Product, "find").mockReturnValue(mockQuery);

      const section = {
        type: "best_sellers",
        selectionMode: "automatic",
        lookbackDays: 30,
        limit: 2,
      };

      const resolved = await storefrontSectionService.resolveSectionProducts(section);
      expect(resolved).toHaveLength(2);
      expect(resolved[0].name).toBe("Top Earphones");
      expect(resolved[1].name).toBe("Mechanical Keyboard");

      aggregateSpy.mockRestore();
      findSpy.mockRestore();
    });

    it("respects manual product order when selectionMode is manual", async () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();

      const mockProducts = [
        { _id: id1, name: "Manual Pick 1", status: "active" },
        { _id: id2, name: "Manual Pick 2", status: "active" },
      ];

      const findSpy = jest.spyOn(Product, "find").mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProducts),
      });

      const section = {
        type: "featured_products",
        selectionMode: "manual",
        productIds: [id2, id1], // Pick 2 before Pick 1
      };

      const resolved = await storefrontSectionService.resolveSectionProducts(section);
      expect(resolved).toHaveLength(2);
      expect(resolved[0]._id.toString()).toBe(id2.toString());
      expect(resolved[1]._id.toString()).toBe(id1.toString());

      findSpy.mockRestore();
    });
  });
});
