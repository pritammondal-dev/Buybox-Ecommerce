/**
 * Customer Order Status, Vendor Acceptance & Expected Delivery Date Integrity Tests
 *
 * Verifies that:
 * 1. Customer order details NEVER synthesize or fabricate a delivery date before vendor fulfillment confirmation.
 * 2. Unconfirmed paid orders return source "awaiting_vendor_confirmation" with estimatedDateRange: null.
 * 3. Accepted orders awaiting shipping details return source "awaiting_fulfillment_details".
 * 4. Authoritative delivery dates come strictly from vendor confirmation, active shipment, or live courier tracking.
 * 5. Single-vendor and multi-vendor packages return clean merchant names and independent fulfillment states.
 * 6. Payment capture records payment verification without recording a fake vendor fulfillment confirmation.
 */

const mongoose = require("mongoose");
const orderService = require("../src/services/order.service");

jest.setTimeout(30000);

describe("Customer Order Status & Expected Delivery Date Integrity", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
  describe("Delivery Estimate Calculation Logic", () => {
    test("1. Returns awaiting_vendor_confirmation with null estimatedDateRange when vendor acceptance is pending", () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        status: "confirmed",
        paymentStatus: "paid",
        createdAt: new Date("2026-11-02T10:00:00.000Z"),
        deliveryOption: {
          name: "Standard Delivery",
          estimatedDays: { min: 2, max: 4 },
        },
        items: [
          {
            productName: "ANC Headphones",
            fulfillmentStatus: "unfulfilled",
            vendorAcceptance: {
              status: "pending",
            },
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
        vendorFulfillments: [
          {
            vendorId: new mongoose.Types.ObjectId(),
            acceptanceStatus: "pending",
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder });

      expect(estimate.source).toBe("awaiting_vendor_confirmation");
      expect(estimate.estimatedDateRange).toBeNull();
      expect(estimate.estimatedFrom).toBeNull();
      expect(estimate.estimatedTo).toBeNull();
      expect(estimate.message).toMatch(/Awaiting merchant confirmation|Expected delivery date will be confirmed/i);
      expect(estimate.provisionalEstimate).toBeDefined();
      expect(estimate.provisionalEstimate.window).toContain("Nov 2026");
      expect(estimate.provisionalEstimate.label).toBe("Provisional Checkout Estimate");
    });

    test("2. Returns awaiting_fulfillment_details with null estimatedDateRange when vendor accepted but fulfillment details pending", () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        status: "confirmed",
        paymentStatus: "paid",
        createdAt: new Date("2026-11-02T10:00:00.000Z"),
        deliveryOption: {
          name: "Standard Delivery",
          estimatedDays: "3-5",
        },
        items: [
          {
            productName: "Organic Coffee",
            fulfillmentStatus: "unfulfilled",
            vendorAcceptance: {
              status: "accepted",
              acceptedAt: new Date(),
            },
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
        vendorFulfillments: [
          {
            vendorId: new mongoose.Types.ObjectId(),
            acceptanceStatus: "accepted",
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder });

      expect(estimate.source).toBe("awaiting_fulfillment_details");
      expect(estimate.estimatedDateRange).toBeNull();
      expect(estimate.message).toMatch(/Merchant accepted; delivery date will be confirmed/i);
    });

    test("3. Returns vendor_confirmed authoritative date when vendor explicitly confirms fulfillment", () => {
      const confirmedDate = new Date("2026-11-08T00:00:00.000Z");
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        status: "processing",
        paymentStatus: "paid",
        items: [
          {
            productName: "Handmade Ceramic Mug",
            fulfillmentStatus: "processing",
            vendorAcceptance: {
              status: "accepted",
            },
            isFulfillmentConfirmed: true,
            expectedDeliveryDate: confirmedDate,
          },
        ],
        vendorFulfillments: [
          {
            vendorId: new mongoose.Types.ObjectId(),
            acceptanceStatus: "accepted",
            isFulfillmentConfirmed: true,
            expectedDeliveryDate: confirmedDate,
          },
        ],
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder });

      expect(estimate.source).toBe("vendor_confirmed");
      expect(estimate.estimatedDateRange).toMatch(/8 Nov 2026|Nov 8, 2026/);
      expect(estimate.estimatedFrom).toBe(confirmedDate.toISOString());
      expect(estimate.message).toBeNull();
    });

    test("4. Returns courier estimate with highest authority when active shipment has live courier tracking", () => {
      const courierDate = new Date("2026-11-06T15:00:00.000Z");
      const mockShipment = {
        status: "in_transit",
        metadata: {
          courierEstimatedDelivery: courierDate,
        },
      };
      const mockOrder = {
        status: "shipped",
        items: [],
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder, shipment: mockShipment });

      expect(estimate.source).toBe("courier");
      expect(estimate.estimatedDateRange).toMatch(/6 Nov 2026|Nov 6, 2026/);
      expect(estimate.message).toBeNull();
    });

    test("5. Returns vendor_rejected_triage when an item or package was rejected by vendor", () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        status: "confirmed",
        paymentStatus: "paid",
        items: [
          {
            productName: "Vintage Lamp",
            fulfillmentStatus: "unfulfilled",
            vendorAcceptance: {
              status: "rejected",
              rejectionReason: "Item damaged in facility",
            },
            isFulfillmentConfirmed: false,
          },
        ],
        vendorFulfillments: [
          {
            vendorId: new mongoose.Types.ObjectId(),
            acceptanceStatus: "rejected",
            rejectionReason: "Item damaged in facility",
          },
        ],
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder });

      expect(estimate.source).toBe("vendor_rejected_triage");
      expect(estimate.estimatedDateRange).toBeNull();
      expect(estimate.message).toMatch(/under operations triage/i);
    });

    test("6. Terminal status delivered returns actual_delivery with deliveredAt", () => {
      const deliveredDate = new Date("2026-11-01T12:00:00.000Z");
      const mockOrder = {
        status: "delivered",
        deliveredAt: deliveredDate,
      };

      const estimate = orderService.calculateDeliveryEstimate({ order: mockOrder });

      expect(estimate.isDelivered).toBe(true);
      expect(estimate.source).toBe("actual_delivery");
      expect(estimate.deliveredAt).toBe(deliveredDate.toISOString());
    });
  });

  describe("Customer Display Status & Package Derivation", () => {
    test("7. Derives awaiting_merchant_confirmation for paid orders with pending vendor acceptance", async () => {
      const vendorId = new mongoose.Types.ObjectId();
      const customerId = new mongoose.Types.ObjectId();
      const mockRawOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-UNCONFIRMED",
        status: "confirmed",
        paymentStatus: "paid",
        customerId,
        items: [
          {
            vendorId,
            productName: "Test Product",
            quantity: 1,
            unitPrice: 500,
            vendorAcceptance: { status: "pending" },
            isFulfillmentConfirmed: false,
          },
        ],
        vendorFulfillments: [
          {
            vendorId,
            acceptanceStatus: "pending",
            isFulfillmentConfirmed: false,
          },
        ],
      };

      // Mock repository and customer lookup
      const Customer = require("../src/models/Customer");
      const orderRepository = require("../src/repositories/order.repository");
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(Customer, "findOne").mockResolvedValue({
        _id: customerId,
        userId,
        isActive: true,
        deletedAt: null,
      });
      jest.spyOn(orderRepository, "findById").mockResolvedValue(mockRawOrder);

      const result = await orderService.getOrderById(mockRawOrder._id.toString(), userId);

      expect(result.customerDisplayStatus).toBe("awaiting_merchant_confirmation");
      expect(result.isAwaitingVendorConfirmation).toBe(true);
      expect(result.isFulfillmentConfirmed).toBe(false);
      expect(result.estimatedDelivery.estimatedDateRange).toBeNull();
      expect(result.vendorPackages).toHaveLength(1);
      expect(result.vendorPackages[0].acceptanceStatus).toBe("pending");

      Customer.findOne.mockRestore();
      orderRepository.findById.mockRestore();
    });

    test("8. Derives merchant_accepted when vendor accepts before fulfillment confirmation", async () => {
      const vendorId = new mongoose.Types.ObjectId();
      const customerId = new mongoose.Types.ObjectId();
      const mockRawOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-ACCEPTED",
        status: "confirmed",
        paymentStatus: "paid",
        customerId,
        items: [
          {
            vendorId,
            productName: "Accepted Product",
            quantity: 1,
            unitPrice: 1200,
            vendorAcceptance: { status: "accepted" },
            isFulfillmentConfirmed: false,
          },
        ],
        vendorFulfillments: [
          {
            vendorId,
            acceptanceStatus: "accepted",
            isFulfillmentConfirmed: false,
          },
        ],
      };

      const Customer = require("../src/models/Customer");
      const orderRepository = require("../src/repositories/order.repository");
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(Customer, "findOne").mockResolvedValue({
        _id: customerId,
        userId,
        isActive: true,
        deletedAt: null,
      });
      jest.spyOn(orderRepository, "findById").mockResolvedValue(mockRawOrder);

      const result = await orderService.getOrderById(mockRawOrder._id.toString(), userId);

      expect(result.customerDisplayStatus).toBe("merchant_accepted");
      expect(result.isAwaitingVendorConfirmation).toBe(false);
      expect(result.isFulfillmentConfirmed).toBe(false);
      expect(result.estimatedDelivery.estimatedDateRange).toBeNull();

      Customer.findOne.mockRestore();
      orderRepository.findById.mockRestore();
    });

    test("9. Multi-vendor order preserves independent package states and merchant names", async () => {
      const vendor1Id = new mongoose.Types.ObjectId();
      const vendor2Id = new mongoose.Types.ObjectId();
      const customerId = new mongoose.Types.ObjectId();
      const deliveryDate1 = new Date("2026-11-09T00:00:00.000Z");

      const mockRawOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TEST-MULTIVENDOR",
        status: "confirmed",
        paymentStatus: "paid",
        customerId,
        items: [
          {
            vendorId: vendor1Id,
            productName: "Vendor 1 Item",
            quantity: 1,
            unitPrice: 500,
            vendorAcceptance: { status: "accepted" },
            isFulfillmentConfirmed: true,
            expectedDeliveryDate: deliveryDate1,
          },
          {
            vendorId: vendor2Id,
            productName: "Vendor 2 Item",
            quantity: 2,
            unitPrice: 800,
            vendorAcceptance: { status: "pending" },
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
        vendorFulfillments: [
          {
            vendorId: vendor1Id,
            acceptanceStatus: "accepted",
            isFulfillmentConfirmed: true,
            expectedDeliveryDate: deliveryDate1,
          },
          {
            vendorId: vendor2Id,
            acceptanceStatus: "pending",
            isFulfillmentConfirmed: false,
            expectedDeliveryDate: null,
          },
        ],
      };

      const Customer = require("../src/models/Customer");
      const orderRepository = require("../src/repositories/order.repository");
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(Customer, "findOne").mockResolvedValue({
        _id: customerId,
        userId,
        isActive: true,
        deletedAt: null,
      });
      jest.spyOn(orderRepository, "findById").mockResolvedValue(mockRawOrder);

      const result = await orderService.getOrderById(mockRawOrder._id.toString(), userId);

      expect(result.vendorPackages).toHaveLength(2);
      expect(result.isAwaitingVendorConfirmation).toBe(true);
      expect(result.isFulfillmentConfirmed).toBe(false);

      const pkg1 = result.vendorPackages.find((p) => p.vendorId === vendor1Id.toString());
      expect(pkg1.acceptanceStatus).toBe("accepted");
      expect(pkg1.isFulfillmentConfirmed).toBe(true);
      expect(pkg1.expectedDeliveryDate).toEqual(deliveryDate1);

      const pkg2 = result.vendorPackages.find((p) => p.vendorId === vendor2Id.toString());
      expect(pkg2.acceptanceStatus).toBe("pending");
      expect(pkg2.isFulfillmentConfirmed).toBe(false);
      expect(pkg2.expectedDeliveryDate).toBeNull();

      Customer.findOne.mockRestore();
      orderRepository.findById.mockRestore();
    });

    test("10. Payment capture records payment verification without fake vendor confirmation", async () => {
      const orderRepository = require("../src/repositories/order.repository");
      const orderId = new mongoose.Types.ObjectId();

      const existingOrder = {
        _id: orderId,
        orderNumber: "BB-TEST-PAYMENT-INTEGRITY",
        status: "pending",
        paymentStatus: "pending",
        grandTotal: 4999,
        currency: "INR",
        timeline: [],
      };

      jest.spyOn(orderRepository, "findById").mockResolvedValue(existingOrder);
      let capturedUpdate = null;
      jest.spyOn(orderRepository, "updateById").mockImplementation(async (id, update) => {
        capturedUpdate = update;
        return { ...existingOrder, ...update };
      });

      await orderService.markOrderPaymentCaptured({
        orderId: orderId.toString(),
        gatewayPaymentId: "pay_test12345",
      });

      expect(capturedUpdate).toBeDefined();
      expect(capturedUpdate.paymentStatus).toBe("paid");

      // Verify timeline events
      const events = capturedUpdate.timeline.map((t) => t.event);
      expect(events).toContain("payment_successful");
      expect(events).toContain("order_payment_verified");
      expect(events).not.toContain("order_confirmed"); // Must NOT contain fake vendor confirmation

      orderRepository.findById.mockRestore();
      orderRepository.updateById.mockRestore();
    });
  });
});
