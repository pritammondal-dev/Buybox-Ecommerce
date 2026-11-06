const mongoose = require("mongoose");

jest.mock("../src/models/Order");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/Shipment");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/payment.service");

const Order = require("../src/models/Order");
const AuditLog = require("../src/models/AuditLog");
const Shipment = require("../src/models/Shipment");
const orderRepository = require("../src/repositories/order.repository");
const orderService = require("../src/services/order.service");

describe("Superadmin Order Management — Product Pricing & Status Control", () => {
  const orderId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    orderRepository.transitionStatusIfCurrent = jest.fn().mockImplementation((id, expectedStatus, updateData) => {
      return Promise.resolve({
        _id: id,
        status: updateData.status || expectedStatus,
        version: 2,
        ...updateData,
      });
    });
    Shipment.find = jest.fn().mockImplementation(() =>
      Object.assign(Promise.resolve([]), {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      })
    );
  });

  // ==========================================================================
  // SECTION A: PRODUCT PRICING VISIBILITY & HISTORICAL INTEGRITY
  // ==========================================================================
  describe("A. Product Pricing Visibility & Serialization Integrity", () => {
    test("Single-item order: returns normalized historical unit price, line total, and vendor attribution", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-20261019-001",
        customerId: {
          _id: customerId,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
        status: "confirmed",
        paymentStatus: "paid",
        subtotal: { $numberDecimal: "1499.00" },
        discountTotal: { $numberDecimal: "100.00" },
        taxTotal: { $numberDecimal: "75.00" },
        shippingTotal: { $numberDecimal: "50.00" },
        grandTotal: { $numberDecimal: "1524.00" },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Premium Wireless Headphones",
            sku: "WH-1000XM4-BLK",
            quantity: 1,
            unitPrice: { $numberDecimal: "1499.00" },
            lineTotal: { $numberDecimal: "1474.00" },
            discountTotal: { $numberDecimal: "100.00" },
            taxTotal: { $numberDecimal: "75.00" },
            fulfillmentStatus: "unfulfilled",
            vendorId: {
              _id: vendorId,
              storeName: "Audio Elite",
              businessName: "Elite Electronics Ltd",
            },
            productId: {
              _id: productId,
              title: "Premium Wireless Headphones",
              thumbnail: { url: "https://cdn.buybox.test/images/wh-thumb.jpg" },
            },
          },
        ],
        timeline: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });

      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res).toBeDefined();
      expect(res.grandTotal).toBe("1524.00");
      expect(res.subtotal).toBe("1499.00");
      expect(res.discountTotal).toBe("100.00");
      expect(res.taxTotal).toBe("75.00");
      expect(res.shippingTotal).toBe("50.00");

      const item = res.items[0];
      expect(item.unitPrice).toBe("1499.00");
      expect(item.lineTotal).toBe("1474.00");
      expect(item.discountTotal).toBe("100.00");
      expect(item.taxTotal).toBe("75.00");
      expect(item.productImage).toBe("https://cdn.buybox.test/images/wh-thumb.jpg");
      expect(item.vendor.name).toBe("Audio Elite");
    });

    test("Multiple-item and variable product order: respects variant snapshot and multiple quantities", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-20261019-002",
        status: "processing",
        paymentStatus: "paid",
        subtotal: { $numberDecimal: "3998.00" },
        discountTotal: "0.00",
        taxTotal: "200.00",
        grandTotal: { $numberDecimal: "4198.00" },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Organic Cotton T-Shirt",
            variantName: "Size L / Navy Blue",
            sku: "TSH-ORG-L-NVY",
            quantity: 2,
            unitPrice: { $numberDecimal: "999.00" },
            lineTotal: { $numberDecimal: "1998.00" },
            discountTotal: "0.00",
            taxTotal: "100.00",
            fulfillmentStatus: "processing",
            productId: {
              title: "Organic Cotton T-Shirt",
            },
            productVariantId: {
              _id: variantId,
              name: "Size L / Navy Blue",
              sku: "TSH-ORG-L-NVY",
              images: [{ url: "https://cdn.buybox.test/images/tshirt-navy.jpg" }],
            },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Classic Denim Jeans",
            variantName: "Waist 32 / Blue",
            sku: "JNS-CLS-32-BLU",
            quantity: 1,
            unitPrice: { $numberDecimal: "2000.00" },
            lineTotal: { $numberDecimal: "2000.00" },
            discountTotal: "0.00",
            taxTotal: "100.00",
            fulfillmentStatus: "processing",
            productId: {
              title: "Classic Denim Jeans",
              thumbnail: { url: "https://cdn.buybox.test/images/jeans.jpg" },
            },
          },
        ],
        timeline: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });

      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.items).toHaveLength(2);
      expect(res.items[0].quantity).toBe(2);
      expect(res.items[0].unitPrice).toBe("999.00");
      expect(res.items[0].lineTotal).toBe("1998.00");
      expect(res.items[0].productImage).toBe("https://cdn.buybox.test/images/tshirt-navy.jpg");

      expect(res.items[1].quantity).toBe(1);
      expect(res.items[1].unitPrice).toBe("2000.00");
      expect(res.items[1].lineTotal).toBe("2000.00");
    });

    test("Historical price integrity: does not derive price from catalog and handles legacy missing price safely", async () => {
      // Legacy order with missing price data
      const mockLegacyOrder = {
        _id: orderId,
        orderNumber: "LEGACY-ORDER-999",
        status: "completed",
        paymentStatus: "paid",
        subtotal: null,
        grandTotal: { $numberDecimal: "500.00" },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Vintage Leather Belt",
            sku: "VNT-BLT-01",
            quantity: 1,
            unitPrice: null, // Genuinely absent legacy data
            lineTotal: null,
            discountTotal: null,
            taxTotal: null,
            fulfillmentStatus: "fulfilled",
          },
        ],
        timeline: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockLegacyOrder),
      });

      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      // Must NOT silently fabricate "0.00" or fake price for genuinely absent legacy prices
      expect(res.items[0].unitPrice).toBeNull();
      expect(res.items[0].lineTotal).toBeNull();
      expect(res.items[0].discountTotal).toBe("0.00");
      expect(res.items[0].taxTotal).toBe("0.00");
    });
  });

  // ==========================================================================
  // SECTION B: SUPERADMIN ORDER STATUS UPDATES & STATE TRANSITION ENFORCEMENT
  // ==========================================================================
  describe("B. Superadmin Order Status Control & Transition Enforcement", () => {
    test("Valid status transition (pending -> confirmed): updates status, logs timeline and AuditLog", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "pending",
        fulfillmentStatus: "unfulfilled",
        paymentStatus: "authorized",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);
      AuditLog.create = jest.fn().mockResolvedValue(true);

      // Return refreshed order
      Order.findById.mockImplementationOnce(() => Promise.resolve(mockOrderDoc));
      Order.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          ...mockOrderDoc,
          status: "confirmed",
          items: [],
          timeline: mockOrderDoc.timeline,
        }),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await orderService.updateAdminOrderStatus({
        orderId: orderId.toString(),
        status: "confirmed",
        reason: "Payment verified and merchant notified",
        notes: "Approved after fraud screening",
        actor: { userId: new mongoose.Types.ObjectId(), role: "superadmin" },
      });

      expect(mockOrderDoc.status).toBe("confirmed");
      expect(orderRepository.transitionStatusIfCurrent).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_STATUS_UPDATED",
          entityType: "Order",
          beforeState: { status: "pending", fulfillmentStatus: "unfulfilled" },
          afterState: expect.objectContaining({ status: "confirmed" }),
        })
      );
    });

    test("Invalid status transition rejected (pending -> delivered): throws 400 INVALID_ORDER_STATUS_TRANSITION", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "pending",
        fulfillmentStatus: "unfulfilled",
        paymentStatus: "pending",
        save: jest.fn(),
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "delivered", // Invalid jump
          actor: { role: "admin" },
        })
      ).rejects.toThrow("Invalid order status transition from 'pending' to 'delivered'");

      expect(mockOrderDoc.save).not.toHaveBeenCalled();
    });

    test("Concurrency protection: fails with 409 CONCURRENT_STATUS_CONFLICT if expected status does not match current", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "shipped", // Order was already moved to shipped by someone else
        fulfillmentStatus: "fulfilled",
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "delivered",
          expectedPreviousStatus: "processing", // Client had stale state
          actor: { role: "superadmin" },
        })
      ).rejects.toThrow(/Order status conflict: expected 'processing' but order is currently 'shipped'/);
    });

    test("Superadmin exceptional override: allows transition with valid justification note and audit log", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "shipped",
        fulfillmentStatus: "fulfilled",
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);
      AuditLog.create = jest.fn().mockResolvedValue(true);

      Order.findById.mockImplementationOnce(() => Promise.resolve(mockOrderDoc));
      Order.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          ...mockOrderDoc,
          status: "processing",
          items: [],
        }),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.updateAdminOrderStatus({
        orderId: orderId.toString(),
        status: "processing",
        isOverride: true,
        overrideReason: "Carrier returned package due to label barcode damage; resetting to processing for relabeling",
        actor: { userId: new mongoose.Types.ObjectId(), role: "superadmin" },
      });

      expect(mockOrderDoc.status).toBe("processing");
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_STATUS_OVERRIDE",
          targetId: orderId,
          afterState: expect.objectContaining({
            status: "processing",
            isOverride: true,
          }),
        })
      );
    });

    test("Superadmin exceptional override rejected without justification note", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "shipped",
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "processing",
          isOverride: true,
          overrideReason: "shrt", // Under 5 characters
          actor: { role: "superadmin" },
        })
      ).rejects.toThrow(/detailed override reason.*required/i);
    });

    test("Cancelled order protection: cannot resurrect cancelled orders directly to active state", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "cancelled",
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "confirmed",
          isOverride: true,
          overrideReason: "Mistakenly cancelled, customer wants to proceed",
          actor: { role: "superadmin" },
        })
      ).rejects.toThrow(/Cancelled orders cannot be directly transitioned back to active state/);
    });

    test("Fulfill downstream synchronization: moving to shipped updates line items and shipments", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "processing",
        fulfillmentStatus: "unfulfilled",
        items: [
          { fulfillmentStatus: "processing" },
          { fulfillmentStatus: "cancelled" }, // Cancelled item stays cancelled
        ],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);
      Shipment.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      AuditLog.create = jest.fn().mockResolvedValue(true);

      Order.findById.mockImplementationOnce(() => Promise.resolve(mockOrderDoc));
      Order.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          ...mockOrderDoc,
          status: "shipped",
        }),
      });
      Shipment.find = jest.fn().mockImplementation(() =>
        Object.assign(Promise.resolve([]), {
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        })
      );

      await orderService.updateAdminOrderStatus({
        orderId: orderId.toString(),
        status: "shipped",
        reason: "Dispatched with BlueDart",
        actor: { role: "superadmin" },
      });

      expect(mockOrderDoc.items[0].fulfillmentStatus).toBe("shipped");
      expect(mockOrderDoc.items[1].fulfillmentStatus).toBe("cancelled"); // Untouched
      expect(orderRepository.transitionStatusIfCurrent).toHaveBeenCalled();
    });

    test("Nonexistent order: throws 404 ORDER_NOT_FOUND", async () => {
      Order.findById = jest.fn().mockResolvedValue(null);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "confirmed",
          actor: { role: "superadmin" },
        })
      ).rejects.toThrow("Order not found");
    });

    test("Cancellation restriction: cannot cancel already shipped or delivered order", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "shipped",
        fulfillmentStatus: "fulfilled",
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "cancelled",
          isOverride: true,
          overrideReason: "Trying to force cancel an already shipped consignment",
          actor: { role: "superadmin" },
        })
      ).rejects.toThrow(/Cannot cancel an order that is already 'shipped'/);
    });

    test("Terminal state: completed order cannot transition without override", async () => {
      const mockOrderDoc = {
        _id: orderId,
        status: "completed",
        fulfillmentStatus: "fulfilled",
      };

      Order.findById = jest.fn().mockResolvedValue(mockOrderDoc);

      await expect(
        orderService.updateAdminOrderStatus({
          orderId: orderId.toString(),
          status: "processing",
          isOverride: false,
          actor: { role: "admin" },
        })
      ).rejects.toThrow(/Invalid order status transition from 'completed' to 'processing'/);
    });
  });

  // ==========================================================================
  // SECTION C: SCHEMA VALIDATION & API CONTRACT
  // ==========================================================================
  describe("C. Schema Validation & API Contract", () => {
    const { updateAdminOrderStatusSchema } = require("../src/validators/order/admin-order.validator");

    test("Accepts valid status payload", () => {
      const validPayload = {
        status: "processing",
        reason: "Customer request verified",
        notes: "Items ready in WH-1",
        expectedPreviousStatus: "confirmed",
        isOverride: false,
      };

      const result = updateAdminOrderStatusSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("processing");
    });

    test("Rejects invalid status string", () => {
      const invalidPayload = {
        status: "invalid_status_xyz",
      };

      const result = updateAdminOrderStatusSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    test("Rejects unrecognized fields due to strict schema", () => {
      const invalidPayload = {
        status: "confirmed",
        maliciousField: "hack_attempt",
      };

      const result = updateAdminOrderStatusSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
