const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const Warehouse = require("../src/models/Warehouse");
const WarehouseLocation = require("../src/models/WarehouseLocation");
const StockReceiving = require("../src/models/StockReceiving");
const StockTransfer = require("../src/models/StockTransfer");
const StockCount = require("../src/models/StockCount");
const InventoryTransaction = require("../src/models/InventoryTransaction");
const Permission = require("../src/models/Permission");
const Order = require("../src/models/Order");
const Employee = require("../src/models/Employee");

const { PERMISSIONS } = require("../src/constants/permissions.constants");
const { ROLES } = require("../src/constants/auth.constants");
const { generateAccessToken } = require("../src/services/token.service");

const inventoryService = require("../src/services/inventory.service");
const warehouseService = require("../src/services/warehouse.service");
const stockReceivingService = require("../src/services/stock-receiving.service");
const stockTransferService = require("../src/services/stock-transfer.service");
const warehouseLocationService = require("../src/services/warehouse-location.service");
const stockCountService = require("../src/services/stock-count.service");
const orderAllocationService = require("../src/services/order-allocation.service");
const warehouseReportingService = require("../src/services/warehouse-reporting.service");

const TEST_MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/\/buybox(_test)?(\?|$)/, "/buybox_phase4c_test$2")
  : "mongodb://127.0.0.1:27017/buybox_phase4c_test?replicaSet=rs0";

jest.setTimeout(60000);

