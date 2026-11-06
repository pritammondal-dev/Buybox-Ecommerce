const mongoose = require("mongoose");

const {
  checkOrderReturnEligibility,
  previewReturnRefund,
  createReturnRequest,
  processReturnRefund,
  generateCreditNoteForReturn,
} = require("../src/services/return-request.service");
const refundService = require("../src/services/refund.service");
const financialLedgerService = require("../src/services/financial-ledger.service");

// Mock dependencies
jest.mock("../src/models/Order");
jest.mock("../src/models/Customer");
jest.mock("../src/models/Product");
jest.mock("../src/models/ProductVariant");
jest.mock("../src/models/Vendor");
jest.mock("../src/models/Shipment");
jest.mock("../src/models/ReturnRequest");
jest.mock("../src/models/Refund");
jest.mock("../src/models/CreditNote");
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
jest.mock("../src/repositories/payment.repository", () => ({
  findLatestByOrderId: jest.fn().mockResolvedValue({
    _id: "672b1234567890abcdef1234",
    gatewayPaymentId: "pay_confirmed_001",
    gateway: "razorpay",
    status: "captured",
    amount: "30794.46",
    refundedAmount: "0.00",
  }),
}));
jest.mock("../src/services/refund.service", () => ({
  createRefund: jest.fn(),
}));

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
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Vendor = require("../src/models/Vendor");
const Shipment = require("../src/models/Shipment");
const ReturnRequest = require("../src/models/ReturnRequest");
const Refund = require("../src/models/Refund");
const CreditNote = require("../src/models/CreditNote");

