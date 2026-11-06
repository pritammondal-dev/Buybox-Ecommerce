const mongoose = require("mongoose");

jest.mock("../src/models/Order");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/User");
jest.mock("../src/models/FulfillmentException");
jest.mock("../src/models/NotificationOutbox");
jest.mock("../src/models/AuditLog");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/middlewares/vendor.middleware");

const Order = require("../src/models/Order");
const Vendor = require("../src/models/Vendor");
const User = require("../src/models/User");
const FulfillmentException = require("../src/models/FulfillmentException");
const NotificationOutbox = require("../src/models/NotificationOutbox");
const AuditLog = require("../src/models/AuditLog");
const inventoryRepository = require("../src/repositories/inventory.repository");
const paymentRepository = require("../src/repositories/payment.repository");
const inventoryService = require("../src/services/inventory.service");
const paymentService = require("../src/services/payment.service");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const { resolveApprovedVendor } = require("../src/middlewares/vendor.middleware");

const exceptionService = require("../src/services/fulfillment-exception.service");

describe("Phase 5C — Vendor Fulfillment Exceptions Test Suite", () => {
  const vendor1UserId = new mongoose.Types.ObjectId().toString();
  const vendor2UserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();

  const vendor1Id = new mongoose.Types.ObjectId();
  const vendor2Id = new mongoose.Types.ObjectId();
  const warehouse1Id = new mongoose.Types.ObjectId();

  const mockVendor1 = {
    _id: vendor1Id,
    userId: vendor1UserId,
    storeName: "Vendor One Store",
    businessName: "Vendor One Corp",
    email: "vendor1@buybox.test",
    onboardingStatus: "approved",
    isActive: true,
  };

  const mockVendor2 = {
    _id: vendor2Id,
    userId: vendor2UserId,
    storeName: "Vendor Two Store",
    businessName: "Vendor Two Corp",
    email: "vendor2@buybox.test",
    onboardingStatus: "approved",
    isActive: true,
  };

  const orderId = new mongoose.Types.ObjectId();
  const item1Id = new mongoose.Types.ObjectId();
  const item2Id = new mongoose.Types.ObjectId(); // vendor2 item

  let mockOrder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrder = {
      _id: orderId,
      orderNumber: "ORD-2026-9001",
      status: "confirmed",
      paymentStatus: "paid",
      customerId: new mongoose.Types.ObjectId(),
      items: [
        {
          _id: item1Id,
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          warehouseId: warehouse1Id,
          vendorId: vendor1Id,
          sku: "V1-POLO-NAVY-M",
          productName: "Classic Pique Polo",
          variantName: "Navy / M",
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("800.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1600.00"),
          fulfillmentStatus: "processing",
          inventoryStatus: "reserved",
        },
        {
          _id: item2Id,
          productId: new mongoose.Types.ObjectId(),
          productVariantId: new mongoose.Types.ObjectId(),
          warehouseId: warehouse1Id,
          vendorId: vendor2Id,
          sku: "V2-CHINO-BEIGE-32",
          productName: "Slim Chino Pants",
          variantName: "Beige / 32",
          quantity: 1,
          unitPrice: mongoose.Types.Decimal128.fromString("1200.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("1200.00"),
          fulfillmentStatus: "processing",
          inventoryStatus: "reserved",
        },
      ],
      save: jest.fn().mockResolvedValue(true),
    };

    Order.findById.mockResolvedValue(mockOrder);

    resolveApprovedVendor.mockImplementation(async (uid) => {
      if (uid === vendor1UserId) return mockVendor1;
      if (uid === vendor2UserId) return mockVendor2;
      return null;
    });

    FulfillmentException.findOne.mockResolvedValue(null);
    AuditLog.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    NotificationOutbox.findOne.mockResolvedValue(null);
    notificationOutboxService.enqueue.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
  });

  // --------------------------------------------------------------------------
  // 1. Vendor Submission & Item Ownership
  // --------------------------------------------------------------------------
  describe("1. Vendor Exception Submission & Ownership Enforcement", () => {
    test("vendor can submit an exception for their own eligible order item", async () => {
      let savedExceptionDoc = null;
      FulfillmentException.mockImplementation((data) => {
        savedExceptionDoc = {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          save: jest.fn().mockImplementation(async function () {
            return this;
          }),
        };
        return savedExceptionDoc;
      });

      const result = await exceptionService.createException({
        userId: vendor1UserId,
        orderId: orderId.toString(),
        orderItemId: item1Id.toString(),
        reason: "out_of_stock",
        explanation: "Primary stock carton water damaged during monsoon transit",
        requestedResolution: "request_cancellation",
        quantity: 1,
      });

      expect(result).toBeDefined();
      expect(result.vendorId).toEqual(vendor1Id);
      expect(result.orderItemId).toEqual(item1Id);
      expect(result.status).toBe("open");
      expect(result.quantity).toBe(1);
      // Authoritative item snapshot populated from order item
      expect(result.itemSnapshot.sku).toBe("V1-POLO-NAVY-M");
      expect(result.itemSnapshot.productName).toBe("Classic Pique Polo");
      expect(result.timeline.length).toBe(1);
      expect(result.timeline[0].status).toBe("open");
      expect(result.timeline[0].actorType).toBe("vendor");
    });

    test("vendor cannot submit an exception for another vendor's order item (rejects with 403)", async () => {
      await expect(
        exceptionService.createException({
          userId: vendor1UserId, // vendor1 trying to claim item2 belonging to vendor2
          orderId: orderId.toString(),
          orderItemId: item2Id.toString(),
          reason: "damaged_stock",
          explanation: "Item damaged",
        })
      ).rejects.toThrow("You are not authorized to report exceptions for another vendor's order items");
    });

    test("duplicate active exceptions are rejected with 409", async () => {
      // Mock existing active exception for item1
      FulfillmentException.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "open",
        exceptionNumber: "EXC-20261019-1111",
      });

      await expect(
        exceptionService.createException({
          userId: vendor1UserId,
          orderId: orderId.toString(),
          orderItemId: item1Id.toString(),
          reason: "out_of_stock",
          explanation: "Duplicate attempt",
        })
      ).rejects.toThrow("An active fulfillment exception already exists for this order item");
    });

    test("shipped and cancelled quantities are rejected with 400", async () => {
      // 1. Shipped item
      mockOrder.items[0].fulfillmentStatus = "shipped";
      await expect(
        exceptionService.createException({
          userId: vendor1UserId,
          orderId: orderId.toString(),
          orderItemId: item1Id.toString(),
          reason: "cannot_pack_or_ship",
          explanation: "Already in truck",
        })
      ).rejects.toThrow("Cannot report a fulfillment exception for already shipped or delivered items");

      // 2. Cancelled item
      mockOrder.items[0].fulfillmentStatus = "cancelled";
      await expect(
        exceptionService.createException({
          userId: vendor1UserId,
          orderId: orderId.toString(),
          orderItemId: item1Id.toString(),
          reason: "out_of_stock",
          explanation: "Cancelled already",
        })
      ).rejects.toThrow("Cannot report a fulfillment exception for a cancelled order item");
    });

    test("exception creation causes no inventory, payment, or order mutation", async () => {
      FulfillmentException.mockImplementation((data) => ({
        ...data,
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true),
      }));

      await exceptionService.createException({
        userId: vendor1UserId,
        orderId: orderId.toString(),
        orderItemId: item1Id.toString(),
        reason: "warehouse_discrepancy",
        explanation: "Bin count mismatch",
        quantity: 2,
      });

      // Assert zero mutation on order record
      expect(mockOrder.save).not.toHaveBeenCalled();
      expect(mockOrder.status).toBe("confirmed");
      expect(mockOrder.items[0].fulfillmentStatus).toBe("processing");
      expect(mockOrder.items[0].inventoryStatus).toBe("reserved");
      expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
      expect(inventoryService.releaseStockInTransaction).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Controlled Lifecycle Transitions
  // --------------------------------------------------------------------------
  describe("2. Controlled Exception Lifecycle & Timeline Audit", () => {
    test("records actors and transitions across the exception timeline", async () => {
      const mockExceptionDoc = {
        _id: new mongoose.Types.ObjectId(),
        exceptionNumber: "EXC-20261019-9999",
        vendorId: vendor1Id,
        orderNumber: "ORD-2026-9001",
        status: "open",
        timeline: [
          {
            status: "open",
            actorType: "vendor",
            notes: "Initial report",
            timestamp: new Date(),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findById.mockResolvedValue(mockExceptionDoc);
      Vendor.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ email: "vendor1@buybox.test" }),
        }),
      });

      // Admin transitions to awaiting_vendor
      await exceptionService.adminTransitionException({
        exceptionId: mockExceptionDoc._id.toString(),
        newStatus: "awaiting_vendor",
        notes: "Can you fulfill from the Bangalore secondary warehouse instead?",
        actorUser: { id: adminUserId, name: "Admin Officer", email: "admin@buybox.test" },
      });

      expect(mockExceptionDoc.status).toBe("awaiting_vendor");
      expect(mockExceptionDoc.timeline.length).toBe(2);
      expect(mockExceptionDoc.timeline[1].status).toBe("awaiting_vendor");
      expect(mockExceptionDoc.timeline[1].actorType).toBe("admin");
      expect(mockExceptionDoc.timeline[1].actorName).toBe("Admin Officer");

      // Vendor responds with clarification
      FulfillmentException.findOne.mockResolvedValue(mockExceptionDoc);

      await exceptionService.vendorClarifyException({
        userId: vendor1UserId,
        exceptionId: mockExceptionDoc._id.toString(),
        notes: "Yes, Bangalore warehouse has 5 units in stock. Reallocation requested.",
      });

      expect(mockExceptionDoc.status).toBe("under_review");
      expect(mockExceptionDoc.timeline.length).toBe(3);
      expect(mockExceptionDoc.timeline[2].status).toBe("under_review");
      expect(mockExceptionDoc.timeline[2].actorType).toBe("vendor");
      expect(mockExceptionDoc.save).toHaveBeenCalled();
    });

    test("terminal exceptions (resolved, rejected, withdrawn) reject further transitions", async () => {
      const resolvedException = {
        _id: new mongoose.Types.ObjectId(),
        status: "resolved",
        save: jest.fn(),
      };
      FulfillmentException.findById.mockResolvedValue(resolvedException);

      await expect(
        exceptionService.adminTransitionException({
          exceptionId: resolvedException._id.toString(),
          newStatus: "under_review",
          notes: "Try to reopen",
          actorUser: { id: adminUserId },
        })
      ).rejects.toThrow("Cannot transition exception from terminal status 'resolved'");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Admin Resolution & Safe Cancellation
  // --------------------------------------------------------------------------
  describe("3. Authoritative Cancellation & Multi-Vendor Protection", () => {
    test("approved cancellation releases stock, marks item cancelled, and preserves unrelated vendor items", async () => {
      const mockExceptionDoc = {
        _id: new mongoose.Types.ObjectId(),
        exceptionNumber: "EXC-20261019-3333",
        orderId: orderId,
        orderItemId: item1Id,
        vendorId: vendor1Id,
        quantity: 2,
        status: "under_review",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findById.mockResolvedValue(mockExceptionDoc);

      const mockInventoryRecord = {
        _id: new mongoose.Types.ObjectId(),
        onHand: 10,
        reserved: 5,
        save: jest.fn().mockResolvedValue(true),
      };
      inventoryRepository.findByVariantAndWarehouse.mockResolvedValue(mockInventoryRecord);

      paymentRepository.findLatestByOrderId.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "captured",
        amount: mongoose.Types.Decimal128.fromString("2800.00"),
      });

      paymentService.refundPaymentForOrder.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "processed",
      });

      Vendor.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ email: "vendor1@buybox.test" }),
        }),
      });

      const result = await exceptionService.adminApproveCancellation({
        exceptionId: mockExceptionDoc._id.toString(),
        notes: "Damaged stock verified. Item cancellation approved with customer refund.",
        actorUser: { id: adminUserId, name: "Admin Officer" },
      });

      expect(result.success).toBe(true);
      expect(mockExceptionDoc.status).toBe("resolved");
      expect(mockExceptionDoc.cancellationDetails.stockReleased).toBe(true);
      expect(mockExceptionDoc.cancellationDetails.quantityReleased).toBe(2);
      expect(mockExceptionDoc.cancellationDetails.refundIssued).toBe(true);

      // Verify item1 was cancelled and inventory marked released
      const targetItem = mockOrder.items.find((it) => it._id.toString() === item1Id.toString());
      expect(targetItem.fulfillmentStatus).toBe("cancelled");
      expect(targetItem.inventoryStatus).toBe("released");

      // CRITICAL INVARIANT: Vendor 2's item was NOT cancelled and order was NOT completely cancelled
      const unrelatedVendorItem = mockOrder.items.find((it) => it._id.toString() === item2Id.toString());
      expect(unrelatedVendorItem.fulfillmentStatus).toBe("processing");
      expect(mockOrder.status).toBe("confirmed"); // remains confirmed because vendor 2 item is active
    });

    test("refund retries cannot create duplicate refunds (idempotency guard)", async () => {
      const alreadyRefundedException = {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderId,
        orderItemId: item1Id,
        vendorId: vendor1Id,
        quantity: 2,
        status: "under_review",
        cancellationDetails: {
          refundIssued: true,
          refundAmount: mongoose.Types.Decimal128.fromString("1600.00"),
        },
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findById.mockResolvedValue(alreadyRefundedException);

      Vendor.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ email: "vendor1@buybox.test" }),
        }),
      });

      await exceptionService.adminApproveCancellation({
        exceptionId: alreadyRefundedException._id.toString(),
        notes: "Retry cancellation approval",
        actorUser: { id: adminUserId },
      });

      // Payment refund service was NOT called a second time
      expect(paymentService.refundPaymentForOrder).not.toHaveBeenCalled();
    });

    test("notification retries do not produce duplicate outbox records", async () => {
      // Mock that a notification record already exists for this exception transition
      NotificationOutbox.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "pending",
      });

      const mockExceptionDoc = {
        _id: new mongoose.Types.ObjectId(),
        exceptionNumber: "EXC-20261019-7777",
        vendorId: vendor1Id,
        status: "open",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findById.mockResolvedValue(mockExceptionDoc);

      Vendor.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ email: "vendor1@buybox.test" }),
        }),
      });

      await exceptionService.adminTransitionException({
        exceptionId: mockExceptionDoc._id.toString(),
        newStatus: "under_review",
        notes: "Under review check",
        actorUser: { id: adminUserId },
      });

      // Notification outbox enqueue was skipped because existing notification was detected
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    test("vendor can withdraw an open exception", async () => {
      const openException = {
        _id: new mongoose.Types.ObjectId(),
        vendorId: vendor1Id,
        status: "open",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      FulfillmentException.findOne.mockResolvedValue(openException);

      const res = await exceptionService.vendorWithdrawException({
        userId: vendor1UserId,
        exceptionId: openException._id.toString(),
        reason: "Supplier replenished stock early",
      });

      expect(res.status).toBe("withdrawn");
      expect(res.timeline.length).toBe(1);
      expect(res.timeline[0].status).toBe("withdrawn");
      expect(res.timeline[0].actorType).toBe("vendor");
      expect(openException.save).toHaveBeenCalled();
    });

    test("unauthorized staff without permission cannot access or resolve exceptions", async () => {
      const { requirePermissions } = require("../src/middlewares/authorization.middleware");
      const { PERMISSIONS } = require("../src/constants/permissions.constants");

      const middleware = requirePermissions(PERMISSIONS.ORDERS_MANAGE);
      const req = {
        user: {
          id: new mongoose.Types.ObjectId().toString(),
          role: "staff",
          roles: ["staff"],
          isPermissionFresh: true,
        },
      };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: "INSUFFICIENT_PERMISSIONS",
        })
      );
    });
  });
});

