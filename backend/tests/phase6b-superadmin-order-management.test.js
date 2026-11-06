const mongoose = require("mongoose");

jest.mock("../src/models/Order");
jest.mock("../src/models/AuditLog");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/Payment");
jest.mock("../src/repositories/order.repository");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/payment.service");

const Order = require("../src/models/Order");
const Shipment = require("../src/models/Shipment");
const Payment = require("../src/models/Payment");
const orderService = require("../src/services/order.service");
const fulfillmentOperationsService = require("../src/services/fulfillment-operations.service");

describe("Phase 6B — Superadmin Order Management: Payment, Delivery, Breakdown & Packing Slip", () => {
  const orderId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorAId = new mongoose.Types.ObjectId();
  const vendorBId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();

  const superAdminUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    role: "super_admin",
    email: "superadmin@buybox.test",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // SECTION 1: CUSTOMER PAYMENT DETAILS VISIBILITY & SECURITY
  // ==========================================================================
  describe("1. Customer Payment Details Visibility & Security", () => {
    test("1.1 Successful online payment: captures gateway, transactionId, amountPaid, amountDue 0, and sanitized history", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-2026-ONLINE",
        status: "confirmed",
        paymentStatus: "paid",
        placedAt: new Date("2026-09-01T10:00:00.000Z"),
        grandTotal: { $numberDecimal: "2499.00" },
        subtotal: { $numberDecimal: "2300.00" },
        taxTotal: { $numberDecimal: "149.00" },
        shippingTotal: { $numberDecimal: "50.00" },
        items: [],
        timeline: [],
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderId,
        method: "upi",
        gateway: "razorpay",
        status: "captured",
        amount: { $numberDecimal: "2499.00" },
        currency: "INR",
        gatewayOrderId: "order_MTO9F7OP_rzp",
        gatewayPaymentId: "pay_K98xZa710Bq",
        refundedAmount: { $numberDecimal: "0.00" },
        capturedAt: new Date("2026-09-01T10:05:00.000Z"),
        paymentSecret: "sk_live_secret_must_not_leak",
        rawWebhookPayload: { privateKey: "hidden_token" },
        history: [
          { status: "initiated", timestamp: new Date("2026-09-01T10:00:30.000Z"), note: "UPI checkout open" },
          { status: "captured", timestamp: new Date("2026-09-01T10:05:00.000Z"), note: "Payment authorized and settled" },
        ],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockPayment]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res).toBeDefined();
      expect(res.paymentDetails).toBeDefined();
      expect(res.paymentDetails.method).toBe("upi");
      expect(res.paymentDetails.gateway).toBe("razorpay");
      expect(res.paymentDetails.status).toBe("captured");
      expect(res.paymentDetails.transactionId).toBe("pay_K98xZa710Bq");
      expect(res.paymentDetails.amountPaid).toBe("2499.00");
      expect(res.paymentDetails.amountDue).toBe("0.00");
      expect(res.paymentDetails.amountRefunded).toBe("0.00");
      expect(res.paymentDetails.capturedAt).toBe(mockPayment.capturedAt.toISOString());

      // Security check: no credentials or raw secrets leak
      expect(res.paymentDetails).not.toHaveProperty("paymentSecret");
      expect(res.paymentDetails).not.toHaveProperty("rawWebhookPayload");
      expect(res.paymentDetails.history).toHaveLength(1);
    });

    test("1.2 Cash on Delivery (COD): marks amountPaid 0 and amountDue equals grandTotal", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-2026-COD",
        status: "processing",
        paymentStatus: "pending",
        placedAt: new Date("2026-09-05T12:00:00.000Z"),
        grandTotal: { $numberDecimal: "850.00" },
        items: [],
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderId,
        method: "cod",
        gateway: "manual",
        status: "pending",
        amount: { $numberDecimal: "850.00" },
        refundedAmount: { $numberDecimal: "0.00" },
        history: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockPayment]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.paymentDetails.method).toBe("cod");
      expect(res.paymentDetails.status).toBe("pending");
      expect(res.paymentDetails.amountPaid).toBe("0.00");
      expect(res.paymentDetails.amountDue).toBe("850.00");
    });

    test("1.3 Partially refunded order: accurately reflects amountRefunded and remaining balance", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-2026-REFUND",
        status: "confirmed",
        paymentStatus: "partially_refunded",
        grandTotal: { $numberDecimal: "3000.00" },
        items: [],
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderId,
        method: "card",
        gateway: "stripe",
        status: "partially_refunded",
        amount: { $numberDecimal: "3000.00" },
        refundedAmount: { $numberDecimal: "1000.00" },
        gatewayPaymentId: "ch_3Mv8sP2eZvKYlo2C",
        capturedAt: new Date("2026-09-02T10:00:00.000Z"),
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockPayment]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.paymentDetails.status).toBe("partially_refunded");
      expect(res.paymentDetails.amountRefunded).toBe("1000.00");
      expect(res.financialBreakdown.amountRefunded).toBe("1000.00");
    });

    test("1.4 Missing payment record: reports truthful fallback without fabricating fake gateways or card numbers", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-LEGACY-NOPAY",
        status: "pending",
        paymentStatus: "unpaid",
        grandTotal: { $numberDecimal: "500.00" },
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.paymentDetails.method).toBe("Unrecorded");
      expect(res.paymentDetails.gateway).toBe("N/A");
      expect(res.paymentDetails.status).toBe("unpaid");
      expect(res.paymentDetails.amountPaid).toBe("0.00");
      expect(res.paymentDetails.amountDue).toBe("500.00");
    });
  });

  // ==========================================================================
  // SECTION 2: ESTIMATED DELIVERY DATE CALCULATION & LIFECYCLE
  // ==========================================================================
  describe("2. Estimated Delivery Date Calculation & Lifecycle", () => {
    test("2.1 Persisted delivery option: calculates authoritative date range from order placed date", async () => {
      const placedDate = new Date("2026-09-01T10:00:00.000Z");
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-DELIV-EST",
        status: "processing",
        placedAt: placedDate,
        createdAt: placedDate,
        grandTotal: { $numberDecimal: "1200.00" },
        deliveryOption: {
          name: "Standard Ground Delivery",
          estimatedDays: { min: 4, max: 7 },
        },
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.estimatedDelivery).toBeDefined();
      expect(res.estimatedDelivery.deliveryOptionName).toBe("Standard Ground Delivery");
      expect(res.estimatedDelivery.estimatedDays).toEqual({ min: 4, max: 7 });
      expect(res.estimatedDelivery.estimatedDateRange).toContain("2026");
      expect(res.estimatedDelivery.isDelivered).toBe(false);
      expect(res.estimatedDelivery.isCancelled).toBe(false);
    });

    test("2.2 Delivered order: marks isDelivered true and surfaces actual delivered timestamp", async () => {
      const deliveredDate = new Date("2026-09-06T15:30:00.000Z");
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-DELIVERED",
        status: "delivered",
        deliveredAt: deliveredDate,
        deliveryOption: {
          name: "Express Air",
          estimatedDays: { min: 2, max: 3 },
        },
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.estimatedDelivery.isDelivered).toBe(true);
      expect(res.estimatedDelivery.actualDeliveredAt).toBe(deliveredDate.toISOString());
    });

    test("2.3 Cancelled order: indicates isCancelled true without fabricating false carrier delivery", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-CANCELLED",
        status: "cancelled",
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.estimatedDelivery.isCancelled).toBe(true);
      expect(res.estimatedDelivery.estimatedDateRange).toBeNull();
    });

    test("2.4 Order without delivery options: returns Estimated delivery unavailable honestly", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-NO-DELIV-OPTS",
        status: "confirmed",
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.estimatedDelivery.estimatedDateRange).toBe("Estimated delivery unavailable");
      expect(res.estimatedDelivery.deliveryOptionName).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION 3: COMPLETE FINANCIAL BREAKDOWN & RECONCILIATION
  // ==========================================================================
  describe("3. Complete Financial Breakdown & Reconciliation", () => {
    test("3.1 Order with coupon: validates couponDiscount, productDiscounts, tax, and full reconciliation", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-COUPON-2026",
        status: "confirmed",
        paymentStatus: "paid",
        subtotal: { $numberDecimal: "3000.00" },
        discountTotal: { $numberDecimal: "500.00" },
        taxTotal: { $numberDecimal: "225.00" },
        shippingTotal: { $numberDecimal: "100.00" },
        grandTotal: { $numberDecimal: "2825.00" },
        coupon: {
          code: "FESTIVE500",
          discountAmount: { $numberDecimal: "500.00" },
        },
        pricingMode: "tax_exclusive",
        taxSnapshot: [
          { taxType: "CGST", rate: 4.5, amount: { $numberDecimal: "112.50" } },
          { taxType: "SGST", rate: 4.5, amount: { $numberDecimal: "112.50" } },
        ],
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Mechanical Keyboard",
            sku: "TECH-KB-01",
            quantity: 1,
            unitPrice: { $numberDecimal: "3000.00" },
            lineTotal: { $numberDecimal: "2500.00" },
            discountTotal: { $numberDecimal: "500.00" },
            taxTotal: { $numberDecimal: "225.00" },
          },
        ],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      const fb = res.financialBreakdown;
      expect(fb).toBeDefined();
      expect(fb.subtotal).toBe("3000.00");
      expect(fb.couponCode).toBe("FESTIVE500");
      expect(fb.couponDiscount).toBe("500.00");
      expect(fb.shippingTotal).toBe("100.00");
      expect(fb.taxTotal).toBe("225.00");
      expect(fb.grandTotal).toBe("2825.00");
      expect(fb.handlingFee).toBe("0.00");
      expect(fb.packagingFee).toBe("0.00");
      expect(fb.reconciliationStatus).toBe("reconciled");
      expect(fb.isReconciled).toBe(true);
      expect(fb.reconciliationDelta).toBe("0.00");
      expect(fb.calculatedGrandTotal).toBe("2825.00");

      // Tax snapshot verification
      expect(fb.taxSnapshot).toHaveLength(2);
      expect(fb.taxSnapshot[0].taxType).toBe("CGST");
      expect(fb.taxSnapshot[0].amount).toBe("112.50");
    });

    test("3.2 Multi-vendor order: line items maintain vendor attribution while order total remains unified", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-MULTIVENDOR",
        status: "confirmed",
        subtotal: { $numberDecimal: "5000.00" },
        discountTotal: { $numberDecimal: "0.00" },
        taxTotal: { $numberDecimal: "450.00" },
        shippingTotal: { $numberDecimal: "150.00" },
        grandTotal: { $numberDecimal: "5600.00" },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Vendor A Item",
            sku: "VA-001",
            quantity: 1,
            unitPrice: { $numberDecimal: "2000.00" },
            lineTotal: { $numberDecimal: "2000.00" },
            vendorId: { _id: vendorAId, storeName: "Vendor Alpha", businessName: "Alpha Ltd" },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Vendor B Item",
            sku: "VB-001",
            quantity: 1,
            unitPrice: { $numberDecimal: "3000.00" },
            lineTotal: { $numberDecimal: "3000.00" },
            vendorId: { _id: vendorBId, storeName: "Vendor Beta", businessName: "Beta Corp" },
          },
        ],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      expect(res.items).toHaveLength(2);
      expect(res.items[0].vendor.name).toBe("Vendor Alpha");
      expect(res.items[1].vendor.name).toBe("Vendor Beta");
      expect(res.financialBreakdown.grandTotal).toBe("5600.00");
      expect(res.financialBreakdown.reconciliationStatus).toBe("reconciled");
      expect(res.financialBreakdown.isReconciled).toBe(true);
      expect(res.financialBreakdown.reconciliationDelta).toBe("0.00");
    });

    test("3.3 Deliberately mismatched order: detects discrepancy and reports reconciliationStatus mismatch with exact delta", async () => {
      // Subtotal 1000 - discount 100 + ship 50 + tax 90 = 1040, but stored grandTotal is corrupted to 1090 (+50 discrepancy)
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-MISMATCH-TEST",
        status: "confirmed",
        subtotal: { $numberDecimal: "1000.00" },
        discountTotal: { $numberDecimal: "100.00" },
        taxTotal: { $numberDecimal: "90.00" },
        shippingTotal: { $numberDecimal: "50.00" },
        grandTotal: { $numberDecimal: "1090.00" }, // Mismatched
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      const fb = res.financialBreakdown;
      expect(fb.reconciliationStatus).toBe("mismatch");
      expect(fb.isReconciled).toBe(false);
      expect(fb.reconciliationDelta).toBe("50.00");
      expect(fb.calculatedGrandTotal).toBe("1040.00");
      expect(fb.grandTotal).toBe("1090.00");
    });

    test("3.4 Incomplete legacy order: missing subtotal or grandTotal yields insufficient_data without false reconciliation", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-INCOMPLETE-LEGACY",
        status: "pending",
        // subtotal and grandTotal missing
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      const fb = res.financialBreakdown;
      expect(fb.reconciliationStatus).toBe("insufficient_data");
      expect(fb.isReconciled).toBe(false);
      expect(fb.reconciliationDelta).toBe("N/A");
      expect(fb.calculatedGrandTotal).toBe("N/A");
    });

    test("3.5 Tax-inclusive pricing mode: items include tax, preventing double counting of tax in reconciliation", async () => {
      // Subtotal 2000 (tax inclusive) - discount 200 + ship 100 = 1900. taxTotal is 300 embedded.
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-TAX-INCLUSIVE",
        status: "confirmed",
        pricingMode: "tax_inclusive",
        subtotal: { $numberDecimal: "2000.00" },
        discountTotal: { $numberDecimal: "200.00" },
        taxTotal: { $numberDecimal: "300.00" }, // Embedded in subtotal
        shippingTotal: { $numberDecimal: "100.00" },
        grandTotal: { $numberDecimal: "1900.00" },
        items: [],
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      const fb = res.financialBreakdown;
      expect(fb.pricingMode).toBe("tax_inclusive");
      expect(fb.reconciliationStatus).toBe("reconciled");
      expect(fb.isReconciled).toBe(true);
      expect(fb.reconciliationDelta).toBe("0.00");
      expect(fb.calculatedGrandTotal).toBe("1900.00");
    });

    test("3.6 Payment settlement reconciliation: refunds and partial payments update settlement status while keeping order total immutable", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-SETTLEMENT-RECON",
        status: "confirmed",
        paymentStatus: "partially_refunded",
        subtotal: { $numberDecimal: "4000.00" },
        discountTotal: { $numberDecimal: "0.00" },
        taxTotal: { $numberDecimal: "360.00" },
        shippingTotal: { $numberDecimal: "40.00" },
        grandTotal: { $numberDecimal: "4400.00" },
        items: [],
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderId,
        method: "upi",
        gateway: "razorpay",
        status: "partially_refunded",
        amount: { $numberDecimal: "4400.00" },
        refundedAmount: { $numberDecimal: "1000.00" },
      };

      Order.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrder),
      });
      Shipment.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Payment.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockPayment]),
      });

      const res = await orderService.getAdminOrderById(orderId.toString());

      const fb = res.financialBreakdown;
      // Order total reconciliation remains independent and reconciled
      expect(fb.reconciliationStatus).toBe("reconciled");
      expect(fb.isReconciled).toBe(true);
      expect(fb.reconciliationDelta).toBe("0.00");
      expect(fb.calculatedGrandTotal).toBe("4400.00");
      expect(fb.grandTotal).toBe("4400.00");

      // Payment settlement reconciliation reflects partial refund
      expect(fb.paymentSettlementStatus).toBe("partially_refunded");
      expect(fb.amountPaid).toBe("4400.00");
      expect(fb.amountRefunded).toBe("1000.00");
      expect(fb.amountDue).toBe("0.00");
    });
  });

  // ==========================================================================
  // SECTION 4: PACKING SLIP AUTHORIZATION & ENRICHED DATA
  // ==========================================================================
  describe("4. Packing Slip Authorization & Fulfillment Document Generation", () => {
    test("4.1 Superadmin with role 'super_admin' successfully fetches order packing slip with seller/merchant identification", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "BB-ORD-PACKING-SLIP",
        status: "confirmed",
        placedAt: new Date("2026-09-10T14:00:00.000Z"),
        shippingAddress: {
          fullName: "Priya Sharma",
          street: "123 Indiranagar 100ft Rd",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560038",
          country: "India",
          phone: "+91 9876543210",
        },
        warehouseId: {
          _id: warehouseId,
          name: "Bengaluru Central Hub",
          code: "WH-BLR-01",
          city: "Bengaluru",
        },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productName: "Cotton Linen Shirt",
            variantName: "Blue / XL",
            sku: "SHIRT-BLU-XL",
            quantity: 2,
            warehouseId: {
              _id: warehouseId,
              name: "Bengaluru Central Hub",
              code: "WH-BLR-01",
            },
            vendorId: {
              _id: vendorAId,
              businessName: "LinenCraft India",
              storeName: "LinenCraft",
            },
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

      const slip = await fulfillmentOperationsService.getPackingSlip({
        orderId: orderId.toString(),
        user: superAdminUser,
      });

      expect(slip).toBeDefined();
      expect(slip.orderNumber).toBe("BB-ORD-PACKING-SLIP");
      expect(slip.recipient.fullName).toBe("Priya Sharma");
      expect(slip.recipient.city).toBe("Bengaluru");
      expect(slip.warehouse.name).toBe("Bengaluru Central Hub");
      expect(slip.items).toHaveLength(1);
      expect(slip.items[0].sku).toBe("SHIRT-BLU-XL");
      expect(slip.items[0].merchantName).toBe("LinenCraft");
      expect(slip.items[0].quantity).toBe(2);
      expect(slip.totalQuantity).toBe(2);

      // Financial & sensitive data redaction verification
      expect(slip).not.toHaveProperty("cardDetails");
      expect(slip).not.toHaveProperty("paymentSecret");
      expect(slip).not.toHaveProperty("couponCode");
    });
  });
});