describe("Phase POSTPURCHASE-107: Gross Customer-Paid Refund & GST Under-Refund Remediation", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const orderItemId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const buildTargetOrder = () => ({
    _id: orderId,
    orderNumber: "BB-MVYUVP0S-4CF64623",
    customerId,
    status: "delivered",
    deliveredAt: new Date(),
    currency: "INR",
    paymentMethod: "prepaid",
    grandTotal: mongoose.Types.Decimal128.fromString("30794.46"),
    shippingTotal: mongoose.Types.Decimal128.fromString("99.00"),
    shippingAddress: {
      fullName: "Pritam Mondal",
      phone: "07810866098",
      addressLine1: "Greater Kolkata area",
      city: "Kolkata",
      state: "WB",
      postalCode: "743428",
      country: "IN",
    },
    taxSnapshot: {
      jurisdictionCountry: "IN",
      jurisdictionState: "WB",
      itemsTaxTotal: mongoose.Types.Decimal128.fromString("4679.64"),
      shippingTaxTotal: mongoose.Types.Decimal128.fromString("17.82"),
      totalTax: mongoose.Types.Decimal128.fromString("4697.46"),
      pricingMode: "tax_exclusive",
    },
    taxSummary: { pricingMode: "tax_exclusive", totalTax: mongoose.Types.Decimal128.fromString("4697.46") },
    items: [
      {
        _id: orderItemId,
        productId,
        productName: "Acoustic Pro Wireless Noise-Cancelling Headphones",
        sku: "SOC-AUDIO-ANC-700-SLV",
        quantity: 2,
        unitPrice: mongoose.Types.Decimal128.fromString("12999.00"),
        lineTotal: mongoose.Types.Decimal128.fromString("25998.00"),
        discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
        taxTotal: mongoose.Types.Decimal128.fromString("4679.64"),
        fulfillmentStatus: "delivered",
        deliveredAt: new Date(),
        vendorId,
        taxDetails: {
          taxRuleId: new mongoose.Types.ObjectId(),
          ruleName: "Standard GST (18%)",
          jurisdictionCountry: "IN",
          jurisdictionState: "WB",
          taxRate: mongoose.Types.Decimal128.fromString("18.00"),
          taxCategory: "standard",
          pricingMode: "tax_exclusive",
        },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();

    Customer.findOne.mockResolvedValue({
      _id: customerId,
      userId,
      email: "buyer@buybox.test",
      firstName: "Pritam",
      lastName: "Mondal",
    });

    Refund.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Shipment.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          status: "delivered",
          deliveredAt: new Date(),
          items: [{ productId, quantity: 2, orderItemId }],
        },
      ]),
    });

    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    ReturnRequest.create.mockImplementation((doc) =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        save: jest.fn().mockResolvedValue(true),
      })
    );

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: productId,
          name: "Acoustic Pro Wireless Noise-Cancelling Headphones",
          productType: "physical",
          isVirtual: false,
          isDownloadable: false,
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

    refundService.createRefund.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      status: "processed",
      amount: "15397.23",
      gatewayRefundId: "rfnd_test_001",
    });

    CreditNote.findOne.mockResolvedValue(null);
    CreditNote.create.mockImplementation((cn) => Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...cn }));
  });

  // 1. Full Quantity Refund Including GST
  it("1. should refund 100% of customer-paid payment (₹30,794.46) including GST for full 2 units with zero deductions", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    const preview = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 2 }],
    });

    expect(preview.estimatedRefundTotal).toBe("30794.46");
    expect(preview.productAmountTotal).toBe("25998.00");
    expect(preview.taxRefundTotal).toBe("4697.46");
    expect(preview.shippingRefundTotal).toBe("99.00");
    expect(preview.customerDeductionsTotal).toBe("0.00");

    // Verify creation
    const ret = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 2, reason: "defective" }],
    });

    expect(ret.refundAmount.toString()).toBe("30794.46");
    expect(ret.taxRefundTotal.toString()).toBe("4697.46");
    expect(ret.customerDeductionsTotal.toString()).toBe("0.00");
  });

  // 2. Single-Unit Partial Refund Including GST
  it("2. should calculate exactly ₹15,397.23 (not ₹12,999.00) for returning 1 unit of order BB-MVYUVP0S-4CF64623", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    const preview = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });

    // Invariant: Expected refund must be ₹15,397.23, NOT ₹12,999.00
    expect(preview.estimatedRefundTotal).toBe("15397.23");
    expect(preview.estimatedRefundTotal).not.toBe("12999.00");
    expect(preview.items[0].unitCustomerPaid).toBe("15397.23");
    expect(preview.items[0].productAmount).toBe("12999.00");
    expect(preview.items[0].taxRefund).toBe("2348.73");
    expect(preview.items[0].shippingRefund).toBe("49.50");
    expect(preview.items[0].customerDeductions).toBe("0.00");
  });

  // 3. Refund Including Allocated Delivery Charges
  it("3. should explicitly include allocated delivery charges in refundable entitlement", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    const preview = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });

    expect(Number(preview.shippingRefundTotal)).toBe(49.50);
    const sumBreakdown =
      Number(preview.productAmountTotal) +
      Number(preview.taxRefundTotal) +
      Number(preview.shippingRefundTotal);
    expect(sumBreakdown.toFixed(2)).toBe("15397.23");
  });

  // 4. Multiple Partial Returns
  it("4. should handle sequential partial returns (1 unit + 1 unit) summing to exact captured ₹30,794.46 without paise drift", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    // Return 1: 1 unit
    const ret1 = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 1, reason: "defective" }],
    });
    expect(ret1.refundAmount.toString()).toBe("15397.23");

    // Mock that Return 1 is already in DB when Return 2 arrives
    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: ret1._id,
          orderId,
          status: "approved",
          items: [
            {
              orderItemId,
              productId,
              quantity: 1,
              customerPaidAmount: mongoose.Types.Decimal128.fromString("15397.23"),
              taxRefund: mongoose.Types.Decimal128.fromString("2339.82"),
            },
          ],
        },
      ]),
    });

    // Return 2: final remaining 1 unit
    const preview2 = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });
    expect(preview2.estimatedRefundTotal).toBe("15397.23");

    const ret2 = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 1, reason: "quality_issue" }],
    });
    expect(ret2.refundAmount.toString()).toBe("15397.23");

    const totalRefundPaise =
      Math.round(Number(ret1.refundAmount.toString()) * 100) +
      Math.round(Number(ret2.refundAmount.toString()) * 100);
    expect(totalRefundPaise).toBe(3079446); // Exact match
  });

  // 5. Final Residual Paise Allocation
  it("5. should allocate exact residual paise on final unit without loss or surplus on odd division", async () => {
    const oddOrder = buildTargetOrder();
    // 1001 paise (₹10.01) total for 2 items
    oddOrder.grandTotal = mongoose.Types.Decimal128.fromString("10.01");
    oddOrder.items[0].lineTotal = mongoose.Types.Decimal128.fromString("8.48");
    oddOrder.items[0].taxTotal = mongoose.Types.Decimal128.fromString("1.53");
    oddOrder.taxSnapshot.totalTax = mongoose.Types.Decimal128.fromString("1.53");

    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(oddOrder),
    });

    const ret1 = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 1, reason: "defective" }],
    });
    // First unit: Math.round(1001 / 2) = 501 paise = ₹5.01
    expect(ret1.refundAmount.toString()).toBe("5.01");

    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: ret1._id,
          orderId,
          status: "approved",
          items: [{ orderItemId, productId, quantity: 1, customerPaidAmount: ret1.refundAmount }],
        },
      ]),
    });

    // Second unit: Residual: 1001 - 501 = 500 paise = ₹5.00
    const ret2 = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 1, reason: "defective" }],
    });
    expect(ret2.refundAmount.toString()).toBe("5.00");

    const sumPaise =
      Math.round(Number(ret1.refundAmount.toString()) * 100) +
      Math.round(Number(ret2.refundAmount.toString()) * 100);
    expect(sumPaise).toBe(1001);
  });

  // 6. Zero Customer Deductions
  it("6. should enforce zero customer deductions: no restocking, handling, GST, or platform fee deductions", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    const preview = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });

    expect(preview.customerDeductionsTotal).toBe("0.00");
    expect(preview.items[0].deductions).toBe("0.00");

    const ret = await createReturnRequest({
      orderId,
      userId,
      items: [{ orderItemId, productId, quantity: 1, reason: "defective" }],
    });

    expect(ret.customerDeductionsTotal.toString()).toBe("0.00");
  });

  // 7. Frontend/Backend Estimate Equality
  it("7. should ensure preview API estimate and eligibility effectiveUnitPaid match exactly", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    const eligibility = await checkOrderReturnEligibility({ orderId, userId });
    const eligibleItem = eligibility.items[0];

    const preview = await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });

    expect(eligibleItem.effectiveUnitPaid).toBe(preview.estimatedRefundTotal);
    expect(eligibleItem.effectiveUnitPaid).toBe("15397.23");
  });

  // 8. Gateway Refund Amount Equality
  it("8. should pass exact 1,539,723 integer paise to Razorpay when executing 1-unit refund", async () => {
    const order = buildTargetOrder();
    Order.findById.mockResolvedValue(order);

    const mockReturn = {
      _id: new mongoose.Types.ObjectId(),
      returnNumber: "RET-20261106-001",
      orderId,
      vendorId,
      status: "approved",
      refundAmount: mongoose.Types.Decimal128.fromString("15397.23"),
      refundMethod: "original_source",
      save: jest.fn().mockResolvedValue(true),
    };

    ReturnRequest.findById.mockResolvedValue(mockReturn);

    await processReturnRefund({
      returnRequestId: mockReturn._id,
      userId,
      isAdmin: true,
    });

    expect(refundService.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        amount: "15397.23",
      })
    );
  });

  // 9. Duplicate Refund Prevention
  it("9. should return existing refund idempotently without creating duplicate disbursement", async () => {
    const order = buildTargetOrder();
    Order.findById.mockResolvedValue(order);

    const existingRefundId = new mongoose.Types.ObjectId();
    const mockReturn = {
      _id: new mongoose.Types.ObjectId(),
      returnNumber: "RET-IDEM-001",
      orderId,
      vendorId,
      status: "approved",
      refundId: existingRefundId,
      refundAmount: mongoose.Types.Decimal128.fromString("15397.23"),
      refundMethod: "original_source",
      save: jest.fn().mockResolvedValue(true),
    };

    ReturnRequest.findById.mockResolvedValue(mockReturn);
    Refund.findById.mockResolvedValue({
      _id: existingRefundId,
      status: "processed",
      amount: mongoose.Types.Decimal128.fromString("15397.23"),
    });

    const result = await processReturnRefund({
      returnRequestId: mockReturn._id,
      userId,
      isAdmin: true,
    });

    expect(result.status).toBe("refunded");
    expect(refundService.createRefund).not.toHaveBeenCalled();
  });

  // 10. Previously Refunded Quantity Exclusion
  it("10. should reject return request when requested quantity exceeds remaining returnable quantity", async () => {
    const order = buildTargetOrder();
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          orderId,
          status: "approved",
          items: [{ orderItemId, productId, quantity: 2 }],
        },
      ]),
    });

    await expect(
      createReturnRequest({
        orderId,
        userId,
        items: [{ orderItemId, productId, quantity: 1, reason: "defective" }],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "QUANTITY_EXCEEDED",
    });
  });

  // 11. Historical Order Snapshot Immutability
  it("11. should strictly preserve original order pricing snapshot without modifying unitPrice or lineTotal", async () => {
    const order = buildTargetOrder();
    const originalUnitPrice = order.items[0].unitPrice.toString();
    const originalLineTotal = order.items[0].lineTotal.toString();

    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order),
    });

    await previewReturnRefund({
      orderId,
      userId,
      items: [{ orderItemId, quantity: 1 }],
    });

    // Invariant: original snapshot unchanged
    expect(order.items[0].unitPrice.toString()).toBe(originalUnitPrice);
    expect(order.items[0].lineTotal.toString()).toBe(originalLineTotal);
    expect(order.grandTotal.toString()).toBe("30794.46");
  });

  // 12. Correct GST Credit Note Allocation
  it("12. should generate GST credit note with totalAmount equal to gross customer refund and zero deductions", async () => {
    const order = buildTargetOrder();
    const mockReturn = {
      _id: new mongoose.Types.ObjectId(),
      returnNumber: "RET-CN-001",
      orderId,
      customerId,
      vendorId,
      refundAmount: mongoose.Types.Decimal128.fromString("15397.23"),
      taxRefundTotal: mongoose.Types.Decimal128.fromString("2339.82"),
      netItemRefundTotal: mongoose.Types.Decimal128.fromString("12999.00"),
      items: [
        {
          orderItemId,
          productId,
          quantity: 1,
          customerPaidAmount: mongoose.Types.Decimal128.fromString("15397.23"),
          taxRefund: mongoose.Types.Decimal128.fromString("2339.82"),
          taxBreakdown: {
            cgst: mongoose.Types.Decimal128.fromString("1169.91"),
            sgst: mongoose.Types.Decimal128.fromString("1169.91"),
            igst: mongoose.Types.Decimal128.fromString("0.00"),
          },
        },
      ],
    };

    const cn = await generateCreditNoteForReturn(mockReturn, order);
    expect(cn).toBeDefined();
    expect(cn.totalAmount.toString()).toBe("15397.23");
    expect(cn.taxAmount.toString()).toBe("2339.82");
    expect(cn.taxableAmount.toString()).toBe("12999.00");
  });
});
