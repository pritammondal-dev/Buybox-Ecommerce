const mongoose = require("mongoose");
const { encodeCode128, decodeCode128Widths } = require("../../../frontend/src/utils/code128.util");
const {
  VENDOR_FULFILLMENT_SLA,
  calculateOrderFulfillmentTriage,
} = require("../../src/constants/fulfillment-sla.constants");
const {
  SUPPORTED_SHIPMENT_PARTNERS,
  isValidShipmentPartner,
} = require("../../src/constants/shipping.constants");
const { projectVendorOrder } = require("../../src/services/order.service");
const { adminOverrideFulfillment } = require("../../src/services/order-fulfillment.service");
const fulfillmentOperationsService = require("../../src/services/fulfillment-operations.service");
const Order = require("../../src/models/Order");
const AuditLog = require("../../src/models/AuditLog");

describe("Phase VD-06D: Vendor-First Order Management Implementation & Remediation", () => {
  describe("Remediation C: Authentic Machine-Readable Code 128 Barcode", () => {
    test("encodes standard order numbers and shipment references correctly", () => {
      const inputs = [
        "BB-20261101-ABCD",
        "SHP-99238",
        "PS-BB-M3K2-001",
        "ORDER-12345",
      ];

      for (const input of inputs) {
        const result = encodeCode128(input, { moduleWidth: 2, barHeight: 48 });
        expect(result).toBeDefined();
        expect(result.text).toBe(input);
        expect(result.codes[0]).toBe(104); // Start B
        expect(result.codes[result.codes.length - 1]).toBe(106); // Stop
        expect(result.bars.length).toBeGreaterThan(0);
        expect(result.totalWidth).toBeGreaterThan(0);

        // Independent decoding verification
        const decoded = decodeCode128Widths(result.widths);
        expect(decoded.text).toBe(input);
        expect(decoded.checksumValid).toBe(true);
        expect(decoded.checksum).toBe(result.checksum);
      }
    });

    test("generates proper quiet zones (at least 10 modules on each side)", () => {
      const result = encodeCode128("BB-TEST-123", { moduleWidth: 2, quietZoneModules: 10 });
      expect(result.bars[0].x).toBe(20); // 10 * 2
      const lastBar = result.bars[result.bars.length - 1];
      expect(result.totalWidth - (lastBar.x + lastBar.width)).toBeGreaterThanOrEqual(20);
    });

    test("rejects unsupported characters outside ASCII 32-126", () => {
      expect(() => encodeCode128("TEST\u0000")).toThrow();
      expect(() => encodeCode128("")).toThrow();
    });
  });

  describe("Remediation D: Vendor Payment & Financial Transparency", () => {
    test("projects safe payment metadata without exposing secrets, passwords, or cards", () => {
      const vendorAId = new mongoose.Types.ObjectId();
      const vendorBId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-PAY-001",
        status: "processing",
        paymentStatus: "paid",
        paymentMethod: "upi",
        paymentGateway: "razorpay",
        grandTotal: "1500.00",
        placedAt: new Date("2026-11-01T10:00:00Z"),
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            vendorId: vendorAId,
            productName: "Vendor A Item",
            sku: "SKU-A-1",
            quantity: 2,
            unitPrice: "500.00",
            discountTotal: "50.00",
            taxTotal: "45.00",
            lineTotal: "950.00",
            commissionRate: "0.10",
            commissionAmount: "95.00",
            commissionSnapshot: {
              commissionRate: "0.10",
              commissionAmount: "95.00",
              isLocked: true,
            },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            vendorId: vendorBId,
            productName: "Vendor B Item",
            sku: "SKU-B-1",
            quantity: 1,
            unitPrice: "550.00",
            discountTotal: "0.00",
            taxTotal: "0.00",
            lineTotal: "550.00",
            commissionRate: "0.15",
            commissionAmount: "82.50",
          },
        ],
      };

      const mockPayments = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderId: mockOrder._id,
          gateway: "razorpay",
          gatewayPaymentId: "pay_N4zX8901234567",
          amount: "1500.00",
          status: "captured",
          method: "upi",
          capturedAt: new Date("2026-11-01T10:02:00Z"),
        },
      ];

      const projected = projectVendorOrder(mockOrder, vendorAId, [], mockPayments);

      // Verify vendor scoping
      expect(projected.items.length).toBe(1);
      expect(projected.items[0].sku).toBe("SKU-A-1");
      expect(projected.subtotal).toBe("950.00");

      // Verify payment dossier
      expect(projected.payment).toBeDefined();
      expect(projected.payment.method).toBe("upi");
      expect(projected.payment.gateway).toBe("razorpay");
      expect(projected.payment.status).toBe("captured");
      expect(projected.payment.paidAt).toBe("2026-11-01T10:02:00.000Z");
      expect(projected.payment.amountPaid).toBe("1500.00");

      // Verify transaction reference masking
      expect(projected.payment.transactionReference).toBe("pay_***4567");
      expect(projected.payment.transactionReference).not.toBe("pay_N4zX8901234567");

      // Verify financial breakdown based on locked VW-02 snapshot
      expect(projected.financialBreakdown).toBeDefined();
      expect(projected.financialBreakdown.subtotal).toBe("950.00");
      expect(projected.financialBreakdown.discountTotal).toBe("50.00");
      expect(projected.financialBreakdown.taxTotal).toBe("45.00");
      expect(projected.financialBreakdown.commissionTotal).toBe("95.00");
      expect(projected.financialBreakdown.estimatedReceivable).toBe("855.00"); // 950 - 95
      expect(projected.financialBreakdown.isAuthoritative).toBe(true);
    });

    test("handles COD payments properly with collection notice", () => {
      const vendorId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-COD-001",
        status: "confirmed",
        paymentStatus: "pending",
        paymentMethod: "cod",
        grandTotal: "800.00",
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            vendorId,
            sku: "SKU-COD",
            quantity: 1,
            unitPrice: "800.00",
            lineTotal: "800.00",
            commissionRate: "0.10",
            commissionAmount: "80.00",
          },
        ],
      };

      const projected = projectVendorOrder(mockOrder, vendorId, [], []);
      expect(projected.payment.method).toBe("cod");
      expect(projected.payment.gateway).toBe("manual");
      expect(projected.payment.isCod).toBe(true);
      expect(projected.payment.codAmount).toBe("800.00");
      expect(projected.payment.transactionReference).toBe("COD-COLLECT-ON-DELIVERY");
      expect(projected.financialBreakdown.estimatedReceivable).toBe("720.00"); // 800 - 80
    });
  });

  describe("Remediation E: Superadmin Courier Assignment Override", () => {
    test("allows Superadmin to assign supported courier partner with detailed reason", async () => {
      const adminUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "superadmin",
      };
      const vendorId = new mongoose.Types.ObjectId();

      const orderDoc = new Order({
        orderNumber: "BB-OVERRIDE-01",
        status: "confirmed",
        paymentStatus: "paid",
        fulfillmentVersion: 1,
        items: [
          {
            vendorId,
            productId: new mongoose.Types.ObjectId(),
            sku: "SKU-OVERRIDE",
            productName: "Test Item",
            quantity: 1,
            unitPrice: "100.00",
            lineTotal: "100.00",
            vendorAcceptance: { status: "accepted" },
          },
        ],
        vendorFulfillments: [
          {
            vendorId,
            acceptanceStatus: "accepted",
            version: 1,
          },
        ],
      });

      const orderService = require("../../src/services/order.service");
      jest.spyOn(orderService, "getAdminOrderById").mockImplementation(async () => orderDoc);
      jest.spyOn(Order, "findById").mockResolvedValue(orderDoc);
      jest.spyOn(orderDoc, "save").mockResolvedValue(orderDoc);
      jest.spyOn(AuditLog, "create").mockResolvedValue({});

      const result = await adminOverrideFulfillment({
        adminUser,
        orderId: orderDoc._id.toString(),
        vendorId: vendorId.toString(),
        action: "assign_courier",
        partnerId: "delhivery",
        partnerName: "Delhivery Express",
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        overrideReason: "Vendor dispatch facility request: assigned Delhivery courier",
      });

      expect(orderDoc.items[0].assignedShipmentPartner).toBeDefined();
      expect(orderDoc.items[0].assignedShipmentPartner.partnerId).toBe("delhivery");
      expect(orderDoc.fulfillmentVersion).toBe(2);

      const timelineEvent = orderDoc.timeline.find(
        (t) => t.event === "admin_fulfillment_override_assign_courier"
      );
      expect(timelineEvent).toBeDefined();
      expect(timelineEvent.metadata.partnerId).toBe("delhivery");

      Order.findById.mockRestore();
    });

    test("rejects unsupported courier partner", async () => {
      const adminUser = { _id: new mongoose.Types.ObjectId(), role: "superadmin" };
      const orderDoc = new Order({
        orderNumber: "BB-ERR-01",
        status: "confirmed",
        items: [],
      });
      jest.spyOn(Order, "findById").mockResolvedValue(orderDoc);

      await expect(
        adminOverrideFulfillment({
          adminUser,
          orderId: orderDoc._id.toString(),
          action: "assign_courier",
          partnerId: "fake_unsupported_express",
          overrideReason: "Testing invalid partner",
        })
      ).rejects.toThrow(/Unsupported shipment partner/);

      Order.findById.mockRestore();
    });

    test("rejects override with reason shorter than 5 characters", async () => {
      const adminUser = { _id: new mongoose.Types.ObjectId(), role: "superadmin" };
      await expect(
        adminOverrideFulfillment({
          adminUser,
          orderId: new mongoose.Types.ObjectId().toString(),
          action: "assign_courier",
          partnerId: "delhivery",
          overrideReason: "no",
        })
      ).rejects.toThrow(/min 5 characters/);
    });

    test("rejects override when optimistic concurrency version conflict occurs", async () => {
      const adminUser = { _id: new mongoose.Types.ObjectId(), role: "superadmin" };
      const orderDoc = new Order({
        orderNumber: "BB-CONFLICT-01",
        status: "confirmed",
        fulfillmentVersion: 3,
        items: [],
      });
      jest.spyOn(Order, "findById").mockResolvedValue(orderDoc);

      await expect(
        adminOverrideFulfillment({
          adminUser,
          orderId: orderDoc._id.toString(),
          action: "assign_courier",
          partnerId: "delhivery",
          expectedVersion: 1, // Stale version!
          overrideReason: "Overriding courier partner",
        })
      ).rejects.toThrow(/Order fulfillment conflict/);

      Order.findById.mockRestore();
    });
  });

  describe("Remediation F: Vendor Inactivity SLA & Triage Engine", () => {
    test("flags orders exceeding 24h acceptance SLA accurately", () => {
      const vendorId = new mongoose.Types.ObjectId();
      const placedAt = new Date(Date.now() - 30 * 3600 * 1000); // 30 hours ago (>24h SLA)

      const mockOrder = {
        orderNumber: "BB-SLA-01",
        status: "pending",
        placedAt,
        items: [
          {
            vendorId,
            sku: "SKU-SLA-1",
            vendorAcceptance: { status: "pending" },
          },
        ],
      };

      const triage = calculateOrderFulfillmentTriage(mockOrder);
      expect(triage).toBeDefined();
      expect(triage.isOverdue).toBe(true);
      expect(triage.stage).toBe("pending_acceptance");
      expect(triage.triageStatus).toBe("sla_breached");
      expect(triage.elapsedHours).toBeGreaterThanOrEqual(29.9);
      expect(triage.hoursOverdue).toBeGreaterThanOrEqual(5.9);
      expect(triage.recommendedAction).toContain("Acceptance SLA breached");
    });

    test("does not flag orders within the 24h acceptance window", () => {
      const vendorId = new mongoose.Types.ObjectId();
      const placedAt = new Date(Date.now() - 5 * 3600 * 1000); // 5 hours ago (<24h SLA)

      const mockOrder = {
        orderNumber: "BB-SLA-02",
        status: "pending",
        placedAt,
        items: [
          {
            vendorId,
            sku: "SKU-SLA-2",
            vendorAcceptance: { status: "pending" },
          },
        ],
      };

      const triage = calculateOrderFulfillmentTriage(mockOrder);
      expect(triage.isOverdue).toBe(false);
      expect(triage.triageStatus).toBe("pending_action");
      expect(triage.stage).toBe("pending_acceptance");
      expect(triage.hoursOverdue).toBe(0);
    });

    test("flags vendor rejection as immediate intervention required", () => {
      const vendorId = new mongoose.Types.ObjectId();
      const mockOrder = {
        orderNumber: "BB-REJECT-01",
        status: "confirmed",
        placedAt: new Date(),
        items: [
          {
            vendorId,
            sku: "SKU-REJ",
            vendorAcceptance: { status: "rejected", rejectionReason: "Stock damaged" },
          },
        ],
      };

      const triage = calculateOrderFulfillmentTriage(mockOrder);
      expect(triage.isOverdue).toBe(true);
      expect(triage.triageStatus).toBe("intervention_required");
      expect(triage.stage).toBe("rejected_items");
    });

    test("completed and cancelled orders report normal terminal status", () => {
      const mockOrder = {
        orderNumber: "BB-TERM-01",
        status: "completed",
        items: [],
      };
      const triage = calculateOrderFulfillmentTriage(mockOrder);
      expect(triage.isOverdue).toBe(false);
      expect(triage.triageStatus).toBe("normal");
    });
  });

  describe("Remediation B: Packing Slip Tenant Isolation", () => {
    test("rejects vendor requesting packing slip for an order with zero assigned items", async () => {
      const vendorOwnerId = new mongoose.Types.ObjectId();
      const otherVendorUser = {
        _id: new mongoose.Types.ObjectId(),
        role: "vendor",
        vendorId: new mongoose.Types.ObjectId(), // Different vendor!
      };

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "BB-TENANT-01",
        shippingAddress: { fullName: "Customer" },
        items: [
          {
            vendorId: vendorOwnerId,
            sku: "SKU-OWNER",
            productName: "Owner Product",
            quantity: 1,
          },
        ],
      };

      const OrderModel = require("../../src/models/Order");
      jest.spyOn(OrderModel, "findById").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrder),
          }),
        }),
      });

      await expect(
        fulfillmentOperationsService.getPackingSlip({
          orderId: mockOrder._id.toString(),
          user: otherVendorUser,
        })
      ).rejects.toThrow(/Order not found or no items authorized for this vendor/);

      OrderModel.findById.mockRestore();
    });
  });
});
