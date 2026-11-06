const mongoose = require("mongoose");
const crypto = require("crypto");

const {
  processReturnRefund,
  createReturnRequest,
  getReturnSlaStatus,
} = require("../src/services/return-request.service");
const { processRefundWebhook } = require("../src/services/refund-webhook.service");
const financialLedgerService = require("../src/services/financial-ledger.service");
const { verifyRazorpayWebhookSignature } = require("../src/utils/razorpayWebhook");
const refundService = require("../src/services/refund.service");

// Mock dependencies
jest.mock("../src/models/Order");
jest.mock("../src/models/Customer");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/Refund");
jest.mock("../src/models/Warehouse");
jest.mock("../src/models/Inventory");
jest.mock("../src/models/AuditLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/VendorWallet", () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/storefront-settings.service", () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/customer-notification.service", () => ({
  createCustomerNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/notification", () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
  sendRefundConfirmation: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/reward.service", () => ({
  adjustPointsForCancelledOrRefundedOrder: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/repositories/payment.repository");
jest.mock("../src/repositories/refund.repository");
jest.mock("../src/repositories/order.repository");

jest.mock("../src/repositories/financial-ledger.repository", () => ({
  findByJournalId: jest.fn().mockResolvedValue([]),
  findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  createMany: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
  findVendorAllEntries: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/models/FinancialLedgerEntry", () => ({
  findOne: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue(null),
  }),
  find: jest.fn().mockReturnValue({
    session: jest.fn().mockResolvedValue([]),
  }),
  aggregate: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((entries) => Promise.resolve(entries)),
}));

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn) => fn()),
};
jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

const Order = require("../src/models/Order");
const Customer = require("../src/models/Customer");
const User = require("../src/models/User");
const ReturnRequest = require("../src/models/ReturnRequest");
const Refund = require("../src/models/Refund");
const Shipment = require("../src/models/Shipment");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Vendor = require("../src/models/Vendor");

const paymentRepository = require("../src/repositories/payment.repository");
const refundRepository = require("../src/repositories/refund.repository");
const orderRepository = require("../src/repositories/order.repository");

