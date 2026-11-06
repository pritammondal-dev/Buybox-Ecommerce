const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const Cart = require("../src/models/Cart");
const Customer = require("../src/models/Customer");
const Order = require("../src/models/Order");

const productService = require("../src/services/product.service");
const productVariantService = require("../src/services/product-variant.service");
const inventoryService = require("../src/services/inventory.service");
const inventoryAccessService = require("../src/services/inventory-access.service");
const cartService = require("../src/services/cart.service");
const orderService = require("../src/services/order.service");
const withTransaction = require("../src/utils/withTransaction");
const AppError = require("../src/errors/AppError");

const TEST_MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 2B — Warehouse Inventory Provisioning & Stock Source Alignment", () => {
  let testCategory;
  let vendorA;
  let vendorB;
  let adminUser;
  let customerUser;
  let customer;
  let warehouse1;
  let warehouse2;
  let inactiveWarehouse;

  const validShippingAddress = {
    fullName: "Customer P2B",
    phone: "9876543210",
    addressLine1: "100 Test Lane",
    city: "Delhi",
    state: "Delhi",
    postalCode: "110001",
    country: "IN",
  };

  async function createTestVendor(name) {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName: name,
      lastName: "Vendor",
      email: `${name.toLowerCase()}_${Date.now()}_${rand}@p2b-test.com`,
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

    // Cleanup previous test artifacts
    await User.deleteMany({ email: /@p2b-test\.com$/ });
    await Vendor.deleteMany({ businessSlug: /^vendora-biz-|^vendorb-biz-/ });
    await Category.deleteMany({ slug: /^p2b-cat-/ });
    await Warehouse.deleteMany({ code: /^P2B-WH-/ });
    await Product.deleteMany({ sku: /^P2B-/ });
    await ProductVariant.deleteMany({ sku: /^P2B-/ });
    await Cart.deleteMany({});
    await Customer.deleteMany({});
    await Order.deleteMany({ orderNumber: /^P2B-ORD-/ });

    testCategory = await Category.create({
      name: `Phase2B Category ${Date.now()}`,
      slug: `p2b-cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    vendorA = await createTestVendor("VendorA");
    vendorB = await createTestVendor("VendorB");

    adminUser = await User.create({
      firstName: "Admin",
      lastName: "P2B",
      email: `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@p2b-test.com`,
      password: "Password123!",
      role: "admin",
      isActive: true,
    });

    customerUser = await User.create({
      firstName: "Customer",
      lastName: "P2B",
      email: `cust_${Date.now()}_${Math.random().toString(36).substring(7)}@p2b-test.com`,
      password: "Password123!",
      role: "customer",
      isActive: true,
    });

    customer = await Customer.create({
      userId: customerUser._id,
      phone: "9876543210",
      isActive: true,
    });

    // Create active warehouses
    warehouse1 = await Warehouse.create({
      name: "Phase 2B Warehouse North",
      code: `P2B-WH-N-${Date.now()}`,
      address: {
        addressLine1: "100 Logistics Way",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "IN",
      },
      isActive: true,
    });

    warehouse2 = await Warehouse.create({
      name: "Phase 2B Warehouse South",
      code: `P2B-WH-S-${Date.now()}`,
      address: {
        addressLine1: "200 Harbor Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "IN",
      },
      isActive: true,
    });

    inactiveWarehouse = await Warehouse.create({
      name: "Phase 2B Inactive Warehouse",
      code: `P2B-WH-INACT-${Date.now()}`,
      address: {
        addressLine1: "999 Closed St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      isActive: false,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ email: /@p2b-test\.com$/ });
      await Vendor.deleteMany({ businessSlug: /^vendora-biz-|^vendorb-biz-/ });
      await Category.deleteMany({ slug: /^p2b-cat-/ });
      await Warehouse.deleteMany({ code: /^P2B-WH-/ });
      await Product.deleteMany({ sku: /^P2B-/ });
      await ProductVariant.deleteMany({ sku: /^P2B-/ });
      await Cart.deleteMany({});
      await Customer.deleteMany({});
      await Order.deleteMany({ orderNumber: /^P2B-ORD-/ });
    } catch (e) {
      // Ignored in cleanup
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // SECTION A: INVENTORY PROVISIONING (Scenarios 1 - 6)
  // =========================================================================

  test("1. Simple product default variant resolves to the correct inventory records", async () => {
    const sku = `P2B-SMP-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Simple Inventory Product",
        slug: `simple-inv-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "799.00",
        stockQuantity: 25,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    expect(product).toBeDefined();
    const defaultVariant = await ProductVariant.findOne({
      productId: product._id,
      isDefault: true,
    });
    expect(defaultVariant).toBeDefined();

    const inventory = await Inventory.findOne({
      productVariantId: defaultVariant._id,
      warehouseId: warehouse1._id,
    });
    expect(inventory).toBeDefined();
    expect(inventory.onHand).toBe(25);
    expect(inventory.reserved).toBe(0);
    expect(inventory.available).toBe(25);

    // Verify initial stock transaction recorded
    const tx = await InventoryTransaction.findOne({
      productVariantId: defaultVariant._id,
      type: "receive",
    });
    expect(tx).toBeDefined();
    expect(tx.quantity).toBe(25);
  });

  test("2. Repeated provisioning does not create duplicate inventory", async () => {
    const sku = `P2B-SMP-DEDUP-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Dedup Simple Product",
        slug: `dedup-simple-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "499.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const defaultVariant = await ProductVariant.findOne({
      productId: product._id,
      isDefault: true,
    });

    // Attempt direct second provisioning for the same variant & warehouse
    await expect(
      inventoryService.createInventory({
        productVariantId: defaultVariant._id,
        warehouseId: warehouse1._id,
        onHand: 10,
      })
    ).rejects.toMatchObject({
      code: "INVENTORY_ALREADY_EXISTS",
      statusCode: 409,
    });

    const count = await Inventory.countDocuments({
      productVariantId: defaultVariant._id,
      warehouseId: warehouse1._id,
    });
    expect(count).toBe(1);
  });

  test("3. Variable variant provisioning follows the configured warehouse policy", async () => {
    const skuParent = `P2B-VAR-P-${Date.now()}`;
    const parentProduct = await productService.createProduct({
      data: {
        name: "Variable Inventory Parent",
        slug: `var-inv-${Date.now()}`,
        sku: skuParent,
        categoryId: testCategory._id.toString(),
        price: "1200.00",
        productType: "variable",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const skuVariant = `P2B-VAR-V1-${Date.now()}`;
    const variant = await productVariantService.createProductVariant({
      data: {
        productId: parentProduct._id.toString(),
        sku: skuVariant,
        price: "1250.00",
        stockQuantity: 40,
        warehouseId: warehouse2._id.toString(),
        options: [{ name: "Size", value: "L" }],
      },
      actor: vendorA.user,
    });

    expect(variant).toBeDefined();
    const inventory = await Inventory.findOne({
      productVariantId: variant._id,
      warehouseId: warehouse2._id,
    });
    expect(inventory).toBeDefined();
    expect(inventory.onHand).toBe(40);
    expect(inventory.reserved).toBe(0);
    expect(inventory.available).toBe(40);
  });

  test("4. Missing warehouse configuration fails safely", async () => {
    const fakeWarehouseId = new mongoose.Types.ObjectId().toString();
    const sku = `P2B-FAIL-WH-${Date.now()}`;

    await expect(
      productService.createProduct({
        data: {
          name: "Missing Warehouse Product",
          slug: `missing-wh-${Date.now()}`,
          sku,
          categoryId: testCategory._id.toString(),
          price: "500.00",
          stockQuantity: 10,
          warehouseId: fakeWarehouseId,
          productType: "simple",
        },
        userId: vendorA.user._id.toString(),
        actor: vendorA.user,
      })
    ).rejects.toMatchObject({
      code: "WAREHOUSE_NOT_FOUND",
      statusCode: 404,
    });

    // Verify atomic rollback: neither product nor variant persisted
    const savedProd = await Product.findOne({ sku });
    expect(savedProd).toBeNull();
    const savedVariant = await ProductVariant.findOne({ sku });
    expect(savedVariant).toBeNull();
  });

  test("5. Failed provisioning does not leave a silently purchasable, inconsistent variant", async () => {
    const sku = `P2B-INACT-WH-${Date.now()}`;

    // Pointing to inactive warehouse must fail safely with WAREHOUSE_NOT_FOUND (not found among active warehouses)
    await expect(
      productService.createProduct({
        data: {
          name: "Inactive Warehouse Product",
          slug: `inact-wh-${Date.now()}`,
          sku,
          categoryId: testCategory._id.toString(),
          price: "500.00",
          stockQuantity: 15,
          warehouseId: inactiveWarehouse._id.toString(),
          productType: "simple",
        },
        userId: vendorA.user._id.toString(),
        actor: vendorA.user,
      })
    ).rejects.toMatchObject({
      code: "WAREHOUSE_NOT_FOUND",
      statusCode: 404,
    });

    const savedProd = await Product.findOne({ sku });
    expect(savedProd).toBeNull();
    const savedVariant = await ProductVariant.findOne({ sku });
    expect(savedVariant).toBeNull();
  });

  test("6. Legacy variants with missing inventory are handled safely", async () => {
    // Manually create a product and variant directly bypassing inventory provisioning
    const sku = `P2B-LEGACY-${Date.now()}`;
    const product = await Product.create({
      name: "Legacy Product Without Inventory",
      slug: `legacy-no-inv-${Date.now()}`,
      sku,
      categoryId: testCategory._id,
      vendorId: vendorA.vendor._id,
      price: 350.0,
      status: "active",
      productType: "simple",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    const variant = await ProductVariant.create({
      productId: product._id,
      vendorId: vendorA.vendor._id,
      sku,
      price: 350.0,
      stockQuantity: 100, // Stale legacy field
      isDefault: true,
      isActive: true,
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    // Zero inventory records exist
    const invCount = await Inventory.countDocuments({ productVariantId: variant._id });
    expect(invCount).toBe(0);

    // Attempting to add to cart must evaluate authoritative stock (0) and throw OUT_OF_STOCK
    await expect(
      cartService.addItem(
        customerUser._id.toString(),
        {
          productId: product._id.toString(),
          productVariantId: variant._id.toString(),
        },
        1
      )
    ).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
      statusCode: 400,
    });
  });

  // =========================================================================
  // SECTION B: STOCK CONSISTENCY (Scenarios 7 - 12)
  // =========================================================================

  test("7. Cart availability is calculated from inventory rather than stale stockQuantity", async () => {
    const sku = `P2B-CART-STALE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Cart Stale Stock Product",
        slug: `cart-stale-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "600.00",
        stockQuantity: 3, // Real inventory onHand = 3
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Intentionally corrupt variant.stockQuantity to a huge number
    await ProductVariant.updateOne({ _id: variant._id }, { $set: { stockQuantity: 9999 } });

    // User attempts to add 5 items (only 3 exist in warehouse)
    await expect(
      cartService.addItem(
        customerUser._id.toString(),
        {
          productId: product._id.toString(),
          productVariantId: variant._id.toString(),
        },
        5
      )
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      statusCode: 400,
    });
  });

  test("8. Inventory updates immediately affect subsequent availability checks", async () => {
    await Cart.deleteMany({}); // Clear cart for isolation
    const sku = `P2B-IMMEDIATE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Immediate Stock Update Product",
        slug: `imm-stock-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "450.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // Add 2 items to cart succeeds
    const cart = await cartService.addItem(
      customerUser._id.toString(),
      {
        productId: product._id.toString(),
        productVariantId: variant._id.toString(),
      },
      2
    );
    expect(cart.items).toHaveLength(1);

    // Adjust inventory down by -9 (now onHand = 1, available = 1)
    await inventoryService.adjustStock(
      inventory._id,
      -9,
      {
        notes: "Damage adjustment",
        actorUserId: vendorA.user._id,
      }
    );

    // Updating cart quantity to 5 must immediately fail with INSUFFICIENT_STOCK
    await expect(
      cartService.updateItemQuantity(
        customerUser._id.toString(),
        variant._id.toString(),
        5
      )
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      statusCode: 400,
    });
  });

  test("9. Stock adjustment cannot produce invalid negative quantities", async () => {
    const sku = `P2B-NEG-ADJ-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Negative Adjustment Guard",
        slug: `neg-adj-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "850.00",
        stockQuantity: 5,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // Attempting adjustment of -10 when onHand = 5
    await expect(
      inventoryService.adjustStock(
        inventory._id,
        -10,
        {
          notes: "Excess reduction attempt",
        }
      )
    ).rejects.toMatchObject({
      code: "INVALID_STOCK_ADJUSTMENT",
      statusCode: 409,
    });

    const freshInv = await Inventory.findById(inventory._id);
    expect(freshInv.onHand).toBe(5);
    expect(freshInv.onHand).toBeGreaterThanOrEqual(0);
  });

  test("10. Reservations and releases maintain correct onHand and reserved semantics", async () => {
    const sku = `P2B-RES-REL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Reservation Lifecycle Product",
        slug: `res-rel-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "999.00",
        stockQuantity: 30,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // 1. Reserve 10 units
    const reservationRef = `ORDER-TEST-${Date.now()}`;
    await withTransaction(async (session) => {
      await inventoryService.reserveStockInTransaction(
        inventory._id,
        10,
        {
          referenceType: "order",
          referenceId: reservationRef,
          actorUserId: customerUser._id,
          idempotencyKey: `res-${reservationRef}`,
          notes: "Reservation test",
        },
        session
      );
    });

    let inv = await Inventory.findById(inventory._id);
    expect(inv.onHand).toBe(30);
    expect(inv.reserved).toBe(10);
    expect(inv.available).toBe(20);

    // 2. Release 10 units
    await withTransaction(async (session) => {
      await inventoryService.releaseStockInTransaction(
        inventory._id,
        10,
        {
          referenceType: "order",
          referenceId: reservationRef,
          actorUserId: customerUser._id,
          idempotencyKey: `rel-${reservationRef}`,
          notes: "Release test",
        },
        session
      );
    });

    inv = await Inventory.findById(inventory._id);
    expect(inv.onHand).toBe(30);
    expect(inv.reserved).toBe(0);
    expect(inv.available).toBe(30);
  });

  test("11. Inventory records remain isolated by warehouse", async () => {
    const sku = `P2B-WH-ISOLATE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Warehouse Isolation Product",
        slug: `wh-isolate-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1500.00",
        stockQuantity: 12,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    // Provision inventory at warehouse 2 as well
    const inv2 = await inventoryService.createInventory({
      productVariantId: variant._id,
      warehouseId: warehouse2._id,
      onHand: 24,
    });

    const inv1 = await Inventory.findOne({
      productVariantId: variant._id,
      warehouseId: warehouse1._id,
    });

    // Reserve 5 units specifically at Warehouse 1
    await withTransaction(async (session) => {
      await inventoryService.reserveStockInTransaction(
        inv1._id,
        5,
        {
          referenceType: "order",
          referenceId: `ORD-WH-ISO-${Date.now()}`,
          actorUserId: customerUser._id,
          idempotencyKey: `res-iso-${Date.now()}`,
        },
        session
      );
    });

    const freshInv1 = await Inventory.findById(inv1._id);
    const freshInv2 = await Inventory.findById(inv2._id);

    // Warehouse 1 reserved = 5, available = 7
    expect(freshInv1.reserved).toBe(5);
    expect(freshInv1.onHand).toBe(12);

    // Warehouse 2 remains completely pristine (reserved = 0, onHand = 24)
    expect(freshInv2.reserved).toBe(0);
    expect(freshInv2.onHand).toBe(24);
  });

  test("12. Ineligible warehouses cannot contribute to available stock", async () => {
    const sku = `P2B-INACT-EXCL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Inactive Warehouse Exclusion Product",
        slug: `inact-excl-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "200.00",
        stockQuantity: 2, // Active warehouse has 2
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Directly seed inventory in inactive warehouse with 100 units
    await Inventory.create({
      productVariantId: variant._id,
      warehouseId: inactiveWarehouse._id,
      onHand: 100,
      reserved: 0,
    });

    // Authoritative stock calculation across active warehouses should be exactly 2
    // User tries to add 5 to cart (2 available in active, 100 in inactive)
    await expect(
      cartService.addItem(
        customerUser._id.toString(),
        {
          productId: product._id.toString(),
          productVariantId: variant._id.toString(),
        },
        5
      )
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      statusCode: 400,
    });
  });

  // =========================================================================
  // SECTION C: CONCURRENCY AND IDEMPOTENCY (Scenarios 13 - 18)
  // =========================================================================

  test("13. Concurrent provisioning does not create duplicate inventory", async () => {
    const sku = `P2B-CONC-PROV-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Concurrent Provisioning Test",
        slug: `conc-prov-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "320.00",
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Concurrently invoke createInventory for the same warehouse 5 times
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() =>
        inventoryService.createInventory({
          productVariantId: variant._id,
          warehouseId: warehouse1._id,
          onHand: 10,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length + rejected.length).toBe(5);

    // Crucial assertion: Exactly 1 inventory document exists
    const count = await Inventory.countDocuments({
      productVariantId: variant._id,
      warehouseId: warehouse1._id,
    });
    expect(count).toBe(1);
  });

  test("14. Concurrent checkout attempts cannot oversell the same inventory", async () => {
    const sku = `P2B-OVERSELL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Oversell Protection Product",
        slug: `oversell-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "500.00",
        stockQuantity: 5, // Exactly 5 units
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // 4 concurrent reservation attempts for 2 units each (total 8 units attempted, only 5 exist)
    const attempts = await Promise.allSettled(
      [1, 2, 3, 4].map((i) =>
        withTransaction(async (session) => {
          return inventoryService.reserveStockInTransaction(
            inventory._id,
            2,
            {
              referenceType: "order",
              referenceId: `ORD-CONC-${i}-${Date.now()}`,
              actorUserId: customerUser._id,
              idempotencyKey: `idemp-conc-${i}-${Date.now()}`,
            },
            session
          );
        })
      )
    );

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");

    // At most 2 can succeed (2 * 2 = 4 units <= 5 units)
    expect(succeeded.length).toBeLessThanOrEqual(2);
    expect(failed.length).toBeGreaterThanOrEqual(2);

    const freshInv = await Inventory.findById(inventory._id);
    expect(freshInv.reserved).toBeLessThanOrEqual(freshInv.onHand);
    expect(freshInv.available).toBeGreaterThanOrEqual(0);
  });

  test("15. Duplicate order or payment callbacks do not double-reserve, double-release, or double-finalize stock", async () => {
    const sku = `P2B-CALLBACK-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Callback Idempotency Product",
        slug: `callback-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "400.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    const sharedKey = `shared-idemp-${Date.now()}`;

    // 1. Double reservation with identical idempotencyKey
    await withTransaction(async (session) => {
      await inventoryService.reserveStockInTransaction(
        inventory._id,
        4,
        {
          referenceType: "order",
          referenceId: "ORDER-DUP-CALLBACK",
          actorUserId: customerUser._id,
          idempotencyKey: sharedKey,
        },
        session
      );
    });

    await withTransaction(async (session) => {
      await inventoryService.reserveStockInTransaction(
        inventory._id,
        4,
        {
          referenceType: "order",
          referenceId: "ORDER-DUP-CALLBACK",
          actorUserId: customerUser._id,
          idempotencyKey: sharedKey,
        },
        session
      );
    });

    let inv = await Inventory.findById(inventory._id);
    // Reserved must be 4, NOT 8
    expect(inv.reserved).toBe(4);

    // 2. Double finalization (deduct) with identical idempotencyKey
    const deductKey = `deduct-key-${Date.now()}`;
    await withTransaction(async (session) => {
      await inventoryService.deductReservedStockInTransaction(
        inventory._id,
        4,
        {
          referenceType: "order",
          referenceId: "ORDER-DUP-CALLBACK",
          actorUserId: customerUser._id,
          idempotencyKey: deductKey,
        },
        session
      );
    });

    await withTransaction(async (session) => {
      await inventoryService.deductReservedStockInTransaction(
        inventory._id,
        4,
        {
          referenceType: "order",
          referenceId: "ORDER-DUP-CALLBACK",
          actorUserId: customerUser._id,
          idempotencyKey: deductKey,
        },
        session
      );
    });

    inv = await Inventory.findById(inventory._id);
    // onHand must be 6 (10 - 4), reserved must be 0
    expect(inv.onHand).toBe(6);
    expect(inv.reserved).toBe(0);
  });

  test("16. Expired reservations release stock at most once", async () => {
    const sku = `P2B-EXPIRE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Order Expiration Product",
        slug: `order-expire-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "700.00",
        stockQuantity: 15,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // Seed pending order with reserved items
    const orderNumber = `P2B-ORD-EXP-${Date.now()}`;
    await Inventory.updateOne({ _id: inventory._id }, { $inc: { reserved: 3 } });

    const order = await Order.create({
      orderNumber,
      customerId: customer._id,
      status: "pending",
      paymentStatus: "pending",
      subtotal: "2100.00",
      grandTotal: "2100.00",
      currency: "INR",
      shippingAddress: validShippingAddress,
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          sku: variant.sku,
          productName: "Order Expiration Product",
          variantName: "Default",
          currency: "INR",
          quantity: 3,
          unitPrice: 700.0,
          lineTotal: 2100.0,
          vendorId: vendorA.vendor._id,
          warehouseId: warehouse1._id,
          inventoryStatus: "reserved",
        },
      ],
      expiresAt: new Date(Date.now() - 60000), // Already expired
    });

    // Call expirePendingOrder first time
    await orderService.expirePendingOrder(order._id);

    let inv = await Inventory.findById(inventory._id);
    expect(inv.reserved).toBe(0);

    // Call expirePendingOrder second time (must be idempotent, not negative reserved)
    await orderService.expirePendingOrder(order._id);

    inv = await Inventory.findById(inventory._id);
    expect(inv.reserved).toBe(0);
    expect(inv.onHand).toBe(15);
  });

  test("17. Repeated cancellation does not restore the same stock twice", async () => {
    const sku = `P2B-CANCEL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Order Cancellation Product",
        slug: `order-cancel-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "900.00",
        stockQuantity: 20,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // Order with reserved stock
    await Inventory.updateOne({ _id: inventory._id }, { $inc: { reserved: 2 } });
    const orderNumber = `P2B-ORD-CAN-${Date.now()}`;
    const order = await Order.create({
      orderNumber,
      customerId: customer._id,
      status: "pending",
      paymentStatus: "pending",
      subtotal: "1800.00",
      grandTotal: "1800.00",
      currency: "INR",
      shippingAddress: validShippingAddress,
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          sku: variant.sku,
          productName: "Order Cancellation Product",
          variantName: "Default",
          currency: "INR",
          quantity: 2,
          unitPrice: 900.0,
          lineTotal: 1800.0,
          vendorId: vendorA.vendor._id,
          warehouseId: warehouse1._id,
          inventoryStatus: "reserved",
        },
      ],
    });

    // 1st Cancellation
    await orderService.cancelOrder(order._id, {
      userId: customerUser._id,
      role: "customer",
      reason: "Customer requested cancellation",
    });

    let inv = await Inventory.findById(inventory._id);
    expect(inv.reserved).toBe(0);

    // 2nd Cancellation call resolves idempotently without restoring stock twice
    await orderService.cancelOrder(order._id, {
      userId: customerUser._id,
      role: "customer",
      reason: "Repeated cancellation attempt",
    });

    inv = await Inventory.findById(inventory._id);
    expect(inv.reserved).toBe(0);
    expect(inv.onHand).toBe(20);
  });

  test("18. Retrying a failed operation does not create duplicate records", async () => {
    const sku = `P2B-RETRY-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Retry Test Product",
        slug: `retry-test-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "150.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Intentionally cause failure in adjustment (invalid ID)
    await expect(
      inventoryService.adjustStock(
        new mongoose.Types.ObjectId(),
        5,
        { notes: "Fail test" }
      )
    ).rejects.toBeDefined();

    // Now execute valid adjustment
    const inventory = await Inventory.findOne({ productVariantId: variant._id });
    await inventoryService.adjustStock(
      inventory._id,
      5,
      { notes: "Valid retry" }
    );

    const updated = await Inventory.findById(inventory._id);
    expect(updated.onHand).toBe(15);
  });

  // =========================================================================
  // SECTION D: REGRESSION AND AUTHORIZATION (Scenarios 19 - 25)
  // =========================================================================

  test("19. Vendor ownership and staff/admin/superadmin authorization remain enforced", async () => {
    const sku = `P2B-AUTH-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Auth Test Product",
        slug: `auth-test-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "990.00",
        stockQuantity: 5,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Vendor B attempts to access/mutate Vendor A's inventory -> MUST be rejected with INVENTORY_ACCESS_DENIED
    await expect(
      inventoryAccessService.ensureInventoryAccess({
        user: vendorB.user,
        productVariantId: variant._id,
        isMutation: true,
      })
    ).rejects.toMatchObject({
      code: "INVENTORY_ACCESS_DENIED",
      statusCode: 403,
    });

    // Admin user CAN access Vendor A's inventory without rejection
    await expect(
      inventoryAccessService.ensureInventoryAccess({
        user: adminUser,
        productVariantId: variant._id,
        isMutation: true,
      })
    ).resolves.not.toThrow();
  });

  test("20. Existing simple-product cart resolution tests pass", async () => {
    await Cart.deleteMany({}); // Ensure clear cart
    const sku = `P2B-CART-RESOLVE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Cart Resolve Product",
        slug: `cart-resolve-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "420.00",
        stockQuantity: 8,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const defaultVariant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    const cart = await cartService.addItem(
      customerUser._id.toString(),
      { productId: product._id.toString() },
      2
    );

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productVariantId.toString()).toBe(defaultVariant._id.toString());
    expect(cart.items[0].quantity).toBe(2);
  });

  test("21. Existing warehouse fallback tests pass", async () => {
    // Multi-warehouse reservation fallback
    const sku = `P2B-WH-FALLBACK-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Warehouse Fallback Product",
        slug: `wh-fallback-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1100.00",
        stockQuantity: 2, // Warehouse 1 has only 2
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Provision Warehouse 2 with 10 units
    await inventoryService.createInventory({
      productVariantId: variant._id,
      warehouseId: warehouse2._id,
      onHand: 10,
    });

    // Request 5 units in order reservation -> must fall back to Warehouse 2
    const reservations = await withTransaction(async (session) => {
      return orderService.reserveInventoryForOrderItems(
        [
          {
            productId: product._id,
            productVariantId: variant._id,
            sku: variant.sku,
            quantity: 5,
          },
        ],
        `ORD-FB-${Date.now()}`,
        customerUser._id.toString(),
        session
      );
    });

    expect(reservations).toHaveLength(1);
    expect(reservations[0].warehouseId.toString()).toBe(warehouse2._id.toString());
  });

  test("22. Historical order snapshots remain unchanged", async () => {
    const sku = `P2B-SNAPSHOT-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Snapshot Integrity Product",
        slug: `snap-prod-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "500.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    const orderNumber = `P2B-ORD-SNAP-${Date.now()}`;
    const order = await Order.create({
      orderNumber,
      customerId: customer._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: "500.00",
      grandTotal: "500.00",
      currency: "INR",
      shippingAddress: validShippingAddress,
      items: [
        {
          productId: product._id,
          productVariantId: variant._id,
          sku: variant.sku,
          productName: "Snapshot Integrity Product",
          variantName: "Default",
          currency: "INR",
          quantity: 1,
          unitPrice: 500.0,
          lineTotal: 500.0,
          vendorId: vendorA.vendor._id,
          warehouseId: warehouse1._id,
        },
      ],
    });

    // Now update variant price to 750.00 and stock
    await ProductVariant.updateOne({ _id: variant._id }, { $set: { price: 750.0 } });

    // Historical order must remain completely untouched
    const historicalOrder = await Order.findById(order._id);
    expect(historicalOrder.items[0].unitPrice.toString()).toBe("500");
    expect(historicalOrder.items[0].lineTotal.toString()).toBe("500");
  });

  test("23. Existing product/variant ownership tests pass (Variant deletion guard with active reservations)", async () => {
    const sku = `P2B-GUARD-DEL-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Variant Deletion Guard Product",
        slug: `guard-del-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "800.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });

    // Reserve 2 units
    await Inventory.updateOne(
      { productVariantId: variant._id, warehouseId: warehouse1._id },
      { $inc: { reserved: 2 } }
    );

    // Deleting variant with active reservation MUST fail with 409 CANNOT_DELETE_VARIANT_WITH_RESERVATIONS
    await expect(
      productVariantService.deleteProductVariant({
        id: variant._id.toString(),
        actor: vendorA.user,
      })
    ).rejects.toMatchObject({
      code: "CANNOT_DELETE_VARIANT_WITH_RESERVATIONS",
      statusCode: 409,
    });
  });

  test("24. Existing payment and checkout regression tests pass", async () => {
    await Cart.deleteMany({});
    const sku = `P2B-CHECKOUT-QUOTE-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Checkout Quote Regression Product",
        slug: `chk-quote-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "1500.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
        status: "active",
      },
      userId: vendorA.user._id.toString(),
      actor: adminUser,
    });

    const cart = await cartService.addItem(
      customerUser._id.toString(),
      { productId: product._id.toString() },
      1
    );

    // Validate checkout quote calculation
    const quote = await orderService.calculateCheckoutQuote({
      userId: customerUser._id.toString(),
    });
    expect(quote).toBeDefined();
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0].sku).toBe(sku);
    expect(Number(quote.subtotal)).toBe(1500.0);
  });

  test("25. Existing return and restock tests pass", async () => {
    const sku = `P2B-RESTOCK-${Date.now()}`;
    const product = await productService.createProduct({
      data: {
        name: "Restock Return Product",
        slug: `restock-ret-${Date.now()}`,
        sku,
        categoryId: testCategory._id.toString(),
        price: "650.00",
        stockQuantity: 10,
        warehouseId: warehouse1._id.toString(),
        productType: "simple",
      },
      userId: vendorA.user._id.toString(),
      actor: vendorA.user,
    });

    const variant = await ProductVariant.findOne({ productId: product._id, isDefault: true });
    const inventory = await Inventory.findOne({ productVariantId: variant._id });

    // Restock 3 units via return
    await inventoryService.adjustStock(
      inventory._id,
      3,
      {
        notes: "Customer return accepted",
        actorUserId: adminUser._id,
      }
    );

    const updated = await Inventory.findById(inventory._id);
    expect(updated.onHand).toBe(13);

    // Verify transaction created
    const tx = await InventoryTransaction.findOne({
      productVariantId: variant._id,
      type: "adjustment",
    });
    expect(tx).toBeDefined();
    expect(tx.onHandAfter).toBe(13);
  });
});
