const mongoose = require("mongoose");
const {
  createStorefrontSectionSchema,
  updateStorefrontSectionSchema,
  automaticRulesSchema,
  groupSchema,
  storefrontSectionProductsQuerySchema,
} = require("../src/validators/cms/storefront-section.validator");
const storefrontSectionService = require("../src/services/storefront-section.service");
const StorefrontSection = require("../src/models/StorefrontSection");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const AppError = require("../src/errors/AppError");

describe("Phase SM2 — Advanced Storefront Merchandising Builder Backend Suite", () => {
  const dummyCatId1 = new mongoose.Types.ObjectId().toString();
  const dummyCatId2 = new mongoose.Types.ObjectId().toString();
  const dummyBrandId1 = new mongoose.Types.ObjectId().toString();
  const dummyBrandId2 = new mongoose.Types.ObjectId().toString();
  const dummyProdId1 = new mongoose.Types.ObjectId().toString();
  const dummyProdId2 = new mongoose.Types.ObjectId().toString();
  const dummyProdId3 = new mongoose.Types.ObjectId().toString();
  const dummyProdId4 = new mongoose.Types.ObjectId().toString();

  describe("1. Phase SM2 Schema & Validator Enhancements", () => {
    it("accepts brand_showcase and mixed_collection section types", () => {
      const types = ["brand_showcase", "mixed_collection", "category_showcase"];
      for (const type of types) {
        const payload = {
          title: `Showcase ${type}`,
          key: `showcase-${type}`,
          type,
          selectionMode: "automatic",
          limit: 12,
          listingLimit: 24,
          viewMoreEnabled: true,
          viewMoreTitle: "View All",
        };
        const parsed = createStorefrontSectionSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
      }
    });

    it("accepts hybrid selection mode alongside manual and automatic", () => {
      const modes = ["manual", "automatic", "hybrid"];
      for (const mode of modes) {
        const payload = {
          title: `Mode Test ${mode}`,
          key: `mode-test-${mode}`,
          type: "mixed_collection",
          selectionMode: mode,
        };
        const parsed = createStorefrontSectionSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
      }
    });

    it("validates automaticRules schema with brand diversity and price boundaries", () => {
      const validRules = {
        categoryIds: [dummyCatId1],
        brandIds: [dummyBrandId1, dummyBrandId2],
        minPrice: 500,
        maxPrice: 50000,
        inStockOnly: true,
        hasDiscountOnly: true,
        minDiscountPercent: 15,
        sortBy: "price_asc",
        maxPerBrand: 2,
        fallbackStrategy: "none",
      };
      const parsed = automaticRulesSchema.safeParse(validRules);
      expect(parsed.success).toBe(true);
    });

    it("validates multi-group showcase schema with independent limits and types", () => {
      const validGroup = {
        id: "grp-audio-1",
        title: "Wireless Earbuds",
        subtitle: "Starting ₹1,999",
        type: "category",
        categoryId: dummyCatId1,
        limit: 8,
        sortBy: "bestselling",
        isActive: true,
      };
      const parsed = groupSchema.safeParse(validGroup);
      expect(parsed.success).toBe(true);
    });

    it("validates storefront section discovery query params schema", () => {
      const validQuery = {
        page: "2",
        limit: "16",
        sortBy: "price_desc",
        category: dummyCatId1,
        brand: dummyBrandId1,
        minPrice: "1000",
        maxPrice: "25000",
        inStockOnly: "true",
      };
      const parsed = storefrontSectionProductsQuerySchema.safeParse(validQuery);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.limit).toBe(16);
    });
  });

  describe("2. Hybrid Selection & Duplicate Prevention Engine", () => {
    it("pins items to the top and prevents duplicate occurrences in the automatic fill", async () => {
      // Mock pinned product
      const pinnedProduct = {
        _id: new mongoose.Types.ObjectId(dummyProdId1),
        name: "Pinned Flagship Headphones",
        price: 14999,
        brandId: new mongoose.Types.ObjectId(dummyBrandId1),
        categoryId: new mongoose.Types.ObjectId(dummyCatId1),
        stockStatus: "in_stock",
      };

      // Mock candidates returned by automatic query
      const autoProduct1 = {
        _id: new mongoose.Types.ObjectId(dummyProdId2),
        name: "Studio Monitor Pro",
        price: 8999,
        brandId: new mongoose.Types.ObjectId(dummyBrandId1),
        categoryId: new mongoose.Types.ObjectId(dummyCatId1),
        stockStatus: "in_stock",
      };
      const autoProduct2 = {
        _id: new mongoose.Types.ObjectId(dummyProdId3),
        name: "Noise Cancelling Buds",
        price: 4999,
        brandId: new mongoose.Types.ObjectId(dummyBrandId2),
        categoryId: new mongoose.Types.ObjectId(dummyCatId1),
        stockStatus: "in_stock",
      };

      // Spy on Product.find
      const findSpy = jest.spyOn(Product, "find").mockImplementation((query) => {
        // First call for pinned products
        if (query._id && query._id.$in && query._id.$in.length === 1) {
          return {
            lean: jest.fn().mockResolvedValue([pinnedProduct]),
          };
        }
        // Second call for automatic products
        // Verify that pinned ID dummyProdId1 is strictly inside query._id.$nin exclusion filter!
        expect(query._id).toBeDefined();
        expect(query._id.$nin).toBeDefined();
        const exclusionStrings = query._id.$nin.map((id) => id.toString());
        expect(exclusionStrings).toContain(dummyProdId1);

        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([autoProduct1, autoProduct2]),
        };
      });

      const results = await storefrontSectionService.resolveProductCollection({
        selectionMode: "hybrid",
        limit: 3,
        pinnedProductIds: [dummyProdId1],
        automaticRules: {
          categoryIds: [dummyCatId1],
          sortBy: "newest",
        },
      });

      expect(results).toHaveLength(3);
      // Pinned item is strictly first
      expect(results[0]._id.toString()).toBe(dummyProdId1);
      // No duplicate items in entire collection
      const uniqueIds = new Set(results.map((r) => r._id.toString()));
      expect(uniqueIds.size).toBe(3);

      findSpy.mockRestore();
    });

    it("strictly filters out excludedProductIds from selection", async () => {
      const candidate1 = {
        _id: new mongoose.Types.ObjectId(dummyProdId2),
        name: "Allowed Audio Gear",
        brandId: new mongoose.Types.ObjectId(dummyBrandId1),
        stockStatus: "in_stock",
      };

      const findSpy = jest.spyOn(Product, "find").mockImplementation((query) => {
        // Query must contain excludedProdId in $nin
        expect(query._id.$nin.map((id) => id.toString())).toContain(dummyProdId4);
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([candidate1]),
        };
      });

      const results = await storefrontSectionService.resolveProductCollection({
        selectionMode: "automatic",
        limit: 4,
        excludedProductIds: [dummyProdId4],
      });

      expect(results).toHaveLength(1);
      expect(results[0]._id.toString()).toBe(dummyProdId2);
      findSpy.mockRestore();
    });
  });

  describe("3. Brand Diversity & Max-Per-Brand Constraint", () => {
    it("enforces maxPerBrand limit across automatic product selections", async () => {
      const brandA = new mongoose.Types.ObjectId();
      const brandB = new mongoose.Types.ObjectId();

      const candidateA1 = { _id: new mongoose.Types.ObjectId(), name: "Brand A - Model 1", brandId: brandA };
      const candidateA2 = { _id: new mongoose.Types.ObjectId(), name: "Brand A - Model 2", brandId: brandA };
      const candidateA3 = { _id: new mongoose.Types.ObjectId(), name: "Brand A - Model 3", brandId: brandA };
      const candidateB1 = { _id: new mongoose.Types.ObjectId(), name: "Brand B - Model 1", brandId: brandB };

      const findSpy = jest.spyOn(Product, "find").mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([candidateA1, candidateA2, candidateA3, candidateB1]),
      });

      const results = await storefrontSectionService.resolveProductCollection({
        selectionMode: "automatic",
        limit: 4,
        automaticRules: {
          maxPerBrand: 1, // Only 1 item allowed per brand!
        },
      });

      // Should only include candidateA1 and candidateB1
      expect(results).toHaveLength(2);
      const brandCounts = {};
      results.forEach((p) => {
        const b = p.brandId.toString();
        brandCounts[b] = (brandCounts[b] || 0) + 1;
      });
      expect(brandCounts[brandA.toString()]).toBe(1);
      expect(brandCounts[brandB.toString()]).toBe(1);

      findSpy.mockRestore();
    });
  });

  describe("4. Multi-Group Showcase Concurrent Resolution", () => {
    it("concurrently resolves active groups inside a category or brand showcase", async () => {
      const section = {
        title: "Shop by Category",
        type: "category_showcase",
        selectionMode: "automatic",
        groups: [
          {
            id: "grp-1",
            title: "Smart Audio",
            type: "category",
            categoryId: dummyCatId1,
            limit: 4,
            isActive: true,
          },
          {
            id: "grp-2",
            title: "Gaming Peripherals",
            type: "category",
            categoryId: dummyCatId2,
            limit: 4,
            isActive: true,
          },
        ],
      };

      const prodAudio = { _id: new mongoose.Types.ObjectId(), name: "Audio Item", categoryId: dummyCatId1 };
      const prodGaming = { _id: new mongoose.Types.ObjectId(), name: "Gaming Mouse", categoryId: dummyCatId2 };

      const findSpy = jest.spyOn(Product, "find").mockImplementation((query) => {
        if (query.categoryId && query.categoryId.toString() === dummyCatId1) {
          return {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([prodAudio]),
          };
        }
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([prodGaming]),
        };
      });

      const resolved = await storefrontSectionService.resolveSectionProducts(section);

      expect(section.groups).toHaveLength(2);
      expect(section.groups[0].resolvedProducts).toHaveLength(1);
      expect(section.groups[0].resolvedProducts[0].name).toBe("Audio Item");
      expect(section.groups[1].resolvedProducts).toHaveLength(1);
      expect(section.groups[1].resolvedProducts[0].name).toBe("Gaming Mouse");

      findSpy.mockRestore();
    });
  });

  describe("5. View More / Discovery Paginated Resolution", () => {
    it("returns paginated products and metadata with listingLimit", async () => {
      const mockSection = {
        _id: new mongoose.Types.ObjectId(),
        key: "explore-audio-brands",
        title: "Explore Audio Brands",
        subtitle: "Top-tier acoustic engineering",
        type: "brand_showcase",
        selectionMode: "automatic",
        limit: 8,
        listingLimit: 16,
        viewMoreEnabled: true,
        viewMoreTitle: "Explore All Brands",
        groups: [],
        automaticRules: {
          brandIds: [dummyBrandId1],
          sortBy: "newest",
        },
      };

      const mockProducts = [
        { _id: new mongoose.Types.ObjectId(), name: "Product A", price: 1000 },
        { _id: new mongoose.Types.ObjectId(), name: "Product B", price: 2000 },
      ];

      const storefrontSectionRepository = require("../src/repositories/storefront-section.repository");

      jest.spyOn(storefrontSectionRepository, "findActiveByKey").mockResolvedValue(mockSection);
      jest.spyOn(storefrontSectionRepository, "findByKey").mockResolvedValue(mockSection);

      jest.spyOn(Product, "find").mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProducts),
      });

      jest.spyOn(Product, "countDocuments").mockResolvedValue(32);
      jest.spyOn(Product, "distinct").mockResolvedValue([]);
      jest.spyOn(Category, "find").mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(Brand, "find").mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await storefrontSectionService.getSectionProductsPaginated({
        keyOrId: "explore-audio-brands",
        query: { page: 1, sortBy: "price_asc" },
      });

      expect(result.section.key).toBe("explore-audio-brands");
      expect(result.section.viewMoreTitle).toBe("Explore All Brands");
      expect(result.products).toHaveLength(2);
      expect(result.pagination.total).toBe(32);
      expect(result.pagination.limit).toBe(16); // Uses section listingLimit
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);

      storefrontSectionRepository.findActiveByKey.mockRestore();
      storefrontSectionRepository.findByKey.mockRestore();
      Product.find.mockRestore();
      Product.countDocuments.mockRestore();
      Product.distinct.mockRestore();
      Category.find.mockRestore();
      Brand.find.mockRestore();
    });
  });
});
