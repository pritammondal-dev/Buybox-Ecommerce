const mongoose = require("mongoose");

const {
  checkOrderReturnEligibility,
  createReturnRequest,
  processReturnRefund,
  getReturnSlaStatus,
} = require("../src/services/return-request.service");
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

describe("Phase REFUND-100: Full Customer-Paid Refund & Zero-Deduction Verification", () => {
  const userId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();

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
      lean: jest.fn().mockResolvedValue([]),
    });

    ReturnRequest.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Product.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
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
  });

  describe("1. Target Real Order Verification (BB-MVYUVP0S-4CF64623)", () => {
    const buildTargetOrder = () => {
      const orderItemId = new mongoose.Types.ObjectId();
      return {
        _id: orderId,
        orderNumber: "BB-MVYUVP0S-4CF64623",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
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
            productId: new mongoose.Types.ObjectId(),
            productName: "Acoustic Pro Wireless Noise-Cancelling Headphones",
            sku: "SOC-AUDIO-ANC-700-SLV",
            quantity: 2,
            unitPrice: mongoose.Types.Decimal128.fromString("12999.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("25998.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("4679.64"),
            taxDetails: {
              taxRuleId: new mongoose.Types.ObjectId(),
              ruleName: "Standard GST (18%)",
              jurisdictionCountry: "IN",
              jurisdictionState: "WB",
              taxCategory: "standard",
              isTaxable: true,
              pricingMode: "tax_exclusive",
              taxRate: mongoose.Types.Decimal128.fromString("18.00"),
              taxableBase: mongoose.Types.Decimal128.fromString("25998.00"),
              taxAmount: mongoose.Types.Decimal128.fromString("4679.64"),
            },
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
    };

    test("1.1 checkOrderReturnEligibility allocates full customer-paid amount (₹15,397.23 unit, ₹30,794.46 total)", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOrder),
      });

      const res = await checkOrderReturnEligibility({
        orderId: orderId.toString(),
        userId,
      });

      expect(res.isOrderEligible).toBe(true);
      expect(res.items).toHaveLength(1);
      const itemRes = res.items[0];

      // Must report ₹15,397.23 effectiveUnitPaid (customer-paid per unit)
      expect(itemRes.effectiveUnitPaid).toBe("15397.23");
      // Must report ₹30,794.46 itemCustomerPaidTotal (full customer-paid total)
      expect(itemRes.itemCustomerPaidTotal).toBe("30794.46");
      // Preserves original catalog snapshots
      expect(itemRes.unitPrice).toBe("12999.00");
      expect(itemRes.lineTotal).toBe("25998.00");
      // Reports full tax including allocated shipping tax
      expect(itemRes.taxTotal).toBe("4697.46");
    });

    test("1.2 Full return (2 of 2 units) refunds 100% of customer captured payment (₹30,794.46) with ZERO deductions", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockResolvedValue(mockOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

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
            condition: "opened_unused",
          },
        ],
      });

      expect(res).toBeDefined();
      // Total customer refund must equal 30794.46 exactly (100% of captured payment)
      expect(Number(res.refundAmount.toString())).toBe(30794.46);
      // Net base item refund: 26097.00 (25998.00 base + 99.00 shipping)
      expect(Number(res.netItemRefundTotal.toString())).toBe(26097.0);
      // Tax refund: 4697.46 (4679.64 item tax + 17.82 shipping tax)
      expect(Number(res.taxRefundTotal.toString())).toBe(4697.46);

      // Reconciles exactly: 26097.00 + 4697.46 === 30794.46
      expect(
        Number(res.netItemRefundTotal.toString()) + Number(res.taxRefundTotal.toString())
      ).toBe(30794.46);

      const itemRes = res.items[0];
      expect(Number(itemRes.customerPaidAmount.toString())).toBe(30794.46);
      expect(Number(itemRes.taxRefund.toString())).toBe(4697.46);

      // Intra-state WB -> WB: 50% CGST + 50% SGST
      // 469,746 paise / 2 = 234,873 paise each (₹2,348.73)
      expect(Number(itemRes.taxBreakdown.cgst.toString())).toBe(2348.73);
      expect(Number(itemRes.taxBreakdown.sgst.toString())).toBe(2348.73);
      expect(Number(itemRes.taxBreakdown.igst.toString())).toBe(0.0);
    });

    test("1.3 Partial return (1 of 2 units) refunds exact 50% customer-paid allocation (₹15,397.23)", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockResolvedValue(mockOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

      const res = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: mockOrder.items[0]._id.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "damaged",
            condition: "opened_unused",
          },
        ],
      });

      expect(res).toBeDefined();
      // Exactly 50% of 3,079,446 paise = 1,539,723 paise = ₹15,397.23
      expect(Number(res.refundAmount.toString())).toBe(15397.23);
      // Net base item refund: 13,048.50
      expect(Number(res.netItemRefundTotal.toString())).toBe(13048.5);
      // Tax refund: 2,348.73 (50% of 4,697.46)
      expect(Number(res.taxRefundTotal.toString())).toBe(2348.73);

      // Reconciles exactly: 13048.50 + 2348.73 === 15397.23
      expect(
        Number(res.netItemRefundTotal.toString()) + Number(res.taxRefundTotal.toString())
      ).toBe(15397.23);

      const itemRes = res.items[0];
      expect(Number(itemRes.customerPaidAmount.toString())).toBe(15397.23);
      expect(Number(itemRes.taxRefund.toString())).toBe(2348.73);

      // Intra-state tax split for 234,873 paise:
      // CGST = 117,436 paise (₹1,174.36), SGST = 117,437 paise (₹1,174.37)
      expect(Number(itemRes.taxBreakdown.cgst.toString())).toBe(1174.36);
      expect(Number(itemRes.taxBreakdown.sgst.toString())).toBe(1174.37);
      expect(Number(itemRes.taxBreakdown.igst.toString())).toBe(0.0);
    });

    test("1.4 Two sequential partial returns (1 unit + 1 unit) sum to exactly ₹30,794.46 with zero paise drift", async () => {
      const mockOrder = buildTargetOrder();
      Order.findById.mockResolvedValue(mockOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

      // First return: 1 unit
      const res1 = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: mockOrder.items[0]._id.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });
      expect(Number(res1.refundAmount.toString())).toBe(15397.23);

      // Mock prior return existence for 2nd request
      ReturnRequest.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            status: "requested",
            items: [
              {
                orderItemId: mockOrder.items[0]._id,
                productId: mockOrder.items[0].productId,
                quantity: 1,
                customerPaidAmount: mongoose.Types.Decimal128.fromString("15397.23"),
                taxRefund: mongoose.Types.Decimal128.fromString("2348.73"),
              },
            ],
          },
        ]),
      });

      // Second return: remaining 1 unit
      const res2 = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: mockOrder.items[0]._id.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });
      expect(Number(res2.refundAmount.toString())).toBe(15397.23);

      // Verify exact sum of the two returns equals 30,794.46
      const totalRefundMinor =
        Math.round(Number(res1.refundAmount.toString()) * 100) +
        Math.round(Number(res2.refundAmount.toString()) * 100);
      expect(totalRefundMinor).toBe(3079446);
    });
  });

  describe("2. Comprehensive Financial Rules & Invariants", () => {
    test("2.1 Multi-item order with shipping allocates shipping proportionally to each item", async () => {
      // Item A: 1 unit @ 1000 + 18% tax (180) = 1180
      // Item B: 1 unit @ 2000 + 18% tax (360) = 2360
      // Shipping: 100 + 18% tax (18) = 118
      // Grand Total = 1180 + 2360 + 118 = 3658.00
      const itemAId = new mongoose.Types.ObjectId();
      const itemBId = new mongoose.Types.ObjectId();
      const multiOrder = {
        _id: orderId,
        orderNumber: "ORD-MULTI-SHIP",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("3658.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("100.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSnapshot: {
          itemsTaxTotal: mongoose.Types.Decimal128.fromString("540.00"),
          shippingTaxTotal: mongoose.Types.Decimal128.fromString("18.00"),
          totalTax: mongoose.Types.Decimal128.fromString("558.00"),
          pricingMode: "tax_exclusive",
        },
        taxSummary: { pricingMode: "tax_exclusive", totalTax: mongoose.Types.Decimal128.fromString("558.00") },
        items: [
          {
            _id: itemAId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Item A",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            taxDetails: { pricingMode: "tax_exclusive", jurisdictionState: "WB" },
            vendorId,
            fulfillmentStatus: "delivered",
          },
          {
            _id: itemBId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Item B",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("360.00"),
            taxDetails: { pricingMode: "tax_exclusive", jurisdictionState: "WB" },
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(multiOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

      // Return only Item A:
      // Item A direct = 1180. Total direct = 3540. Ratio = 1180 / 3540 = 1/3
      // Order level charge = 3658 - 3540 = 118. Item A gets round(118 * 1/3) = 39.33 -> 39.33 (3933 paise)
      // Item A customer paid = 118,000 + 3,933 = 121,933 paise = 1219.33
      const resA = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: itemAId.toString(),
            productId: multiOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });

      expect(Number(resA.refundAmount.toString())).toBe(1219.33);
      // Zero deductions applied! Customer gets full paid share.
    });

    test("2.2 Order with coupon discount refunds net paid amount, not undiscounted base", async () => {
      // 1 unit @ 2000 - 200 coupon = 1800 net base + 324 (18% tax) = 2124.00
      const orderItemId = new mongoose.Types.ObjectId();
      const discOrder = {
        _id: orderId,
        orderNumber: "ORD-DISCOUNTED",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("2124.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSummary: { pricingMode: "tax_exclusive", totalTax: mongoose.Types.Decimal128.fromString("324.00") },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Discounted Item",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("2000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("2000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("200.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("324.00"),
            taxDetails: { pricingMode: "tax_exclusive", jurisdictionState: "WB" },
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(discOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

      const res = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: orderItemId.toString(),
            productId: discOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });

      // Customer paid 2124.00 (not 2360.00)
      expect(Number(res.refundAmount.toString())).toBe(2124.0);
      expect(Number(res.netItemRefundTotal.toString())).toBe(1800.0);
      expect(Number(res.taxRefundTotal.toString())).toBe(324.0);
    });

    test("2.3 Inter-state return allocates 100% of tax refund to IGST (0 CGST, 0 SGST)", async () => {
      const orderItemId = new mongoose.Types.ObjectId();
      const interStateOrder = {
        _id: orderId,
        orderNumber: "ORD-INTERSTATE",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "KA", country: "IN" }, // Karnataka (inter-state from WB vendor)
        taxSummary: { pricingMode: "tax_exclusive", totalTax: mongoose.Types.Decimal128.fromString("180.00") },
        items: [
          {
            _id: orderItemId,
            productId: new mongoose.Types.ObjectId(),
            productName: "Interstate Product",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            taxDetails: { pricingMode: "tax_exclusive", jurisdictionState: "WB" },
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(interStateOrder);

      ReturnRequest.create.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          _id: new mongoose.Types.ObjectId(),
        })
      );

      const res = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        items: [
          {
            orderItemId: orderItemId.toString(),
            productId: interStateOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "damaged",
          },
        ],
      });

      expect(Number(res.refundAmount.toString())).toBe(1180.0);
      const itemRes = res.items[0];
      expect(Number(itemRes.taxBreakdown.igst.toString())).toBe(180.0);
      expect(Number(itemRes.taxBreakdown.cgst.toString())).toBe(0.0);
      expect(Number(itemRes.taxBreakdown.sgst.toString())).toBe(0.0);
    });

    test("2.4 Double-entry financial ledger journal balances exactly to ₹30,794.46 with zero customer deduction", async () => {
      const refundDoc = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        amount: mongoose.Types.Decimal128.fromString("30794.46"),
        currency: "INR",
      };

      const orderDoc = {
        _id: orderId,
        items: [
          {
            vendorId,
            commissionRate: mongoose.Types.Decimal128.fromString("0.10"),
          },
        ],
      };

      const entries = await financialLedgerService.postRefundReversalJournal(refundDoc, {
        orderDoc,
        vendorId,
        isSettled: false,
        actorId: userId,
      });

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(3);

      const debits = entries.filter((e) => e.direction === "debit");
      const credits = entries.filter((e) => e.direction === "credit");

      const totalDebitMinor = debits.reduce(
        (sum, e) => sum + Math.round(Number(e.amount.toString()) * 100),
        0
      );
      const totalCreditMinor = credits.reduce(
        (sum, e) => sum + Math.round(Number(e.amount.toString()) * 100),
        0
      );

      expect(totalDebitMinor).toBe(3079446);
      expect(totalCreditMinor).toBe(3079446);
      expect(totalDebitMinor - totalCreditMinor).toBe(0);

      // Customer receives full 30,794.46; platform and vendor settle internally
      const customerCreditEntry = entries.find((e) => e.accountCode === "refund_clearing");
      expect(customerCreditEntry).toBeDefined();
      expect(Number(customerCreditEntry.amount.toString())).toBe(30794.46);
    });

    test("2.5 Idempotency key prevents duplicate return requests or double refunds", async () => {
      const mockOrder = {
        _id: orderId,
        orderNumber: "ORD-IDEMPOTENT",
        customerId,
        status: "delivered",
        deliveredAt: new Date(),
        grandTotal: mongoose.Types.Decimal128.fromString("1180.00"),
        shippingTotal: mongoose.Types.Decimal128.fromString("0.00"),
        shippingAddress: { state: "WB", country: "IN" },
        taxSummary: { pricingMode: "tax_exclusive", totalTax: mongoose.Types.Decimal128.fromString("180.00") },
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            productId: new mongoose.Types.ObjectId(),
            productName: "Item",
            quantity: 1,
            unitPrice: mongoose.Types.Decimal128.fromString("1000.00"),
            lineTotal: mongoose.Types.Decimal128.fromString("1000.00"),
            discountTotal: mongoose.Types.Decimal128.fromString("0.00"),
            taxTotal: mongoose.Types.Decimal128.fromString("180.00"),
            taxDetails: { pricingMode: "tax_exclusive", jurisdictionState: "WB" },
            vendorId,
            fulfillmentStatus: "delivered",
          },
        ],
      };

      Order.findById.mockResolvedValue(mockOrder);

      const existingRecord = {
        _id: new mongoose.Types.ObjectId(),
        returnNumber: "RET-EXISTING-KEY",
        idempotencyKey: "test_key_123",
        status: "requested",
        refundAmount: mongoose.Types.Decimal128.fromString("1180.00"),
      };

      ReturnRequest.findOne.mockResolvedValue(existingRecord);

      const res = await createReturnRequest({
        userId,
        orderId: orderId.toString(),
        type: "return",
        idempotencyKey: "test_key_123",
        items: [
          {
            orderItemId: mockOrder.items[0]._id.toString(),
            productId: mockOrder.items[0].productId.toString(),
            quantity: 1,
            reason: "defective",
          },
        ],
      });

      expect(res).toBe(existingRecord);
      expect(ReturnRequest.create).not.toHaveBeenCalled();
    });
  });
});
