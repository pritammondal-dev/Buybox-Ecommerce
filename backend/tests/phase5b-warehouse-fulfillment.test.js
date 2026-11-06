const mongoose = require("mongoose");
const xlsx = require("xlsx");

jest.mock("../src/models/Order");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/WarehouseLocation");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Inventory");

const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const Warehouse = require("../src/models/Warehouse");
const WarehouseLocation = require("../src/models/WarehouseLocation");
const Vendor = require("../src/models/Vendor");
const Inventory = require("../src/models/Inventory");

const fulfillmentService = require("../src/services/fulfillment-operations.service");
const { PERMISSIONS } = require("../src/constants/permissions.constants");

describe("Phase 5B — Warehouse Packing Slips, Pick Lists & Order Exports Test Suite", () => {
  const adminUser = {
    id: new mongoose.Types.ObjectId().toString(),
    role: "admin",
    roles: ["admin"],
    permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.SHIPMENTS_READ, PERMISSIONS.WAREHOUSES_READ],
  };

  const vendor1Id = new mongoose.Types.ObjectId().toString();
  const vendor2Id = new mongoose.Types.ObjectId().toString();
  const vendor1User = {
    id: new mongoose.Types.ObjectId().toString(),
    role: "vendor",
    roles: ["vendor"],
    vendorId: vendor1Id,
    permissions: [PERMISSIONS.ORDERS_READ_OWN, PERMISSIONS.SHIPMENTS_READ_OWN],
  };

  const unauthorizedCustomerUser = {
    id: new mongoose.Types.ObjectId().toString(),
    role: "customer",
    roles: ["customer"],
    permissions: [],
  };

  const warehouse1Id = new mongoose.Types.ObjectId().toString();
  const warehouse2Id = new mongoose.Types.ObjectId().toString();

  const mockWarehouse1 = {
    _id: warehouse1Id,
    name: "Mumbai West Fulfillment Center",
    code: "WH-BOM-01",
    address: {
      addressLine1: "Plot 42, Andheri Industrial Area",
      addressLine2: "Phase II",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400093",
      country: "IN",
    },
    contactPhone: "+91 98765 43210",
    contactEmail: "dock.bom01@buybox.com",
  };

  const mockWarehouse2 = {
    _id: warehouse2Id,
    name: "Delhi North Depot",
    code: "WH-DEL-02",
    address: {
      addressLine1: "Sector 18, Okhla",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110020",
      country: "IN",
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  /*
   * ============================================================
   * 1. PACKING SLIPS & HISTORICAL SNAPSHOT ACCURACY
   * ============================================================
   */
  describe("Phase 5B.1 — Warehouse Packing Slips", () => {
    test("generates full order packing slip using authoritative snapshots and hides sensitive payment info", async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-20261019-001",
        status: "processing",
        paymentStatus: "paid",
        fulfillmentStatus: "unfulfilled",
        createdAt: new Date("2026-10-18T10:00:00Z"),
        shippingAddress: {
          fullName: "Rahul Verma",
          phone: "+91 91234 56789",
          addressLine1: "Flat 402, Sunshine Heights",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "IN",
        },
        deliveryOption: {
          name: "Express Air Delivery",
          estimatedDays: "1-2 business days",
        },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: new mongoose.Types.ObjectId(),
            sku: "TECH-KB-RGB",
            productName: "Mechanical Gaming Keyboard",
            variantName: "RGB / Blue Switch",
            quantity: 2,
            unitPrice: "3499.00",
            lineTotal: "6998.00",
            warehouseId: mockWarehouse1,
            vendorId: { _id: vendor1Id, storeName: "Apex Electronics" },
          },
        ],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrder),
          }),
        }),
      });

      const slip = await fulfillmentService.getPackingSlip({
        orderId,
        user: adminUser,
      });

      expect(slip).toBeDefined();
      expect(slip.orderNumber).toBe("ORD-20261019-001");
      expect(slip.recipient.fullName).toBe("Rahul Verma");
      expect(slip.recipient.city).toBe("Bengaluru");
      expect(slip.warehouse.name).toBe("Mumbai West Fulfillment Center");
      expect(slip.warehouse.code).toBe("WH-BOM-01");
      expect(slip.items).toHaveLength(1);
      expect(slip.items[0].sku).toBe("TECH-KB-RGB");
      expect(slip.items[0].productName).toBe("Mechanical Gaming Keyboard");
      expect(slip.items[0].variantName).toBe("RGB / Blue Switch");
      expect(slip.items[0].quantity).toBe(2);
      expect(slip.totalQuantity).toBe(2);

      // Verify no sensitive payment credentials or internal costs are exposed
      expect(slip).not.toHaveProperty("paymentGateway");
      expect(slip).not.toHaveProperty("gatewaySecret");
      expect(slip).not.toHaveProperty("cardDetails");
      expect(slip.items[0]).not.toHaveProperty("costPrice");
    });

    test("generates shipment-specific packing slip for split shipments with only relevant items", async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const shipmentId = new mongoose.Types.ObjectId().toString();
      const variant1 = new mongoose.Types.ObjectId();
      const variant2 = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-SPLIT-99",
        status: "processing",
        paymentStatus: "paid",
        createdAt: new Date("2026-10-18T10:00:00Z"),
        shippingAddress: {
          fullName: "Priya Sharma",
          city: "Pune",
        },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: variant1,
            sku: "SHIRT-SL-BLU",
            productName: "Linen Shirt",
            variantName: "Blue / L",
            quantity: 3,
          },
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: variant2,
            sku: "DENIM-JN-BLK",
            productName: "Slim Denim Jeans",
            variantName: "Black / 32",
            quantity: 2,
          },
        ],
      };

      // Split Shipment only includes the Linen Shirt (qty: 3), not the Jeans
      const mockShipment = {
        _id: shipmentId,
        orderId,
        shipmentNumber: "SHP-20261019-01",
        status: "ready_to_ship",
        carrier: "BlueDart",
        trackingNumber: "BD987654321IN",
        warehouseId: mockWarehouse1,
        vendorId: { _id: vendor1Id, storeName: "Fashion Hub" },
        shippingAddress: mockOrder.shippingAddress,
        items: [
          {
            productId: mockOrder.items[0].productId,
            productVariantId: variant1,
            sku: "SHIRT-SL-BLU",
            name: "Linen Shirt",
            quantity: 3,
          },
        ],
      };

      Shipment.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockShipment),
          }),
        }),
      });

      Order.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrder),
      });

      const slip = await fulfillmentService.getPackingSlip({
        shipmentId,
        user: adminUser,
      });

      expect(slip).toBeDefined();
      expect(slip.shipmentReference).toBe("SHP-20261019-01");
      expect(slip.carrier).toBe("BlueDart");
      expect(slip.trackingNumber).toBe("BD987654321IN");
      expect(slip.isSplitShipment).toBe(true);
      expect(slip.items).toHaveLength(1);
      expect(slip.items[0].sku).toBe("SHIRT-SL-BLU");
      expect(slip.items[0].quantity).toBe(3);
      expect(slip.totalQuantity).toBe(3);
      // Jeans must NOT be included in this split shipment's packing slip
      expect(slip.items.some((i) => i.sku === "DENIM-JN-BLK")).toBe(false);
    });

    test("rejects unauthorized customer from requesting packing slips (403 ACCESS_DENIED)", async () => {
      await expect(
        fulfillmentService.getPackingSlip({
          orderId: new mongoose.Types.ObjectId().toString(),
          user: unauthorizedCustomerUser,
        })
      ).rejects.toThrow("Access denied");
    });
  });

  /*
   * ============================================================
   * 2. WAREHOUSE PICK LISTS & TRACEABILITY
   * ============================================================
   */
  describe("Phase 5B.2 — Warehouse Pick Lists", () => {
    test("aggregates eligible order items by warehouse and SKU without inventory mutation", async () => {
      const variant1 = new mongoose.Types.ObjectId();
      const variant2 = new mongoose.Types.ObjectId();

      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORD-PL-001",
          status: "confirmed",
          paymentStatus: "paid",
          createdAt: new Date("2026-10-18T10:00:00Z"),
          shippingAddress: { fullName: "Aarav Gupta", city: "Mumbai" },
          items: [
            {
              _id: new mongoose.Types.ObjectId(),
              productId: new mongoose.Types.ObjectId(),
              productVariantId: variant1,
              sku: "HEADSET-PRO-BLK",
              productName: "Wireless Headset",
              variantName: "Black",
              quantity: 2,
              fulfillmentStatus: "unfulfilled",
              warehouseId: mockWarehouse1,
            },
            {
              _id: new mongoose.Types.ObjectId(),
              productId: new mongoose.Types.ObjectId(),
              productVariantId: variant2,
              sku: "MOUSE-GAMING-01",
              productName: "Optical Mouse",
              variantName: "Matte Black",
              quantity: 1,
              fulfillmentStatus: "processing",
              warehouseId: mockWarehouse1,
            },
          ],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORD-PL-002",
          status: "processing",
          paymentStatus: "paid",
          createdAt: new Date("2026-10-18T11:00:00Z"),
          shippingAddress: { fullName: "Sunita Rao", city: "Thane" },
          items: [
            {
              _id: new mongoose.Types.ObjectId(),
              productId: new mongoose.Types.ObjectId(),
              productVariantId: variant1,
              sku: "HEADSET-PRO-BLK",
              productName: "Wireless Headset",
              variantName: "Black",
              quantity: 3,
              fulfillmentStatus: "unfulfilled",
              warehouseId: mockWarehouse1,
            },
          ],
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      });

      // Mock Bin location for variant1
      WarehouseLocation.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            warehouseId: new mongoose.Types.ObjectId(warehouse1Id),
            code: "A-02-B3",
            zone: "Zone A",
            aisle: "Aisle 2",
            rack: "Rack 3",
            shelf: "Shelf 1",
            bin: "Bin 03",
            type: "pick",
            items: [{ productVariantId: variant1, quantity: 50 }],
          },
        ]),
      });

      const pickResult = await fulfillmentService.generatePickList({
        warehouseId: warehouse1Id,
        user: adminUser,
      });

      expect(pickResult).toBeDefined();
      expect(pickResult.totalWarehouses).toBe(1);
      expect(pickResult.totalUniqueSkus).toBe(2);
      expect(pickResult.totalUnitsToPick).toBe(6); // (2 + 3) + 1 = 6 units

      const whPickList = pickResult.pickLists[0];
      expect(whPickList.warehouse.code).toBe("WH-BOM-01");

      const headsetItem = whPickList.items.find((i) => i.sku === "HEADSET-PRO-BLK");
      expect(headsetItem).toBeDefined();
      expect(headsetItem.requiredQuantity).toBe(5); // 2 from ORD-001 + 3 from ORD-002
      expect(headsetItem.primaryLocationCode).toBe("A-02-B3");
      expect(headsetItem.primaryLocation).toContain("Zone: Zone A");
      expect(headsetItem.contributingOrders).toHaveLength(2);
      expect(headsetItem.contributingOrders[0].orderNumber).toBe("ORD-PL-001");
      expect(headsetItem.contributingOrders[1].orderNumber).toBe("ORD-PL-002");

      // Verify unassigned location fallback for variant2 (no bin location set)
      const mouseItem = whPickList.items.find((i) => i.sku === "MOUSE-GAMING-01");
      expect(mouseItem.requiredQuantity).toBe(1);
      expect(mouseItem.primaryLocationCode).toBe("UNASSIGNED");
      expect(mouseItem.primaryLocation).toBe("Unassigned / General Storage");

      // Verify READ-ONLY guarantee: no database updates or writes called
      expect(Order.updateOne || jest.fn()).not.toHaveBeenCalled();
      expect(Inventory.updateOne || jest.fn()).not.toHaveBeenCalled();
      expect(Inventory.findOneAndUpdate || jest.fn()).not.toHaveBeenCalled();
    });

    test("strictly excludes shipped, cancelled, and virtual quantities from pick lists", async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORD-EXCL-01",
          status: "confirmed",
          paymentStatus: "paid",
          items: [
            {
              sku: "SHIPPED-ITEM",
              fulfillmentStatus: "shipped", // EXCLUDED
              quantity: 10,
              warehouseId: mockWarehouse1,
            },
            {
              sku: "CANCELLED-ITEM",
              fulfillmentStatus: "cancelled", // EXCLUDED
              quantity: 5,
              warehouseId: mockWarehouse1,
            },
            {
              sku: "DIGITAL-EBOOK",
              isDownloadable: true, // EXCLUDED
              fulfillmentStatus: "unfulfilled",
              quantity: 1,
              warehouseId: mockWarehouse1,
            },
            {
              sku: "VALID-PHYSICAL-ITEM",
              fulfillmentStatus: "unfulfilled", // INCLUDED
              quantity: 4,
              warehouseId: mockWarehouse1,
            },
          ],
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      });

      WarehouseLocation.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const pickResult = await fulfillmentService.generatePickList({
        user: adminUser,
      });

      expect(pickResult.totalUniqueSkus).toBe(1);
      expect(pickResult.totalUnitsToPick).toBe(4);
      const items = pickResult.pickLists[0].items;
      expect(items[0].sku).toBe("VALID-PHYSICAL-ITEM");
      expect(items.some((i) => i.sku === "SHIPPED-ITEM")).toBe(false);
      expect(items.some((i) => i.sku === "CANCELLED-ITEM")).toBe(false);
      expect(items.some((i) => i.sku === "DIGITAL-EBOOK")).toBe(false);
    });

    test("handles multiple warehouses without duplicating quantities across warehouses", async () => {
      const mockOrders = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORD-MULTI-WH",
          status: "confirmed",
          paymentStatus: "paid",
          items: [
            {
              sku: "SKU-BOM",
              quantity: 5,
              fulfillmentStatus: "unfulfilled",
              warehouseId: mockWarehouse1,
            },
            {
              sku: "SKU-DEL",
              quantity: 7,
              fulfillmentStatus: "unfulfilled",
              warehouseId: mockWarehouse2,
            },
          ],
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrders),
        }),
      });

      WarehouseLocation.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const pickResult = await fulfillmentService.generatePickList({
        user: adminUser,
      });

      expect(pickResult.totalWarehouses).toBe(2);
      expect(pickResult.totalUnitsToPick).toBe(12);

      const bomList = pickResult.pickLists.find((pl) => pl.warehouse.code === "WH-BOM-01");
      const delList = pickResult.pickLists.find((pl) => pl.warehouse.code === "WH-DEL-02");

      expect(bomList.totalUnits).toBe(5);
      expect(delList.totalUnits).toBe(7);
      expect(bomList.items[0].sku).toBe("SKU-BOM");
      expect(delList.items[0].sku).toBe("SKU-DEL");
    });
  });

  /*
   * ============================================================
   * 3. ORDER AND SHIPMENT EXPORTS & FORMULA INJECTION PROTECTION
   * ============================================================
   */
  describe("Phase 5B.3 — Order and Shipment Exports", () => {
    test("sanitizes cells starting with =, +, -, @, \\t, \\r to prevent spreadsheet formula injection", () => {
      const maliciousInputs = [
        "=SUM(A1:A10)",
        "+12345",
        "-DANGEROUS_CMD",
        "@EXTERNAL_URL",
        "\tTAB_INJECT",
        "\rRETURN_INJECT",
        " Normal Value ",
        123,
      ];

      const sanitized = maliciousInputs.map(fulfillmentService.sanitizeCellValue);

      expect(sanitized[0]).toBe("'=SUM(A1:A10)");
      expect(sanitized[1]).toBe("'+12345");
      expect(sanitized[2]).toBe("'-DANGEROUS_CMD");
      expect(sanitized[3]).toBe("'@EXTERNAL_URL");
      expect(sanitized[4]).toBe("'\tTAB_INJECT");
      expect(sanitized[5]).toBe("'\rRETURN_INJECT");
      expect(sanitized[6]).toBe("Normal Value");
      expect(sanitized[7]).toBe(123);
    });

    test("exports orders to valid CSV format with operational headers", async () => {
      const mockOrders = [
        {
          orderNumber: "ORD-EXP-001",
          status: "confirmed",
          paymentStatus: "paid",
          fulfillmentStatus: "unfulfilled",
          currency: "INR",
          subtotal: "1500.00",
          discountTotal: "100.00",
          taxTotal: "270.00",
          shippingTotal: "50.00",
          grandTotal: "1720.00",
          createdAt: new Date("2026-10-18T10:00:00Z"),
          shippingAddress: {
            fullName: "Kavita Patel",
            phone: "+91 99887 76655",
            addressLine1: "12 Marine Drive",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400020",
            country: "IN",
          },
          items: [{ quantity: 2 }],
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      const exportResult = await fulfillmentService.exportOrders({
        query: { status: "confirmed" },
        user: adminUser,
        format: "csv",
      });

      expect(exportResult).toBeDefined();
      expect(exportResult.filename).toContain(".csv");
      expect(exportResult.contentType).toContain("text/csv");
      expect(exportResult.count).toBe(1);

      const csvContent = exportResult.buffer.toString("utf-8");
      expect(csvContent).toContain("Order Number");
      expect(csvContent).toContain("ORD-EXP-001");
      expect(csvContent).toContain("Kavita Patel");
      expect(csvContent).toContain("1720.00");
    });

    test("exports orders to valid XLSX format when requested", async () => {
      const mockOrders = [
        {
          orderNumber: "ORD-XLSX-001",
          status: "confirmed",
          paymentStatus: "paid",
          fulfillmentStatus: "unfulfilled",
          items: [{ quantity: 1 }],
          shippingAddress: { fullName: "Vikram" },
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      const exportResult = await fulfillmentService.exportOrders({
        user: adminUser,
        format: "xlsx",
      });

      expect(exportResult.filename).toContain(".xlsx");
      expect(exportResult.contentType).toContain("spreadsheetml");

      // Verify buffer is readable by xlsx parser
      const parsedWb = xlsx.read(exportResult.buffer, { type: "buffer" });
      expect(parsedWb.SheetNames).toContain("Orders");
    });

    test("enforces vendor tenant isolation: vendor only exports their authorized items and subtotals", async () => {
      const vendor2ItemId = new mongoose.Types.ObjectId();
      const mockOrders = [
        {
          orderNumber: "ORD-MULTI-VEN",
          status: "confirmed",
          paymentStatus: "paid",
          fulfillmentStatus: "partially_fulfilled",
          currency: "INR",
          subtotal: "10000.00", // Platform total
          grandTotal: "11800.00",
          shippingAddress: { fullName: "Shared Customer", city: "Ahmedabad" },
          items: [
            {
              // Vendor 1 Item
              vendorId: vendor1Id,
              sku: "VEN1-ITEM-A",
              productName: "Vendor 1 Item",
              quantity: 2,
              lineTotal: "3000.00",
            },
            {
              // Vendor 2 Item (must NOT leak to Vendor 1)
              vendorId: vendor2Id,
              sku: "SECRET-VEN2-PRODUCT",
              productName: "Vendor 2 Item",
              quantity: 5,
              lineTotal: "7000.00",
            },
          ],
        },
      ];

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOrders),
              }),
            }),
          }),
        }),
      });

      // Vendor 1 exports items
      const vendorExport = await fulfillmentService.exportOrderItems({
        user: vendor1User,
        format: "csv",
      });

      const csvContent = vendorExport.buffer.toString("utf-8");
      expect(csvContent).toContain("VEN1-ITEM-A");
      // Vendor 2's secret item must NEVER appear in Vendor 1's export
      expect(csvContent).not.toContain("SECRET-VEN2-PRODUCT");
      expect(vendorExport.count).toBe(1);
    });

    test("exports shipments with carrier, tracking, and SKU summary", async () => {
      const mockShipments = [
        {
          shipmentNumber: "SHP-EXP-01",
          orderId: { orderNumber: "ORD-999" },
          status: "in_transit",
          carrier: "Delhivery",
          serviceLevel: "Express Surface",
          trackingNumber: "DLV123456789",
          warehouseId: mockWarehouse1,
          vendorId: { storeName: "Apex Retail" },
          shippingAddress: { fullName: "Anoop", city: "Kolkata" },
          items: [
            { sku: "ITEM-A", quantity: 2 },
            { sku: "ITEM-B", quantity: 1 },
          ],
        },
      ];

      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockShipments),
              }),
            }),
          }),
        }),
      });

      const exportResult = await fulfillmentService.exportShipments({
        user: adminUser,
        format: "csv",
      });

      const csvContent = exportResult.buffer.toString("utf-8");
      expect(csvContent).toContain("Shipment Number");
      expect(csvContent).toContain("SHP-EXP-01");
      expect(csvContent).toContain("Delhivery");
      expect(csvContent).toContain("DLV123456789");
      expect(csvContent).toContain("ITEM-A (x2); ITEM-B (x1)");
    });
  });
});
