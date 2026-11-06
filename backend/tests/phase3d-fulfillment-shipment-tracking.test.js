const crypto = require("crypto");
const mongoose = require("mongoose");

jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/services/order.service");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/credential.service");
jest.mock("../src/services/email.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ShipmentWebhookEvent");

const shipmentRepository = require("../src/repositories/shipment.repository");
const orderRepository = require("../src/repositories/order.repository");
const inventoryRepository = require("../src/repositories/inventory.repository");
const orderService = require("../src/services/order.service");
const inventoryService = require("../src/services/inventory.service");
const CredentialService = require("../src/services/credential.service");
const EmailService = require("../src/services/email.service");
const Customer = require("../src/models/Customer");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const Shipment = require("../src/models/Shipment");
const ShipmentWebhookEvent = require("../src/models/ShipmentWebhookEvent");

const shipmentService = require("../src/services/shipment.service");
const courierService = require("../src/services/courier.service");
const { SHIPMENT_STATUSES } = require("../src/constants/shipping.constants");

describe("Phase 3D — Fulfillment, Shipping & Shipment Tracking", () => {
  const orderId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const customerUserId = new mongoose.Types.ObjectId().toString();
  const vendorAId = new mongoose.Types.ObjectId().toString();
  const vendorAUserId = new mongoose.Types.ObjectId().toString();
  const vendorBId = new mongoose.Types.ObjectId().toString();
  const vendorBUserId = new mongoose.Types.ObjectId().toString();
  const warehouseId = new mongoose.Types.ObjectId().toString();
  const shipmentId = new mongoose.Types.ObjectId().toString();
  const variantAId = new mongoose.Types.ObjectId().toString();
  const variantBId = new mongoose.Types.ObjectId().toString();

  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    // Mock Customer
    Customer.findOne.mockImplementation(({ userId }) => {
      if (userId && userId.toString() === customerUserId.toString()) {
        return Promise.resolve({
          _id: customerId,
          userId: customerUserId,
          isActive: true,
          deletedAt: null,
        });
      }
      return Promise.resolve(null);
    });

    shipmentRepository.findByIdempotencyKey.mockReset();
    shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
    shipmentRepository.create.mockReset();

    // Mock Vendor
    Vendor.findOne.mockImplementation((query) => {
      let doc = null;
      if (query?.userId && query.userId.toString() === vendorAUserId.toString()) {
        doc = {
          _id: vendorAId,
          userId: vendorAUserId,
          isActive: true,
          deletedAt: null,
        };
      } else if (query?.userId && query.userId.toString() === vendorBUserId.toString()) {
        doc = {
          _id: vendorBId,
          userId: vendorBUserId,
          isActive: true,
          deletedAt: null,
        };
      } else if (query?._id && query._id.toString() === vendorAId.toString()) {
        doc = {
          _id: vendorAId,
          status: "active",
          deletedAt: null,
        };
      } else if (query?._id && query._id.toString() === vendorBId.toString()) {
        doc = {
          _id: vendorBId,
          status: "active",
          deletedAt: null,
        };
      }

      return {
        session: jest.fn().mockResolvedValue(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
    });

    Vendor.findById.mockImplementation((id) => {
      if (id && id.toString() === vendorAId.toString()) {
        return {
          session: jest.fn().mockResolvedValue({
            _id: vendorAId,
            status: "active",
            deletedAt: null,
          }),
        };
      }
      if (id && id.toString() === vendorBId.toString()) {
        return {
          session: jest.fn().mockResolvedValue({
            _id: vendorBId,
            status: "active",
            deletedAt: null,
          }),
        };
      }
      return { session: jest.fn().mockResolvedValue(null) };
    });

    // Mock Warehouse
    Warehouse.findOne.mockImplementation((query) => {
      let doc = null;
      if (query?._id && query._id.toString() === warehouseId.toString()) {
        doc = {
          _id: warehouseId,
          isActive: true,
          deletedAt: null,
        };
      }
      return {
        session: jest.fn().mockResolvedValue(doc),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
    });

    Warehouse.findById.mockImplementation((id) => {
      if (id && id.toString() === warehouseId.toString()) {
        return {
          session: jest.fn().mockResolvedValue({
            _id: warehouseId,
            isActive: true,
            deletedAt: null,
          }),
        };
      }
      return { session: jest.fn().mockResolvedValue(null) };
    });

    orderService.transitionOrderStatus.mockImplementation((id, status) =>
      Promise.resolve({ _id: id, status })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. FULFILLMENT ELIGIBILITY & SHIPMENT CREATION
  // =========================================================================
  describe("1. Fulfillment Eligibility & Shipment Creation", () => {
    it("creates a shipment successfully for a confirmed and paid order", async () => {
      const baseOrder = {
        _id: orderId,
        orderNumber: "ORD-1001",
        customerId,
        status: "confirmed",
        paymentStatus: "paid",
        shippingAddress: { fullName: "Alice", email: "alice@example.com" },
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productVariantId: variantAId,
            sku: "SKU-A",
            productName: "Item A",
            quantity: 2,
            vendorId: vendorAId,
            warehouseId,
            isVirtual: false,
            isDownloadable: false,
            inventoryStatus: "reserved",
            fulfillmentStatus: "unfulfilled",
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(baseOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([]);
      shipmentRepository.create.mockResolvedValue({
        _id: shipmentId,
        shipmentNumber: "SHP-1001",
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "created",
        items: [{ productVariantId: variantAId, quantity: 2 }],
      });

      const shipment = await shipmentService.createShipment({
        orderId,
        idempotencyKey: "idem-key-1001",
        userId: vendorAUserId,
      });

      expect(shipment).toBeDefined();
      expect(shipment.status).toBe("created");
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it("rejects shipment creation if order is unpaid with 409 ORDER_PAYMENT_NOT_COMPLETED", async () => {
      const unpaidOrder = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "pending",
        items: [{ vendorId: vendorAId, warehouseId, isVirtual: false, quantity: 1 }],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(unpaidOrder);

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-unpaid",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_PAYMENT_NOT_COMPLETED",
      });
    });

    it("rejects shipment creation if order is in pending_payment status with 409 ORDER_NOT_READY_FOR_SHIPMENT", async () => {
      const pendingOrder = {
        _id: orderId,
        status: "pending_payment",
        paymentStatus: "paid",
        items: [{ vendorId: vendorAId, warehouseId, isVirtual: false, quantity: 1 }],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(pendingOrder);

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-not-ready",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_NOT_READY_FOR_SHIPMENT",
      });
    });

    it("returns existing shipment idempotently on repeated creation with same idempotency key", async () => {
      const existing = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        idempotencyKey: "idem-key-repeat",
        status: "created",
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await shipmentService.createShipment({
        orderId,
        idempotencyKey: "idem-key-repeat",
        userId: vendorAUserId,
      });

      expect(result._id).toBe(shipmentId);
      expect(orderRepository.findById).not.toHaveBeenCalled();
    });

    it("handles concurrent race (E11000 duplicate key error) returning existing shipment", async () => {
      const baseOrder = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId,
            quantity: 1,
            isVirtual: false,
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null) // fast lookup misses
        .mockResolvedValueOnce({
          _id: shipmentId,
          orderId,
          vendorId: vendorAId,
          status: "created",
        }); // lookup after E11000

      orderRepository.findById.mockResolvedValue(baseOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([]);
      const mongoError = new Error("E11000 duplicate key error");
      mongoError.code = 11000;
      shipmentRepository.create.mockRejectedValue(mongoError);

      const result = await shipmentService.createShipment({
        orderId,
        idempotencyKey: "idem-key-race",
        userId: vendorAUserId,
      });

      expect(result._id).toBe(shipmentId);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it("rejects cross-order idempotency key conflict with 409 IDEMPOTENCY_KEY_CONFLICT", async () => {
      const differentOrderId = new mongoose.Types.ObjectId().toString();
      shipmentRepository.findByIdempotencyKey.mockResolvedValue({
        _id: shipmentId,
        orderId: differentOrderId,
        vendorId: vendorAId,
      });

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-conflict",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });
    });

    it("rejects purely digital orders from physical shipment with 400 DIGITAL_ORDER_NO_PHYSICAL_SHIPMENT", async () => {
      const digitalOrder = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId: null,
            quantity: 1,
            isVirtual: true,
            isDownloadable: true,
            inventoryStatus: "not_required",
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(digitalOrder);

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-digital",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "DIGITAL_ORDER_NO_PHYSICAL_SHIPMENT",
      });
    });

    it("prevents over-fulfillment when all order items are already assigned to active shipments", async () => {
      const activeShipmentId = new mongoose.Types.ObjectId().toString();
      const order = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId,
            quantity: 1,
            isVirtual: false,
            fulfillmentStatus: "unfulfilled",
            shipmentId: activeShipmentId,
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(order);
      // Active shipment already exists with different warehouse/ID
      shipmentRepository.findByOrderId.mockResolvedValue([
        {
          _id: activeShipmentId,
          vendorId: vendorAId,
          warehouseId: new mongoose.Types.ObjectId().toString(),
          status: "created",
        },
      ]);

      await expect(
        shipmentService.createShipment({
          orderId,
          warehouseId,
          idempotencyKey: "idem-key-overfulfill",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SHIPMENT_ITEMS_NOT_FOUND",
      });
    });

    it("fails safely if warehouse is inactive or not found", async () => {
      const order = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId,
            quantity: 1,
            isVirtual: false,
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(order);
      Warehouse.findOne.mockImplementation(() => ({
        session: jest.fn().mockResolvedValue(null),
        then: (resolve) => Promise.resolve(null).then(resolve),
      }));

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-bad-wh",
          userId: vendorAUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "WAREHOUSE_NOT_FOUND",
      });
    });
  });

  // =========================================================================
  // 2. MULTI-VENDOR SHIPMENT ISOLATION & SPLITTING
  // =========================================================================
  describe("2. Multi-Vendor Shipment Isolation & Splitting", () => {
    it("creates vendor A shipment containing only vendor A items in multi-vendor order", async () => {
      const multiVendorOrder = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId,
            quantity: 2,
            isVirtual: false,
            fulfillmentStatus: "unfulfilled",
          },
          {
            productVariantId: variantBId,
            vendorId: vendorBId,
            warehouseId,
            quantity: 1,
            isVirtual: false,
            fulfillmentStatus: "unfulfilled",
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(multiVendorOrder);
      shipmentRepository.findByOrderId.mockResolvedValue([]);

      let createdShipmentData = null;
      shipmentRepository.create.mockImplementation((data) => {
        createdShipmentData = data;
        return Promise.resolve({ _id: shipmentId, ...data });
      });

      const shipment = await shipmentService.createShipment({
        orderId,
        idempotencyKey: "idem-key-split-a",
        userId: vendorAUserId,
      });

      expect(shipment).toBeDefined();
      expect(createdShipmentData.vendorId.toString()).toBe(vendorAId.toString());
      expect(createdShipmentData.items).toHaveLength(1);
      expect(createdShipmentData.items[0].productVariantId.toString()).toBe(variantAId.toString());
    });

    it("vendor B cannot access or create shipment for an order where they have no items", async () => {
      const vendorAOnlyOrder = {
        _id: orderId,
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productVariantId: variantAId,
            vendorId: vendorAId,
            warehouseId,
            quantity: 2,
            isVirtual: false,
          },
        ],
      };

      shipmentRepository.findByIdempotencyKey.mockResolvedValue(null);
      orderRepository.findById.mockResolvedValue(vendorAOnlyOrder);

      await expect(
        shipmentService.createShipment({
          orderId,
          idempotencyKey: "idem-key-unauthorized-vendor",
          userId: vendorBUserId,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "SHIPMENT_NOT_FOUND",
      });
    });
  });

  // =========================================================================
  // 3. SHIPMENT STATE MACHINE TRANSITIONS
  // =========================================================================
  describe("3. Shipment State Machine Transitions", () => {
    it("follows valid forward transitions: created -> ready_to_ship -> picked_up -> in_transit -> out_for_delivery -> delivered", async () => {
      const order = {
        _id: orderId,
        status: "confirmed",
        items: [{ productVariantId: variantAId, warehouseId, quantity: 1, isVirtual: false }],
      };
      orderRepository.findById.mockResolvedValue(order);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "created",
        inventoryStatus: "reserved",
        items: [{ productVariantId: variantAId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment);
      shipmentRepository.updateById.mockImplementation((id, update) =>
        Promise.resolve({ ...shipment, ...update })
      );

      // 1. created -> ready_to_ship
      const step1 = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "ready_to_ship",
      });
      expect(step1.status).toBe("ready_to_ship");

      // 2. ready_to_ship -> picked_up
      order.status = "processing"; // order transitioned confirmed -> processing on ready_to_ship
      shipment.status = "ready_to_ship";
      inventoryRepository.findByVariant.mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(), warehouseId },
      ]);
      inventoryService.deductReservedStockInTransaction.mockResolvedValue({});

      const step2 = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "picked_up",
      });
      expect(step2.status).toBe("picked_up");

      // 3. picked_up -> in_transit
      order.status = "shipped"; // order transitioned processing -> shipped on picked_up
      shipment.status = "picked_up";
      shipment.inventoryStatus = "deducted";
      const step3 = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "in_transit",
      });
      expect(step3.status).toBe("in_transit");

      // 4. in_transit -> out_for_delivery
      shipment.status = "in_transit";
      const step4 = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "out_for_delivery",
      });
      expect(step4.status).toBe("out_for_delivery");

      // 5. out_for_delivery -> delivered
      shipment.status = "out_for_delivery";
      shipmentRepository.findByOrderId.mockResolvedValue([
        { ...shipment, status: "delivered", items: [{ quantity: 1 }] },
      ]);
      orderRepository.updateById.mockResolvedValue({ ...order, status: "delivered" });

      const step5 = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "delivered",
      });
      expect(step5.status).toBe("delivered");
    });

    it("rejects illegal state jump from created directly to delivered with 409 INVALID_SHIPMENT_STATUS_TRANSITION", async () => {
      const order = { _id: orderId, status: "confirmed", items: [] };
      orderRepository.findById.mockResolvedValue(order);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        status: "created",
      };
      shipmentRepository.findById.mockResolvedValue(shipment);

      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId,
          nextStatus: "delivered",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INVALID_SHIPMENT_STATUS_TRANSITION",
      });
    });

    it("rejects mutating terminal shipment (cancelled or returned) with 409 TERMINAL_SHIPMENT_CANNOT_BE_MODIFIED", async () => {
      const order = { _id: orderId, status: "confirmed", items: [] };
      orderRepository.findById.mockResolvedValue(order);

      const cancelledShipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        status: "cancelled",
      };
      shipmentRepository.findById.mockResolvedValue(cancelledShipment);

      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId,
          nextStatus: "in_transit",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TERMINAL_SHIPMENT_CANNOT_BE_MODIFIED",
      });
    });

    it("handles idempotent same-status request cleanly without re-executing state actions", async () => {
      const order = { _id: orderId, status: "shipped", items: [] };
      orderRepository.findById.mockResolvedValue(order);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        status: "in_transit",
        trackingNumber: "TRK-100",
      };
      shipmentRepository.findById.mockResolvedValue(shipment);
      shipmentRepository.updateById.mockResolvedValue(shipment);

      const result = await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "in_transit",
        trackingNumber: "TRK-100",
      });

      expect(result.status).toBe("in_transit");
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. MULTI-SHIPMENT & MIXED ORDER DELIVERY AGGREGATION
  // =========================================================================
  describe("4. Multi-Shipment & Mixed Order Delivery Aggregation", () => {
    it("delivering 1 of 2 shipments marks order partially_fulfilled and preserves non-delivered order status", async () => {
      const shipment1Id = new mongoose.Types.ObjectId().toString();
      const shipment2Id = new mongoose.Types.ObjectId().toString();

      const order = {
        _id: orderId,
        status: "shipped",
        fulfillmentStatus: "partially_fulfilled",
        items: [
          { productVariantId: variantAId, warehouseId, quantity: 1, isVirtual: false },
          { productVariantId: variantBId, warehouseId, quantity: 1, isVirtual: false },
        ],
      };
      orderRepository.findById.mockResolvedValue(order);

      const shipment1 = {
        _id: shipment1Id,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "out_for_delivery",
        items: [{ productVariantId: variantAId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment1);
      shipmentRepository.updateById.mockResolvedValue({ ...shipment1, status: "delivered" });

      // All shipments for this order: shipment1 is delivered, shipment2 is still in_transit
      shipmentRepository.findByOrderId.mockResolvedValue([
        { _id: shipment1Id, status: "delivered", items: [{ quantity: 1 }] },
        { _id: shipment2Id, status: "in_transit", items: [{ quantity: 1 }] },
      ]);

      orderRepository.updateById.mockImplementation((id, payload) => {
        return Promise.resolve({ ...order, ...payload });
      });

      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment1Id,
        nextStatus: "delivered",
      });

      // Verify order was updated with partially_fulfilled
      const calls = orderRepository.updateById.mock.calls;
      const partialCall = calls.find((call) => call[1] && call[1].fulfillmentStatus === "partially_fulfilled");
      expect(partialCall).toBeDefined();
      expect(partialCall[1].fulfillmentStatus).toBe("partially_fulfilled");
      expect(orderService.transitionOrderStatus).not.toHaveBeenCalledWith(orderId, "delivered", expect.anything());
    });

    it("delivering all shipments in multi-vendor order updates fulfillmentStatus to fulfilled and transitions order to delivered", async () => {
      const shipment1Id = new mongoose.Types.ObjectId().toString();
      const shipment2Id = new mongoose.Types.ObjectId().toString();

      const order = {
        _id: orderId,
        status: "shipped",
        fulfillmentStatus: "partially_fulfilled",
        items: [
          { productVariantId: variantAId, warehouseId, quantity: 1, isVirtual: false },
          { productVariantId: variantBId, warehouseId, quantity: 1, isVirtual: false },
        ],
      };
      orderRepository.findById.mockResolvedValue(order);

      const shipment2 = {
        _id: shipment2Id,
        orderId,
        vendorId: vendorBId,
        warehouseId,
        status: "out_for_delivery",
        items: [{ productVariantId: variantBId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment2);
      shipmentRepository.updateById.mockResolvedValue({ ...shipment2, status: "delivered" });

      // Both shipments are now delivered
      shipmentRepository.findByOrderId.mockResolvedValue([
        { _id: shipment1Id, status: "delivered", items: [{ quantity: 1 }] },
        { _id: shipment2Id, status: "delivered", items: [{ quantity: 1 }] },
      ]);

      orderService.transitionOrderStatus.mockResolvedValue({ ...order, status: "delivered" });
      orderRepository.updateById.mockResolvedValue({
        ...order,
        status: "delivered",
        fulfillmentStatus: "fulfilled",
      });

      await shipmentService.transitionShipmentStatus({
        shipmentId: shipment2Id,
        nextStatus: "delivered",
      });

      expect(orderService.transitionOrderStatus).toHaveBeenCalledWith(
        orderId,
        "delivered",
        expect.anything()
      );
    });

    it("mixed order (1 physical + 1 digital item) completes delivery when the physical shipment is delivered", async () => {
      const mixedOrder = {
        _id: orderId,
        status: "shipped",
        fulfillmentStatus: "unfulfilled",
        items: [
          { productVariantId: variantAId, warehouseId, quantity: 1, isVirtual: false, inventoryStatus: "reserved" },
          { productVariantId: variantBId, warehouseId: null, quantity: 1, isVirtual: true, isDownloadable: true, inventoryStatus: "not_required" },
        ],
      };
      orderRepository.findById.mockResolvedValue(mixedOrder);

      const physicalShipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "out_for_delivery",
        items: [{ productVariantId: variantAId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(physicalShipment);
      shipmentRepository.updateById.mockResolvedValue({ ...physicalShipment, status: "delivered" });

      // Only physical shipment exists for this order
      shipmentRepository.findByOrderId.mockResolvedValue([
        { _id: shipmentId, status: "delivered", items: [{ quantity: 1 }] },
      ]);

      orderService.transitionOrderStatus.mockResolvedValue({ ...mixedOrder, status: "delivered" });
      orderRepository.updateById.mockResolvedValue({
        ...mixedOrder,
        status: "delivered",
        fulfillmentStatus: "fulfilled",
      });

      await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "delivered",
      });

      expect(orderService.transitionOrderStatus).toHaveBeenCalledWith(
        orderId,
        "delivered",
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 5. COURIER WEBHOOK & TRACKING INTEGRATION
  // =========================================================================
  describe("5. Courier Webhook & Tracking Integration", () => {
    it("rejects courier webhook with invalid signature with 401 INVALID_WEBHOOK_SIGNATURE", async () => {
      CredentialService.getDecryptedCredentials.mockResolvedValue({ clientSecret: "valid-secret" });

      await expect(
        courierService.handleWebhook({
          provider: "delhivery",
          headers: { "x-delhivery-signature": "wrong-signature" },
          body: { waybill: "WAYBILL-123", status: "In Transit" },
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_WEBHOOK_SIGNATURE",
      });
    });

    it("rejects webhook missing tracking number with 400 MISSING_TRACKING_NUMBER", async () => {
      CredentialService.getDecryptedCredentials.mockResolvedValue({});
      const adapter = courierService.getAdapter("delhivery");
      jest.spyOn(adapter, "verifyWebhookSignature").mockReturnValue(true);

      await expect(
        courierService.handleWebhook({
          provider: "delhivery",
          headers: {},
          body: { event_id: "evt-123", status: "In Transit" }, // no waybill/awb/tracking_number
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "MISSING_TRACKING_NUMBER",
      });
    });

    it("returns { duplicate: true } for repeated webhook event", async () => {
      const adapter = courierService.getAdapter("delhivery");
      jest.spyOn(adapter, "verifyWebhookSignature").mockReturnValue(true);
      CredentialService.getDecryptedCredentials.mockResolvedValue({});

      ShipmentWebhookEvent.findOne.mockResolvedValue({
        provider: "delhivery",
        eventId: "evt-dup-100",
      });

      const response = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          event_id: "evt-dup-100",
          waybill: "WAYBILL-100",
          status: "In Transit",
        },
      });

      expect(response).toEqual({
        success: true,
        duplicate: true,
        message: "Webhook event already processed",
        eventId: "evt-dup-100",
      });
    });

    it("handles concurrent duplicate webhook race (E11000) returning { duplicate: true }", async () => {
      const adapter = courierService.getAdapter("delhivery");
      jest.spyOn(adapter, "verifyWebhookSignature").mockReturnValue(true);
      CredentialService.getDecryptedCredentials.mockResolvedValue({});

      ShipmentWebhookEvent.findOne.mockResolvedValue(null);
      Shipment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: shipmentId,
          shipmentNumber: "SHP-100",
          trackingNumber: "WAYBILL-RACE",
          status: "in_transit",
        }),
      });

      const duplicateError = new Error("E11000 duplicate key error");
      duplicateError.code = 11000;
      ShipmentWebhookEvent.create.mockRejectedValue(duplicateError);

      const response = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          event_id: "evt-race-1",
          waybill: "WAYBILL-RACE",
          status: "in_transit",
        },
      });

      expect(response).toEqual({
        success: true,
        duplicate: true,
        message: "Webhook event already processed",
        eventId: "evt-race-1",
      });
    });

    it("records unknown/unmapped courier status safely without mutating shipment status", async () => {
      const adapter = courierService.getAdapter("delhivery");
      jest.spyOn(adapter, "verifyWebhookSignature").mockReturnValue(true);
      CredentialService.getDecryptedCredentials.mockResolvedValue({});

      ShipmentWebhookEvent.findOne.mockResolvedValue(null);
      Shipment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: shipmentId,
          shipmentNumber: "SHP-100",
          trackingNumber: "WAYBILL-UNKNOWN",
          status: "in_transit",
        }),
      });

      ShipmentWebhookEvent.create.mockResolvedValue({});

      const response = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          event_id: "evt-unmapped-99",
          waybill: "WAYBILL-UNKNOWN",
          status: "Custom_Sorting_Hub_Scan", // unknown status
        },
      });

      expect(response).toMatchObject({
        success: true,
        unmapped: true,
        status: "in_transit", // shipment status was NOT corrupted
      });
      expect(ShipmentWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_transit",
          eventType: "custom_sorting_hub_scan",
        })
      );
    });

    it("acknowledges stale out-of-order webhook event on terminal shipment safely", async () => {
      const adapter = courierService.getAdapter("delhivery");
      jest.spyOn(adapter, "verifyWebhookSignature").mockReturnValue(true);
      CredentialService.getDecryptedCredentials.mockResolvedValue({});

      ShipmentWebhookEvent.findOne.mockResolvedValue(null);
      Shipment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: shipmentId,
          shipmentNumber: "SHP-100",
          trackingNumber: "WAYBILL-DELIVERED",
          status: "delivered", // already terminal
        }),
      });

      ShipmentWebhookEvent.create.mockResolvedValue({});

      const response = await courierService.handleWebhook({
        provider: "delhivery",
        headers: {},
        body: {
          event_id: "evt-stale-1",
          waybill: "WAYBILL-DELIVERED",
          status: "in_transit", // out of order arrival after delivery
        },
      });

      expect(response).toMatchObject({
        success: true,
        stale: true,
        status: "delivered",
      });
    });
  });

  // =========================================================================
  // 6. INVENTORY DEDUCTION & CANCELLATION CONSISTENCY
  // =========================================================================
  describe("6. Inventory Deduction & Cancellation Consistency", () => {
    it("deducts reserved inventory only upon transition to picked_up", async () => {
      const order = {
        _id: orderId,
        status: "processing",
        items: [{ productVariantId: variantAId, warehouseId, quantity: 2, isVirtual: false }],
      };
      orderRepository.findById.mockResolvedValue(order);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "ready_to_ship",
        inventoryStatus: "reserved",
        items: [{ productVariantId: variantAId, quantity: 2 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment);
      shipmentRepository.updateById.mockResolvedValue({
        ...shipment,
        status: "picked_up",
        inventoryStatus: "deducted",
      });

      const invRecordId = new mongoose.Types.ObjectId();
      inventoryRepository.findByVariant.mockResolvedValue([
        { _id: invRecordId, warehouseId },
      ]);
      inventoryService.deductReservedStockInTransaction.mockResolvedValue({});

      await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "picked_up",
      });

      expect(inventoryService.deductReservedStockInTransaction).toHaveBeenCalledWith(
        invRecordId,
        2,
        expect.objectContaining({
          referenceType: "shipment",
          referenceId: shipmentId.toString(),
          idempotencyKey: `shipment-picked-up-${shipmentId.toString()}-${variantAId.toString()}`,
        }),
        mockSession
      );
    });

    it("blocks shipment pickup if order is already cancelled with 409 ORDER_ALREADY_CANCELLED", async () => {
      const cancelledOrder = {
        _id: orderId,
        status: "cancelled",
        items: [],
      };
      orderRepository.findById.mockResolvedValue(cancelledOrder);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "ready_to_ship",
        inventoryStatus: "reserved",
        items: [{ productVariantId: variantAId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment);

      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId,
          nextStatus: "picked_up",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "ORDER_ALREADY_CANCELLED",
      });
    });

    it("releases reserved inventory on pre-pickup shipment cancellation using canonical release idempotency key", async () => {
      const order = {
        _id: orderId,
        status: "processing",
        items: [{ productVariantId: variantAId, warehouseId, quantity: 1 }],
      };
      orderRepository.findById.mockResolvedValue(order);

      const shipment = {
        _id: shipmentId,
        orderId,
        vendorId: vendorAId,
        warehouseId,
        status: "ready_to_ship",
        inventoryStatus: "reserved",
        items: [{ productVariantId: variantAId, quantity: 1 }],
      };
      shipmentRepository.findById.mockResolvedValue(shipment);
      shipmentRepository.claimReservationRelease.mockResolvedValue(shipment);
      shipmentRepository.updateById.mockResolvedValue({ ...shipment, status: "cancelled" });
      shipmentRepository.findByOrderId.mockResolvedValue([shipment]);
      orderRepository.updateById.mockResolvedValue(order);

      const invRecordId = new mongoose.Types.ObjectId();
      inventoryRepository.findByVariant.mockResolvedValue([
        { _id: invRecordId, warehouseId },
      ]);
      inventoryService.releaseStockInTransaction.mockResolvedValue({});

      await shipmentService.transitionShipmentStatus({
        shipmentId,
        nextStatus: "cancelled",
      });

      expect(inventoryService.releaseStockInTransaction).toHaveBeenCalledWith(
        invRecordId,
        1,
        expect.objectContaining({
          referenceType: "shipment",
          idempotencyKey: `order-reservation-release-${orderId.toString()}-${variantAId.toString()}-${warehouseId.toString()}`,
        }),
        mockSession
      );
    });
  });

  // =========================================================================
  // 7. AUTHORIZATION & DATA ISOLATION
  // =========================================================================
  describe("7. Authorization & Data Isolation", () => {
    it("customer cannot access another customer's shipment (returns 404 SHIPMENT_NOT_FOUND)", async () => {
      const otherCustomerId = new mongoose.Types.ObjectId().toString();
      shipmentRepository.findById.mockResolvedValue({
        _id: shipmentId,
        customerId: otherCustomerId,
      });

      await expect(
        shipmentService.getCustomerShipmentById(shipmentId, customerUserId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "SHIPMENT_NOT_FOUND",
      });
    });

    it("vendor cannot access another vendor's shipment (returns 404 SHIPMENT_NOT_FOUND)", async () => {
      shipmentRepository.findById.mockResolvedValue({
        _id: shipmentId,
        vendorId: vendorBId, // belongs to Vendor B
      });

      await expect(
        shipmentService.getVendorShipmentById(shipmentId, vendorAUserId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "SHIPMENT_NOT_FOUND",
      });
    });

    it("vendor cannot transition another vendor's shipment (returns 404 SHIPMENT_NOT_FOUND)", async () => {
      shipmentRepository.findById.mockResolvedValue({
        _id: shipmentId,
        vendorId: vendorBId, // belongs to Vendor B
        status: "created",
      });

      await expect(
        shipmentService.transitionShipmentStatus({
          shipmentId,
          nextStatus: "ready_to_ship",
          userId: vendorAUserId, // Vendor A attempting transition
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "SHIPMENT_NOT_FOUND",
      });
    });

    it("public tracking endpoint sanitizes internal vendor and warehouse details", async () => {
      shipmentRepository.findByTrackingNumber.mockResolvedValue({
        _id: shipmentId,
        shipmentNumber: "SHP-PUBLIC-101",
        trackingNumber: "TRK-PUBLIC-101",
        status: "in_transit",
        carrier: "delhivery",
        vendorId: vendorAId,
        warehouseId,
        idempotencyKey: "secret-internal-idem-key",
        items: [{ name: "Widget", quantity: 1 }],
      });

      // No user or non-privileged user (null requestingUser)
      const trackingResult = await shipmentService.getShipmentByTrackingNumber(
        "TRK-PUBLIC-101",
        null
      );

      expect(trackingResult.shipmentNumber).toBe("SHP-PUBLIC-101");
      expect(trackingResult.trackingNumber).toBe("TRK-PUBLIC-101");
      expect(trackingResult.status).toBe("in_transit");
      // Internal fields stripped out
      expect(trackingResult.vendorId).toBeUndefined();
      expect(trackingResult.warehouseId).toBeUndefined();
      expect(trackingResult.idempotencyKey).toBeUndefined();
    });
  });
});