describe("Buybox Phase 4C — Advanced Warehouse Management & Inventory Operations Tests", () => {
  let adminUser, staffUser, vendorUserA, vendorUserB;
  let testWarehouseA, testWarehouseB;
  let testCategory, testBrand, testProduct, testVariant;

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

  async function createTestUser({ role, firstName, label, permissions = [] }) {
    const rand = Math.random().toString(36).substring(7);
    const user = await User.create({
      firstName,
      lastName: label,
      email: `${label}_${Date.now()}_${rand}@phase4c-test.com`,
      password: "Password123!",
      role,
      isActive: true,
      authVersion: 1,
      permissionVersion: 1,
      permissions,
    });

    const token = generateAccessToken({
      sub: user._id.toString(),
      role: user.role,
      authVersion: user.authVersion,
      permissionVersion: user.permissionVersion,
    });

    return { user, token };
  }

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    await Warehouse.syncIndexes();
    await Inventory.syncIndexes();
    await WarehouseLocation.syncIndexes();
    await StockReceiving.syncIndexes();
    await StockTransfer.syncIndexes();
    await StockCount.syncIndexes();
    await InventoryTransaction.syncIndexes();

    const permSlugs = [
      PERMISSIONS.WAREHOUSES_READ,
      PERMISSIONS.WAREHOUSES_MANAGE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_MANAGE,
    ];
    for (const slug of permSlugs) {
      await getOrCreatePermission(slug);
    }

    await User.deleteMany({ role: "super_admin" });

    adminUser = await createTestUser({
      role: ROLES.SUPER_ADMIN,
      firstName: "Admin",
      label: "admin",
      permissions: permSlugs,
    });

    staffUser = await createTestUser({
      role: ROLES.MANAGER,
      firstName: "Staff",
      label: "staff",
      permissions: [PERMISSIONS.WAREHOUSES_READ, PERMISSIONS.INVENTORY_READ],
    });

    await Employee.create({
      userId: adminUser.user._id,
      employeeNumber: `EMP-ADM-${Date.now().toString().slice(-4)}`,
      department: "Logistics",
      jobTitle: "Operations Administrator",
      status: "active",
    });

    await Employee.create({
      userId: staffUser.user._id,
      employeeNumber: `EMP-STF-${Date.now().toString().slice(-4)}`,
      department: "Logistics",
      jobTitle: "Logistics Staff",
      status: "active",
    });

    const vA = await createTestUser({
      role: ROLES.VENDOR,
      firstName: "Vendor",
      label: "vendorA",
    });
    const vendorRecordA = await Vendor.create({
      userId: vA.user._id,
      businessName: `Vendor Store A ${Date.now()}`,
      businessSlug: `vendor-a-${Date.now()}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorUserA = { ...vA, vendor: vendorRecordA };

    const vB = await createTestUser({
      role: ROLES.VENDOR,
      firstName: "Vendor",
      label: "vendorB",
    });
    const vendorRecordB = await Vendor.create({
      userId: vB.user._id,
      businessName: `Vendor Store B ${Date.now()}`,
      businessSlug: `vendor-b-${Date.now()}`,
      isActive: true,
      onboardingStatus: "approved",
    });
    vendorUserB = { ...vB, vendor: vendorRecordB };

    testCategory = await Category.create({
      name: `Category ${Date.now()}`,
      slug: `cat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      name: `Brand ${Date.now()}`,
      slug: `brand-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isActive: true,
    });

    testProduct = await Product.create({
      name: "Phase 4C Test Product",
      slug: `product-4c-${Date.now()}`,
      sku: `SKU-4C-${Date.now()}`,
      productType: "simple",
      vendorId: vendorUserA.vendor._id,
      categoryId: testCategory._id,
      brandId: testBrand._id,
      status: "active",
      isActive: true,
      price: 100,
    });

    testVariant = await ProductVariant.create({
      productId: testProduct._id,
      sku: `SKU-VAR-4C-${Date.now()}`,
      price: 100,
      stockQuantity: 0,
      stockStatus: "out_of_stock",
      isActive: true,
    });

    testWarehouseA = await Warehouse.create({
      name: "Primary Central Hub",
      code: `WH-CEN-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "100 Industrial Parkway",
        city: "Metro City",
        state: "State",
        postalCode: "123456",
        country: "IN",
      },
      isActive: true,
      capacity: 50000,
      operatingHours: "08:00 - 20:00",
    });

    testWarehouseB = await Warehouse.create({
      name: "Secondary Regional Annex",
      code: `WH-REG-${Date.now().toString().slice(-4)}`,
      address: {
        addressLine1: "200 Logistics Avenue",
        city: "Harbor City",
        state: "State",
        postalCode: "654321",
        country: "IN",
      },
      isActive: true,
      capacity: 25000,
      operatingHours: "09:00 - 18:00",
    });
  });

  afterAll(async () => {
    // Clean up collections created for this suite
    await Warehouse.deleteMany({ _id: { $in: [testWarehouseA?._id, testWarehouseB?._id] } });
    await Product.deleteMany({ _id: testProduct?._id });
    await ProductVariant.deleteMany({ _id: testVariant?._id });
    await Employee.deleteMany({ userId: { $in: [adminUser?.user?._id, staffUser?.user?._id] } });
    await User.deleteMany({ _id: { $in: [adminUser?.user?._id, staffUser?.user?._id, vendorUserA?.user?._id, vendorUserB?.user?._id] } });
    await User.deleteMany({ role: "super_admin" });
  });

  // ----------------------------------------------------
  // TEST 1: Warehouse Creation and Unique Codes
  // ----------------------------------------------------
  describe("1. Warehouse Creation and Unique Codes", () => {
    test("creates a warehouse with capacity, manager, and operating hours", async () => {
      const code = `WH-TEST-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post("/api/v1/warehouses")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: "Test Branch Warehouse",
          code,
          address: {
            addressLine1: "555 Test Way",
            city: "Testville",
            state: "TS",
            postalCode: "999999",
            country: "IN",
          },
          capacity: 10000,
          operatingHours: "07:00 - 19:00",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.warehouse.code).toBe(code);
      expect(res.body.data.warehouse.capacity).toBe(10000);

      // Duplicate code rejection
      const dupRes = await request(app)
        .post("/api/v1/warehouses")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          name: "Duplicate Branch",
          code,
          address: {
            addressLine1: "555 Other Way",
            city: "Testville",
            state: "TS",
            postalCode: "999999",
            country: "IN",
          },
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe("WAREHOUSE_CODE_ALREADY_EXISTS");
    });
  });

  // ----------------------------------------------------
  // TEST 2: Warehouse Authorization and Vendor Isolation
  // ----------------------------------------------------
  describe("2. Warehouse Authorization & Safe Deactivation", () => {
    test("rejects warehouse deactivation if active inventory exists", async () => {
      // Ensure clean start
      await Inventory.deleteMany({ warehouseId: testWarehouseA._id });

      // Create inventory in Warehouse A
      const invA = await Inventory.create({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
        onHand: 25,
        reserved: 0,
      });

      try {
        // Attempt deactivating warehouse A
        const res = await request(app)
          .patch(`/api/v1/warehouses/${testWarehouseA._id}`)
          .set("Authorization", `Bearer ${adminUser.token}`)
          .send({ isActive: false });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe("WAREHOUSE_HAS_ACTIVE_INVENTORY");
      } finally {
        // Clean up for subsequent tests
        await Inventory.deleteMany({ warehouseId: testWarehouseA._id });
      }
    });
  });

  // ----------------------------------------------------
  // TEST 3 & 4 & 5: Stock Receiving Lifecycle & Discrepancies
  // ----------------------------------------------------
  describe("3, 4, 5. Stock Receiving, Idempotency & Discrepancies", () => {
    let receivingRecord;

    test("creates a receiving record with expected, received, and rejected items", async () => {
      const res = await request(app)
        .post("/api/v1/warehouse-operations/receiving")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          destinationWarehouseId: testWarehouseA._id,
          supplierName: "Apex Manufacturing Corp",
          referenceDocumentNumber: "PO-2026-9001",
          items: [
            {
              productVariantId: testVariant._id,
              quantityExpected: 100,
              quantityReceived: 95,
              quantityRejected: 5,
              discrepancyNotes: "5 units damaged in shipping crate",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(["draft", "pending"]).toContain(res.body.data.status);
      receivingRecord = res.body.data;
    });

    test("confirms receiving atomically, updating authoritative Inventory.onHand and logging ledger", async () => {
      const confirmRes = await request(app)
        .post(`/api/v1/warehouse-operations/receiving/${receivingRecord._id}/confirm`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .set("idempotency-key", `idemp-rec-${receivingRecord._id}`)
        .send();

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe("confirmed");

      // Verify authoritative Inventory record
      const inv = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
      });
      expect(inv).toBeTruthy();
      expect(inv.onHand).toBe(95);

      // Verify inventory transaction ledger record
      const tx = await InventoryTransaction.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
        referenceType: "stock_receiving",
      });
      expect(tx).toBeTruthy();
      expect(tx.quantity).toBe(95);
      expect(tx.type).toBe("receive");
    });

    test("prevents duplicate confirmation on already confirmed receiving", async () => {
      const dupRes = await request(app)
        .post(`/api/v1/warehouse-operations/receiving/${receivingRecord._id}/confirm`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send();

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });

  // ----------------------------------------------------
  // TEST 6, 7, 8, 9, 10: Multi-Stage Transfers, In-Transit & Concurrency
  // ----------------------------------------------------
  describe("6 - 10. Multi-Stage Warehouse Transfers & In-Transit Tracking", () => {
    let transferRecord;

    test("rejects transfer creation when source and destination warehouses are identical", async () => {
      const res = await request(app)
        .post("/api/v1/warehouse-operations/transfers")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          sourceWarehouseId: testWarehouseA._id,
          destinationWarehouseId: testWarehouseA._id,
          items: [{ productVariantId: testVariant._id, quantityRequested: 10 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("SAME_WAREHOUSE_TRANSFER");
    });

    test("creates draft transfer and approves it", async () => {
      const res = await request(app)
        .post("/api/v1/warehouse-operations/transfers")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          sourceWarehouseId: testWarehouseA._id,
          destinationWarehouseId: testWarehouseB._id,
          items: [{ productVariantId: testVariant._id, quantityRequested: 40 }],
          reason: "Replenish regional warehouse",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("draft");
      transferRecord = res.body.data;

      // Approve transfer
      const appRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/approve`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send();

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.status).toBe("approved");
    });

    test("dispatches transfer, deducting source stock and tracking in-transit", async () => {
      const dispRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/dispatch`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          carrier: "BlueDart Express",
          trackingNumber: "BD-908123471",
        });

      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.status).toBe("dispatched");
      expect(dispRes.body.data.trackingNumber).toBe("BD-908123471");

      // Verify source inventory was deducted
      const sourceInv = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
      });
      // Started with 95, dispatched 40 => 55 remaining
      expect(sourceInv.onHand).toBe(55);

      // Verify destination inventory is NOT yet updated (stock is in-transit)
      const destInv = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(destInv ? destInv.onHand : 0).toBe(0);
    });

    test("prevents duplicate dispatch of an already dispatched transfer", async () => {
      const dupRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/dispatch`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send();

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe("INVALID_STATUS_TRANSITION");
    });

    test("prevents cancellation once transfer has been dispatched", async () => {
      const cancelRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/cancel`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ reason: "Cancel after dispatch should fail" });

      expect(cancelRes.status).toBe(409);
      expect(cancelRes.body.code).toBe("CANNOT_CANCEL_DISPATCHED_TRANSFER");
    });

    test("receives transfer partially, logging discrepancies and updating destination stock", async () => {
      // Dispatched 40 units; receive 35 units with 5 damaged in transit
      const recRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/receive`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          receivedItems: [
            {
              productVariantId: testVariant._id,
              quantityReceived: 35,
              discrepancyReason: "5 units broken in transit",
            },
          ],
        });

      expect(recRes.status).toBe(200);
      expect(recRes.body.data.status).toBe("partially_received");

      // Check destination warehouse stock
      const destInv = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(destInv).toBeTruthy();
      expect(destInv.onHand).toBe(35);

      // Receive the remaining 5 units
      const finalRecRes = await request(app)
        .post(`/api/v1/warehouse-operations/transfers/${transferRecord._id}/receive`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          receivedItems: [
            {
              productVariantId: testVariant._id,
              quantityReceived: 5,
            },
          ],
        });

      expect(finalRecRes.status).toBe(200);
      expect(finalRecRes.body.data.status).toBe("received");

      const destInvFinal = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(destInvFinal.onHand).toBe(40);
    });

    test("rejects dispatch if available stock at source is insufficient", async () => {
      // Source Warehouse A currently has 55 units on-hand. Request transfer of 100 units.
      const tDraft = await stockTransferService.createTransfer({
        sourceWarehouseId: testWarehouseA._id,
        destinationWarehouseId: testWarehouseB._id,
        items: [{ productVariantId: testVariant._id, quantityRequested: 100 }],
        requestedByUserId: adminUser.user._id,
      });
      await stockTransferService.approveTransfer({
        transferId: tDraft._id,
        actorUserId: adminUser.user._id,
      });

      await expect(
        stockTransferService.dispatchTransfer({
          transferId: tDraft._id,
          actorUserId: adminUser.user._id,
        })
      ).rejects.toThrow(/Insufficient available stock/);
    });
  });

  // ----------------------------------------------------
  // TEST 11: Bin and Shelf Locations
  // ----------------------------------------------------
  describe("11. Bin Locations & Location-Level Reconciliation", () => {
    let locA1, locA2;

    test("creates bin locations with warehouse-scoped unique codes", async () => {
      const code = "AISLE-1-BIN-A";
      const res = await request(app)
        .post("/api/v1/warehouse-operations/locations")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          warehouseId: testWarehouseA._id,
          code,
          zone: "Zone A",
          aisle: "1",
          rack: "A",
          shelf: "Top",
          capacity: 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe(code);
      locA1 = res.body.data;

      // Duplicate in same warehouse should fail
      const dupRes = await request(app)
        .post("/api/v1/warehouse-operations/locations")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          warehouseId: testWarehouseA._id,
          code,
          zone: "Zone A",
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe("LOCATION_CODE_ALREADY_EXISTS");

      // Same code in different warehouse is permitted
      const otherWhRes = await request(app)
        .post("/api/v1/warehouse-operations/locations")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          warehouseId: testWarehouseB._id,
          code,
          zone: "Zone A",
        });
      expect(otherWhRes.status).toBe(201);

      // Create a second location in warehouse A for move testing
      const loc2Res = await request(app)
        .post("/api/v1/warehouse-operations/locations")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          warehouseId: testWarehouseA._id,
          code: "AISLE-1-BIN-B",
          zone: "Zone A",
        });
      locA2 = loc2Res.body.data;
    });

    test("assigns item to location and safely moves item between locations without modifying authoritative onHand", async () => {
      // Warehouse A has 55 onHand. Assign 30 units to locA1
      const assignRes = await request(app)
        .post(`/api/v1/warehouse-operations/locations/${locA1._id}/assign`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          productVariantId: testVariant._id,
          quantity: 30,
        });

      expect(assignRes.status).toBe(200);

      // Move 10 units from locA1 to locA2
      const moveRes = await request(app)
        .post("/api/v1/warehouse-operations/locations/move")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          sourceLocationId: locA1._id,
          destinationLocationId: locA2._id,
          productVariantId: testVariant._id,
          quantity: 10,
        });

      expect(moveRes.status).toBe(200);

      // Verify authoritative Inventory.onHand remains exactly 55
      const invA = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
      });
      expect(invA.onHand).toBe(55);
    });
  });

  // ----------------------------------------------------
  // TEST 12: Cycle Counts & Stale-Snapshot Protection
  // ----------------------------------------------------
  describe("12. Stock Counts & Stale-Snapshot Protection", () => {
    test("initializes count snapshot, records physical counts, and reconciles ledger delta", async () => {
      // Warehouse B currently has 40 units on hand
      const createRes = await request(app)
        .post("/api/v1/warehouse-operations/counts")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          warehouseId: testWarehouseB._id,
          type: "cycle_count",
          description: "Monthly cycle audit",
        });

      expect(createRes.status).toBe(201);
      const count = createRes.body.data;
      expect(count.items[0].systemQuantitySnapshot).toBe(40);

      // Record physical count: auditor counted 42 units (2 extra found)
      const recordRes = await request(app)
        .post(`/api/v1/warehouse-operations/counts/${count._id}/record`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({
          items: [
            {
              productVariantId: testVariant._id,
              countedQuantity: 42,
              notes: "Found 2 extra sealed units on top shelf",
            },
          ],
        });

      expect(recordRes.status).toBe(200);
      expect(recordRes.body.data.items[0].discrepancy).toBe(2);

      // Reconcile and finalize
      const finalizeRes = await request(app)
        .post(`/api/v1/warehouse-operations/counts/${count._id}/reconcile`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .send({ notes: "Audit approved by warehouse director" });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.data.status).toBe("finalized");

      // Verify authoritative Inventory.onHand is updated to 42
      const invB = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(invB.onHand).toBe(42);

      // Verify ledger transaction logged
      const tx = await InventoryTransaction.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
        type: "count_reconciliation",
      });
      expect(tx).toBeTruthy();
      expect(tx.quantity).toBe(2);
    });
  });

  // ----------------------------------------------------
  // TEST 13: Stock Adjustments & Non-Sellable Inventory Isolation
  // ----------------------------------------------------
  describe("13. Adjustments & Non-Sellable Stock Protection", () => {
    test("marks stock as damaged and prevents damaged units from being available for sale", async () => {
      // Warehouse A has onHand = 55, reserved = 0
      const invBefore = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
      });
      expect(invBefore.onHand).toBe(55);

      // Mark 10 units as damaged
      const adjRes = await inventoryService.adjustStock(
        invBefore._id,
        10,
        {
          condition: "damaged",
          disposition: "mark_condition",
          reason: "Forklift dropped pallet",
          actorUserId: adminUser.user._id,
        }
      );

      expect(adjRes.damaged).toBe(10);
      expect(adjRes.onHand).toBe(55);
      // available virtual = 55 - 0 - 10 = 45
      expect(adjRes.available).toBe(45);

      // Try reserving 50 units (should fail because only 45 are available!)
      await expect(
        inventoryService.reserveStock(invBefore._id, 50)
      ).rejects.toThrow();

      // Reserve 40 units (should succeed)
      const resStock = await inventoryService.reserveStock(invBefore._id, 40);
      expect(resStock.reserved).toBe(40);
      expect(resStock.available).toBe(5);

      // Release reserved stock back
      await inventoryService.releaseStock(invBefore._id, 40);

      // Write-off 5 damaged units (scrap discard)
      const writeOffRes = await inventoryService.adjustStock(
        invBefore._id,
        5,
        {
          condition: "damaged",
          disposition: "write_off",
          reason: "Discarding broken items",
          actorUserId: adminUser.user._id,
        }
      );

      expect(writeOffRes.damaged).toBe(5);
      expect(writeOffRes.onHand).toBe(50); // 55 - 5
      expect(writeOffRes.available).toBe(45); // 50 - 5
    });
  });

  // ----------------------------------------------------
  // TEST 14 & 15: Order Allocation & Reallocation
  // ----------------------------------------------------
  describe("14, 15. Order Allocation Strategies & Reallocation", () => {
    test("determines eligible warehouses sorted by deepest available stock", async () => {
      // Warehouse A available: 45 units. Warehouse B available: 42 units.
      const eligible = await orderAllocationService.getEligibleWarehousesForItem({
        productVariantId: testVariant._id,
        requiredQuantity: 10,
        strategy: "deepest_stock",
      });

      expect(eligible.length).toBe(2);
      expect(eligible[0].warehouseId.toString()).toBe(testWarehouseA._id.toString());
      expect(eligible[0].availableStock).toBe(45);
      expect(eligible[1].warehouseId.toString()).toBe(testWarehouseB._id.toString());
      expect(eligible[1].availableStock).toBe(42);
    });

    test("reallocates order item reservation from one warehouse to another safely", async () => {
      // Create a test order reserving 5 units from Warehouse A
      const order = await Order.create({
        orderNumber: `ORD-ALLOC-${Date.now()}`,
        customerId: new mongoose.Types.ObjectId(),
        status: "processing",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        items: [
          {
            productId: testProduct._id,
            productVariantId: testVariant._id,
            vendorId: vendorUserA.vendor._id,
            warehouseId: testWarehouseA._id,
            sku: testVariant.sku,
            productName: "Phase 4C Test Product",
            quantity: 5,
            unitPrice: 100,
            currency: "INR",
            discountTotal: 0,
            taxTotal: 0,
            lineTotal: 500,
            isAllocated: true,
          },
        ],
        totals: {
          subtotal: 500,
          discountTotal: 0,
          taxTotal: 0,
          shippingTotal: 0,
          grandTotal: 500,
          total: 500,
        },
        shippingAddress: {
          fullName: "Customer Test",
          phone: "+919876543210",
          addressLine1: "123 Test St",
          city: "Metro City",
          state: "State",
          postalCode: "123456",
          country: "IN",
        },
      });

      // Manually reserve in warehouse A to simulate initial order placement
      const invA = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseA._id,
      });
      await inventoryService.reserveStock(invA._id, 5);

      // Reallocate to Warehouse B
      const result = await orderAllocationService.reallocateOrderItem({
        orderId: order._id,
        productVariantId: testVariant._id,
        targetWarehouseId: testWarehouseB._id,
        actorUserId: adminUser.user._id,
        reason: "Customer shipping destination closer to Regional Annex",
      });

      expect(result.success).toBe(true);
      expect(result.order.items[0].warehouseId.toString()).toBe(testWarehouseB._id.toString());

      // Verify Warehouse A reservation was released
      const invARefreshed = await Inventory.findById(invA._id);
      expect(invARefreshed.reserved).toBe(0);

      // Verify Warehouse B reservation was created
      const invB = await Inventory.findOne({
        productVariantId: testVariant._id,
        warehouseId: testWarehouseB._id,
      });
      expect(invB.reserved).toBe(5);

      // Clean up order
      await inventoryService.releaseStock(invB._id, 5);
      await Order.deleteOne({ _id: order._id });
    });
  });

  // ----------------------------------------------------
  // TEST 16: Ledger Reconciliation
  // ----------------------------------------------------
  describe("16. Ledger Transaction Consistency", () => {
    test("all stock-changing operations created corresponding ledger entries", async () => {
      const transactions = await InventoryTransaction.find({
        productVariantId: testVariant._id,
      });

      expect(transactions.length).toBeGreaterThan(0);
      const types = transactions.map((t) => t.type);
      expect(types).toContain("receive");
      expect(types).toContain("transfer");
      expect(types).toContain("count_reconciliation");
    });
  });

  // ----------------------------------------------------
  // TEST 17: Staff Permission Enforcement
  // ----------------------------------------------------
  describe("17. Staff Permission Enforcement", () => {
    test("prevents staff lacking manage permissions from creating transfers", async () => {
      // staffUser only has READ permissions
      const res = await request(app)
        .post("/api/v1/warehouse-operations/transfers")
        .set("Authorization", `Bearer ${staffUser.token}`)
        .send({
          sourceWarehouseId: testWarehouseA._id,
          destinationWarehouseId: testWarehouseB._id,
          items: [{ productVariantId: testVariant._id, quantityRequested: 1 }],
        });

      expect(res.status).toBe(403);
    });
  });

  // ----------------------------------------------------
  // TEST 18: Reporting Authorization & Pagination
  // ----------------------------------------------------
  describe("18. Warehouse Reporting & Dashboard Metrics", () => {
    test("fetches warehouse dashboard overview with authoritative totals", async () => {
      const res = await request(app)
        .get("/api/v1/warehouse-operations/reports/overview")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .query({ warehouseId: testWarehouseA._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.totalUnitsOnHand).toBeGreaterThan(0);
      expect(res.body.data.recentActivity).toBeDefined();
    });

    test("fetches paginated inventory report and movement history", async () => {
      const reportRes = await request(app)
        .get("/api/v1/warehouse-operations/reports/inventory")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .query({ limit: 10, page: 1 });

      expect(reportRes.status).toBe(200);
      expect(Array.isArray(reportRes.body.data.items)).toBe(true);
      expect(reportRes.body.data.meta.page).toBe(1);

      const historyRes = await request(app)
        .get("/api/v1/warehouse-operations/reports/movement-history")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .query({ limit: 10, page: 1 });

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.data.items)).toBe(true);
      expect(historyRes.body.data.meta.total).toBeGreaterThan(0);
    });
  });
});
