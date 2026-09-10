const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/models/Customer");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/repositories/wishlist.repository");

const app = require("../src/app");
const Customer = require("../src/models/Customer");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const wishlistRepository = require("../src/repositories/wishlist.repository");
const { generateAccessToken } = require("../src/services/token.service");

describe("Wishlist API", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const productId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const itemId = new mongoose.Types.ObjectId().toString();

  let authToken;

  beforeEach(() => {
    jest.clearAllMocks();
    authToken = generateAccessToken({ sub: userId, role: "customer" });

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      isActive: true,
      deletedAt: null,
    });
  });

  describe("Authentication", () => {
    it("should reject unauthorized request without token", async () => {
      const response = await request(app)
        .get("/api/v1/wishlist")
        .expect(401);

      expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  describe("GET /wishlist", () => {
    it("should get empty wishlist when customer has no prior wishlist", async () => {
      wishlistRepository.findByCustomerId.mockResolvedValueOnce(null);
      wishlistRepository.create.mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [],
      });

      const response = await request(app)
        .get("/api/v1/wishlist")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual([]);
      expect(wishlistRepository.create).toHaveBeenCalledWith({
        customerId,
        items: [],
      });
    });
  });

  describe("POST /wishlist/items", () => {
    it("should add product to wishlist successfully", async () => {
      Product.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        status: "active",
        deletedAt: null,
      });

      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);
      wishlistRepository.updateById.mockImplementation(async (id, data) => data);

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId.toString()).toBe(productId);
      expect(response.body.data.items[0].productVariantId).toBeNull();
    });

    it("should add product with variant to wishlist successfully", async () => {
      Product.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        status: "active",
        deletedAt: null,
      });

      ProductVariant.findOne.mockResolvedValue({
        _id: variantId,
        productId,
        name: "Size M",
        isActive: true,
        deletedAt: null,
      });

      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);
      wishlistRepository.updateById.mockImplementation(async (id, data) => data);

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId, productVariantId: variantId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId.toString()).toBe(productId);
      expect(response.body.data.items[0].productVariantId.toString()).toBe(variantId);
    });

    it("should prevent duplicate add of the same item", async () => {
      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [
          {
            _id: itemId,
            productId,
            productVariantId: null,
            addedAt: new Date(),
          },
        ],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId })
        .expect(409);

      expect(response.body.code).toBe("WISHLIST_ITEM_ALREADY_EXISTS");
      expect(wishlistRepository.updateById).not.toHaveBeenCalled();
    });

    it("should reject invalid product format", async () => {
      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId: "not-a-valid-id" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject non-existent or inactive product", async () => {
      Product.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId })
        .expect(404);

      expect(response.body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("should reject invalid variant format", async () => {
      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId, productVariantId: "bad-variant-id" })
        .expect(400);

      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject non-existent variant", async () => {
      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      ProductVariant.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId, productVariantId: variantId })
        .expect(404);

      expect(response.body.code).toBe("PRODUCT_VARIANT_NOT_FOUND");
    });

    it("should reject variant that does not belong to the product", async () => {
      Product.findOne.mockResolvedValue({
        _id: productId,
        status: "active",
        deletedAt: null,
      });

      const differentProductId = new mongoose.Types.ObjectId().toString();
      ProductVariant.findOne.mockResolvedValue({
        _id: variantId,
        productId: differentProductId,
        isActive: true,
        deletedAt: null,
      });

      const response = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ productId, productVariantId: variantId })
        .expect(400);

      expect(response.body.code).toBe("INVALID_PRODUCT_VARIANT");
    });
  });

  describe("DELETE /wishlist/items/:itemId", () => {
    it("should remove item from wishlist successfully", async () => {
      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [
          {
            _id: itemId,
            productId,
            productVariantId: null,
            addedAt: new Date(),
          },
        ],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);
      wishlistRepository.updateById.mockImplementation(async (id, data) => data);

      const response = await request(app)
        .delete(`/api/v1/wishlist/items/${itemId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
    });

    it("should return 404 when removing an unknown item", async () => {
      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);

      const unknownItemId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/v1/wishlist/items/${unknownItemId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.code).toBe("WISHLIST_ITEM_NOT_FOUND");
    });
  });

  describe("DELETE /wishlist", () => {
    it("should clear all items from wishlist", async () => {
      const existingWishlist = {
        _id: new mongoose.Types.ObjectId().toString(),
        customerId,
        items: [
          {
            _id: itemId,
            productId,
            productVariantId: null,
            addedAt: new Date(),
          },
        ],
      };

      wishlistRepository.findByCustomerId.mockResolvedValue(existingWishlist);
      wishlistRepository.updateById.mockImplementation(async (id, data) => data);

      const response = await request(app)
        .delete("/api/v1/wishlist")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
    });
  });
});
