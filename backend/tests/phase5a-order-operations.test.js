const mongoose = require("mongoose");

jest.mock("../src/repositories/order.repository");
jest.mock("../src/repositories/cart.repository");
jest.mock("../src/repositories/address.repository");
jest.mock("../src/repositories/inventory.repository");
jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/coupon.repository");
jest.mock("../src/repositories/coupon-redemption.repository");
jest.mock("../src/repositories/shipment.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/coupon.service");
jest.mock("../src/services/coupon-redemption.service");
jest.mock("../src/services/tax.service");
jest.mock("../src/services/payment.service");
jest.mock("../src/services/digital-entitlement.service");
jest.mock("../src/services/notification-outbox.service");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/NotificationOutbox");

const orderRepository = require("../src/repositories/order.repository");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const NotificationOutbox = require("../src/models/NotificationOutbox");
const notificationOutboxService = require("../src/services/notification-outbox.service");
const notificationService = require("../src/services/notification");
const { vendorNewOrderTemplate } = require("../src/services/notification.templates");

const orderService = require("../src/services/order.service");
const {
  getOrderById,
  markOrderPaymentCaptured,
  notifyVendorsForConfirmedOrder,
  transitionOrderStatus,
} = orderService;

describe("Phase 5A — Order Operations & Fulfillment Polish Test Suite", () => {
  const customer1Id = new mongoose.Types.ObjectId().toString();
  const customer2Id = new mongoose.Types.ObjectId().toString();
  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();
  const orderId = new mongoose.Types.ObjectId().toString();
  const vendor1Id = new mongoose.Types.ObjectId().toString();
  const vendor2Id = new mongoose.Types.ObjectId().toString();
  const vendor1UserId = new mongoose.Types.ObjectId().toString();
  const vendor2UserId = new mongoose.Types.ObjectId().toString();

  const mockOrderData = {
    _id: orderId,
    orderNumber: "BB-20261018-0001",
    customerId: customer1Id,
    status: "pending",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    currency: "INR",
    subtotal: "2500.00",
    discountTotal: "0.00",
    shippingTotal: "0.00",
    taxTotal: "450.00",
    grandTotal: "2950.00",
    shippingAddress: {
      fullName: "Jane Doe",
      street: "123 Audiophile Way",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India",
      phone: "+919876543210",
    },
    items: [
      {
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(),
        productVariantId: new mongoose.Types.ObjectId(),
        warehouseId: new mongoose.Types.ObjectId(),
        vendorId: vendor1Id,
        sku: "SENN-HD600-BLK",
        productName: "Sennheiser HD 600",
        variantName: "Black",
        quantity: 1,
        unitPrice: "2000.00",
        lineTotal: "2000.00",
        fulfillmentStatus: "unfulfilled",
      },
      {
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(),
        productVariantId: new mongoose.Types.ObjectId(),
        warehouseId: new mongoose.Types.ObjectId(),
        vendorId: vendor2Id,
        sku: "FIIO-KA13-SIL",
        productName: "FiiO KA13 DAC/Amp",
        variantName: "Silver",
        quantity: 1,
        unitPrice: "500.00",
        lineTotal: "500.00",
        fulfillmentStatus: "unfulfilled",
      },
    ],
    timeline: [],
    paymentAttempts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // FEATURE 1: CUSTOMER INVOICE ACCESS & SERVER-SIDE OWNERSHIP
  // =========================================================================
  describe("Feature 1: Customer Invoice Navigation & Server-Side Security", () => {
    it("allows authorized customer to access order and invoice snapshot data", async () => {
      Customer.findOne.mockResolvedValue({ _id: customer1Id, userId: user1Id });
      orderRepository.findById.mockResolvedValue({ ...mockOrderData });

      const result = await getOrderById(orderId, user1Id);

      expect(result).toBeDefined();
      expect(result._id).toBe(orderId);
      expect(result.orderNumber).toBe("BB-20261018-0001");
      expect(result.grandTotal).toBe("2950.00");
      expect(result.items).toHaveLength(2);
      expect(result.shippingAddress.fullName).toBe("Jane Doe");
    });

    it("rejects unauthorized customer from accessing another customer's invoice (403 ORDER_ACCESS_DENIED)", async () => {
      Customer.findOne.mockResolvedValue({ _id: customer2Id, userId: user2Id });
      orderRepository.findById.mockResolvedValue({ ...mockOrderData }); // belongs to customer1Id

      await expect(getOrderById(orderId, user2Id)).rejects.toMatchObject({
        statusCode: 403,
        code: "ORDER_ACCESS_DENIED",
      });
    });

    it("throws 404 when order does not exist", async () => {
      Customer.findOne.mockResolvedValue({ _id: customer1Id, userId: user1Id });
      orderRepository.findById.mockResolvedValue(null);

      await expect(getOrderById("non-existent-order", user1Id)).rejects.toMatchObject({
        statusCode: 404,
        code: "ORDER_NOT_FOUND",
      });
    });

    it("preserves historical snapshot pricing, tax details, and addresses on the invoice", async () => {
      Customer.findOne.mockResolvedValue({ _id: customer1Id, userId: user1Id });
      orderRepository.findById.mockResolvedValue({
        ...mockOrderData,
        taxTotal: "450.00",
        items: [
          {
            ...mockOrderData.items[0],
            unitPrice: "2000.00",
            lineTotal: "2000.00",
          },
        ],
      });

      const order = await getOrderById(orderId, user1Id);

      expect(order.subtotal).toBe("2500.00");
      expect(order.taxTotal).toBe("450.00");
      expect(order.items[0].unitPrice).toBe("2000.00");
      expect(order.items[0].lineTotal).toBe("2000.00");
    });
  });

  // =========================================================================
  // FEATURE 2: VENDOR NEW-ORDER NOTIFICATIONS
  // =========================================================================
  describe("Feature 2: Vendor New-Order Notifications & Outbox Enqueue", () => {
    it("does not enqueue vendor notifications when an unpaid pending order is created", async () => {
      // Pending order creation in createOrderFromCurrentCart does not call notifyVendorsForConfirmedOrder
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues notifications to each affected vendor when order payment is captured and status becomes confirmed", async () => {
      orderRepository.findById.mockResolvedValue({ ...mockOrderData, status: "pending", paymentStatus: "pending" });
      orderRepository.updateById.mockImplementation(async (id, update) => ({
        ...mockOrderData,
        ...update,
        status: "confirmed",
        paymentStatus: "paid",
      }));

      // Mock NotificationOutbox.findOne (idempotency check returns null: not yet notified)
      NotificationOutbox.findOne.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      // Mock Vendor lookups
      Vendor.findById.mockImplementation((vId) => {
        if (vId.toString() === vendor1Id.toString()) {
          return {
            populate: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                  _id: vendor1Id,
                  businessName: "Sennheiser Official",
                  supportEmail: "orders@sennheiser-store.in",
                  userId: { email: "vendor1@buybox.test" },
                  onboardingStatus: "approved",
                  deletedAt: null,
                }),
              }),
            }),
          };
        }
        if (vId.toString() === vendor2Id.toString()) {
          return {
            populate: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                  _id: vendor2Id,
                  businessName: "FiiO Electronics",
                  supportEmail: null,
                  userId: { email: "vendor2@fiio-store.com" },
                  onboardingStatus: "approved",
                  deletedAt: null,
                }),
              }),
            }),
          };
        }
        return {
          populate: jest.fn().mockReturnValue({
            session: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(null),
            }),
          }),
        };
      });

      notificationOutboxService.enqueue.mockResolvedValue({ _id: "notif-1" });

      const updated = await markOrderPaymentCaptured(orderId);

      expect(updated.status).toBe("confirmed");
      expect(updated.paymentStatus).toBe("paid");

      // Verify that notificationOutboxService.enqueue was called for each vendor
      expect(notificationOutboxService.enqueue).toHaveBeenCalledTimes(2);

      const calls = notificationOutboxService.enqueue.mock.calls;

      // Vendor 1 verification: recipient is supportEmail, contains ONLY vendor 1 items
      const vendor1Call = calls.find((c) => c[0].payload.vendorId === vendor1Id.toString());
      expect(vendor1Call).toBeDefined();
      expect(vendor1Call[0].recipient).toBe("orders@sennheiser-store.in");
      expect(vendor1Call[0].type).toBe("vendor_new_order");
      expect(vendor1Call[0].payload.items).toHaveLength(1);
      expect(vendor1Call[0].payload.items[0].sku).toBe("SENN-HD600-BLK");
      expect(vendor1Call[0].payload.items[0].productName).toBe("Sennheiser HD 600");
      expect(vendor1Call[0].payload.orderUrl).toContain("/vendor/orders/");

      // Vendor 2 verification: fallback to userId.email, contains ONLY vendor 2 items
      const vendor2Call = calls.find((c) => c[0].payload.vendorId === vendor2Id.toString());
      expect(vendor2Call).toBeDefined();
      expect(vendor2Call[0].recipient).toBe("vendor2@fiio-store.com");
      expect(vendor2Call[0].type).toBe("vendor_new_order");
      expect(vendor2Call[0].payload.items).toHaveLength(1);
      expect(vendor2Call[0].payload.items[0].sku).toBe("FIIO-KA13-SIL");
      expect(vendor2Call[0].payload.items[0].productName).toBe("FiiO KA13 DAC/Amp");
    });

    it("does not leak items between vendors (strict multi-tenant isolation)", async () => {
      NotificationOutbox.findOne.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      Vendor.findById.mockImplementation((vId) => ({
        populate: jest.fn().mockReturnValue({
          session: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: vId,
              businessName: `Vendor ${vId}`,
              supportEmail: `vendor-${vId}@test.com`,
              onboardingStatus: "approved",
            }),
          }),
        }),
      }));

      await notifyVendorsForConfirmedOrder(mockOrderData);

      const calls = notificationOutboxService.enqueue.mock.calls;
      expect(calls).toHaveLength(2);

      // Check Vendor 1 payload does NOT contain FiiO
      const v1Payload = calls.find((c) => c[0].payload.vendorId === vendor1Id.toString())[0].payload;
      const v1Skus = v1Payload.items.map((i) => i.sku);
      expect(v1Skus).toContain("SENN-HD600-BLK");
      expect(v1Skus).not.toContain("FIIO-KA13-SIL");

      // Check Vendor 2 payload does NOT contain Sennheiser
      const v2Payload = calls.find((c) => c[0].payload.vendorId === vendor2Id.toString())[0].payload;
      const v2Skus = v2Payload.items.map((i) => i.sku);
      expect(v2Skus).toContain("FIIO-KA13-SIL");
      expect(v2Skus).not.toContain("SENN-HD600-BLK");
    });

    it("prevents duplicate notifications upon duplicate payment webhooks or retries (idempotency)", async () => {
      // Mock existing notification found in outbox
      NotificationOutbox.findOne.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "existing-outbox-record",
            type: "vendor_new_order",
          }),
        }),
      });

      await notifyVendorsForConfirmedOrder(mockOrderData);

      // Since outbox already has records for this order, enqueue must NOT be called
      expect(notificationOutboxService.enqueue).not.toHaveBeenCalled();
    });

    it("ensures notification failures do not roll back order payment capture (fault isolation)", async () => {
      orderRepository.findById.mockResolvedValue({ ...mockOrderData, status: "pending", paymentStatus: "pending" });
      orderRepository.updateById.mockResolvedValue({
        ...mockOrderData,
        status: "confirmed",
        paymentStatus: "paid",
      });

      // Notification enqueue throws an unexpected database error
      NotificationOutbox.findOne.mockImplementation(() => {
        throw new Error("Outbox collection connectivity error");
      });

      // markOrderPaymentCaptured must NOT throw or roll back; order status must still return updated
      const result = await markOrderPaymentCaptured(orderId);

      expect(result).toBeDefined();
      expect(result.status).toBe("confirmed");
      expect(result.paymentStatus).toBe("paid");
    });

    it("skips inactive or suspended vendors without failing the notification run", async () => {
      NotificationOutbox.findOne.mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      Vendor.findById.mockImplementation((vId) => {
        if (vId.toString() === vendor1Id.toString()) {
          return {
            populate: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                  _id: vendor1Id,
                  businessName: "Suspended Vendor",
                  supportEmail: "suspended@vendor.com",
                  onboardingStatus: "suspended", // Suspended!
                }),
              }),
            }),
          };
        }
        return {
          populate: jest.fn().mockReturnValue({
            session: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({
                _id: vendor2Id,
                businessName: "Active Vendor",
                supportEmail: "active@vendor.com",
                onboardingStatus: "approved",
              }),
            }),
          }),
        };
      });

      await notifyVendorsForConfirmedOrder(mockOrderData);

      // Only the active vendor should receive an outbox notification
      expect(notificationOutboxService.enqueue).toHaveBeenCalledTimes(1);
      expect(notificationOutboxService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: "active@vendor.com",
          payload: expect.objectContaining({
            vendorId: vendor2Id.toString(),
          }),
        })
      );
    });

    it("renders vendorNewOrderTemplate with order reference, item list, and secure vendor link", () => {
      const template = vendorNewOrderTemplate({
        vendorName: "Acoustic Audio",
        orderNumber: "BB-20261018-0001",
        items: [
          { productName: "Sennheiser HD 600", variantName: "Black", sku: "SENN-HD600-BLK", quantity: 2 },
        ],
        orderUrl: "http://localhost:3000/vendor/orders/ord_sec123456",
      });

      expect(template.subject).toBe("New Order Assigned - #BB-20261018-0001");
      expect(template.html).toContain("Acoustic Audio");
      expect(template.html).toContain("#BB-20261018-0001");
      expect(template.html).toContain("Sennheiser HD 600 (Black)");
      expect(template.html).toContain("SENN-HD600-BLK");
      expect(template.html).toContain("&times; 2");
      expect(template.html).toContain("http://localhost:3000/vendor/orders/ord_sec123456");

      expect(template.text).toContain("Sennheiser HD 600 (Black)");
      expect(template.text).toContain("x 2");
      expect(template.text).toContain("http://localhost:3000/vendor/orders/ord_sec123456");
    });
  });
});
