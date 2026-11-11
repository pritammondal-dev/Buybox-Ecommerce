const mongoose = require("mongoose");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Warehouse = require("../src/models/Warehouse");
const Inventory = require("../src/models/Inventory");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const StockCount = require("../src/models/StockCount");

const stockCountService = require("../src/services/stock-count.service");
const inventoryService = require("../src/services/inventory.service");
const AppError = require("../src/errors/AppError");

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase: VENDOR-INVENTORY-RECONCILIATION-03 — Inventory Reconciliation & Stock Counting", () => {
  let vendorAUser, vendorA;
  let vendorBUser, vendorB;
  let testCategory;
  let testWarehouse;
  let productA1, variantA1_1, variantA1_2;
  let productA2, variantA2_1;
  let productB1, variantB1_1;
  let invA1_1, invA1_2, invA2_1, invB1_1;

  async function createTestUser(role, prefix) {
    const rand = Math.random().toString(36).substring(7);
    const randPhone = `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;
    return User.create({
      firstName: `${prefix}First`,
      lastName: `${prefix}Last`,
      email: `${prefix.toLowerCase()}_${Date.now()}_${rand}@wh-recon.test`,
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
      businessName: `${name} Inventory Ltd ${rand}`,
      businessSlug: `${name.toLowerCase()}-inventory-${rand}`,
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
    const vA = await createTestVendor("MerchantReconAlpha");
    vendorAUser = vA.user;
    vendorA = vA.vendor;

    const vB = await createTestVendor("MerchantReconBeta");
    vendorBUser = vB.user;
    vendorB = vB.vendor;

    // 2. Create Category
    testCategory = await Category.create({
      name: `Reconciliation Category ${Date.now()}`,
      slug: `recon-cat-${Date.now()}`,
      isActive: true,
    });

    // 3. Create Warehouse
    testWarehouse = await Warehouse.create({
      name: "Central Consolidation Hub",
      code: `HUB-RECON-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: "Regional Fulfillment Center",
      address: {
        addressLine1: "Industrial Corridor Phase 2",
        city: "Bhiwandi",
        state: "Maharashtra",
        postalCode: "421302",
        country: "IN",
      },
      capacity: 80000,
      isActive: true,
    });

    // 4. Create Vendor A Products & Variants
    productA1 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Ergonomic Standing Desk",
      slug: `recon-desk-${Date.now()}`,
      sku: "RECON-PROD-DESK",
      price: 18500,
      status: "active",
      images: [{ url: "https://cdn.test/desk.jpg", isDefault: true }],
    });

    variantA1_1 = await ProductVariant.create({
      productId: productA1._id,
      sku: "RECON-DESK-OAK",
      name: "Oak Finish / 140cm",
      price: 18500,
      stockStatus: "in_stock",
    });

    variantA1_2 = await ProductVariant.create({
      productId: productA1._id,
      sku: "RECON-DESK-WAL",
      name: "Walnut Finish / 160cm",
      price: 21500,
      stockStatus: "in_stock",
    });

    productA2 = await Product.create({
      vendorId: vendorA._id,
      categoryId: testCategory._id,
      name: "Underdesk Cable Spine",
      slug: `recon-spine-${Date.now()}`,
      sku: "RECON-PROD-SPINE",
      price: 899,
      status: "active",
      images: [{ url: "https://cdn.test/spine.jpg", isDefault: true }],
    });

    variantA2_1 = await ProductVariant.create({
      productId: productA2._id,
      sku: "RECON-SPINE-BLK",
      name: "Black Matte Spine",
      price: 899,
      stockStatus: "in_stock",
    });

    // 5. Create Vendor B Products & Variants (For Multi-Tenant Isolation)
    productB1 = await Product.create({
      vendorId: vendorB._id,
      categoryId: testCategory._id,
      name: "Modular Monitor Mount",
      slug: `recon-mount-${Date.now()}`,
      sku: "RECON-PROD-MOUNT",
      price: 3499,
      status: "active",
      images: [{ url: "https://cdn.test/mount.jpg", isDefault: true }],
    });

    variantB1_1 = await ProductVariant.create({
      productId: productB1._id,
      sku: "RECON-MOUNT-SLV",
      name: "Silver Dual Mount",
      price: 3499,
      stockStatus: "in_stock",
    });

    // 6. Create Initial Inventory Records
    invA1_1 = await Inventory.create({
      warehouseId: testWarehouse._id,
      productVariantId: variantA1_1._id,
      onHand: 50,
      reserved: 5,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 10,
      reorderPoint: 15,
      reorderQuantity: 25,
      lastStockUpdateAt: new Date(),
    });

    invA1_2 = await Inventory.create({
      warehouseId: testWarehouse._id,
      productVariantId: variantA1_2._id,
      onHand: 20,
      reserved: 2,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 5,
      reorderPoint: 8,
      reorderQuantity: 15,
      lastStockUpdateAt: new Date(),
    });

    invA2_1 = await Inventory.create({
      warehouseId: testWarehouse._id,
      productVariantId: variantA2_1._id,
      onHand: 8,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 15, // Available (8) <= lowStockThreshold (15) -> qualifies for low_stock scope
      reorderPoint: 20,
      reorderQuantity: 50,
      lastStockUpdateAt: new Date(),
    });

    invB1_1 = await Inventory.create({
      warehouseId: testWarehouse._id,
      productVariantId: variantB1_1._id,
      onHand: 30,
      reserved: 0,
      damaged: 0,
      defective: 0,
      expired: 0,
      lowStockThreshold: 5,
      lastStockUpdateAt: new Date(),
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (vendorA?._id) {
      await StockCount.deleteMany({ vendorId: vendorA._id });
      await InventoryTransaction.deleteMany({ vendorId: vendorA._id });
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
      await StockCount.deleteMany({ vendorId: vendorB._id });
      await InventoryTransaction.deleteMany({ vendorId: vendorB._id });
      await Inventory.deleteMany({ productVariantId: variantB1_1?._id });
      await ProductVariant.deleteMany({ _id: variantB1_1?._id });
      await Product.deleteMany({ _id: productB1?._id });
      await Vendor.deleteOne({ _id: vendorB._id });
      await User.deleteOne({ _id: vendorBUser._id });
    }

    if (testWarehouse?._id) {
      await Warehouse.deleteOne({ _id: testWarehouse._id });
    }
    if (testCategory?._id) {
      await Category.deleteOne({ _id: testCategory._id });
    }
  });

  // ============================================================
  // SUITE 1: PHYSICAL COUNT & CYCLE COUNT SESSION CREATION
  // ============================================================
  describe("1. Physical Count & Cycle Count Session Creation & Scope Filtering", () => {
    it("should successfully create a full warehouse physical stock count session for Vendor A", async () => {
      const countSession = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
        materialityThresholdPercent: 5,
        notes: "End of Quarter Q4 physical stock verification",
      });

      expect(countSession).toBeDefined();
      expect(countSession.countNumber).toMatch(/^CNT-\d{8}-[A-F0-9]{6}$/);
      expect(countSession.vendorId.toString()).toBe(vendorA._id.toString());
      expect(countSession.warehouseId.toString()).toBe(testWarehouse._id.toString());
      expect(countSession.status).toBe("counting");
      expect(countSession.scope).toBe("full");

      // Verify items snapshot includes all 3 Vendor A items and NO Vendor B items
      expect(countSession.items).toHaveLength(3);
      const skus = countSession.items.map((i) => i.sku);
      expect(skus).toContain("RECON-DESK-OAK");
      expect(skus).toContain("RECON-DESK-WAL");
      expect(skus).toContain("RECON-SPINE-BLK");
      expect(skus).not.toContain("RECON-MOUNT-SLV");

      // Verify onHand snapshots match initial inventory
      const oakItem = countSession.items.find((i) => i.sku === "RECON-DESK-OAK");
      expect(oakItem.snapshotOnHand).toBe(50);
      expect(oakItem.countedOnHand).toBeNull();
      expect(oakItem.unitCost).toBe(18500);

      expect(countSession.totalExpectedQty).toBe(78); // 50 + 20 + 8
    });

    it("should create a cycle count session filtered by 'low_stock' scope", async () => {
      const cycleCount = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "cycle",
        scope: "low_stock",
        notes: "Cycle count for low-stock trigger SKUs",
      });

      expect(cycleCount).toBeDefined();
      expect(cycleCount.countType).toBe("cycle");
      expect(cycleCount.scope).toBe("low_stock");

      // Only RECON-SPINE-BLK has available (8) <= lowStockThreshold (15)
      expect(cycleCount.items).toHaveLength(1);
      expect(cycleCount.items[0].sku).toBe("RECON-SPINE-BLK");
      expect(cycleCount.items[0].snapshotOnHand).toBe(8);
      expect(cycleCount.totalExpectedQty).toBe(8);
    });

    it("should create a cycle count session filtered by 'high_value' scope (price >= 5000)", async () => {
      const highValCount = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "cycle",
        scope: "high_value",
        notes: "High value SKU cycle audit",
      });

      expect(highValCount).toBeDefined();
      expect(highValCount.scope).toBe("high_value");

      // Only Desk Oak (18500) and Desk Walnut (21500) qualify (Cable spine is 899)
      expect(highValCount.items).toHaveLength(2);
      const skus = highValCount.items.map((i) => i.sku);
      expect(skus).toContain("RECON-DESK-OAK");
      expect(skus).toContain("RECON-DESK-WAL");
      expect(skus).not.toContain("RECON-SPINE-BLK");
    });

    it("should reject creation with invalid warehouse ID", async () => {
      await expect(
        stockCountService.createVendorStockCount({
          userId: vendorAUser._id,
          warehouseId: "invalid-mongo-id",
        })
      ).rejects.toThrow("Invalid warehouse ID");
    });

    it("should reject creation if vendor has no inventory matching scope in warehouse", async () => {
      // Create empty warehouse
      const emptyWH = await Warehouse.create({
        name: "Empty Virtual Warehouse",
        code: `WH-EMPTY-${Date.now()}`,
        address: {
          addressLine1: "Plot 102, Logistics Park",
          city: "Pune",
          state: "Maharashtra",
          postalCode: "411001",
          country: "IN",
        },
        isActive: true,
      });

      await expect(
        stockCountService.createVendorStockCount({
          userId: vendorAUser._id,
          warehouseId: emptyWH._id.toString(),
        })
      ).rejects.toThrow("No inventory records found matching count criteria at this warehouse");

      await Warehouse.deleteOne({ _id: emptyWH._id });
    });
  });

  // ============================================================
  // SUITE 2: PHYSICAL COUNT RECORDING & ACCURACY METRICS
  // ============================================================
  describe("2. Physical Count Entry, Inspection & Accuracy Metrics", () => {
    let sessionToCount;

    beforeEach(async () => {
      sessionToCount = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
      });
    });

    it("should record physical counts, compute discrepancies, variance %, shortage, and accuracy rates", async () => {
      const oakItem = sessionToCount.items.find((i) => i.sku === "RECON-DESK-OAK");
      const walItem = sessionToCount.items.find((i) => i.sku === "RECON-DESK-WAL");
      const spineItem = sessionToCount.items.find((i) => i.sku === "RECON-SPINE-BLK");

      // Oak: Expected 50, Counted 48 (shortage 2, delta -2)
      // Walnut: Expected 20, Counted 22 (excess 2, delta +2)
      // Spine: Expected 8, Counted 8 (exact match, delta 0)
      const updated = await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: sessionToCount._id.toString(),
        items: [
          {
            _id: oakItem._id,
            countedOnHand: 48,
            countedCondition: "sellable",
            notes: "Floor stock count verified by warehouse team",
          },
          {
            _id: walItem._id,
            countedOnHand: 22,
            countedCondition: "sellable",
            notes: "Found 2 extra units unpacked near dock 3",
          },
          {
            _id: spineItem._id,
            countedOnHand: 8,
            countedCondition: "sellable",
          },
        ],
        notes: "Initial count pass complete",
      });

      expect(updated).toBeDefined();

      const resOak = updated.items.find((i) => i.sku === "RECON-DESK-OAK");
      expect(resOak.countedOnHand).toBe(48);
      expect(resOak.discrepancy).toBe(-2);
      expect(resOak.shortageQuantity).toBe(2);
      expect(resOak.excessQuantity).toBe(0);
      expect(resOak.variancePercentage).toBe(-4); // (-2 / 50) * 100
      expect(resOak.varianceValue).toBe(-37000); // -2 * 18500

      const resWal = updated.items.find((i) => i.sku === "RECON-DESK-WAL");
      expect(resWal.countedOnHand).toBe(22);
      expect(resWal.discrepancy).toBe(2);
      expect(resWal.shortageQuantity).toBe(0);
      expect(resWal.excessQuantity).toBe(2);
      expect(resWal.variancePercentage).toBe(10); // (2 / 20) * 100
      expect(resWal.varianceValue).toBe(43000); // 2 * 21500

      const resSpine = updated.items.find((i) => i.sku === "RECON-SPINE-BLK");
      expect(resSpine.countedOnHand).toBe(8);
      expect(resSpine.discrepancy).toBe(0);
      expect(resSpine.shortageQuantity).toBe(0);
      expect(resSpine.excessQuantity).toBe(0);

      // Verify Session Totals & Accuracy KPIs
      expect(updated.totalExpectedQty).toBe(78);
      expect(updated.totalCountedQty).toBe(78); // 48 + 22 + 8
      expect(updated.totalVarianceQty).toBe(0); // -2 + 2 + 0

      // SKU Accuracy Rate: 1 exact match out of 3 = 33.33%
      expect(updated.skuAccuracyRate).toBe(33.33);

      // Quantity Accuracy Rate: 1 - (| -2 | + | +2 | + 0) / 78 = 1 - 4/78 = 94.87%
      expect(updated.quantityAccuracyRate).toBe(94.87);
    });

    it("should record inspection condition and notes for damaged or defective units", async () => {
      const oakItem = sessionToCount.items.find((i) => i.sku === "RECON-DESK-OAK");

      const updated = await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: sessionToCount._id.toString(),
        items: [
          {
            _id: oakItem._id,
            countedOnHand: 49,
            countedCondition: "damaged",
            inspectionNotes: "Water damage on corner of 1 table carton during monsoon inspection",
          },
        ],
      });

      const resOak = updated.items.find((i) => i.sku === "RECON-DESK-OAK");
      expect(resOak.countedOnHand).toBe(49);
      expect(resOak.countedCondition).toBe("damaged");
      expect(resOak.inspectionNotes).toContain("Water damage on corner");
    });
  });

  // ============================================================
  // SUITE 3: SUBMISSION & RECOUNT WORKFLOWS
  // ============================================================
  describe("3. Submission, Recount Requests & Resolution Workflow", () => {
    let session;

    beforeEach(async () => {
      session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
      });
    });

    it("should reject submission if some SKUs have not been physically counted", async () => {
      // Count only 1 item out of 3
      const firstItem = session.items[0];
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: [{ _id: firstItem._id, countedOnHand: firstItem.snapshotOnHand }],
      });

      await expect(
        stockCountService.submitVendorStockCount({
          userId: vendorAUser._id,
          id: session._id.toString(),
        })
      ).rejects.toThrow("2 item(s) have not been counted");
    });

    it("should successfully submit when all items have been counted", async () => {
      // Count all items
      const countEntries = session.items.map((it) => ({
        _id: it._id,
        countedOnHand: it.snapshotOnHand,
      }));

      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: countEntries,
      });

      const submitted = await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        notes: "Count completed by night shift supervisor",
      });

      expect(submitted.status).toBe("submitted");
      expect(submitted.submittedBy.toString()).toBe(vendorAUser._id.toString());
      expect(submitted.submittedAt).toBeDefined();
    });

    it("should support recount requests: transitions status to recount_required and flags items", async () => {
      // 1. Count all
      const countEntries = session.items.map((it) => ({
        _id: it._id,
        countedOnHand: it.snapshotOnHand - 5,
      }));
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: countEntries,
      });

      // 2. Submit
      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      // 3. Request Recount for Oak item
      const oakItem = session.items.find((i) => i.sku === "RECON-DESK-OAK");
      const recountSession = await stockCountService.requestVendorRecount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        itemIds: [oakItem._id.toString()],
        recountNotes: "Shortage of 5 units on Oak desk requires physical re-verification on Aisle 4",
      });

      expect(recountSession.status).toBe("recount_required");
      expect(recountSession.recountCount).toBe(1);
      expect(recountSession.reviewNotes).toContain("Shortage of 5 units on Oak desk");

      const recountOak = recountSession.items.find((i) => i.sku === "RECON-DESK-OAK");
      expect(recountOak.recountRequested).toBe(true);
      expect(recountOak.recountNotes).toContain("Shortage of 5 units");

      // 4. Record updated recount count
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: [
          {
            _id: oakItem._id,
            countedOnHand: 49, // Corrected from 45 to 49
            notes: "Recount verified: 4 units were located on pallet rack B2",
          },
        ],
      });

      // 5. Re-submit after recount
      const resubmitted = await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        notes: "Re-submitted after physical aisle recount",
      });

      expect(resubmitted.status).toBe("submitted");
    });
  });

  // ============================================================
  // SUITE 4: APPROVAL & REJECTION GOVERNANCE
  // ============================================================
  describe("4. Variance Approval & Rejection Governance", () => {
    let session;

    beforeEach(async () => {
      session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
      });

      const countEntries = session.items.map((it) => ({
        _id: it._id,
        countedOnHand: it.snapshotOnHand,
      }));
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: countEntries,
      });
    });

    it("should reject approval if session has not been submitted", async () => {
      // Still in 'counting' status
      await expect(
        stockCountService.approveVendorStockCount({
          userId: vendorAUser._id,
          id: session._id.toString(),
        })
      ).rejects.toThrow("Count must be submitted for review first");
    });

    it("should approve submitted count and persist approval metadata", async () => {
      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      const approved = await stockCountService.approveVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        approvalNotes: "Variances verified against shipping logs and authorized",
      });

      expect(approved.status).toBe("approved");
      expect(approved.approvedBy.toString()).toBe(vendorAUser._id.toString());
      expect(approved.approvedAt).toBeDefined();
      expect(approved.approvalNotes).toContain("Variances verified");
    });

    it("should reject submitted count and persist rejection reason", async () => {
      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      const rejected = await stockCountService.rejectVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        rejectionReason: "Large unexplained discrepancy, requires full warehouse supervisor re-audit",
      });

      expect(rejected.status).toBe("rejected");
      expect(rejected.rejectedBy.toString()).toBe(vendorAUser._id.toString());
      expect(rejected.rejectionReason).toContain("Large unexplained discrepancy");

      // Cannot reconcile a rejected count
      await expect(
        stockCountService.reconcileVendorStockCount({
          userId: vendorAUser._id,
          id: session._id.toString(),
        })
      ).rejects.toThrow("Cannot reconcile count in 'rejected' status");
    });
  });

  // ============================================================
  // SUITE 5: MOVEMENT-AWARE RECONCILIATION ENGINE
  // ============================================================
  describe("5. Movement-Aware Reconciliation Engine & Mathematical Integrity", () => {
    it("should preserve post-snapshot movements and apply true delta: Live(L) + Delta(P - S) = P + M", async () => {
      // 1. Create a dedicated variant for this test to isolate stock movements
      const moveVariant = await ProductVariant.create({
        productId: productA1._id,
        sku: `RECON-MOVE-${Date.now()}`,
        name: "Movement Test Desk",
        price: 15000,
        stockStatus: "in_stock",
      });

      // Initial live stock = 50
      const moveInv = await Inventory.create({
        warehouseId: testWarehouse._id,
        productVariantId: moveVariant._id,
        onHand: 50,
        reserved: 2,
        lowStockThreshold: 10,
        lastStockUpdateAt: new Date(),
      });

      // 2. Create Stock Count Session (SnapshotOnHand = 50)
      const countSession = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        variantIds: [moveVariant._id.toString()],
      });

      const item = countSession.items[0];
      expect(item.snapshotOnHand).toBe(50);

      // 3. Physical count records 47 (physical discrepancy = 47 - 50 = -3 shortage)
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: countSession._id.toString(),
        items: [{ _id: item._id, countedOnHand: 47 }],
      });

      // 4. SIMULATE POST-SNAPSHOT LEGITIMATE SALES DISPATCH / STOCK MOVEMENT
      // While the count is in progress, 5 units are dispatched to customers:
      // Live stock drops from 50 -> 45
      moveInv.onHand = 45;
      await moveInv.save();

      // 5. Submit & Approve Count Session
      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: countSession._id.toString(),
      });

      await stockCountService.approveVendorStockCount({
        userId: vendorAUser._id,
        id: countSession._id.toString(),
        approvalNotes: "Authorized movement-aware reconciliation",
      });

      // 6. Execute Movement-Aware Reconciliation
      const reconciled = await stockCountService.reconcileVendorStockCount({
        userId: vendorAUser._id,
        id: countSession._id.toString(),
      });

      expect(reconciled.status).toBe("reconciled");
      expect(reconciled.reconciledAt).toBeDefined();

      // 7. VERIFY MATHEMATICAL INTEGRITY:
      // Stale overwrite would have set onHand = 47 (destroying the legitimate dispatch of 5 units!)
      // Movement-aware formula: LiveOnHand (45) + delta (-3) = 42
      const updatedInv = await Inventory.findById(moveInv._id);
      expect(updatedInv.onHand).toBe(42);

      // 8. VERIFY IMMUTABLE INVENTORY TRANSACTION LEDGER
      const tx = await InventoryTransaction.findOne({
        productVariantId: moveVariant._id,
        referenceId: reconciled.countNumber,
        type: "count_reconciliation",
      });

      expect(tx).toBeDefined();
      expect(tx.quantity).toBe(-3);
      expect(tx.onHandBefore).toBe(45);
      expect(tx.onHandAfter).toBe(42);
      expect(tx.vendorId.toString()).toBe(vendorA._id.toString());
      expect(tx.referenceType).toBe("stock_count_reconciliation");

      // 9. VERIFY VARIANT MIRROR STOCK SYNC (Reflects available on-hand: 42 on-hand - 2 reserved = 40)
      const updatedVariant = await ProductVariant.findById(moveVariant._id);
      expect(updatedVariant.stockQuantity).toBe(40);
      expect(updatedVariant.stockStatus).toBe("in_stock");

      // Cleanup
      await Inventory.deleteOne({ _id: moveInv._id });
      await ProductVariant.deleteOne({ _id: moveVariant._id });
      await InventoryTransaction.deleteMany({ referenceId: reconciled.countNumber });
      await StockCount.deleteOne({ _id: countSession._id });
    });

    it("should abort reconciliation with 409 if negative adjustment would violate reserved stock", async () => {
      // Live stock: onHand = 15, reserved = 10
      const guardVariant = await ProductVariant.create({
        productId: productA1._id,
        sku: `RECON-GUARD-${Date.now()}`,
        name: "Guard Test Variant",
        price: 5000,
      });

      const guardInv = await Inventory.create({
        warehouseId: testWarehouse._id,
        productVariantId: guardVariant._id,
        onHand: 15,
        reserved: 10,
        lowStockThreshold: 5,
      });

      // Snapshot = 15
      const session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        variantIds: [guardVariant._id.toString()],
      });

      // Counted = 2 (delta = -13)
      // Live (15) + (-13) = 2, which is < reserved (10)!
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: [{ _id: session.items[0]._id, countedOnHand: 2 }],
      });

      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      await stockCountService.approveVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      await expect(
        stockCountService.reconcileVendorStockCount({
          userId: vendorAUser._id,
          id: session._id.toString(),
        })
      ).rejects.toThrow("would reduce live on-hand (2) below reserved (10)");

      // Live inventory should remain unchanged
      const unaffected = await Inventory.findById(guardInv._id);
      expect(unaffected.onHand).toBe(15);

      // Cleanup
      await Inventory.deleteOne({ _id: guardInv._id });
      await ProductVariant.deleteOne({ _id: guardVariant._id });
      await StockCount.deleteOne({ _id: session._id });
    });
  });

  // ============================================================
  // SUITE 6: DAMAGED STOCK CONDITION SEGREGATION
  // ============================================================
  describe("6. Damaged Stock Condition Segregation", () => {
    it("should segregate damaged items into non-sellable condition stock during reconciliation", async () => {
      const dmgVariant = await ProductVariant.create({
        productId: productA1._id,
        sku: `RECON-DMG-${Date.now()}`,
        name: "Damage Audit Test Variant",
        price: 6000,
      });

      const dmgInv = await Inventory.create({
        warehouseId: testWarehouse._id,
        productVariantId: dmgVariant._id,
        onHand: 20,
        reserved: 0,
        damaged: 0,
        lowStockThreshold: 5,
      });

      const session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        variantIds: [dmgVariant._id.toString()],
      });

      // Counted 18 (2 units physically damaged and unusable)
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: [
          {
            _id: session.items[0]._id,
            countedOnHand: 18,
            countedCondition: "damaged",
            inspectionNotes: "2 units crushed in storage bin",
          },
        ],
      });

      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      await stockCountService.approveVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      await stockCountService.reconcileVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      const updatedDmgInv = await Inventory.findById(dmgInv._id);
      // Damaged bucket incremented by shortage (2)
      expect(updatedDmgInv.damaged).toBe(2);

      // Cleanup
      await Inventory.deleteOne({ _id: dmgInv._id });
      await ProductVariant.deleteOne({ _id: dmgVariant._id });
      await StockCount.deleteOne({ _id: session._id });
    });
  });

  // ============================================================
  // SUITE 7: IDEMPOTENCY & RE-RECONCILIATION PROTECTION
  // ============================================================
  describe("7. Idempotency & Repeat Reconciliation Protection", () => {
    it("should return existing count without duplicate adjustments when reconciled again", async () => {
      const idemVariant = await ProductVariant.create({
        productId: productA1._id,
        sku: `RECON-IDEM-${Date.now()}`,
        name: "Idempotency Test Variant",
        price: 4500,
      });

      const idemInv = await Inventory.create({
        warehouseId: testWarehouse._id,
        productVariantId: idemVariant._id,
        onHand: 30,
        reserved: 0,
      });

      const session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        variantIds: [idemVariant._id.toString()],
      });

      // Counted 32 (+2 excess)
      await stockCountService.recordVendorPhysicalCounts({
        userId: vendorAUser._id,
        id: session._id.toString(),
        items: [{ _id: session.items[0]._id, countedOnHand: 32 }],
      });

      await stockCountService.submitVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      await stockCountService.approveVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });

      // First reconciliation
      const first = await stockCountService.reconcileVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });
      expect(first.status).toBe("reconciled");

      const invAfterFirst = await Inventory.findById(idemInv._id);
      expect(invAfterFirst.onHand).toBe(32);

      // Second reconciliation attempt
      const second = await stockCountService.reconcileVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
      });
      expect(second.status).toBe("reconciled");

      // Verify onHand was NOT incremented again
      const invAfterSecond = await Inventory.findById(idemInv._id);
      expect(invAfterSecond.onHand).toBe(32);

      // Verify only 1 transaction was logged
      const txCount = await InventoryTransaction.countDocuments({
        referenceId: first.countNumber,
        type: "count_reconciliation",
      });
      expect(txCount).toBe(1);

      // Cleanup
      await Inventory.deleteOne({ _id: idemInv._id });
      await ProductVariant.deleteOne({ _id: idemVariant._id });
      await StockCount.deleteOne({ _id: session._id });
    });
  });

  // ============================================================
  // SUITE 8: MULTI-TENANT ISOLATION & ACCESS CONTROL
  // ============================================================
  describe("8. Multi-Tenant Isolation & Access Control Boundaries", () => {
    let vendorACount;

    beforeEach(async () => {
      vendorACount = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
      });
    });

    afterEach(async () => {
      if (vendorACount?._id) {
        await StockCount.deleteOne({ _id: vendorACount._id });
      }
    });

    it("should strictly reject Vendor B from viewing Vendor A's count session (404)", async () => {
      await expect(
        stockCountService.getVendorStockCount({
          userId: vendorBUser._id,
          id: vendorACount._id.toString(),
        })
      ).rejects.toThrow("Stock count record not found");
    });

    it("should strictly isolate count session listings so Vendor B sees 0 of Vendor A's sessions", async () => {
      const bList = await stockCountService.listVendorStockCounts({
        userId: vendorBUser._id,
        query: {},
      });

      const found = bList.items.find((c) => c._id.toString() === vendorACount._id.toString());
      expect(found).toBeUndefined();
    });

    it("should strictly reject Vendor B from recording counts on Vendor A's session", async () => {
      await expect(
        stockCountService.recordVendorPhysicalCounts({
          userId: vendorBUser._id,
          id: vendorACount._id.toString(),
          items: [{ _id: vendorACount.items[0]._id, countedOnHand: 10 }],
        })
      ).rejects.toThrow("Stock count record not found");
    });

    it("should strictly reject Vendor B from approving or reconciling Vendor A's session", async () => {
      await expect(
        stockCountService.approveVendorStockCount({
          userId: vendorBUser._id,
          id: vendorACount._id.toString(),
        })
      ).rejects.toThrow("Stock count record not found");

      await expect(
        stockCountService.reconcileVendorStockCount({
          userId: vendorBUser._id,
          id: vendorACount._id.toString(),
        })
      ).rejects.toThrow("Stock count record not found");
    });
  });

  // ============================================================
  // SUITE 9: AUDIT EXPORT & ACCURACY METRICS HELPERS
  // ============================================================
  describe("9. Audit Export & Calculation Helpers", () => {
    it("should generate a downloadable CSV audit export for count session", async () => {
      const session = await stockCountService.createVendorStockCount({
        userId: vendorAUser._id,
        warehouseId: testWarehouse._id.toString(),
        countType: "physical",
        scope: "full",
      });

      const exportRes = await stockCountService.exportVendorStockCount({
        userId: vendorAUser._id,
        id: session._id.toString(),
        format: "csv",
      });

      expect(exportRes).toBeDefined();
      expect(exportRes.filename).toContain(session.countNumber);
      expect(exportRes.filename).toMatch(/\.csv$/);
      expect(exportRes.contentType).toContain("text/csv");
      expect(Buffer.isBuffer(exportRes.buffer)).toBe(true);

      const csvContent = exportRes.buffer.toString("utf8");
      expect(csvContent).toContain("Session Number");
      expect(csvContent).toContain("SKU");
      expect(csvContent).toContain("Snapshot (Expected)");
      expect(csvContent).toContain("Physical Counted");
      expect(csvContent).toContain(session.countNumber);
      expect(csvContent).toContain("RECON-DESK-OAK");

      await StockCount.deleteOne({ _id: session._id });
    });

    it("should accurately compute standalone count metrics with 100% match", () => {
      const testItems = [
        { snapshotOnHand: 10, countedOnHand: 10 },
        { snapshotOnHand: 25, countedOnHand: 25 },
      ];

      const metrics = stockCountService.calculateCountMetrics(testItems);
      expect(metrics.totalExpectedQty).toBe(35);
      expect(metrics.totalCountedQty).toBe(35);
      expect(metrics.totalVarianceQty).toBe(0);
      expect(metrics.skuAccuracyRate).toBe(100);
      expect(metrics.quantityAccuracyRate).toBe(100);
    });
  });
});
