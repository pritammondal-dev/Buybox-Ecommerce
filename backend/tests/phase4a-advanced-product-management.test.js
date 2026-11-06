const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const SkuRegistry = require("../src/models/SkuRegistry");
const Permission = require("../src/models/Permission");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_phase4a_test$2")
  : "mongodb://127.0.0.1:27017/buybox_phase4a_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 4A — Advanced Product Management & Variable Creation Integration Tests", () => {
  let vendorA, vendorB, adminUser;
  let testCategory, testBrand, testWarehouse;
  let isolatedProduct;

  async function getOrCreatePermission(slug) {
    let perm = await Permission.findOne({ slug });
    if (!perm) {
      perm = await Permission.create({
        slug,
        name: `Perm ${slug}`,
        module: slug.split(":")[0],
        description: `Description for ${slug}`,
        isActive: true,
      });
    }
    return perm;
  }

  async function createTestVendor(label = "vendor") {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: "Vendor",
      lastName: label,
      email: `${label}_${Date.now()}_${rand}@phase4a-test.com`,
      password: "Password123!",
      role: ROLES.VENDOR,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `Store ${label} ${Date.now()}`,
      businessSlug: `store-${label}-${Date.now()}-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, vendor, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await SkuRegistry.syncIndexes();
    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    const permSlugs = [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.PRODUCTS_MODERATE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
    ];
    for (const slug of permSlugs) {
      await getOrCreatePermission(slug);
    }

    vendorA = await createTestVendor("vendorA");
    vendorB = await createTestVendor("vendorB");

    // Admin user
    const adminUserDoc = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@phase4a-test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    const adminToken = generateAccessToken({
      sub: adminUserDoc._id.toString(),
      role: adminUserDoc.role,
      authVersion: adminUserDoc.authVersion,
      permissionVersion: adminUserDoc.permissionVersion,
    });
    adminUser = { user: adminUserDoc, token: adminToken };

    testCategory = await Category.create({
      name: `Phase 4A Category ${Date.now()}`,
      slug: `p4a-cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Phase 4A Brand ${Date.now()}`,
      slug: `p4a-brand-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Phase 4A Central Hub",
      code: `WH-P4A-${Date.now()}-${Math.random().toString(36).substring(7)}`.toUpperCase().slice(0, 25),
      isActive: true,
      address: {
        addressLine1: "100 Warehouse Rd",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    });

    // Create an isolated product for ownership tests
    const isoRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${vendorA.token}`)
      .send({
        name: "Vendor A Isolated Product",
        slug: `p4a-vend-iso-${Date.now()}`,
        sku: `P4A-VEND-ISO-${Date.now()}`,
        productType: "simple",
        categoryId: testCategory._id.toString(),
        price: 500,
      });
    isolatedProduct = isoRes.body.data?.product || isoRes.body.data;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // 1. Simple Product Lifecycle & Canonical Variant Preservation
  describe("1. Simple Product Lifecycle & Canonical Default Variant", () => {
    let createdProduct;

    test("creates simple product with canonical default variant and SEO metadata", async () => {
      const sku = `P4A-SMP-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Organic Cotton T-Shirt",
          slug: `organic-cotton-tshirt-${Date.now()}`,
          sku,
          productType: "simple",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          price: 799,
          compareAtPrice: 1199,
          description: "Comfortable organic cotton tee",
          seo: {
            title: "Organic Cotton T-Shirt | Buybox",
            description: "High quality breathable tee",
            keywords: ["t-shirt", "cotton", "organic"],
          },
        });

      expect(res.status).toBe(201);
      const product = res.body.data?.product || res.body.data;
      expect(product).toBeDefined();
      expect(product.sku).toBe(sku);
      expect(product.productType).toBe("simple");
      expect(product.seo.title).toBe("Organic Cotton T-Shirt | Buybox");

      createdProduct = product;

      // Verify canonical variant was created
      const variants = await ProductVariant.find({ productId: product._id, deletedAt: null });
      expect(variants.length).toBe(1);
      expect(variants[0].isDefault).toBe(true);
      expect(variants[0].sku).toBe(sku);
    });

    test("repeated editing does not duplicate default variant", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${createdProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Organic Cotton T-Shirt (Updated Name)",
          price: 849,
          compareAtPrice: 1249,
          seo: {
            title: "Updated Organic Cotton T-Shirt | Buybox",
            description: "Updated description",
            keywords: ["t-shirt", "organic"],
          },
        });

      expect(res.status).toBe(200);

      // Verify still exactly one default variant
      const variants = await ProductVariant.find({ productId: createdProduct._id, deletedAt: null });
      expect(variants.length).toBe(1);
      expect(variants[0].isDefault).toBe(true);
      expect(Number(variants[0].price.toString())).toBe(849);
    });

    test("rejects price when compareAtPrice is strictly less than price", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${createdProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          price: 1000,
          compareAtPrice: 500, // Invalid: compareAtPrice must be >= price
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // 2. Variable Product Creation & Combination Generator Integration
  describe("2. Variable Product Creation & Combinations", () => {
    let variableProduct;

    test("creates variable product with multiple variants", async () => {
      const parentSku = `P4A-VAR-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Premium Linen Shirt",
          slug: `premium-linen-shirt-${Date.now()}`,
          sku: parentSku,
          productType: "variable",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          price: 1499,
          compareAtPrice: 1999,
          description: "Comfortable breathable linen shirt in various sizes and colors",
        });

      expect(res.status).toBe(201);
      variableProduct = res.body.data?.product || res.body.data;
      expect(variableProduct.productType).toBe("variable");

      // Add two distinct variants using canonical route
      const var1Res = await request(app)
        .post(`/api/v1/product-variants/product/${variableProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `${parentSku}-BLK-M`,
          price: 1499,
          compareAtPrice: 1999,
          attributes: { Color: "Black", Size: "M" },
        });
      expect(var1Res.status).toBe(201);

      const var2Res = await request(app)
        .post(`/api/v1/product-variants/product/${variableProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `${parentSku}-WHT-L`,
          price: 1599,
          compareAtPrice: 2099,
          attributes: { Color: "White", Size: "L" },
        });
      expect(var2Res.status).toBe(201);
    });

    test("rejects duplicate variant attribute combination", async () => {
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${variableProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `${variableProduct.sku}-DUP-1`,
          price: 1499,
          attributes: { Color: "Black", Size: "M" }, // duplicate combo
        });

      expect(res.status).toBe(409);
    });

    test("rejects duplicate variant SKU", async () => {
      const existingVariant = await ProductVariant.findOne({
        productId: variableProduct._id,
        deletedAt: null,
      });

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${variableProduct._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: existingVariant.sku, // duplicate SKU
          price: 1499,
          attributes: { Color: "Blue", Size: "XL" },
        });

      expect(res.status).toBe(409);
    });

    test("prevents activating or publishing variable product without valid variants", async () => {
      const parentSku = `P4A-NOVAR-${Date.now()}`;
      const emptyVarProdRes = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Empty Variable Product",
          slug: `empty-var-prod-${Date.now()}`,
          sku: parentSku,
          productType: "variable",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          price: 1999,
          description: "Variable product without any variants yet",
        });

      expect(emptyVarProdRes.status).toBe(201);
      const emptyVarProd = emptyVarProdRes.body.data?.product || emptyVarProdRes.body.data;

      // Attempting to submit for approval without variants must fail
      const submitRes = await request(app)
        .post(`/api/v1/products/${emptyVarProd._id}/submit`)
        .set("Authorization", `Bearer ${vendorA.token}`);

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.message).toMatch(/without at least one active variant/i);

      // Attempting direct activation by admin without variants must fail
      const activateRes = await request(app)
        .patch(`/api/v1/products/${emptyVarProd._id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ status: "active" });

      expect(activateRes.status).toBe(400);
      expect(activateRes.body.message).toMatch(/without at least one active variant/i);
    });
  });

  // 3. Bulk Variation Management
  describe("3. Bulk Variation Management", () => {
    test("supports bulk update with image and price adjustments", async () => {
      const parentSku = `P4A-BULK-${Date.now()}`;
      const prodRes = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          name: "Bulk Test Hoodies",
          slug: `bulk-test-hoodies-${Date.now()}`,
          sku: parentSku,
          productType: "variable",
          categoryId: testCategory._id.toString(),
          price: 2000,
        });

      const prod = prodRes.body.data?.product || prodRes.body.data;

      // Create 2 variants
      const v1Res = await request(app)
        .post(`/api/v1/product-variants/product/${prod._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `${parentSku}-S`,
          price: 2000,
          attributes: { Size: "S" },
        });
      const v2Res = await request(app)
        .post(`/api/v1/product-variants/product/${prod._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `${parentSku}-M`,
          price: 2000,
          attributes: { Size: "M" },
        });

      const v1Id = v1Res.body.data.variant._id;
      const v2Id = v2Res.body.data.variant._id;

      // Bulk update variants
      const bulkRes = await request(app)
        .patch(`/api/v1/product-variants/product/${prod._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          updates: [
            {
              id: v1Id,
              price: 2200,
              compareAtPrice: 2800,
              image: {
                url: "https://buybox.test/uploads/hoodie-s.jpg",
                altText: "Small Hoodie",
              },
            },
            {
              id: v2Id,
              price: 2400,
              compareAtPrice: 2900,
              image: {
                url: "https://buybox.test/uploads/hoodie-m.jpg",
                altText: "Medium Hoodie",
              },
            },
          ],
        });

      expect(bulkRes.status).toBe(200);

      // Verify changes persisted
      const updatedV1 = await ProductVariant.findById(v1Id);
      expect(Number(updatedV1.price.toString())).toBe(2200);
      expect(Number(updatedV1.compareAtPrice.toString())).toBe(2800);
      expect(updatedV1.image.url).toBe("https://buybox.test/uploads/hoodie-s.jpg");

      const updatedV2 = await ProductVariant.findById(v2Id);
      expect(Number(updatedV2.price.toString())).toBe(2400);
      expect(updatedV2.image.url).toBe("https://buybox.test/uploads/hoodie-m.jpg");
    });
  });

  // 4. Image Upload Endpoint
  describe("4. Image Upload Endpoint", () => {
    test("uploads image file and returns public url", async () => {
      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      );

      const res = await request(app)
        .post("/api/v1/products/images/upload")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .attach("image", pngBuffer, "sample.png");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toMatch(/^\/uploads\//);
      expect(res.body.data.altText).toBe("sample");
    });

    test("rejects invalid non-image file uploads", async () => {
      const textBuffer = Buffer.from("Hello world, not an image!");

      const res = await request(app)
        .post("/api/v1/products/images/upload")
        .set("Authorization", `Bearer ${vendorA.token}`)
        .attach("image", textBuffer, "document.txt");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // 5. Vendor Ownership & Admin Authorization Guardrails
  describe("5. Vendor Ownership & Admin Authorization Guardrails", () => {
    test("vendor B cannot modify vendor A product", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${isolatedProduct._id}`)
        .set("Authorization", `Bearer ${vendorB.token}`)
        .send({
          name: "Vendor B Malicious Takeover",
        });

      expect(res.status).toBe(403);
    });

    test("admin can update product status directly", async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${isolatedProduct._id}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          status: "active",
        });

      expect(res.status).toBe(200);
      const updated = await Product.findById(isolatedProduct._id);
      expect(updated.status).toBe("active");
    });
  });
});