describe("Phase REFUND-101: Refund Production Integrity, Razorpay Reconciliation & End-to-End Acceptance", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const returnRequestId = new mongoose.Types.ObjectId();
  const refundId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      email: "customer@buybox.test",
      firstName: "Pritam",
      lastName: "Mondal",
    });

    Customer.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: customerId,
        userId,
        email: "customer@buybox.test",
        firstName: "Pritam",
        lastName: "Mondal",
      }),
    });

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: userId,
          email: "customer@buybox.test",
          firstName: "Pritam",
          lastName: "Mondal",
        }),
      }),
    });

    Refund.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Refund.findOne.mockResolvedValue(null);
    Refund.findById.mockResolvedValue(null);

    Shipment.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    ReturnRequest.create.mockImplementation((data) =>
      Promise.resolve({
        ...data,
        _id: new mongoose.Types.ObjectId(),
      })
    );

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          name: "Acoustic Pro Wireless Noise-Cancelling Headphones",
          productType: "physical",
        }),
      }),
    });

    ProductVariant.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    Vendor.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: vendorId,
          businessAddress: { state: "WB", country: "IN" },
        }),
      }),
    });
  });

  const buildTargetOrder = () => {
    const orderItemId = new mongoose.Types.ObjectId();
    return {
      _id: orderId,
      orderNumber: "BB-MVYUVP0S-4CF64623",
      customerId,
      status: "delivered",
      paymentStatus: "captured",
      deliveredAt: new Date(),
      grandTotal: mongoose.Types.Decimal128.fromString("30794.46"),
      shippingTotal: mongoose.Types.Decimal128.fromString("99.00"),
      currency: "INR",
      shippingAddress: {
        fullName: "Pritam Mondal",
        phone: "07810866098",
        state: "WB",
        country: "IN",
      },
      items: [
        {
          _id: orderItemId,
          productId: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId(),
          name: "Acoustic Pro Wireless Noise-Cancelling Headphones",
          sku: "AUD-APW-001",
          quantity: 2,
          unitPrice: mongoose.Types.Decimal128.fromString("12999.00"),
          lineTotal: mongoose.Types.Decimal128.fromString("25998.00"),
          itemCustomerPaidTotal: mongoose.Types.Decimal128.fromString("30794.46"),
          taxDetails: { pricingMode: "tax_inclusive", jurisdictionState: "WB" },
          vendorId,
          fulfillmentStatus: "delivered",
          returnStatus: "approved",
          commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
        },
      ],
      timeline: [],
      save: jest.fn().mockResolvedValue(true),
    };
  };

  const buildTargetReturnRequest = (mockOrder) => ({
    _id: returnRequestId,
    returnNumber: "RET-MW3ABC12-4CF64623",
    orderId: mockOrder._id,
    customerId: mockOrder.customerId,
    vendorId,
    type: "return",
    status: "inspected",
    refundMethod: "original_source",
    refundAmount: mongoose.Types.Decimal128.fromString("30794.46"),
    refundAmountMinor: 3079446,
    items: [
      {
        orderItemId: mockOrder.items[0]._id,
        productId: mockOrder.items[0].productId,
        quantity: 2,
        customerPaidAmount: mongoose.Types.Decimal128.fromString("30794.46"),
      },
    ],
    timeline: [],
    save: jest.fn().mockResolvedValue(true),
  });

  const buildTargetPayment = () => ({
    _id: paymentId,
    orderId,
    customerId,
    gateway: "razorpay",
    gatewayPaymentId: "pay_TvCZo3fZhLsefQ",
    amount: "30794.46",
    currency: "INR",
    status: "captured",
    refundedAmount: "0.00",
    refundReservedAmount: "0.00",
  });

  describe("1. Full Razorpay Refund Execution & Minor-Unit Paise Integrity", () => {
    test("1.1 processReturnRefund initiates exact integer minor units (3079446 paise) and links ret.refundId", async () => {
      const mockOrder = buildTargetOrder();
      const mockRet = buildTargetReturnRequest(mockOrder);
      const mockPayment = buildTargetPayment();

      ReturnRequest.findById.mockResolvedValue(mockRet);
      Order.findById.mockResolvedValue(mockOrder);
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      const spyCreateRefund = jest.spyOn(refundService, "createRefund").mockResolvedValue({
        _id: refundId,
        orderId,
        paymentId,
        gateway: "razorpay",
        amount: "30794.46",
        status: "processed",
        processedAt: new Date(),
      });

      try {
        const result = await processReturnRefund({
          userId,
          returnId: mockRet._id.toString(),
          notes: "Admin approved customer refund",
          isAdmin: true,
        });

        expect(spyCreateRefund).toHaveBeenCalledTimes(1);
        const [callArg] = spyCreateRefund.mock.calls[0];
        expect(callArg.orderId.toString()).toBe(orderId.toString());
        expect(callArg.amount).toBe("30794.46");
        expect(callArg.reason).toBe("Admin approved customer refund");

        expect(mockRet.status).toBe("refunded");
        expect(mockRet.refundId).toEqual(refundId);
        expect(mockRet.save).toHaveBeenCalled();
        expect(mockOrder.items[0].returnStatus).toBe("returned");
      } finally {
        spyCreateRefund.mockRestore();
      }
    });
  });

  describe("2. Gateway Timeout & Pending State Handling", () => {
    test("2.1 gateway pending response moves return request to refund_pending without marking refunded", async () => {
      const mockOrder = buildTargetOrder();
      const mockRet = buildTargetReturnRequest(mockOrder);
      const mockPayment = buildTargetPayment();

      ReturnRequest.findById.mockResolvedValue(mockRet);
      Order.findById.mockResolvedValue(mockOrder);
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      const pendingRefundDoc = {
        _id: refundId,
        orderId,
        paymentId,
        gateway: "razorpay",
        amount: "30794.46",
        status: "pending",
        processedAt: null,
      };

      const spyCreateRefund = jest.spyOn(refundService, "createRefund").mockResolvedValue(pendingRefundDoc);

      try {
        const result = await processReturnRefund({
          userId,
          returnId: mockRet._id.toString(),
          isAdmin: true,
        });

        expect(mockRet.status).toBe("refund_pending");
        expect(mockRet.refundId).toEqual(refundId);
        expect(mockRet.resolutionNotes).toBe("Refund pending gateway settlement");
        expect(mockRet.save).toHaveBeenCalled();
      } finally {
        spyCreateRefund.mockRestore();
      }
    });
  });

  describe("3. Duplicate Refund Submission Idempotency", () => {
    test("3.1 returns existing refund idempotently when return request already has an active refund", async () => {
      const mockOrder = buildTargetOrder();
      const mockRet = buildTargetReturnRequest(mockOrder);
      mockRet.refundId = refundId;

      ReturnRequest.findById.mockResolvedValue(mockRet);
      Order.findById.mockResolvedValue(mockOrder);

      const existingRefund = {
        _id: refundId,
        orderId,
        paymentId,
        gateway: "razorpay",
        amount: "30794.46",
        status: "processed",
      };

      Refund.findById.mockResolvedValue(existingRefund);
      Refund.findOne.mockResolvedValue(existingRefund);
      const spyCreateRefund = jest.spyOn(refundService, "createRefund");

      try {
        const result = await processReturnRefund({
          userId,
          returnId: mockRet._id.toString(),
          isAdmin: true,
        });

        expect(spyCreateRefund).not.toHaveBeenCalled();
        expect(mockRet.status).toBe("refunded");
        expect(result._id).toEqual(mockRet._id);
      } finally {
        spyCreateRefund.mockRestore();
      }
    });
  });

  describe("4. Asynchronous Webhook refund.processed Lifecycle & Ledger Reversal", () => {
    test("4.1 webhook transitions refund_pending to refunded and posts double-entry financial ledger journal", async () => {
      const mockOrder = buildTargetOrder();
      const mockPayment = buildTargetPayment();
      const mockRefund = {
        _id: refundId,
        orderId: mockOrder._id,
        paymentId: mockPayment._id,
        gateway: "razorpay",
        gatewayRefundId: "rfnd_test101_proc",
        amount: "30794.46",
        status: "pending",
      };

      refundRepository.findByGatewayRefundId.mockResolvedValue(mockRefund);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      orderRepository.findById.mockResolvedValue(mockOrder);
      refundRepository.updateById.mockResolvedValue({
        ...mockRefund,
        status: "processed",
        processedAt: new Date(),
      });
      paymentRepository.releaseRefundReservation.mockResolvedValue(mockPayment);
      paymentRepository.updateById.mockResolvedValue({
        ...mockPayment,
        status: "refunded",
        refundedAmount: "30794.46",
      });
      orderRepository.updateById.mockResolvedValue({
        ...mockOrder,
        paymentStatus: "refunded",
      });
      refundRepository.findByPaymentId.mockResolvedValue([
        { ...mockRefund, status: "processed" },
      ]);

      ReturnRequest.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const spyPostJournal = jest.spyOn(financialLedgerService, "postRefundReversalJournal").mockResolvedValue([]);

      try {
        const webhookPayload = {
          event: "refund.processed",
          payload: {
            refund: {
              entity: {
                id: "rfnd_test101_proc",
                payment_id: "pay_TvCZo3fZhLsefQ",
                amount: 3079446,
                currency: "INR",
                status: "processed",
                created_at: 1730870000,
              },
            },
          },
        };

        const result = await processRefundWebhook({
          eventType: "refund.processed",
          payload: webhookPayload,
        });

        expect(result.processed).toBe(true);
        expect(result.refundStatus).toBe("processed");
        expect(refundRepository.updateById).toHaveBeenCalledWith(
          refundId,
          expect.objectContaining({ status: "processed" }),
          expect.anything()
        );
        expect(ReturnRequest.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            $or: [
              { refundId: mockRefund._id },
              { orderId: mockOrder._id, status: "refund_pending" },
            ],
          }),
          expect.objectContaining({
            $set: expect.objectContaining({ status: "refunded" }),
          }),
          expect.anything()
        );

        expect(spyPostJournal).toHaveBeenCalledWith(
          expect.objectContaining({ _id: refundId, status: "processed" }),
          expect.objectContaining({
            orderDoc: mockOrder,
            vendorId,
            isSettled: false,
          })
        );
      } finally {
        spyPostJournal.mockRestore();
      }
    });
  });

  describe("5. Asynchronous Webhook refund.failed Lifecycle & Escalation", () => {
    test("5.1 webhook updates return request timeline with failure reason and releases reservation", async () => {
      const mockOrder = buildTargetOrder();
      const mockPayment = buildTargetPayment();
      const mockRefund = {
        _id: refundId,
        orderId: mockOrder._id,
        paymentId: mockPayment._id,
        gateway: "razorpay",
        gatewayRefundId: "rfnd_test101_fail",
        amount: "30794.46",
        status: "pending",
      };

      refundRepository.findByGatewayRefundId.mockResolvedValue(mockRefund);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      orderRepository.findById.mockResolvedValue(mockOrder);
      refundRepository.updateById.mockResolvedValue({
        ...mockRefund,
        status: "failed",
        failureReason: "Card issuing bank declined refund",
      });
      paymentRepository.releaseRefundReservation.mockResolvedValue(mockPayment);
      paymentRepository.updateById.mockResolvedValue(mockPayment);
      orderRepository.updateById.mockResolvedValue(mockOrder);
      refundRepository.findByPaymentId.mockResolvedValue([]);

      ReturnRequest.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const webhookPayload = {
        event: "refund.failed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test101_fail",
              payment_id: "pay_TvCZo3fZhLsefQ",
              amount: 3079446,
              currency: "INR",
              status: "failed",
              error_description: "Card issuing bank declined refund",
            },
          },
        },
      };

      const result = await processRefundWebhook({
        eventType: "refund.failed",
        payload: webhookPayload,
      });

      expect(result.processed).toBe(true);
      expect(result.refundStatus).toBe("failed");
      expect(paymentRepository.releaseRefundReservation).toHaveBeenCalledWith(
        mockPayment._id,
        mockRefund.amount,
        expect.anything()
      );
      expect(ReturnRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { refundId: mockRefund._id },
            { orderId: mockOrder._id, status: "refund_pending" },
          ],
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            resolutionNotes: expect.stringContaining("Card issuing bank declined refund"),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe("6. Duplicate Webhook Delivery Idempotency", () => {
    test("6.1 duplicate refund.processed returns ignored/target state without re-execution", async () => {
      const mockOrder = buildTargetOrder();
      const mockPayment = buildTargetPayment();
      const mockRefund = {
        _id: refundId,
        orderId: mockOrder._id,
        paymentId: mockPayment._id,
        gateway: "razorpay",
        gatewayRefundId: "rfnd_test101_dup",
        amount: "30794.46",
        status: "processed",
      };

      refundRepository.findByGatewayRefundId.mockResolvedValue(mockRefund);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      orderRepository.findById.mockResolvedValue(mockOrder);

      const webhookPayload = {
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test101_dup",
              payment_id: "pay_TvCZo3fZhLsefQ",
              amount: 3079446,
              currency: "INR",
              status: "processed",
            },
          },
        },
      };

      const result = await processRefundWebhook({
        eventType: "refund.processed",
        payload: webhookPayload,
      });

      expect(result.processed).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe("REFUND_ALREADY_IN_TARGET_STATE");
      expect(refundRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("7. Out-of-Order Webhook Delivery Protection", () => {
    test("7.1 stale refund.created arriving after refund.processed is safely ignored", async () => {
      const mockOrder = buildTargetOrder();
      const mockPayment = buildTargetPayment();
      const mockRefund = {
        _id: refundId,
        orderId: mockOrder._id,
        paymentId: mockPayment._id,
        gateway: "razorpay",
        gatewayRefundId: "rfnd_test101_stale",
        amount: "30794.46",
        status: "processed",
      };

      refundRepository.findByGatewayRefundId.mockResolvedValue(mockRefund);
      paymentRepository.findById.mockResolvedValue(mockPayment);
      orderRepository.findById.mockResolvedValue(mockOrder);

      const webhookPayload = {
        event: "refund.created",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test101_stale",
              payment_id: "pay_TvCZo3fZhLsefQ",
              amount: 3079446,
              currency: "INR",
              status: "pending",
            },
          },
        },
      };

      const result = await processRefundWebhook({
        eventType: "refund.created",
        payload: webhookPayload,
      });

      expect(result.processed).toBe(true);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe("INVALID_OR_STALE_REFUND_TRANSITION");
      expect(refundRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("8. Webhook Signature Verification Hardening", () => {
    const secret = "test_webhook_secret_1234567890123456";
    const bodyStr = JSON.stringify({ event: "refund.processed", test: true });
    const rawBody = Buffer.from(bodyStr, "utf8");

    test("8.1 accepts valid HMAC-SHA256 signature with constant-time equality", () => {
      const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const isValid = verifyRazorpayWebhookSignature(rawBody, signature, secret);
      expect(isValid).toBe(true);
    });

    test("8.2 rejects non-Buffer payload with 400 INVALID_WEBHOOK_BODY", () => {
      const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      expect(() => {
        verifyRazorpayWebhookSignature(bodyStr, signature, secret);
      }).toThrow(expect.objectContaining({ code: "INVALID_WEBHOOK_BODY", statusCode: 400 }));
    });

    test("8.3 rejects invalid or tampered signature with 401 INVALID_WEBHOOK_SIGNATURE", () => {
      const forgedSig = crypto.createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");
      expect(() => {
        verifyRazorpayWebhookSignature(rawBody, forgedSig, secret);
      }).toThrow(expect.objectContaining({ code: "INVALID_WEBHOOK_SIGNATURE", statusCode: 401 }));
    });

    test("8.4 rejects unconfigured webhook secret with 500 WEBHOOK_SECRET_NOT_CONFIGURED", () => {
      const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      expect(() => {
        verifyRazorpayWebhookSignature(rawBody, signature, "");
      }).toThrow(expect.objectContaining({ code: "WEBHOOK_SECRET_NOT_CONFIGURED", statusCode: 500 }));
    });
  });

  describe("9. Missing Payment Record or Missing Gateway ID Protection", () => {
    test("9.1 missing payment record throws PAYMENT_NOT_FOUND and does not false-refund", async () => {
      const mockOrder = buildTargetOrder();
      const mockRet = buildTargetReturnRequest(mockOrder);

      ReturnRequest.findById.mockResolvedValue(mockRet);
      Order.findById.mockResolvedValue(mockOrder);
      paymentRepository.findLatestByOrderId.mockResolvedValue(null);

      await expect(
        processReturnRefund({
          userId,
          returnId: mockRet._id.toString(),
          isAdmin: true,
        })
      ).rejects.toThrow(expect.objectContaining({ code: "PAYMENT_NOT_FOUND" }));

      expect(mockRet.status).not.toBe("refunded");
      expect(mockOrder.paymentStatus).not.toBe("partially_refunded");
    });

    test("9.2 missing gatewayPaymentId throws PAYMENT_GATEWAY_ID_MISSING", async () => {
      const mockOrder = buildTargetOrder();
      const mockRet = buildTargetReturnRequest(mockOrder);
      const mockPayment = buildTargetPayment();
      mockPayment.gatewayPaymentId = null;

      ReturnRequest.findById.mockResolvedValue(mockRet);
      Order.findById.mockResolvedValue(mockOrder);
      paymentRepository.findLatestByOrderId.mockResolvedValue(mockPayment);

      await expect(
        processReturnRefund({
          userId,
          returnId: mockRet._id.toString(),
          isAdmin: true,
        })
      ).rejects.toThrow(expect.objectContaining({ code: "PAYMENT_GATEWAY_ID_MISSING" }));

      expect(mockRet.status).not.toBe("refunded");
      expect(mockOrder.paymentStatus).not.toBe("partially_refunded");
    });
  });

  describe("10. Cumulative Ceiling Enforcement (<= Captured Payment)", () => {
    test("10.1 in-flight pending refunds reserve balance and prevent over-refunding", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockResolvedValue(mockOrder);

      // Refund of 30794.46 (entire order balance) is already pending
      Refund.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            amount: mongoose.Types.Decimal128.fromString("30794.46"),
            status: "pending",
          },
        ]),
      });

      // Customer attempts to return full item worth 30794.46
      // Remaining balance is 0, so it throws EXCEEDS_ORDER_TOTAL
      await expect(
        createReturnRequest({
          userId,
          orderId: orderId.toString(),
          type: "return",
          items: [
            {
              orderItemId: mockOrder.items[0]._id.toString(),
              productId: mockOrder.items[0].productId.toString(),
              quantity: 2,
              reason: "defective",
            },
          ],
        })
      ).rejects.toThrow(expect.objectContaining({ code: "EXCEEDS_ORDER_TOTAL" }));
    });

    test("10.2 partial in-flight refund clamps refund amount to remaining balance", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockResolvedValue(mockOrder);

      // Refund of 20000 is pending
      Refund.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            amount: mongoose.Types.Decimal128.fromString("20000.00"),
            status: "pending",
          },
        ]),
      });

      // Customer returns 2 units (full value 30794.46), but refund is clamped to remaining 10794.46
      const res = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: mockOrder.items[0]._id.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 2,
            reason: "defective",
          },
        ],
      });

      expect(Number(res.refundAmount.toString())).toBe(10794.46);
    });
  });

  describe("11. Double-Entry Ledger Journal Balance (0 Paise Variance)", () => {
    test("11.1 postRefundReversalJournal balances mathematically to exactly 0 paise variance", async () => {
      const mockRefundDoc = {
        _id: refundId,
        orderId,
        amount: mongoose.Types.Decimal128.fromString("30794.46"),
        currency: "INR",
      };

      const mockOrderDoc = {
        _id: orderId,
        items: [
          {
            vendorId,
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
          },
        ],
      };

      const entries = await financialLedgerService.postRefundReversalJournal(mockRefundDoc, {
        orderDoc: mockOrderDoc,
        vendorId,
        isSettled: false,
        actorId: userId,
      });

      expect(entries).toBeDefined();
      expect(entries).toHaveLength(3);

      const debits = entries.filter((e) => e.direction === "debit");
      const credits = entries.filter((e) => e.direction === "credit");

      const totalDebitPaise = debits.reduce(
        (sum, e) => sum + Math.round(Number(e.amount.toString()) * 100),
        0
      );
      const totalCreditPaise = credits.reduce(
        (sum, e) => sum + Math.round(Number(e.amount.toString()) * 100),
        0
      );

      expect(totalDebitPaise).toBe(3079446);
      expect(totalCreditPaise).toBe(3079446);
      expect(totalDebitPaise - totalCreditPaise).toBe(0);

      const customerOutflow = entries.find((e) => e.accountCode === "refund_clearing");
      expect(customerOutflow).toBeDefined();
      expect(Number(customerOutflow.amount.toString())).toBe(30794.46);

      const commissionReversal = entries.find((e) => e.accountCode === "commission_reversal");
      expect(commissionReversal).toBeDefined();

      const vendorDebit = entries.find((e) => e.accountCode === "vendor_pending_earnings");
      expect(vendorDebit).toBeDefined();

      const commPaise = Math.round(Number(commissionReversal.amount.toString()) * 100);
      const vendorPaise = Math.round(Number(vendorDebit.amount.toString()) * 100);
      expect(commPaise + vendorPaise).toBe(3079446);
    });
  });
});
