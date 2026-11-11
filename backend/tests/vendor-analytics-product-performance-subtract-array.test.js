const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const Order = require("../src/models/Order");

const analyticsRepository = require("../src/repositories/analytics.repository");
const analyticsService = require("../src/services/analytics.service");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Vendor Analytics — Product Performance Aggregation ($subtract array from array Fix & Regression Suite)", () => {
  let vendorAUser, vendorA;
  let vendorBUser, vendorB;
  let testCustomer;
  let testWarehouse1, testWarehouse2;
  let category;
  let product1, variant1_1, variant1_2;
  let product2, variant2_1;
  let productB, variantB_1;

  async function createTestUser(role, prefix) {
    const rand = Math.random().toString(36).substring(7);
    const randPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    return User.create({
      firstName: `${prefix}First`,
      lastName: `${prefix}Last`,
      email: `${prefix.toLowerCase()}_${Date.now()}_${rand}@analytics-fix.test`,
      password: "Password123!",
      role,
      phone: randPhone,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
    });
  }

  async function createTestVendor(name) {
    const user = await createTestUser("vendor", name);
    const rand = Math.random().toString(36).substring(7);
    const vendor = await Vendor.create({
      userId: user._id,
      businessName: `${name} Store ${rand}`,
      businessSlug: `${name.toLowerCase()}-store-${rand}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    return { user, vendor };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // 1. Create Vendors
    const vA = await createTestVendor("VendorAlpha");
    vendorAUser = vA.user;
    vendorA = vA.vendor;

    const vB = await createTestVendor("VendorBeta");
    vendorBUser = vB.user;
    vendorB = vB.vendor;

    // 2. Create Customer
    testCustomer = await createTestUser("customer", "CustomerTest");

    // 3. Create Warehouses
    testWarehouse1 = await Warehouse.create({
      name: "Main Warehouse Alpha",
      code: `WH-A1-${Date.now()}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Road 1",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      capacity: 50000,
      isActive: true,
    });

    testWarehouse2 = await Warehouse.create({
      name: "Secondary Warehouse Alpha",
      code: `WH-A2-${Date.now()}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Road 2",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
        country: "IN",
      },
      capacity: 30000,
      isActive: true,
    });

    // 4. Create Category
    category = await Category.create({
      name: `Cat-Analytics-${Date.now()}`,
      slug: `cat-analytics-${Date.now()}`,
      isActive: true,
    });

    // 5. Create Products & Variants
    product1 = await Product.create({
      name: "Audio Pro Noise Cancelling Headphones",
      slug: `headphones-${Date.now()}`,
      vendorId: vendorA._id,
      categoryId: category._id,
      description: "Premium headphones",
      sku: `PROD-HDPH-${Date.now()}`,
      price: 2999,
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    variant1_1 = await ProductVariant.create({
      productId: product1._id,
      name: "Black Edition",
      sku: `HDPH-BLK-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("2999.00"),
      stock: 100,
      isActive: true,
    });

    variant1_2 = await ProductVariant.create({
      productId: product1._id,
      name: "Silver Edition",
      sku: `HDPH-SLV-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("3199.00"),
      stock: 80,
      isActive: true,
    });

    product2 = await Product.create({
      name: "Wireless Ergonomic Mouse",
      slug: `mouse-${Date.now()}`,
      vendorId: vendorA._id,
      categoryId: category._id,
      description: "Ergonomic mouse",
      sku: `PROD-MOUSE-${Date.now()}`,
      price: 1499,
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    variant2_1 = await ProductVariant.create({
      productId: product2._id,
      name: "Standard Dark Grey",
      sku: `MOUSE-GRY-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("1499.00"),
      stock: 50,
      isActive: true,
    });

    productB = await Product.create({
      name: "Vendor B Mechanical Keyboard",
      slug: `keyboard-b-${Date.now()}`,
      vendorId: vendorB._id,
      categoryId: category._id,
      description: "RGB Mechanical Keyboard",
      sku: `PROD-KB-${Date.now()}`,
      price: 4999,
      status: "active",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });

    variantB_1 = await ProductVariant.create({
      productId: productB._id,
      name: "RGB Blue Switches",
      sku: `KB-RGB-${Date.now()}`,
      price: mongoose.Types.Decimal128.fromString("4999.00"),
      stock: 60,
      isActive: true,
    });

    // 6. Create Inventories across warehouses (demonstrating multi-warehouse array lookup)
    await Inventory.create({
      productVariantId: variant1_1._id,
      warehouseId: testWarehouse1._id,
      onHand: 40,
      reserved: 5,
      damaged: 2,
      defective: 1,
      expired: 0,
    });

    await Inventory.create({
      productVariantId: variant1_1._id,
      warehouseId: testWarehouse2._id,
      onHand: 20,
      reserved: 2,
      damaged: 0,
      defective: 0,
      expired: 0,
    });

    await Inventory.create({
      productVariantId: variant1_2._id,
      warehouseId: testWarehouse1._id,
      onHand: 50,
      reserved: 10,
      damaged: 1,
      defective: 0,
      expired: 0,
    });

    await Inventory.create({
      productVariantId: variant2_1._id,
      warehouseId: testWarehouse1._id,
      onHand: 30,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
    });

    await Inventory.create({
      productVariantId: variantB_1._id,
      warehouseId: testWarehouse1._id,
      onHand: 60,
      reserved: 4,
      damaged: 0,
      defective: 0,
      expired: 0,
    });
  });

  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 86400000);
  const endDate = new Date(now.getTime() + 86400000);

  function createOrderPayload({
    orderNumber,
    vendorId = vendorA._id,
    status = "delivered",
    cancellationStatus = "none",
    paymentStatus = "paid",
    items = [],
    createdAt = new Date(),
  }) {
    return {
      orderNumber,
      customerId: testCustomer._id,
      userId: testCustomer._id,
      status,
      cancellationStatus,
      paymentStatus,
      subtotal: mongoose.Types.Decimal128.fromString("5000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("5000.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Test Customer",
        phone: "+919876543210",
        addressLine1: "123 Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items,
      createdAt,
    };
  }

  describe("1. Normal order with scalar item quantities & multi-warehouse inventory aggregation", () => {
    it("successfully aggregates product performance without $subtract array error", async () => {
      const order = await Order.create(
        createOrderPayload({
          orderNumber: `ORD-NORM-${Date.now()}-1`,
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              warehouseId: testWarehouse1._id,
              sku: variant1_1.sku,
              productName: product1.name,
              variantName: variant1_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("99.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("5899.00"),
              currency: "INR",
              quantity: 2,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      const target = result.items.find((i) => i.sku === variant1_1.sku);
      expect(target).toBeDefined();
      expect(target.unitsSold).toBe(2);
      expect(target.grossSales).toBe(5998); // 2999 * 2
      expect(target.discounts).toBe(99);
      expect(target.netSales).toBe(5899);
      // Multi-warehouse stock check: WH1 (40 onHand, 5 res, 2 dam, 1 def -> 32 avail) + WH2 (20 onHand, 2 res -> 18 avail) = 50 available, 60 onHand
      expect(target.currentStock).toBe(60);
      expect(target.availableStock).toBe(50);
    });
  });

  describe("2. Order containing multiple product items", () => {
    it("aggregates multiple product lines in a single order into distinct rows", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-MULTI-PROD-${Date.now()}-2`,
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              warehouseId: testWarehouse1._id,
              sku: variant1_1.sku,
              productName: product1.name,
              variantName: variant1_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
              currency: "INR",
              quantity: 1,
              fulfillmentStatus: "delivered",
            },
            {
              productId: product2._id,
              productVariantId: variant2_1._id,
              vendorId: vendorA._id,
              warehouseId: testWarehouse1._id,
              sku: variant2_1.sku,
              productName: product2.name,
              variantName: variant2_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
              currency: "INR",
              quantity: 3,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      const p2 = result.items.find((i) => i.sku === variant2_1.sku);
      expect(p2).toBeDefined();
      expect(p2.unitsSold).toBe(3);
      expect(p2.grossSales).toBe(4497); // 1499 * 3
      expect(p2.currentStock).toBe(30);
      expect(p2.availableStock).toBe(30);
    });
  });

  describe("3. Order containing multiple variants of same product", () => {
    it("aggregates different variants under distinct SKU groups with separate inventory", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-MULTI-VAR-${Date.now()}-3`,
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_2._id,
              vendorId: vendorA._id,
              warehouseId: testWarehouse1._id,
              sku: variant1_2.sku,
              productName: product1.name,
              variantName: variant1_2.name,
              unitPrice: mongoose.Types.Decimal128.fromString("3199.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("100.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("3099.00"),
              currency: "INR",
              quantity: 1,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      const v2 = result.items.find((i) => i.sku === variant1_2.sku);
      expect(v2).toBeDefined();
      expect(v2.unitsSold).toBe(1);
      expect(v2.grossSales).toBe(3199);
      // variant1_2 has onHand 50, reserved 10, damaged 1 -> available 39
      expect(v2.currentStock).toBe(50);
      expect(v2.availableStock).toBe(39);
    });
  });

  describe("4. Order with returned quantities", () => {
    it("accurately tracks returnedUnits and net sales", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-RET-QTY-${Date.now()}-4`,
          items: [
            {
              productId: product2._id,
              productVariantId: variant2_1._id,
              vendorId: vendorA._id,
              sku: variant2_1.sku,
              productName: product2.name,
              variantName: variant2_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("2998.00"),
              currency: "INR",
              quantity: 2,
              returnedQuantity: 1,
              returnStatus: "returned",
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      const item = result.items.find((i) => i.sku === variant2_1.sku);
      expect(item.returnedUnits).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. Order with partial returns and partially_refunded status", () => {
    it("includes partially_refunded orders and correctly aggregates metrics", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-PART-REF-${Date.now()}-5`,
          paymentStatus: "partially_refunded",
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_2._id,
              vendorId: vendorA._id,
              sku: variant1_2.sku,
              productName: product1.name,
              variantName: variant1_2.name,
              unitPrice: mongoose.Types.Decimal128.fromString("3199.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("6398.00"),
              currency: "INR",
              quantity: 2,
              returnedQuantity: 1,
              returnStatus: "returned",
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      const v2 = result.items.find((i) => i.sku === variant1_2.sku);
      expect(v2).toBeDefined();
      expect(v2.unitsSold).toBeGreaterThanOrEqual(3); // 1 earlier + 2 here
    });
  });

  describe("6. Fully cancelled order", () => {
    it("strictly excludes cancelled orders from unitsSold and sales totals", async () => {
      const beforeResult = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });
      const beforeUnits = beforeResult.items.find((i) => i.sku === variant1_1.sku)?.unitsSold || 0;

      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-CANCELLED-${Date.now()}-6`,
          status: "cancelled",
          cancellationStatus: "completed",
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              sku: variant1_1.sku,
              productName: product1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("29990.00"),
              currency: "INR",
              quantity: 10,
              fulfillmentStatus: "cancelled",
            },
          ],
        })
      );

      const afterResult = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });
      const afterUnits = afterResult.items.find((i) => i.sku === variant1_1.sku)?.unitsSold || 0;

      expect(afterUnits).toBe(beforeUnits); // No increase!
    });
  });

  describe("7. Partially fulfilled order with cancelled items", () => {
    it("excludes individually cancelled items within an otherwise valid order", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-PARTIAL-FULFILL-${Date.now()}-7`,
          status: "processing",
          paymentStatus: "paid",
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              sku: variant1_1.sku,
              productName: product1.name,
              variantName: variant1_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
              currency: "INR",
              quantity: 1,
              fulfillmentStatus: "processing", // valid
            },
            {
              productId: product2._id,
              productVariantId: variant2_1._id,
              vendorId: vendorA._id,
              sku: variant2_1.sku,
              productName: product2.name,
              variantName: variant2_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
              discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("7495.00"),
              currency: "INR",
              quantity: 5,
              fulfillmentStatus: "cancelled", // MUST NOT COUNT
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      // Product 2 had 3 units in test 2, 2 units in test 4 = 5 units. The 5 cancelled units must not be added.
      const p2 = result.items.find((i) => i.sku === variant2_1.sku);
      expect(p2.unitsSold).toBe(5);
    });
  });

  describe("8. Orders with missing optional fields", () => {
    it("gracefully processes orders where discountTotal or variantName are omitted", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-MISSING-OPT-${Date.now()}-8`,
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              sku: variant1_1.sku,
              productName: product1.name,
              // variantName omitted
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              // discountTotal omitted
              lineTotal: mongoose.Types.Decimal128.fromString("2999.00"),
              currency: "INR",
              quantity: 1,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      expect(result).toBeDefined();
      const item = result.items.find((i) => i.sku === variant1_1.sku);
      expect(item).toBeDefined();
      expect(Number(item.discounts)).toBeGreaterThanOrEqual(99);
    });
  });

  describe("9. Orders with explicit null values", () => {
    it("handles null values without runtime type conversion failure", async () => {
      // Use raw collection insert to bypass Mongoose schema defaults, testing real-world corrupted or legacy nulls
      await Order.collection.insertOne({
        orderNumber: `ORD-NULLS-${Date.now()}-9`,
        customerId: testCustomer._id,
        userId: testCustomer._id,
        status: "delivered",
        cancellationStatus: "none",
        paymentStatus: "paid",
        currency: "INR",
        shippingAddress: {
          fullName: "Test Customer",
          phone: "+919876543210",
          addressLine1: "123 Street",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "IN",
        },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productId: product1._id,
            productVariantId: variant1_1._id,
            vendorId: vendorA._id,
            sku: variant1_1.sku,
            productName: product1.name,
            variantName: null,
            unitPrice: 2999.0,
            discountTotal: null,
            lineTotal: 2999.0,
            currency: "INR",
            quantity: 1,
            returnedQuantity: null,
            fulfillmentStatus: "delivered",
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe("10. Legacy orders containing variantId structure", () => {
    it("resolves variantId when productVariantId is missing or legacy format", async () => {
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-LEGACY-VAR-${Date.now()}-10`,
          items: [
            {
              productId: product2._id,
              productVariantId: variant2_1._id,
              variantId: variant2_1._id,
              vendorId: vendorA._id,
              sku: variant2_1.sku,
              productName: product2.name,
              unitPrice: mongoose.Types.Decimal128.fromString("1499.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("1499.00"),
              currency: "INR",
              quantity: 1,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      const p2 = result.items.find((i) => i.sku === variant2_1.sku);
      expect(p2).toBeDefined();
      expect(p2.productVariantId).toBeDefined();
    });
  });

  describe("11. Empty order collection or non-matching query", () => {
    it("returns valid empty pagination structure without throwing errors", async () => {
      const nonExistentVendorId = new mongoose.Types.ObjectId();
      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: nonExistentVendorId,
      });

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("12. Multiple vendors with isolated data (tenant isolation)", () => {
    it("strictly isolates vendor performance: vendor A cannot see vendor B's sales or inventory", async () => {
      // Create Order for Vendor B
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-VENDOR-B-${Date.now()}-12`,
          vendorId: vendorB._id,
          items: [
            {
              productId: productB._id,
              productVariantId: variantB_1._id,
              vendorId: vendorB._id,
              warehouseId: testWarehouse1._id,
              sku: variantB_1.sku,
              productName: productB.name,
              variantName: variantB_1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("4999.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("9998.00"),
              currency: "INR",
              quantity: 2,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      // Query for Vendor A
      const resA = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      // Vendor A must not see Vendor B's keyboard
      const vendorBItemInA = resA.items.find((i) => i.sku === variantB_1.sku);
      expect(vendorBItemInA).toBeUndefined();

      // Query for Vendor B
      const resB = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorB._id,
      });

      expect(resB.items.length).toBe(1);
      expect(resB.items[0].sku).toBe(variantB_1.sku);
      expect(resB.items[0].unitsSold).toBe(2);
      expect(resB.items[0].grossSales).toBe(9998);
      expect(resB.items[0].currentStock).toBe(60);
      expect(resB.items[0].availableStock).toBe(56); // 60 onHand - 4 reserved
    });
  });

  describe("13. Date-filtered analytics boundary validation", () => {
    it("strictly filters orders outside the requested date range", async () => {
      // Create past order 60 days ago (outside 30-day window)
      const pastDate = new Date(now.getTime() - 60 * 86400000);
      await Order.create(
        createOrderPayload({
          orderNumber: `ORD-PAST-60D-${Date.now()}-13`,
          createdAt: pastDate,
          items: [
            {
              productId: product1._id,
              productVariantId: variant1_1._id,
              vendorId: vendorA._id,
              sku: variant1_1.sku,
              productName: product1.name,
              unitPrice: mongoose.Types.Decimal128.fromString("2999.00"),
              lineTotal: mongoose.Types.Decimal128.fromString("29990.00"),
              currency: "INR",
              quantity: 10,
              fulfillmentStatus: "delivered",
            },
          ],
        })
      );

      // Query with 30-day range
      const resRecent = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
      });

      // Query with 90-day range (including the past order)
      const wideStartDate = new Date(now.getTime() - 90 * 86400000);
      const resWide = await analyticsRepository.getProductPerformance({
        startDate: wideStartDate,
        endDate,
        vendorId: vendorA._id,
      });

      const recentUnits = resRecent.items.find((i) => i.sku === variant1_1.sku).unitsSold;
      const wideUnits = resWide.items.find((i) => i.sku === variant1_1.sku).unitsSold;

      expect(wideUnits).toBe(recentUnits + 10);
    });
  });

  describe("14. Product with zero fulfilled sales", () => {
    it("returns zero sales for products that have not been fulfilled or ordered in range", async () => {
      // Create a brand new product for vendor A with no orders
      const unOrderedProduct = await Product.create({
        name: "Unsold Webcam 4K",
        slug: `webcam-${Date.now()}`,
        vendorId: vendorA._id,
        categoryId: category._id,
        description: "4K Webcam",
        sku: `PROD-CAM-${Date.now()}`,
        price: 4500,
        status: "active",
        approvalStatus: "approved",
      });

      const unOrderedVariant = await ProductVariant.create({
        productId: unOrderedProduct._id,
        name: "Standard",
        sku: `CAM-4K-${Date.now()}`,
        price: mongoose.Types.Decimal128.fromString("4500.00"),
        stock: 15,
        isActive: true,
      });

      const result = await analyticsRepository.getProductPerformance({
        startDate,
        endDate,
        vendorId: vendorA._id,
        search: "Webcam",
      });

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("15. Product with no return history & Service Layer Dual Contract Parity", () => {
    it("service layer provides backwards-compatible and dual-contract fields (currentStock, totalStockOnHand, availableStock, totalAvailableStock, netUnitsSold)", async () => {
      const serviceResult = await analyticsService.getVendorProductPerformance({
        userId: vendorAUser._id,
        query: {
          period: "last_30_days",
          page: 1,
          limit: 10,
          sortBy: "unitsSold",
          sortOrder: "desc",
        },
      });

      expect(serviceResult).toBeDefined();
      expect(Array.isArray(serviceResult.products)).toBe(true);
      expect(Array.isArray(serviceResult.items)).toBe(true);
      expect(serviceResult.products.length).toBeGreaterThan(0);

      const firstProduct = serviceResult.products[0];
      // Verify all dual-contract field mappings
      expect(firstProduct).toHaveProperty("currentStock");
      expect(firstProduct).toHaveProperty("totalStockOnHand");
      expect(firstProduct).toHaveProperty("availableStock");
      expect(firstProduct).toHaveProperty("totalAvailableStock");
      expect(firstProduct).toHaveProperty("variantId");
      expect(firstProduct).toHaveProperty("productVariantId");
      expect(firstProduct).toHaveProperty("unitsSold");
      expect(firstProduct).toHaveProperty("returnedUnits");
      expect(firstProduct).toHaveProperty("netUnitsSold");

      expect(firstProduct.currentStock).toBe(firstProduct.totalStockOnHand);
      expect(firstProduct.availableStock).toBe(firstProduct.totalAvailableStock);
      expect(firstProduct.netUnitsSold).toBe(
        Math.max(0, firstProduct.unitsSold - firstProduct.returnedUnits)
      );
    });
  });
});
