const mongoose = require("mongoose");

jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/WarehouseLocation");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent");
jest.mock("../src/models/NotificationOutbox");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/FulfillmentException");
jest.mock("../src/models/DigitalEntitlement");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/integrations/payments/razorpay.provider");
jest.mock("../src/services/credential.service");

const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const Refund = require("../src/models/Refund");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const WarehouseLocation = require("../src/models/WarehouseLocation");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");
const AuditLog = require("../src/models/AuditLog");
const FulfillmentException = require("../src/models/FulfillmentException");
const DigitalEntitlement = require("../src/models/DigitalEntitlement");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");

const orderRepository = require("../src/repositories/order.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const refundRepository = require("../src/repositories/refund.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const razorpayProvider = require("../src/integrations/payments/razorpay.provider");
const CredentialService = require("../src/services/credential.service");

const paymentService = require("../src/services/payment.service");
const orderRecoveryService = require("../src/services/order-recovery.service");
const courierService = require("../src/services/courier.service");
const fulfillmentExceptionService = require("../src/services/fulfillment-exception.service");
const fulfillmentOperationsService = require("../src/services/fulfillment-operations.service");
const digitalEntitlementService = require("../src/services/digital-entitlement.service");
const orderService = require("../src/services/order.service");

describe("Phase 5E — Final Order Management Acceptance E2E Suite", () => {
  const customer1Id = new mongoose.Types.ObjectId();
  const customer2Id = new mongoose.Types.ObjectId();
  const customer1UserId = new mongoose.Types.ObjectId().toString();
  const customer2UserId = new mongoose.Types.ObjectId().toString();

  const vendorAId = new mongoose.Types.ObjectId();
  const vendorBId = new mongoose.Types.ObjectId();

  const warehouseId = new mongoose.Types.ObjectId();
  const physicalVariantId = new mongoose.Types.ObjectId();
  const digitalProductId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. CUSTOMER ORDER LIFECYCLE & DIGITAL ENTITLEMENTS
  // --------------------------------------------------------------------------
  describe("1. Customer Order Lifecycle & Digital Entitlements", () => {
    test("order payment capture idempotently creates digital entitlements without exposing secrets", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const digitalFileId = "file_download_123";

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5E-001",
        customerId: customer1Id,
        paymentStatus: "paid",
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productId: digitalProductId,
            productVariantId: null,
            productName: "E-Book Guide",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("299.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("299.00"),
            isDownloadable: true,
          },
        ],
      };

      // Mock Product lookup
      Product.findById = jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: digitalProductId,
          isDownloadable: true,
          downloadableFiles: [
            {
              id: digitalFileId,
              name: "Guide.pdf",
              fileName: "Guide.pdf",
              storageKey: "keys/guide.pdf",
              fileSize: 1048576,
              version: "1.0",
            },
          ],
          downloadLimit: 5,
          downloadExpiryDays: 30,
        }),
      });

      const mockEntitlement = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        customerId: customer1Id,
        productId: digitalProductId,
        asset: { id: digitalFileId, name: "Guide.pdf" },
        status: "active",
      };

      DigitalEntitlement.findOneAndUpdate = jest.fn().mockResolvedValue(mockEntitlement);

      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;

      const entitlements = await digitalEntitlementService.createEntitlementsForOrder(mockOrder);

      expect(entitlements).toHaveLength(1);
      expect(entitlements[0].status).toBe("active");
      expect(DigitalEntitlement.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ orderId, productId: digitalProductId }),
        expect.any(Object),
        expect.objectContaining({ upsert: true, new: true })
      );

      mongoose.connection.readyState = origReadyState;
    });

    test("order cancellation revokes active digital entitlements", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;

      DigitalEntitlement.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const revokeResult = await digitalEntitlementService.revokeEntitlementsForOrder(
        orderId,
        "Customer requested cancellation",
        customer1UserId
      );

      expect(revokeResult.modifiedCount).toBe(1);
      expect(DigitalEntitlement.updateMany).toHaveBeenCalledWith(
        { orderId, status: { $ne: "revoked" } },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "revoked",
            revocationReason: "Customer requested cancellation",
          }),
        }),
        expect.any(Object)
      );

      mongoose.connection.readyState = origReadyState;
    });
  });

  // --------------------------------------------------------------------------
  // 2. MULTI-VENDOR FULFILLMENT & PACKING SLIP ISOLATION
  // --------------------------------------------------------------------------
  describe("2. Multi-Vendor Fulfillment & Tenant Packing Slip Isolation", () => {
    test("vendor packing slip exports only items and shipments belonging to authorized vendor", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const itemAId = new mongoose.Types.ObjectId();
      const itemBId = new mongoose.Types.ObjectId();

      const itemA = {
        _id: itemAId,
        vendorId: vendorAId,
        sku: "SKU-VEND-A",
        productName: "Vendor A Item",
        quantity: 2,
        unitPrice: mongoose.Types.Decimal128.fromString("400.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("800.00"),
        warehouseId,
      };

      const itemB = {
        _id: itemBId,
        vendorId: vendorBId,
        sku: "SKU-VEND-B",
        productName: "Vendor B Item",
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString("600.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("600.00"),
        warehouseId,
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5E-002",
        createdAt: new Date("2026-10-01"),
        status: "processing",
        shippingAddress: {
          fullName: "Alice Doe",
          addressLine1: "123 Main St",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
        },
        items: [itemA, itemB],
      };

      const orderQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.findById = jest.fn().mockReturnValue(orderQuery);

      Warehouse.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: warehouseId, name: "South Hub", code: "WH-BLR-01" }),
      });

      // Vendor A requests packing slip
      const slipA = await fulfillmentOperationsService.getPackingSlip({
        orderId,
        user: { role: "vendor", vendorId: vendorAId },
      });

      // Must only contain Vendor A item
      expect(slipA.items).toHaveLength(1);
      expect(slipA.items[0].sku).toBe("SKU-VEND-A");

      // Grand total reflects only Vendor A line items
      expect(slipA.totalQuantity).toBe(2);
    });

    test("disallowed vendor accessing foreign order packing slip throws 404 or 403", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const foreignVendorId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5E-003",
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            vendorId: vendorAId,
            sku: "SKU-VEND-A",
            quantity: 1,
          },
        ],
      };

      const orderQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      };
      Order.findById = jest.fn().mockReturnValue(orderQuery);

      await expect(
        fulfillmentOperationsService.getPackingSlip({
          orderId,
          user: { role: "vendor", vendorId: foreignVendorId },
        })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 3. WAREHOUSE OPERATIONS, ZERO-MUTATION PICK LISTS & EXPORT SANITIZATION
  // --------------------------------------------------------------------------
  describe("3. Warehouse Operations, Zero-Mutation Pick Lists & Export Safety", () => {
    test("generating pick list aggregates eligible unfulfilled items without mutating inventory records", async () => {
      const order1Id = new mongoose.Types.ObjectId();
      const order2Id = new mongoose.Types.ObjectId();

      const mockOrder1 = {
        _id: order1Id,
        orderNumber: "ORD-5E-WH1",
        status: "processing",
        paymentStatus: "paid",
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productVariantId: physicalVariantId,
            warehouseId,
            sku: "SKU-WH-PHYSICAL",
            productName: "Ergonomic Keyboard",
            quantity: 3,
            fulfillmentStatus: "processing",
          },
        ],
      };

      const mockOrder2 = {
        _id: order2Id,
        orderNumber: "ORD-5E-WH2",
        status: "processing",
        paymentStatus: "paid",
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productVariantId: physicalVariantId,
            warehouseId,
            sku: "SKU-WH-PHYSICAL",
            productName: "Ergonomic Keyboard",
            quantity: 2,
            fulfillmentStatus: "processing",
          },
        ],
      };

      Order.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockOrder1, mockOrder2]),
        }),
      });

      Warehouse.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: warehouseId, name: "Central Hub", code: "WH-CENTRAL" }),
      });

      WarehouseLocation.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const pickListResult = await fulfillmentOperationsService.generatePickList({
        warehouseId,
        user: { role: "admin" },
      });

      expect(pickListResult.totalUnitsToPick).toBe(5);
      expect(pickListResult.pickLists).toHaveLength(1);
      expect(pickListResult.pickLists[0].totalUnits).toBe(5);
      const contributingOrderNumbers = pickListResult.pickLists[0].items[0].contributingOrders.map(
        (o) => o.orderNumber
      );
      expect(contributingOrderNumbers).toEqual(
        expect.arrayContaining(["ORD-5E-WH1", "ORD-5E-WH2"])
      );

      // Inventory mutations must be strictly zero
      expect(inventoryRepository.releaseReservedStock).not.toHaveBeenCalled();
      expect(inventoryRepository.adjustStockCondition).not.toHaveBeenCalled();
    });

    test("spreadsheet export strictly sanitizes formula injection characters (=, +, -, @)", async () => {
      const queryMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            orderNumber: "=SUM(1,2)",
            createdAt: new Date(),
            subtotal: 100,
            grandTotal: 100,
            status: "processing",
            paymentStatus: "paid",
            fulfillmentStatus: "unfulfilled",
            shippingAddress: {
              fullName: "+alert(1)",
              phone: "@malicious",
            },
            items: [],
          },
        ]),
      };
      Order.find = jest.fn().mockReturnValue(queryMock);

      const { buffer } = await fulfillmentOperationsService.exportOrders({
        query: {},
        user: { role: "admin" },
        format: "csv",
      });

      const csvString = buffer.toString("utf-8");
      // All formula injection triggers must be prefixed with a single quote
      expect(csvString).toContain("'=SUM(1,2)");
      expect(csvString).toContain("'+alert(1)");
      expect(csvString).toContain("'@malicious");
    });
  });

  // --------------------------------------------------------------------------
  // 4. DAMAGED GOODS ISOLATION & MULTI-VENDOR PARTIAL CANCELLATIONS
  // --------------------------------------------------------------------------
  describe("4. Damaged Goods Isolation & Multi-Vendor Partial Cancellations", () => {
    test("damaged stock exception approval isolates bad stock and refunds without touching other vendor", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const itemDamagedId = new mongoose.Types.ObjectId();
      const itemHealthyId = new mongoose.Types.ObjectId();

      const itemDamaged = {
        _id: itemDamagedId,
        vendorId: vendorAId,
        sku: "SKU-DAMAGED",
        quantity: 1,
        unitPrice: mongoose.Types.Decimal128.fromString("750.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("750.00"),
        inventoryStatus: "reserved",
        fulfillmentStatus: "processing",
        warehouseId,
        productVariantId: physicalVariantId,
      };

      const itemHealthy = {
        _id: itemHealthyId,
        vendorId: vendorBId,
        sku: "SKU-HEALTHY",
        quantity: 2,
        unitPrice: mongoose.Types.Decimal128.fromString("500.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
        inventoryStatus: "reserved",
        fulfillmentStatus: "processing",
        warehouseId,
        productVariantId: new mongoose.Types.ObjectId(),
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5E-004",
        status: "processing",
        paymentStatus: "paid",
        customerId: customer1Id,
        items: [itemDamaged, itemHealthy],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockException = {
        _id: new mongoose.Types.ObjectId(),
        exceptionNumber: "EXC-5E-001",
        orderId,
        orderItemId: itemDamagedId,
        vendorId: vendorAId,
        quantity: 1,
        reason: "damaged_stock",
        status: "under_review",
        timeline: [],
        cancellationDetails: {},
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findById = jest.fn().mockReturnValue(
        Object.assign(Promise.resolve(mockException), {
          populate: jest.fn().mockReturnThis(),
        })
      );

      Vendor.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            email: "vendorA@buybox.test",
            storeName: "Vendor A Store",
          }),
        }),
      });

      Order.findById = jest.fn().mockResolvedValue(mockOrder);

      const invRecordId = new mongoose.Types.ObjectId();
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
        _id: invRecordId,
        reserved: 5,
      });
      inventoryRepository.releaseReservedStock.mockResolvedValue(true);
      inventoryRepository.adjustStockCondition.mockResolvedValue(true);

      paymentRepository.findLatestByOrderId.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("1750.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
      });

      jest.spyOn(paymentService, "refundPaymentForOrder").mockResolvedValue({
        status: "partially_refunded",
        refundedAmount: "750.00",
      });

      const approval = await fulfillmentExceptionService.adminApproveCancellation({
        exceptionId: mockException._id,
        notes: "Approved damaged goods return",
        actorUser: { userId: "admin_superuser", role: "super_admin" },
      });

      expect(approval.success).toBe(true);

      // Damaged stock must be isolated
      expect(inventoryRepository.releaseReservedStock).toHaveBeenCalledWith(invRecordId, 1);
      expect(inventoryRepository.adjustStockCondition).toHaveBeenCalledWith(
        invRecordId,
        expect.objectContaining({ condition: "damaged", quantity: 1, disposition: "mark_condition" })
      );

      // Vendor A item is cancelled
      expect(itemDamaged.fulfillmentStatus).toBe("cancelled");
      expect(itemDamaged.inventoryStatus).toBe("released");

      // Vendor B item is untouched
      expect(itemHealthy.fulfillmentStatus).toBe("processing");
      expect(itemHealthy.inventoryStatus).toBe("reserved");

      // Multi-vendor order remains active
      expect(mockOrder.status).toBe("processing");
      expect(mockOrder.paymentStatus).toBe("partially_refunded");
    });
  });

  // --------------------------------------------------------------------------
  // 5. OPERATIONAL RECOVERY & INCOMPLETE CANCELLATION HEALING
  // --------------------------------------------------------------------------
  describe("5. Operational Recovery & Incomplete Cancellation Self-Healing", () => {
    test("reconciles interrupted cancellation by releasing remaining stock and capturing unrefunded balance", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const itemId = new mongoose.Types.ObjectId();

      const incompleteItem = {
        _id: itemId,
        productVariantId: physicalVariantId,
        warehouseId,
        sku: "SKU-INCOMPLETE-ITEM",
        quantity: 2,
        inventoryStatus: "reserved", // Interrupted: cancelled order item but inventory never released
        fulfillmentStatus: "cancelled",
      };

      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-5E-RECOV",
        customerId: customer1Id,
        status: "cancelled",
        paymentStatus: "paid", // Interrupted: order marked cancelled but payment never refunded
        items: [incompleteItem],
        save: jest.fn().mockResolvedValue(true),
      };

      orderRepository.findById.mockResolvedValue(mockOrder);
      Order.findById.mockResolvedValue(mockOrder);

      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        reserved: 5,
      });
      inventoryRepository.releaseReservedStock.mockResolvedValue(true);

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("800.00"),
        refundedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        refundReservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
      };

      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      paymentService.refundPaymentForOrder.mockImplementation(async () => {
        mockPayment.status = "refunded";
        mockPayment.refundedAmount = mongoose.Types.Decimal128.fromString("800.00");
        return mockPayment;
      });

      const recovery = await orderRecoveryService.recoverIncompleteCancellation(orderId, {
        userId: "admin_ops",
        role: "admin",
      });

      expect(recovery.inventoryReleasesCompleted).toBe(1);
      expect(recovery.refundReconciled).toBe(true);
      expect(mockOrder.paymentStatus).toBe("refunded");
      expect(incompleteItem.inventoryStatus).toBe("released");

      // Verify AuditLog records the recovery action
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_OPERATIONAL_RECOVERY",
          actorId: "admin_ops",
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 6. STALE COURIER WEBHOOKS & IMMUTABLE TERMINAL STATES
  // --------------------------------------------------------------------------
  describe("6. Stale Courier Webhooks & Terminal Shipment Immutability", () => {
    test("stale out-of-order in_transit webhook cannot revert delivered terminal shipment", async () => {
      const shipmentId = new mongoose.Types.ObjectId();
      const deliveredDate = new Date("2026-10-18T10:00:00Z");

      const mockShipment = {
        _id: shipmentId,
        shipmentNumber: "SHP-5E-001",
        trackingNumber: "TRK-5E-999",
        status: "delivered", // Terminal state
        deliveredAt: deliveredDate,
        customerId: { email: "customer@buybox.test" },
        timeline: [
          { status: "in_transit", timestamp: new Date("2026-10-17T08:00:00Z") },
          { status: "delivered", timestamp: deliveredDate },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Shipment.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockShipment),
      });

      ShipmentWebhookEvent.findOne = jest.fn().mockResolvedValue(null);
      ShipmentWebhookEvent.create = jest.fn().mockResolvedValue(true);

      CredentialService.getDecryptedCredentials = jest.fn().mockResolvedValue({});

      jest.spyOn(courierService, "getAdapter").mockReturnValue({
        verifyWebhookSignature: () => true,
      });

      const staleWebhookResult = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          tracking_number: "TRK-5E-999",
          status: "in_transit",
        },
      });

      expect(staleWebhookResult.success).toBe(true);
      expect(staleWebhookResult.stale).toBe(true);
      expect(mockShipment.status).toBe("delivered");
    });
  });

  // --------------------------------------------------------------------------
  // 7. AUTHORIZATION & CROSS-TENANT SECURITY BOUNDARIES
  // --------------------------------------------------------------------------
  describe("7. Cross-Role Authorization & Security Boundaries", () => {
    test("customer cannot cancel or access another customer's order", async () => {
      const foreignOrderId = new mongoose.Types.ObjectId();

      const foreignOrder = {
        _id: foreignOrderId,
        orderNumber: "ORD-FOREIGN-01",
        customerId: customer2Id,
        status: "processing",
        items: [],
      };

      orderRepository.findById.mockResolvedValue(foreignOrder);
      Customer.findOne.mockResolvedValue({ _id: customer1Id }); // Authenticated as customer 1

      // Customer 1 attempting to cancel Customer 2's order
      await expect(
        orderService.cancelOrder(foreignOrderId, {
          userId: customer1UserId,
          cancellationReason: "Fraudulent cancel attempt",
        })
      ).rejects.toThrow("You are not allowed to access this order");
    });
  });
});
