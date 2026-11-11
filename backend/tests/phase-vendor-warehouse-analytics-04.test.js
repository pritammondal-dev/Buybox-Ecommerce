const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const StockTransfer = require("../src/models/StockTransfer");
const StockCount = require("../src/models/StockCount");
const Order = require("../src/models/Order");

const warehouseAnalyticsService = require("../src/services/warehouse-analytics.service");
const AppError = require("../src/errors/AppError");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase: VENDOR-WAREHOUSE-ANALYTICS-04 — Advanced Warehouse Analytics & Inventory Intelligence", () => {
  let vendorAUser, vendorA;
  let vendorBUser, vendorB;
  let testCategory;
  let warehouse1, warehouse2;
  let productA1, variantA1_1, variantA1_2;
  let productA2, variantA2_1;
  let productB1, variantB1_1;
  let invA1_1_wh1, invA1_2_wh1, invA2_1_wh1;
  let invA1_1_wh2, invB1_1_wh1;

  async function createTestUser(role, prefix) {
    const rand = Math.random().toString(36).substring(7);
    const randPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    return User.create({
      firstName: `${prefix}First`,
      lastName: `${prefix}Last`,
      email: `${prefix.toLowerCase()}_${Date.now()}_${rand}@wh-analytics.test`,
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
      businessName: `${name} Analytics Ltd ${rand}`,
      businessSlug: `${name.toLowerCase()}-analytics-${rand}`,
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
    const vA = await createTestVendor("MerchantAnalyticsAlpha");
    vendorAUser = vA.user;
    vendorA = vA.vendor;

    const vB = await createTestVendor("MerchantAnalyticsBeta");
    vendorBUser = vB.user;
    vendorB = vB.vendor;

    // 2. Create Category
    testCategory = await Category.create({
      name: `Analytics Category ${Date.now()}`,
      slug: `analytics-cat-${Date.now()}`,
      isActive: true,
    });

    // 3. Create Warehouses
    warehouse1 = await Warehouse.create({
      name: "Primary Fulfillment Hub Mumbai",
      code: `HUB-AN-MUM-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Plot 45 Logistics Park",
        city: "Bhiwandi",
        state: "Maharashtra",
        postalCode: "421302",
        country: "IN",
      },
      capacity: 100000,
      isActive: true,
    });

    warehouse2 = await Warehouse.create({
      name: "Secondary Hub Bengaluru",
      code: `HUB-AN-BLR-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Hosur Road Phase 1",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560068",
        country: "IN",
      },
      capacity: 50000,
      isActive: true,
    });

    // 4. Create Vendor A Products & Variants
    productA1 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "High Precision Mechanical Keyboard",
      slug: `an-keyboard-${Date.now()}`,
      sku: "AN-PROD-KEYBOARD",
      price: 6500,
      status: "active",
      images: [{ url: "https://cdn.test/kb.jpg", isDefault: true }],
    });

    variantA1_1 = await ProductVariant.create({
      productId: productA1._id,
      sku: "AN-KB-RGB-RED",
      name: "Linear Red Switches / RGB",
      price: 6500,
      costPrice: 4200,
      stockStatus: "in_stock",
    });

    variantA1_2 = await ProductVariant.create({
      productId: productA1._id,
      sku: "AN-KB-RGB-BRN",
      name: "Tactile Brown Switches / RGB",
      price: 6800,
      costPrice: 4400,
      stockStatus: "in_stock",
    });

    productA2 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Coiled Aviator Cable",
      slug: `an-cable-${Date.now()}`,
      sku: "AN-PROD-CABLE",
      price: 1200,
      status: "active",
      images: [{ url: "https://cdn.test/cable.jpg", isDefault: true }],
    });

    variantA2_1 = await ProductVariant.create({
      productId: productA2._id,
      sku: "AN-CABLE-BLK",
      name: "Matte Black Coiled Cable",
      price: 1200,
      costPrice: 650,
      stockStatus: "in_stock",
    });

    // 5. Create Vendor B Products & Variants (For Multi-Tenant Isolation)
    productB1 = await Product.create({
      vendorId: vendorB._id,
      categoryId: testCategory._id,
      name: "Ergonomic Wrist Rest",
      slug: `an-wrist-${Date.now()}`,
      sku: "AN-PROD-WRIST",
      price: 1500,
      status: "active",
      images: [{ url: "https://cdn.test/wrist.jpg", isDefault: true }],
    });

    variantB1_1 = await ProductVariant.create({
      productId: productB1._id,
      sku: "AN-WRIST-WALNUT",
      name: "Solid Walnut Wrist Rest",
      price: 1500,
      costPrice: 800,
      stockStatus: "in_stock",
    });

    // 6. Create Vendor A Inventory in Warehouse 1
    // invA1_1_wh1: onHand=60, reserved=5, damaged=2, defective=1, expired=0 -> available = 60 - 5 - 3 = 52
    invA1_1_wh1 = await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA1_1._id,
      onHand: 60,
      reserved: 5,
      damaged: 2,
      defective: 1,
      expired: 0,
      lowStockThreshold: 15,
      reorderPoint: 25,
      reorderQuantity: 40,
      lastStockUpdateAt: new Date(),
    });

    // invA1_2_wh1: onHand=10, reserved=2, damaged=0 -> available = 8 <= lowStockThreshold (15) -> Low Stock
    invA1_2_wh1 = await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA1_2._id,
      onHand: 10,
      reserved: 2,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 15,
      reorderPoint: 20,
      reorderQuantity: 30,
      lastStockUpdateAt: new Date(),
    });

    // invA2_1_wh1: onHand=0, reserved=0 -> available = 0 -> Out of Stock
    invA2_1_wh1 = await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantA2_1._id,
      onHand: 0,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 5,
      reorderPoint: 10,
      reorderQuantity: 20,
      lastStockUpdateAt: new Date(),
    });

    // 7. Create Vendor A Inventory in Warehouse 2
    invA1_1_wh2 = await Inventory.create({
      warehouseId: warehouse2._id,
      productVariantId: variantA1_1._id,
      onHand: 25,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 10,
      reorderPoint: 15,
      reorderQuantity: 20,
      lastStockUpdateAt: new Date(),
    });

    // 8. Create Vendor B Inventory (Tenant Isolation)
    invB1_1_wh1 = await Inventory.create({
      warehouseId: warehouse1._id,
      productVariantId: variantB1_1._id,
      onHand: 100,
      reserved: 10,
      damaged: 5,
      defective: 0,
      expired: 0,
      lowStockThreshold: 20,
      lastStockUpdateAt: new Date(),
    });

    // 9. Create Historical Transactions for Movements & Aging
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000);
    const seventyDaysAgo = new Date(now.getTime() - 70 * 86400000);

    // Initial receive 70 days ago: 50 units of variantA1_1
    await InventoryTransaction.create({
      productVariantId: variantA1_1._id,
      warehouseId: warehouse1._id,
      vendorId: vendorA._id,
      type: "receive",
      quantity: 50,
      onHandBefore: 0,
      onHandAfter: 50,
      reservedBefore: 0,
      reservedAfter: 0,
      referenceType: "purchase_order",
      referenceId: "PO-70D",
      createdAt: seventyDaysAgo,
    });

    // Additional receive 40 days ago: 30 units of variantA1_1
    await InventoryTransaction.create({
      productVariantId: variantA1_1._id,
      warehouseId: warehouse1._id,
      vendorId: vendorA._id,
      type: "receive",
      quantity: 30,
      onHandBefore: 50,
      onHandAfter: 80,
      reservedBefore: 0,
      reservedAfter: 0,
      referenceType: "purchase_order",
      referenceId: "PO-40D",
      createdAt: fortyDaysAgo,
    });

    // Recent sale 10 days ago: 20 units of variantA1_1 (leaving 60 units on hand)
    await InventoryTransaction.create({
      productVariantId: variantA1_1._id,
      warehouseId: warehouse1._id,
      vendorId: vendorA._id,
      type: "sale",
      quantity: -20,
      onHandBefore: 80,
      onHandAfter: 60,
      reservedBefore: 20,
      reservedAfter: 0,
      referenceType: "order",
      referenceId: "ORD-10D",
      createdAt: tenDaysAgo,
    });

    // Internal Transfer: 10 units transferred out of wh1 to wh2
    await InventoryTransaction.create({
      productVariantId: variantA1_1._id,
      warehouseId: warehouse1._id,
      vendorId: vendorA._id,
      type: "transfer",
      quantity: -10,
      onHandBefore: 70,
      onHandAfter: 60,
      reservedBefore: 0,
      reservedAfter: 0,
      referenceType: "stock_transfer",
      referenceId: "TR-001",
      createdAt: tenDaysAgo,
    });

    // Condition change: 2 units damaged
    await InventoryTransaction.create({
      productVariantId: variantA1_1._id,
      warehouseId: warehouse1._id,
      vendorId: vendorA._id,
      type: "condition_change",
      quantity: 2,
      onHandBefore: 60,
      onHandAfter: 60,
      reservedBefore: 0,
      reservedAfter: 0,
      referenceType: "damage_flag",
      notes: "Damaged packaging in storage rack",
      createdAt: tenDaysAgo,
    });

    // 10. Create Stock Count Session for Audit Accuracy
    await StockCount.create({
      countNumber: `SC-TEST-${Date.now()}`,
      vendorId: vendorA._id,
      warehouseId: warehouse1._id,
      scope: "full",
      status: "reconciled",
      createdBy: vendorAUser._id,
      startedAt: tenDaysAgo,
      completedAt: tenDaysAgo,
      reconciledAt: tenDaysAgo,
      skuAccuracyRate: 97.5,
      quantityAccuracyRate: 97.5,
      items: [
        {
          productId: productA1._id,
          productVariantId: variantA1_1._id,
          sku: variantA1_1.sku,
          productName: variantA1_1.name,
          snapshotOnHand: 60,
          countedOnHand: 59,
          discrepancy: -1,
          shortageQuantity: 1,
        },
      ],
      metrics: {
        totalItemsCounted: 1,
        matchedItems: 0,
        discrepantItems: 1,
        netDiscrepancyUnits: -1,
        netDiscrepancyValue: -4200,
        accuracyRate: 97.5,
      },
    });

    // 11. Create Fulfilled Orders for Demand Intelligence
    const customerUser = await createTestUser("customer", "CustomerDemand");
    await Order.create({
      orderNumber: `ORD-DEMAND-${Date.now()}-1`,
      customerId: customerUser._id,
      userId: customerUser._id,
      status: "delivered",
      paymentStatus: "paid",
      subtotal: mongoose.Types.Decimal128.fromString("97500.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("97500.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Customer Demand",
        phone: "+919876543210",
        addressLine1: "123 Tech Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: productA1._id,
          productVariantId: variantA1_1._id,
          variantId: variantA1_1._id,
          vendorId: vendorA._id,
          warehouseId: warehouse1._id,
          sku: variantA1_1.sku,
          productName: variantA1_1.name,
          name: variantA1_1.name,
          unitPrice: mongoose.Types.Decimal128.fromString("6500.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("97500.00"),
          currency: "INR",
          quantity: 15,
          subtotal: 97500,
          totalPrice: 97500,
          fulfillmentStatus: "delivered",
        },
      ],
      createdAt: new Date(now.getTime() - 5 * 86400000), // 5 days ago
    });

    // Cancelled Order (Must be excluded from demand)
    await Order.create({
      orderNumber: `ORD-CANCELLED-${Date.now()}-2`,
      customerId: customerUser._id,
      userId: customerUser._id,
      status: "cancelled",
      cancellationStatus: "completed",
      paymentStatus: "pending",
      subtotal: mongoose.Types.Decimal128.fromString("325000.00"),
      grandTotal: mongoose.Types.Decimal128.fromString("325000.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Customer Cancelled",
        phone: "+919876543210",
        addressLine1: "123 Tech Park",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
      items: [
        {
          productId: productA1._id,
          productVariantId: variantA1_1._id,
          variantId: variantA1_1._id,
          vendorId: vendorA._id,
          warehouseId: warehouse1._id,
          sku: variantA1_1.sku,
          productName: variantA1_1.name,
          name: variantA1_1.name,
          unitPrice: mongoose.Types.Decimal128.fromString("6500.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("325000.00"),
          currency: "INR",
          quantity: 50,
          subtotal: 325000,
          totalPrice: 325000,
          fulfillmentStatus: "unfulfilled",
        },
      ],
      createdAt: new Date(now.getTime() - 2 * 86400000),
    });

    // 12. Create In-Transit Stock Transfer to Warehouse 1
    await StockTransfer.create({
      vendorId: vendorA._id,
      sourceWarehouseId: warehouse2._id,
      destinationWarehouseId: warehouse1._id,
      transferNumber: `TR-INTRANSIT-${Date.now()}`,
      status: "in_transit",
      items: [
        {
          productVariantId: variantA1_2._id,
          sku: variantA1_2.sku,
          productName: variantA1_2.name,
          requestedQuantity: 10,
          dispatchedQuantity: 10,
          receivedQuantity: 0,
        },
      ],
      dispatchedAt: new Date(now.getTime() - 1 * 86400000),
      createdBy: vendorAUser._id,
    });
  });

  afterAll(async () => {
    if (vendorA?._id) {
      await StockTransfer.deleteMany({ vendorId: vendorA._id });
      await StockCount.deleteMany({ vendorId: vendorA._id });
      await InventoryTransaction.deleteMany({ vendorId: vendorA._id });
      await Order.deleteMany({ "items.vendorId": vendorA._id });
      await Inventory.deleteMany({
        productVariantId: { $in: [variantA1_1?._id, variantA1_2?._id, variantA2_1?._id] },
      });
      await ProductVariant.deleteMany({
        _id: { $in: [variantA1_1?._id, variantA1_2?._id, variantA2_1?._id] },
      });
      await Product.deleteMany({ _id: { $in: [productA1?._id, productA2?._id] } });
      await Vendor.deleteOne({ _id: vendorA._id });
      await User.deleteOne({ _id: vendorAUser._id });
    }

    if (vendorB?._id) {
      await StockTransfer.deleteMany({ vendorId: vendorB._id });
      await StockCount.deleteMany({ vendorId: vendorB._id });
      await InventoryTransaction.deleteMany({ vendorId: vendorB._id });
      await Inventory.deleteMany({ productVariantId: variantB1_1?._id });
      await ProductVariant.deleteMany({ _id: variantB1_1?._id });
      await Product.deleteMany({ _id: productB1?._id });
      await Vendor.deleteOne({ _id: vendorB._id });
      await User.deleteOne({ _id: vendorBUser._id });
    }

    if (warehouse1?._id) await Warehouse.deleteOne({ _id: warehouse1._id });
    if (warehouse2?._id) await Warehouse.deleteOne({ _id: warehouse2._id });
    if (testCategory?._id) await Category.deleteOne({ _id: testCategory._id });
  });

  // ============================================================
  // SUITE 1: AUTHORITATIVE WAREHOUSE OVERVIEW KPIS & FILTERING
  // ============================================================
  describe("1. Warehouse Overview KPIs & Multi-Warehouse Scope Aggregation", () => {
    it("should aggregate authoritative metrics for all warehouses belonging to Vendor A", async () => {
      const overview = await warehouseAnalyticsService.getVendorWarehouseOverview({
        userId: vendorAUser._id,
        warehouseId: "all",
      });

      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      // Vendor A has 3 SKUs across warehouses
      expect(overview.kpis.totalSkus).toBe(3);
      // On-hand: wh1 has 60 + 10 + 0 = 70; wh2 has 25 -> Total on-hand = 95
      expect(overview.kpis.totalOnHandUnits).toBe(95);
      // Reserved: wh1 has 5 + 2 = 7; wh2 has 0 -> Total reserved = 7
      expect(overview.kpis.totalReservedUnits).toBe(7);
      // Non-sellable: wh1 has (2 damaged + 1 defective) = 3 -> Total = 3
      expect(overview.kpis.totalNonSellableUnits).toBe(3);
      // Available: 95 - 7 - 3 = 85
      expect(overview.kpis.totalAvailableUnits).toBe(85);
      // Low stock SKU count (variantA1_2 has available 8 <= 15)
      expect(overview.kpis.lowStockSkusCount).toBeGreaterThanOrEqual(1);
      // Out of stock SKU count (variantA2_1 has available 0)
      expect(overview.kpis.outOfStockSkusCount).toBeGreaterThanOrEqual(1);
      // Active warehouses count
      expect(overview.kpis.activeWarehousesCount).toBe(2);
      // Historical audit accuracy from stock count
      expect(overview.kpis.latestInventoryAccuracyRate).toBe(97.5);
      // Financial valuation
      expect(overview.kpis.retailValuation).toBeGreaterThan(0);
      expect(overview.kpis.costValuation).toBeGreaterThan(0);
    });

    it("should correctly filter KPIs for a single warehouse (Warehouse 1)", async () => {
      const overview = await warehouseAnalyticsService.getVendorWarehouseOverview({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
      });

      expect(overview.selectedWarehouse).toBe(warehouse1._id.toString());
      // On-hand in WH1: 60 + 10 + 0 = 70
      expect(overview.kpis.totalOnHandUnits).toBe(70);
      expect(overview.kpis.totalReservedUnits).toBe(7);
      expect(overview.kpis.totalNonSellableUnits).toBe(3);
      expect(overview.kpis.totalAvailableUnits).toBe(60); // 70 - 7 - 3
    });
  });

  // ============================================================
  // SUITE 2: INVENTORY MOVEMENT LEDGER ANALYTICS
  // ============================================================
  describe("2. Inventory Movement Analytics & Internal Transfer Separation", () => {
    it("should categorize inbound vs outbound and separate internal transfer volume", async () => {
      const movements = await warehouseAnalyticsService.getVendorMovementAnalytics({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
        days: 90,
      });

      expect(movements).toBeDefined();
      expect(movements.summary).toBeDefined();
      // Inbound: PO-70D (50) + PO-40D (30) = 80
      expect(movements.summary.totalInboundUnits).toBe(80);
      // Outbound: Sale ORD-10D (20)
      expect(movements.summary.totalOutboundUnits).toBe(20);
      // Net change
      expect(movements.summary.netStockChange).toBe(60);
      // Internal transfers must be separated to avoid inflating sales demand
      expect(movements.summary.totalTransferUnits).toBe(10);
      // Breakdown by type
      expect(movements.summary.byType.receive).toBe(80);
      expect(movements.summary.byType.sale).toBe(20);
      expect(movements.summary.byType.transfer).toBe(10);
      // Time series
      expect(Array.isArray(movements.timeSeries)).toBe(true);
      expect(movements.timeSeries.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // SUITE 3: INVENTORY AGING & FIFO DEPLETION ALLOCATION
  // ============================================================
  describe("3. Inventory Aging Analytics (FIFO Depletion Queue Allocation)", () => {
    it("should allocate on-hand stock into correct aging brackets and disclose FIFO methodology", async () => {
      const aging = await warehouseAnalyticsService.getVendorInventoryAging({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
      });

      expect(aging).toBeDefined();
      expect(aging.methodology).toBe("fifo_depletion_allocation");
      expect(aging.disclosure).toBeDefined();
      expect(aging.disclosure).toContain("FIFO queue allocation");

      // Verify brackets presence
      expect(aging.brackets).toBeDefined();
      expect(aging.brackets["0-30"]).toBeDefined();
      expect(aging.brackets["31-60"]).toBeDefined();
      expect(aging.brackets["61-90"]).toBeDefined();
      expect(aging.brackets["91-180"]).toBeDefined();
      expect(aging.brackets["181+"]).toBeDefined();

      // variantA1_1: onHand=60. Receipts: 30 at 40d ago, 50 at 70d ago.
      // FIFO depletion: remaining 60 units are 30 from 40d (in 31-60 bracket) and 30 from 70d (in 61-90 bracket).
      expect(aging.brackets["31-60"].units).toBeGreaterThanOrEqual(30);
      expect(aging.brackets["61-90"].units).toBeGreaterThanOrEqual(30);

      // Verify items breakdown
      expect(Array.isArray(aging.items)).toBe(true);
      const keyboardItem = aging.items.find((i) => i.sku === variantA1_1.sku);
      expect(keyboardItem).toBeDefined();
      expect(keyboardItem.onHand).toBe(60);
      expect(keyboardItem.ageBrackets["31-60"]).toBe(30);
      expect(keyboardItem.ageBrackets["61-90"]).toBe(30);
    });

    it("should accurately identify slow-moving and zero-sales items", async () => {
      const aging = await warehouseAnalyticsService.getVendorInventoryAging({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
      });

      // variantA1_2 has had no sales recorded
      expect(aging.summary.zeroSalesCount).toBeGreaterThanOrEqual(1);
      const zeroSale = aging.items.find((i) => i.sku === variantA1_2.sku);
      expect(zeroSale).toBeDefined();
      expect(zeroSale.isZeroSales).toBe(true);
    });
  });

  // ============================================================
  // SUITE 4: INVENTORY TURNOVER & DIO WITH COST-DATA GUARD
  // ============================================================
  describe("4. Inventory Turnover & DIO Guard (Incomplete Cost Protection)", () => {
    it("should compute cost-based turnover when >= 80% catalog cost data exists", async () => {
      // Currently all 3 variants of Vendor A have costPrice populated (100% coverage)
      const turnover = await warehouseAnalyticsService.getVendorInventoryTurnover({
        userId: vendorAUser._id,
        warehouseId: "all",
        days: 90,
      });

      expect(turnover).toBeDefined();
      expect(turnover.costBasedTurnoverAvailable).toBe(true);
      expect(turnover.costCoveragePercent).toBe(100);
      expect(turnover.turnoverRatio).toBeGreaterThan(0);
      expect(turnover.dio).toBeGreaterThan(0);
      // Unit movement velocity must always be available
      expect(turnover.stockMovementVelocity).toBeDefined();
      expect(turnover.stockMovementVelocity.velocityRatio).toBeGreaterThan(0);
    });

    it("should safely mark cost-based turnover as UNAVAILABLE when cost data < 80%", async () => {
      // Temporarily unset costPrice on variants to drop coverage below 80%
      await ProductVariant.updateMany(
        { productId: productA1._id },
        { $unset: { costPrice: "" } }
      );

      const turnoverIncomplete = await warehouseAnalyticsService.getVendorInventoryTurnover({
        userId: vendorAUser._id,
        warehouseId: "all",
        days: 90,
      });

      expect(turnoverIncomplete.costBasedTurnoverAvailable).toBe(false);
      expect(turnoverIncomplete.reason).toBe("cost_data_incomplete");
      expect(turnoverIncomplete.turnoverRatio).toBeNull();
      expect(turnoverIncomplete.dio).toBeNull();
      // Crucial: Must NEVER invent fake 0 or infinite numbers
      expect(turnoverIncomplete.costCoveragePercent).toBeLessThan(80);

      // But unit-based velocity MUST still function accurately!
      expect(turnoverIncomplete.stockMovementVelocity).toBeDefined();
      expect(turnoverIncomplete.stockMovementVelocity.velocityRatio).toBeGreaterThan(0);

      // Restore costPrice for subsequent tests
      await ProductVariant.updateOne({ _id: variantA1_1._id }, { $set: { costPrice: 4200 } });
      await ProductVariant.updateOne({ _id: variantA1_2._id }, { $set: { costPrice: 4400 } });
    });
  });

  // ============================================================
  // SUITE 5: DEMAND & REPLENISHMENT INTELLIGENCE
  // ============================================================
  describe("5. Demand & Replenishment Intelligence & Risk Classification", () => {
    it("should calculate fulfilled sales demand, days of cover, and risk levels", async () => {
      const replenishment = await warehouseAnalyticsService.getVendorDemandAndReplenishment({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
        windowDays: 30,
        leadTimeDays: 7,
      });

      expect(replenishment).toBeDefined();
      expect(replenishment.summary).toBeDefined();
      expect(Array.isArray(replenishment.items)).toBe(true);

      // Find variantA1_1 which had 15 units delivered via ORD-DEMAND
      const item1 = replenishment.items.find((i) => i.sku === variantA1_1.sku);
      expect(item1).toBeDefined();
      expect(item1.windowSalesDemand).toBe(15);
      expect(item1.averageDailyDemand).toBeCloseTo(15 / 30, 2);
      // Days of cover = available (52) / 0.5 = ~104 days -> 'overstock' (>60d)
      expect(item1.riskLevel).toBe("overstock");

      // Find variantA2_1 which has available = 0 -> 'critical'
      const itemOut = replenishment.items.find((i) => i.sku === variantA2_1.sku);
      expect(itemOut).toBeDefined();
      expect(itemOut.riskLevel).toBe("critical");
      expect(itemOut.suggestedReorderQuantity).toBeGreaterThan(0);
    });

    it("should exclude cancelled orders from demand velocity calculation", async () => {
      const replenishment = await warehouseAnalyticsService.getVendorDemandAndReplenishment({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
        windowDays: 30,
      });

      const item1 = replenishment.items.find((i) => i.sku === variantA1_1.sku);
      // Cancelled order ORD-CANCELLED had 50 units. If it were included, demand would be 65.
      // Authoritative fulfilled demand must strictly be 15 units.
      expect(item1.windowSalesDemand).toBe(15);
    });

    it("should account for in-transit stock transfers when calculating reorder needs", async () => {
      const replenishment = await warehouseAnalyticsService.getVendorDemandAndReplenishment({
        userId: vendorAUser._id,
        warehouseId: warehouse1._id.toString(),
      });

      // variantA1_2 has an in-transit transfer of 10 units destined for warehouse1
      const item2 = replenishment.items.find((i) => i.sku === variantA1_2.sku);
      expect(item2).toBeDefined();
      expect(item2.inTransitTransferUnits).toBe(10);
      // Suggested reorder = max(0, reorderPoint (20) + reorderQty (30) - available (8) - inTransit (10)) = 50 - 18 = 32
      expect(item2.suggestedReorderQuantity).toBe(32);
    });
  });

  // ============================================================
  // SUITE 6: WAREHOUSE OPERATIONAL PERFORMANCE
  // ============================================================
  describe("6. Warehouse Operational Performance & Transfer Discrepancy Tracking", () => {
    it("should measure receiving rates, transfer completions, condition adjustments, and audit accuracy", async () => {
      const operations = await warehouseAnalyticsService.getVendorWarehouseOperations({
        userId: vendorAUser._id,
        warehouseId: "all",
        days: 90,
      });

      expect(operations).toBeDefined();
      // Receiving metrics
      expect(operations.receiving).toBeDefined();
      expect(operations.receiving.totalReceivedUnits).toBe(80);
      expect(operations.receiving.fulfillmentRatePercent).toBe(100);

      // Transfer metrics
      expect(operations.transfers).toBeDefined();
      expect(operations.transfers.inTransitTransfers).toBeGreaterThanOrEqual(1);

      // Condition adjustments
      expect(operations.adjustments).toBeDefined();
      expect(operations.adjustments.conditionChangeEvents).toBeGreaterThanOrEqual(1);
      expect(operations.adjustments.totalDamagedUnits).toBeGreaterThanOrEqual(2);

      // Audit performance
      expect(operations.auditPerformance).toBeDefined();
      expect(operations.auditPerformance.reconciledSessionsCount).toBe(1);
      expect(operations.auditPerformance.averageAuditAccuracyRate).toBe(97.5);
    });
  });

  // ============================================================
  // SUITE 7: MULTI-TENANT ISOLATION & SECURITY BOUNDARIES
  // ============================================================
  describe("7. Multi-Tenant Security & Vendor Isolation Boundary", () => {
    it("should strictly isolate Vendor A metrics from Vendor B", async () => {
      const overviewB = await warehouseAnalyticsService.getVendorWarehouseOverview({
        userId: vendorBUser._id,
        warehouseId: "all",
      });

      // Vendor B only has 1 variant (variantB1_1) with 100 on hand
      expect(overviewB.kpis.totalSkus).toBe(1);
      expect(overviewB.kpis.totalOnHandUnits).toBe(100);
      expect(overviewB.kpis.totalReservedUnits).toBe(10);
      expect(overviewB.kpis.totalNonSellableUnits).toBe(5);
      expect(overviewB.kpis.totalAvailableUnits).toBe(85);

      // Vendor B should have 0 transactions recorded
      const movementsB = await warehouseAnalyticsService.getVendorMovementAnalytics({
        userId: vendorBUser._id,
        warehouseId: "all",
        days: 90,
      });
      expect(movementsB.summary.totalInboundUnits).toBe(0);
      expect(movementsB.summary.totalOutboundUnits).toBe(0);
    });

    it("should return empty isolated metrics if a vendor queries an unauthorized warehouse", async () => {
      const bogusWarehouseId = new mongoose.Types.ObjectId();
      const overview = await warehouseAnalyticsService.getVendorWarehouseOverview({
        userId: vendorAUser._id,
        warehouseId: bogusWarehouseId.toString(),
      });

      expect(overview.kpis.totalSkus).toBe(0);
      expect(overview.kpis.totalOnHandUnits).toBe(0);
      expect(overview.kpis.totalAvailableUnits).toBe(0);
    });
  });

  // ============================================================
  // SUITE 8: EXPORT SANITIZATION & FORMULA INJECTION PREVENTION
  // ============================================================
  describe("8. Export Generation & Formula Injection Sanitization", () => {
    it("should generate a sanitized CSV export without formula injection vulnerabilities", async () => {
      const csvExport = await warehouseAnalyticsService.exportVendorWarehouseAnalytics({
        userId: vendorAUser._id,
        warehouseId: "all",
        type: "overview",
        format: "csv",
      });

      expect(csvExport).toBeDefined();
      expect(csvExport.contentType).toContain("text/csv");
      expect(typeof csvExport.data).toBe("string");
      expect(csvExport.filename).toContain("warehouse_overview");

      // Verify that dangerous formula prefixes (=, +, -, @) are sanitized
      const dangerousLines = csvExport.data
        .split("\n")
        .filter((line) => line.startsWith("=") || line.startsWith("+") || line.startsWith("@"));
      expect(dangerousLines.length).toBe(0);
    });

    it("should export inventory aging data successfully", async () => {
      const csvAging = await warehouseAnalyticsService.exportVendorWarehouseAnalytics({
        userId: vendorAUser._id,
        warehouseId: "all",
        type: "aging",
        format: "csv",
      });

      expect(csvAging).toBeDefined();
      expect(csvAging.filename).toContain("warehouse_aging");
      expect(csvAging.data).toContain("0-30 Days");
      expect(csvAging.data).toContain("181+ Days");
    });
  });
});
