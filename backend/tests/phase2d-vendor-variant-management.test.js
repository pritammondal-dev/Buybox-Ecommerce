const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Customer = require("../src/models/Customer");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const Permission = require("../src/models/Permission");
const Order = require("../src/models/Order");
const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");
const productVariantService = require("../src/services/product-variant.service");
const productService = require("../src/services/product.service");
const inventoryService = require("../src/services/inventory.service");
const {
  normalizeVariantAttributes,
  serializeAttributeCombination,
  combinationsAreEqual,
} = require("../src/utils/attribute.util");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2d_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2d_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2D — Vendor Variant Management & SKU Control Integration", () => {
  let vendorA, vendorB, customerUser, adminUser;
  let testCategory, testBrand, testWarehouse, inactiveWarehouse;

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
      email: `${label}_${Date.now()}_${rand}@phase2d-test.com`,
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

    await Product.syncIndexes();
    await ProductVariant.syncIndexes();

    const permSlugs = [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
    ];
    for (const slug of permSlugs) {
      await getOrCreatePermission(slug);
    }

    testCategory = await Category.create({
      name: `Category Phase2D ${Date.now()}`,
      slug: `cat-phase2d-${Date.now()}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Brand Phase2D ${Date.now()}`,
      slug: `brand-phase2d-${Date.now()}`,
      isActive: true,
    });

    testWarehouse = await Warehouse.create({
      name: "Phase 2D Active Fulfillment Center",
      code: `WH-2D-ACT-${Date.now()}`,
      address: {
        addressLine1: "100 Warehouse Way",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    inactiveWarehouse = await Warehouse.create({
      name: "Phase 2D Inactive Center",
      code: `WH-2D-INACT-${Date.now()}`,
      address: {
        addressLine1: "200 Closed Lane",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: false,
    });

    vendorA = await createTestVendor("vendora");
    vendorB = await createTestVendor("vendorb");

    const custRand = Math.random().toString(36).substring(7);
    const custUser = await User.create({
      firstName: "Cust",
      lastName: "Tester",
      email: `cust_${Date.now()}_${custRand}@phase2d-test.com`,
      password: "Password123!",
      role: ROLES.CUSTOMER,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    customerUser = {
      user: custUser,
      token: generateAccessToken({
        sub: custUser._id.toString(),
        role: custUser.role,
        authVersion: custUser.authVersion,
        permissionVersion: custUser.permissionVersion,
      }),
    };

    const admRand = Math.random().toString(36).substring(7);
    const admUser = await User.create({
      firstName: "Admin",
      lastName: "Tester",
      email: `admin_${Date.now()}_${admRand}@phase2d-test.com`,
      password: "Password123!",
      role: ROLES.ADMIN,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
    adminUser = {
      user: admUser,
      token: generateAccessToken({
        sub: admUser._id.toString(),
        role: admUser.role,
        authVersion: admUser.authVersion,
        permissionVersion: admUser.permissionVersion,
      }),
    };
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@phase2d-test\.com$/ });
    await Category.deleteMany({ _id: testCategory._id });
    await Brand.deleteMany({ _id: testBrand._id });
    await Warehouse.deleteMany({ _id: { $in: [testWarehouse._id, inactiveWarehouse._id] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // 1. Product Type & Attributes
  // =========================================================================
  describe("1. Product Type & Attributes", () => {
    test("1. Simple product edits preserve the canonical default variant identity and sync fields", async () => {
      const sku = `SMPL-PROD-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Simple Test Product",
          slug: `simple-test-${Date.now()}`,
          sku,
          price: "499.00",
          categoryId: testCategory._id.toString(),
          brandId: testBrand._id.toString(),
          productType: "simple",
          stockQuantity: 20,
          warehouseId: testWarehouse._id.toString(),
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const defaultVariant = await ProductVariant.findOne({
        productId: product._id,
        isDefault: true,
        deletedAt: null,
      });
      expect(defaultVariant).toBeDefined();
      expect(defaultVariant.sku).toBe(sku);

      // Edit simple product price and name
      const updatedProduct = await productService.updateProduct({
        id: product._id.toString(),
        data: {
          name: "Updated Simple Title",
          price: "599.00",
        },
        actor: vendorA.user,
      });

      // Confirm default variant retained same identity and updated fields
      const refreshedVariant = await ProductVariant.findById(defaultVariant._id);
      expect(refreshedVariant._id.toString()).toBe(defaultVariant._id.toString());
      expect(refreshedVariant.name).toBe("Updated Simple Title");
      expect(Number(refreshedVariant.price.toString())).toBe(599);

      // Confirm no duplicate variants were provisioned
      const variantCount = await ProductVariant.countDocuments({
        productId: product._id,
        deletedAt: null,
      });
      expect(variantCount).toBe(1);
    });

    test("2. Variable products can define valid attributes and combinations", async () => {
      const parentSku = `VAR-PARENT-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Variable Parent Product",
          slug: `var-parent-${Date.now()}`,
          sku: parentSku,
          price: "999.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
          stockQuantity: 0,
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const var1 = await productVariantService.createProductVariant({
        data: {
          productId: product._id.toString(),
          sku: `${parentSku}-RED-M`,
          name: "Red Medium",
          price: "899.00",
          attributes: { Color: "Red", Size: "M" },
          warehouseId: testWarehouse._id.toString(),
          stockQuantity: 15,
        },
        actor: vendorA.user,
      });

      expect(var1).toBeDefined();
      expect(var1.sku).toBe(`${parentSku}-RED-M`);
      expect(var1.attributes.get("Color") || var1.attributes.Color).toBe("Red");

      // Verify parent product minimum price synchronized
      const parentAfter = await Product.findById(product._id);
      expect(Number(parentAfter.price.toString())).toBe(899);
    });

    test("3. Combination generation produces the expected set of variants via bulk creation", async () => {
      const parentSku = `VAR-BULK-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Bulk Matrix Product",
          slug: `bulk-matrix-${Date.now()}`,
          sku: parentSku,
          price: "1000.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      // 2 sizes x 2 colors = 4 combinations
      const combinations = [
        { sku: `${parentSku}-BLK-S`, attributes: { Color: "Black", Size: "S" }, price: "1100.00" },
        { sku: `${parentSku}-BLK-M`, attributes: { Color: "Black", Size: "M" }, price: "1150.00" },
        { sku: `${parentSku}-WHT-S`, attributes: { Color: "White", Size: "S" }, price: "1200.00" },
        { sku: `${parentSku}-WHT-M`, attributes: { Color: "White", Size: "M" }, price: "1250.00" },
      ];

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ variants: combinations })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variants.length).toBe(4);

      // Parent price reflects min variant price (1100.00)
      const parentDoc = await Product.findById(product._id);
      expect(Number(parentDoc.price.toString())).toBe(1100);
    });

    test("4. Duplicate combinations are rejected across creates and within bulk batches", async () => {
      const parentSku = `VAR-DUPCOMBO-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Duplicate Combo Product",
          slug: `dup-combo-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      // Create initial combination: { Size: "L", Color: "Blue" }
      await productVariantService.createProductVariant({
        data: {
          productId: product._id.toString(),
          sku: `${parentSku}-BLU-L`,
          price: "500.00",
          attributes: { Size: "L", Color: "Blue" },
        },
        actor: vendorA.user,
      });

      // Attempt creating identical combination with different case/order: { color: "blue", size: "l" }
      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: product._id.toString(),
            sku: `${parentSku}-BLU-L-DUP`,
            price: "550.00",
            attributes: { color: "blue", size: "l" },
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "DUPLICATE_VARIANT_COMBINATION",
      });

      // In bulk payload: duplicate combination inside batch
      const bulkRes = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          variants: [
            { sku: `${parentSku}-RED-S1`, attributes: { Size: "S", Color: "Red" }, price: "500.00" },
            { sku: `${parentSku}-RED-S2`, attributes: { Color: "Red", Size: "S" }, price: "520.00" },
          ],
        })
        .expect(400);

      expect(bulkRes.body.code).toBe("DUPLICATE_PAYLOAD_COMBINATION");
    });

    test("5. Excessive combination generation is blocked safely (> 100 variants limit)", async () => {
      const parentSku = `VAR-EXCESS-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Excessive Matrix Product",
          slug: `excessive-matrix-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const excessBatch = [];
      for (let i = 0; i < 105; i++) {
        excessBatch.push({
          sku: `${parentSku}-VAR-${i}`,
          attributes: { Option: `Val-${i}` },
          price: "500.00",
        });
      }

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ variants: excessBatch })
        .expect(400);

      expect(["EXCESSIVE_COMBINATIONS", "VALIDATION_ERROR"]).toContain(res.body.code);
    });

    test("6. Attribute normalization supports existing object, Map, and legacy array formats", () => {
      // 1. Plain Object
      const plain = { Size: "XL", Material: "Cotton " };
      expect(normalizeVariantAttributes(plain)).toEqual({ Size: "XL", Material: "Cotton" });

      // 2. Mongoose / ES6 Map
      const map = new Map([
        ["Color", "Red"],
        ["Capacity", "64GB"],
      ]);
      expect(normalizeVariantAttributes(map)).toEqual({ Color: "Red", Capacity: "64GB" });

      // 3. Legacy Array of objects
      const legacyArr = [
        { name: "Size", value: "Large" },
        { key: "Color", value: "Black" },
        { attributeName: "Fit", attributeValue: "Slim" },
      ];
      expect(normalizeVariantAttributes(legacyArr)).toEqual({
        Size: "Large",
        Color: "Black",
        Fit: "Slim",
      });

      // Canonical serialization equivalence
      expect(
        combinationsAreEqual({ Color: "Red", Size: "M" }, new Map([["size", "m"], ["color", "red"]]))
      ).toBe(true);
    });

    test("7. Invalid product type transitions are rejected (variable with active variants to simple)", async () => {
      const parentSku = `VAR-TRANS-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Transition Test Product",
          slug: `trans-test-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: `${parentSku}-V1`, price: "500.00", attributes: { Color: "A" } },
        actor: vendorA.user,
      });
      await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: `${parentSku}-V2`, price: "600.00", attributes: { Color: "B" } },
        actor: vendorA.user,
      });

      // Attempt converting variable with 2 active variants to simple
      await expect(
        productService.updateProduct({
          id: product._id.toString(),
          data: { productType: "simple" },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_PRODUCT_TYPE_TRANSITION",
      });
    });

    test("8. Variant edits preserve existing identity when appropriate", async () => {
      const parentSku = `VAR-IDEN-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Identity Product",
          slug: `identity-prod-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const variant = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: `${parentSku}-V1`, price: "500.00", name: "Initial Label" },
        actor: vendorA.user,
      });

      const updated = await productVariantService.updateProductVariant({
        id: variant._id.toString(),
        data: { name: "Renamed Variant Label", price: "550.00" },
        actor: vendorA.user,
      });

      expect(updated._id.toString()).toBe(variant._id.toString());
      expect(updated.name).toBe("Renamed Variant Label");
      expect(Number(updated.price.toString())).toBe(550);
    });
  });

  // =========================================================================
  // 2. SKU Integrity
  // =========================================================================
  describe("2. SKU Integrity", () => {
    test("9. A valid unique SKU can be assigned to a variant", async () => {
      const parentSku = `VAR-UNIQSKU-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Unique SKU Product",
          slug: `unique-sku-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const uniqueSku = `${parentSku}-CUSTOM-SKU-100`;
      const variant = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: uniqueSku, price: "500.00" },
        actor: vendorA.user,
      });

      expect(variant.sku).toBe(uniqueSku);
    });

    test("10. Duplicate active SKUs are rejected across Product and ProductVariant collections", async () => {
      const existingParentSku = `VAR-EXISTING-SKU-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Existing SKU Product",
          slug: `existing-sku-prod-${Date.now()}`,
          sku: existingParentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      // Attempt creating a variant with the exact parent SKU
      await expect(
        productVariantService.createProductVariant({
          data: { productId: product._id.toString(), sku: existingParentSku, price: "500.00" },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PRODUCT_SKU_ALREADY_EXISTS",
      });
    });

    test("11. Unchanged SKUs can be retained during variant edits", async () => {
      const parentSku = `VAR-RETAINSKU-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Retain SKU Product",
          slug: `retain-sku-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const varSku = `${parentSku}-V1`;
      const variant = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: varSku, price: "500.00" },
        actor: vendorA.user,
      });

      // Update variant sending the exact same SKU
      const updated = await productVariantService.updateProductVariant({
        id: variant._id.toString(),
        data: { sku: varSku, price: "525.00" },
        actor: vendorA.user,
      });

      expect(updated.sku).toBe(varSku);
      expect(Number(updated.price.toString())).toBe(525);
    });

    test("12. Soft-deleted SKU reuse follows the established contract", async () => {
      const parentSku = `VAR-SOFTDELSKU-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Soft Delete Product",
          slug: `softdel-sku-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const recyclableSku = `${parentSku}-RECYCLE`;
      const variant1 = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: recyclableSku, price: "500.00" },
        actor: vendorA.user,
      });

      // Soft delete variant1
      await productVariantService.deleteProductVariant({
        id: variant1._id.toString(),
        actor: vendorA.user,
      });

      // Create new variant reusing the recyclable SKU
      const variant2 = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: recyclableSku, price: "600.00" },
        actor: vendorA.user,
      });

      expect(variant2).toBeDefined();
      expect(variant2._id.toString()).not.toBe(variant1._id.toString());
      expect(variant2.sku).toBe(recyclableSku);
    });

    test("14. SKU validation failures in bulk create do not leave partial mutations", async () => {
      const parentSku = `VAR-ATOMICSKU-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Atomic SKU Product",
          slug: `atomic-sku-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      // Colliding SKU that already exists elsewhere
      const existingProduct = await productService.createProduct({
        data: {
          name: "Colliding Target",
          slug: `colliding-target-${Date.now()}`,
          sku: `EXISTING-GLOBAL-COLLISION-${Date.now()}`.toUpperCase(),
          price: "100.00",
          categoryId: testCategory._id.toString(),
        },
        userId: vendorB.user._id,
        actor: vendorB.user,
      });

      const batch = [
        { sku: `${parentSku}-VALID-1`, price: "100.00", attributes: { A: "1" } },
        { sku: existingProduct.sku, price: "100.00", attributes: { A: "2" } }, // Duplicate!
      ];

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ variants: batch })
        .expect(409);

      expect(res.body.code).toBe("SKU_COLLISION");

      // Verify VALID-1 was not persisted
      const checkValid = await ProductVariant.findOne({ sku: `${parentSku}-VALID-1` });
      expect(checkValid).toBeNull();
    });
  });

  // =========================================================================
  // 3. Inventory & Warehouse Integration
  // =========================================================================
  describe("3. Inventory & Warehouse Integration", () => {
    test("15. Vendor inventory reads respect ownership", async () => {
      const productA = await productService.createProduct({
        data: {
          name: "Vendor A Inventory Item",
          slug: `vendor-a-inv-${Date.now()}`,
          sku: `VA-INV-${Date.now()}`.toUpperCase(),
          price: "200.00",
          categoryId: testCategory._id.toString(),
          stockQuantity: 10,
          warehouseId: testWarehouse._id.toString(),
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const defaultVarA = await ProductVariant.findOne({ productId: productA._id, isDefault: true });

      // Vendor A retrieves inventory for own variant -> 200 OK
      const resA = await request(app)
        .get(`/api/v1/inventory/variant/${defaultVarA._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .expect(200);

      expect(resA.body.success).toBe(true);

      // Vendor B attempts to read Vendor A's variant inventory -> 403 INVENTORY_ACCESS_DENIED
      const resB = await request(app)
        .get(`/api/v1/inventory/variant/${defaultVarA._id}`)
        .set("Authorization", `Bearer ${vendorB.token}`)
        .expect(403);

      expect(resB.body.code).toBe("INVENTORY_ACCESS_DENIED");
    });

    test("16. Vendor stock adjustments use the authoritative inventory service", async () => {
      const parentSku = `VAR-ADJUST-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Adjustable Product",
          slug: `adjustable-prod-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const variant = await productVariantService.createProductVariant({
        data: {
          productId: product._id.toString(),
          sku: `${parentSku}-V1`,
          price: "500.00",
          warehouseId: testWarehouse._id.toString(),
          stockQuantity: 10,
        },
        actor: vendorA.user,
      });

      const inv = await Inventory.findOne({
        productVariantId: variant._id,
        warehouseId: testWarehouse._id,
      });

      // Vendor A adjusts physical inventory by +5
      const res = await request(app)
        .patch(`/api/v1/inventory/${inv._id}/adjust`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({ quantity: 5, notes: "Received 5 additional physical units" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory.onHand).toBe(15);

      // Confirm an authoritative InventoryTransaction record was logged
      const tx = await InventoryTransaction.findOne({
        productVariantId: variant._id,
        type: "adjustment",
      }).sort({ createdAt: -1 });

      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(5);
      expect(tx.onHandAfter).toBe(15);
    });

    test("18. Ineligible (inactive) warehouses are rejected on variant creation", async () => {
      const parentSku = `VAR-INELIGIBLE-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Ineligible WH Product",
          slug: `ineligible-wh-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      await expect(
        productVariantService.createProductVariant({
          data: {
            productId: product._id.toString(),
            sku: `${parentSku}-FAIL`,
            price: "500.00",
            warehouseId: inactiveWarehouse._id.toString(),
            stockQuantity: 10,
          },
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INELIGIBLE_WAREHOUSE",
      });
    });

    test("20. Variants with outstanding reservations cannot be deleted unsafely", async () => {
      const parentSku = `VAR-RESERV-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Reserved Product",
          slug: `reserved-prod-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const variant = await productVariantService.createProductVariant({
        data: {
          productId: product._id.toString(),
          sku: `${parentSku}-V1`,
          price: "500.00",
          warehouseId: testWarehouse._id.toString(),
          stockQuantity: 10,
        },
        actor: vendorA.user,
      });

      // Simulate active order reservation on inventory
      await Inventory.updateOne(
        { productVariantId: variant._id, warehouseId: testWarehouse._id },
        { $set: { reserved: 2 } }
      );

      // Attempt deleting variant with active reservations
      await expect(
        productVariantService.deleteProductVariant({
          id: variant._id.toString(),
          actor: vendorA.user,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CANNOT_DELETE_VARIANT_WITH_RESERVATIONS",
      });
    });

    test("21. Repeated provisioning does not create duplicate inventory records", async () => {
      const parentSku = `VAR-NODUPINV-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "No Dup Inventory Product",
          slug: `nodup-inv-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const variant = await productVariantService.createProductVariant({
        data: {
          productId: product._id.toString(),
          sku: `${parentSku}-V1`,
          price: "500.00",
          warehouseId: testWarehouse._id.toString(),
          stockQuantity: 10,
        },
        actor: vendorA.user,
      });

      // Directly attempt creating a duplicate inventory record for same variant + warehouse
      await expect(
        inventoryService.createInventory({
          productVariantId: variant._id.toString(),
          warehouseId: testWarehouse._id.toString(),
          onHand: 5,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVENTORY_ALREADY_EXISTS",
      });

      const count = await Inventory.countDocuments({
        productVariantId: variant._id,
        warehouseId: testWarehouse._id,
      });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 4. Bulk Operations & Authorization
  // =========================================================================
  describe("4. Bulk Operations & Authorization", () => {
    test("24. Bulk SKU errors identify the affected row and SKU", async () => {
      const parentSku = `VAR-BULKERR-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Bulk Error Product",
          slug: `bulk-err-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          variants: [
            { sku: `${parentSku}-V1`, price: "100.00", attributes: { Color: "A" } },
            { sku: `${parentSku}-V1`, price: "200.00", attributes: { Color: "B" } }, // Duplicate SKU at row 2
          ],
        })
        .expect(400);

      expect(res.body.code).toBe("DUPLICATE_PAYLOAD_SKU");
      expect(res.body.message).toContain("row 2");
    });

    test("26. Vendors cannot edit or add variants to another vendor's product", async () => {
      const productB = await productService.createProduct({
        data: {
          name: "Vendor B Product",
          slug: `vendor-b-prod-${Date.now()}`,
          sku: `VB-PROD-${Date.now()}`.toUpperCase(),
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorB.user._id,
        actor: vendorB.user,
      });

      // Vendor A attempts creating variant under Vendor B's product
      const res = await request(app)
        .post(`/api/v1/product-variants/product/${productB._id}`)
        .set("Authorization", `Bearer ${vendorA.token}`)
        .send({
          sku: `VA-INTRUDER-${Date.now()}`.toUpperCase(),
          price: "100.00",
        })
        .expect(403);

      expect(res.body.code).toBe("PRODUCT_OWNERSHIP_REQUIRED");
    });

    test("27. Unauthorized customers cannot mutate inventory or create variants", async () => {
      const parentSku = `VAR-UNAUTH-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Unauth Test Product",
          slug: `unauth-prod-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const res = await request(app)
        .post(`/api/v1/product-variants/product/${product._id}`)
        .set("Authorization", `Bearer ${customerUser.token}`)
        .send({
          sku: `${parentSku}-CUST-FAIL`,
          price: "100.00",
        })
        .expect(403);

      expect(res.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    test("28. Admin can perform bulk updates across vendor variants", async () => {
      const parentSku = `VAR-ADMINBULK-${Date.now()}`.toUpperCase();
      const product = await productService.createProduct({
        data: {
          name: "Admin Bulk Product",
          slug: `admin-bulk-${Date.now()}`,
          sku: parentSku,
          price: "500.00",
          categoryId: testCategory._id.toString(),
          productType: "variable",
        },
        userId: vendorA.user._id,
        actor: vendorA.user,
      });

      const v1 = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: `${parentSku}-V1`, price: "100.00" },
        actor: vendorA.user,
      });
      const v2 = await productVariantService.createProductVariant({
        data: { productId: product._id.toString(), sku: `${parentSku}-V2`, price: "200.00" },
        actor: vendorA.user,
      });

      // Admin executes bulk PATCH on variants
      const res = await request(app)
        .patch(`/api/v1/product-variants/product/${product._id}/bulk`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          updates: [
            { id: v1._id.toString(), price: "150.00" },
            { id: v2._id.toString(), price: "250.00" },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.variants.length).toBe(2);

      const checkV1 = await ProductVariant.findById(v1._id);
      expect(Number(checkV1.price.toString())).toBe(150);
    });
  });
});
