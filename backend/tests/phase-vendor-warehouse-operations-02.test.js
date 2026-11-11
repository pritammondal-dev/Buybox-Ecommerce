const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const StockReceiving = require("../src/models/StockReceiving");
const StockTransfer = require("../src/models/StockTransfer");
const CustomerNotification = require("../src/models/CustomerNotification");

const stockReceivingService = require("../src/services/stock-receiving.service");
const stockTransferService = require("../src/services/stock-transfer.service");
const inventoryService = require("../src/services/inventory.service");
const AppError = require("../src/errors/AppError");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase: VENDOR-WAREHOUSE-OPERATIONS-02 — Complete Vendor Warehouse Operations", () => {
  let vendorAUser, vendorA;
  let vendorBUser, vendorB;
  let testCategory;
  let sourceWarehouse, destWarehouse;
  let productA1, variantA1_1, variantA1_2;
  let productB1, variantB1_1;
  let inventoryA1_source, inventoryA2_source, inventoryB1_source;

  async function createTestUser(role, prefix) {
    const rand = Math.random().toString(36).substring(7);
    const randPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    return User.create({
      firstName: `${prefix}First`,
      lastName: `${prefix}Last`,
      email: `${prefix.toLowerCase()}_${Date.now()}_${rand}@wh-ops.test`,
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
      businessName: `${name} Logistics Ltd ${rand}`,
      businessSlug: `${name.toLowerCase()}-logistics-${rand}`,
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
    const vA = await createTestVendor("MerchantAlpha");
    vendorAUser = vA.user;
    vendorA = vA.vendor;

    const vB = await createTestVendor("MerchantBeta");
    vendorBUser = vB.user;
    vendorB = vB.vendor;

    // 2. Create Category
    testCategory = await Category.create({
      name: `WH Category ${Date.now()}`,
      slug: `wh-cat-${Date.now()}`,
      isActive: true,
    });

    // 3. Create Warehouses
    sourceWarehouse = await Warehouse.create({
      name: "North Regional Logistics Hub",
      code: `DEL-HUB-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Sector 18, Udyog Vihar",
        city: "Gurugram",
        state: "Haryana",
        postalCode: "122015",
        country: "IN",
      },
      capacity: 100000,
      isActive: true,
    });

    destWarehouse = await Warehouse.create({
      name: "West Express Distribution Hub",
      code: `BOM-EXP-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Express Depot",
      address: {
        addressLine1: "MIDC Industrial Area",
        city: "Navi Mumbai",
        state: "Maharashtra",
        postalCode: "400705",
        country: "IN",
      },
      capacity: 50000,
      isActive: true,
    });

    // 4. Create Vendor A Products & Variants
    productA1 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Ergonomic Desk Pro",
      slug: `desk-pro-${Date.now()}`,
      sku: "PROD-DESK-A1",
      price: 18500,
      status: "active",
      images: [{ url: "https://cdn.test/desk.jpg", isDefault: true }],
    });

    variantA1_1 = await ProductVariant.create({
      productId: productA1._id,
      sku: "DESK-A1-OAK",
      name: "Oak Finish / 140cm",
      price: 18500,
      stockStatus: "in_stock",
    });

    variantA1_2 = await ProductVariant.create({
      productId: productA1._id,
      sku: "DESK-A1-WAL",
      name: "Walnut Finish / 160cm",
      price: 21500,
      stockStatus: "in_stock",
    });

    // 5. Create Vendor B Products & Variants (For Multi-Tenant Isolation Testing)
    productB1 = await Product.create({
      vendorId: vendorB._id,
      categoryId: testCategory._id,
      name: "Ergonomic Monitor Arm",
      slug: `monitor-arm-${Date.now()}`,
      sku: "PROD-ARM-B1",
      price: 4999,
      status: "active",
      images: [{ url: "https://cdn.test/arm.jpg", isDefault: true }],
    });

    variantB1_1 = await ProductVariant.create({
      productId: productB1._id,
      sku: "ARM-B1-DUAL",
      name: "Dual Arm / Matte Silver",
      price: 4999,
      stockStatus: "in_stock",
    });

    // 6. Setup Initial Inventory
    // Variant A1_1 at source: onHand=100, reserved=0, damaged=0, defective=0 => available=100
    inventoryA1_source = await Inventory.create({
      warehouseId: sourceWarehouse._id,
      productVariantId: variantA1_1._id,
      onHand: 100,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 10,
      reorderLevel: 25,
    });

    // Variant A1_2 at source: onHand=50, reserved=5, damaged=5 => available = 50 - 5 - 5 = 40
    inventoryA2_source = await Inventory.create({
      warehouseId: sourceWarehouse._id,
      productVariantId: variantA1_2._id,
      onHand: 50,
      reserved: 5,
      damaged: 5,
      defective: 0,
      expired: 0,
      lowStockThreshold: 15,
      reorderLevel: 30,
    });

    // Variant B1_1 at source: onHand=50, reserved=0 => available=50 (Vendor B stock in same warehouse)
    inventoryB1_source = await Inventory.create({
      warehouseId: sourceWarehouse._id,
      productVariantId: variantB1_1._id,
      onHand: 50,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 5,
      reorderLevel: 10,
    });
  });

  afterAll(async () => {
    const warehouseIds = [sourceWarehouse?._id, destWarehouse?._id].filter(Boolean);
    const variantIds = [variantA1_1?._id, variantA1_2?._id, variantB1_1?._id].filter(Boolean);
    const productIds = [productA1?._id, productB1?._id].filter(Boolean);
    const userIds = [vendorAUser?._id, vendorBUser?._id].filter(Boolean);
    const vendorIds = [vendorA?._id, vendorB?._id].filter(Boolean);

    await InventoryTransaction.deleteMany({ productVariantId: { $in: variantIds } });
    await StockReceiving.deleteMany({ warehouseId: { $in: warehouseIds } });
    await StockTransfer.deleteMany({
      $or: [{ sourceWarehouseId: { $in: warehouseIds } }, { destinationWarehouseId: { $in: warehouseIds } }],
    });
    await Inventory.deleteMany({ warehouseId: { $in: warehouseIds } });
    await ProductVariant.deleteMany({ _id: { $in: variantIds } });
    await Product.deleteMany({ _id: { $in: productIds } });
    await Warehouse.deleteMany({ _id: { $in: warehouseIds } });
    await CustomerNotification.deleteMany({ userId: { $in: userIds } });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    await Vendor.deleteMany({ _id: { $in: vendorIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  });

  describe("1. Stock Receiving Operations & Tenant Isolation", () => {
    let createdReceiving;

    it("should create a draft inbound receiving record for Vendor A with valid variants", async () => {
      const receiving = await stockReceivingService.createVendorReceivingRecord({
        userId: vendorAUser._id,
        destinationWarehouseId: sourceWarehouse._id.toString(),
        supplierName: "Premium Furniture Factory Ltd",
        referenceDocNumber: "INV-2026-9901",
        notes: "Restock batch 1 for Q4",
        items: [
          {
            productVariantId: variantA1_1._id.toString(),
            expectedQuantity: 20,
            receivedQuantity: 20,
          },
        ],
      });

      expect(receiving).toBeDefined();
      expect(receiving.status).toBe("draft");
      expect(receiving.vendorId.toString()).toBe(vendorA._id.toString());
      expect(receiving.warehouseId.toString()).toBe(sourceWarehouse._id.toString());
      expect(receiving.items).toHaveLength(1);
      expect(receiving.items[0].sku).toBe("DESK-A1-OAK");
      expect(receiving.items[0].receivedQuantity).toBe(20);

      createdReceiving = receiving;
    });

    it("should strictly reject draft receiving when Vendor A includes a variant owned by Vendor B (403)", async () => {
      await expect(
        stockReceivingService.createVendorReceivingRecord({
          userId: vendorAUser._id,
          destinationWarehouseId: sourceWarehouse._id.toString(),
          supplierName: "Unauthorized Supplier",
          items: [
            {
              productVariantId: variantB1_1._id.toString(), // Belongs to Vendor B
              expectedQuantity: 10,
              receivedQuantity: 10,
            },
          ],
        })
      ).rejects.toThrow("does not belong to your merchant account");
    });

    it("should allow Vendor A to cancel a draft receiving record without affecting inventory", async () => {
      const draftReceiving = await stockReceivingService.createVendorReceivingRecord({
        userId: vendorAUser._id,
        destinationWarehouseId: sourceWarehouse._id.toString(),
        supplierName: "Cancel Supplier",
        items: [
          {
            productVariantId: variantA1_1._id.toString(),
            expectedQuantity: 10,
            receivedQuantity: 10,
          },
        ],
      });

      const cancelled = await stockReceivingService.cancelVendorReceiving({
        userId: vendorAUser._id,
        id: draftReceiving._id.toString(),
        reason: "Supplier cancelled delivery",
      });

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancellationReason).toBe("Supplier cancelled delivery");

      // Verify onHand stock did not change
      const inv = await Inventory.findById(inventoryA1_source._id);
      expect(inv.onHand).toBe(100);
    });

    it("should confirm receiving record, atomically increment onHand stock and record audit transaction", async () => {
      const initialInv = await Inventory.findById(inventoryA1_source._id);
      const initialOnHand = initialInv.onHand; // 100

      const confirmed = await stockReceivingService.confirmVendorReceiving({
        userId: vendorAUser._id,
        id: createdReceiving._id.toString(),
      });

      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.confirmedAt).toBeDefined();

      // Check onHand stock was incremented by received quantity (20)
      const updatedInv = await Inventory.findById(inventoryA1_source._id);
      expect(updatedInv.onHand).toBe(initialOnHand + 20); // 120

      // Check immutable InventoryTransaction created
      const tx = await InventoryTransaction.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: sourceWarehouse._id,
        type: "receive",
      });
      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(20);
      expect(tx.onHandBefore).toBe(initialOnHand);
      expect(tx.onHandAfter).toBe(initialOnHand + 20);
      expect(tx.vendorId.toString()).toBe(vendorA._id.toString());
    });

    it("should support autoConfirm: true to create and confirm in a single operation", async () => {
      const initialInv = await Inventory.findById(inventoryA1_source._id);
      const initialOnHand = initialInv.onHand; // 120

      const directReceiving = await stockReceivingService.createVendorReceivingRecord({
        userId: vendorAUser._id,
        destinationWarehouseId: sourceWarehouse._id.toString(),
        supplierName: "Express Direct Supplier",
        autoConfirm: true,
        items: [
          {
            productVariantId: variantA1_1._id.toString(),
            expectedQuantity: 15,
            receivedQuantity: 15,
          },
        ],
      });

      expect(directReceiving.status).toBe("confirmed");

      const updatedInv = await Inventory.findById(inventoryA1_source._id);
      expect(updatedInv.onHand).toBe(initialOnHand + 15); // 135
    });

    it("should reject Vendor B from viewing or confirming Vendor A receiving record (404)", async () => {
      await expect(
        stockReceivingService.getVendorReceivingRecord({
          userId: vendorBUser._id,
          id: createdReceiving._id.toString(),
        })
      ).rejects.toThrow("Stock receiving record not found");

      await expect(
        stockReceivingService.confirmVendorReceiving({
          userId: vendorBUser._id,
          id: createdReceiving._id.toString(),
        })
      ).rejects.toThrow("Stock receiving record not found");
    });

    it("should list only receiving records belonging to authenticated vendor with pagination", async () => {
      const result = await stockReceivingService.listVendorReceivingRecords({
        userId: vendorAUser._id,
        page: 1,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items.every((r) => r.vendorId.toString() === vendorA._id.toString())).toBe(true);

      const bResult = await stockReceivingService.listVendorReceivingRecords({
        userId: vendorBUser._id,
        page: 1,
        limit: 10,
      });
      expect(bResult.items).toHaveLength(0);
    });
  });

  describe("2. Inter-Warehouse Transfers & Conservation Invariant", () => {
    let createdTransfer;
    let sourceOnHandBeforeDispatch;

    it("should reject transfer when source and destination warehouse are identical (400)", async () => {
      await expect(
        stockTransferService.createVendorTransfer({
          userId: vendorAUser._id,
          sourceWarehouseId: sourceWarehouse._id.toString(),
          destinationWarehouseId: sourceWarehouse._id.toString(),
          items: [{ productVariantId: variantA1_1._id.toString(), quantity: 10 }],
        })
      ).rejects.toThrow("Source and destination warehouses cannot be the same");
    });

    it("should reject transfer when requested quantity exceeds available stock at source (409)", async () => {
      // available stock for variantA1_1 at source is currently 135
      await expect(
        stockTransferService.createVendorTransfer({
          userId: vendorAUser._id,
          sourceWarehouseId: sourceWarehouse._id.toString(),
          destinationWarehouseId: destWarehouse._id.toString(),
          items: [{ productVariantId: variantA1_1._id.toString(), quantity: 9999 }],
        })
      ).rejects.toThrow("Insufficient available stock for SKU");
    });

    it("should reject transfer when Vendor A attempts to transfer a variant belonging to Vendor B (403)", async () => {
      await expect(
        stockTransferService.createVendorTransfer({
          userId: vendorAUser._id,
          sourceWarehouseId: sourceWarehouse._id.toString(),
          destinationWarehouseId: destWarehouse._id.toString(),
          items: [{ productVariantId: variantB1_1._id.toString(), quantity: 5 }],
        })
      ).rejects.toThrow("does not belong to your merchant account");
    });

    it("should create a pre-approved transfer for Vendor A with valid available stock", async () => {
      const transfer = await stockTransferService.createVendorTransfer({
        userId: vendorAUser._id,
        sourceWarehouseId: sourceWarehouse._id.toString(),
        destinationWarehouseId: destWarehouse._id.toString(),
        notes: "Transfer 25 oak desks to Mumbai West FC",
        items: [{ productVariantId: variantA1_1._id.toString(), quantity: 25 }],
      });

      expect(transfer).toBeDefined();
      expect(transfer.status).toBe("approved");
      expect(transfer.vendorId.toString()).toBe(vendorA._id.toString());
      expect(transfer.items[0].requestedQuantity).toBe(25);
      expect(transfer.sourceWarehouseId.toString()).toBe(sourceWarehouse._id.toString());
      expect(transfer.destinationWarehouseId.toString()).toBe(destWarehouse._id.toString());

      createdTransfer = transfer;
    });

    it("should dispatch transfer, deduct source warehouse onHand stock and transition status to dispatched", async () => {
      const sourceBefore = await Inventory.findById(inventoryA1_source._id);
      sourceOnHandBeforeDispatch = sourceBefore.onHand;

      const dispatched = await stockTransferService.dispatchVendorTransfer({
        userId: vendorAUser._id,
        id: createdTransfer._id.toString(),
        carrierName: "BlueDart Express",
        trackingReference: "BD-EXP-88991122",
      });

      expect(dispatched.status).toBe("dispatched");
      expect(dispatched.carrierName).toBe("BlueDart Express");
      expect(dispatched.trackingReference).toBe("BD-EXP-88991122");
      expect(dispatched.dispatchedAt).toBeDefined();

      // Check source warehouse stock was deducted by 25
      const sourceAfter = await Inventory.findById(inventoryA1_source._id);
      expect(sourceAfter.onHand).toBe(sourceOnHandBeforeDispatch - 25);

      // Check immutable transfer transaction logged for source warehouse
      const tx = await InventoryTransaction.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: sourceWarehouse._id,
        type: "transfer",
        quantity: -25,
      });
      expect(tx).toBeDefined();
      expect(tx.referenceType).toBe("transfer_dispatch");
    });

    it("should reject cancellation of a transfer that has already been dispatched (409)", async () => {
      await expect(
        stockTransferService.cancelVendorTransfer({
          userId: vendorAUser._id,
          id: createdTransfer._id.toString(),
          reason: "Trying to cancel in transit",
        })
      ).rejects.toThrow("Cannot cancel a transfer that has already been dispatched");
    });

    it("should receive transfer at destination, satisfy Conservation of Inventory Invariant and mark received", async () => {
      // Prior to receive: destination warehouse has 0 units of variantA1_1
      const destBefore = await Inventory.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: destWarehouse._id,
      });
      const destBeforeOnHand = destBefore ? destBefore.onHand : 0; // 0

      const received = await stockTransferService.receiveVendorTransfer({
        userId: vendorAUser._id,
        id: createdTransfer._id.toString(),
        receivedItems: [
          {
            productVariantId: variantA1_1._id.toString(),
            receivedQuantity: 25,
            rejectedQuantity: 0,
          },
        ],
        notes: "Received in pristine condition at Mumbai hub",
      });

      expect(received.status).toBe("received");
      expect(received.receivedAt).toBeDefined();

      // Check destination warehouse stock increased by 25
      const destAfter = await Inventory.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: destWarehouse._id,
      });
      expect(destAfter).toBeDefined();
      expect(destAfter.onHand).toBe(destBeforeOnHand + 25); // 25

      // Conservation of Inventory check:
      // Source initial was 135. Source now is 110. (Change = -25)
      // Destination initial was 0. Destination now is 25. (Change = +25)
      // Delta source + Delta destination = 0.
      const sourceCurrent = await Inventory.findById(inventoryA1_source._id);
      expect(sourceOnHandBeforeDispatch - sourceCurrent.onHand).toBe(destAfter.onHand - destBeforeOnHand);
    });

    it("should support partial receipt with discrepancy reporting and mark partially_received", async () => {
      // Create another transfer of 10 units
      const partialTransfer = await stockTransferService.createVendorTransfer({
        userId: vendorAUser._id,
        sourceWarehouseId: sourceWarehouse._id.toString(),
        destinationWarehouseId: destWarehouse._id.toString(),
        items: [{ productVariantId: variantA1_1._id.toString(), quantity: 10 }],
      });

      await stockTransferService.dispatchVendorTransfer({
        userId: vendorAUser._id,
        id: partialTransfer._id.toString(),
        carrierName: "Delhivery Surface",
        trackingReference: "DLV-990011",
      });

      // Receive 8 units and reject 2 units due to transit damage
      const partiallyReceived = await stockTransferService.receiveVendorTransfer({
        userId: vendorAUser._id,
        id: partialTransfer._id.toString(),
        receivedItems: [
          {
            productVariantId: variantA1_1._id.toString(),
            receivedQuantity: 8,
            rejectedQuantity: 2,
            discrepancyReason: "2 units box crushed during transit",
          },
        ],
      });

      expect(partiallyReceived.status).toBe("partially_received");
      expect(partiallyReceived.items[0].receivedQuantity).toBe(8);
      expect(partiallyReceived.items[0].rejectedQuantity).toBe(2);
      expect(partiallyReceived.items[0].discrepancyQuantity).toBe(2);
    });

    it("should prevent Vendor B from viewing or dispatching Vendor A's transfer (404)", async () => {
      await expect(
        stockTransferService.getVendorTransferRecord({
          userId: vendorBUser._id,
          id: createdTransfer._id.toString(),
        })
      ).rejects.toThrow("Stock transfer not found");

      await expect(
        stockTransferService.dispatchVendorTransfer({
          userId: vendorBUser._id,
          id: createdTransfer._id.toString(),
        })
      ).rejects.toThrow("Stock transfer not found");
    });
  });

  describe("3. Controlled Inventory Adjustments & Non-Negative Invariants", () => {
    it("should perform positive sellable stock adjustment, update onHand and log adjustment transaction", async () => {
      const invBefore = await Inventory.findById(inventoryA1_source._id);
      const onHandBefore = invBefore.onHand; // 100 (after 25 dispatched + 10 dispatched earlier)

      const result = await inventoryService.adjustVendorStock({
        userId: vendorAUser._id,
        inventoryId: inventoryA1_source._id.toString(),
        quantity: 15,
        reason: "physical_count_correction",
        condition: "sellable",
        notes: "Found 15 additional oak desks during physical cycle audit",
      });

      expect(result.beforeQuantity).toBe(onHandBefore);
      expect(result.afterQuantity).toBe(onHandBefore + 15);
      expect(result.reason).toBe("physical_count_correction");

      const invAfter = await Inventory.findById(inventoryA1_source._id);
      expect(invAfter.onHand).toBe(onHandBefore + 15);

      // Verify transaction logged
      const tx = await InventoryTransaction.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: sourceWarehouse._id,
        type: "adjustment",
        quantity: 15,
      });
      expect(tx).toBeDefined();
      expect(tx.notes).toContain("physical_count_correction");
    });

    it("should perform negative sellable stock adjustment when available stock allows", async () => {
      const invBefore = await Inventory.findById(inventoryA1_source._id);
      const onHandBefore = invBefore.onHand;

      const result = await inventoryService.adjustVendorStock({
        userId: vendorAUser._id,
        inventoryId: inventoryA1_source._id.toString(),
        quantity: -5,
        reason: "data_correction",
        condition: "sellable",
        notes: "Adjustment for counting mislabeling",
      });

      expect(result.afterQuantity).toBe(onHandBefore - 5);
    });

    it("should reject negative adjustment that would violate onHand >= reserved + nonSellable invariant (409)", async () => {
      // For inventoryA2_source: onHand=50, reserved=5, damaged=5 => available = 40.
      // Trying to reduce by -45 would violate invariant (onHand 50 - 45 = 5 < 5+5=10)
      await expect(
        inventoryService.adjustVendorStock({
          userId: vendorAUser._id,
          inventoryId: inventoryA2_source._id.toString(),
          quantity: -45,
          reason: "damaged",
          condition: "sellable",
        })
      ).rejects.toThrow("Adjustment would reduce on-hand stock below reserved");
    });

    it("should perform condition adjustment moving sellable stock to damaged bucket and log condition_change", async () => {
      const invBefore = await Inventory.findById(inventoryA1_source._id);
      const initialDamaged = invBefore.damaged || 0;

      const result = await inventoryService.adjustVendorStock({
        userId: vendorAUser._id,
        inventoryId: inventoryA1_source._id.toString(),
        quantity: 4,
        condition: "damaged",
        reason: "damaged",
        notes: "4 desks water damaged in warehouse leak",
      });

      expect(result).toBeDefined();

      const invAfter = await Inventory.findById(inventoryA1_source._id);
      expect(invAfter.damaged).toBe(initialDamaged + 4);

      // Check condition_change transaction was logged
      const tx = await InventoryTransaction.findOne({
        productVariantId: variantA1_1._id,
        warehouseId: sourceWarehouse._id,
        type: "condition_change",
      });
      expect(tx).toBeDefined();
    });

    it("should strictly reject Vendor A from adjusting Vendor B's inventory item (403)", async () => {
      await expect(
        inventoryService.adjustVendorStock({
          userId: vendorAUser._id,
          inventoryId: inventoryB1_source._id.toString(),
          quantity: 5,
          reason: "physical_count_correction",
        })
      ).rejects.toThrow("You do not have access to this inventory item");
    });
  });

  describe("4. Consolidated Stock Movement History & Audit Ledger", () => {
    it("should retrieve consolidated movement history with accurate metadata for Vendor A", async () => {
      const history = await inventoryService.getMyVendorMovementHistory({
        userId: vendorAUser._id,
        query: { page: 1, limit: 50 },
      });

      expect(history.items).toBeDefined();
      expect(history.items.length).toBeGreaterThanOrEqual(4);

      // Check fields in movement entries
      const firstEntry = history.items[0];
      expect(firstEntry.secureId).toBeDefined();
      expect(firstEntry.type).toBeDefined();
      expect(firstEntry.quantity).toBeDefined();
      expect(firstEntry.sku).toBeDefined();
      expect(firstEntry.warehouseName).toBeDefined();
      expect(firstEntry.initiatedBy).toBeDefined();
    });

    it("should accurately filter movement history by type (e.g. type: receive)", async () => {
      const receivingHistory = await inventoryService.getMyVendorMovementHistory({
        userId: vendorAUser._id,
        query: { type: "receive" },
      });

      expect(receivingHistory.items.length).toBeGreaterThanOrEqual(1);
      expect(receivingHistory.items.every((tx) => tx.type === "receive")).toBe(true);
    });

    it("should accurately filter movement history by warehouseId", async () => {
      const sourceHistory = await inventoryService.getMyVendorMovementHistory({
        userId: vendorAUser._id,
        query: { warehouseId: sourceWarehouse._id.toString() },
      });

      expect(sourceHistory.items.length).toBeGreaterThanOrEqual(1);
      expect(
        sourceHistory.items.every((tx) => tx.warehouseId.toString() === sourceWarehouse._id.toString())
      ).toBe(true);
    });

    it("should strictly isolate movement history: Vendor B sees none of Vendor A's transactions", async () => {
      const bHistory = await inventoryService.getMyVendorMovementHistory({
        userId: vendorBUser._id,
        query: {},
      });

      const vendorASkus = ["DESK-A1-OAK", "DESK-A1-WAL"];
      const containsAVendorItem = bHistory.items.some((item) => vendorASkus.includes(item.sku));
      expect(containsAVendorItem).toBe(false);
    });
  });

  describe("5. Reorder & Low-Stock Management", () => {
    it("should allow Vendor A to update lowStockThreshold and reorderLevel", async () => {
      const updated = await inventoryService.updateVendorInventoryThreshold({
        userId: vendorAUser._id,
        inventoryId: inventoryA1_source._id.toString(),
        lowStockThreshold: 18,
        reorderLevel: 45,
      });

      expect(updated.lowStockThreshold).toBe(18);
      expect(updated.reorderLevel).toBe(45);

      const inv = await Inventory.findById(inventoryA1_source._id);
      expect(inv.lowStockThreshold).toBe(18);
      expect(inv.reorderLevel).toBe(45);
    });

    it("should reject invalid negative threshold values (400)", async () => {
      await expect(
        inventoryService.updateVendorInventoryThreshold({
          userId: vendorAUser._id,
          inventoryId: inventoryA1_source._id.toString(),
          lowStockThreshold: -5,
        })
      ).rejects.toThrow("Low stock threshold must be a non-negative integer");
    });

    it("should trigger low-stock in-app notification when adjustment reduces stock to or below threshold", async () => {
      // Create a test SKU with onHand = 12, threshold = 10
      const testVariant = await ProductVariant.create({
        productId: productA1._id,
        sku: `DESK-TEST-${Date.now()}`,
        name: "Test Desk For Low Stock Alert",
        price: 9999,
        stockStatus: "in_stock",
      });

      const testInv = await Inventory.create({
        warehouseId: sourceWarehouse._id,
        productVariantId: testVariant._id,
        onHand: 12,
        reserved: 0,
        damaged: 0,
        lowStockThreshold: 10,
        reorderLevel: 25,
      });

      // Adjust down by 4 -> onHand becomes 8 <= threshold(10)
      await inventoryService.adjustVendorStock({
        userId: vendorAUser._id,
        inventoryId: testInv._id.toString(),
        quantity: -4,
        reason: "physical_count_correction",
        condition: "sellable",
        notes: "Count discrepancy causing stock to breach threshold",
      });

      // Verify notification created
      const notif = await CustomerNotification.findOne({
        userId: vendorAUser._id,
        title: { $regex: testVariant.sku },
      });

      expect(notif).toBeDefined();
      expect(notif.title).toContain("Low Stock Alert");
      expect(notif.link).toBe("/vendor/inventory");

      // Cleanup
      await Inventory.deleteOne({ _id: testInv._id });
      await ProductVariant.deleteOne({ _id: testVariant._id });
    });

    it("should strictly reject Vendor A from updating thresholds on Vendor B's inventory item (403)", async () => {
      await expect(
        inventoryService.updateVendorInventoryThreshold({
          userId: vendorAUser._id,
          inventoryId: inventoryB1_source._id.toString(),
          lowStockThreshold: 10,
        })
      ).rejects.toThrow("You do not have access to this inventory item");
    });
  });
});
