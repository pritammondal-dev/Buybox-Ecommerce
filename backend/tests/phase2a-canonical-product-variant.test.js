const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const cartService = require("../src/services/cart.service");
const withTransaction = require("../src/utils/withTransaction");
const { createProductSchema } = require("../src/validators/catalog/product.validator");
const { updateProductSchema } = require("../src/validators/catalog/update-product.validator");
const { createProductVariantSchema } = require("../src/validators/catalog/product-variant.validator");
const { updateProductVariantSchema } = require("../src/validators/catalog/update-product-variant.validator");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace("/buybox?", "/buybox_phase2a_test?")
  : "mongodb://127.0.0.1:27017/buybox_phase2a_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2A — Canonical Product/Variant Model & Backend Alignment", () => {
  let testCategory;
  let testWarehouse;
  let vendorA;
  let vendorB;
  let adminUser;

  async function createTestVendor(name) {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: name,
      lastName: "Vendor",
      email: `${name.toLowerCase()}_${Date.now()}_${rand}@phase2a-test.com`,
      password: "Password123!",
      role: "vendor",
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });

    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `${name} Business ${rand}`,
      businessSlug: `${name.toLowerCase()}-biz-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });

    return { user, vendor };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    testWarehouse = await Warehouse.create({
      name: "Phase 2A Test Hub",
      code: `P2A-WH-${Date.now()}`,
      address: {
        addressLine1: "1 Warehouse St",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
      isActive: true,
    });

    testCategory = await Category.create({
      name: `Phase2A Category ${Date.now()}`,
      slug: `p2a-cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    vendorA = await createTestVendor("VendorA");
    vendorB = await createTestVendor("VendorB");

    adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@phase2a-test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@phase2a-test\.com$/ });
      await Vendor.deleteMany({ businessSlug: /^vendora-biz-|^vendorb-biz-/ });
      await Category.deleteMany({ slug: /^p2a-cat-/ });
      await Warehouse.deleteMany({ code: /^P2A-WH-/ });
      await Product.deleteMany({ sku: /^P2A-/ });
      await ProductVariant.deleteMany({ sku: /^P2A-/ });
      await Cart.deleteMany({});
      await Order.deleteMany({});
      await Customer.deleteMany({});
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Simple product creates exactly one canonical default variant
  // -------------------------------------------------------------------------
  test("1. Simple product creates exactly one canonical default variant", async () => {
    const sku = `P2A-SMP-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Canonical Simple Product",
        slug: `canonical-simple-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1299.00",
        compareAtPrice: "1599.00",
        productType: "simple",
        stockQuantity: 25,
        dimensions: { length: 20, width: 15, height: 5, unit: "cm" },
        weight: { value: 0.5, unit: "kg" },
        shippingClass: "standard-parcel",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    expect(product).toBeDefined();
    expect(product.productType).toBe("simple");

    const variants = await ProductVariant.find({
      productId: product._id,
      deletedAt: null,
    });

    expect(variants).toHaveLength(1);
    const defaultVariant = variants[0];
    expect(defaultVariant.isDefault).toBe(true);
    expect(defaultVariant.sku).toBe(sku);
    expect(defaultVariant.price.toString()).toBe("1299.00");
    expect(defaultVariant.compareAtPrice.toString()).toBe("1599.00");
    expect(defaultVariant.stockQuantity).toBe(25);
    expect(defaultVariant.dimensions.length).toBe(20);
    expect(defaultVariant.shippingClass).toBe("standard-parcel");
  });

  // -------------------------------------------------------------------------
  // 2. Repeated creation requests do not duplicate default variants
  // -------------------------------------------------------------------------
  test("2. Repeated creation requests do not duplicate default variants", async () => {
    const sku = `P2A-SMP-IDEM-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Idempotent Simple Product",
        slug: `idempotent-simple-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "899.00",
        productType: "simple",
        stockQuantity: 10,
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    // Attempting same SKU throws 409
    await expect(
      productService.createProduct({
        data: {
          name: "Duplicate SKU Simple Product",
          slug: `dup-sku-simple-${Date.now()}`,
          sku,
          categoryId: testCategory._id.toString(),
          price: "899.00",
          productType: "simple",
        },
        userId: vendorA.user._id.toString(),
        actor: vendorA.user,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PRODUCT_SKU_ALREADY_EXISTS",
    });

    // Check count remains exactly 1
    const variants = await ProductVariant.find({
      productId: product._id,
      deletedAt: null,
    });
    expect(variants).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 3. Variable product creation preserves explicitly configured variants
  // -------------------------------------------------------------------------
  test("3. Variable product creation preserves explicitly configured variants", async () => {
    const parentSku = `P2A-VAR-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Variable Apparel Product",
        slug: `var-apparel-${Date.now()}`,
        sku: parentSku,
        categoryId: testCategory._id.toString(),
        price: "1999.00",
        productType: "variable",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    expect(product.productType).toBe("variable");

    // Variable product initially has 0 variants before configuration
    const initialVariants = await ProductVariant.find({
      productId: product._id,
      deletedAt: null,
    });
    expect(initialVariants).toHaveLength(0);

    // Create explicit variants
    const v1 = await productVariantService.createProductVariant({
      data: {
        productId: product._id.toString(),
        sku: `${parentSku}-BLK-S`,
        name: "Black / Small",
        attributes: { color: "Black", size: "S" },
        price: "1999.00",
        stockQuantity: 15,
      },
      actor: vendorA.user,
    });

    const v2 = await productVariantService.createProductVariant({
      data: {
        productId: product._id.toString(),
        sku: `${parentSku}-BLK-M`,
        name: "Black / Medium",
        attributes: { color: "Black", size: "M" },
        price: "2199.00",
        stockQuantity: 20,
      },
      actor: vendorA.user,
    });

    expect(v1.isDefault).toBe(false);
    expect(v2.isDefault).toBe(false);

    const afterVariants = await ProductVariant.find({
      productId: product._id,
      deletedAt: null,
    });
    expect(afterVariants).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 4. Product-to-variant relationships remain correct
  // -------------------------------------------------------------------------
  test("4. Product-to-variant relationships remain correct", async () => {
    const sku = `P2A-REL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Relationship Test Product",
        slug: `rel-product-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "499.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variants = await productVariantService.listProductVariants({
      productId: product._id.toString(),
      actor: vendorA.user,
    });

    expect(variants).toHaveLength(1);
    expect(variants[0].productId.toString()).toBe(product._id.toString());
  });

  // -------------------------------------------------------------------------
  // 5. Failed transactional provisioning leaves no partial product
  // -------------------------------------------------------------------------
  test("5. Failed transactional provisioning leaves no partial product", async () => {
    const sku = `P2A-TX-FAIL-${Date.now()}`;
    const slug = `tx-fail-${Date.now()}`;

    // We can simulate an error during transaction by forcing an invalid operation
    await expect(
      withTransaction(async (session) => {
        const product = await Product.create(
          [
            {
              name: "Will Rollback",
              slug,
              sku,
              categoryId: testCategory._id,
              vendorId: vendorA.vendor._id,
              price: mongoose.Types.Decimal128.fromString("500.00"),
              productType: "simple",
            },
          ],
          { session }
        );

        // Intentionally throw inside transaction
        throw new Error("Simulated transactional crash");
      })
    ).rejects.toThrow("Simulated transactional crash");

    // Verify parent product was rolled back completely
    const checkProduct = await Product.findOne({ sku });
    expect(checkProduct).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Invalid numeric inputs are rejected safely
  // -------------------------------------------------------------------------
  test("6. Invalid numeric inputs are rejected safely", () => {
    // Negative price
    expect(
      createProductSchema.safeParse({
        name: "Test",
        slug: "test-slug",
        sku: "TEST-SKU",
        categoryId: new mongoose.Types.ObjectId().toString(),
        price: -10,
      }).success
    ).toBe(false);

    // NaN price
    expect(
      createProductSchema.safeParse({
        name: "Test",
        slug: "test-slug",
        sku: "TEST-SKU",
        categoryId: new mongoose.Types.ObjectId().toString(),
        price: NaN,
      }).success
    ).toBe(false);

    // Negative stockQuantity
    expect(
      createProductSchema.safeParse({
        name: "Test",
        slug: "test-slug",
        sku: "TEST-SKU",
        categoryId: new mongoose.Types.ObjectId().toString(),
        price: 100,
        stockQuantity: -5,
      }).success
    ).toBe(false);

    // Negative dimensions
    expect(
      createProductSchema.safeParse({
        name: "Test",
        slug: "test-slug",
        sku: "TEST-SKU",
        categoryId: new mongoose.Types.ObjectId().toString(),
        price: 100,
        dimensions: { length: -1 },
      }).success
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. Valid numeric and string price inputs are normalized consistently
  // -------------------------------------------------------------------------
  test("7. Valid numeric and string price inputs are normalized consistently", () => {
    const parsedNumber = createProductSchema.parse({
      name: "Test",
      slug: "test-slug",
      sku: "TEST-SKU",
      categoryId: new mongoose.Types.ObjectId().toString(),
      price: 1499,
    });
    expect(parsedNumber.price).toBe("1499.00");

    const parsedFloat = createProductSchema.parse({
      name: "Test",
      slug: "test-slug",
      sku: "TEST-SKU",
      categoryId: new mongoose.Types.ObjectId().toString(),
      price: 1499.5,
    });
    expect(parsedFloat.price).toBe("1499.50");

    const parsedString = createProductSchema.parse({
      name: "Test",
      slug: "test-slug",
      sku: "TEST-SKU",
      categoryId: new mongoose.Types.ObjectId().toString(),
      price: "1499.99",
    });
    expect(parsedString.price).toBe("1499.99");
  });

  // -------------------------------------------------------------------------
  // 8. Parent/variant price behavior follows documented contract
  // -------------------------------------------------------------------------
  test("8. Parent/variant price behavior follows documented contract", async () => {
    // Simple product price update syncs to canonical default variant
    const sku = `P2A-SYNC-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Price Sync Product",
        slug: `price-sync-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1000.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const updated = await productService.updateProduct({
      id: product._id.toString(),
      data: { price: 1250 },
      actor: vendorA.user,
    });

    expect(updated.price.toString()).toBe("1250.00");
    const variant = await ProductVariant.findOne({
      productId: product._id,
      isDefault: true,
      deletedAt: null,
    });
    expect(variant.price.toString()).toBe("1250.00");

    // Variable product parent display price reflects min variant price
    const varSku = `P2A-VAR-SYNC-${Date.now()}`;
    const varProduct = await productService.createProduct({
      data: {
        name: "Variable Min Price Product",
        slug: `var-min-price-${Date.now()}`,
        sku: varSku,
        categoryId: testCategory._id.toString(),
        price: "3000.00",
        productType: "variable",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    await productVariantService.createProductVariant({
      data: {
        productId: varProduct._id.toString(),
        sku: `${varSku}-1`,
        name: "Variant 1",
        price: "2500.00",
      },
      actor: vendorA.user,
    });

    await productVariantService.createProductVariant({
      data: {
        productId: varProduct._id.toString(),
        sku: `${varSku}-2`,
        name: "Variant 2",
        price: "1800.00",
      },
      actor: vendorA.user,
    });

    const refreshedVarProduct = await Product.findById(varProduct._id);
    expect(refreshedVarProduct.price.toString()).toBe("1800.00");
  });

  // -------------------------------------------------------------------------
  // 9. Vendor ownership and authorization remain enforced
  // -------------------------------------------------------------------------
  test("9. Vendor ownership and authorization remain enforced", async () => {
    const sku = `P2A-OWN-${Date.now()}`;
    const productA = await productService.createProduct({
      data: {
        name: "Vendor A Product",
        slug: `vendor-a-prod-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "799.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    // Vendor B cannot update Vendor A's product
    await expect(
      productService.updateProduct({
        id: productA._id.toString(),
        data: { name: "Hijacked by Vendor B" },
        actor: vendorB.user,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PRODUCT_OWNERSHIP_REQUIRED",
    });

    // Vendor B cannot create variant under Vendor A's product
    await expect(
      productVariantService.createProductVariant({
        data: {
          productId: productA._id.toString(),
          sku: `${sku}-HIJACK`,
          price: "500.00",
        },
        actor: vendorB.user,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PRODUCT_OWNERSHIP_REQUIRED",
    });
  });

  // -------------------------------------------------------------------------
  // 10. Existing cart and order schemas remain compatible
  // -------------------------------------------------------------------------
  test("10. Existing cart and order schemas remain compatible", async () => {
    const sku = `P2A-CART-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Purchasable Cart Product",
        slug: `purchasable-cart-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "2499.00",
        productType: "simple",
        stockQuantity: 10,
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const customerUser = await User.create({
      firstName: "Cart",
      lastName: "Customer",
      email: `cart_cust_${Date.now()}@phase2a-test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
    });

    await Customer.create({ userId: customerUser._id, isActive: true });

    // Add item by productId (auto-resolves canonical default variant)
    const cart = await cartService.addItem(
      customerUser._id.toString(),
      { productId: product._id.toString() },
      2
    );

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.items[0].priceSnapshot.toString()).toBe("2499.00");
  });

  // -------------------------------------------------------------------------
  // 11. Existing historical order snapshots remain unchanged
  // -------------------------------------------------------------------------
  test("11. Existing historical order snapshots remain unchanged", async () => {
    const sku = `P2A-ORD-SNAP-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Order Snapshot Test",
        slug: `order-snapshot-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "3499.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({
      productId: product._id,
      isDefault: true,
      deletedAt: null,
    });

    // Create an immutable historical order snapshot
    const historicalOrder = await Order.create({
      orderNumber: `ORD-${Date.now()}`,
      customerId: new mongoose.Types.ObjectId(),
      currency: "INR",
      status: "delivered",
      cancellationStatus: "none",
      fulfillmentStatus: "fulfilled",
      inventoryStatus: "deducted",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      billingAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        addressLine1: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      subtotal: mongoose.Types.Decimal128.fromString("3499.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("3499.00"),
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          vendorId: vendorA.vendor._id,
          categoryId: testCategory._id,
          sku: variant.sku,
          productName: product.name,
          variantName: variant.name,
          quantity: 1,
          unitPrice: variant.price,
          discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
          taxTotal: mongoose.Types.Decimal128.fromString("0.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("3499.00"),
          currency: "INR",
          warehouseId: new mongoose.Types.ObjectId(),
          inventoryStatus: "deducted",
          fulfillmentStatus: "delivered",
        },
      ],
    });

    // Now mutate product and variant price in catalog
    await productService.updateProduct({
      id: product._id.toString(),
      data: { price: 4999 },
      actor: vendorA.user,
    });

    // Verify historical order snapshot did not change
    const reloadedOrder = await Order.findById(historicalOrder._id);
    expect(reloadedOrder.items[0].unitPrice.toString()).toBe("3499.00");
    expect(reloadedOrder.items[0].sku).toBe(sku);
  });

  // -------------------------------------------------------------------------
  // 12. Product duplication and import use the same canonical rules
  // -------------------------------------------------------------------------
  test("12. Product duplication and import use the same canonical rules", async () => {
    const sku = `P2A-DUP-SRC-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Source Product For Duplication",
        slug: `src-dup-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1799.00",
        productType: "simple",
        dimensions: { length: 30, width: 20, height: 10, unit: "cm" },
        shippingClass: "express",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const duplicated = await productService.duplicateProduct({
      id: product._id.toString(),
      actor: vendorA.user,
    });

    expect(duplicated.name).toBe("Source Product For Duplication (Copy)");
    expect(duplicated.productType).toBe("simple");
    expect(duplicated.dimensions.length).toBe(30);

    const dupVariants = await ProductVariant.find({
      productId: duplicated._id,
      deletedAt: null,
    });

    expect(dupVariants).toHaveLength(1);
    expect(dupVariants[0].isDefault).toBe(true);
    expect(dupVariants[0].sku).toBe(duplicated.sku);
    expect(dupVariants[0].dimensions.length).toBe(30);
  });

  // -------------------------------------------------------------------------
  // 13. Product type transitions cannot orphan variants or inventory
  // -------------------------------------------------------------------------
  test("13. Product type transitions cannot orphan variants or inventory", async () => {
    // 1. Simple to variable
    const sku = `P2A-TRANS-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Transition Simple to Var",
        slug: `trans-smp-var-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "500.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const updatedToVar = await productService.updateProduct({
      id: product._id.toString(),
      data: { productType: "variable" },
      actor: vendorA.user,
    });

    expect(updatedToVar.productType).toBe("variable");
    const v1 = await ProductVariant.findOne({ productId: product._id, deletedAt: null });
    expect(v1.isDefault).toBe(false);

    // Add second variant
    await productVariantService.createProductVariant({
      data: {
        productId: product._id.toString(),
        sku: `${sku}-EXTRA`,
        price: "600.00",
      },
      actor: vendorA.user,
    });

    // 2. Variable with multiple active variants CANNOT transition to simple
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

  // -------------------------------------------------------------------------
  // 14. Dimension inheritance contract
  // -------------------------------------------------------------------------
  test("14. Dimension inheritance: variant overrides parent, fallback to parent", async () => {
    const parent = {
      dimensions: { length: 50, width: 40, height: 30, unit: "cm" },
      shippingClass: "heavy-freight",
    };

    // Variant with custom length and width, but inheriting height and unit
    const variantWithOverride = {
      dimensions: { length: 55, width: 45, height: null, unit: "cm" },
      shippingClass: null,
    };

    const resolvedOverride = productService.resolveShippingDetails(
      variantWithOverride,
      parent
    );

    expect(resolvedOverride.dimensions.length).toBe(55);
    expect(resolvedOverride.dimensions.width).toBe(45);
    expect(resolvedOverride.dimensions.height).toBe(30);
    expect(resolvedOverride.shippingClass).toBe("heavy-freight");

    // Variant without dimensions inherits all parent dimensions
    const variantEmpty = { dimensions: null, shippingClass: null };
    const resolvedEmpty = productService.resolveShippingDetails(variantEmpty, parent);
    expect(resolvedEmpty.dimensions.length).toBe(50);
    expect(resolvedEmpty.dimensions.width).toBe(40);
    expect(resolvedEmpty.dimensions.height).toBe(30);
    expect(resolvedEmpty.shippingClass).toBe("heavy-freight");
  });
});
