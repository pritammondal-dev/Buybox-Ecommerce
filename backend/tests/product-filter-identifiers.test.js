const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const Vendor = require("../src/models/Vendor");
const User = require("../src/models/User");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_product_filter_test?")
  : "mongodb://127.0.0.1:27017/buybox_product_filter_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Product Filter & Identifier Safety Tests", () => {
  let createdCategory = null;
  let createdBrand = null;
  let createdVendor = null;
  let createdUser = null;
  let createdProduct = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    createdUser = await User.create({
      firstName: "Test",
      lastName: "Vendor",
      email: "vendor_filter_test@example.com",
      role: "vendor",
      isEmailVerified: true,
    });

    createdVendor = await Vendor.create({
      userId: createdUser._id,
      businessName: "Filter Test Store",
      businessSlug: "filter-test-store",
      status: "approved",
      isActive: true,
      phone: "+919876543210",
      supportEmail: "vendor_filter_test@example.com",
    });

    createdCategory = await Category.create({
      name: "Electronics Test",
      slug: "electronics-test",
      isActive: true,
    });

    createdBrand = await Brand.create({
      name: "Brand Test",
      slug: "brand-test",
      isActive: true,
    });

    createdProduct = await Product.create({
      name: "Test Smartphone X",
      slug: "test-smartphone-x",
      sku: "TEST-PHONE-X-001",
      categoryId: createdCategory._id,
      brandId: createdBrand._id,
      vendorId: createdVendor._id,
      price: mongoose.Types.Decimal128.fromString("999.00"),
      status: "active",
      taxCategory: "standard",
    });
  });

  afterAll(async () => {
    if (createdProduct) await Product.deleteMany({ _id: createdProduct._id });
    if (createdCategory) await Category.deleteMany({ _id: createdCategory._id });
    if (createdBrand) await Brand.deleteMany({ _id: createdBrand._id });
    if (createdVendor) await Vendor.deleteMany({ _id: createdVendor._id });
    if (createdUser) await User.deleteMany({ _id: createdUser._id });
    await mongoose.connection.close();
  });

  it("1. gracefully handles non-existent slug categoryId without CastError (returns 200 OK with empty items)", async () => {
    const res = await request(app)
      .get("/api/v1/products?categoryId=mobiles&page=1&limit=12&sort=featured")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("2. resolves valid slug categoryId and returns matching products", async () => {
    const res = await request(app)
      .get(`/api/v1/products?categoryId=${createdCategory.slug}&page=1&limit=12`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].slug).toBe("test-smartphone-x");
  });

  it("3. resolves valid ObjectId categoryId directly", async () => {
    const res = await request(app)
      .get(`/api/v1/products?categoryId=${createdCategory._id}&page=1&limit=12`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("4. gracefully handles non-existent brand slug/name without CastError", async () => {
    const res = await request(app)
      .get("/api/v1/products?brandId=non-existent-brand&page=1&limit=12")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("5. resolves valid brand slug and returns matching products", async () => {
    const res = await request(app)
      .get(`/api/v1/products?brandId=${createdBrand.slug}&page=1&limit=12`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("6. resolves getProductById with slug fallback cleanly without 400 CastError", async () => {
    const res = await request(app)
      .get(`/api/v1/products/${createdProduct.slug}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.product.name).toBe("Test Smartphone X");
  });

  it("7. returns 404 PRODUCT_NOT_FOUND when non-existent slug is queried on /:id", async () => {
    const res = await request(app)
      .get("/api/v1/products/definitely-not-a-real-product-slug")
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });
});
